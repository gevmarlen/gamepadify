import { buttons } from './buttons.js';
import type { DeviceProfile, Family, PhysicalButton } from './types.js';

export function detectFamily(id: string): Family {
  if (/playstation|dualsense|dualshock|sony|054c/i.test(id)) return 'playstation';
  if (/nintendo|joy-con|switch|057e/i.test(id)) return 'switch';
  if (/xbox|xinput|x-box|045e/i.test(id)) return 'xbox';
  return 'generic';
}

export function resolveProfile(gamepad: Gamepad, profiles: readonly DeviceProfile[] = []): DeviceProfile | null {
  const custom = profiles.find(profile => {
    if (typeof profile.match === 'function') return profile.match(gamepad);
    profile.match.lastIndex = 0;
    return profile.match.test(gamepad.id);
  });
  if (custom) return custom;
  if (gamepad.mapping !== 'standard') return null;
  return { name: 'standard', family: detectFamily(gamepad.id), match: () => true, buttons: Object.fromEntries(buttons.map((button, index) => [button, index])), axes: [0, 1] };
}

export function readButtons(gamepad: Gamepad, profile: DeviceProfile): Set<PhysicalButton> {
  return new Set(buttons.filter(button => {
    const index = profile.buttons[button];
    if (index === undefined) return false;
    const state = gamepad.buttons[index];
    return !!state && (state.pressed || state.value >= 0.5);
  }));
}
