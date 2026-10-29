package expo.modules.spotmenowplaying

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

/** Whatever plays on the phone (Spotify, YouTube Music, …) through Android media sessions. */
class SpotmeNowPlayingModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No React context")

  private fun hasAccess(): Boolean {
    val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
    val me = ComponentName(context, MediaListenerService::class.java)
    return enabled.split(":").any { it == me.flattenToString() || it == me.flattenToShortString() }
  }

  /** The session that's playing, else the most recent one. */
  private fun controller(): MediaController? {
    if (!hasAccess()) return null
    val manager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
    val sessions = try {
      manager.getActiveSessions(ComponentName(context, MediaListenerService::class.java))
    } catch (e: SecurityException) {
      return null
    }
    return sessions.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING } ?: sessions.firstOrNull()
  }

  private fun artwork(metadata: MediaMetadata): String? {
    val bitmap: Bitmap = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
      ?: metadata.getBitmap(MediaMetadata.METADATA_KEY_ART)
      ?: metadata.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
      ?: return null
    val scaled = Bitmap.createScaledBitmap(bitmap, 120, 120, true)
    val out = ByteArrayOutputStream()
    scaled.compress(Bitmap.CompressFormat.JPEG, 70, out)
    return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  }

  private fun appName(packageName: String): String? = try {
    val pm = context.packageManager
    pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
  } catch (e: PackageManager.NameNotFoundException) {
    null
  }

  override fun definition() = ModuleDefinition {
    Name("SpotmeNowPlaying")

    AsyncFunction<String>("getAccess") {
      if (hasAccess()) "granted" else "notDetermined"
    }

    AsyncFunction<String>("requestAccess") {
      if (hasAccess()) "granted" else "notDetermined"
    }

    AsyncFunction<Unit>("openAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      Unit
    }

    AsyncFunction<Map<String, Any?>?>("getNowPlaying") {
      val c = controller() ?: return@AsyncFunction null
      val metadata = c.metadata ?: return@AsyncFunction null
      val title = metadata.getString(MediaMetadata.METADATA_KEY_TITLE)
        ?: metadata.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE)
        ?: return@AsyncFunction null
      mapOf(
        "title" to title,
        "artist" to (metadata.getString(MediaMetadata.METADATA_KEY_ARTIST)
          ?: metadata.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST)
          ?: metadata.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)
          ?: ""),
        "artworkBase64" to artwork(metadata),
        "isPlaying" to (c.playbackState?.state == PlaybackState.STATE_PLAYING),
        "appName" to appName(c.packageName)
      )
    }

    AsyncFunction<Unit>("play") { controller()?.transportControls?.play(); Unit }
    AsyncFunction<Unit>("pause") { controller()?.transportControls?.pause(); Unit }
    AsyncFunction<Unit>("next") { controller()?.transportControls?.skipToNext(); Unit }
    AsyncFunction<Unit>("previous") { controller()?.transportControls?.skipToPrevious(); Unit }
  }
}
