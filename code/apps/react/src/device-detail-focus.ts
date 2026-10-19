/** Each app owns this DOM adapter; framework lifecycle owns its cleanup. */
export function enterDeviceDetail(close: () => void): () => void {
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const media = matchMedia('(max-width: 64rem)');
  const overflow = document.documentElement.style.overflow;
  const drawer = () => document.querySelector<HTMLElement>('.device-drawer');
  const update = () => { document.documentElement.style.overflow = media.matches ? 'hidden' : overflow; drawer()?.setAttribute('aria-modal', String(media.matches)); };
  const frame = requestAnimationFrame(() => { update(); drawer()?.focus(); });
  media.addEventListener('change', update);
  const keydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    const panel = drawer();
    if (!panel || document.querySelector('.product-modal-backdrop')) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab' || !media.matches) return;
    const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary')).filter(item => item.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus(); }
  };
  window.addEventListener('keydown', keydown);
  return () => {
    cancelAnimationFrame(frame); media.removeEventListener('change', update); window.removeEventListener('keydown', keydown); document.documentElement.style.overflow = overflow;
    requestAnimationFrame(() => { if (!drawer()) document.documentElement.style.overflow = overflow; if (trigger?.isConnected && trigger !== document.body) trigger.focus(); else document.querySelector<HTMLElement>('.device-list h2')?.focus(); });
  };
}
