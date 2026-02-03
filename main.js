document.addEventListener("DOMContentLoaded", function () {

  let audioCtx;
  let globalGain;

  const startBtn = document.getElementById("startBtn");
  const waveformSelect = document.getElementById("waveform");

  let activeOscillators = {};

  const keyboardFrequencyMap = {
    '90': 261.63,
    '83': 277.18,
    '88': 293.66,
    '68': 311.13,
    '67': 329.63,
    '86': 349.23,
    '71': 369.99,
    '66': 392.00,
    '72': 415.30,
    '78': 440.00,
    '74': 466.16,
    '77': 493.88,
    '81': 523.25,
    '50': 554.37,
    '87': 587.33,
    '51': 622.25,
    '69': 659.26,
    '82': 698.46,
    '53': 739.99,
    '84': 783.99,
    '54': 830.61,
    '89': 880.00,
    '55': 932.33,
    '85': 987.77
  };

  startBtn.addEventListener("click", async function () {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      globalGain = audioCtx.createGain();
      globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
      globalGain.connect(audioCtx.destination);
    }
    await audioCtx.resume();
    startBtn.textContent = "Audio Ready";
  });

  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);

  function keyDown(event) {
    if (!audioCtx || audioCtx.state !== "running") return;

    const key = event.which.toString();

    if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
      playNote(key);
    }
  }

  function keyUp(event) {
    const key = event.which.toString();

    if (keyboardFrequencyMap[key] && activeOscillators[key]) {
      const voice = activeOscillators[key];
      const now = audioCtx.currentTime;

      voice.gainNode.gain.cancelScheduledValues(now);
      voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
      voice.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.12);

      voice.osc.stop(now + 0.15);

      delete activeOscillators[key];
    }
  }

  function perVoicePeakGain(count) {
    return 0.9 / Math.sqrt(Math.max(1, count));
  }

  function playNote(key) {

    if (waveformSelect.value === "meow") {
      playMeow(key);
      return;
    }

    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.frequency.setValueAtTime(keyboardFrequencyMap[key], now);
    osc.type = waveformSelect.value;

    osc.connect(gainNode);
    gainNode.connect(globalGain);

    const voices = Object.keys(activeOscillators).length + 1;
    const peak = perVoicePeakGain(voices);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(peak * 0.6, now + 0.08);

    osc.start();

    activeOscillators[key] = { osc, gainNode };
  }

  function playMeow(key) {

    const now = audioCtx.currentTime;
    const freq = keyboardFrequencyMap[key];

    const voices = Object.keys(activeOscillators).length + 1;
    const peak = perVoicePeakGain(voices);

    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(peak * 0.6, now + 0.08);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.30);

    const f1 = audioCtx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.setValueAtTime(Math.max(300, freq * 1.5), now);
    f1.Q.setValueAtTime(6, now);

    const f2 = audioCtx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.setValueAtTime(Math.max(900, freq * 3.2), now);
    f2.Q.setValueAtTime(10, now);

    osc.frequency.setValueAtTime(freq * 1.2, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.9, now + 0.18);

    osc.connect(f1);
    f1.connect(f2);
    f2.connect(gainNode);
    gainNode.connect(globalGain);

    osc.start();
    osc.stop(now + 0.35);

    activeOscillators[key] = { osc, gainNode };
  }

});