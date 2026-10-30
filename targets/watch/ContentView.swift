import SwiftUI

struct ContentView: View {
  @EnvironmentObject private var workout: WorkoutManager

  var body: some View {
    if workout.running, let state = workout.state {
      PlayerView(state: state, heartRate: workout.heartRate)
    } else if workout.running {
      VStack(spacing: 8) {
        HeartRateLabel(bpm: workout.heartRate)
        ProgressView()
      }
    } else {
      IdleView()
    }
  }
}

/// Before a workout: how to start one.
private struct IdleView: View {
  @EnvironmentObject private var workout: WorkoutManager
  private var italian: Bool { Locale.current.language.languageCode?.identifier == "it" }

  var body: some View {
    VStack(spacing: 10) {
      Image(systemName: "dumbbell.fill")
        .font(.title2)
        .foregroundStyle(.tint)
      Text("SpotMe").font(.headline)
      Text(italian ? "Avvia un allenamento in SpotMe sull'iPhone." : "Start a workout in SpotMe on your iPhone.")
        .font(.footnote)
        .multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
    }
    .padding()
    .task { await workout.requestAuthorization() }
  }
}

/// During a workout: exercise, set, the running timer, heart rate, Done and pause.
private struct PlayerView: View {
  @EnvironmentObject private var workout: WorkoutManager
  let state: PhoneState
  let heartRate: Int?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 6) {
        HStack {
          Text(state.phase.uppercased())
            .font(.caption2.weight(.bold))
            .foregroundStyle(state.isRest ? Color.orange : Color.accentColor)
          Spacer()
          HeartRateLabel(bpm: heartRate)
        }
        TimelineView(.periodic(from: .now, by: 0.5)) { context in
          Text(clock(state, now: context.date))
            .font(.system(size: 44, weight: .heavy, design: .rounded).monospacedDigit())
            .foregroundStyle(state.paused ? Color.secondary : Color.primary)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        Text(state.exercise)
          .font(.headline)
          .lineLimit(2)
        Text(state.set + (state.target.map { " · \($0)" } ?? ""))
          .font(.footnote)
          .foregroundStyle(.secondary)
          .lineLimit(2)
        if let next = state.next {
          Text(next)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(2)
        }
        Button {
          workout.command(state.isRest ? "skip" : "done")
        } label: {
          Label(state.isRest ? state.labels.skip : state.labels.done, systemImage: state.isRest ? "forward.fill" : "checkmark")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(state.isRest ? Color.orange : Color.accentColor)
        .padding(.top, 4)
        Button {
          workout.command(state.paused ? "resume" : "pause")
        } label: {
          Label(state.paused ? state.labels.resume : state.labels.pause, systemImage: state.paused ? "play.fill" : "pause.fill")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
      }
      .padding(.horizontal, 4)
    }
  }

  private func clock(_ state: PhoneState, now: Date) -> String {
    let seconds: Double
    if state.paused, let frozen = state.frozen {
      seconds = frozen
    } else if let end = state.endsAtDate {
      seconds = max(0, end.timeIntervalSince(now))
    } else {
      seconds = max(0, now.timeIntervalSince(state.startedAtDate))
    }
    let s = Int(seconds.rounded(.up))
    return String(format: "%d:%02d", s / 60, s % 60)
  }
}

struct HeartRateLabel: View {
  let bpm: Int?

  var body: some View {
    HStack(spacing: 3) {
      Image(systemName: "heart.fill").foregroundStyle(.red)
      Text(bpm.map(String.init) ?? "--").monospacedDigit()
    }
    .font(.footnote.weight(.semibold))
  }
}
