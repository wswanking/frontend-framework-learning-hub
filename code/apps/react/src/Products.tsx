import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, ThemeProvider, createTheme } from '@mui/material';
import type { Context, Role, Scenario } from './dashboard';
import { tenantOptions } from './catalog';
import { products, defaultAccessConfig, modelIdentifierError, type AccessConfig, type Conversion, type DataType, type DpRule, type Product, type ProductInput, type ProductStatus, type ThingModelItem } from './products';
import './dashboard.css';
import './products.css';
import { downloadProductCsv } from './product-export';
import { parseJsonObject } from './model-json';
import { devices, type Device } from './devices';
import { tenants } from './tenants';

type Tab = 'basic' | 'access' | 'model' | 'dp' | 'devices';
type ListFilters = { tenantId: string; keyword: string; category: string; status: string; page: number; pageSize: number };
const tenantNames: Record<string, string> = { all: '全部租户', ...Object.fromEntries(tenantOptions().map(item => [item.id, item.name])) };
const statusNames: Record<string, string> = { draft: '草稿', published: '已发布', disabled: '已停用' };
const deviceStatusNames: Record<string, string> = { unactivated: '未激活', online: '在线', offline: '离线', fault: '故障', maintenance: '维护' };
const kindNames: Record<string, string> = { property: '属性', event: '事件', service: '服务' };
const accessNames: Record<string, string> = { read: '只读', write: '只写', readWrite: '读写' };
const initialList = (): ListFilters => ({ tenantId: new URLSearchParams(location.search).get('tenant') || localStorage.getItem('iot-atlas-current-tenant-v1') || 'all', keyword: '', category: '', status: '', page: 1, pageSize: 10 });
const emptyProduct = (tenantId: string): ProductInput => ({ tenantId: tenantId === 'all' ? 'ten_202609_001' : tenantId, name: '', productKey: '', category: '工业传感器', protocol: 'MQTT', status: 'draft' });
const productInput = (product: Product): ProductInput => ({ tenantId: product.tenantId, name: product.name, productKey: product.productKey, category: product.category, protocol: product.protocol, status: product.status });
const emptyItem = (): ThingModelItem => ({ id: '', kind: 'property', identifier: '', name: '', dataType: 'float', accessMode: 'read', unit: '', min: 0, max: 100 });
const emptyRule = (itemId: string): DpRule => ({ id: '', itemId, rawType: 'int16', scale: 1, offset: 0, precision: 1, enumMap: [], expression: 'x' });
const serialize = (value: unknown) => JSON.stringify(value);
const number = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

