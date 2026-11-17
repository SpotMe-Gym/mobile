import AVFoundation
import ExpoModulesCore
import UIKit
import Vision

/// Motion Lab's eyes: reads a recorded video frame by frame and follows the points the user
/// marked (handle, weight stack, pivot) with Vision's object tracker, plus the body's joints.
/// All on the device; the video never leaves it.
///
/// Coordinates in and out are 0–1 of the frame with the origin at the top-left (Vision's own
/// origin is bottom-left, converted here).
public class SpotmeMotionModule: Module {
  private static let queue = DispatchQueue(label: "spotme.motion.analysis", qos: .userInitiated)

  private static let joints: [(String, VNHumanBodyPoseObservation.JointName)] = [
    ("nose", .nose), ("neck", .neck),
    ("lShoulder", .leftShoulder), ("rShoulder", .rightShoulder),
    ("lElbow", .leftElbow), ("rElbow", .rightElbow),
    ("lWrist", .leftWrist), ("rWrist", .rightWrist),
    ("lHip", .leftHip), ("rHip", .rightHip),
    ("lKnee", .leftKnee), ("rKnee", .rightKnee),
    ("lAnkle", .leftAnkle), ("rAnkle", .rightAnkle),
  ]

  private struct Options: Decodable {
    /// Marked points, [x, y] each.
    var points: [[Double]]
    /// Side of the tracked square around each point, as a share of the frame's short side.
    var box: Double?
    /// Frames analysed per second of video.
    var fps: Double?
    var pose: Bool?
    var start: Double?
    var end: Double?
  }

  public func definition() -> ModuleDefinition {
    Name("SpotmeMotion")

    Events("onProgress")

    // One frame of the video saved as a JPEG in the app's own storage (to mark points on, and
    // to keep as the picture behind the results).
    AsyncFunction("frame") { (uri: String, at: Double, name: String, promise: Promise) in
      SpotmeMotionModule.queue.async {
        do {
          let video = SpotmeMotionModule.asset(uri)
          let picture = try SpotmeMotionModule.image(SpotmeMotionModule.generator(video, maxSide: 1600), at: at)
          guard let data = UIImage(cgImage: picture).jpegData(compressionQuality: 0.8) else {
            promise.reject("ERR_MOTION_FRAME", "Couldn't save the frame.")
            return
          }
          let file = try SpotmeMotionModule.storeDirectory().appendingPathComponent("\(name).jpg")
          try data.write(to: file, options: .atomic)
          let duration = CMTimeGetSeconds(video.duration)
          let info: [String: Any] = [
            "uri": file.absoluteString,
            "width": picture.width,
            "height": picture.height,
            "duration": duration.isFinite ? duration : 0,
          ]
          promise.resolve(info)
        } catch {
          promise.reject("ERR_MOTION_FRAME", error.localizedDescription)
        }
      }
    }

    // Follows the points (and the body) through the video. Resolves with JSON:
    // { width, height, duration, frames: [{ t, p: [[x, y, confidence] | null], j?: { joint: [x, y, confidence] } }] }
    AsyncFunction("analyze") { (uri: String, optionsJson: String, promise: Promise) in
      SpotmeMotionModule.queue.async { [weak self] in
        do {
          let options = try JSONDecoder().decode(Options.self, from: Data(optionsJson.utf8))
          let json = try SpotmeMotionModule.analyze(uri: uri, options: options) { fraction in
            self?.sendEvent("onProgress", ["fraction": fraction])
          }
          promise.resolve(json)
        } catch {
          promise.reject("ERR_MOTION_ANALYZE", error.localizedDescription)
        }
      }
    }

    AsyncFunction("remove") { (uri: String) in
      guard let url = URL(string: uri), url.isFileURL else { return }
      try? FileManager.default.removeItem(at: url)
    }
  }

  // MARK: - Video

  private static func asset(_ uri: String) -> AVURLAsset {
    let url = URL(string: uri).flatMap { $0.scheme == nil ? nil : $0 } ?? URL(fileURLWithPath: uri)
    return AVURLAsset(url: url)
  }

  private static func generator(_ asset: AVAsset, maxSide: CGFloat) -> AVAssetImageGenerator {
    let generator = AVAssetImageGenerator(asset: asset)
    // Upright frames whatever way the phone was held.
    generator.appliesPreferredTrackTransform = true
    generator.maximumSize = CGSize(width: maxSide, height: maxSide)
    let tolerance = CMTime(value: 1, timescale: 60)
    generator.requestedTimeToleranceBefore = tolerance
    generator.requestedTimeToleranceAfter = tolerance
    return generator
  }

  private static func image(_ generator: AVAssetImageGenerator, at seconds: Double) throws -> CGImage {
    try generator.copyCGImage(at: CMTime(seconds: max(0, seconds), preferredTimescale: 600), actualTime: nil)
  }

