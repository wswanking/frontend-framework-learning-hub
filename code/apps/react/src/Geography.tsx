import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, ThemeProvider, createTheme } from '@mui/material';
import { getTopology, geoNames, type DeviceStatus, type GeoData, type GeoItem, type GeoLevel, type GeoQuery } from './geography';
import type { Context, Role, Scenario } from './dashboard';
import GeoChart from './GeoChart';
import { geoListPage, type GeoDirection, type GeoSort } from './geo-list';
import { geoLegendOptions } from './geo-status';
import './dashboard.css';
import './geography.css';

type Filters = { tenantId: string; productId: string; status: string; continent: string; countryCode: string; nodeId: string; range: string; from: string; to: string };
type Crumb = { level: GeoLevel; id: string; name: string };
const tenants: Record<string, string> = { all: '全部租户', ten_202609_001: '华东智联', ten_202609_002: '全球能源' };
const products: Record<string, string> = { '': '全部产品', prod_as_001: '工业传感器', prod_as_002: '能源网关' };
const statuses: Record<string, string> = { '': '全部状态', unactivated: '未激活', online: '在线', offline: '离线', fault: '故障', maintenance: '维护', alarm: '告警' };
const initialFilters = (): Filters => ({ tenantId: localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', productId: '', status: '', continent: '', countryCode: '', nodeId: '', range: '24h', from: '', to: '' });
function initialLocation(): { filters: Filters; crumbs: Crumb[] } {
  const params = new URLSearchParams(location.search), filters = initialFilters();
  const from = params.get('from'), to = params.get('to');
  if (from && to && Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to)) && Date.parse(from) < Date.parse(to) && Date.parse(to) - Date.parse(from) <= 30 * 86_400_000) {
    filters.from = from; filters.to = to; filters.range = 'custom';
  }
  filters.tenantId = params.get('tenant') || filters.tenantId;
  const continent = params.get('continent') || params.get('region') || '';
  const country = params.get('country') || '';
  const node = params.get('node') || '';
  const countryContinent: Record<string, string> = { CN: 'AS', JP: 'AS', DE: 'EU', FR: 'EU', US: 'NA', CA: 'NA', BR: 'SA', AR: 'SA', ZA: 'AF', EG: 'AF', AU: 'OC', NZ: 'OC' };
  const countryCode = country || /^node_([a-z]{2})_(?:\d{3}|local)$/.exec(node)?.[1]?.toUpperCase() || '';
  const continentCode = continent || countryContinent[countryCode] || '';
  const crumbs: Crumb[] = [];
  if (continentCode && geoNames.continents[continentCode]) crumbs.push({ level: 'continent', id: continentCode, name: geoNames.continents[continentCode] });
  if (countryCode && geoNames.countries[countryCode] && countryContinent[countryCode] === continentCode) crumbs.push({ level: 'country', id: countryCode, name: geoNames.countries[countryCode] });
  if (node && crumbs.at(-1)?.level === 'country' && node.includes(`_${countryCode.toLowerCase()}_`)) crumbs.push({ level: 'node', id: node, name: `${geoNames.countries[countryCode]}节点` });
  return { filters, crumbs };
}
const number = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
function queryFor(filters: Filters, crumbs: Crumb[]): GeoQuery {
  const to = filters.range === 'custom' ? new Date(filters.to) : new Date(), from = filters.range === 'custom' ? new Date(filters.from) : new Date(to.getTime() - ({ '24h': 1, '7d': 7, '30d': 30 }[filters.range] ?? 1) * 86_400_000);
  const parent = crumbs.at(-1);
  return { tenantId: filters.tenantId, productId: filters.productId || undefined, status: filters.status as DeviceStatus || undefined,
    continent: filters.continent || undefined, countryCode: filters.countryCode || undefined, nodeId: filters.nodeId || undefined, from: from.toISOString(), to: to.toISOString(), seed: 42,
    level: parent ? parent.level : 'global', parentId: parent?.id };
}
export default function Geography() {
  const [initial] = useState(initialLocation);
  const [draft, setDraft] = useState(initial.filters);
  const [applied, setApplied] = useState(initial.filters);
  const [crumbs, setCrumbs] = useState<Crumb[]>(initial.crumbs);
  const [role, setRole] = useState<Role>('platformAdmin');
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [themeChoice, setThemeChoice] = useState(localStorage.getItem('iot-atlas-theme') || 'dark');
  const [systemDark, setSystemDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches);
  const [data, setData] = useState<GeoData | null>(null);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<GeoItem | null>(null);
  const detailTrigger = useRef<HTMLElement | SVGElement | null>(null);
  const [listSort, setListSort] = useState<GeoSort>('devices'), [listDirection, setListDirection] = useState<GeoDirection>('desc'), [listPage, setListPage] = useState(1);
  const list = useMemo(() => geoListPage(data?.items ?? [], listSort, listDirection, listPage), [data, listSort, listDirection, listPage]);
  const dark = themeChoice === 'dark' || (themeChoice === 'system' && systemDark);
  const theme = useMemo(() => createTheme({ palette: { mode: dark ? 'dark' : 'light', primary: { main: dark ? '#22cce8' : '#08647b' } } }), [dark]);
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const update = () => setSystemDark(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', themeChoice); }, [dark, themeChoice]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const context: Context = { actorId: 'usr_202609_001', role, tenantId: role === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario };
    getTopology(context, queryFor(applied, crumbs)).then(result => {
      if (!active) return;
      if ('error' in result) { setError(result.error.message); setRetryable(result.error.retryable === true); if (result.error.code === 'FORBIDDEN') { setData(null); setSelected(null); setStale(false); } else setStale(true); }
      else { setData(result.data); setStale(false); setRetryable(false); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [applied, crumbs, role, scenario, retry]);
  const openDetail = useCallback((item: GeoItem) => { const active = document.activeElement; detailTrigger.current = active instanceof HTMLElement || active instanceof SVGElement ? active : null; setSelected(item); }, []);
  const closeDetail = useCallback(() => { setSelected(null); const trigger = detailTrigger.current; detailTrigger.current = null; requestAnimationFrame(() => trigger?.focus()); }, []);
  useEffect(() => { if (!selected) return; document.querySelector<HTMLElement>('.atlas-geography .country-drawer')?.focus(); const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeDetail(); } }; window.addEventListener('keydown', onEscape); return () => window.removeEventListener('keydown', onEscape); }, [selected, closeDetail]);
  const choose = useCallback((item: GeoItem) => {
    if (item.kind === 'device') { openDetail(item); return; }
    setSelected(null);
    setListPage(1);
    setCrumbs(current => [...current, { level: item.kind as GeoLevel, id: item.id, name: item.name }]);
  }, [openDetail]);
  const apply = () => { if (draft.range === 'custom' && (!draft.from || !draft.to || !Number.isFinite(Date.parse(draft.from)) || !Number.isFinite(Date.parse(draft.to)) || Date.parse(draft.from) >= Date.parse(draft.to) || Date.parse(draft.to) - Date.parse(draft.from) > 30 * 86_400_000)) { setFilterError('请选择有效的 30 天内 UTC 时间范围'); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[aria-label="${!Number.isFinite(Date.parse(draft.from)) ? '开始时间' : '结束时间'}"]`)?.focus()); return; } setFilterError(''); if (draft.tenantId !== applied.tenantId) { setData(null); setStale(false); } setApplied({ ...draft }); setCrumbs([]); setSelected(null); setListPage(1); };
  const reset = () => { const next = initialFilters(); if (role !== 'platformAdmin') next.tenantId = 'ten_202609_001'; setDraft(next); setFilterError(''); if (next.tenantId !== applied.tenantId) { setData(null); setStale(false); } setApplied(next); setCrumbs([]); setSelected(null); setListPage(1); };
  const sortList = (key: GeoSort) => { if (listSort === key) setListDirection(current => current === 'asc' ? 'desc' : 'asc'); else { setListSort(key); setListDirection(key === 'name' ? 'asc' : 'desc'); } setListPage(1); };
  const filterLegend = (status: string) => { const next = { ...applied, status }; setDraft(next); setApplied(next); setSelected(null); setListPage(1); };
  const visibleView = data?.mapAvailable ? view : 'list';
  return <ThemeProvider theme={theme}><div className="atlas-dashboard atlas-geography">
    <aside className="atlas-sidebar" aria-label="主导航"><div className="atlas-brand">IoT <strong>Atlas</strong></div><nav><a href="/dashboard">◇ 数据大盘</a><a className="active" href="/geography" aria-current="page">▣ 全球节点</a><a href="/products">◇ 产品与物模型</a><a href="/devices">◇ 设备中心</a><a href="/rules">◇ 规则引擎</a><a href="/firmware">◇ 固件与 OTA</a><a href="/tenants">◇ 租户管理</a><a href="/labs">◇ 实验室</a><a href="/delivery">◇ 交付看板</a></nav><a className="diagnostic-link" href="/">诊断页</a></aside>
    <main className="atlas-workspace"><header className="atlas-header"><div><small>IoT Atlas / 全球节点</small><h1>全球节点</h1><p>从洲、国家到节点与设备；坐标为城市级演示数据。</p></div><div className="header-actions"><label>主题<select aria-label="主题" value={themeChoice} onChange={event => setThemeChoice(event.target.value)}><option value="dark">暗色</option><option value="light">亮色</option><option value="system">跟随系统</option></select></label><label>演示身份<select aria-label="演示身份" value={role} onChange={event => { setData(null); setSelected(null); setStale(false); setRole(event.target.value as Role); }}><option value="platformAdmin">平台管理员</option><option value="tenantAdmin">租户管理员</option><option value="operator">运维工程师</option><option value="viewer">数据观察员</option></select></label></div></header>
      <Card className="geo-filters" component="section" aria-label="节点筛选"><h2>筛选条件</h2><div className="geo-filter-grid">
        <label>租户<select aria-label="租户" value={draft.tenantId} onChange={event => setDraft({ ...draft, tenantId: event.target.value })}>{Object.entries(tenants).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <label>产品<select aria-label="产品" value={draft.productId} onChange={event => setDraft({ ...draft, productId: event.target.value })}>{Object.entries(products).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <label>状态<select aria-label="状态" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{Object.entries(statuses).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <label>区域<select aria-label="区域" value={draft.continent} onChange={event => setDraft({ ...draft, continent: event.target.value })}><option value="">全部区域</option>{Object.entries(geoNames.continents).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <label>国家<select aria-label="国家" value={draft.countryCode} onChange={event => setDraft({ ...draft, countryCode: event.target.value })}><option value="">全部国家</option>{Object.entries(geoNames.countries).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <label>节点<select aria-label="节点" value={draft.nodeId} onChange={event => setDraft({ ...draft, nodeId: event.target.value })}><option value="">全部节点</option>{Object.keys(geoNames.countries).map(code => <option value={`node_${code.toLowerCase()}_001`} key={code}>{geoNames.countries[code]}节点</option>)}</select></label>
        <label>时间范围<select aria-label="时间范围" value={draft.range} onChange={event => setDraft({ ...draft, range: event.target.value })}><option value="24h">24 小时</option><option value="7d">7 天</option><option value="30d">30 天</option><option value="custom">自定义</option></select></label>
        {draft.range === 'custom' && <><label>开始时间<input aria-label="开始时间" type="datetime-local" aria-invalid={!!filterError && !Number.isFinite(Date.parse(draft.from))} aria-describedby={filterError ? 'geo-range-error' : undefined} value={draft.from ? new Date(new Date(draft.from).getTime() - new Date(draft.from).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''} onChange={event => setDraft({ ...draft, from: event.target.value ? new Date(event.target.value).toISOString() : '' })} /></label><label>结束时间<input aria-label="结束时间" type="datetime-local" aria-invalid={!!filterError && Number.isFinite(Date.parse(draft.from))} aria-describedby={filterError ? 'geo-range-error' : undefined} value={draft.to ? new Date(new Date(draft.to).getTime() - new Date(draft.to).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''} onChange={event => setDraft({ ...draft, to: event.target.value ? new Date(event.target.value).toISOString() : '' })} /></label></>}
        {filterError && <p id="geo-range-error" role="alert">{filterError}</p>}
        <div className="geo-filter-actions"><Button variant="contained" onClick={apply} disabled={loading}>应用</Button><Button variant="outlined" onClick={reset}>重置</Button></div>
      </div><details className="scenario-control"><summary>演示状态</summary><label>Mock 场景<select aria-label="Mock 场景" value={scenario} onChange={event => { if (event.target.value === 'forbidden') { setData(null); setSelected(null); setStale(false); } setScenario(event.target.value as Scenario); }}><option value="normal">正常</option><option value="slow">缓慢</option><option value="partialFailure">地图不可用</option><option value="offline">服务离线</option><option value="forbidden">无权限</option></select></label></details></Card>
      <div className="dashboard-feedback" aria-live="polite">{loading && <span role="status">节点数据加载中…</span>}{error && <span role="alert">{error}{stale && data ? '；当前显示上次成功的数据（非最新）' : ''} {retryable && <Button size="small" onClick={() => setRetry(value => value + 1)}>重试</Button>}</span>}{data && !data.mapAvailable && !error && <span role="alert">地图不可用，已切换到同数据的列表视图。</span>}</div>
      {data && <><nav className="geo-breadcrumb" aria-label="地理层级"><button onClick={() => { setCrumbs([]); setSelected(null); setListPage(1); }}>全球</button>{crumbs.map((crumb, index) => <span key={crumb.id}> › <button onClick={() => { setCrumbs(crumbs.slice(0, index + 1)); setSelected(null); setListPage(1); }}>{crumb.name}</button></span>)}</nav>
        <div className="geo-summary" aria-label="节点统计"><Card>设备 <strong>{number(data.summary.devices)}</strong></Card><Card>在线 <strong>{number(data.summary.onlineDevices)}</strong></Card><Card>消息量 <strong>{number(data.summary.messages)}</strong></Card><Card>告警 <strong>{number(data.summary.alarms)}</strong></Card><Card>未定位 <strong>{number(data.summary.unlocated)}</strong></Card></div>
        <Card className="geo-main" component="section"><div className="geo-title"><div><h2>{crumbs.at(-1)?.name ?? '全球'}节点分布</h2><small>地图缩放不改变筛选范围；点击对象下钻。</small></div><div className="geo-switch"><Button variant={visibleView === 'map' ? 'contained' : 'outlined'} onClick={() => setView('map')} disabled={!data.mapAvailable}>地图视图</Button><Button variant={visibleView === 'list' ? 'contained' : 'outlined'} onClick={() => setView('list')}>列表视图</Button></div></div><div className="geo-legend" role="group" aria-label="设备状态图例">{geoLegendOptions.map(option => <button key={option.status} type="button" aria-pressed={applied.status === option.status} disabled={loading} onClick={() => filterLegend(option.status)}><span className="geo-legend-dot" style={{ backgroundColor: option.color }} />{option.label}</button>)}</div>
          {data.items.length === 0 ? <p>当前筛选范围没有节点或设备。</p> : <div className="geo-content">{visibleView === 'map' && <GeoChart items={data.items} status={applied.status} onSelect={item => item.kind === 'node' || item.kind === 'device' ? openDetail(item) : choose(item)} onClear={closeDetail} />}<div className="geo-list"><h3>{visibleView === 'map' ? '区域与节点列表' : '全部结果'}</h3><table><thead><tr><th aria-sort={listSort === 'name' ? listDirection === 'asc' ? 'ascending' : 'descending' : undefined}><button onClick={() => sortList('name')}>名称{listSort === 'name' ? listDirection === 'asc' ? ' ↑' : ' ↓' : ''}</button></th><th aria-sort={listSort === 'devices' ? listDirection === 'asc' ? 'ascending' : 'descending' : undefined}><button onClick={() => sortList('devices')}>设备数{listSort === 'devices' ? listDirection === 'asc' ? ' ↑' : ' ↓' : ''}</button></th><th>状态</th><th>详情</th></tr></thead><tbody>{list.items.map(item => <tr key={item.id}><td><button onClick={() => choose(item)}>{item.name}</button></td><td>{number(item.devices)}</td><td>{item.status ? statuses[item.status] : `${Math.round((item.onlineRate ?? 0) * 100)}% 在线`}</td><td><button aria-label={`查看${item.name}详情`} onClick={() => openDetail(item)}>查看</button></td></tr>)}</tbody></table><nav className="geo-pagination" aria-label="节点列表分页"><button disabled={list.page === 1} onClick={() => setListPage(list.page - 1)}>上一页</button><span>第 {list.page}/{list.pages} 页，共 {list.total} 项</span><button disabled={list.page === list.pages} onClick={() => setListPage(list.page + 1)}>下一页</button></nav></div></div>}
        </Card><Card className="geo-unlocated" component="section"><h2>未定位设备（{data.unlocated.length}）</h2><p>设备没有坐标时保留在列表中；不会绘制虚构位置。</p>{data.unlocated.length ? <ul>{data.unlocated.map(item => <li key={item.id}><button onClick={() => openDetail(item)}>{item.id}</button> · {geoNames.countries[item.countryCode!]} · {statuses[item.status!]}</li>)}</ul> : <p>当前范围没有未定位设备。</p>}</Card>
      </>}
    </main>{selected && <aside className="country-drawer" role="dialog" aria-modal="false" tabIndex={-1} aria-label={`${selected.name}详情`}><div className="drawer-head"><h2>{selected.name} · 详情</h2><button aria-label="关闭详情" onClick={closeDetail}>×</button></div><p>{selected.kind === 'device' ? '设备' : selected.kind} · 城市级演示坐标</p><dl>{[['ID', selected.id], ['状态', selected.status ? statuses[selected.status] : '聚合'], ['坐标', selected.coordinates ? selected.coordinates.join(', ') : '未定位'], ['在线率', selected.onlineRate === null ? '—' : `${Math.round(selected.onlineRate * 100)}%`], ['设备数', number(selected.devices)], ['消息量', number(selected.messages)], ['告警数', number(selected.alarms)], ['最后活动时间', selected.lastActiveAt ?? '—']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{selected.kind === 'device' && <a href={`/devices?device=${encodeURIComponent(selected.id)}`}>查看设备详情</a>}</aside>}
  </div></ThemeProvider>;
}
