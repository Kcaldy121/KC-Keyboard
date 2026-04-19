const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let brookPlaying = false;
let chipPlaying = false;

let brookNodes = [];
let chipNodes = [];
let chipTimeout = null;

// -------- Brown Noise --------
function createBrownNoise() {
  const bufferSize = 10 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    let brown = Math.random() * 2 - 1;
    data[i] = (lastOut + (0.02 * brown)) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  return noise;
}

// -------- BABBLING BROOK (faithful to simplified version) --------
function startBrook() {
  const noise = createBrownNoise();

  const lpf = audioCtx.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = 400;

  noise.connect(lpf);

  const modNoise = createBrownNoise();

  const modLPF = audioCtx.createBiquadFilter();
  modLPF.type = "lowpass";
  modLPF.frequency.value = 14;

  modNoise.connect(modLPF);

  const modGain = audioCtx.createGain();
  modGain.gain.value = 400;

  modLPF.connect(modGain);

  const offset = audioCtx.createConstantSource();
  offset.offset.value = 500;

  const cutoff = audioCtx.createGain();
  modGain.connect(cutoff);
  offset.connect(cutoff);

  const hpf = audioCtx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.Q.value = 0.03;

  lpf.connect(hpf);
  cutoff.connect(hpf.frequency);

  const master = audioCtx.createGain();
  master.gain.value = 0.3;

  hpf.connect(master);
  master.connect(audioCtx.destination);

  noise.start();
  modNoise.start();
  offset.start();

  brookNodes = [noise, modNoise, offset];
}

function stopBrook() {
  brookNodes.forEach(n => {
    try { n.stop(); } catch(e) {}
  });
  brookNodes = [];
}

// -------- CHIP BAG --------
function startChip() {
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const bandpass = audioCtx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 2500;
  bandpass.Q.value = 6;

  const gain = audioCtx.createGain();
  gain.gain.value = 0;

  const master = audioCtx.createGain();
  master.gain.value = 0.3;

  noise.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(master);
  master.connect(audioCtx.destination);

  noise.start();

  function burst() {
    const now = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  }

  function loop() {
    burst();
    chipTimeout = setTimeout(loop, Math.random() * 200);
  }

  loop();

  chipNodes = [noise];
}

function stopChip() {
  chipNodes.forEach(n => {
    try { n.stop(); } catch(e) {}
  });
  chipNodes = [];
  if (chipTimeout) clearTimeout(chipTimeout);
}

// -------- BUTTONS --------
document.getElementById("brookToggle").onclick = async () => {
  await audioCtx.resume();

  if (!brookPlaying) {
    startBrook();
    brookPlaying = true;
  } else {
    stopBrook();
    brookPlaying = false;
  }
};

document.getElementById("chipToggle").onclick = async () => {
  await audioCtx.resume();

  if (!chipPlaying) {
    startChip();
    chipPlaying = true;
  } else {
    stopChip();
    chipPlaying = false;
  }
};
