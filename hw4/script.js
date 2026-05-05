let audioCtx;

const pitchClassToFreq = {
  0: 261.63, 1: 277.18, 2: 293.66, 3: 311.13,
  4: 329.63, 5: 349.23, 6: 369.99, 7: 392.00,
  8: 415.30, 9: 440.00, 10: 466.16, 11: 493.88
};

function transpose(set, interval) {
  return set.map(pc => (pc + interval + 12) % 12);
}

function invert(set) {
  return set.map(pc => (12 - pc) % 12);
}

function retrograde(set) {
  return [...set].reverse();
}

function randomTransform(set) {
  let result = [...set];
  const choice = Math.floor(Math.random() * 3);

  if (choice === 0) {
    const interval = Math.floor(Math.random() * 12);
    result = transpose(result, interval);
  } else if (choice === 1) {
    result = invert(result);
  } else {
    result = retrograde(result);
  }

  return result;
}

function generateComposition(inputSet, repetitions) {
  let composition = [];

  for (let i = 0; i < repetitions; i++) {
    const transformed = randomTransform(inputSet);
    composition = composition.concat(transformed);
  }

  return composition;
}

function playNote(pc, startTime, duration) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.value = pitchClassToFreq[pc];

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playComposition(composition) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const now = audioCtx.currentTime;
  const duration = 0.35;

  composition.forEach((pc, i) => {
    playNote(pc, now + i * duration, duration);
  });
}

function runComposition() {
  const input = document.getElementById("pitchInput").value;
  const repetitions = Number(document.getElementById("repetitions").value);

  const inputSet = input
    .split(" ")
    .map(Number)
    .filter(n => !isNaN(n))
    .map(n => ((n % 12) + 12) % 12);

  const composition = generateComposition(inputSet, repetitions);

document.getElementById("output").textContent =
  "Generated: [" + composition.join(", ") + "]";

  playComposition(composition);
}
