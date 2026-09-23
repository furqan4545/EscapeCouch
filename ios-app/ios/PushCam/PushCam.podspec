Pod::Spec.new do |s|
  s.name         = 'PushCam'
  s.version      = '0.1.0'
  s.summary      = 'Front camera, MediaPipe pose, sound effects and run recording for the push-up game'
  s.homepage     = 'https://github.com/'
  s.license      = { :type => 'UNLICENSED' }
  s.authors      = 'Furqan Ali'
  s.platforms    = { :ios => '16.0' }
  s.source       = { :path => '.' }
  s.source_files = '*.{swift,m}'
  s.resources    = 'Resources/*'
  s.swift_version = '5.9'
  s.dependency 'MediaPipeTasksVision', '1.0.0'
  install_modules_dependencies(s)
end
