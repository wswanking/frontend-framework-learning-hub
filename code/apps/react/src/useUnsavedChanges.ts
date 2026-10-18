import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
/** Router history and programmatic transitions share the same draft protection. */
export function useUnsavedChanges(dirty: boolean) {
  const permitted = useRef(false);
  const blocker = useBlocker(() => { if (permitted.current) { permitted.current = false; return false; } return dirty; });
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (window.confirm('当前编辑尚未保存，放弃修改并离开吗？')) blocker.proceed();
    else { blocker.reset(); trigger?.focus(); }
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty]);
  return () => { permitted.current = true; };
}
