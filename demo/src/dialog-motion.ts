export function createDialogMotion(dialog: HTMLDialogElement, afterClose: () => void) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let closing: Animation | undefined;

  function finish() {
    closing?.cancel();
    closing = undefined;
    dialog.classList.remove('closing');
    if (dialog.open) dialog.close();
    afterClose();
  }

  function close(immediate = false) {
    if (!dialog.open) return;
    if (immediate || reducedMotion.matches) { finish(); return; }
    if (closing) return;
    const { opacity, transform } = getComputedStyle(dialog);
    dialog.classList.add('closing');
    closing = dialog.animate([
      { opacity, transform },
      { opacity: 0, transform: 'translateY(10px) scale(.98)' },
    ], { duration: 160, easing: 'ease-in', fill: 'forwards' });
    void closing.finished.then(finish, () => {});
  }

  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { if (!dialog.open) finish(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches && closing) finish(); });
  return { close };
}
