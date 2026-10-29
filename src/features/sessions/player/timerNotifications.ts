import * as Notifications from 'expo-notifications';

/**
 * When the phone is locked or the app is in the background, a local notification tells you
 * the timer is up (the app can't beep from the background). Nothing is sent anywhere.
 */
let scheduledId: string | null = null;
let handlerSet = false;

export async function ensureTimerNotifications(): Promise<boolean> {
  if (!handlerSet) {
    handlerSet = true;
    // In the app the player beeps itself: no banner on top of it.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return asked.granted;
  } catch {
    return false;
  }
}

export async function scheduleTimerEnd(at: number, title: string, body: string) {
  await cancelTimerEnd();
  const seconds = Math.round((at - Date.now()) / 1000);
  if (seconds < 1) return;
  try {
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  } catch {
    scheduledId = null;
  }
}

export async function cancelTimerEnd() {
  if (!scheduledId) return;
  const id = scheduledId;
  scheduledId = null;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already delivered
  }
}
