const colorPresetList = [
  "presets/colors/oceanic.yaml",
  "presets/colors/magma.yaml",
];

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
    flux: 0,
  },
  visual: {
    micSensitivity: 1.4,
    intensity: 1,
    blend: true,
    bloom: true,
    waveform: true,
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
  toggleBlend: document.getElementById("toggleBlend"),
  toggleBloom: document.getElementById("toggleBloom"),
  toggleWaveform: document.getElementById("toggleWaveform"),
  status: document.getElementById("status"),
  mRms: document.getElementById("mRms"),
  mCentroid: document.getElementById("mCentroid"),
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
  const response = await fetch(path);
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
  ui.micSensitivityValue.textContent = `${state.visual.micSensitivity.toFixed(2)}x`;
  ui.visualIntensityValue.textContent = state.visual.intensity.toFixed(2);
}

function colorAt(t) {
  const cfg = state.color;
  const palette = cfg.palette;
  const scaled = clamp(t, 0, 1) * (palette.length - 1);
  const i = Math.floor(scaled);
  const localT = scaled - i;
  return chroma.interpolate(
    palette[clamp(i, 0, palette.length - 1)],
    palette[clamp(i + 1, 0, palette.length - 1)],
    localT,
    cfg.interpolation
  );
}

function drawSilence() {
  ctx.save();
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.fillStyle = getBackgroundColor();
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();
}

function applyColorConfig(cfg) {
  if (!Array.isArray(cfg.palette) || cfg.palette.length < 2) {
    throw new Error("Color YAML necesita palette con al menos 2 colores");
  }

  state.color = {
    name: cfg.name || "Color preset",
    palette: cfg.palette,
    interpolation: ["rgb", "lab", "hsl", "hsv", "hcl"].includes(cfg.interpolation) ? cfg.interpolation : "lab",
    reactivity: {
      energyToBrightness: clamp(Number(cfg.reactivity?.energy_to_brightness ?? 0.7), 0, 1.4),
      centroidToHueShift: clamp(Number(cfg.reactivity?.centroid_to_hue_shift ?? 0.3), 0, 1),
    },
  };

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
  applyColorConfig(parseYamlText(ui.colorYaml.value, "Color YAML"));
  applySoundConfig(parseYamlText(ui.soundYaml.value, "Sound YAML"));
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

  state.audioMetrics.rms = Math.sqrt(sumSq / timeData.length);
  state.audioMetrics.centroid = magSum > 0 ? weighted / magSum : 0;
  state.audioMetrics.flux = fluxAcc / (freqData.length * 255);
}

function drawColorBlend(freqData, energy, centroidNorm) {
  const mode = state.backgroundMode === "black" ? "screen" : "multiply";
  const time = performance.now() * 0.00028;
  const layers = 7;

  ctx.save();
  ctx.globalCompositeOperation = mode;

  for (let i = 0; i < layers; i++) {
    const bin = Math.floor((i / layers) * (freqData.length - 1));
    const band = freqData[bin] / 255;
    const orbit = time + i * 1.37 + centroidNorm * 2.1;
    const x = state.width * (0.5 + Math.cos(orbit) * (0.16 + band * 0.24));
    const y = state.height * (0.5 + Math.sin(orbit * 1.23) * (0.14 + energy * 0.2));
    const radius = Math.max(state.width, state.height) * (0.34 + energy * 0.52 + band * 0.24);
    const hueT = (centroidNorm * state.color.reactivity.centroidToHueShift + i / layers + band * 0.22 + time * 0.18) % 1;
    const color = colorAt(hueT).hex();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, color);
    gradient.addColorStop(0.48, color);
    gradient.addColorStop(1, "transparent");

    ctx.globalAlpha = clamp((0.12 + band * 0.42 + energy * 0.28) * state.visual.intensity, 0, 0.72);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  const wash = ctx.createLinearGradient(0, 0, state.width, state.height);
  for (let i = 0; i < state.color.palette.length; i++) {
    wash.addColorStop(i / Math.max(1, state.color.palette.length - 1), state.color.palette[i]);
  }
  ctx.globalAlpha = clamp(energy * 0.32 * state.visual.intensity, 0, 0.36);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();
}

function drawBloom(freqData, energy, centroidNorm) {
  const cx = state.width * (0.18 + centroidNorm * 0.64);
  const cy = state.height * (0.5 + Math.sin(performance.now() * 0.0006) * 0.22);
  const maxRadius = Math.max(state.width, state.height) * (0.18 + energy * 0.72);

  ctx.save();
  ctx.globalCompositeOperation = state.backgroundMode === "black" ? "lighter" : "multiply";
  for (let i = 0; i < 5; i++) {
    const bin = Math.floor((i / 5) * (freqData.length - 1));
    const band = freqData[bin] / 255;
    const radius = maxRadius * (0.28 + i * 0.18 + band * 0.3);
    const color = colorAt((centroidNorm + i * 0.17 + band * 0.2) % 1).hex();
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

function drawWave(timeData, energy, centroidNorm) {
  const midY = state.height * (0.48 + (centroidNorm - 0.5) * 0.22);
  const amp = state.height * (0.12 + energy * 0.35);

  ctx.save();
  ctx.globalCompositeOperation = state.backgroundMode === "black" ? "screen" : "multiply";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const gradient = ctx.createLinearGradient(0, 0, state.width, 0);
  for (let i = 0; i < state.color.palette.length; i++) {
    gradient.addColorStop(i / Math.max(1, state.color.palette.length - 1), state.color.palette[i]);
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

  ctx.fillStyle = getBackgroundColor();
  ctx.fillRect(0, 0, state.width, state.height);

  if (energy < 0.012 && state.audioMetrics.flux * sensitivity < 0.006) return;

  if (state.visual.blend) drawColorBlend(freqData, energy, centroidNorm);
  if (state.visual.bloom) drawBloom(freqData, energy, centroidNorm);
  if (state.visual.waveform) drawWave(timeData, energy, centroidNorm);
}

function updateMetricsUi() {
  ui.mRms.textContent = state.audioMetrics.rms.toFixed(3);
  ui.mCentroid.textContent = `${Math.round(state.audioMetrics.centroid)} Hz`;
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
  });
  ui.soundPreset.addEventListener("change", async () => {
    await loadPreset(ui.soundPreset.value, ui.soundYaml);
    applySoundConfig(parseYamlText(ui.soundYaml.value, "Sound YAML"));
  });
  ui.micSensitivity.addEventListener("input", () => {
    state.visual.micSensitivity = Number(ui.micSensitivity.value);
    updateLiveControlLabels();
  });
  ui.visualIntensity.addEventListener("input", () => {
    state.visual.intensity = Number(ui.visualIntensity.value);
    updateLiveControlLabels();
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
