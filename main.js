document.addEventListener("DOMContentLoaded", function () {

  let audioCtx;
  let globalGain;

  const startBtn = document.getElementById("startBtn");
  const waveformSelect = document.getElementById("waveform");

  let activeOscillators = {};
  let meowBuffer = null;

  const keyboardFrequencyMap = {
    '90': 261.63, '83': 277.18, '88': 293.66, '68': 311.13, '67': 329.63,
    '86': 349.23, '71': 369.99, '66': 392.00, '72': 415.30, '78': 440.00,
    '74': 466.16, '77': 493.88, '81': 523.25, '50': 554.37, '87': 587.33,
    '51': 622.25, '69': 659.26, '82': 698.46, '53': 739.99, '84': 783.99,
    '54': 830.61, '89': 880.00, '55': 932.33, '85': 987.77
  };

  startBtn.addEventListener("click", async function () {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      globalGain = audioCtx.createGain();
      globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
      globalGain.connect(audioCtx.destination);

      await loadMeow();
    }
    await audioCtx.resume();
    startBtn.textContent = "Audio Ready";
  });

  async function loadMeow() {
    const resp = await fetch("meow.wav");
    const arrayBuf = await resp.arrayBuffer();
    meowBuffer = await audioCtx.decodeAudioData(arrayBuf);
  }

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

      voice.source.stop(now + 0.15);
      delete activeOscillators[key];
    }
  }

  function perVoicePeakGain(count) {
    return 0.9 / Math.sqrt(Math.max(1, count));
  }

  function playNote(key) {
    if (waveformSelect.value === "sample") {
      playMeowSample(key);
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

    activeOscillators[key] = { source: osc, gainNode };
  }

  function playMeowSample(key) {
    if (!meowBuffer) return;

    const now = audioCtx.currentTime;

    const source = audioCtx.createBufferSource();
    source.buffer = meowBuffer;

    const gainNode = audioCtx.createGain();

    const voices = Object.keys(activeOscillators).length + 1;
    const peak = perVoicePeakGain(voices);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(peak * 0.6, now + 0.08);

    source.connect(gainNode);
    gainNode.connect(globalGain);

    const targetFreq = keyboardFrequencyMap[key];
    const baseFreq = 440.0;
    source.playbackRate.setValueAtTime(targetFreq / baseFreq, now);

    source.start(now);

    activeOscillators[key] = { source, gainNode };
  }

});