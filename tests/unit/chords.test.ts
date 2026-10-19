import { describe, expect, it } from 'vitest';
import { ChordMatcher } from '../../packages/core/src/chords.js';
import type { MatchTarget } from '../../packages/core/src/chords.js';
import type { PhysicalButton } from '../../packages/core/src/types.js';

const single: MatchTarget = { id: 'single', buttons: ['south'] };
const chord: MatchTarget = { id: 'chord', buttons: ['south', 'left-shoulder'] };
const set = (...buttons: PhysicalButton[]) => new Set(buttons);

describe('chord arbitration', () => {
  it('fires an unambiguous button immediately, once per press', () => {
    const matcher = new ChordMatcher();
    expect(matcher.sample(set('south'), [single], 0, 80).fired).toEqual(['single']);
    expect(matcher.sample(set('south'), [single], 100, 80).fired).toEqual([]);
    matcher.sample(set(), [single], 120, 80);
    expect(matcher.sample(set('south'), [single], 140, 80).fired).toEqual(['single']);
  });
  it.each([['south', 'left-shoulder'], ['left-shoulder', 'south']] as const)('prefers the chord with %s pressed first', (first, second) => {
    const matcher = new ChordMatcher();
    expect(matcher.sample(set(first), [single, chord], 0, 80).fired).toEqual([]);
    expect(matcher.sample(set(first, second), [single, chord], 60, 80).fired).toEqual(['chord']);
    expect(matcher.sample(set('south'), [single, chord], 90, 80).fired).toEqual([]);
  });
  it('delays only intersecting actions and prevents a late second action', () => {
    const matcher = new ChordMatcher();
    matcher.sample(set('south'), [single, chord], 0, 80);
    expect(matcher.sample(set('south'), [single, chord], 79, 80).fired).toEqual([]);
    expect(matcher.sample(set('south'), [single, chord], 80, 80).fired).toEqual(['single']);
    expect(matcher.sample(set('south', 'left-shoulder'), [single, chord], 120, 80).fired).toEqual([]);
  });
  it('recognizes a quick tap when released during the arbitration window', () => {
    const matcher = new ChordMatcher();
    matcher.sample(set('south'), [single, chord], 0, 80);
    expect(matcher.sample(set(), [single, chord], 30, 80).fired).toEqual(['single']);
    expect(matcher.sample(set(), [single, chord], 100, 80).fired).toEqual([]);
  });
  it('repeats a chord by releasing its action button while holding its modifier', () => {
    const matcher = new ChordMatcher();
    expect(matcher.sample(set('south', 'left-shoulder'), [single, chord], 0, 80).fired).toEqual(['chord']);
    expect(matcher.sample(set('left-shoulder'), [single, chord], 50, 80).fired).toEqual([]);
    expect(matcher.sample(set('south', 'left-shoulder'), [single, chord], 100, 80).fired).toEqual(['chord']);
  });
  it('cancels pending actions when targets disappear or state resets', () => {
    const matcher = new ChordMatcher();
    matcher.sample(set('south'), [single, chord], 0, 80);
    expect(matcher.sample(set('south'), [], 100, 80).fired).toEqual([]);
    matcher.reset(set('south'));
    expect(matcher.sample(set('south'), [single], 200, 80).fired).toEqual([]);
  });
  it('blocks equal-length overlapping matches', () => {
    const matcher = new ChordMatcher();
    const other: MatchTarget = { id: 'other', buttons: ['south', 'right-shoulder'] };
    const result = matcher.sample(set('south', 'left-shoulder', 'right-shoulder'), [chord, other], 0, 80);
    expect(result.fired).toEqual([]);
    expect(result.ambiguous).toEqual([['chord', 'other']]);
  });
});
