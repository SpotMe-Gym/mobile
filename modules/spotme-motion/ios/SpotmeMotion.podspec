Pod::Spec.new do |s|
  s.name           = 'SpotmeMotion'
  s.version        = '1.0.0'
  s.summary        = 'Video point and body tracking for Motion Lab'
  s.description    = 'Follows marked points (handle, weight stack, pivot) and body joints through a recorded video with Apple Vision.'
  s.license        = 'UNLICENSED'
  s.author         = 'Damiano'
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'AVFoundation', 'Vision', 'UIKit'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
