import { Platform } from 'react-native';

/** Minimum touch target: 44 pt (Apple HIG) on iOS, 48 dp (Material) on Android. */
export const MIN_TOUCH = Platform.OS === 'android' ? 48 : 44;
/** Tailwind size classes matching MIN_TOUCH. */
export const TOUCH_SIZE_CLASS = Platform.OS === 'android' ? 'h-12 w-12' : 'h-11 w-11';
export const TOUCH_HEIGHT_CLASS = Platform.OS === 'android' ? 'min-h-12' : 'min-h-11';
