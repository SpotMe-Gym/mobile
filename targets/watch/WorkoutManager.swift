import Foundation
import HealthKit
import WatchKit

/// The Apple Health workout on the watch. Started by the iPhone (startWatchApp), mirrored back
/// to it: heart rate goes to the phone as it's measured, the player's state comes from it.
@MainActor
final class WorkoutManager: NSObject, ObservableObject {
  static let shared = WorkoutManager()

  let store = HKHealthStore()
  @Published private(set) var running = false
  @Published private(set) var heartRate: Int?
  @Published private(set) var state: PhoneState?

  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var ticker: Timer?
  private var lastCue: String?

  func requestAuthorization() async {
    let share: Set<HKSampleType> = [HKObjectType.workoutType()]
    let read: Set<HKObjectType> = [HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned)]
    try? await store.requestAuthorization(toShare: share, read: read)
  }

  /// Called when the iPhone asks to start (via the app delegate).
  func start(with configuration: HKWorkoutConfiguration) {
    guard session == nil else { return }
    Task {
      await requestAuthorization()
      do {
        let session = try HKWorkoutSession(healthStore: store, configuration: configuration)
        let builder = session.associatedWorkoutBuilder()
        builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: configuration)
        session.delegate = self
        builder.delegate = self
        self.session = session
        self.builder = builder
        try await session.startMirroringToCompanionDevice()
        let start = Date()
        session.startActivity(with: start)
        try await builder.beginCollection(at: start)
        running = true
        startTicker()
      } catch {
        reset()
      }
    }
  }

  /// Ends the workout and saves it to Apple Health.
  func end() {
    session?.end()
  }

  /// Done / pause / resume / skip: the iPhone player does it and sends the new state back.
  func command(_ name: String) {
    WKInterfaceDevice.current().play(.click)
    send(["type": "cmd", "cmd": name])
  }

  private func send(_ object: [String: Any]) {
    guard let session, let data = try? JSONSerialization.data(withJSONObject: object) else { return }
    Task { try? await session.sendToRemoteWorkoutSession(data: data) }
  }

  private func reset() {
    ticker?.invalidate()
    ticker = nil
    session = nil
    builder = nil
    running = false
    state = nil
    heartRate = nil
    lastCue = nil
  }

  /// Wrist taps: 3-2-1 before a timer ends and a stronger one when it does. Runs with the
  /// screen off too (the workout session keeps the app alive).
  private func startTicker() {
    ticker?.invalidate()
    ticker = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
      Task { @MainActor in self?.tick() }
    }
  }

  private func tick() {
    guard let state, !state.paused, let end = state.endsAtDate else { return }
    let left = end.timeIntervalSinceNow
    let key: String?
    if left <= 0 { key = "end" } else if left <= 3 { key = "\(Int(ceil(left)))" } else { key = nil }
    guard let key, "\(state.startedAt)-\(key)" != lastCue else { return }
    lastCue = "\(state.startedAt)-\(key)"
    WKInterfaceDevice.current().play(key == "end" ? .notification : .click)
  }

  fileprivate func apply(_ message: Message) {
    switch message {
    case .state(let next):
      if next.startedAt != state?.startedAt { lastCue = nil }
      state = next
    case .end:
      end()
    }
  }

  fileprivate func publish(heartRate bpm: Double) {
    let value = Int(bpm.rounded())
    heartRate = value
    send(["type": "hr", "bpm": value, "at": Date().timeIntervalSince1970 * 1000])
  }

  fileprivate func finish(at date: Date) {
    guard let builder else { reset(); return }
    Task {
      try? await builder.endCollection(at: date)
      _ = try? await builder.finishWorkout()
      reset()
    }
  }
}

extension WorkoutManager: HKWorkoutSessionDelegate {
  nonisolated func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    guard toState == .ended else { return }
    Task { @MainActor in self.finish(at: date) }
  }

  nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    Task { @MainActor in self.reset() }
  }

  nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didReceiveDataFromRemoteWorkoutSession data: [Data]) {
    let messages = data.compactMap(Message.decode)
    Task { @MainActor in messages.forEach(self.apply) }
  }

  nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didDisconnectFromRemoteDeviceWithError error: Error?) {}
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
  nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
    let type = HKQuantityType(.heartRate)
    guard collectedTypes.contains(type),
          let quantity = workoutBuilder.statistics(for: type)?.mostRecentQuantity() else { return }
    let bpm = quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
    Task { @MainActor in self.publish(heartRate: bpm) }
  }

  nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}
