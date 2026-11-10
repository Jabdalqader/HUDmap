import { asLive, asSim, asVoice } from './adapters.js';
import { createHudApp } from './app.js';
import { config } from './config.js';
import { createFieldSource, requestMotionPermission } from './sources/field-source.js';
import { createSimSource } from './sources/sim-source.js';
import { createDemoPanel } from './view/demo-panel.js';
import { createRenderer } from './view/renderer.js';
import { createFakeLive } from '../dev/fake-live.js';
import { createFakeSim } from '../dev/fake-sim.js';
import { createFakeVoice } from '../dev/fake-voice.js';

const LONG_PRESS_MS = 800;
const params = new URLSearchParams(location.search);
const startScreen = document.getElementById('start');
const startError = document.getElementById('startError');

async function loadMission() {
  for (const url of [params.get('mission') ?? config.mission, config.sampleMission]) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return { mission: await response.json(), url };
    } catch {
      // try the next one
    }
  }
  throw new Error('No mission.json found.');
}

/** Loads a teammate's module if it is there and fits; otherwise uses the stand-in. */
async function loadPart(name, fit, standIn) {
  if (params.get(name) !== 'fake') {
    try {
      const part = fit(await import(config[name]));
      if (part) return { part, real: true };
    } catch {
      // not deployed yet
    }
  }
  return { part: standIn(), real: false };
}

let wakeLock = null;
async function keepScreenOn() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    // not supported or not allowed; the walk still works
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock?.released !== false) keepScreenOn();
});

async function enterFullscreen(view) {
  try {
    await document.documentElement.requestFullscreen?.();
    if (view === 'vr') await screen.orientation?.lock?.('landscape');
  } catch {
    // fine on desktops and some browsers
  }
}

async function start(mode, view, motionAsked) {
  const { mission, url } = await loadMission();
  let app = null;
  const getStatus = () => app?.getStatus();

  const live = await loadPart('live', asLive, () => createFakeLive());
  const voice = await loadPart('voice', asVoice, () => createFakeVoice({ getStatus }));
  let source;
  if (mode === 'sim') {
    const sim = await loadPart('sim', asSim, () => createFakeSim({ mission, speedFactor: Number(params.get('speed') ?? 1) }));
    source = createSimSource(sim.part, mission, view);
  } else {
    source = createFieldSource();
  }

  if (params.get('autostart') !== '1') await enterFullscreen(view);
  await keepScreenOn();
  if (!(await motionAsked)) console.warn('[hud] motion access refused: using walking direction instead of the compass');
  await source.start();

  const link = live.real ? { label: 'Habitat link', bars: 4 } : { label: 'Local only (stand-in)', bars: 1 };
  app = createHudApp({ mission, source, live: live.part, voice: voice.part, link });
  const canvas = document.getElementById('hud');
  const renderer = createRenderer({ canvas, getFrame: app.frame, view });
  const demo = createDemoPanel({ element: document.getElementById('demo'), app, renderer, live: live.part });
  if (params.get('demo') === '1') demo.show();

  let pressStart = 0;
  canvas.addEventListener('pointerdown', () => {
    pressStart = performance.now();
  });
  canvas.addEventListener('pointerup', () => {
    if (performance.now() - pressStart >= LONG_PRESS_MS) demo.toggle();
    else app.onTap();
  });

  window.hud = { getStatus: app.getStatus, demo: app.demo, standInLive: live.real ? null : live.part };
  console.info('[hud] mission', url, 'live', live.real ? 'real' : 'stand-in', 'voice', voice.real ? 'real' : 'stand-in');
  await Promise.race([document.fonts?.load?.('600 20px Rajdhani'), new Promise((resolve) => setTimeout(resolve, 1500))]);
  app.start();
  renderer.start();
  startScreen.hidden = true;
}

function chosen(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

document.getElementById('go').addEventListener('click', () => {
  startError.textContent = '';
  const mode = chosen('mode');
  const motionAsked = requestMotionPermission();
  start(mode, chosen('view'), motionAsked).catch((error) => {
    startError.textContent = error.message || String(error);
  });
});

if (params.get('mode')) document.querySelector(`input[name="mode"][value="${params.get('mode')}"]`)?.click();
if (params.get('view')) document.querySelector(`input[name="view"][value="${params.get('view')}"]`)?.click();
if (params.get('autostart') === '1') document.getElementById('go').click();
