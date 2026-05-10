let notes = [];
let tapTimes = [];

let bpm = 120;
let meter = "4/4";
let measureCount = 4;

let isRecording = false;

let keyHeld = false;
let noteStartTime = 0;
let lastReleaseTime = null;

let metronomeInterval = null;
let metronomeOn = false;

const log = document.getElementById("log");

const audioCtx = new (
  window.AudioContext ||
  window.webkitAudioContext
)();

document.getElementById("recordBtn").onclick = () => {
  isRecording = !isRecording;

  const btn = document.getElementById("recordBtn");
  const status = document.getElementById("status");

  if (isRecording) {
    btn.textContent = "Stop Recording";
    status.textContent = "Recording...";

    notes = [];
    keyHeld = false;
    lastReleaseTime = null;

    log.innerHTML = "";
    document.getElementById("notation").innerHTML = "";
  } else {
    btn.textContent = "Start Recording";
    status.textContent = "Stopped";
    renderNotation();
  }
};

window.addEventListener("keydown", (e) => {
  if (e.code === "Enter") {
    e.preventDefault();

    if (!isRecording) return;

    isRecording = false;

    document.getElementById("recordBtn").textContent =
      "Start Recording";

    document.getElementById("status").textContent =
      "Stopped";

    renderNotation();
    return;
  }

  if (e.code !== "Space") return;

  e.preventDefault();

  if (!isRecording) return;

  if (e.repeat) return;

  if (keyHeld) return;

  const now = performance.now();

  if (lastReleaseTime !== null) {
    const gap = now - lastReleaseTime;
    addRestsFromGap(gap);
  }

  keyHeld = true;
  noteStartTime = now;
});

window.addEventListener("keyup", (e) => {
  if (e.code !== "Space") return;

  e.preventDefault();

  if (!isRecording) return;

  if (!keyHeld) return;

  const now = performance.now();

  const durationMs = now - noteStartTime;
  const duration = getNoteDuration(durationMs);

  notes.push(duration);

  log.innerHTML += `
    <p>
      ${notes.length}.
      ${getReadableDuration(duration)}
    </p>
  `;

  keyHeld = false;
  lastReleaseTime = now;
});

document.getElementById("tapTempo").onclick = () => {
  const now = performance.now();

  tapTimes.push(now);

  if (tapTimes.length > 5) {
    tapTimes.shift();
  }

  if (tapTimes.length >= 2) {
    let intervals = [];

    for (let i = 1; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }

    const avgInterval =
      intervals.reduce((a, b) => a + b) / intervals.length;

    bpm = 60000 / avgInterval;

    document.getElementById("bpmDisplay").textContent =
      bpm.toFixed(0);
  }
};

document.getElementById("bpmInput").onchange = (e) => {
  bpm = parseFloat(e.target.value);

  document.getElementById("bpmDisplay").textContent =
    bpm.toFixed(0);
};

document.getElementById("meter").onchange = (e) => {
  meter = e.target.value;
};

const measureInput = document.getElementById("measureCount");

if (measureInput) {
  measureInput.onchange = (e) => {
    measureCount = parseInt(e.target.value);
  };
}

document.getElementById("metronomeBtn").onclick = () => {
  const btn = document.getElementById("metronomeBtn");

  if (metronomeOn) {
    clearInterval(metronomeInterval);
    metronomeOn = false;
    btn.textContent = "Start Metronome";
    return;
  }

  audioCtx.resume();

  metronomeOn = true;
  btn.textContent = "Stop Metronome";

  const interval = 60000 / bpm;

  function click() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.frequency.value = 1000;

    gain.gain.setValueAtTime(
      0.2,
      audioCtx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 0.05
    );

    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  }

  click();

  metronomeInterval =
    setInterval(click, interval);
};

