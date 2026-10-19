import { Link } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CircularProgress, FormControl, InputLabel, MenuItem, Select, ThemeProvider, createTheme } from '@mui/material';
import { getSummary, type Context, type DashboardData, type DashboardQuery, type Role, type Scenario } from './dashboard';
import { AlarmChart, TrendChart, WorldChart } from './DashboardCharts';
import './dashboard.css';

type Range = '24h' | '7d' | '30d' | 'custom';
type Draft = { tenantId: string; region: string; range: Range; from: string; to: string };
type ThemeChoice = 'light' | 'dark' | 'system';
const DAY = 86_400_000;
const tenantNames: Record<string, string> = { all: '全部租户', ten_202609_001: '华东智联', ten_202609_002: '全球能源' };
const continentNames: Record<string, string> = { AS: '亚洲', EU: '欧洲', NA: '北美洲', SA: '南美洲', AF: '非洲', OC: '大洋洲' };
const countryNames: Record<string, string> = { CN: '中国', DE: '德国', US: '美国', BR: '巴西', ZA: '南非', AU: '澳大利亚', JP: '日本', FR: '法国', CA: '加拿大', AR: '阿根廷', EG: '埃及', NZ: '新西兰' };
const countryContinent: Record<string, string> = { CN: 'AS', JP: 'AS', DE: 'EU', FR: 'EU', US: 'NA', CA: 'NA', BR: 'SA', AR: 'SA', ZA: 'AF', EG: 'AF', AU: 'OC', NZ: 'OC' };
function geographyUrl(query: DashboardQuery, continent?: string, country?: string, node?: string) {
  const params = new URLSearchParams({ tenant: query.tenantId, from: query.from, to: query.to });
  if (continent) params.set('continent', continent);
  if (country) params.set('country', country);
  if (node) params.set('node', node);
  return `/geography?${params}`;
}
const number = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
const percent = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const eventLabels = { info: '● 遥测', minor: '⚠ 一般告警', major: '⚠ 重要告警', critical: '⛔ 紧急告警' };
const defaultDraft = (): Draft => ({ tenantId: localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', region: '', range: '24h', from: '', to: '' });
const localInput = (iso: string) => { const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
function queryFromDraft(draft: Draft): DashboardQuery {
  const to = draft.range === 'custom' ? new Date(draft.to) : new Date();
  const from = draft.range === 'custom' ? new Date(draft.from) : new Date(to.getTime() - ({ '24h': DAY, '7d': 7 * DAY, '30d': 30 * DAY }[draft.range]));
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to.getTime() > Date.now() + 1000 || to.getTime() - from.getTime() > 30 * DAY) throw new Error('请选择有效且不晚于当前时间的 30 天内范围');
  return { tenantId: draft.tenantId, region: draft.region || undefined, from: from.toISOString(), to: to.toISOString(), seed: 42 };
}
function initialQuery(): DashboardQuery {
  const params = new URLSearchParams(location.search);
  const tenantId = params.get('tenant'), from = params.get('from'), to = params.get('to');
  if (tenantId && from && to && Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to))) return { tenantId, from, to, region: params.get('region') || undefined, seed: 42 };
  return queryFromDraft({ ...defaultDraft(), tenantId: tenantId || defaultDraft().tenantId });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [applied, setApplied] = useState<DashboardQuery>(initialQuery);
  const [draft, setDraft] = useState<Draft>(() => ({ tenantId: applied.tenantId, region: applied.region || '', range: new URLSearchParams(location.search).has('from') ? 'custom' : '24h', from: localInput(applied.from), to: localInput(applied.to) }));
  const [role, setRole] = useState<Role>('platformAdmin');
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [stale, setStale] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const pausedRef = useRef(false);
  const dataRef = useRef<DashboardData | null>(null);
  const pendingRef = useRef<DashboardData | null>(null);
  const eventListRef = useRef<HTMLUListElement | null>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const focusedDrawerRef = useRef<string | null>(null);
  const [country, setCountry] = useState<string | null>(() => new URLSearchParams(location.search).get('country'));
  const [node, setNode] = useState<string | null>(() => new URLSearchParams(location.search).get('node'));
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(() => (localStorage.getItem('iot-atlas-theme') as ThemeChoice) || 'dark');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = themeChoice === 'dark' || (themeChoice === 'system' && systemDark);
  const theme = useMemo(() => createTheme({ palette: { mode: dark ? 'dark' : 'light', primary: { main: dark ? '#22cce8' : '#08647b' } }, shape: { borderRadius: 8 } }), [dark]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', themeChoice); }, [dark, themeChoice]);
  const urlFor = useCallback((query: DashboardQuery, selected?: string, selectedNode?: string) => {
    const params = new URLSearchParams({ tenant: query.tenantId, from: query.from, to: query.to });
    if (query.region) params.set('region', query.region);
    if (selected) params.set('country', selected);
    if (selectedNode) params.set('node', selectedNode);
    return `/dashboard?${params}`;
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    const context: Context = { actorId: 'usr_202609_001', role, tenantId: role === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario };
    getSummary(context, applied).then(result => {
      if (!current) return;
      if ('error' in result) { setError(result.error.message); setRetryable(result.error.retryable === true); if (result.error.code === 'FORBIDDEN') { dataRef.current = null; pendingRef.current = null; pausedRef.current = false; setPaused(false); setPendingCount(0); setCountry(null); setNode(null); setData(null); setStale(false); navigate(urlFor(applied)); } else setStale(true); }
      else { if (pausedRef.current && dataRef.current) { pendingRef.current = result.data; const seen = new Set(dataRef.current.events.map(item => item.id)); setPendingCount(result.data.events.filter(item => !seen.has(item.id)).length); const visible = { ...result.data, events: dataRef.current.events }; dataRef.current = visible; setData(visible); } else { dataRef.current = result.data; setData(result.data); } setRefreshedAt(new Date().toISOString()); setStale(false); setRetryable(false); }
      setLoading(false);
    });
    return () => { current = false; };
  }, [applied, role, scenario, retryKey, navigate, urlFor]);
  useEffect(() => {
    const refresh = () => setRetryKey(value => value + 1);
    const onStorage = (event: StorageEvent) => { if (['iot-atlas-device-messages-v1', 'iot-atlas-device-alarm-acks-v1', 'iot-atlas-ota-v1', 'iot-atlas-devices-v1', 'iot-atlas-rule-logs-v1'].includes(event.key ?? '')) refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('iot-atlas-mock-changed', refresh);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('iot-atlas-mock-changed', refresh); };
  }, []);
  const clearPause = () => { pausedRef.current = false; setPaused(false); pendingRef.current = null; setPendingCount(0); };
  const pauseEvents = () => { pausedRef.current = true; setPaused(true); };
  const resumeEvents = () => { pausedRef.current = false; setPaused(false); if (pendingRef.current) { dataRef.current = pendingRef.current; setData(pendingRef.current); pendingRef.current = null; } setPendingCount(0); if (eventListRef.current) eventListRef.current.scrollTop = 0; };
  const rememberDrawerTrigger = () => { const active = document.activeElement; if (active instanceof HTMLElement && !active.closest('.country-drawer')) drawerTriggerRef.current = active; };
  const restoreDrawerTrigger = () => { const trigger = drawerTriggerRef.current; requestAnimationFrame(() => trigger?.focus()); };
  const openCountry = (code: string) => { rememberDrawerTrigger(); setNode(null); setCountry(code); navigate(urlFor(applied, code)); };
  const closeCountry = () => { setCountry(null); navigate(urlFor(applied)); restoreDrawerTrigger(); };
  const openNode = (id: string) => { rememberDrawerTrigger(); setCountry(null); setNode(id); navigate(urlFor(applied, undefined, id)); };
  const closeNode = () => { setNode(null); navigate(urlFor(applied)); restoreDrawerTrigger(); };
  useEffect(() => {
    const id = node ?? country;
    if (!id) { focusedDrawerRef.current = null; return; }
    if (id !== focusedDrawerRef.current) { const drawer = document.querySelector<HTMLElement>('.country-drawer'); if (drawer) { drawer.focus(); focusedDrawerRef.current = id; } }
  }, [country, node, data]);
  useEffect(() => {
    if (!country && !node) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key !== 'Escape') return; event.preventDefault(); setCountry(null); setNode(null); navigate(urlFor(applied)); restoreDrawerTrigger(); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [country, node, applied, navigate, urlFor]);
  const openContinent = (id: string) => { const next = { ...applied, region: id }; clearPause(); setCountry(null); setNode(null); setDraft(current => ({ ...current, region: id })); setApplied(next); navigate(urlFor(next)); };
  const apply = () => {
    try { const next = queryFromDraft(draft); clearPause(); if (next.tenantId !== applied.tenantId) { dataRef.current = null; setData(null); } setFilterError(''); setError(''); setCountry(null); setNode(null); setApplied(next); navigate(urlFor(next)); setFilterOpen(false); }
    catch (cause) { setFilterError((cause as Error).message); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[aria-label="${!Number.isFinite(Date.parse(draft.from)) ? '开始时间' : '结束时间'}"]`)?.focus()); }
  };
  const reset = () => { const nextDraft = defaultDraft(); if (role !== 'platformAdmin') nextDraft.tenantId = 'ten_202609_001'; setDraft(nextDraft); setFilterError(''); const next = queryFromDraft(nextDraft); clearPause(); if (next.tenantId !== applied.tenantId) { dataRef.current = null; setData(null); } setCountry(null); setNode(null); setApplied(next); navigate(urlFor(next)); setFilterOpen(false); };
  const selected = data?.countries.find(item => item.id === country);
  const selectedNode = data?.nodes.find(item => item.id === node);
  return <ThemeProvider theme={theme}><div className="atlas-dashboard">

    <div className="atlas-workspace"><header className="atlas-header"><div><small>IoT Atlas / 数据大盘</small><h1>全球设备运行态势</h1><p>同一查询联动指标、地理分布、消息趋势与事件。</p><p>最后更新时间：{refreshedAt && data ? new Date(refreshedAt).toLocaleString('zh-CN') : '—'}</p></div><div className="header-actions"><Button size="small" onClick={() => setRetryKey(value => value + 1)} disabled={loading}>刷新</Button><label>主题<select aria-label="主题" value={themeChoice} onChange={event => setThemeChoice(event.target.value as ThemeChoice)}><option value="dark">暗色</option><option value="light">亮色</option><option value="system">跟随系统</option></select></label><label>演示身份<select aria-label="演示身份" value={role} onChange={event => { clearPause(); dataRef.current = null; setData(null); setCountry(null); setNode(null); drawerTriggerRef.current = null; focusedDrawerRef.current = null; navigate(urlFor(applied)); setRole(event.target.value as Role); }}><option value="platformAdmin">平台管理员</option><option value="tenantAdmin">租户管理员</option><option value="operator">运维工程师</option><option value="viewer">数据观察员</option></select></label></div></header>
      <Card className="filter-panel" component="section" aria-label="大盘筛选" data-open={filterOpen}><button type="button" className="filter-toggle" aria-expanded={filterOpen} aria-controls="dashboard-filter-body" onClick={() => setFilterOpen(open => !open)}>筛选条件（{filterOpen ? '收起' : '展开'}）</button><div id="dashboard-filter-body" className="filter-body"><div className="filter-grid">
        <FormControl size="small"><InputLabel id="tenant-label">租户</InputLabel><Select labelId="tenant-label" label="租户" value={draft.tenantId} onChange={event => setDraft({ ...draft, tenantId: event.target.value })}>{Object.entries(tenantNames).map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}</Select></FormControl>
        <FormControl size="small"><InputLabel id="range-label">时间范围</InputLabel><Select labelId="range-label" label="时间范围" value={draft.range} onChange={event => setDraft({ ...draft, range: event.target.value as Range })}><MenuItem value="24h">24 小时</MenuItem><MenuItem value="7d">7 天</MenuItem><MenuItem value="30d">30 天</MenuItem><MenuItem value="custom">自定义</MenuItem></Select></FormControl>
        <FormControl size="small"><InputLabel id="region-label">地域</InputLabel><Select labelId="region-label" label="地域" value={draft.region} onChange={event => setDraft({ ...draft, region: event.target.value })}><MenuItem value="">全球</MenuItem>{Object.entries(continentNames).map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}</Select></FormControl>
        <div className="filter-actions"><Button variant="contained" onClick={apply} disabled={loading}>应用</Button><Button variant="outlined" onClick={reset}>重置</Button></div>
      </div>{draft.range === 'custom' && <div className="custom-range"><label>开始时间<input aria-label="开始时间" type="datetime-local" value={draft.from} aria-invalid={!!filterError && !Number.isFinite(Date.parse(draft.from))} aria-describedby={filterError ? 'dashboard-range-error' : undefined} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label><label>结束时间<input aria-label="结束时间" type="datetime-local" value={draft.to} aria-invalid={!!filterError && Number.isFinite(Date.parse(draft.from))} aria-describedby={filterError ? 'dashboard-range-error' : undefined} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>{filterError && <p id="dashboard-range-error" role="alert">{filterError}</p>}</div>}
      <details className="scenario-control"><summary>演示状态</summary><label>Mock 场景<select aria-label="Mock 场景" value={scenario} onChange={event => { if (event.target.value === 'forbidden') { clearPause(); dataRef.current = null; setData(null); setCountry(null); setNode(null); drawerTriggerRef.current = null; focusedDrawerRef.current = null; navigate(urlFor(applied)); } setScenario(event.target.value as Scenario); }}><option value="normal">正常</option><option value="slow">缓慢</option><option value="partialFailure">地图局部失败</option><option value="offline">服务离线</option><option value="forbidden">无权限</option></select></label></details></div></Card>
      <div className="dashboard-feedback" aria-live="polite">{loading && <span role="status"><CircularProgress size={16} /> 数据加载中…</span>}{error && <span role="alert">{error}{stale && data ? '；当前显示上次成功的数据（非最新）' : ''} {retryable && <Button size="small" onClick={() => setRetryKey(value => value + 1)}>重试</Button>}</span>}{data?.unavailable.includes('geography') && !error && <span role="alert">地图分区暂不可用，其他区域已更新。</span>}</div>
      {data ? <><section className="metric-grid" aria-label="关键指标">{[
        ['接入设备', number(data.metrics.devices), '台', number(data.comparison.devices)], ['在线率', percent(data.metrics.onlineRate), `${number(data.metrics.onlineDevices)} 台在线`, percent(data.comparison.onlineRate)], ['消息量', number(data.metrics.messages), '条', number(data.comparison.messages)], ['活跃告警', number(data.metrics.activeAlarms), '条', number(data.comparison.activeAlarms)], ['OTA 成功率', percent(data.metrics.otaSuccessRate), '已完成执行', percent(data.comparison.otaSuccessRate)],
      ].map(([label, value, hint, previous]) => <Card key={label} className="metric-card" component="article"><span>{label}</span><strong>{value}</strong><small>{hint}</small><small>上期 {previous}</small><small>统计截至 {new Date(data.updatedAt).toLocaleString('zh-CN')}</small></Card>)}</section>
        <div className="dashboard-analysis"><Card className="map-panel" component="section"><h2>全球节点地图</h2>{data.unavailable.includes('geography') ? <p role="status">地理分区暂不可用。</p> : data.metrics.devices === 0 ? <p>当前筛选范围无设备。</p> : <WorldChart data={data} onCountry={openCountry} />}</Card><Card className="region-panel" component="section"><h2>区域概览</h2>{data.unavailable.includes('geography') ? <p>区域数据暂不可用。</p> : <><ul className="region-list">{data.continents.map(item => <li key={item.id}><button onClick={() => openContinent(item.id)}>{(continentNames[item.id] ?? item.id)}</button><strong>{number(item.devices)}</strong><small>{number(item.messages)} 条消息</small><Link to={geographyUrl(applied, item.id)}>查看地理详情</Link></li>)}</ul><h3>国家排行</h3><ul className="country-list">{data.countries.map(item => <li key={item.id}><button onClick={() => openCountry(item.id)}>{(countryNames[item.id] ?? item.id)} <strong>{number(item.devices)} 台</strong></button></li>)}</ul></>}</Card></div>
        <div className="dashboard-bottom"><Card component="section"><h2>消息吞吐趋势</h2><TrendChart data={data} /><details><summary>查看趋势数据</summary><table><thead><tr><th>时间 UTC</th><th>消息量</th></tr></thead><tbody>{data.trend.map(item => <tr key={item.timestamp}><td>{item.timestamp}</td><td>{number(item.messages)}</td></tr>)}</tbody></table></details></Card><Card component="section"><h2>告警分布</h2><AlarmChart data={data} /><ul className="alarm-legend">{data.alarmDistribution.map(item => <li key={item.severity}>{ { critical: '紧急', major: '重要', minor: '一般' }[item.severity]}：{number(item.count)}</li>)}</ul></Card><Card component="section"><div className="event-head"><h2>实时事件</h2><Button size="small" aria-expanded={showAllEvents} onClick={() => setShowAllEvents(value => !value)}>{showAllEvents ? '收起事件' : '查看全部'}</Button><Button size="small" onClick={paused ? resumeEvents : pauseEvents}>{paused ? '恢复事件' : '暂停事件'}</Button></div>{paused && pendingCount > 0 && <button className="event-pending" onClick={resumeEvents}>有 {pendingCount} 条新事件，点击回到顶部</button>}<ul ref={eventListRef} className={`event-list${showAllEvents ? ' event-list-all' : ''}`} tabIndex={0} aria-label="实时事件列表" onScroll={event => { if (event.currentTarget.scrollTop > 16 && !pausedRef.current) pauseEvents(); }}>{data.events.map(event => <li key={event.id} data-severity={event.severity}><span>{eventLabels[event.severity]}</span><strong>{event.resourceId}</strong><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString('zh-CN')}</time></li>)}</ul>{data.events.length === 0 && <p>当前范围没有事件。</p>}</Card></div>
      </> : !loading && !error && <Card className="empty-panel"><p>暂无可展示的大盘数据。请调整筛选或重试。</p></Card>}
    </div>{country && selected && <aside className="country-drawer" role="dialog" aria-modal="false" tabIndex={-1} aria-label={`${(countryNames[country] ?? country)}节点详情`}><div className="drawer-head"><h2>{(countryNames[country] ?? country)} · 节点详情</h2><button aria-label="关闭详情" onClick={closeCountry}>×</button></div><p>当前筛选：{tenantNames[applied.tenantId]} · {new Date(applied.from).toLocaleDateString('zh-CN')} 至 {new Date(applied.to).toLocaleDateString('zh-CN')}</p><dl><div><dt>设备数</dt><dd>{number(selected.devices)}</dd></div><div><dt>消息量</dt><dd>{number(selected.messages)}</dd></div></dl><Link to={geographyUrl(applied, countryContinent[country], country)}>在地理页查看国家</Link><h3>节点列表</h3><ul>{data?.nodes.filter(node => node.countryCode === country).map(node => <li key={node.id}><button onClick={() => openNode(node.id)}>{node.id} · {number(node.devices)} 台</button></li>)}</ul></aside>}{node && selectedNode && <aside className="country-drawer" role="dialog" aria-modal="false" tabIndex={-1} aria-label={`${node}节点详情`}><div className="drawer-head"><h2>{node} · 节点详情</h2><button aria-label="关闭节点详情" onClick={closeNode}>×</button></div><p>当前筛选：{tenantNames[applied.tenantId]} · {new Date(applied.from).toLocaleDateString('zh-CN')} 至 {new Date(applied.to).toLocaleDateString('zh-CN')}</p><dl><div><dt>设备数</dt><dd>{number(selectedNode.devices)}</dd></div><div><dt>消息量</dt><dd>{number(selectedNode.messages)}</dd></div><div><dt>城市级演示坐标</dt><dd>{selectedNode.coordinates?.join(', ') ?? '未定位'}</dd></div></dl><h3>节点设备</h3><ul className="dashboard-node-device-list">{selectedNode.deviceIds.map(deviceId => <li key={deviceId}><Link to={`/devices?device=${encodeURIComponent(deviceId)}`}>{deviceId} · 查看设备详情</Link></li>)}</ul><Link to={geographyUrl(applied, countryContinent[selectedNode.countryCode], selectedNode.countryCode, node)}>在地理页查看节点</Link><Button onClick={() => openCountry(selectedNode.countryCode)}>返回国家节点</Button></aside>}
  </div></ThemeProvider>;
}
