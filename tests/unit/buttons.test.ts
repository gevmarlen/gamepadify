import { describe, expect, it } from 'vitest';
import { normalizeTrigger, normalizeButton } from '../../packages/core/src/buttons.js';
import { detectFamily, readButtons, resolveProfile } from '../../packages/core/src/devices.js';
import { createGamepadSimulator } from '../../packages/core/src/testing.js';

describe('button vocabulary', () => {
  it('normalizes physical positions across controller families', () => {
    expect(['xbox:a', 'ps:cross', 'switch:b'].map(normalizeButton)).toEqual(['south', 'south', 'south']);
    expect(normalizeButton('switch:a')).toBe('east');
    expect(normalizeButton('A')).toBeNull();
    expect(normalizeButton('X')).toBeNull();
  });
  it('canonicalizes chords and rejects duplicate or unknown buttons', () => {
    expect(normalizeTrigger('xbox:lb + ps:cross')).toEqual(['south', 'left-shoulder']);
    expect(normalizeTrigger(['south', 'xbox:a'])).toBeNull();
    expect(normalizeTrigger('south+')).toBeNull();
    expect(normalizeTrigger({})).toBeNull();
  });
  it('detects family without pretending generic ids identify hardware', () => {
    expect(detectFamily('Wireless Controller (Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(detectFamily('Nintendo Switch Pro')).toBe('switch');
    expect(detectFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(detectFamily('USB Joystick')).toBe('generic');
  });
  it('uses browser standard mapping and explicit nonstandard profiles', () => {
    const source = createGamepadSimulator();
    source.press('xbox:rt');
    const pad = source.getGamepads()[0]!;
    expect([...readButtons(pad, resolveProfile(pad)!)]).toEqual(['right-trigger']);
    const raw = { ...pad, mapping: '' } as Gamepad;
    expect(resolveProfile(raw)).toBeNull();
    const profile = { name: 'custom', family: 'xbox' as const, match: /Xbox/g, buttons: { south: 7 } };
    expect(resolveProfile(raw, [profile])).toBe(profile);
    expect(resolveProfile(raw, [profile])).toBe(profile);
    expect([...readButtons(raw, profile)]).toEqual(['south']);
  });
});
