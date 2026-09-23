import AVFoundation
import MediaPipeTasksVision
import Photos
import PhotosUI
import ReplayKit
import UIKit

/// Front camera + MediaPipe Pose Landmarker (the same model file as the video pipeline, pose/models/),
/// one-shot sound effects at 70% (SFX_LEVEL), ReplayKit screen recording of a run, the player profile
/// (UserDefaults) and the avatar photo picker.
/// Every failure is reported through onError; nothing is retried or hidden.
@objc public final class PushCamEngine: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, PoseLandmarkerLiveStreamDelegate, PHPickerViewControllerDelegate {
  @objc public static let shared = PushCamEngine()
  @objc public let session = AVCaptureSession()
  /// Per detection: t (s), w and h of the camera image (px, portrait, mirrored like the preview), lm = 33 x [x, y, z, visibility, presence] flattened, empty when no body.
  @objc public var onPose: (([String: Any]) -> Void)?
  @objc public var onError: ((String) -> Void)?

  private static let sfxLevel: Float = 0.7
  private let queue = DispatchQueue(label: "pushcam.video")
  private var landmarker: PoseLandmarker?
  private var configured = false
  private var lastTs = 0
  private var imageW = 0
  private var imageH = 0
  private var players: [String: AVAudioPlayer] = [:]
  /// The last run's screen recording (an .mp4 in tmp), set when recording stops.
  private var recording: URL?
  private var photoDone: ((String?, String?) -> Void)?
  private static let profileKey = "profile"

