export function createCollection(element: HTMLElement, changed: (count: number) => void) {
  let order = [...element.querySelectorAll<HTMLButtonElement>('[data-world]')];
  let query = '';
  let revision = 0;
  const animations = new Set<Animation>();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const matches = (card: HTMLElement) => card.textContent!.toLocaleLowerCase().includes(query);

  function animate(card: HTMLElement, frames: Keyframe[], duration: number) {
    const animation = card.animate(frames, { duration, easing: 'cubic-bezier(.2,.75,.25,1)' });
    animations.add(animation);
    const remove = () => animations.delete(animation);
    void animation.finished.then(remove, remove);
    return animation;
  }

  async function render() {
    const current = ++revision;
    const before = new Map(order.filter(card => !card.hidden).map(card => [card, card.getBoundingClientRect()]));
    for (const animation of animations) animation.cancel();
    const visible = new Set(order.filter(matches));
    const leaving = order.filter(card => !card.hidden && !visible.has(card));
    for (const card of order) card.disabled = !visible.has(card);
    if (!reducedMotion.matches) {
      await Promise.allSettled(leaving.map(card => animate(card, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.94)' }], 120).finished));
    }
    if (current !== revision) return;
    const focused = document.activeElement as HTMLElement | null;
    for (const card of order) card.hidden = !visible.has(card);
    element.append(...order);
    if (focused && visible.has(focused as HTMLButtonElement)) focused.focus({ preventScroll: true });
    changed(visible.size);
    if (reducedMotion.matches) return;
    for (const card of visible) {
      const previous = before.get(card);
      const next = card.getBoundingClientRect();
      if (previous) {
        const x = previous.left - next.left, y = previous.top - next.top;
        if (x || y) animate(card, [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }], 340);
      } else {
        animate(card, [{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'none' }], 240);
      }
    }
  }

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) for (const animation of animations) animation.cancel();
  });

  return {
    filter(value: string) {
      query = value.trim().toLocaleLowerCase();
      return render();
    },
    shuffle() {
      const previous = order.filter(matches);
      if (previous.length < 2) return Promise.resolve();
      order = [...order];
      for (let index = order.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [order[index], order[other]] = [order[other]!, order[index]!];
      }
      if (order.filter(matches).every((card, index) => card === previous[index])) {
        const first = order.indexOf(previous[0]!), second = order.indexOf(previous[1]!);
        [order[first], order[second]] = [order[second]!, order[first]!];
      }
      return render();
    },
  };
}
