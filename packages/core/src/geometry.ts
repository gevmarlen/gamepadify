import type { Direction } from './types.js';

export function nearest(current: HTMLElement, candidates: readonly HTMLElement[], direction: Direction, measure = (element: HTMLElement) => element.getBoundingClientRect()): HTMLElement | null {
  const rect = measure(current);
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'right' || direction === 'down' ? 1 : -1;
  const originMain = horizontal ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2;
  let best: HTMLElement | null = null, bestLane = false, bestDistance = Infinity;
  for (const element of candidates) {
    if (element === current) continue;
    const next = measure(element);
    const main = horizontal ? (next.left + next.right) / 2 : (next.top + next.bottom) / 2;
    if ((main - originMain) * sign <= 0) continue;
    const lane = horizontal ? next.bottom > rect.top && next.top < rect.bottom : next.right > rect.left && next.left < rect.right;
    const dx = Math.max(0, next.left - rect.right, rect.left - next.right);
    const dy = Math.max(0, next.top - rect.bottom, rect.top - next.bottom);
    const distance = dx * dx + dy * dy;
    if (!best || lane && !bestLane || lane === bestLane && distance < bestDistance) {
      best = element; bestLane = lane; bestDistance = distance;
    }
  }
  return best;
}
