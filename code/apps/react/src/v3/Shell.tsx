import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUnsavedChanges } from "../useUnsavedChanges";
import { execute, load, seed, storageKey, roleNames } from "./domain";
import type { Command, Role } from "./types";
import { WorkspaceContext, type ModalSpec } from "./context";
import { navigation, Button, pageNames } from "./ui";
import { Icon } from "./Icon";
import { WorkspaceDialog } from "./WorkspaceDialog";
import "./workspace.css";
export default function V3Shell() {
  const [store, setStore] = useState(load),
    [modal, setModal] = useState<{ spec: ModalSpec; key: number } | null>(null),
    [dirty, setDirty] = useState(false),
    [scenario, setScenario] = useState("normal"),
    [notice, setNotice] = useState(""),
    [open, setOpen] = useState(false),
    [mobile, setMobile] = useState(
      () => matchMedia("(max-width:1050px)").matches,
    ),
    [contentVersion, setContentVersion] = useState(0);
  const latest = useRef(store);
  latest.current = store;
  const location = useLocation(),
    navigate = useNavigate(),
    allow = useUnsavedChanges(dirty),
    menu = useRef<HTMLButtonElement>(null),
    sidebar = useRef<HTMLElement>(null),
    main = useRef<HTMLElement>(null),
    trigger = useRef<HTMLElement | null>(null),
    sequence = useRef(0);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {
      setNotice("浏览器未允许保存，修改仅在本次打开保留。");
    }
  }, [store]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    setModal(null);
    setDirty(false);
    setScenario("normal");
    setOpen(false);
    main.current?.focus();
    window.scrollTo(0, 0);
    document.title = `${pageNames[location.pathname.split("/")[2]] ?? "页面不存在"} · IoT Atlas React`;
  }, [location.key, location.pathname]);
  useEffect(() => {
    const query = matchMedia("(max-width:1050px)");
    const change = () => {
      setMobile(query.matches);
      setOpen(false);
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (open)
      sidebar.current?.querySelector<HTMLButtonElement>(".nav-close")?.focus();
  }, [open]);
  const discard = () =>
    !dirty || window.confirm("有未保存的修改。放弃修改并离开？");
  function close(saved = false) {
    if (!saved && !discard()) return;
    setModal(null);
    setDirty(false);
    queueMicrotask(() =>
      trigger.current?.isConnected
        ? trigger.current.focus()
        : main.current?.focus(),
    );
  }
  function show(spec: ModalSpec) {
    if (!modal && dirty) {
      if (!discard()) return;
      setContentVersion((v) => v + 1);
    }
    if (!modal)
      trigger.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    setModal({ spec, key: ++sequence.current });
    setDirty(false);
  }
  function apply(command: Command) {
    const next = execute(
      latest.current,
      command,
      new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    );
    latest.current = next;
    setStore(next);
    setNotice(`${next.audit[0].action}已完成（本地模拟）。`);
    return next;
  }
  function setRole(role: Role) {
    if (!discard()) return;
    setModal(null);
    setDirty(false);
    setContentVersion((v) => v + 1);
    setStore((s) => ({ ...s, role }));
    setNotice("当前模拟身份：" + roleNames[role]);
  }
  function go(path: string) {
    allow();
    setModal(null);
    setDirty(false);
    navigate(path);
  }
  function reset() {
    setStore(seed());
    setModal(null);
    setDirty(false);
    setScenario("normal");
    setContentVersion((v) => v + 1);
    allow();
    navigate("/v3/workspace");
    setNotice("演示数据已重置（本地模拟）。");
  }
  const closeMenu = () => {
    setOpen(false);
    menu.current?.focus();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) closeMenu();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !modal) {
        e.preventDefault();
        document
          .querySelector<HTMLButtonElement>(".v3 .global-search")
          ?.click();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, modal]);
  return (
    <WorkspaceContext.Provider
      value={{
        store,
        apply,
        show,
        close,
        notify: setNotice,
        dirty,
        setDirty,
        scenario,
        setScenario,
        go,
        setRole,
        reset,
      }}
    >
      <div className="v3" data-testid="v3-shell">
        <a
          className="skip"
          href="#v3-main"
          onClick={(e) => {
            e.preventDefault();
            main.current?.focus();
          }}
        >
          跳到主要内容
        </a>
        <aside
          ref={sidebar}
          className={"sidebar" + (open ? " open" : "")}
          aria-label="工作区侧栏"
          inert={mobile && !open}
          onKeyDown={(e) => {
            if (e.key === "Tab" && open) {
              const nodes =
                sidebar.current?.querySelectorAll<HTMLElement>("button,a");
              if (!nodes?.length) return;
              const first = nodes[0],
                last = nodes[nodes.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
        >
          <div className="brand">
            <span className="brand-mark">◈</span>
            <div>
              IoT Atlas<small>CONNECTED OPERATIONS</small>
            </div>
          </div>
          <button
            type="button"
            className="mobile-close nav-close"
            aria-label="关闭导航"
            onClick={closeMenu}
          >
            ×
          </button>
          <nav className="nav" id="v3-navigation" aria-label="主导航">
            {navigation.map(([group, items]) => (
              <div key={group}>
                <div className="nav-label">{group}</div>
                {items.map(([path, label]) => (
                  <NavLink
                    key={path}
                    aria-label={label}
                    to={"/v3/" + path}
                    onClick={() => {
                      if (open) closeMenu();
                    }}
                  >
                    <span className="glyph">
                      <Icon name={path} />
                    </span>
                    {label}
                    {path === "alarms" && (
                      <span className="nav-count">
                        {
                          store.alarms.filter((a) => a.status !== "已解决")
                            .length
                        }
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="side-foot">
            <b>◇ React · V3 工作区</b>本地模拟环境 · 无真实设备
            <br />
            三端独立实现 · 交互已批准
          </div>
        </aside>
        {open && mobile && (
          <div className="scrim" onClick={closeMenu} aria-hidden="true" />
        )}
        <header className="topbar">
          <button
            className="icon mobile-menu"
            ref={menu}
            aria-label="打开导航"
            aria-controls="v3-navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
          <div className="tenant">
            澄海智联<small>DEMO WORKSPACE / 华东</small>
          </div>
          <button
            className="global-search"
            aria-label="全局搜索"
            onClick={() => show({ kind: "search" })}
          >
            ⌕ <span>搜索设备、规则、页面</span>
            <kbd className="key">⌘ K</kbd>
          </button>
          <div className="top-end">
            <button
              className="icon"
              aria-label="通知中心"
              onClick={() => show({ kind: "notifications" })}
            >
              <Icon name="bell" />
            </button>
            <span className="avatar" aria-hidden="true">
              CH
            </span>
            <label className="sr-only" htmlFor="v3-identity">
              模拟身份
            </label>
            <select
              id="v3-identity"
              className="identity"
              value={store.role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {Object.entries(roleNames).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </header>
        <main className="main" id="v3-main" tabIndex={-1} ref={main}>
          <div className="review">
            <b>WORKSPACE / V3</b>
            <span>React 独立实现 · 数据与操作均为本地模拟</span>
            <label className="state-control">
              页面状态{" "}
              <select
                aria-label="页面状态"
                value={scenario}
                onChange={(e) => {
                  if (discard()) {
                    setModal(null);
                    setDirty(false);
                    setContentVersion((v) => v + 1);
                    setScenario(e.target.value);
                  }
                }}
              >
                {[
                  ["normal", "正常"],
                  ["loading", "加载"],
                  ["empty", "空数据"],
                  ["error", "请求失败"],
                  ["forbidden", "无权限"],
                ].map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button kind="small" onClick={() => show({ kind: "reset" })}>
              重置演示
            </Button>
          </div>
          <Outlet key={contentVersion} />
          <footer className="page-footer">
            <span>IoT Atlas / 澄海智联 · React 独立实现</span>
            <span>本地模拟 · 不代表生产集成或最终验收</span>
          </footer>
        </main>
        {modal && <WorkspaceDialog key={modal.key} spec={modal.spec} />}
        <div className="toast" role="status" aria-live="polite">
          {notice}
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
