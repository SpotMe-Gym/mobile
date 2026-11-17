import ExpoModulesCore
import HealthKit
import WatchConnectivity

/// iPhone side of the SpotMe watch app.
///
/// Start: `startWorkout` → HKHealthStore.startWatchApp launches the watch app with a strength
/// workout; the watch starts the HKWorkoutSession and mirrors it here (iOS 17+), and the
/// mirroring handler below picks it up. From then on both sides talk with
/// `sendToRemoteWorkoutSession`: heart rate and button presses from the watch, player state
/// from the phone.
public final class SpotmeWatchModule: Module {
  private let store = HKHealthStore()
  // HKWorkoutSession exists on iPhone only from iOS 17, and the app still supports 16.4: the
  // session and its delegate are kept untyped here and used behind #available checks.
  private var mirroredSession: AnyObject?
  private var sessionDelegate: AnyObject?
  private lazy var connectivity = Connectivity()

  @available(iOS 17.0, *)
  private var mirrored: HKWorkoutSession? { mirroredSession as? HKWorkoutSession }

  public func definition() -> ModuleDefinition {
    Name("SpotmeWatch")

    Events("onHeartRate", "onCommand", "onWatchState")

    OnCreate {
      // Registered as early as possible: when the watch starts a workout, HealthKit gives the
      // iPhone app only a few seconds to accept the mirrored session.
      if #available(iOS 17.0, *) {
        self.store.workoutSessionMirroringStartHandler = { [weak self] session in
          DispatchQueue.main.async { self?.attach(session) }
        }
      }
      self.connectivity.activate()
    }

    AsyncFunction("status") { (promise: Promise) in
      // isPaired and isWatchAppInstalled read false until WCSession has activated, which can
      // still be under way when the app opens straight into a workout.
      self.connectivity.whenActivated {
        let wc = self.connectivity
        promise.resolve([
          "healthAvailable": HKHealthStore.isHealthDataAvailable(),
          "isPaired": wc.isPaired,
          "isWatchAppInstalled": wc.isWatchAppInstalled,
          "connected": self.mirroredSession != nil,
        ])
      }
    }.runOnQueue(.main)

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve(false)
        return
      }
      let share: Set<HKSampleType> = [HKObjectType.workoutType()]
      let read: Set<HKObjectType> = [HKQuantityType(.heartRate)]
      self.store.requestAuthorization(toShare: share, read: read) { ok, _ in
        promise.resolve(ok)
      }
    }

    AsyncFunction("startWorkout") { (promise: Promise) in
      let configuration = HKWorkoutConfiguration()
      configuration.activityType = .traditionalStrengthTraining
      configuration.locationType = .indoor
      self.store.startWatchApp(with: configuration) { ok, error in
        if let error {
          promise.reject("E_WATCH_START", error.localizedDescription)
        } else {
          promise.resolve(ok)
        }
      }
    }

    AsyncFunction("send") { (json: String) in
      guard #available(iOS 17.0, *), let session = self.mirrored else { return }
      session.sendToRemoteWorkoutSession(data: Data(json.utf8)) { _, _ in }
    }.runOnQueue(.main)

    AsyncFunction("endWorkout") { () in
      guard #available(iOS 17.0, *), let session = self.mirrored else { return }
      // Ask the watch to end and save the workout (it owns the primary session).
      let end = try? JSONSerialization.data(withJSONObject: ["type": "end"])
      if let end {
        session.sendToRemoteWorkoutSession(data: end) { _, _ in }
      }
    }.runOnQueue(.main)
  }

  @available(iOS 17.0, *)
  private func attach(_ session: HKWorkoutSession) {
    let delegate = MirroredSessionDelegate(module: self)
    sessionDelegate = delegate
    mirroredSession = session
    session.delegate = delegate
    sendEvent("onWatchState", ["connected": true])
  }

  fileprivate func detach() {
    mirroredSession = nil
    sessionDelegate = nil
    sendEvent("onWatchState", ["connected": false])
  }

  fileprivate func receive(_ data: [Data]) {
    for item in data {
      guard let object = try? JSONSerialization.jsonObject(with: item) as? [String: Any],
            let type = object["type"] as? String else { continue }
      switch type {
      case "hr":
        if let bpm = object["bpm"] as? Double {
          let at = object["at"] as? Double ?? Date().timeIntervalSince1970 * 1000
          sendEvent("onHeartRate", ["bpm": bpm, "at": at])
        }
      case "cmd":
        if let command = object["cmd"] as? String {
          sendEvent("onCommand", ["command": command])
        }
      default:
        break
      }
    }
  }
}

/// HKWorkoutSessionDelegate needs an NSObject; it forwards to the module.
@available(iOS 17.0, *)
private final class MirroredSessionDelegate: NSObject, HKWorkoutSessionDelegate {
  private weak var module: SpotmeWatchModule?

  init(module: SpotmeWatchModule) {
    self.module = module
  }

  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    guard toState == .ended || toState == .stopped else { return }
    DispatchQueue.main.async { self.module?.detach() }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    DispatchQueue.main.async { self.module?.detach() }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didReceiveDataFromRemoteWorkoutSession data: [Data]) {
    DispatchQueue.main.async { self.module?.receive(data) }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didDisconnectFromRemoteDeviceWithError error: Error?) {
    DispatchQueue.main.async { self.module?.detach() }
  }
}

/// WatchConnectivity only to know whether a watch is paired and the SpotMe watch app installed.
private final class Connectivity: NSObject, WCSessionDelegate {
  /// Waiting for activation (main queue only).
  private var waiting: [() -> Void] = []

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  /// Runs `body` on the main queue once WCSession has activated, or after 2 s if it hasn't.
  func whenActivated(_ body: @escaping () -> Void) {
    guard WCSession.isSupported(), WCSession.default.activationState != .activated else {
      body()
      return
    }
    waiting.append(body)
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in self?.flush() }
  }

  private func flush() {
    let pending = waiting
    waiting = []
    pending.forEach { $0() }
  }

  var isPaired: Bool { WCSession.isSupported() && WCSession.default.isPaired }
  var isWatchAppInstalled: Bool { WCSession.isSupported() && WCSession.default.isWatchAppInstalled }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    DispatchQueue.main.async { self.flush() }
  }
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.activate()
  }
}
