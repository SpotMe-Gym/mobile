Pod::Spec.new do |s|
  s.name           = 'SpotmeNowPlaying'
  s.version        = '1.0.0'
  s.summary        = 'Apple Music now playing and controls for SpotMe'
  s.description    = 'Reads the system music player (Apple Music) and controls play, pause and skip.'
  s.license        = 'UNLICENSED'
  s.author         = 'Damiano'
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'MediaPlayer'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
