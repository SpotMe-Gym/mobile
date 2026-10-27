import { Redirect } from 'expo-router';

/**
 * `spotme://auth/callback` is where Google / Apple (browser flow) return. The auth session sheet
 * normally catches it first; if the OS opens the app with it instead, just go home.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
