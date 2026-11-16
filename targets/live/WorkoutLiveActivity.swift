import ActivityKit
import SwiftUI
import WidgetKit

@main
struct SpotMeLiveBundle: WidgetBundle {
  var body: some Widget {
    WorkoutLiveActivity()
  }
}

/// The step on screen: the one the app sent, or, once its countdown has run out without an
/// update (the app is suspended while the phone is locked), the step that follows it.
private struct Shown {
  let title: String
  let subtitle: String
  let isRest: Bool
  let next: String?
  let state: SpotMeWorkoutAttributes.ContentState
  let ranOut: Bool

  init(_ context: ActivityViewContext<SpotMeWorkoutAttributes>) {
    let s = context.state
    let over = !s.paused && context.isStale && s.timerEnd != nil && s.afterTitle != nil
    state = s
    ranOut = over
    title = over ? (s.afterTitle ?? s.title) : s.title
    subtitle = over ? (s.afterSubtitle ?? "") : s.subtitle
    isRest = over ? (s.afterIsRest ?? !s.isRest) : s.isRest
    next = over ? nil : s.next
  }

  var tint: Color { isRest ? Color(red: 0.23, green: 0.51, blue: 0.96) : .green }
  var symbol: String { isRest ? "timer" : "figure.strengthtraining.traditional" }
}

private struct TimerText: View {
  let shown: Shown

  var body: some View {
    let s = shown.state
    if s.paused {
      Text(s.pausedText ?? "–")
    } else if shown.ranOut, let end = s.timerEnd {
      // Counting up since the switch.
      Text(end, style: .timer)
    } else if let end = s.timerEnd, end > Date() {
      Text(timerInterval: Date()...end, countsDown: true)
    } else if s.timerEnd != nil {
      Text("0:00")
    } else {
      Text(s.timerStart, style: .timer)
    }
  }
}

private struct HeartRate: View {
  let bpm: Int?

  var body: some View {
    if let bpm = bpm {
      HStack(spacing: 3) {
        Image(systemName: "heart.fill").foregroundColor(.red)
        Text("\(bpm)").monospacedDigit()
      }
      .font(.caption.weight(.semibold))
    }
  }
}

struct WorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SpotMeWorkoutAttributes.self) { context in
      // Lock Screen and banner.
      let shown = Shown(context)
      VStack(alignment: .leading, spacing: 6) {
        HStack(alignment: .center) {
          VStack(alignment: .leading, spacing: 2) {
            Text(shown.title)
              .font(.headline)
              .lineLimit(1)
            Text(shown.subtitle)
              .font(.subheadline)
              .foregroundColor(shown.tint)
              .lineLimit(1)
          }
          Spacer(minLength: 8)
          TimerText(shown: shown)
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
            .frame(maxWidth: 120, alignment: .trailing)
        }
        HStack {
          if let next = shown.next {
            Text(next)
              .font(.caption)
              .foregroundColor(.secondary)
              .lineLimit(1)
          }
          Spacer()
          HeartRate(bpm: shown.state.heartRate)
        }
      }
      .padding(16)
      .activityBackgroundTint(Color.black.opacity(0.75))
      .activitySystemActionForegroundColor(.white)
      .foregroundColor(.white)
    } dynamicIsland: { context in
      let shown = Shown(context)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label {
            Text(shown.isRest ? shown.subtitle : context.attributes.workoutName)
              .lineLimit(1)
          } icon: {
            Image(systemName: shown.symbol)
          }
          .font(.caption.weight(.semibold))
          .foregroundColor(shown.tint)
        }
        DynamicIslandExpandedRegion(.trailing) {
          TimerText(shown: shown)
            .font(.system(.title2, design: .rounded).weight(.bold))
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
            .frame(maxWidth: 80, alignment: .trailing)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(shown.title)
            .font(.headline)
            .lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Text(shown.isRest ? (shown.next ?? "") : shown.subtitle)
              .font(.caption)
              .foregroundColor(.secondary)
              .lineLimit(1)
            Spacer()
            HeartRate(bpm: shown.state.heartRate)
          }
        }
      } compactLeading: {
        Image(systemName: shown.symbol)
          .foregroundColor(shown.tint)
      } compactTrailing: {
        TimerText(shown: shown)
          .monospacedDigit()
          .multilineTextAlignment(.trailing)
          .frame(maxWidth: 44, alignment: .trailing)
          .foregroundColor(shown.tint)
      } minimal: {
        Image(systemName: shown.symbol)
          .foregroundColor(shown.tint)
      }
      .keylineTint(shown.tint)
    }
  }
}