  @objc public func start() {
    DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = true }
    AVCaptureDevice.requestAccess(for: .video) { granted in
      guard granted else {
        self.onError?("Camera access is off. Turn it on in Settings > MobApp > Camera.")
        return
      }
      self.queue.async {
        do {
          if !self.configured {
            try self.configure()
            self.configured = true
          }
          if !self.session.isRunning { self.session.startRunning() }
        } catch {
          self.onError?("Camera setup failed: \(error.localizedDescription)")
        }
      }
    }
  }

  private func configure() throws {
    guard let path = Bundle.main.path(forResource: "pose_landmarker_full", ofType: "task") else {
      throw NSError(domain: "PushCam", code: 1, userInfo: [NSLocalizedDescriptionKey: "pose_landmarker_full.task is missing from the app"])
    }
    let options = PoseLandmarkerOptions()
    options.baseOptions.modelAssetPath = path
    options.runningMode = .liveStream
    options.numPoses = 1
    options.poseLandmarkerLiveStreamDelegate = self
    landmarker = try PoseLandmarker(options: options)

    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
      throw NSError(domain: "PushCam", code: 2, userInfo: [NSLocalizedDescriptionKey: "No front camera"])
    }
    session.beginConfiguration()
    session.sessionPreset = .hd1280x720
    let input = try AVCaptureDeviceInput(device: device)
    guard session.canAddInput(input) else {
      throw NSError(domain: "PushCam", code: 3, userInfo: [NSLocalizedDescriptionKey: "Cannot use the front camera"])
    }
    session.addInput(input)
    let output = AVCaptureVideoDataOutput()
    output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
    output.alwaysDiscardsLateVideoFrames = true
    output.setSampleBufferDelegate(self, queue: queue)
    guard session.canAddOutput(output) else {
      throw NSError(domain: "PushCam", code: 4, userInfo: [NSLocalizedDescriptionKey: "Cannot read camera frames"])
    }
    session.addOutput(output)
    if let c = output.connection(with: .video) {
      if c.isVideoOrientationSupported { c.videoOrientation = .portrait }
      if c.isVideoMirroringSupported { c.isVideoMirrored = true }
    }
    session.commitConfiguration()

    try device.lockForConfiguration()
    device.activeVideoMinFrameDuration = CMTime(value: 1, timescale: 30)
    device.activeVideoMaxFrameDuration = CMTime(value: 1, timescale: 30)
    device.unlockForConfiguration()

    let audio = AVAudioSession.sharedInstance()
    try audio.setCategory(.playback, options: [.mixWithOthers])
    try audio.setActive(true)
  }

  public func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard let landmarker, let pixels = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    imageW = CVPixelBufferGetWidth(pixels)
    imageH = CVPixelBufferGetHeight(pixels)
    let ts = Int(CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer)) * 1000)
    guard ts > lastTs else { return }
    lastTs = ts
    do {
      let image = try MPImage(sampleBuffer: sampleBuffer, orientation: .up)
      try landmarker.detectAsync(image: image, timestampInMilliseconds: ts)
    } catch {
      onError?("Pose model failed: \(error.localizedDescription)")
    }
  }

  public func poseLandmarker(_ poseLandmarker: PoseLandmarker, didFinishDetection result: PoseLandmarkerResult?, timestampInMilliseconds: Int, error: Error?) {
    if let error {
      onError?("Pose model failed: \(error.localizedDescription)")
      return
    }
    var flat: [Double] = []
    if let pose = result?.landmarks.first {
      flat.reserveCapacity(pose.count * 5)
      for p in pose {
        flat.append(Double(p.x))
        flat.append(Double(p.y))
        flat.append(Double(p.z))
        flat.append(p.visibility?.doubleValue ?? 0)
        flat.append(p.presence?.doubleValue ?? 0)
      }
    }
    onPose?(["t": Double(timestampInMilliseconds) / 1000, "w": imageW, "h": imageH, "lm": flat])
  }

  /// One-shot sound effect from the app bundle at 70%.
  @objc public func play(_ name: String) {
    DispatchQueue.main.async {
      if self.players[name] == nil {
        guard let url = Bundle.main.url(forResource: name, withExtension: nil) else {
          self.onError?("Sound \(name) is missing from the app")
          return
        }
        do {
          let player = try AVAudioPlayer(contentsOf: url)
          player.volume = PushCamEngine.sfxLevel
          player.numberOfLoops = 0
          player.prepareToPlay()
          self.players[name] = player
        } catch {
          self.onError?("Sound \(name) failed: \(error.localizedDescription)")
          return
        }
      }
      let player = self.players[name]!
      player.currentTime = 0
      player.play()
    }
  }

  @objc public func startRecording(_ done: @escaping (String?) -> Void) {
    DispatchQueue.main.async {
      self.recording = nil
      // A new run replaces the last one's video: delete old recordings (30-90 MB each) from tmp.
      let tmp = FileManager.default.temporaryDirectory
      for old in (try? FileManager.default.contentsOfDirectory(atPath: tmp.path)) ?? [] where old.hasPrefix("run-") {
        try? FileManager.default.removeItem(at: tmp.appendingPathComponent(old))
      }
      let recorder = RPScreenRecorder.shared()
      recorder.isMicrophoneEnabled = false
      recorder.startRecording { error in done(error?.localizedDescription) }
    }
  }

  /// Stops the recording and writes it to an .mp4. `trimSec` cuts that much off the end: the seconds
  /// recorded after the player really gave up, so the video hard-cuts at the give-up (owner rule).
  @objc public func stopRecording(_ trimSec: Double, done: @escaping (String?) -> Void) {
    DispatchQueue.main.async {
      let raw = FileManager.default.temporaryDirectory.appendingPathComponent("run-raw-\(Int(Date().timeIntervalSince1970)).mp4")
      RPScreenRecorder.shared().stopRecording(withOutput: raw) { error in
        if let error {
          DispatchQueue.main.async {
            self.recording = nil
            done("Recording failed: \(error.localizedDescription)")
          }
          return
        }
        self.waitForFile(raw) { written in
          guard written else {
            DispatchQueue.main.async {
              self.recording = nil
              done("Recording failed: iOS wrote no video file (screen recording does not work in the Simulator)")
            }
            return
          }
          guard trimSec > 0.05 else {
            DispatchQueue.main.async {
              self.recording = raw
              done(nil)
            }
            return
          }
          self.trimTail(of: raw, seconds: trimSec) { url, error in
            DispatchQueue.main.async {
              self.recording = url
              done(error)
            }
          }
        }
      }
    }
  }

  /// ReplayKit may finish writing the movie just after its completion handler: wait up to 3 s for a non-empty file.
  private func waitForFile(_ url: URL, tries: Int = 12, done: @escaping (Bool) -> Void) {
    let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
    if size > 0 { return done(true) }
    if tries == 0 { return done(false) }
    DispatchQueue.global().asyncAfter(deadline: .now() + 0.25) { self.waitForFile(url, tries: tries - 1, done: done) }
  }

  private func trimTail(of source: URL, seconds: Double, done: @escaping (URL?, String?) -> Void) {
    let asset = AVURLAsset(url: source)
    let end = CMTimeSubtract(asset.duration, CMTime(seconds: seconds, preferredTimescale: 600))
    guard end.seconds > 0 else {
      done(nil, "The recording is shorter than the part to cut")
      return
    }
    guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else {
      done(nil, "Could not trim the video: no export session")
      return
    }
    let out = FileManager.default.temporaryDirectory.appendingPathComponent("run-\(Int(Date().timeIntervalSince1970)).mp4")
    export.outputURL = out
    export.outputFileType = .mp4
    export.timeRange = CMTimeRange(start: .zero, end: end)
    export.exportAsynchronously {
      if export.status == .completed {
        done(out, nil)
      } else {
        done(nil, "Could not trim the video: \(export.error?.localizedDescription ?? "unknown error")")
      }
    }
  }

  /// Saves the last run's video to Photos (asks for add-only Photos access the first time).
  @objc public func saveRecording(_ done: @escaping (String?) -> Void) {
    guard let url = recording else {
      done("No recording of this run")
      return
    }
    PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
      guard status == .authorized || status == .limited else {
        DispatchQueue.main.async { done("Photos access is off. Turn it on in Settings > MobApp > Photos.") }
        return
      }
      PHPhotoLibrary.shared().performChanges({
        PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
      }) { ok, error in
        DispatchQueue.main.async { done(ok ? nil : "Could not save the video: \(error?.localizedDescription ?? "unknown error")") }
      }
    }
  }

  /// The iOS share sheet for the last run's video (TikTok, Instagram, Messages, Save Video...).
  @objc public func shareRecording(from host: UIViewController, done: @escaping (String?) -> Void) {
    DispatchQueue.main.async {
      guard let url = self.recording else {
        done("No recording of this run")
        return
      }
      let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
      host.present(sheet, animated: true) { done(nil) }
    }
  }
}

