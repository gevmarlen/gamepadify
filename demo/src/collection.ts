export function createCollection(element: HTMLElement, changed: (count: number) => void) {
  let order = [...element.querySelectorAll<HTMLButtonElement>('[data-world]')];
  const animations = new Set<Animation>();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function animate(card: HTMLElement, frames: Keyframe[], duration: number) {
    const animation = card.animate(frames, { duration, easing: 'cubic-bezier(.2,.75,.25,1)' });
    animations.add(animation);
    const remove = () => animations.delete(animation);
    void animation.finished.then(remove, remove);
    return animation;
  }

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) for (const animation of animations) animation.cancel();
  });

  return {
    show(names?: readonly string[]) {
      for (const animation of animations) animation.cancel();
      for (const card of order) card.hidden = card.disabled = names ? !names.includes(card.dataset.world!) : false;
      changed(order.filter(card => !card.hidden).length);
    },
    shuffle() {
      const previous = order.filter(card => !card.hidden);
      if (previous.length < 2) return;
      const before = new Map(previous.map(card => [card, card.getBoundingClientRect()]));
      const focused = document.activeElement as HTMLElement | null;
      for (const animation of animations) animation.cancel();
      order = [...order];
      for (let index = order.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [order[index], order[other]] = [order[other]!, order[index]!];
      }
      if (order.filter(card => !card.hidden).every((card, index) => card === previous[index])) {
        const first = order.indexOf(previous[0]!), second = order.indexOf(previous[1]!);
        [order[first], order[second]] = [order[second]!, order[first]!];
      }
      element.append(...order);
      if (focused && previous.includes(focused as HTMLButtonElement)) focused.focus({ preventScroll: true });
      if (reducedMotion.matches) return;
      for (const card of previous) {
        const rect = before.get(card)!;
        const next = card.getBoundingClientRect();
        const x = rect.left - next.left, y = rect.top - next.top;
        if (x || y) animate(card, [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }], 340);
      }
    },
  };
}
