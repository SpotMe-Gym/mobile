/**
 * SpotMe's Live Activity: the workout in progress on the Lock Screen and in the Dynamic
 * Island (exercise, set, timer, what's next, heart rate). Started, updated and ended by the
 * player through modules/spotme-live-activity.
 *
 * Generated into the Xcode project by @bacons/apple-targets on `expo prebuild`.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'widget',
  name: 'SpotMeLive',
  displayName: 'SpotMe',
  bundleIdentifier: '.live',
  deploymentTarget: '16.4',
  colors: { $accent: '#3B82F6' },
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  // No shared storage with the app: the state arrives through ActivityKit.
  entitlements: {},
});
