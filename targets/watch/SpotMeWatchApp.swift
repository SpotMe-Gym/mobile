import HealthKit
import SwiftUI
import WatchKit

/// Receives the workout the iPhone starts (HKHealthStore.startWatchApp).
final class AppDelegate: NSObject, WKApplicationDelegate {
  func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
    Task { @MainActor in WorkoutManager.shared.start(with: workoutConfiguration) }
  }
}

@main
struct SpotMeWatchApp: App {
  @WKApplicationDelegateAdaptor private var delegate: AppDelegate

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(WorkoutManager.shared)
    }
  }
}
