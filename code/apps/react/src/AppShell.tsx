import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './dashboard.css';
import './shell.css';
const items = [["dashboard", "数据大盘"], ["geography", "全球节点"], ["products", "产品与物模型"], ["devices", "设备中心"], ["rules", "规则引擎"], ["firmware", "固件与 OTA"], ["tenants", "租户管理"], ["labs", "实验室"], ["delivery", "交付看板"]];
export default function AppShell() {
  const location = useLocation();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const open = openedAt === location.key;
  // History can revisit an old location key; never restore its expanded menu.
  useEffect(() => { setOpenedAt(null); }, [location.key]);
  function close() { setOpenedAt(null); menu.current?.focus(); }
  return <div className="app-shell" data-testid="app-shell">
    <header className="shell-topbar">
      <button className="shell-menu" ref={menu} aria-controls="primary-navigation" aria-expanded={open} onClick={() => open ? close() : setOpenedAt(location.key)}>导航菜单</button>
      <strong>IoT Atlas</strong><span>React · 独立应用</span>
    </header>
    <aside id="primary-navigation" className={`atlas-sidebar${open ? ' is-open' : ''}`} aria-label="主导航" onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      <nav>{items.map(([path, name]) => <NavLink end key={path} to={'/' + path} className={({ isActive }) => isActive ? 'active' : ''} onClick={() => { if (open) menu.current?.focus(); }}>{name}</NavLink>)}</nav>
      <NavLink className="diagnostic-link" to="/">诊断页</NavLink>
    </aside>
    <div className="shell-content"><Outlet /></div>
  </div>;
}