extension PushCamEngine {
  /// Saved profile JSON (nil before onboarding) and the Documents folder, where the avatar photo lives.
  @objc public func loadProfile() -> [String: Any] {
    let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].path
    return ["profile": UserDefaults.standard.string(forKey: PushCamEngine.profileKey) as Any, "docs": docs]
  }

  @objc public func saveProfile(_ json: String) {
    UserDefaults.standard.set(json, forKey: PushCamEngine.profileKey)
  }

  /// Photo library picker (no permission needed). Crops the photo to a 512 px square in Documents and
  /// returns its file name; (nil, nil) when the player cancels.
  @objc public func pickPhoto(from host: UIViewController, done: @escaping (String?, String?) -> Void) {
    DispatchQueue.main.async {
      var config = PHPickerConfiguration()
      config.filter = .images
      config.selectionLimit = 1
      let picker = PHPickerViewController(configuration: config)
      picker.delegate = self
      self.photoDone = done
      host.present(picker, animated: true)
    }
  }

  public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)
    guard let done = photoDone else { return }
    photoDone = nil
    guard let provider = results.first?.itemProvider else {
      done(nil, nil)
      return
    }
    guard provider.canLoadObject(ofClass: UIImage.self) else {
      done(nil, "That file is not a photo")
      return
    }
    provider.loadObject(ofClass: UIImage.self) { object, error in
      guard let image = object as? UIImage else {
        done(nil, "Could not read that photo: \(error?.localizedDescription ?? "unknown error")")
        return
      }
      let side = min(image.size.width, image.size.height)
      let out: CGFloat = 512
      let jpeg = UIGraphicsImageRenderer(size: CGSize(width: out, height: out)).jpegData(withCompressionQuality: 0.85) { _ in
        let scale = out / side
        let w = image.size.width * scale, h = image.size.height * scale
        image.draw(in: CGRect(x: (out - w) / 2, y: (out - h) / 2, width: w, height: h))
      }
      let fm = FileManager.default
      let docs = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
      do {
        for old in try fm.contentsOfDirectory(atPath: docs.path) where old.hasPrefix("avatar-") {
          try fm.removeItem(at: docs.appendingPathComponent(old))
        }
        let name = "avatar-\(Int(Date().timeIntervalSince1970)).jpg"
        try jpeg.write(to: docs.appendingPathComponent(name))
        done(name, nil)
      } catch {
        done(nil, "Could not save the photo: \(error.localizedDescription)")
      }
    }
  }
}


/// Full-screen front camera preview, mirrored, filling the screen like the game world.
@objc public final class PushCamPreview: UIView {
  override public class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }

  override public init(frame: CGRect) {
    super.init(frame: frame)
    let preview = layer as! AVCaptureVideoPreviewLayer
    preview.session = PushCamEngine.shared.session
    preview.videoGravity = .resizeAspectFill
    backgroundColor = .black
  }

  required init?(coder: NSCoder) {
    fatalError("PushCamPreview is created in code")
  }
}
