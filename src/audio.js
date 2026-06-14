import * as Tone from "tone";

export function createAudioEngine() {
  const master = new Tone.Gain(0.72).toDestination();

  const spaceReverb = new Tone.Reverb({ decay: 8.5, wet: 0.74 }).connect(master);
  const spaceDelay = new Tone.FeedbackDelay({
    delayTime: "8n.",
    feedback: 0.38,
    wet: 0.3,
  }).connect(spaceReverb);
  const space = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5,
    modulationIndex: 5,
    envelope: { attack: 0.02, decay: 0.5, sustain: 0.12, release: 4.5 },
    modulationEnvelope: { attack: 0.08, decay: 0.8, sustain: 0.08, release: 3 },
  }).connect(spaceDelay);
  space.volume.value = -14;

  const waterReverb = new Tone.Reverb({ decay: 10, wet: 0.84 }).connect(master);
  const waterDelay = new Tone.PingPongDelay({
    delayTime: "8n",
    feedback: 0.48,
    wet: 0.54,
  }).connect(waterReverb);
  const water = new Tone.FMSynth({
    harmonicity: 1.414,
    modulationIndex: 2.8,
    oscillator: { type: "sine" },
    envelope: { attack: 0.006, decay: 0.85, sustain: 0.05, release: 5.8 },
    modulation: { type: "sine" },
    modulationEnvelope: { attack: 0.01, decay: 0.55, sustain: 0, release: 3.6 },
  }).connect(waterDelay);
  water.volume.value = -11;

  const gardenReverb = new Tone.Reverb({ decay: 6.5, wet: 0.62 }).connect(master);
  const garden = new Tone.PluckSynth({
    attackNoise: 1.2,
    dampening: 2500,
    resonance: 0.88,
  }).connect(gardenReverb);
  garden.volume.value = -14;

  const windGain = new Tone.Gain(0).connect(gardenReverb);
  const windPan = new Tone.Panner(0).connect(windGain);
  const windFilter = new Tone.Filter({
    frequency: 760,
    type: "bandpass",
    Q: 0.45,
  }).connect(windPan);
  const wind = new Tone.Noise("pink").connect(windFilter);

  return {
    master,
    space,
    spaceDelay,
    water,
    waterDelay,
    waterReverb,
    garden,
    wind,
    windFilter,
    windPan,
    windGain,
    windStarted: false,
    dispose() {
      [
        space,
        spaceDelay,
        spaceReverb,
        water,
        waterDelay,
        waterReverb,
        garden,
        gardenReverb,
        wind,
        windFilter,
        windPan,
        windGain,
        master,
      ].forEach((node) => node.dispose());
    },
  };
}

export async function startAudio(engineRef, enabled) {
  if (!enabled) return null;
  await Tone.start();
  if (!engineRef.current) engineRef.current = createAudioEngine();
  if (!engineRef.current.windStarted) {
    engineRef.current.wind.start();
    engineRef.current.windStarted = true;
  }
  return engineRef.current;
}

export async function playRelease(engineRef, enabled, mode, point, holdMs) {
  const audio = await startAudio(engineRef, enabled);
  if (!audio) return;

  const strength = Math.min(2.2, Math.max(0.45, holdMs / 1400));
  const xRatio = point.x / point.width;
  const yRatio = point.y / point.height;

  if (mode === "cosmos") {
    const notes = ["C4", "D4", "E4", "G4", "A4", "C5", "D5"];
    const note = notes[Math.min(notes.length - 1, Math.floor(xRatio * notes.length))];
    audio.space.triggerAttackRelease(note, holdMs > 700 ? 1.8 + strength : 0.65, Tone.now(), 0.55);
    if (holdMs > 700) {
      audio.space.triggerAttackRelease(["C3", "G3", "D4"], 3.5 + strength, Tone.now() + 0.08, 0.25);
    }
    return;
  }

  if (mode === "liquid") {
    const frequency = 90 + (1 - yRatio) * 220 + xRatio * 45;
    audio.waterReverb.wet.rampTo(Math.min(0.95, 0.64 + strength * 0.12), 0.3);
    audio.waterDelay.feedback.rampTo(Math.min(0.7, 0.32 + strength * 0.14), 0.3);
    audio.water.triggerAttackRelease(frequency, holdMs > 700 ? 1.7 + strength : 0.42, Tone.now(), 0.72);
    audio.water.triggerAttackRelease(frequency * 1.414, 0.7 + strength, Tone.now() + 0.09, 0.34);
    return;
  }

  const notes = ["F3", "G3", "A3", "C4", "D4", "F4", "A4"];
  const note = notes[Math.min(notes.length - 1, Math.floor(xRatio * notes.length))];
  audio.garden.triggerAttack(note, Tone.now());
  if (holdMs > 700) audio.garden.triggerAttack(Tone.Frequency(note).transpose(7), Tone.now() + 0.12);
  audio.windGain.gain.rampTo(0.035 + strength * 0.04, 0.16);
  window.setTimeout(() => audio.windGain.gain.rampTo(0, 1.1 + strength * 0.5), 320);
}

export async function shapeDrag(engineRef, enabled, mode, point) {
  const audio = await startAudio(engineRef, enabled);
  if (!audio) return;

  const force = Math.min(1, Math.hypot(point.dragX, point.dragY) / 180);
  const xRatio = point.x / point.width;
  if (mode === "garden") {
    audio.windFilter.frequency.rampTo(420 + force * 2300, 0.1);
    audio.windFilter.Q.rampTo(0.3 + force * 0.65, 0.1);
    audio.windPan.pan.rampTo((xRatio - 0.5) * 1.5, 0.12);
    audio.windGain.gain.rampTo(0.025 + force * 0.12, 0.12);
  } else if (mode === "liquid") {
    audio.waterDelay.feedback.rampTo(0.35 + force * 0.28, 0.12);
  } else {
    audio.spaceDelay.feedback.rampTo(0.3 + force * 0.22, 0.12);
  }
}

export function settleDrag(engineRef) {
  const audio = engineRef.current;
  if (!audio) return;
  audio.windGain.gain.rampTo(0, 0.65);
  audio.waterDelay.feedback.rampTo(0.46, 0.5);
  audio.spaceDelay.feedback.rampTo(0.38, 0.5);
}
