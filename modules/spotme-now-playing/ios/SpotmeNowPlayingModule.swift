import ExpoModulesCore
import MediaPlayer

/// Apple Music through the system music player: what's playing and play / pause / skip.
/// iOS doesn't let apps read or control other apps' playback (Spotify has its own API in JS).
public final class SpotmeNowPlayingModule: Module {
  private var player: MPMusicPlayerController { MPMusicPlayerController.systemMusicPlayer }

  public func definition() -> ModuleDefinition {
    Name("SpotmeNowPlaying")

    AsyncFunction("getAccess") { () -> String in
      return Self.describe(MPMediaLibrary.authorizationStatus())
    }

    AsyncFunction("requestAccess") { (promise: Promise) in
      MPMediaLibrary.requestAuthorization { status in
        promise.resolve(Self.describe(status))
      }
    }

    AsyncFunction("openAccessSettings") { () in
      // Nothing to open on iOS: access is asked with requestAccess.
    }

    AsyncFunction("getNowPlaying") { () -> [String: Any]? in
      guard MPMediaLibrary.authorizationStatus() == .authorized else { return nil }
      let player = self.player
      guard let item = player.nowPlayingItem else { return nil }
      var result: [String: Any] = [
        "title": item.title ?? "",
        "artist": item.artist ?? item.albumArtist ?? "",
        "isPlaying": player.playbackState == .playing,
        "appName": "Apple Music",
      ]
      if let image = item.artwork?.image(at: CGSize(width: 120, height: 120)),
         let data = image.jpegData(compressionQuality: 0.7) {
        result["artworkBase64"] = data.base64EncodedString()
      }
      return result
    }.runOnQueue(.main)

    AsyncFunction("play") { () in
      self.player.play()
    }.runOnQueue(.main)

    AsyncFunction("pause") { () in
      self.player.pause()
    }.runOnQueue(.main)

    AsyncFunction("next") { () in
      self.player.skipToNextItem()
    }.runOnQueue(.main)

    AsyncFunction("previous") { () in
      // Like the Music app: back to the start of the song, or the song before when near the start.
      if self.player.currentPlaybackTime > 3 {
        self.player.skipToBeginning()
      } else {
        self.player.skipToPreviousItem()
      }
    }.runOnQueue(.main)
  }

  private static func describe(_ status: MPMediaLibraryAuthorizationStatus) -> String {
    switch status {
    case .authorized: return "granted"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "denied"
    }
  }
}
