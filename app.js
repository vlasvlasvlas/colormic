const colorPresetList = [
  "presets/colors/oceanic.yaml",
  "presets/colors/magma.yaml",
];

const ASSET_VERSION = "20260513-2";

const soundPresetList = [
  "presets/sound/ambient_glass.yaml",
  "presets/sound/ritual_echo.yaml",
];

const state = {
  audioCtx: null,
  stream: null,
  input: null,
  analyser: null,
  dryGain: null,
  wetReverbGain: null,
  wetDelayGain: null,
  masterGain: null,
  filter: null,
  compressor: null,
  convolver: null,
  delay: null,
  delayFeedback: null,
  lfoOsc: null,
  lfoDepth: null,
  ringModGain: null,
  ringCarrierOsc: null,
  ringCarrierDepth: null,
  running: false,
  animationId: null,
  color: null,
  sound: null,
  prevSpectrum: null,
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  backgroundMode: "black",
  audioMetrics: {
    rms: 0,
    centroid: 0,
    pitch: 0,
    pitchConfidence: 0,
    pitchNorm: 0,
    voiceFrequency: 0,
    voiceNorm: 0,
    flux: 0,
    noteLabel: "—",
  },
  visual: {
    micSensitivity: 2,
    intensity: 1.2,
    masterVolume: 0.8,
    voiceFloorHz: 60,
    voiceCeilingHz: 4000,
    voiceFloorColor: "#2447ff",
    voiceCeilingColor: "#ffcf4a",
    blend: true,
    bloom: true,
    waveform: true,
  },
  dirty: {
    lastColorEdit: null,
    lastSoundEdit: null,
  },
};

const ui = {
  stage: document.getElementById("stage"),
  settingsToggle: document.getElementById("settingsToggle"),
  closeSidebar: document.getElementById("closeSidebar"),
  sidebar: document.getElementById("sidebar"),
  startMic: document.getElementById("startMic"),
  stopMic: document.getElementById("stopMic"),
  backgroundToggle: document.getElementById("backgroundToggle"),
  helpToggle: document.getElementById("helpToggle"),
  helpModal: document.getElementById("helpModal"),
  applyAll: document.getElementById("applyAll"),
  colorPreset: document.getElementById("colorPreset"),
  soundPreset: document.getElementById("soundPreset"),
  colorYaml: document.getElementById("colorYaml"),
  soundYaml: document.getElementById("soundYaml"),
  micSensitivity: document.getElementById("micSensitivity"),
  micSensitivityValue: document.getElementById("micSensitivityValue"),
  visualIntensity: document.getElementById("visualIntensity"),
  visualIntensityValue: document.getElementById("visualIntensityValue"),
  masterVolume: document.getElementById("masterVolume"),
  masterVolumeValue: document.getElementById("masterVolumeValue"),
  voiceFloorHz: document.getElementById("voiceFloorHz"),
  voiceCeilingHz: document.getElementById("voiceCeilingHz"),
  voiceRangeValue: document.getElementById("voiceRangeValue"),
  voiceFloorColor: document.getElementById("voiceFloorColor"),
  voiceCeilingColor: document.getElementById("voiceCeilingColor"),
  voiceRangePreview: document.getElementById("voiceRangePreview"),
  toggleBlend: document.getElementById("toggleBlend"),
  toggleBloom: document.getElementById("toggleBloom"),
  toggleWaveform: document.getElementById("toggleWaveform"),
  status: document.getElementById("status"),
  mFreq: document.getElementById("mFreq"),
  mNote: document.getElementById("mNote"),
  mVol: document.getElementById("mVol"),
  cInterpolation: document.getElementById("cInterpolation"),
  cEnergyBrightness: document.getElementById("cEnergyBrightness"),
  cEnergyBrightnessValue: document.getElementById("cEnergyBrightnessValue"),
  cCentroidHue: document.getElementById("cCentroidHue"),
  cCentroidHueValue: document.getElementById("cCentroidHueValue"),
  sInputGain: document.getElementById("sInputGain"),
  sInputGainValue: document.getElementById("sInputGainValue"),
  sFilterType: document.getElementById("sFilterType"),
  sFilterFreq: document.getElementById("sFilterFreq"),
  sFilterFreqValue: document.getElementById("sFilterFreqValue"),
  sFilterQ: document.getElementById("sFilterQ"),
  sFilterQValue: document.getElementById("sFilterQValue"),
  sReverbMix: document.getElementById("sReverbMix"),
  sReverbMixValue: document.getElementById("sReverbMixValue"),
  sReverbSeconds: document.getElementById("sReverbSeconds"),
  sReverbSecondsValue: document.getElementById("sReverbSecondsValue"),
  sDelayTime: document.getElementById("sDelayTime"),
  sDelayTimeValue: document.getElementById("sDelayTimeValue"),
  sDelayFeedback: document.getElementById("sDelayFeedback"),
  sDelayFeedbackValue: document.getElementById("sDelayFeedbackValue"),
  sDelayMix: document.getElementById("sDelayMix"),
  sDelayMixValue: document.getElementById("sDelayMixValue"),
  sLfoEnabled: document.getElementById("sLfoEnabled"),
  sLfoTarget: document.getElementById("sLfoTarget"),
  sLfoWaveform: document.getElementById("sLfoWaveform"),
  sLfoFreq: document.getElementById("sLfoFreq"),
  sLfoFreqValue: document.getElementById("sLfoFreqValue"),
  sLfoAmount: document.getElementById("sLfoAmount"),
  sLfoAmountValue: document.getElementById("sLfoAmountValue"),
  sRingModEnabled: document.getElementById("sRingModEnabled"),
  sRingModFreq: document.getElementById("sRingModFreq"),
  sRingModFreqValue: document.getElementById("sRingModFreqValue"),
  tapBtn: document.getElementById("tapBtn"),
  tapSubdiv: document.getElementById("tapSubdiv"),
  tapBpmDisplay: document.getElementById("tapBpmDisplay"),
};

