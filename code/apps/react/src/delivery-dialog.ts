export function mountDeliveryDialog(close: () => void) {
  const dialog = document.querySelector<HTMLElement>('.delivery-modal');
  if (!dialog) return () => {};
  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  const focusFrame = requestAnimationFrame(() => dialog.querySelector<HTMLElement>('[aria-label="交付标题"]')?.focus());
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0);
    if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKeydown);
  return () => { cancelAnimationFrame(focusFrame); document.removeEventListener('keydown', onKeydown); document.documentElement.style.overflow = previousOverflow; };
}
