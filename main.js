let audioCtx;
let activeOscillators = {};

const playButton = document.querySelector("button");

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

playButton.addEventListener("click", async () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state !== "running") {
    await audioCtx.resume();
  }
  playButton.textContent = "Audio Ready";
});

window.addEventListener("keydown", keyDown);
window.addEventListener("keyup", keyUp);

function keyDown(event) {
  if (!audioCtx) return;

  const key = event.which.toString();
  if (!keyboardFrequencyMap[key]) return;

  if (event.repeat) return;

  if (!activeOscillators[key]) {
    playNote(key);
  }
}

function keyUp(event) {
  if (!audioCtx) return;

  const key = event.which.toString();
  if (!keyboardFrequencyMap[key]) return;

  if (activeOscillators[key]) {
    activeOscillators[key].stop();
    delete activeOscillators[key];
  }
}

function playNote(key) {
  const osc = audioCtx.createOscillator();
  osc.frequency.setValueAtTime(
    keyboardFrequencyMap[key],
    audioCtx.currentTime
  );
  osc.type = "sine";
  osc.connect(audioCtx.destination);
  osc.start();

  activeOscillators[key] = osc;
}