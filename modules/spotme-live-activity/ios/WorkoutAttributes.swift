import ActivityKit
import Foundation

/// What the Live Activity shows. The same file exists in the widget target
/// (targets/live/WorkoutAttributes.swift, for the widget): ActivityKit matches the two by
/// type name and coding, so keep them identical.
struct SpotMeWorkoutAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// The exercise (during a rest: the one coming up).
    var title: String
    /// "Set 2 of 4 · Rest".
    var subtitle: String
    var isRest: Bool
    /// A countdown ends here; nil for a reps set, which counts up from `timerStart`.
    var timerEnd: Date?
    var timerStart: Date
    var paused: Bool
    /// The time to show while paused ("0:42").
    var pausedText: String?
    /// "Next: Squat".
    var next: String?
    var heartRate: Int?
    /// What to show once the countdown has run out and the app hasn't been able to update
    /// (it's suspended in the background): the step that follows.
    var afterTitle: String?
    var afterSubtitle: String?
    var afterIsRest: Bool?
  }

  var workoutName: String
}