const ctx = ui.stage.getContext("2d");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeCanvas() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  ui.stage.width = Math.floor(state.width * state.dpr);
  ui.stage.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  drawSilence();
}

function setStatus(text) {
  ui.status.textContent = text;
}

function setRunningUi() {
  ui.startMic.textContent = state.running ? "LIVE" : "MIC";
  ui.startMic.classList.toggle("is-running", state.running);
}

function fillPresetSelect(select, paths) {
  select.innerHTML = "";
  for (const path of paths) {
    const option = document.createElement("option");
    option.value = path;
    option.textContent = path.split("/").pop();
    select.appendChild(option);
  }
}

async function fetchText(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${path}${separator}v=${ASSET_VERSION}`);
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`);
  return response.text();
}

function parseYamlText(text, label) {
  try {
    const parsed = jsyaml.load(text);
    if (!parsed || typeof parsed !== "object") throw new Error("YAML vacio");
    return parsed;
  } catch (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

function getBackgroundColor() {
  return state.backgroundMode === "white" ? "#ffffff" : "#000000";
}

function setBackgroundMode(mode) {
  state.backgroundMode = mode;
  document.body.classList.toggle("theme-white", mode === "white");
  document.body.classList.toggle("theme-black", mode === "black");
  drawSilence();
}

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function pitchToNoteName(hz) {
  if (!hz || hz < 20) return "—";
  const midi = Math.round(12 * Math.log2(hz / 440) + 69);
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

function updateLiveControlLabels() {
  const floorHz = Math.round(state.visual.voiceFloorHz);
  const ceilingHz = Math.round(state.visual.voiceCeilingHz);
  ui.micSensitivityValue.textContent = `${state.visual.micSensitivity.toFixed(2)}x`;
  ui.visualIntensityValue.textContent = state.visual.intensity.toFixed(2);
  ui.masterVolumeValue.textContent = `${Math.round(state.visual.masterVolume * 100)}%`;
  ui.voiceRangeValue.textContent = `${floorHz}-${ceilingHz} Hz`;
  ui.voiceRangePreview.style.background = `linear-gradient(90deg, ${state.visual.voiceFloorColor}, ${state.visual.voiceCeilingColor})`;
  ui.voiceFloorHz.value = String(floorHz);
  ui.voiceCeilingHz.value = String(ceilingHz);
  ui.voiceFloorColor.value = state.visual.voiceFloorColor;
  ui.voiceCeilingColor.value = state.visual.voiceCeilingColor;
}

function readVoiceControls() {
  const floorHz = clamp(Number(ui.voiceFloorHz.value) || state.visual.voiceFloorHz, 20, 20000);
  const ceilingHz = clamp(Number(ui.voiceCeilingHz.value) || state.visual.voiceCeilingHz, floorHz + 20, 22000);

  return {
    floor_hz: Math.round(floorHz),
    ceiling_hz: Math.round(ceilingHz),
    floor_color: ui.voiceFloorColor.value || state.visual.voiceFloorColor,
    ceiling_color: ui.voiceCeilingColor.value || state.visual.voiceCeilingColor,
  };
}

function applyVoiceControlsToState() {
  const controls = readVoiceControls();
  state.visual.voiceFloorHz = controls.floor_hz;
  state.visual.voiceCeilingHz = controls.ceiling_hz;
  state.visual.voiceFloorColor = controls.floor_color;
  state.visual.voiceCeilingColor = controls.ceiling_color;
  updateLiveControlLabels();
}

function mergeVoiceControlsIntoColorConfig(cfg) {
  const controls = readVoiceControls();
  return {
    ...cfg,
    voice_range: {
      ...(cfg.voice_range || {}),
      ...controls,
    },
  };
}

function upsertYamlLine(text, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^(\\s*${key}:\\s*).*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, `$1${value}`);
  return `${text.replace(/\s*$/, "")}\n${line}\n`;
}

function patchColorYamlFromControls(text) {
  let next = text;
  if (!/^\s*voice_range:\s*$/m.test(next)) {
    const block = [
      "",
      "# Rango que convierte frecuencia vocal en color.",
      "# floor_hz = piso/grave; ceiling_hz = techo/agudo.",
      "voice_range:",
      "  floor_hz: 60",
      "  ceiling_hz: 4000",
      "  floor_color: \"#2447ff\"",
      "  ceiling_color: \"#ffcf4a\"",
      "",
    ].join("\n");
    next = /^\s*interpolation:\s*.+$/m.test(next)
      ? next.replace(/^(\s*interpolation:\s*.+)$/m, `$1${block}`)
      : `${next.replace(/\s*$/, "")}${block}`;
  }

  const controls = readVoiceControls();
  next = upsertYamlLine(next, "floor_hz", controls.floor_hz);
  next = upsertYamlLine(next, "ceiling_hz", controls.ceiling_hz);
  next = upsertYamlLine(next, "floor_color", `"${controls.floor_color}"`);
  next = upsertYamlLine(next, "ceiling_color", `"${controls.ceiling_color}"`);
  return next;
}

function normalizeVoiceFrequency(frequency) {
  if (!frequency) return 0;
  const minHz = Math.max(20, Number(state.visual.voiceFloorHz) || 60);
  const maxHz = Math.max(minHz + 20, Number(state.visual.voiceCeilingHz) || 4000);
  return clamp(Math.log2(frequency / minHz) / Math.log2(maxHz / minHz), 0, 1);
}

function estimatePitch(timeData, sampleRate, rms) {
  if (rms < 0.012) return { pitch: 0, confidence: 0 };

  const minLag = Math.floor(sampleRate / 900);
  const maxLag = Math.floor(sampleRate / 75);
  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < timeData.length - lag; i += 2) {
      const a = (timeData[i] - 128) / 128;
      const b = (timeData[i + lag] - 128) / 128;
      correlation += a * b;
      normA += a * a;
      normB += b * b;
    }

    const normalized = correlation / (Math.sqrt(normA * normB) || 1);
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < 0.28) return { pitch: 0, confidence: 0 };
  return {
    pitch: sampleRate / bestLag,
    confidence: clamp((bestCorrelation - 0.28) / 0.42, 0, 1),
  };
}

