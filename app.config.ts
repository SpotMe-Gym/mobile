import { withEntitlementsPlist, type ConfigPlugin } from 'expo/config-plugins';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Native "Sign in with Apple" needs the Sign In with Apple capability on the App ID, which a free
 * Personal Team can't have. Set EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN=false (e.g. in .env.local) to build
 * without it: the entitlement is left out and "Continue with Apple" uses the browser flow instead.
 * Run `bun run prebuild:clean` after changing it.
 */
const nativeAppleSignIn = process.env.EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN !== 'false';

// Expo applies expo-apple-authentication's plugin automatically once the package is installed,
// so dropping it from `plugins` isn't enough: remove the entitlement it adds.
const withoutAppleSignInEntitlement: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['com.apple.developer.applesignin'];
    return mod;
  });

export default ({ config }: ConfigContext): ExpoConfig => {
  const result: ExpoConfig = {
    ...config,
    name: config.name ?? 'SpotMe',
    slug: config.slug ?? 'spotme',
    ios: { ...config.ios, usesAppleSignIn: nativeAppleSignIn },
  };
  return nativeAppleSignIn ? result : withoutAppleSignInEntitlement(result);
};
