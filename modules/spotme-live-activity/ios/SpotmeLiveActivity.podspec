Pod::Spec.new do |s|
  s.name           = 'SpotmeLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Workout Live Activity for SpotMe'
  s.description    = 'Starts, updates and ends the workout Live Activity shown on the Lock Screen and in the Dynamic Island.'
  s.license        = 'UNLICENSED'
  s.author         = 'Damiano'
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'ActivityKit'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
