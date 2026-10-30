import Foundation

/// What the iPhone player sends: the step on screen, already in the user's language.
struct PhoneState: Codable, Equatable {
  var exercise: String
  var set: String
  var phase: String
  var isRest: Bool
  var target: String?
  var next: String?
  /// When the running timer ends (ms since 1970), nil for a reps set.
  var endsAt: Double?
  /// When the current step started (ms since 1970), for the count-up of a reps set.
  var startedAt: Double
  var paused: Bool
  /// While paused: the seconds to show (time left, or time into a reps set).
  var frozen: Double?
  /// Button and status texts in the user's language.
  var labels: Labels

  struct Labels: Codable, Equatable {
    var done: String
    var pause: String
    var resume: String
    var skip: String
  }

  var endsAtDate: Date? { endsAt.map { Date(timeIntervalSince1970: $0 / 1000) } }
  var startedAtDate: Date { Date(timeIntervalSince1970: startedAt / 1000) }
}

/// Envelope for both directions, decoded by `type`.
enum Message {
  case state(PhoneState)
  case end

  static func decode(_ data: Data) -> Message? {
    guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let type = object["type"] as? String else { return nil }
    switch type {
    case "state":
      guard let state = object["state"],
            let raw = try? JSONSerialization.data(withJSONObject: state),
            let decoded = try? JSONDecoder().decode(PhoneState.self, from: raw) else { return nil }
      return .state(decoded)
    case "end":
      return .end
    default:
      return nil
    }
  }
}
