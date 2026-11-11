/**
 * Hands-free voice: say "Hey suit" to talk to the AI (the phone is inside the VR box, so no buttons).
 * The phone's speech recognition listens only for the wake word; then the ElevenLabs conversation opens.
 * It closes itself after `idleMs` with no answer, and the wake word listens again (saves ElevenLabs credits).
 * The Bluetooth clicker still works at any time.
 */
const WAKE = /\b(hey|hi|ok|okay)?\s*(suit|suits|soot|sweet|suite)\b/i;

function chime(freq = 880) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25); o.stop(ctx.currentTime + 0.26);
  } catch { /* no audio: fine */ }
}

export function startWakeWord({ voice, notify, idleMs = 15000 }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    notify?.('Wake word not supported here: use the clicker to talk');
    return null;
  }
  let rec = null, talking = false, stopped = false, lastActivity = 0;
  voice.onText?.(() => { lastActivity = Date.now(); });

  function listen() {
    if (stopped || talking) return;
    rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (WAKE.test(e.results[i][0].transcript)) { wake(); return; }
      }
    };
    rec.onend = () => { if (!talking && !stopped) setTimeout(listen, 300); };   // phones stop after silence: restart
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopped = true;
        notify?.('Microphone blocked: allow it to use "Hey suit"');
      }
    };
    try { rec.start(); } catch { setTimeout(listen, 1000); }
  }

  async function wake() {
    if (talking) return;
    talking = true;
    try { rec?.abort(); } catch { /* already stopped */ }
    chime(880);
    notify?.('Listening… ask your question');
    lastActivity = Date.now();
    await voice.toggle();
  }

  setInterval(async () => {
    if (stopped) return;
    if (!talking && voice.listening) {                 // started with the clicker: pause the wake word
      talking = true; lastActivity = Date.now();
      try { rec?.abort(); } catch { /* fine */ }
      return;
    }
    if (!talking) return;
    const quiet = Date.now() - lastActivity;
    if (!voice.listening && quiet > 4000) {            // conversation ended (or failed): listen for the wake word again
      talking = false; listen();
    } else if (voice.listening && quiet > idleMs) {    // nobody spoke for a while: close it to save credits
      await voice.toggle();
      chime(520);
      notify?.('Say "Hey suit" to talk');
      talking = false;
      setTimeout(listen, 800);
    }
  }, 1000);

  listen();
  notify?.('Say "Hey suit" to talk to the AI');
  return { stop() { stopped = true; try { rec?.abort(); } catch { /* fine */ } } };
}