function voiceColorDriver(centroidNorm) {
  return clamp(state.audioMetrics.voiceNorm || centroidNorm, 0, 1);
}

function voiceColorAt(t, energy, pitchNorm) {
  const hsl = chroma
    .interpolate(
      state.visual.voiceFloorColor,
      state.visual.voiceCeilingColor,
      clamp(t, 0, 1),
      state.color.interpolation || "lab"
    )
    .hsl();
  const hue = Number.isFinite(hsl[0]) ? hsl[0] : 0;
  const saturation = clamp((hsl[1] || 0.7) + energy * 0.18, 0, 1);
  const lightness = clamp(
    (hsl[2] || 0.45) +
      energy * state.color.reactivity.energyToBrightness * 0.46 +
      pitchNorm * 0.18,
    0.06,
    0.96
  );

  return chroma.hsl(hue, saturation, lightness);
}

function drawSilence() {
  ctx.save();
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.fillStyle = getBackgroundColor();
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();
}

function applyColorConfig(cfg) {
  const voiceRange = cfg.voice_range || {};
  state.color = {
    name: cfg.name || "Color preset",
    interpolation: ["rgb", "lab", "hsl", "hsv", "hcl"].includes(cfg.interpolation) ? cfg.interpolation : "lab",
    reactivity: {
      energyToBrightness: clamp(Number(cfg.reactivity?.energy_to_brightness ?? 0.7), 0, 1.4),
      centroidToHueShift: clamp(Number(cfg.reactivity?.centroid_to_hue_shift ?? 0.3), 0, 1),
    },
  };

  state.visual.voiceFloorHz = clamp(Number(voiceRange.floor_hz ?? state.visual.voiceFloorHz), 20, 20000);
  state.visual.voiceCeilingHz = clamp(
    Number(voiceRange.ceiling_hz ?? state.visual.voiceCeilingHz),
    state.visual.voiceFloorHz + 20,
    22000
  );
  if (voiceRange.floor_color) state.visual.voiceFloorColor = voiceRange.floor_color;
  if (voiceRange.ceiling_color) state.visual.voiceCeilingColor = voiceRange.ceiling_color;

  updateLiveControlLabels();
  setStatus(`Color: ${state.color.name}`);
  drawSilence();
}

function buildImpulse(audioCtx, seconds = 2.6, decay = 2.4, preDelayMs = 20) {
  const sampleRate = audioCtx.sampleRate;
  const length = Math.floor(sampleRate * seconds);
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const preDelaySamples = Math.floor((preDelayMs / 1000) * sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      if (i < preDelaySamples) {
        data[i] = 0;
        continue;
      }
      const t = (i - preDelaySamples) / Math.max(1, length - preDelaySamples);
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }

  return impulse;
}

function disconnectLfo() {
  if (state.lfoOsc) {
    try {
      state.lfoOsc.stop();
    } catch (_) {
      /* already stopped */
    }
    state.lfoOsc.disconnect();
  }
  if (state.lfoDepth) state.lfoDepth.disconnect();
  state.lfoOsc = null;
  state.lfoDepth = null;
}

function getLfoTarget(target) {
  if (target === "master_gain") return state.masterGain?.gain || null;
  return state.filter?.frequency || null;
}

function applySoundConfig(cfg) {
  state.sound = cfg;

  if (!state.audioCtx || !state.input || !state.masterGain) {
    setStatus(`Sound: ${cfg.name || "preset"}`);
    return;
  }

  const now = state.audioCtx.currentTime;
  const filter = cfg.filter || {};
  const compressor = cfg.compressor || {};
  const reverb = cfg.reverb || {};
  const delay = cfg.delay || {};

  state.input.gain.setTargetAtTime(clamp(Number(cfg.input_gain ?? 1), 0, 2), now, 0.02);
  // master_gain from YAML is the preset baseline; slider multiplies it
  const yamlMaster = clamp(Number(cfg.master_gain ?? 0.8), 0, 2);
  state.masterGain.gain.setTargetAtTime(yamlMaster * state.visual.masterVolume, now, 0.02);
  state.filter.type = filter.type || "lowpass";
  state.filter.frequency.setTargetAtTime(clamp(Number(filter.frequency ?? 6200), 40, 18000), now, 0.04);
  state.filter.Q.setTargetAtTime(clamp(Number(filter.q ?? 0.7), 0.001, 30), now, 0.04);

  state.compressor.threshold.setTargetAtTime(clamp(Number(compressor.threshold ?? -24), -100, 0), now, 0.02);
  state.compressor.knee.setTargetAtTime(clamp(Number(compressor.knee ?? 20), 0, 40), now, 0.02);
  state.compressor.ratio.setTargetAtTime(clamp(Number(compressor.ratio ?? 4), 1, 20), now, 0.02);
  state.compressor.attack.setTargetAtTime(clamp(Number(compressor.attack ?? 0.01), 0, 1), now, 0.02);
  state.compressor.release.setTargetAtTime(clamp(Number(compressor.release ?? 0.3), 0, 1), now, 0.02);

  state.convolver.buffer = buildImpulse(
    state.audioCtx,
    clamp(Number(reverb.seconds ?? 2.8), 0.2, 12),
    clamp(Number(reverb.decay ?? 2.4), 0.2, 8),
    clamp(Number(reverb.pre_delay_ms ?? 24), 0, 300)
  );
  state.wetReverbGain.gain.setTargetAtTime(clamp(Number(reverb.mix ?? 0.35), 0, 1), now, 0.04);
  state.delay.delayTime.setTargetAtTime(clamp(Number(delay.time_s ?? 0.35), 0.01, 1.5), now, 0.04);
  state.delayFeedback.gain.setTargetAtTime(clamp(Number(delay.feedback ?? 0.32), 0, 0.95), now, 0.04);
  state.wetDelayGain.gain.setTargetAtTime(clamp(Number(delay.mix ?? 0.24), 0, 1), now, 0.04);

  disconnectLfo();
  if (cfg.lfo?.enabled) {
    const target = getLfoTarget(String(cfg.lfo.target || "filter.frequency"));
    if (target) {
      const osc = state.audioCtx.createOscillator();
      const depth = state.audioCtx.createGain();
      osc.type = cfg.lfo.waveform || "sine";
      osc.frequency.value = clamp(Number(cfg.lfo.frequency_hz ?? 0.1), 0.01, 20);
      depth.gain.value = clamp(Number(cfg.lfo.amount ?? 200), 0, 5000);
      osc.connect(depth);
      depth.connect(target);
      osc.start();
      state.lfoOsc = osc;
      state.lfoDepth = depth;
    }
  }

  setStatus(`Sound: ${cfg.name || "preset"}`);
}

