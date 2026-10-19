import type { Direction } from './types.js';

export function nearest(current: HTMLElement, candidates: readonly HTMLElement[], direction: Direction): HTMLElement | null {
  const rect = current.getBoundingClientRect();
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'right' || direction === 'down' ? 1 : -1;
  const originMain = horizontal ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2;
  const ranked = candidates.filter(element => element !== current).map((element, order) => {
    const next = element.getBoundingClientRect();
    const main = horizontal ? (next.left + next.right) / 2 : (next.top + next.bottom) / 2;
    const lane = horizontal ? next.bottom > rect.top && next.top < rect.bottom : next.right > rect.left && next.left < rect.right;
    const dx = Math.max(0, next.left - rect.right, rect.left - next.right);
    const dy = Math.max(0, next.top - rect.bottom, rect.top - next.bottom);
    return { element, order, ahead: (main - originMain) * sign > 0, lane: lane ? 0 : 1, distance: dx * dx + dy * dy };
  }).filter(item => item.ahead);
  ranked.sort((a, b) => a.lane - b.lane || a.distance - b.distance || a.order - b.order);
  return ranked[0]?.element ?? null;
}