  private static func storeDirectory() throws -> URL {
    let base = try FileManager.default.url(
      for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let dir = base.appendingPathComponent("motion", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  // MARK: - Tracking

  private static func round4(_ value: Double) -> Double { (value * 10_000).rounded() / 10_000 }

  private static func analyze(uri: String, options: Options, progress: (Double) -> Void) throws -> String {
    let video = SpotmeMotionModule.asset(uri)
    let duration = CMTimeGetSeconds(video.duration)
    guard duration.isFinite, duration > 0 else {
      throw NSError(
        domain: "SpotmeMotion", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "The video is empty or can't be read."])
    }
    let start = min(max(0, options.start ?? 0), duration)
    let end = min(max(start, options.end ?? duration), duration)
    let fps = min(30, max(5, options.fps ?? 15))
    let count = max(1, Int(((end - start) * fps).rounded(.down)))
    let boxShare = min(0.3, max(0.02, options.box ?? 0.06))
    let wantPose = options.pose ?? false

    let reader = SpotmeMotionModule.generator(video, maxSide: 960)
    let sequence = VNSequenceRequestHandler()
    var trackers: [VNTrackObjectRequest?] = []
    var frames: [[String: Any]] = []
    var width = 0
    var height = 0

    for index in 0..<count {
      let time = start + Double(index) / fps
      autoreleasepool {
        guard let image = try? SpotmeMotionModule.image(reader, at: time) else { return }
        if width == 0 {
          width = image.width
          height = image.height
          let short = Double(min(width, height))
          let w = boxShare * short / Double(width)
          let h = boxShare * short / Double(height)
          trackers = options.points.map { point -> VNTrackObjectRequest? in
            guard point.count >= 2 else { return nil }
            let x = min(max(0, point[0] - w / 2), 1 - w)
            let y = min(max(0, (1 - point[1]) - h / 2), 1 - h)
            let observation = VNDetectedObjectObservation(
              boundingBox: CGRect(x: x, y: y, width: w, height: h))
            let request = VNTrackObjectRequest(detectedObjectObservation: observation)
            request.trackingLevel = .accurate
            return request
          }
        }

        // Each point on its own, so one lost tracker doesn't take the others with it.
        var samples: [Any] = []
        var first: CGPoint?
        for (index, tracker) in trackers.enumerated() {
          guard let tracker = tracker, (try? sequence.perform([tracker], on: image)) != nil,
            let result = tracker.results?.first as? VNDetectedObjectObservation
          else {
            samples.append(NSNull())
            continue
          }
          tracker.inputObservation = result
          let box = result.boundingBox
          // The person is picked near the handle: only while its tracker is sure of it (the
          // JS side's MIN_CONFIDENCE), so a lost handle doesn't point at someone else.
          if index == 0, result.confidence >= 0.3 { first = CGPoint(x: box.midX, y: box.midY) }
          samples.append([
            round4(Double(box.midX)), round4(1 - Double(box.midY)), round4(Double(result.confidence)),
          ])
        }

        var frame: [String: Any] = ["t": round4(time - start), "p": samples]
        if wantPose, let body = SpotmeMotionModule.pose(in: image, near: first) { frame["j"] = body }
        frames.append(frame)
      }
      if index % 5 == 0 || index == count - 1 { progress(Double(index + 1) / Double(count)) }
    }

    let result: [String: Any] = [
      "width": width, "height": height, "duration": round4(end - start), "frames": frames,
    ]
    let data = try JSONSerialization.data(withJSONObject: result)
    return String(data: data, encoding: .utf8) ?? "{}"
  }

  /// The joints of the person in the picture. In a busy gym there can be several people: the
  /// one whose hands are nearest the handle (the first marked point) is the one training.
  private static func pose(in image: CGImage, near handle: CGPoint?) -> [String: Any]? {
    let request = VNDetectHumanBodyPoseRequest()
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    guard (try? handler.perform([request])) != nil, let people = request.results, !people.isEmpty else {
      return nil
    }

    func distance(_ person: VNHumanBodyPoseObservation) -> CGFloat {
      guard let handle = handle else { return CGFloat(1 - person.confidence) }
      var best = CGFloat.greatestFiniteMagnitude
      for joint in [VNHumanBodyPoseObservation.JointName.leftWrist, .rightWrist, .leftAnkle, .rightAnkle] {
        guard let point = try? person.recognizedPoint(joint), point.confidence > 0.1 else { continue }
        best = min(best, hypot(point.location.x - handle.x, point.location.y - handle.y))
      }
      return best
    }
    guard let person = people.min(by: { distance($0) < distance($1) }) else { return nil }

    var out: [String: Any] = [:]
    for (name, joint) in SpotmeMotionModule.joints {
      guard let point = try? person.recognizedPoint(joint), point.confidence > 0.05 else { continue }
      out[name] = [
        round4(Double(point.location.x)), round4(1 - Double(point.location.y)),
        round4(Double(point.confidence)),
      ]
    }
    return out.isEmpty ? nil : out
  }
}
