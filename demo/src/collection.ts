export function createCollection(element: HTMLElement, changed: (count: number) => void) {
  let order = [...element.querySelectorAll<HTMLButtonElement>('[data-world]')];
  const animations = new Set<Animation>();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function animate(card: HTMLElement, frames: Keyframe[], delay: number) {
    const animation = card.animate(frames, { duration: 460, delay, fill: 'backwards', easing: 'cubic-bezier(.22,.7,.2,1)' });
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
      const before = new Map(previous.map(card => [card, { rect: card.getBoundingClientRect(), opacity: getComputedStyle(card).opacity }]));
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
      for (const [index, card] of previous.entries()) {
        const { rect, opacity } = before.get(card)!;
        const next = card.getBoundingClientRect();
        const x = rect.left + rect.width / 2 - next.left - next.width / 2;
        const y = rect.top + rect.height / 2 - next.top - next.height / 2;
        animate(card, [
          { transform: `translate(${x}px, ${y}px) scale(${rect.width / next.width}, ${rect.height / next.height})`, opacity },
          { transform: `translate(${x * .45}px, ${y * .45}px) scale(.96)`, opacity: .8, offset: .45 },
          { transform: 'none', opacity: 1 },
        ], index * 18);
      }
    },
  };
}
