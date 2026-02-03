document.addEventListener("DOMContentLoaded", function(event) {

  let audioCtx;
  let globalGain;

  const waveformSelect = document.getElementById("waveform");
  const startBtn = document.getElementById("startBtn");

  const keyboardFrequencyMap = {
    '90': 261.625565300598634,
    '83': 277.182630976872096,
    '88': 293.664767917407560,
    '68': 311.126983722080910,
    '67': 329.627556912869929,
    '86': 349.228231433003884,
    '71': 369.994422711634398,
    '66': 391.995435981749294,
    '72': 415.304697579945138,
    '78': 440.000000000000000,
    '74': 466.163761518089916,
    '77': 493.883301256124111,
    '81': 523.251130601197269,
    '50': 554.365261953744192,
    '87': 587.329535834815120,
    '51': 622.253967444161821,
    '69': 659.255113825739859,
    '82': 698.456462866007768,
    '53': 739.988845423268797,
    '84': 783.990871963498588,
    '54': 830.609395159890277,
    '89': 880.000000000000000,
    '55': 932.327523036179832,
    '85': 987.766602512248223
  }

  let activeOscillators = {}

  startBtn.addEventListener("click", async function() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      globalGain = audioCtx.createGain();
      globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
      globalGain.connect(audioCtx.destination);
    }
    await audioCtx.resume();
  });

  window.addEventListener('keydown', keyDown, false);
  window.addEventListener('keyup', keyUp, false);

  function keyDown(event) {
    if (!audioCtx || audioCtx.state !== "running") return;

    const key = (event.detail || event.which).toString();
    if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
      playNote(key);
    }
  }

  function keyUp(event) {
    if (!audioCtx) return;

    const key = (event.detail || event.which).toString();
    if (keyboardFrequencyMap[key] && activeOscillators[key]) {
      const voice = activeOscillators[key];
      const now = audioCtx.currentTime;

      voice.gainNode.gain.cancelScheduledValues(now);
      voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
      voice.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.10);

      voice.osc.stop(now + 0.12);
      delete activeOscillators[key];
    }
  }

  function perVoicePeakGain(voiceCount) {
    return 0.9 / Math.sqrt(Math.max(1, voiceCount));
  }

  function playNote(key) {
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.frequency.setValueAtTime(keyboardFrequencyMap[key], now);
    osc.type = waveformSelect.value;

    osc.connect(gainNode);
    gainNode.connect(globalGain);

    const voices = Object.keys(activeOscillators).length + 1;
    const peak = perVoicePeakGain(voices);

    const attack = 0.01;
    const decay = 0.08;
    const sustain = 0.6;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + attack);
    gainNode.gain.linearRampToValueAtTime(peak * sustain, now + attack + decay);

    osc.start();
    activeOscillators[key] = { osc, gainNode };
  }

});