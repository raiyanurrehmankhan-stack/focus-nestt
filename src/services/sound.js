// Alarm sound. Browsers only allow audio after a user gesture, so we
// "unlock" the audio element on the first click/tap/key press (doc 6.6).
let audio = null;
let unlocked = false;

function getAudio() {
  if (!audio && typeof Audio !== 'undefined') {
    audio = new Audio('/sounds/alarm.wav');
    audio.preload = 'auto';
  }
  return audio;
}

export function installAudioUnlock() {
  const unlock = () => {
    const a = getAudio();
    if (!a || unlocked) return;
    a.muted = true;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; unlocked = true; }).catch(() => { a.muted = false; });
    ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, unlock, true));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, true));
}

export async function playAlarm({ repeat = 2 } = {}) {
  const a = getAudio();
  if (!a) return false;
  try {
    for (let i = 0; i < repeat; i++) {
      a.currentTime = 0;
      await a.play();
      await new Promise((r) => { a.onended = r; setTimeout(r, 3000); });
    }
    return true;
  } catch {
    return false;
  }
}

export function stopAlarm() {
  if (audio) { audio.pause(); audio.currentTime = 0; }
}
