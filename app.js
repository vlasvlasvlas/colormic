const colorPresetList = [
  "presets/colors/oceanic.yaml",
  "presets/colors/magma.yaml",
];

const ASSET_VERSION = "20260512-7";

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
  },
  visual: {
    micSensitivity: 2,
    intensity: 1.2,
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
  mRms: document.getElementById("mRms"),
  mCentroid: document.getElementById("mCentroid"),
  mPitch: document.getElementById("mPitch"),
  mFlux: document.getElementById("mFlux"),
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

function updateLiveControlLabels() {
  const floorHz = Math.round(state.visual.voiceFloorHz);
  const ceilingHz = Math.round(state.visual.voiceCeilingHz);
  ui.micSensitivityValue.textContent = `${state.visual.micSensitivity.toFixed(2)}x`;
  ui.visualIntensityValue.textContent = state.visual.intensity.toFixed(2);
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
  state.masterGain.gain.setTargetAtTime(clamp(Number(cfg.master_gain ?? 0.8), 0, 2), now, 0.02);
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
  let colorText = ui.colorYaml.value;
  let colorConfig = parseYamlText(colorText, "Color YAML");

  if (state.dirty.lastColorEdit === "controls") {
    colorText = patchColorYamlFromControls(colorText);
    ui.colorYaml.value = colorText;
    colorConfig = mergeVoiceControlsIntoColorConfig(parseYamlText(colorText, "Color YAML"));
  }

  applyColorConfig(colorConfig);
  applySoundConfig(parseYamlText(ui.soundYaml.value, "Sound YAML"));
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

  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  dryGain.gain.value = 0.86;

  source.connect(input);
  input.connect(filter);
  filter.connect(compressor);
  compressor.connect(dryGain);
  compressor.connect(convolver);
  compressor.connect(delay);
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
  for (const track of state.stream?.getTracks() || []) track.stop();
  if (state.audioCtx) await state.audioCtx.close();

  Object.assign(state, {
    audioCtx: null,
    stream: null,
    input: null,
    analyser: null,
    running: false,
  });

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
    ? state.audioMetrics.pitchNorm * 0.68 + detectedPitchNorm * 0.32
    : state.audioMetrics.pitchNorm * 0.96;
  state.audioMetrics.voiceFrequency = voiceFrequency;
  state.audioMetrics.voiceNorm = rms > 0.01
    ? state.audioMetrics.voiceNorm * 0.68 + detectedVoiceNorm * 0.32
    : state.audioMetrics.voiceNorm * 0.96;
  state.audioMetrics.flux = fluxAcc / (freqData.length * 255);
}

function drawVoiceWash(energy, colorDriver) {
  ctx.save();
  ctx.globalCompositeOperation = state.backgroundMode === "black" ? "screen" : "multiply";

  const gradient = ctx.createLinearGradient(0, 0, state.width, state.height);
  gradient.addColorStop(0, voiceColorAt(colorDriver - 0.22, energy, colorDriver).hex());
  gradient.addColorStop(0.48, voiceColorAt(colorDriver, energy, colorDriver).hex());
  gradient.addColorStop(1, voiceColorAt(colorDriver + 0.28, energy, colorDriver).hex());

  ctx.globalAlpha = clamp((0.18 + energy * 0.7) * state.visual.intensity, 0, 0.92);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();
}

function drawColorBlend(freqData, energy, centroidNorm, colorDriver) {
  const mode = state.backgroundMode === "black" ? "screen" : "multiply";
  const time = performance.now() * 0.00028;
  const layers = 7;

  ctx.save();
  ctx.globalCompositeOperation = mode;

  for (let i = 0; i < layers; i++) {
    const bin = Math.floor((i / layers) * (freqData.length - 1));
    const band = freqData[bin] / 255;
    const orbit = time + i * 1.37 + colorDriver * 3.6 + centroidNorm * 0.7;
    const x = state.width * (0.5 + Math.cos(orbit) * (0.16 + band * 0.24));
    const y = state.height * (0.5 + Math.sin(orbit * 1.23) * (0.14 + energy * 0.2));
    const radius = Math.max(state.width, state.height) * (0.34 + energy * 0.52 + band * 0.24);
    const hueT = (colorDriver + i / layers * 0.42 + band * 0.18 + time * 0.08) % 1;
    const color = voiceColorAt(hueT, energy, colorDriver).hex();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, color);
    gradient.addColorStop(0.48, color);
    gradient.addColorStop(1, "transparent");

    ctx.globalAlpha = clamp((0.12 + band * 0.42 + energy * 0.28) * state.visual.intensity, 0, 0.72);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  const wash = ctx.createLinearGradient(0, state.height, state.width, 0);
  const washStops = 5;
  for (let i = 0; i < washStops; i++) {
    const stop = i / (washStops - 1);
    const t = stop * 0.65 + colorDriver * 0.35;
    wash.addColorStop(stop, voiceColorAt(t, energy, colorDriver).hex());
  }
  ctx.globalAlpha = clamp((0.08 + energy * 0.42) * state.visual.intensity, 0, 0.58);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();
}

function drawBloom(freqData, energy, centroidNorm, colorDriver) {
  const cx = state.width * (0.18 + colorDriver * 0.64);
  const cy = state.height * (0.5 + Math.sin(performance.now() * 0.0006) * 0.22);
  const maxRadius = Math.max(state.width, state.height) * (0.18 + energy * 0.72);

  ctx.save();
  ctx.globalCompositeOperation = state.backgroundMode === "black" ? "lighter" : "multiply";
  for (let i = 0; i < 5; i++) {
    const bin = Math.floor((i / 5) * (freqData.length - 1));
    const band = freqData[bin] / 255;
    const radius = maxRadius * (0.28 + i * 0.18 + band * 0.3);
    const color = voiceColorAt((colorDriver + i * 0.17 + band * 0.2) % 1, energy, colorDriver).hex();
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.55, color);
    gradient.addColorStop(1, "transparent");
    ctx.globalAlpha = clamp((energy * 0.22 + band * 0.2) * state.visual.intensity, 0, 0.58);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWave(timeData, energy, centroidNorm, colorDriver) {
  const midY = state.height * (0.48 + (centroidNorm - 0.5) * 0.22);
  const amp = state.height * (0.12 + energy * 0.35);

  ctx.save();
  ctx.globalCompositeOperation = state.backgroundMode === "black" ? "screen" : "multiply";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const gradient = ctx.createLinearGradient(0, 0, state.width, 0);
  const waveStops = 5;
  for (let i = 0; i < waveStops; i++) {
    const stop = i / (waveStops - 1);
    const t = stop * 0.7 + colorDriver * 0.3;
    gradient.addColorStop(stop, voiceColorAt(t, energy, colorDriver).hex());
  }

  ctx.strokeStyle = gradient;
  ctx.lineWidth = clamp(2 + energy * 22, 2, 28);
  ctx.globalAlpha = clamp((0.12 + energy * 0.9) * state.visual.intensity, 0, 0.96);
  ctx.beginPath();
  for (let x = 0; x < state.width; x += 6) {
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

  ctx.fillStyle = getBackgroundColor();
  ctx.fillRect(0, 0, state.width, state.height);

  if (energy < 0.012 && state.audioMetrics.flux * sensitivity < 0.006) return;

  if (state.visual.blend) {
    drawVoiceWash(energy, colorDriver);
    drawColorBlend(freqData, energy, centroidNorm, colorDriver);
  }
  if (state.visual.bloom) drawBloom(freqData, energy, centroidNorm, colorDriver);
  if (state.visual.waveform) drawWave(timeData, energy, centroidNorm, colorDriver);
}

function updateMetricsUi() {
  ui.mRms.textContent = state.audioMetrics.rms.toFixed(3);
  ui.mCentroid.textContent = `${Math.round(state.audioMetrics.voiceFrequency)} Hz`;
  ui.mPitch.textContent = state.audioMetrics.pitchConfidence > 0.05
    ? `${Math.round(state.audioMetrics.pitch)} Hz`
    : "0 Hz";
  ui.mFlux.textContent = state.audioMetrics.flux.toFixed(3);
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

async function loadPreset(path, textarea) {
  textarea.value = await fetchText(path);
}

async function bootstrap() {
  resizeCanvas();
  fillPresetSelect(ui.colorPreset, colorPresetList);
  fillPresetSelect(ui.soundPreset, soundPresetList);
  await loadPreset(colorPresetList[0], ui.colorYaml);
  await loadPreset(soundPresetList[0], ui.soundYaml);
  await applyEditors();
  updateLiveControlLabels();

  ui.settingsToggle.addEventListener("click", () => ui.sidebar.classList.add("is-open"));
  ui.closeSidebar.addEventListener("click", () => ui.sidebar.classList.remove("is-open"));
  ui.backgroundToggle.addEventListener("click", () => {
    setBackgroundMode(state.backgroundMode === "black" ? "white" : "black");
  });
  ui.helpToggle.addEventListener("click", () => ui.helpModal.showModal());
  ui.startMic.addEventListener("click", async () => {
    try {
      if (state.running) await stopAudio();
      else await initAudio();
    } catch (error) {
      setStatus(error.message);
      setRunningUi();
    }
  });
  ui.stopMic.addEventListener("click", stopAudio);
  ui.applyAll.addEventListener("click", async () => {
    try {
      await applyEditors();
    } catch (error) {
      setStatus(error.message);
    }
  });
  ui.colorPreset.addEventListener("change", async () => {
    await loadPreset(ui.colorPreset.value, ui.colorYaml);
    applyColorConfig(parseYamlText(ui.colorYaml.value, "Color YAML"));
    state.dirty.lastColorEdit = null;
  });
  ui.soundPreset.addEventListener("change", async () => {
    await loadPreset(ui.soundPreset.value, ui.soundYaml);
    applySoundConfig(parseYamlText(ui.soundYaml.value, "Sound YAML"));
    state.dirty.lastSoundEdit = null;
  });
  ui.colorYaml.addEventListener("input", () => {
    state.dirty.lastColorEdit = "yaml";
  });
  ui.soundYaml.addEventListener("input", () => {
    state.dirty.lastSoundEdit = "yaml";
  });
  ui.micSensitivity.addEventListener("input", () => {
    state.visual.micSensitivity = Number(ui.micSensitivity.value);
    updateLiveControlLabels();
  });
  ui.visualIntensity.addEventListener("input", () => {
    state.visual.intensity = Number(ui.visualIntensity.value);
    updateLiveControlLabels();
  });
  ui.voiceFloorColor.addEventListener("input", () => {
    state.dirty.lastColorEdit = "controls";
    applyVoiceControlsToState();
    if (!state.running) drawSilence();
  });
  ui.voiceCeilingColor.addEventListener("input", () => {
    state.dirty.lastColorEdit = "controls";
    applyVoiceControlsToState();
    if (!state.running) drawSilence();
  });
  ui.voiceFloorHz.addEventListener("change", () => {
    state.dirty.lastColorEdit = "controls";
    applyVoiceControlsToState();
    if (!state.running) drawSilence();
  });
  ui.voiceFloorHz.addEventListener("input", () => {
    state.dirty.lastColorEdit = "controls";
  });
  ui.voiceCeilingHz.addEventListener("change", () => {
    state.dirty.lastColorEdit = "controls";
    applyVoiceControlsToState();
    if (!state.running) drawSilence();
  });
  ui.voiceCeilingHz.addEventListener("input", () => {
    state.dirty.lastColorEdit = "controls";
  });
  ui.toggleBlend.addEventListener("change", () => {
    state.visual.blend = ui.toggleBlend.checked;
    if (!state.running) drawSilence();
  });
  ui.toggleBloom.addEventListener("change", () => {
    state.visual.bloom = ui.toggleBloom.checked;
    if (!state.running) drawSilence();
  });
  ui.toggleWaveform.addEventListener("change", () => {
    state.visual.waveform = ui.toggleWaveform.checked;
    if (!state.running) drawSilence();
  });
  window.addEventListener("resize", resizeCanvas);
}

bootstrap().catch((error) => setStatus(error.message));