export default function Products() {
  const [role, setRole] = useState<Role>('platformAdmin');
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [themeChoice, setThemeChoice] = useState(localStorage.getItem('iot-atlas-theme') || 'dark');
  const [systemDark, setSystemDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = themeChoice === 'dark' || (themeChoice === 'system' && systemDark);
  const theme = useMemo(() => createTheme({ palette: { mode: dark ? 'dark' : 'light', primary: { main: dark ? '#22cce8' : '#08647b' } } }), [dark]);
  const canWrite = role === 'platformAdmin' || role === 'tenantAdmin';
  const [draftFilters, setDraftFilters] = useState(initialList);
  const [filters, setFilters] = useState(initialList);
  const [rows, setRows] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const visibleSelected = rows.filter(product => selectedProducts.includes(product.id));
  const toggleProduct = (id: string) => setSelectedProducts(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const [tab, setTab] = useState<Tab>('basic');
  const [base, setBase] = useState<ProductInput>(emptyProduct('all'));
  const [access, setAccess] = useState<AccessConfig>(defaultAccessConfig('MQTT'));
  const [model, setModel] = useState<ThingModelItem>(emptyItem);
  const [modelOriginal, setModelOriginal] = useState<ThingModelItem>(emptyItem);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(serialize(emptyItem()));
  const modelJsonInput = useRef<HTMLTextAreaElement>(null);
  const [rule, setRule] = useState<DpRule>(emptyRule(''));
  const [ruleOriginal, setRuleOriginal] = useState<DpRule>(emptyRule(''));
  const [enumText, setEnumText] = useState('[]');
  const [raw, setRaw] = useState('850');
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [impact, setImpact] = useState<'base' | 'model' | 'remove' | null>(null);
  const [typePending, setTypePending] = useState<DataType | null>(null);
  const modalKind = pending ? 'pending' : impact ? 'impact' : typePending ? 'type' : null;
  const [removeId, setRemoveId] = useState('');
  const [reload, setReload] = useState(0);
  const [devicePage, setDevicePage] = useState(1);
  const [deviceRows, setDeviceRows] = useState<Device[]>([]);
  const [deviceTotal, setDeviceTotal] = useState(0);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const [capacityNote, setCapacityNote] = useState('');
  const context = useCallback((currentRole = role): Context => ({ actorId: 'usr_202609_001', role: currentRole, tenantId: currentRole === 'platformAdmin' ? 'all' : 'ten_202609_001', seed: 42, scenario }), [role, scenario]);
  useEffect(() => {
    if (selectedId !== 'new') return;
    let active = true; setCapacityNote('正在查询产品配额…');
    void tenants.checkCapacity(context(), base.tenantId, 'products').then(result => {
      if (!active) return;
      setCapacityNote('error' in result ? result.error.message : `产品配额已用 ${result.data.used}/${result.data.limit}${(result.data.used + 1) / result.data.limit * 100 >= result.data.warningAt ? `；保存后达到 ${result.data.warningAt}% 预警阈值` : ''}`);
    });
    return () => { active = false; };
  }, [selectedId, base.tenantId, context]);
  const dirty = !!selectedId && (tab === 'basic' ? serialize(base) !== serialize(detail ? productInput(detail) : emptyProduct(filters.tenantId))
    : tab === 'access' ? !!detail && serialize(access) !== serialize(detail.accessConfig)
    : tab === 'model' ? (jsonMode ? jsonText !== JSON.stringify(modelOriginal, null, 2) : serialize(model) !== serialize(modelOriginal))
      : tab === 'dp' ? serialize(rule) !== serialize(ruleOriginal) || enumText !== JSON.stringify(ruleOriginal.enumMap) : false);
  const identifierIssue = tab === 'model' && !jsonMode && detail ? modelIdentifierError(model.identifier, model.id, detail.model) : null;
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const update = () => setSystemDark(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('iot-atlas-theme', themeChoice); }, [dark, themeChoice]);
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [dirty]);
  useEffect(() => {
    if (!modalKind) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>('.product-modal[role="dialog"]')?.focus());
    const onKeydown = (event: KeyboardEvent) => {
      const dialog = document.querySelector<HTMLElement>('.product-modal[role="dialog"]');
      if (!dialog) return;
      if (event.key === 'Escape') { event.preventDefault(); if (modalKind === 'pending') setPending(null); else if (modalKind === 'impact') { setImpact(null); setRemoveId(''); } else setTypePending(null); return; }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeydown);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKeydown); requestAnimationFrame(() => { if (modalKind === 'type') document.querySelector<HTMLElement>('[aria-label="数据类型"]')?.focus(); else if (trigger?.isConnected) trigger.focus(); }); };
  }, [modalKind]);
  useEffect(() => {
    let active = true; setListLoading(true); setSelectedProducts([]);
    products.list(context(), { tenantId: filters.tenantId, keyword: filters.keyword || undefined, category: filters.category || undefined, status: filters.status as ProductStatus || undefined, page: filters.page, pageSize: filters.pageSize, seed: 42 }).then(response => {
      if (!active) return;
      if ('error' in response) { setMessage(response.error.message); setRows([]); setTotal(0); if (response.error.code === 'FORBIDDEN') { setSelectedId(null); setDetail(null); setPending(null); setImpact(null); setTypePending(null); } }
      else { setRows(response.data.items); setTotal(response.data.total); }
      setListLoading(false);
    });
    return () => { active = false; };
  }, [context, filters, reload]);
  useEffect(() => {
    if (!selectedId || selectedId === 'new') return;
    let active = true;
    products.get(context(), selectedId).then(response => {
      if (!active) return;
      if ('error' in response) { setMessage(response.error.message); setSelectedId(null); setDetail(null); }
      else { setDetail(response.data); setBase(productInput(response.data)); setAccess(response.data.accessConfig); setFieldErrors({}); }
    });
    return () => { active = false; };
  }, [context, selectedId, reload]);
  useEffect(() => {
    if (tab !== 'devices' || !detail) { setDeviceRows([]); setDeviceTotal(0); setDeviceError(''); return; }
    let active = true;
    setDeviceLoading(true); setDeviceError(''); setDeviceRows([]);
    devices.list(context(), { tenantId: detail.tenantId, productId: detail.id, seed: 42, page: devicePage, pageSize: 10, sortBy: 'name', sortDirection: 'asc' }).then(response => {
      if (!active) return;
      if ('error' in response) { setDeviceRows([]); setDeviceTotal(0); setDeviceError(response.error.message); }
      else { setDeviceRows(response.data.items); setDeviceTotal(response.data.total); }
      setDeviceLoading(false);
    });
    return () => { active = false; };
  }, [tab, detail, context, devicePage, reload]);
  const showResult = (response: { error: { message: string; fieldErrors?: Record<string, string> } } | { data: Product }, onSuccess?: (product: Product) => void) => {
    if ('error' in response) { setMessage(response.error.message); setFieldErrors(response.error.fieldErrors ?? {}); return false; }
    setDetail(response.data); setBase(productInput(response.data)); setAccess(response.data.accessConfig); setMessage('已保存'); setFieldErrors({}); setReload(value => value + 1); onSuccess?.(response.data); return true;
  };
  const saveBase = async (confirmImpact = false) => {
    const response = await products.save(context(), base, detail?.id, detail?.version, confirmImpact);
    if ('error' in response && response.error.fieldErrors?.confirmImpact) { setImpact('base'); setMessage(response.error.message); return false; }
    return showResult(response, product => { setSelectedId(product.id); setImpact(null); });
  };
  const saveAccess = async () => detail ? showResult(await products.saveAccessConfig(context(), detail.id, access, detail.version)) : false;
  const parseModel = () => {
    const parsed = parseJsonObject<ThingModelItem>(jsonText);
    if (parsed.error) {
      setMessage(parsed.error.message); setFieldErrors({ modelJson: parsed.error.message });
      modelJsonInput.current?.focus(); modelJsonInput.current?.setSelectionRange(parsed.error.offset, parsed.error.offset);
      return null;
    }
    setModel(parsed.value); setFieldErrors({}); setMessage(''); return parsed.value;
  };
  const saveModel = async (confirmImpact = false) => {
    if (!detail) return false;
    const current = jsonMode ? parseModel() : model;
    if (!current) return false;
    const next = { ...current };
    const response = await products.saveModel(context(), detail.id, next, detail.version, confirmImpact);
    if ('error' in response && response.error.fieldErrors?.confirmImpact) { setImpact('model'); setMessage(response.error.message); return false; }
    return showResult(response, product => { const saved = product.model.find(item => item.id === next.id || (!next.id && item.identifier === next.identifier)) ?? next; setModel(saved); setModelOriginal(saved); setJsonText(JSON.stringify(saved, null, 2)); setImpact(null); });
  };
  const removeModel = async (confirmed = false) => {
    if (!detail) return false;
    const response = await products.removeModel(context(), detail.id, removeId, detail.version, confirmed);
    if ('error' in response && response.error.fieldErrors?.confirmImpact) { setImpact('remove'); setMessage(response.error.message); return false; }
    return showResult(response, () => { setImpact(null); setRemoveId(''); setModel(emptyItem()); setModelOriginal(emptyItem()); });
  };
  const parseEnumText = (): DpRule['enumMap'] | null => {
    try {
      const parsed: unknown = JSON.parse(enumText);
      if (!Array.isArray(parsed)) throw new Error('映射必须是数组');
      setFieldErrors(current => { const { enumMap, ...rest } = current; void enumMap; return rest; });
      return parsed as DpRule['enumMap'];
    } catch { setFieldErrors(current => ({ ...current, enumMap: '枚举映射须为有效 JSON 数组' })); setConversion(null); return null; }
  };
  const saveRule = async () => {
    if (!detail) return false;
    const enumMap = parseEnumText();
    if (!enumMap) return false;
    const next = { ...rule, enumMap, id: rule.id || `dp_${rule.itemId}` };
    const response = await products.saveDpRule(context(), detail.id, next, detail.version);
    return showResult(response, () => { setRule(next); setRuleOriginal(next); setEnumText(JSON.stringify(next.enumMap)); });
  };
  const saveCurrent = async () => tab === 'basic' ? saveBase() : tab === 'access' ? saveAccess() : tab === 'model' ? saveModel() : tab === 'dp' ? saveRule() : true;
  const open = (id: string | null) => { if (dirty) { setPending(id ?? 'close'); return; } setSelectedId(id); setDetail(null); setMessage(''); setFieldErrors({}); setTab('basic'); if (id === 'new') { setBase(emptyProduct(filters.tenantId)); setAccess(defaultAccessConfig('MQTT')); } };
  const discard = () => {
    const target = pending; setPending(null); setMessage(''); setFieldErrors({});
    if (target?.startsWith('tab:')) {
      setBase(detail ? productInput(detail) : emptyProduct(filters.tenantId));
      setAccess(detail?.accessConfig ?? defaultAccessConfig('MQTT'));
      setModel(modelOriginal); setJsonText(JSON.stringify(modelOriginal, null, 2)); setJsonMode(false); setRule(ruleOriginal); setEnumText(JSON.stringify(ruleOriginal.enumMap));
      const next = target.slice(4) as Tab;
      if (next === 'dp' && detail?.model.length) editRule(detail.model[0].id);
      else if (next === 'model') editModel();
      else setTab(next);
      return;
    }
    setSelectedId(target === 'close' ? null : target); setDetail(null); setTab('basic');
    if (target === 'new') { setBase(emptyProduct(filters.tenantId)); setTab('basic'); }
  };
  const editModel = (item?: ThingModelItem) => { const next = item ? structuredClone(item) : emptyItem(); setModel(next); setModelOriginal(next); setJsonText(JSON.stringify(next, null, 2)); setJsonMode(false); setConversion(null); setFieldErrors({}); setTab('model'); };
  const changeModelType = (next: DataType) => {
    if (next === model.dataType) return;
    const numeric = next === 'float' || next === 'int';
    const incompatible = numeric ? !!model.enumValues?.length : !!model.unit?.trim() || model.min !== undefined || model.max !== undefined;
    if (incompatible) setTypePending(next); else setModel({ ...model, dataType: next });
  };
  const confirmModelType = () => {
    if (!typePending) return;
    const { unit, min, max, enumValues, ...compatible } = model;
    const next = typePending;
    setModel(next === 'float' || next === 'int' ? { ...compatible, dataType: next, unit: unit ?? '', min: min ?? 0, max: max ?? 100 }
      : next === 'enum' ? { ...compatible, dataType: next, enumValues: enumValues ?? [] } : { ...compatible, dataType: next });
    setTypePending(null);
  };
  const editRule = (itemId: string) => { const next = detail?.dpRules.find(candidate => candidate.itemId === itemId) ?? emptyRule(itemId); setRule(structuredClone(next)); setRuleOriginal(structuredClone(next)); setEnumText(JSON.stringify(next.enumMap)); setConversion(null); setFieldErrors({}); setTab('dp'); };
  const chooseTab = (id: Tab) => { if (dirty) { setPending(`tab:${id}`); return; } if (id === 'dp' && detail?.model.length) editRule(detail.model[0].id); else if (id === 'model') editModel(); else { if (id === 'devices') setDevicePage(1); setTab(id); } };
  const testRule = async () => { if (!detail) return; const enumMap = parseEnumText(); if (!enumMap) return; const response = await products.testDpRule(context(), detail.id, { ...rule, enumMap }, raw); if ('error' in response) { setMessage(response.error.message); setFieldErrors(response.error.fieldErrors ?? {}); setConversion(null); } else { setConversion(response.data); setMessage(''); setFieldErrors({}); } };
  const changeRole = (value: Role) => { setRows([]); setTotal(0); setSelectedProducts([]); setSelectedId(null); setDetail(null); setPending(null); setImpact(null); setTypePending(null); setRole(value); const tenantId = value === 'platformAdmin' ? 'all' : 'ten_202609_001'; setDraftFilters(current => ({ ...current, tenantId, page: 1 })); setFilters(current => ({ ...current, tenantId, page: 1 })); };
  const apply = () => setFilters({ ...draftFilters, page: 1 });
  const refresh = () => { setMessage(''); setReload(value => value + 1); };
  return <ThemeProvider theme={theme}><div className="atlas-dashboard atlas-products"><aside className="atlas-sidebar" aria-label="主导航"><div className="atlas-brand">IoT <strong>Atlas</strong></div><nav><a href="/dashboard">◇ 数据大盘</a><a href="/geography">◇ 全球节点</a><a className="active" aria-current="page" href="/products">▣ 产品与物模型</a><a href="/devices">◇ 设备中心</a><a href="/rules">◇ 规则引擎</a><a href="/firmware">◇ 固件与 OTA</a><a href="/tenants">◇ 租户管理</a><a href="/labs">◇ 实验室</a><a href="/delivery">◇ 交付看板</a></nav><a className="diagnostic-link" href="/">诊断页</a></aside>
    <main className="atlas-workspace"><header className="atlas-header"><div><small>IoT Atlas / 产品与物模型</small><h1>产品与物模型</h1><p>配置产品能力、物模型与 DP 转换；仅模拟保存与校验。</p></div><div className="header-actions"><label>主题<select aria-label="主题" value={themeChoice} onChange={event => setThemeChoice(event.target.value)}><option value="dark">暗色</option><option value="light">亮色</option><option value="system">跟随系统</option></select></label><label>演示身份<select aria-label="演示身份" value={role} onChange={event => changeRole(event.target.value as Role)}><option value="platformAdmin">平台管理员</option><option value="tenantAdmin">租户管理员</option><option value="operator">运维工程师</option><option value="viewer">数据观察员</option></select></label></div></header>
      <Card className="product-filters" component="section" aria-label="产品筛选"><div className="product-filter-grid"><label>搜索<input aria-label="搜索产品" value={draftFilters.keyword} onChange={event => setDraftFilters({ ...draftFilters, keyword: event.target.value })} placeholder="名称或 Product Key" /></label><label>租户<select aria-label="租户" value={draftFilters.tenantId} onChange={event => setDraftFilters({ ...draftFilters, tenantId: event.target.value })} disabled={role !== 'platformAdmin'}>{Object.entries(tenantNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>类别<select aria-label="类别" value={draftFilters.category} onChange={event => setDraftFilters({ ...draftFilters, category: event.target.value })}><option value="">全部类别</option>{['工业传感器', '能源设备', '水务设备', '安防设备'].map(value => <option key={value}>{value}</option>)}</select></label><label>状态<select aria-label="状态" value={draftFilters.status} onChange={event => setDraftFilters({ ...draftFilters, status: event.target.value })}><option value="">全部状态</option>{Object.entries(statusNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><div className="product-filter-actions"><Button variant="contained" onClick={apply}>查询</Button><Button variant="outlined" onClick={() => { const next = initialList(); if (role !== 'platformAdmin') next.tenantId = 'ten_202609_001'; setDraftFilters(next); setFilters(next); }}>重置</Button></div></div><details className="scenario-control"><summary>演示状态</summary><label>Mock 场景<select aria-label="Mock 场景" value={scenario} onChange={event => { if (event.target.value === 'forbidden') { setRows([]); setTotal(0); setSelectedProducts([]); setSelectedId(null); setDetail(null); setPending(null); setImpact(null); setTypePending(null); } setScenario(event.target.value as Scenario); }}><option value="normal">正常</option><option value="slow">缓慢</option><option value="offline">服务离线</option><option value="forbidden">无权限</option></select></label></details></Card>
      <div className="dashboard-feedback" aria-live="polite">{listLoading && <span role="status">产品加载中…</span>}{message && <span role="alert">{message} <Button size="small" onClick={refresh}>刷新</Button></span>}</div>
      <Card className="product-list" component="section"><div className="product-list-head"><h2>产品列表 <small>共 {total} 条</small></h2><Button disabled={!visibleSelected.length} onClick={() => downloadProductCsv(visibleSelected)}>导出已选（{visibleSelected.length}）</Button>{canWrite && <Button variant="contained" onClick={() => open('new')}>新建产品</Button>}</div><div className="product-table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="选择当前页产品" checked={!!rows.length && visibleSelected.length === rows.length} onChange={event => setSelectedProducts(event.target.checked ? rows.map(product => product.id) : [])} /></th><th>产品名称</th><th>Product Key</th><th>类别</th><th>协议</th><th>设备数</th><th>状态</th><th>更新时间</th></tr></thead><tbody>{rows.map(product => <tr key={product.id}><td><input type="checkbox" aria-label={`选择产品 ${product.name}`} checked={selectedProducts.includes(product.id)} onChange={() => toggleProduct(product.id)} /></td><td><button onClick={() => open(product.id)}>{product.name}</button></td><td>{product.productKey}</td><td>{product.category}</td><td>{product.protocol}</td><td>{number(product.deviceCount)}</td><td>{statusNames[product.status]}</td><td>{new Date(product.updatedAt).toLocaleDateString('zh-CN')}</td></tr>)}</tbody></table>{!listLoading && rows.length === 0 && <p>当前筛选范围没有产品。</p>}</div><div className="product-pager"><label>每页<select aria-label="每页条数" value={filters.pageSize} onChange={event => { const pageSize = Number(event.target.value); setFilters(current => ({ ...current, page: 1, pageSize })); setDraftFilters(current => ({ ...current, page: 1, pageSize })); }}><option value={2}>2</option><option value={10}>10</option><option value={20}>20</option></select></label><Button onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))} disabled={filters.page <= 1}>上一页</Button><span>{filters.page} / {Math.max(1, Math.ceil(total / filters.pageSize))}</span><Button onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))} disabled={filters.page * filters.pageSize >= total}>下一页</Button></div></Card>
    </main>{selectedId && <aside className="product-drawer" role="dialog" aria-modal="false" aria-label="产品详情"><div className="drawer-head"><h2>{selectedId === 'new' ? '新建产品' : detail?.name ?? '产品加载中'}</h2><button aria-label="关闭详情" onClick={() => open(null)}>×</button></div>{selectedId === 'new' && <p role="status">{capacityNote}</p>}<div className="product-tabs" role="tablist" aria-label="产品详情页签">{([['basic', '基础信息'], ['access', '接入配置'], ['model', '物模型'], ['dp', 'DP 规则'], ['devices', '设备']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} disabled={selectedId !== 'new' && !detail} onClick={() => chooseTab(id)}>{label}</button>)}</div>{dirty && <p className="unsaved" role="status">● 未保存变更</p>}
      {tab === 'basic' && <div className="product-form" role="tabpanel"><label>租户<select aria-label="产品租户" value={base.tenantId} disabled={!!detail || !canWrite} onChange={event => setBase({ ...base, tenantId: event.target.value })}>{Object.entries(tenantNames).filter(([id]) => id !== 'all').map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>产品名称<input aria-label="产品名称" value={base.name} disabled={!canWrite} onChange={event => setBase({ ...base, name: event.target.value })} /></label><label>Product Key<input aria-label="Product Key" value={base.productKey} disabled={!canWrite} onChange={event => setBase({ ...base, productKey: event.target.value })} /></label><label>类别<select aria-label="产品类别" value={base.category} disabled={!canWrite} onChange={event => setBase({ ...base, category: event.target.value })}>{['工业传感器', '能源设备', '水务设备', '安防设备'].map(value => <option key={value}>{value}</option>)}</select></label><label>接入协议<select aria-label="接入协议" value={base.protocol} disabled={!canWrite} onChange={event => setBase({ ...base, protocol: event.target.value as ProductInput['protocol'] })}><option>MQTT</option><option>CoAP</option><option>HTTP</option></select></label><label>产品状态<select aria-label="产品状态" value={base.status} disabled={!canWrite} onChange={event => setBase({ ...base, status: event.target.value as ProductStatus })}>{Object.entries(statusNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>{canWrite && <Button variant="contained" onClick={() => void saveBase()}>保存产品</Button>}</div>}
      {tab === 'access' && <div className="product-form" role="tabpanel">{detail ? <><p>协议：{detail.protocol}。以下为本地 Mock 接入元数据，不包含真实凭据或服务地址。</p><label>{detail.protocol === 'MQTT' ? '上行 Topic' : '上行资源路径'}<input aria-label="上行路径" value={access.uplinkPath} disabled={!canWrite} onChange={event => setAccess({ ...access, uplinkPath: event.target.value })} /></label><label>{detail.protocol === 'MQTT' ? '下行 Topic' : '下行资源路径'}<input aria-label="下行路径" value={access.downlinkPath} disabled={!canWrite} onChange={event => setAccess({ ...access, downlinkPath: event.target.value })} /></label><label>报文格式<select aria-label="报文格式" value={access.payloadFormat} disabled={!canWrite} onChange={event => setAccess({ ...access, payloadFormat: event.target.value as AccessConfig['payloadFormat'] })}><option>JSON</option><option>Binary</option></select></label><label>心跳间隔（秒）<input aria-label="心跳间隔" type="number" min={10} max={3600} value={access.heartbeatSeconds} disabled={!canWrite} onChange={event => setAccess({ ...access, heartbeatSeconds: Number(event.target.value) })} /></label>{canWrite && <Button variant="contained" onClick={() => void saveAccess()}>保存接入配置</Button>}</> : <p>请先保存产品，再配置接入路径。</p>}</div>}
      {tab === 'model' && <div role="tabpanel"><div className="product-section-head"><h3>物模型</h3>{canWrite && !!detail && <Button onClick={() => editModel()}>添加模型项</Button>}</div><table><thead><tr><th>名称</th><th>标识</th><th>类型</th><th>操作</th></tr></thead><tbody>{detail?.model.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.identifier}</td><td>{kindNames[item.kind]} · {item.dataType}</td><td><button onClick={() => editModel(item)}>编辑</button>{canWrite && <button onClick={() => { setRemoveId(item.id); void removeModel(false); }}>删除</button>}</td></tr>)}</tbody></table>{detail?.model.length === 0 && <p>暂无物模型项。</p>}{detail && <div className="model-editor"><h3>模型项编辑</h3><div className="model-mode"><Button onClick={() => { if (jsonMode && !parseModel()) return; setJsonMode(false); }}>表单</Button><Button onClick={() => { setJsonText(JSON.stringify(model, null, 2)); setJsonMode(true); }}>JSON</Button></div>{jsonMode ? <label>JSON 草稿<textarea ref={modelJsonInput} aria-label="物模型 JSON" value={jsonText} disabled={!canWrite} onChange={event => setJsonText(event.target.value)} rows={12} /></label> : <div className="product-form"><label>类型<select aria-label="模型类型" value={model.kind} disabled={!canWrite} onChange={event => setModel({ ...model, kind: event.target.value as ThingModelItem['kind'] })}><option value="property">属性</option><option value="event">事件</option><option value="service">服务</option></select></label><label>标识符<input aria-label="模型标识符" value={model.identifier} disabled={!canWrite} onChange={event => setModel({ ...model, identifier: event.target.value })} /></label>{identifierIssue && <p className="product-inline-error" role="alert">{identifierIssue}</p>}<label>名称<input aria-label="模型名称" value={model.name} disabled={!canWrite} onChange={event => setModel({ ...model, name: event.target.value })} /></label><label>数据类型<select aria-label="数据类型" value={model.dataType} disabled={!canWrite} onChange={event => changeModelType(event.target.value as DataType)}><option value="float">float</option><option value="int">int</option><option value="enum">enum</option><option value="bool">bool</option><option value="string">string</option></select></label><label>读写权限<select aria-label="读写权限" value={model.accessMode} disabled={!canWrite} onChange={event => setModel({ ...model, accessMode: event.target.value as ThingModelItem['accessMode'] })}>{Object.entries(accessNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>单位<input aria-label="单位" value={model.unit ?? ''} disabled={!canWrite} onChange={event => setModel({ ...model, unit: event.target.value })} /></label><label>最小值<input aria-label="最小值" type="number" value={model.min ?? ''} disabled={!canWrite} onChange={event => setModel({ ...model, min: Number(event.target.value) })} /></label><label>最大值<input aria-label="最大值" type="number" value={model.max ?? ''} disabled={!canWrite} onChange={event => setModel({ ...model, max: Number(event.target.value) })} /></label><label>枚举值（逗号分隔）<input aria-label="枚举值" value={model.enumValues?.join(',') ?? ''} disabled={!canWrite} onChange={event => setModel({ ...model, enumValues: event.target.value.split(',').filter(Boolean) })} /></label></div>}<details><summary>JSON 预览</summary><pre>{jsonMode ? jsonText : JSON.stringify(model, null, 2)}</pre></details>{canWrite && <Button variant="contained" onClick={() => void saveModel()}>保存模型项</Button>}</div>}</div>}
      {tab === 'dp' && <div role="tabpanel"><h3>DP 转换规则</h3>{detail?.model.length ? <><label className="product-inline">目标物模型项<select aria-label="目标物模型项" value={rule.itemId || detail.model[0].id} onChange={event => editRule(event.target.value)}>{detail.model.map(item => <option value={item.id} key={item.id}>{item.name}（{item.identifier}）</option>)}</select></label><div className="product-form"><label>原始类型<select aria-label="原始类型" value={rule.rawType} disabled={!canWrite} onChange={event => setRule({ ...rule, rawType: event.target.value as DpRule['rawType'] })}><option>int16</option><option>float</option><option>string</option></select></label><label>倍率<input aria-label="倍率" type="number" value={rule.scale} disabled={!canWrite} onChange={event => setRule({ ...rule, scale: Number(event.target.value) })} /></label><label>偏移<input aria-label="偏移" type="number" value={rule.offset} disabled={!canWrite} onChange={event => setRule({ ...rule, offset: Number(event.target.value) })} /></label><label>精度<input aria-label="精度" type="number" value={rule.precision} disabled={!canWrite} onChange={event => setRule({ ...rule, precision: Number(event.target.value) })} /></label><label>表达式<input aria-label="表达式" value={rule.expression} disabled={!canWrite} onChange={event => setRule({ ...rule, expression: event.target.value })} /></label><label>阈值下限<input aria-label="阈值下限" type="number" value={rule.threshold?.min ?? ''} disabled={!canWrite} onChange={event => setRule({ ...rule, threshold: { min: Number(event.target.value), max: rule.threshold?.max ?? 100 } })} /></label><label>阈值上限<input aria-label="阈值上限" type="number" value={rule.threshold?.max ?? ''} disabled={!canWrite} onChange={event => setRule({ ...rule, threshold: { min: rule.threshold?.min ?? 0, max: Number(event.target.value) } })} /></label><label>枚举映射（JSON）<textarea aria-label="枚举映射" value={enumText} disabled={!canWrite} onChange={event => { setEnumText(event.target.value); setConversion(null); }} rows={3} /></label></div><div className="dp-run"><label>原始样例<input aria-label="原始样例" value={raw} onChange={event => setRaw(event.target.value)} /></label><Button onClick={() => void testRule()}>运行转换测试</Button>{canWrite && <Button variant="contained" onClick={() => void saveRule()}>保存 DP 规则</Button>}</div>{conversion && <div className="conversion" role="status"><h3>转换结果：{conversion.valid ? conversion.value : conversion.error}</h3><ol>{conversion.steps.map((step, index) => <li key={index}>{step.label}：{step.input} → {step.output}</li>)}</ol></div>}</> : <p>请先配置物模型项。</p>}</div>}
      {tab === 'devices' && <div role="tabpanel"><h3>关联设备</h3>{!detail ? <p>先保存产品以关联设备。</p> : <><p>共 {number(deviceTotal)} 台设备关联此产品。关键模型变更需确认影响。</p>{deviceLoading && <p role="status">关联设备加载中…</p>}{deviceError && <p role="alert">{deviceError} <button onClick={() => setReload(value => value + 1)}>重试</button></p>}{!deviceLoading && !deviceError && !deviceRows.length && <p>当前产品没有关联设备。</p>}<ul className="product-device-list">{deviceRows.map(device => <li key={device.id}><a href={`/devices?device=${encodeURIComponent(device.id)}`}>{device.name} · {device.id}</a><span>{deviceStatusNames[device.status]} · {device.region}</span></li>)}</ul>{deviceTotal > 10 && <div className="product-device-pager"><button disabled={devicePage <= 1} onClick={() => setDevicePage(page => page - 1)}>上一页</button><span>{devicePage} / {Math.ceil(deviceTotal / 10)}</span><button disabled={devicePage * 10 >= deviceTotal} onClick={() => setDevicePage(page => page + 1)}>下一页</button></div>}</>}</div>}
      {Object.keys(fieldErrors).length > 0 && <div className="product-errors" role="alert"><h3>校验摘要</h3><ul>{Object.entries(fieldErrors).map(([field, error]) => <li key={field}>{field}：{error}</li>)}</ul></div>}
    </aside>}
    {pending && <div className="product-modal-backdrop"><div className="product-modal" role="dialog" aria-modal="true" tabIndex={-1} aria-label="未保存变更"><h2>未保存变更</h2><p>当前编辑内容尚未保存。请选择后继续。</p><div><Button variant="contained" onClick={() => { void saveCurrent().then(success => { if (success) discard(); }); }}>保存并离开</Button><Button onClick={discard}>放弃更改</Button><Button onClick={() => setPending(null)}>取消</Button></div></div></div>}
    {impact && <div className="product-modal-backdrop"><div className="product-modal" role="dialog" aria-modal="true" tabIndex={-1} aria-label="影响确认"><h2>影响确认</h2><p>{message}</p><p>关联设备、规则与 OTA 可能受影响。</p><div><Button variant="contained" onClick={() => { void (impact === 'base' ? saveBase(true) : impact === 'model' ? saveModel(true) : removeModel(true)); }}>确认影响并保存</Button><Button onClick={() => { setImpact(null); setRemoveId(''); }}>取消</Button></div></div></div>}
    {typePending && <div className="product-modal-backdrop"><div className="product-modal" role="dialog" aria-modal="true" tabIndex={-1} aria-label="数据类型切换确认"><h2>切换数据类型</h2><p>不兼容的单位、数值范围或枚举值将被清除。</p><div><Button variant="contained" onClick={confirmModelType}>确认清除并切换</Button><Button onClick={() => setTypePending(null)}>取消</Button></div></div></div>}
  </div></ThemeProvider>;
}
