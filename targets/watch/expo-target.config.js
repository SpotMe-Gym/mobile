/**
 * SpotMe for Apple Watch: started from the iPhone player, runs an Apple Health workout
 * session (live heart rate, Activity rings, saved to Health) mirrored to the iPhone, and shows
 * the current exercise, timer and set with Set done / pause on the wrist.
 *
 * Generated into the Xcode project by @bacons/apple-targets on `expo prebuild`.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'watch',
  name: 'SpotMeWatch',
  displayName: 'SpotMe',
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '10.0',
  icon: '../../assets/SpotMeIcon/appstore.png',
  colors: { $accent: '#3B82F6' },
  frameworks: ['SwiftUI', 'HealthKit', 'WatchKit'],
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.developer.healthkit.access': [],
  },
});
