var audioCtx;
var globalGain;
activeOscillators = {}

const playButton = document.querySelector("button");

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

playButton.addEventListener("click", async function(){
  if (!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);
  }
  await audioCtx.resume();
})

window.addEventListener('keydown', keyDown, false);
window.addEventListener('keyup', keyUp, false);

function keyDown(event) {
  const key = (event.detail || event.which).toString();
  if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
    playNote(key);
  }
}

function keyUp(event) {
  const key = (event.detail || event.which).toString();
  if (keyboardFrequencyMap[key] && activeOscillators[key]) {
    const voice = activeOscillators[key];
    const now = audioCtx.currentTime;

    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setTargetAtTime(0.0001, now, 0.05);
    voice.osc.stop(now + 0.2);

    delete activeOscillators[key];
  }
}

function playNote(key) {
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime)
  osc.type = 'sine'
  osc.connect(gainNode);
  gainNode.connect(globalGain);

  gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);

  osc.start();
  activeOscillators[key] = { osc, gainNode }
}