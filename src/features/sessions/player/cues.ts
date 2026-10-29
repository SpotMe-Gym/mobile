import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { lightImpact, successFeedback } from '@/shared/lib/haptics';

/**
 * Timer cues: a short tick on 3-2-1 and a longer tone when a timer ends, plus haptics. The
 * audio session mixes with other apps, so your music keeps playing underneath.
 */
let players: { tick: AudioPlayer; go: AudioPlayer } | null = null;

export async function prepareCues() {
  if (players) return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
    players = {
      tick: createAudioPlayer(require('../../../../assets/sounds/tick.wav')),
      go: createAudioPlayer(require('../../../../assets/sounds/go.wav')),
    };
  } catch {
    players = null; // sounds are a nicety: haptics still work
  }
}

function play(p: AudioPlayer | undefined) {
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    // ignore: a missed beep is fine
  }
}

export function cueTick(sound: boolean) {
  lightImpact();
  if (sound) play(players?.tick);
}

export function cueEnd(sound: boolean) {
  successFeedback();
  if (sound) play(players?.go);
}

export function releaseCues() {
  players?.tick.remove();
  players?.go.remove();
  players = null;
}
