document.addEventListener("DOMContentLoaded", function () {

  let audioCtx;
  let globalGain;
  let limiter; // used in safe mode
  let meowBuffer = null;

  const startBtn = document.getElementById("startBtn");
  const waveformSelect = document.getElementById("waveform");
  const synthModeSelect = document.getElementById("synthMode");

  const keyboardFrequencyMap = {
    '90': 261.63, '83': 277.18, '88': 293.66, '68': 311.13, '67': 329.63,
    '86': 349.23, '71': 369.99, '66': 392.00, '72': 415.30, '78': 440.00,
    '74': 466.16, '77': 493.88, '81': 523.25, '50': 554.37, '87': 587.33,
    '51': 622.25, '69': 659.26, '82': 698.46, '53': 739.99, '84': 783.99,
    '54': 830.61, '89': 880.00, '55': 932.33, '85': 987.77
  };

  // active voices keyed by keycode string
  let activeVoices = {};

  // UI helpers
  const $ = (id) => document.getElementById(id);

  function getParams() {
    return {
      masterVol: parseFloat($("masterVol").value),
      safeMode: $("safeMode").checked,

      attack: parseFloat($("attack").value),
      decay: parseFloat($("decay").value),
      sustain: parseFloat($("sustain").value),
      release: parseFloat($("release").value),

      partials: parseInt($("partials").value, 10),
      modFreq: parseFloat($("modFreq").value),
      fmIndex: parseFloat($("fmIndex").value),

      lfoRate: parseFloat($("lfoRate").value),
      lfoDepth: parseFloat($("lfoDepth").value),

      synthMode: synthModeSelect.value,
      waveform: waveformSelect.value
    };
  }

  startBtn.addEventListener("click", async function () {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      // master
      globalGain = audioCtx.createGain();
      globalGain.gain.setValueAtTime(parseFloat($("masterVol").value), audioCtx.currentTime);

      // limiter (compressor) to reduce clipping in safe mode
      limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 12;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;

      // connect chain
      globalGain.connect(limiter);
      limiter.connect(audioCtx.destination);

      // update master volume live
      $("masterVol").addEventListener("input", () => {
        if (!audioCtx) return;
        globalGain.gain.setValueAtTime(parseFloat($("masterVol").value), audioCtx.currentTime);
      });
    }

    await audioCtx.resume();

    if (!meowBuffer) {
      await loadMeow();
    }

    startBtn.textContent = "Audio Ready";
  });

  async function loadMeow() {
    try {
      const resp = await fetch("meow.wav", { cache: "no-store" });
      if (!resp.ok) throw new Error("fetch failed: " + resp.status);

      const arrayBuf = await resp.arrayBuffer();
      meowBuffer = await audioCtx.decodeAudioData(arrayBuf);
      console.log("meow loaded, seconds:", meowBuffer.duration);
    } catch (e) {
      console.error("meow load error:", e);
    }
  }

  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);

  function keyDown(event) {
    if (!audioCtx || audioCtx.state !== "running") return;

    const key = event.which.toString();
    if (!keyboardFrequencyMap[key]) return;
    if (activeVoices[key]) return; // prevent repeats while held

    playNote(key);
  }

  function keyUp(event) {
    if (!audioCtx) return;

    const key = event.which.toString();
    const voice = activeVoices[key];
    if (!voice) return;

    const now = audioCtx.currentTime;
    const p = voice.params;

    // release envelope on the voice's envelope gain
    releaseADSR(voice.envGain, now, p);

    // stop everything slightly after release to avoid clicks
    const stopAt = now + p.release + 0.05;

    if (voice.nodes) {
      voice.nodes.forEach((n) => {
        // Oscillators and ConstantSource nodes have stop()
        if (typeof n.stop === "function") {
          try { n.stop(stopAt); } catch (e) {}
        }
      });
    }

    delete activeVoices[key];
  }

  // ===== Envelope helpers =====

  function applyADSR(envGain, t0, p) {
    const a = Math.max(0.001, p.attack);
    const d = Math.max(0.001, p.decay);
    const s = Math.max(0.0001, p.sustain);

    envGain.gain.cancelScheduledValues(t0);
    envGain.gain.setValueAtTime(0.0001, t0);
    envGain.gain.linearRampToValueAtTime(1.0, t0 + a);
    envGain.gain.linearRampToValueAtTime(s, t0 + a + d);
  }

  function releaseADSR(envGain, tRelease, p) {
    const r = Math.max(0.001, p.release);
    envGain.gain.cancelScheduledValues(tRelease);
    envGain.gain.setValueAtTime(envGain.gain.value, tRelease);
    envGain.gain.linearRampToValueAtTime(0.0001, tRelease + r);
  }

  // Keep overall level stable when many voices are held
  function perVoicePeakGain(voiceCount) {
    return 0.9 / Math.sqrt(Math.max(1, voiceCount));
  }

  // ===== Main dispatcher =====

  function playNote(key) {
    const p = getParams();

    // Sample mode stays exactly like before
    if (p.waveform === "sample") {
      playMeowSample(key, p);
      return;
    }

    // Synthesis modes (single/add/am/fm)
    if (p.synthMode === "single") {
      playSingleOsc(key, p);
    } else if (p.synthMode === "add") {
      playAdditive(key, p);
    } else if (p.synthMode === "am") {
      playAM(key, p);
    } else if (p.synthMode === "fm") {
      playFM(key, p);
    }
  }

  // ===== Mode 0: old single oscillator =====

  function playSingleOsc(key, p) {
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = p.waveform;
    osc.frequency.setValueAtTime(keyboardFrequencyMap[key], now);

    // env gain (ADSR)
    const envGain = audioCtx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);

    // level gain (voice scaling)
    const level = audioCtx.createGain();

    const voices = Object.keys(activeVoices).length + 1;
    const peak = perVoicePeakGain(voices);

    // safe vs unsafe scaling
    const base = p.safeMode ? 0.22 : 0.50;
    level.gain.setValueAtTime(base * peak, now);

    osc.connect(envGain);
    envGain.connect(level);
    level.connect(globalGain);

    applyADSR(envGain, now, p);
    osc.start(now);

    activeVoices[key] = { envGain, nodes: [osc], params: p };
  }

  // ===== Mode 1: Additive synthesis (>= 3 partials, shared envelope) =====

  function playAdditive(key, p) {
    const now = audioCtx.currentTime;
    const f0 = keyboardFrequencyMap[key];

    const envGain = audioCtx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);

    const level = audioCtx.createGain();

    const voices = Object.keys(activeVoices).length + 1;
    const peak = perVoicePeakGain(voices);

    const partialCount = Math.max(3, Math.min(10, p.partials));

    // Reduce loudness as partials increase
    const base = p.safeMode ? 0.20 : 0.45;
    level.gain.setValueAtTime(base * peak / Math.sqrt(partialCount), now);

    envGain.connect(level);
    level.connect(globalGain);

    const oscs = [];
    for (let i = 1; i <= partialCount; i++) {
      const osc = audioCtx.createOscillator();
      osc.type = "sine"; // classic additive
      osc.frequency.setValueAtTime(f0 * i, now);

      const g = audioCtx.createGain();
      // hardcoded amplitude rolloff
      g.gain.setValueAtTime(1 / i, now);

      osc.connect(g);
      g.connect(envGain);

      osc.start(now);
      oscs.push(osc);
    }

    applyADSR(envGain, now, p);
    activeVoices[key] = { envGain, nodes: oscs, params: p };
  }

  // ===== Mode 2: AM synthesis (carrier = key freq, mod freq hardcoded/UI) =====

  function playAM(key, p) {
    const now = audioCtx.currentTime;
    const fc = keyboardFrequencyMap[key];

    const carrier = audioCtx.createOscillator();
    carrier.type = p.waveform;
    carrier.frequency.setValueAtTime(fc, now);

    const mod = audioCtx.createOscillator();
    mod.type = "sine";
    mod.frequency.setValueAtTime(p.modFreq, now);

    // AM depth (0..1-ish). You can expose this as another slider if you want.
    const depth = audioCtx.createGain();
    depth.gain.setValueAtTime(0.5, now);

    // VCA gain receives DC offset + mod
    const vca = audioCtx.createGain();
    vca.gain.setValueAtTime(0.0, now);

    const dc = audioCtx.createConstantSource();
    dc.offset.setValueAtTime(1.0, now);

    // envelope after AM to avoid clicky gain modulation when releasing
    const envGain = audioCtx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);

    const level = audioCtx.createGain();
    const voices = Object.keys(activeVoices).length + 1;
    const peak = perVoicePeakGain(voices);

    const base = p.safeMode ? 0.18 : 0.40;
    level.gain.setValueAtTime(base * peak, now);

    // routing: mod -> depth -> vca.gain, dc -> vca.gain
    mod.connect(depth);
    depth.connect(vca.gain);
    dc.connect(vca.gain);

    // carrier -> vca -> env -> level -> out
    carrier.connect(vca);
    vca.connect(envGain);
    envGain.connect(level);
    level.connect(globalGain);

    applyADSR(envGain, now, p);

    carrier.start(now);
    mod.start(now);
    dc.start(now);

    activeVoices[key] = { envGain, nodes: [carrier, mod, dc], params: p };
  }

  // ===== Mode 3: FM synthesis (carrier = key freq, mod freq hardcoded/UI) + LFO =====

  function playFM(key, p) {
    const now = audioCtx.currentTime;
    const fc = keyboardFrequencyMap[key];

    const carrier = audioCtx.createOscillator();
    carrier.type = p.waveform;
    carrier.frequency.setValueAtTime(fc, now);

    const mod = audioCtx.createOscillator();
    mod.type = "sine";
    mod.frequency.setValueAtTime(p.modFreq, now);

    // FM index in Hz (depth)
    const indexGain = audioCtx.createGain();
    indexGain.gain.setValueAtTime(p.fmIndex, now);

    // LFO vibrato on detune (cents)
    const lfo = audioCtx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(p.lfoRate, now);

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(p.lfoDepth, now);

    // envelope
    const envGain = audioCtx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);

    const level = audioCtx.createGain();
    const voices = Object.keys(activeVoices).length + 1;
    const peak = perVoicePeakGain(voices);

    const base = p.safeMode ? 0.16 : 0.38;
    level.gain.setValueAtTime(base * peak, now);

    // routing: mod -> indexGain -> carrier.frequency
    mod.connect(indexGain);
    indexGain.connect(carrier.frequency);

    // routing: lfo -> lfoGain -> carrier.detune
    lfo.connect(lfoGain);
    lfoGain.connect(carrier.detune);

    // carrier -> env -> level -> out
    carrier.connect(envGain);
    envGain.connect(level);
    level.connect(globalGain);

    applyADSR(envGain, now, p);

    carrier.start(now);
    mod.start(now);
    lfo.start(now);

    activeVoices[key] = { envGain, nodes: [carrier, mod, lfo], params: p };
  }

  // ===== Sample mode: meow.wav (same as yours, but uses shared ADSR) =====

  function playMeowSample(key, p) {
    if (!meowBuffer) {
      console.log("meowBuffer not loaded yet");
      return;
    }

    const now = audioCtx.currentTime;

    const source = audioCtx.createBufferSource();
    source.buffer = meowBuffer;

    // envelope
    const envGain = audioCtx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);

    const level = audioCtx.createGain();
    const voices = Object.keys(activeVoices).length + 1;
    const peak = perVoicePeakGain(voices);

    const base = p.safeMode ? 0.22 : 0.50;
    level.gain.setValueAtTime(base * peak, now);

    source.connect(envGain);
    envGain.connect(level);
    level.connect(globalGain);

    applyADSR(envGain, now, p);

    const targetFreq = keyboardFrequencyMap[key];
    const baseFreq = 440.0;
    source.playbackRate.setValueAtTime(targetFreq / baseFreq, now);

    source.start(now);

    activeVoices[key] = { envGain, nodes: [source], params: p };
  }

});