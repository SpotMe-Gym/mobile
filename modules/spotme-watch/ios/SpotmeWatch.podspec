Pod::Spec.new do |s|
  s.name           = 'SpotmeWatch'
  s.version        = '1.0.0'
  s.summary        = 'Bridge to the SpotMe Apple Watch app'
  s.description    = 'Starts the watch app, receives the mirrored HealthKit workout and relays player state.'
  s.license        = 'UNLICENSED'
  s.author         = 'Damiano'
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'HealthKit', 'WatchConnectivity'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
