import * as Haptics from 'expo-haptics';

/*
 * The native calls return promises that reject when the module is missing (JS installed but
 * the binary was built before expo-haptics was linked). A try/catch around the call doesn't
 * catch that, so every helper .catch()es the promise.
 */

/** Minor actions: toggles, entering edit mode, reordering. */
export function lightImpact(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Completing a flow: saving a workout, logging a meal or weight. */
export function successFeedback(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
