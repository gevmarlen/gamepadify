import type { PhysicalButton } from './types.js';

export interface MatchTarget { id: string; buttons: readonly PhysicalButton[] }
const subset = (a: readonly PhysicalButton[], b: readonly PhysicalButton[]) => a.every(button => b.includes(button));
const overlaps = (a: readonly PhysicalButton[], b: readonly PhysicalButton[]) => a.some(button => b.includes(button));

export class ChordMatcher {
  private previous = new Set<PhysicalButton>();
  private pending = new Map<string, number>();
  private latched = new Set<string>();
  private consumed: MatchTarget[] = [];

  reset(pressed: ReadonlySet<PhysicalButton> = new Set()): void {
    this.previous = new Set(pressed);
    this.pending.clear();
    this.latched.clear();
    this.consumed = [];
  }

  sample(pressed: ReadonlySet<PhysicalButton>, targets: readonly MatchTarget[], now: number, window: number): { fired: string[]; ambiguous: string[][] } {
    if (!pressed.size && !this.previous.size && !this.pending.size) return { fired: [], ambiguous: [] };
    const rising = new Set([...pressed].filter(button => !this.previous.has(button)));
    const active = (target: MatchTarget) => target.buttons.every(button => pressed.has(button));
    const consume = (target: MatchTarget) => {
      if (active(target)) this.latched.add(target.id);
      if (target.buttons.some(button => pressed.has(button))) this.consumed.push(target);
    };
    this.consumed = this.consumed.filter(target => target.buttons.some(button => pressed.has(button)));
    const ids = new Set(targets.map(target => target.id));
    for (const id of this.pending.keys()) if (!ids.has(id)) this.pending.delete(id);
    for (const id of this.latched) if (!targets.some(target => target.id === id && active(target))) this.latched.delete(id);

    const blocked = (target: MatchTarget) => this.consumed.some(used => used.id !== target.id && overlaps(used.buttons, target.buttons) && (active(used) || subset(target.buttons, used.buttons)));
    const ready: MatchTarget[] = [];
    for (const target of targets) {
      if (blocked(target) || this.latched.has(target.id)) { this.pending.delete(target.id); continue; }
      const pendingAt = this.pending.get(target.id);
      const began = active(target) && target.buttons.some(button => rising.has(button));
      if (!began && pendingAt === undefined) continue;
      const hasSuperset = targets.some(other => other.buttons.length > target.buttons.length && subset(target.buttons, other.buttons) && !blocked(other));
      if (hasSuperset && active(target) && now - (pendingAt ?? now) < window) {
        this.pending.set(target.id, pendingAt ?? now);
      } else ready.push(target);
    }

    ready.sort((a, b) => b.buttons.length - a.buttons.length);
    const fired: string[] = [];
    const ambiguous: string[][] = [];
    const rejected = new Set<string>();
    for (const target of ready) {
      if (rejected.has(target.id) || blocked(target)) continue;
      const ties = ready.filter(other => other.buttons.length === target.buttons.length && overlaps(other.buttons, target.buttons) && !rejected.has(other.id) && !blocked(other));
      if (ties.length > 1) {
        const group = ties.map(item => item.id);
        ambiguous.push(group);
        for (const item of ties) { rejected.add(item.id); this.pending.delete(item.id); consume(item); }
        continue;
      }
      fired.push(target.id);
      consume(target);
      for (const candidate of targets) {
        if (overlaps(target.buttons, candidate.buttons)) {
          this.pending.delete(candidate.id);
          if (candidate.id !== target.id) rejected.add(candidate.id);
        }
      }
    }
    this.previous = new Set(pressed);
    return { fired, ambiguous };
  }
}