function getNoteDuration(ms) {
  const beatMs = 60000 / bpm;
  const ratio = ms / beatMs;

  if (ratio < 0.30) return "16";
  if (ratio < 0.75) return "8";
  if (ratio < 1.00) return "8d";
  if (ratio < 1.50) return "q";
  if (ratio < 2.25) return "qd";
  if (ratio < 3.50) return "h";
  return "w";
}

function addRestsFromGap(ms) {
  const beatMs = 60000 / bpm;
  let beats = ms / beatMs;

  if (beats < 0.75) return;

  while (beats >= 3.5) {
    notes.push("wr");
    log.innerHTML += `<p>whole rest</p>`;
    beats -= 4;
  }

  while (beats >= 2) {
    notes.push("hr");
    log.innerHTML += `<p>half rest</p>`;
    beats -= 2;
  }

  while (beats >= 1) {
    notes.push("qr");
    log.innerHTML += `<p>quarter rest</p>`;
    beats -= 1;
  }

  while (beats >= 0.5) {
    notes.push("8r");
    log.innerHTML += `<p>eighth rest</p>`;
    beats -= 0.5;
  }
}

function getReadableDuration(duration) {
  if (duration === "16") return "sixteenth";
  if (duration === "8") return "eighth";
  if (duration === "8d") return "dotted eighth";
  if (duration === "q") return "quarter";
  if (duration === "qd") return "dotted quarter";
  if (duration === "h") return "half";
  if (duration === "w") return "whole";

  if (duration === "8r") return "eighth rest";
  if (duration === "qr") return "quarter rest";
  if (duration === "hr") return "half rest";
  if (duration === "wr") return "whole rest";

  return duration;
}

function renderNotation() {
  const notation = document.getElementById("notation");
  notation.innerHTML = "";

  const VF = Vex.Flow;

  const width = measureCount * 300;

  const renderer =
    new VF.Renderer(
      notation,
      VF.Renderer.Backends.SVG
    );

  renderer.resize(width, 260);

  const context = renderer.getContext();

  const stave =
    new VF.Stave(10, 40, width - 40);

  stave
    .addClef("percussion")
    .addTimeSignature(meter)
    .setContext(context)
    .draw();

  const vexNotes = [];

  notes.forEach(duration => {
    let vexDuration = duration;
    let dotted = false;
    let isRest = false;

    if (duration === "8d") {
      vexDuration = "8";
      dotted = true;
    }

    if (duration === "qd") {
      vexDuration = "q";
      dotted = true;
    }

    if (duration === "8r") {
      vexDuration = "8r";
      isRest = true;
    }

    if (duration === "qr") {
      vexDuration = "qr";
      isRest = true;
    }

    if (duration === "hr") {
      vexDuration = "hr";
      isRest = true;
    }

    if (duration === "wr") {
      vexDuration = "wr";
      isRest = true;
    }

    const note =
      new VF.StaveNote({
        clef: "percussion",
        keys: ["b/4"],
        duration: vexDuration
      });

    if (dotted) {
      VF.Dot.buildAndAttach(
        [note],
        { all: true }
      );
    }

    vexNotes.push(note);
  });

  const voice =
    new VF.Voice({
      num_beats: 4,
      beat_value: 4
    });

  voice.setStrict(false);
  voice.addTickables(vexNotes);

  new VF.Formatter()
    .joinVoices([voice])
    .format([voice], width - 120);

  let beams = [];
  let currentGroup = [];

  function isBeamable(note) {
    const d = note.getDuration();
    return d === "8" || d === "16";
  }

  vexNotes.forEach(note => {
    if (isBeamable(note)) {
      currentGroup.push(note);
    } else {
      if (currentGroup.length >= 2) {
        beams.push(new VF.Beam(currentGroup));
      }

      currentGroup = [];
    }
  });

  if (currentGroup.length >= 2) {
    beams.push(new VF.Beam(currentGroup));
  }

  beams.forEach(beam => {
    beam.setContext(context);
  });

  voice.draw(context, stave);

  beams.forEach(beam => {
    beam.draw();
  });
}