async function applyEditors() {
  let colorCfg;
  if (state.dirty.lastColorEdit === "yaml") {
    colorCfg = parseYamlText(ui.colorYaml.value, "Color YAML");
    populateColorControls(colorCfg);
  } else {
    colorCfg = readColorControls();
  }
  let soundCfg;
  if (state.dirty.lastSoundEdit === "yaml") {
    soundCfg = parseYamlText(ui.soundYaml.value, "Sound YAML");
    populateSoundControls(soundCfg);
  } else {
    soundCfg = readSoundControls();
  }
  applyColorConfig(colorCfg);
  applySoundConfig(soundCfg);
  state.dirty.lastColorEdit = null;
  state.dirty.lastSoundEdit = null;
}

async function initAudio() {
  if (state.running) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("AudioContext no disponible");
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia no disponible");

  await applyEditors();

  state.audioCtx = new AudioContextClass();
  state.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

  const source = state.audioCtx.createMediaStreamSource(state.stream);
  const input = state.audioCtx.createGain();
  const filter = state.audioCtx.createBiquadFilter();
  const compressor = state.audioCtx.createDynamicsCompressor();
  const analyser = state.audioCtx.createAnalyser();
  const convolver = state.audioCtx.createConvolver();
  const delay = state.audioCtx.createDelay(2);
  const delayFeedback = state.audioCtx.createGain();
  const wetReverbGain = state.audioCtx.createGain();
  const wetDelayGain = state.audioCtx.createGain();
  const dryGain = state.audioCtx.createGain();
  const masterGain = state.audioCtx.createGain();

  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  dryGain.gain.value = 0.86;

  source.connect(input);
  input.connect(filter);
  filter.connect(compressor);
  const ringModGain = state.audioCtx.createGain();
  const ringCarrierOsc = state.audioCtx.createOscillator();
  const ringCarrierDepth = state.audioCtx.createGain();
  ringModGain.gain.value = 1;
  ringCarrierDepth.gain.value = 0;
  ringCarrierOsc.frequency.value = +(ui.sRingModFreq?.value || 80);
  ringCarrierOsc.connect(ringCarrierDepth);
  ringCarrierDepth.connect(ringModGain.gain);
  ringCarrierOsc.start();
  compressor.connect(ringModGain);
  ringModGain.connect(dryGain);
  ringModGain.connect(convolver);
  ringModGain.connect(delay);
  convolver.connect(wetReverbGain);
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);
  delay.connect(wetDelayGain);
  dryGain.connect(masterGain);
  wetReverbGain.connect(masterGain);
  wetDelayGain.connect(masterGain);
  masterGain.connect(analyser);
  masterGain.connect(state.audioCtx.destination);

  Object.assign(state, {
    input,
    filter,
    compressor,
    analyser,
    convolver,
    delay,
    delayFeedback,
    wetReverbGain,
    wetDelayGain,
    dryGain,
    masterGain,
    ringModGain,
    ringCarrierOsc,
    ringCarrierDepth,
    prevSpectrum: new Uint8Array(analyser.frequencyBinCount),
    running: true,
  });

  applySoundConfig(state.sound || {});
  setRunningUi();
  renderLoop();
}

async function stopAudio() {
  if (!state.running) return;
  cancelAnimationFrame(state.animationId);
  disconnectLfo();
  if (state.ringCarrierOsc) { try { state.ringCarrierOsc.stop(); } catch (_) {} state.ringCarrierOsc.disconnect(); }
  for (const track of state.stream?.getTracks() || []) track.stop();
  if (state.audioCtx) await state.audioCtx.close();
  Object.assign(state, { audioCtx: null, stream: null, input: null, analyser: null, ringModGain: null, ringCarrierOsc: null, ringCarrierDepth: null, running: false });
  setRunningUi();
  setStatus("Stopped");
  drawSilence();
}

