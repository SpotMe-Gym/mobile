import ActivityKit
import ExpoModulesCore

/// The workout Live Activity (Lock Screen and Dynamic Island), driven by the player in JS.
/// The picture itself is drawn by the widget in targets/live.
public class SpotmeLiveActivityModule: Module {
  /// What JS sends: the content state with times in milliseconds since 1970.
  private struct Payload: Decodable {
    var title: String
    var subtitle: String
    var isRest: Bool
    var endsAt: Double?
    var startedAt: Double
    var paused: Bool
    var pausedText: String?
    var next: String?
    var heartRate: Int?
    var afterTitle: String?
    var afterSubtitle: String?
    var afterIsRest: Bool?
  }

  private static func content(_ json: String) throws -> ActivityContent<SpotMeWorkoutAttributes.ContentState> {
    let p = try JSONDecoder().decode(Payload.self, from: Data(json.utf8))
    let end = p.endsAt.map { Date(timeIntervalSince1970: $0 / 1000) }
    let state = SpotMeWorkoutAttributes.ContentState(
      title: p.title,
      subtitle: p.subtitle,
      isRest: p.isRest,
      timerEnd: end,
      timerStart: Date(timeIntervalSince1970: p.startedAt / 1000),
      paused: p.paused,
      pausedText: p.pausedText,
      next: p.next,
      heartRate: p.heartRate,
      afterTitle: p.afterTitle,
      afterSubtitle: p.afterSubtitle,
      afterIsRest: p.afterIsRest
    )
    // Stale the moment the countdown ends: the widget then shows the step that follows, since
    // the app can't update it while suspended.
    return ActivityContent(state: state, staleDate: p.paused ? nil : end)
  }

  public func definition() -> ModuleDefinition {
    Name("SpotmeLiveActivity")

    /// False when the user turned Live Activities off for SpotMe (or the device has none).
    Function("isEnabled") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    /// Starts the activity, or updates the one already running.
    AsyncFunction("show") { (workoutName: String, json: String) async throws -> Bool in
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
      let content = try SpotmeLiveActivityModule.content(json)
      let running = Activity<SpotMeWorkoutAttributes>.activities
      if let current = running.first {
        await current.update(content)
        for extra in running.dropFirst() {
          await extra.end(nil, dismissalPolicy: .immediate)
        }
        return true
      }
      _ = try Activity<SpotMeWorkoutAttributes>.request(
        attributes: SpotMeWorkoutAttributes(workoutName: workoutName), content: content, pushType: nil)
      return true
    }

    AsyncFunction("end") { () async -> Void in
      for activity in Activity<SpotMeWorkoutAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}
