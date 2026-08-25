import * as Haptics from 'expo-haptics';

/**
 * Light impact. No-ops when the native module is missing (JS package installed
 * but the iOS/Android binary was built before expo-haptics was linked).
 * The native call returns a rejected promise — a try/catch around the call
 * does not catch that, so we must .catch the promise.
 */
export function lightImpact(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