function computeMetrics(freqData, timeData, sampleRate) {
  let sumSq = 0;
  for (let i = 0; i < timeData.length; i++) {
    const sample = (timeData[i] - 128) / 128;
    sumSq += sample * sample;
  }

  let weighted = 0;
  let magSum = 0;
  for (let i = 0; i < freqData.length; i++) {
    const mag = freqData[i] / 255;
    const frequency = (i * sampleRate) / (2 * freqData.length);
    weighted += frequency * mag;
    magSum += mag;
  }

  let fluxAcc = 0;
  for (let i = 0; i < freqData.length; i++) {
    fluxAcc += Math.max(0, freqData[i] - state.prevSpectrum[i]);
    state.prevSpectrum[i] = freqData[i];
  }

  const rms = Math.sqrt(sumSq / timeData.length);
  const pitchEstimate = estimatePitch(timeData, sampleRate, rms);
  const detectedPitchNorm = normalizeVoiceFrequency(pitchEstimate.pitch);
  const centroid = magSum > 0 ? weighted / magSum : 0;
  const centroidInfluence = clamp(state.color.reactivity.centroidToHueShift, 0, 1);
  const pitchMix = clamp(pitchEstimate.confidence * (0.85 - centroidInfluence * 0.45), 0, 0.85);
  const voiceFrequency = pitchEstimate.pitch > 0
    ? pitchEstimate.pitch * pitchMix + centroid * (1 - pitchMix)
    : centroid;
  const detectedVoiceNorm = normalizeVoiceFrequency(voiceFrequency);

  state.audioMetrics.rms = rms;
  state.audioMetrics.centroid = centroid;
  state.audioMetrics.pitch = pitchEstimate.pitch;
  state.audioMetrics.pitchConfidence = pitchEstimate.confidence;
  state.audioMetrics.pitchNorm = pitchEstimate.confidence > 0
    ? state.audioMetrics.pitchNorm * 0.25 + detectedPitchNorm * 0.75
    : state.audioMetrics.pitchNorm * 0.85;
  state.audioMetrics.voiceFrequency = voiceFrequency;
  state.audioMetrics.voiceNorm = rms > 0.01
    ? state.audioMetrics.voiceNorm * 0.25 + detectedVoiceNorm * 0.75
    : state.audioMetrics.voiceNorm * 0.85;
  state.audioMetrics.flux = fluxAcc / (freqData.length * 255);
}

// ── Sharp spectrum bars: each bar colored by its own freq position ──────────
function drawSpectrumBars(freqData, energy, colorDriver) {
  const isBlack = state.backgroundMode === "black";
  const binCount = freqData.length;
  // Use log scale: covers bass to highs naturally
  const barCount = Math.min(128, Math.floor(state.width / 4));
  const barW = state.width / barCount;
  const maxH = state.height * 0.72;

  ctx.save();
  ctx.globalCompositeOperation = isBlack ? "screen" : "multiply";

  for (let i = 0; i < barCount; i++) {
    // Log-mapped bin index: emphasizes voice range (bass heavier)
    const logT = Math.pow(i / barCount, 1.6);
    const bin = Math.floor(logT * binCount * 0.82);
    const mag = freqData[bin] / 255;
    if (mag < 0.015) continue;

    const freqT = i / barCount; // color by position in bar range
    const color = voiceColorAt(freqT, energy, colorDriver);
    const barH = Math.pow(mag, 0.7) * maxH * state.visual.intensity;
    const x = i * barW;
    const y = state.height - barH;

    ctx.globalAlpha = clamp(mag * 0.95, 0.05, 1);
    ctx.fillStyle = color.hex();
    ctx.fillRect(x, y, barW - 1, barH);
  }
  ctx.restore();
}

// ── Dominant-frequency indicator: vertical line at colorDriver position ──────
function drawFreqLine(energy, colorDriver) {
  if (energy < 0.025) return;
  const isBlack = state.backgroundMode === "black";
  const x = Math.round(colorDriver * state.width);
  const color = voiceColorAt(colorDriver, energy, colorDriver);

  ctx.save();
  ctx.globalCompositeOperation = isBlack ? "screen" : "multiply";
  ctx.globalAlpha = clamp(energy * state.visual.intensity * 0.85, 0, 1);
  ctx.strokeStyle = color.hex();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, state.height);
  ctx.stroke();
  ctx.restore();
}

