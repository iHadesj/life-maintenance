import { isIOS } from './platform';

/**
 * Haptic feedback where the platform allows it.
 *
 * - Android / Chromium: Vibration API.
 * - iOS Safari has no Vibration API, but iOS 18+ plays the system haptic when a
 *   native `<input type="checkbox" switch>` toggles — including through a
 *   programmatic label click inside a user gesture. Older iOS simply stays silent.
 */

export type HapticPattern = 'tick' | 'confirm' | 'success' | 'warn' | 'heavy';

const VIBRATION: Record<HapticPattern, number | number[]> = {
  tick: 8,
  confirm: 14,
  success: [12, 70, 24],
  warn: [24, 50, 24],
  heavy: 32,
};

const IOS_PULSES: Record<HapticPattern, number> = {
  tick: 1,
  confirm: 1,
  success: 2,
  warn: 2,
  heavy: 1,
};

let enabled = true;
let switchLabel: HTMLLabelElement | null = null;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function iosPulse(): void {
  if (!switchLabel) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText =
      'position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    switchLabel = label;
  }
  switchLabel.click();
}

export function haptic(pattern: HapticPattern = 'tick'): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function' && !isIOS()) {
      navigator.vibrate(VIBRATION[pattern]);
      return;
    }
    if (isIOS()) {
      iosPulse();
      for (let i = 1; i < IOS_PULSES[pattern]; i++) window.setTimeout(iosPulse, 90 * i);
    }
  } catch {
    // Haptics are a garnish; never let them break an action.
  }
}