// ── Crisp waveform: pixel-resolution, thin, sharp ───────────────────────────
function drawSharpWave(timeData, energy, colorDriver) {
  if (energy < 0.015) return;
  const isBlack = state.backgroundMode === "black";
  const midY = state.height * 0.5;
  const amp = state.height * (0.06 + energy * 0.3) * state.visual.intensity;
  const color = voiceColorAt(colorDriver, energy, colorDriver);

  ctx.save();
  ctx.globalCompositeOperation = isBlack ? "screen" : "multiply";
  ctx.strokeStyle = color.hex();
  ctx.lineWidth = clamp(1 + energy * 2, 1, 3);
  ctx.globalAlpha = clamp(0.5 + energy * 0.5, 0, 1);
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.beginPath();

  for (let x = 0; x < state.width; x++) {
    const idx = Math.floor((x / state.width) * (timeData.length - 1));
    const normalized = (timeData[idx] - 128) / 128;
    const y = midY + normalized * amp;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawVisual(freqData, timeData) {
  const sensitivity = state.visual.micSensitivity;
  const energy = clamp(state.audioMetrics.rms * 2.5 * sensitivity, 0, 1);
  const centroidNorm = clamp(state.audioMetrics.centroid / 6500, 0, 1);
  const colorDriver = voiceColorDriver(centroidNorm);

  // Clear with a very fast fade (not full black) to leave a crisp trail
  const trailAlpha = clamp(0.55 + energy * 0.35, 0.55, 0.92);
  ctx.save();
  ctx.globalAlpha = trailAlpha;
  ctx.fillStyle = getBackgroundColor();
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();

  if (energy < 0.012 && state.audioMetrics.flux * sensitivity < 0.006) return;

  // Solid color flash: direct mapping of current freq → background tint
  if (state.visual.blend) {
    const flashColor = voiceColorAt(colorDriver, energy, colorDriver);
    ctx.save();
    ctx.globalCompositeOperation = state.backgroundMode === "black" ? "screen" : "multiply";
    ctx.globalAlpha = clamp(energy * 0.28 * state.visual.intensity, 0, 0.45);
    ctx.fillStyle = flashColor.hex();
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();
  }

  // Sharp spectrum EQ bars
  if (state.visual.bloom) drawSpectrumBars(freqData, energy, colorDriver);

  // Dominant frequency line
  drawFreqLine(energy, colorDriver);

  // Crisp waveform
  if (state.visual.waveform) drawSharpWave(timeData, energy, colorDriver);
}

function updateMetricsUi() {
  const freqHz = state.audioMetrics.pitchConfidence > 0.08
    ? state.audioMetrics.pitch
    : state.audioMetrics.voiceFrequency;
  ui.mFreq.textContent = `${Math.round(freqHz)} Hz`;
  ui.mNote.textContent = state.audioMetrics.pitchConfidence > 0.08
    ? pitchToNoteName(state.audioMetrics.pitch)
    : "—";
  const volPct = Math.round(clamp(state.audioMetrics.rms * 6, 0, 1) * 100);
  ui.mVol.textContent = `${volPct}%`;
}

function renderLoop() {
  if (!state.running || !state.analyser || !state.color) return;

  const freqData = new Uint8Array(state.analyser.frequencyBinCount);
  const timeData = new Uint8Array(state.analyser.fftSize);
  state.analyser.getByteFrequencyData(freqData);
  state.analyser.getByteTimeDomainData(timeData);

  computeMetrics(freqData, timeData, state.audioCtx.sampleRate);
  drawVisual(freqData, timeData);
  updateMetricsUi();

  state.animationId = requestAnimationFrame(renderLoop);
}

// ── Control readers ──────────────────────────────────────────────────────────
function readSoundControls() {
  return {
    name: "Custom",
    input_gain: +ui.sInputGain.value,
    master_gain: state.visual.masterVolume,
    filter: { type: ui.sFilterType.value, frequency: +ui.sFilterFreq.value, q: +ui.sFilterQ.value },
    compressor: { threshold: -24, knee: 20, ratio: 4, attack: 0.01, release: 0.3 },
    reverb: { seconds: +ui.sReverbSeconds.value, decay: 2.4, pre_delay_ms: 24, mix: +ui.sReverbMix.value },
    delay: { time_s: +ui.sDelayTime.value, feedback: +ui.sDelayFeedback.value, mix: +ui.sDelayMix.value },
    lfo: { enabled: ui.sLfoEnabled.checked, target: ui.sLfoTarget.value, waveform: ui.sLfoWaveform.value, frequency_hz: +ui.sLfoFreq.value, amount: +ui.sLfoAmount.value },
  };
}

function readColorControls() {
  return {
    name: "Custom",
    interpolation: ui.cInterpolation.value,
    reactivity: { energy_to_brightness: +ui.cEnergyBrightness.value, centroid_to_hue_shift: +ui.cCentroidHue.value },
    voice_range: readVoiceControls(),
  };
}

function populateSoundControls(cfg) {
  ui.sInputGain.value = cfg.input_gain ?? 1;
  ui.sFilterType.value = cfg.filter?.type ?? "lowpass";
  ui.sFilterFreq.value = cfg.filter?.frequency ?? 6200;
  ui.sFilterQ.value = cfg.filter?.q ?? 0.7;
  ui.sReverbMix.value = cfg.reverb?.mix ?? 0.35;
  ui.sReverbSeconds.value = cfg.reverb?.seconds ?? 2.8;
  ui.sDelayTime.value = cfg.delay?.time_s ?? 0.35;
  ui.sDelayFeedback.value = cfg.delay?.feedback ?? 0.32;
  ui.sDelayMix.value = cfg.delay?.mix ?? 0.24;
  ui.sLfoEnabled.checked = cfg.lfo?.enabled ?? false;
  ui.sLfoTarget.value = cfg.lfo?.target ?? "filter.frequency";
  ui.sLfoWaveform.value = cfg.lfo?.waveform ?? "sine";
  ui.sLfoFreq.value = cfg.lfo?.frequency_hz ?? 0.1;
  ui.sLfoAmount.value = cfg.lfo?.amount ?? 200;
  updateSoundLabels();
}

function populateColorControls(cfg) {
  ui.cInterpolation.value = cfg.interpolation ?? "lab";
  ui.cEnergyBrightness.value = cfg.reactivity?.energy_to_brightness ?? 0.7;
  ui.cCentroidHue.value = cfg.reactivity?.centroid_to_hue_shift ?? 0.3;
  const vr = cfg.voice_range || {};
  if (vr.floor_hz) ui.voiceFloorHz.value = vr.floor_hz;
  if (vr.ceiling_hz) ui.voiceCeilingHz.value = vr.ceiling_hz;
  if (vr.floor_color) ui.voiceFloorColor.value = vr.floor_color;
  if (vr.ceiling_color) ui.voiceCeilingColor.value = vr.ceiling_color;
  updateColorLabels();
  updateLiveControlLabels();
}

function updateSoundLabels() {
  ui.sInputGainValue.textContent = (+ui.sInputGain.value).toFixed(2);
  ui.sFilterFreqValue.textContent = `${Math.round(ui.sFilterFreq.value)} Hz`;
  ui.sFilterQValue.textContent = (+ui.sFilterQ.value).toFixed(1);
  ui.sReverbMixValue.textContent = (+ui.sReverbMix.value).toFixed(2);
  ui.sReverbSecondsValue.textContent = `${(+ui.sReverbSeconds.value).toFixed(1)}s`;
  ui.sDelayTimeValue.textContent = `${(+ui.sDelayTime.value).toFixed(2)}s`;
  ui.sDelayFeedbackValue.textContent = (+ui.sDelayFeedback.value).toFixed(2);
  ui.sDelayMixValue.textContent = (+ui.sDelayMix.value).toFixed(2);
  ui.sLfoFreqValue.textContent = `${(+ui.sLfoFreq.value).toFixed(2)} Hz`;
  ui.sLfoAmountValue.textContent = Math.round(ui.sLfoAmount.value);
  ui.sRingModFreqValue.textContent = `${Math.round(ui.sRingModFreq.value)} Hz`;
}

function updateColorLabels() {
  ui.cEnergyBrightnessValue.textContent = (+ui.cEnergyBrightness.value).toFixed(2);
  ui.cCentroidHueValue.textContent = (+ui.cCentroidHue.value).toFixed(2);
}

function generateSoundYaml(cfg) {
  return `name: ${cfg.name}\ninput_gain: ${cfg.input_gain}\nmaster_gain: ${cfg.master_gain}\n\nfilter:\n  type: ${cfg.filter.type}\n  frequency: ${cfg.filter.frequency}\n  q: ${cfg.filter.q}\n\ncompressor:\n  threshold: ${cfg.compressor.threshold}\n  knee: ${cfg.compressor.knee}\n  ratio: ${cfg.compressor.ratio}\n  attack: ${cfg.compressor.attack}\n  release: ${cfg.compressor.release}\n\nreverb:\n  seconds: ${cfg.reverb.seconds}\n  decay: ${cfg.reverb.decay}\n  pre_delay_ms: ${cfg.reverb.pre_delay_ms}\n  mix: ${cfg.reverb.mix}\n\ndelay:\n  time_s: ${cfg.delay.time_s}\n  feedback: ${cfg.delay.feedback}\n  mix: ${cfg.delay.mix}\n\nlfo:\n  enabled: ${cfg.lfo.enabled}\n  target: ${cfg.lfo.target}\n  waveform: ${cfg.lfo.waveform}\n  frequency_hz: ${cfg.lfo.frequency_hz}\n  amount: ${cfg.lfo.amount}\n`;
}

function generateColorYaml(cfg) {
  const vr = cfg.voice_range;
  return `name: ${cfg.name}\ninterpolation: ${cfg.interpolation}\n\nreactivity:\n  energy_to_brightness: ${cfg.reactivity.energy_to_brightness}\n  centroid_to_hue_shift: ${cfg.reactivity.centroid_to_hue_shift}\n\nvoice_range:\n  floor_hz: ${vr.floor_hz}\n  ceiling_hz: ${vr.ceiling_hz}\n  floor_color: "${vr.floor_color}"\n  ceiling_color: "${vr.ceiling_color}"\n`;
}

// ── Tap tempo ────────────────────────────────────────────────────────────────
const tapTimes = [];
let tapResetTimer = null;
function handleTap() {
  const now = performance.now();
  tapTimes.push(now);
  if (tapTimes.length > 8) tapTimes.shift();
  clearTimeout(tapResetTimer);
  tapResetTimer = setTimeout(() => { tapTimes.length = 0; ui.tapBpmDisplay.textContent = "—"; }, 2500);
  if (tapTimes.length < 2) { ui.tapBpmDisplay.textContent = "…"; return; }
  let sum = 0;
  for (let i = 1; i < tapTimes.length; i++) sum += tapTimes[i] - tapTimes[i - 1];
  const bpm = 60000 / (sum / (tapTimes.length - 1));
  const subdivMap = { "1/1": 1, "1/2": 0.5, "1/4": 0.25, "1/8": 0.125, "1/16": 0.0625 };
  const delayTime = clamp((60 / bpm) * (subdivMap[ui.tapSubdiv.value] || 0.25), 0.01, 1.5);
  ui.sDelayTime.value = delayTime.toFixed(3);
  ui.sDelayTimeValue.textContent = `${delayTime.toFixed(2)}s`;
  ui.tapBpmDisplay.textContent = `${Math.round(bpm)} BPM`;
  if (state.delay) state.delay.delayTime.setTargetAtTime(delayTime, state.audioCtx.currentTime, 0.04);
}

// ── Ring modulator ───────────────────────────────────────────────────────────
function applyRingMod() {
  if (!state.ringModGain) return;
  const on = ui.sRingModEnabled.checked;
  const freq = +ui.sRingModFreq.value;
  ui.sRingModFreqValue.textContent = `${freq} Hz`;
  const t = state.audioCtx.currentTime;
  state.ringCarrierOsc.frequency.setTargetAtTime(freq, t, 0.02);
  state.ringModGain.gain.setTargetAtTime(on ? 0 : 1, t, 0.02);
  state.ringCarrierDepth.gain.setTargetAtTime(on ? 1 : 0, t, 0.02);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  resizeCanvas();
  fillPresetSelect(ui.colorPreset, colorPresetList);
  fillPresetSelect(ui.soundPreset, soundPresetList);

  const colorText = await fetchText(colorPresetList[0]);
  const soundText = await fetchText(soundPresetList[0]);
  ui.colorYaml.value = colorText;
  ui.soundYaml.value = soundText;
  const colorCfg = parseYamlText(colorText, "Color YAML");
  const soundCfg = parseYamlText(soundText, "Sound YAML");
  populateColorControls(colorCfg);
  populateSoundControls(soundCfg);
  applyColorConfig(colorCfg);
  applySoundConfig(soundCfg);
  updateSoundLabels();

  ui.settingsToggle.addEventListener("click", () => ui.sidebar.classList.add("is-open"));
  ui.closeSidebar.addEventListener("click", () => ui.sidebar.classList.remove("is-open"));
  ui.backgroundToggle.addEventListener("click", () => setBackgroundMode(state.backgroundMode === "black" ? "white" : "black"));
  ui.helpToggle.addEventListener("click", () => ui.helpModal.showModal());
  ui.startMic.addEventListener("click", async () => {
    try { if (state.running) await stopAudio(); else await initAudio(); }
    catch (e) { setStatus(e.message); setRunningUi(); }
  });
  ui.stopMic.addEventListener("click", stopAudio);
  ui.applyAll.addEventListener("click", async () => { try { await applyEditors(); } catch (e) { setStatus(e.message); } });

  ui.colorPreset.addEventListener("change", async () => {
    const text = await fetchText(ui.colorPreset.value);
    ui.colorYaml.value = text;
    const cfg = parseYamlText(text, "Color YAML");
    populateColorControls(cfg);
    applyColorConfig(cfg);
    state.dirty.lastColorEdit = null;
  });
  ui.soundPreset.addEventListener("change", async () => {
    const text = await fetchText(ui.soundPreset.value);
    ui.soundYaml.value = text;
    const cfg = parseYamlText(text, "Sound YAML");
    populateSoundControls(cfg);
    applySoundConfig(cfg);
    state.dirty.lastSoundEdit = null;
  });

  document.getElementById("colorYamlDetails").addEventListener("toggle", function () {
    if (this.open) ui.colorYaml.value = generateColorYaml(readColorControls());
  });
  document.getElementById("soundYamlDetails").addEventListener("toggle", function () {
    if (this.open) ui.soundYaml.value = generateSoundYaml(readSoundControls());
  });
  ui.colorYaml.addEventListener("input", () => { state.dirty.lastColorEdit = "yaml"; });
  ui.soundYaml.addEventListener("input", () => { state.dirty.lastSoundEdit = "yaml"; });

  // Visual controls
  ui.micSensitivity.addEventListener("input", () => { state.visual.micSensitivity = +ui.micSensitivity.value; updateLiveControlLabels(); });
  ui.visualIntensity.addEventListener("input", () => { state.visual.intensity = +ui.visualIntensity.value; updateLiveControlLabels(); });
  ui.masterVolume.addEventListener("input", () => {
    state.visual.masterVolume = +ui.masterVolume.value;
    updateLiveControlLabels();
    if (state.masterGain) state.masterGain.gain.setTargetAtTime(state.visual.masterVolume, state.audioCtx.currentTime, 0.02);
  });
  ui.cInterpolation.addEventListener("change", () => { state.dirty.lastColorEdit = "controls"; if (state.running) applyColorConfig(readColorControls()); });
  ui.cEnergyBrightness.addEventListener("input", () => { updateColorLabels(); state.dirty.lastColorEdit = "controls"; if (state.running) applyColorConfig(readColorControls()); });
  ui.cCentroidHue.addEventListener("input", () => { updateColorLabels(); state.dirty.lastColorEdit = "controls"; if (state.running) applyColorConfig(readColorControls()); });
  ui.voiceFloorColor.addEventListener("input", () => { state.dirty.lastColorEdit = "controls"; applyVoiceControlsToState(); if (!state.running) drawSilence(); });
  ui.voiceCeilingColor.addEventListener("input", () => { state.dirty.lastColorEdit = "controls"; applyVoiceControlsToState(); if (!state.running) drawSilence(); });
  ui.voiceFloorHz.addEventListener("change", () => { state.dirty.lastColorEdit = "controls"; applyVoiceControlsToState(); if (!state.running) drawSilence(); });
  ui.voiceFloorHz.addEventListener("input", () => { state.dirty.lastColorEdit = "controls"; });
  ui.voiceCeilingHz.addEventListener("change", () => { state.dirty.lastColorEdit = "controls"; applyVoiceControlsToState(); if (!state.running) drawSilence(); });
  ui.voiceCeilingHz.addEventListener("input", () => { state.dirty.lastColorEdit = "controls"; });
  ui.toggleBlend.addEventListener("change", () => { state.visual.blend = ui.toggleBlend.checked; if (!state.running) drawSilence(); });
  ui.toggleBloom.addEventListener("change", () => { state.visual.bloom = ui.toggleBloom.checked; if (!state.running) drawSilence(); });
  ui.toggleWaveform.addEventListener("change", () => { state.visual.waveform = ui.toggleWaveform.checked; if (!state.running) drawSilence(); });

  // Sound controls — real-time apply when running
  function onSoundControl() {
    updateSoundLabels();
    state.dirty.lastSoundEdit = "controls";
    if (state.running) applySoundConfig(readSoundControls());
  }
  [ui.sInputGain, ui.sFilterFreq, ui.sFilterQ, ui.sReverbMix, ui.sReverbSeconds,
    ui.sDelayTime, ui.sDelayFeedback, ui.sDelayMix, ui.sLfoFreq, ui.sLfoAmount
  ].forEach(el => el.addEventListener("input", onSoundControl));
  [ui.sFilterType, ui.sLfoEnabled, ui.sLfoTarget, ui.sLfoWaveform
  ].forEach(el => el.addEventListener("change", onSoundControl));

  // Ring mod
  ui.sRingModEnabled.addEventListener("change", () => applyRingMod());
  ui.sRingModFreq.addEventListener("input", () => applyRingMod());

  // Tap tempo
  ui.tapBtn.addEventListener("click", handleTap);

  window.addEventListener("resize", resizeCanvas);
}

bootstrap().catch((error) => setStatus(error.message));

async function fetchText(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${path}${separator}v=${ASSET_VERSION}`);
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`);
  return response.text();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
