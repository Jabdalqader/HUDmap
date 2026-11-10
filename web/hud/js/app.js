import { evaluateAlerts } from './core/alerts.js';
import { createBiosigns } from './core/biosigns.js';
import { EARTH_RADIUS_M, MARS_RADIUS_M, distanceM } from './core/geo.js';
import { lightMinutes } from './core/light-time.js';
import { curiositySol, formatHours, localSolarHours } from './core/mars-time.js';
import { arrowAngle, createNavigator, etaMinutes } from './core/nav.js';
import { slopeAhead } from './core/route.js';
import { buildScene } from './core/scene.js';
import { buildStatus } from './core/status.js';
import { createSuit } from './core/suit.js';
import { createTwin } from './core/twin.js';

const TICK_MS = 250;
const TELEMETRY_MS = 1000;
const PHOTO_MS = 2000;
const CARD_MS = 15000;
const MESSAGE_MS = 12000;
const GOOD_FIX_M = 20;

/**
 * The HUD's brain: position in, navigation, oxygen, alerts, cards and messages out.
 * Everything it talks to is passed in, so stand-ins and the real parts are interchangeable.
 */
export function createHudApp({
  mission: rawMission, source, live, voice, link = { label: 'Habitat link', bars: 4 },
  clock = () => performance.now(), now = () => Date.now(), timers = window,
}) {
  // The official mission.json lists the base as a stop with "is_base": true; the HUD uses anchor.mars as base.
  const mission = { ...rawMission, stops: rawMission.stops.filter((s) => !s.is_base) };
  const walkSpeed = mission.suit?.walk_speed_mps ?? 0.8;
  const suit = createSuit({
    o2StartPct: mission.suit?.o2_start_pct ?? 100,
    o2PctPerMin: mission.suit?.o2_pct_per_min ?? 0.25,
    powerPctPerMin: mission.suit?.power_pct_per_min ?? 0.2,
    startMs: clock(),
  });
  const body = createBiosigns();
  const siteLonEast = mission.anchor.mars[1];
  const stopCount = mission.stops.length;

  let world = null;
  let nav = null;
  let step = null;
  let mustReturn = false;
  let alerts = [];
  let card = null;
  let message = null;
  let aiText = '';
  let forcedSlopeUntil = 0;
  let radDoseUsv = 0;
  let lastTickMs = clock();
  let lastSpot = null;
  let speedMps = 0;
  let slopeNow = 0;
  let bio = { heartBpm: 72, breathsPerMin: 14 };
  const intervals = [];

  function buildWorld(toFrame, r, marsPerFrameMetre, toMars) {
    const stops = mission.stops.map((s) => ({ ...s, at: toFrame(s.mars) }));
    const route = (mission.route ?? []).map((p) => (Array.isArray(p) ? { at: toFrame(p), slope_deg: 0 } : { ...p, at: toFrame(p.mars) }));
    world = { stops, route, base: { at: toFrame(mission.anchor.mars) }, r, marsPerFrameMetre, toMars };
    nav = createNavigator({ stops, base: world.base, r });
  }

  /** Sim walks on Mars directly. Field mode maps Mars to the desert; with no desert anchor, the first good GPS fix is base. */
  function ensureWorld(position) {
    if (world) return true;
    if (source.frame === 'mars') {
      buildWorld((p) => p, MARS_RADIUS_M, 1, (p) => p);
      return true;
    }
    const anchor = { ...mission.anchor };
    if (!anchor.field) {
      if (!position || position.accuracy > GOOD_FIX_M) return false;
      anchor.field = position.at;
      message = { text: 'Base set at this spot', fromGround: false, until: clock() + MESSAGE_MS };
    }
    const twin = createTwin(anchor);
    buildWorld(twin.marsToField, EARTH_RADIUS_M, 1 / twin.scale, twin.fieldToMars);
    return true;
  }

  function conditions() {
    if (!step) return mission.stops[0]?.conditions ?? null;
    if (!step.target.isBase) return step.target.conditions ?? null;
    return mission.stops[Math.max(0, nav.nextIndex - 1)]?.conditions ?? null;
  }

  function arrive(stop, t) {
    card = { stop, until: t + CARD_MS };
    const sentence = (label, value) => (value ? ` ${label}: ${String(value).replace(/[.\s]+$/, '')}.` : '');
    voice.sendContext(`The astronaut reached stop ${stop.id} of ${stopCount}: ${stop.name}.`
      + sentence('Task', stop.task) + sentence('Hazard', stop.hazard) + sentence('Science', stop.science));
  }

  function tick() {
    const t = clock();
    suit.update(t);
    const position = source.getPosition();
    radDoseUsv += ((conditions()?.rad_uSv_h ?? 0) * (t - lastTickMs)) / 3600000;
    lastTickMs = t;
    if (!position || !ensureWorld(position)) return;

    if (lastSpot) {
      const moved = distanceM(lastSpot.at, position.at, world.r) / Math.max(0.001, (t - lastSpot.t) / 1000);
      speedMps += 0.3 * (Math.min(moved, 3) - speedMps);
    }
    lastSpot = { at: position.at, t };

    step = nav.update(position.at, t);
    if (step.arrived) arrive(step.arrived, t);

    const slope = t < forcedSlopeUntil ? 90 : slopeAhead(world.route, position.at, world.r);
    slopeNow = slope;
    bio = body.update({ speedMps, slopeDeg: Math.min(slope, 30), lowOxygen: suit.o2Pct < 30 });
    const result = evaluateAlerts({
      slopeAheadDeg: slope,
      o2Pct: suit.o2Pct,
      o2MinutesLeft: suit.minutesLeft,
      walkBackMinutes: etaMinutes(step.baseDistanceM, walkSpeed),
      alreadyReturning: mustReturn,
    });
    if (result.mustReturn && !mustReturn) {
      mustReturn = true;
      nav.goHome();
      step = nav.update(position.at, t);
      voice.sendContext('The oxygen reserve is reached. The astronaut must return to base now.');
    }
    alerts = result.alerts;
  }

  function status() {
    if (!step) return null;
    return buildStatus({
      nav: step,
      stopCount,
      marsPerFrameMetre: world.marsPerFrameMetre,
      o2Pct: suit.o2Pct,
      o2MinutesLeft: suit.minutesLeft,
      mustReturn,
      conditions: conditions(),
    });
  }

  function sendTelemetry() {
    const position = source.getPosition();
    const s = status();
    if (!position || !s) return;
    live.sendTelemetry({
      t: now(),
      mode: source.frame === 'mars' ? 'sim' : 'field',
      field: source.frame === 'field' ? position.at : null,
      mars: world.toMars(position.at),
      heading: Math.round(position.heading),
      stop: s.stop,
      dist_next_m: s.dist_next_m,
      dist_base_m: s.dist_base_m,
      o2_pct: s.o2_pct,
      rad_dose_uSv: Math.round(radDoseUsv * 10) / 10,
      alerts,
    });
  }

  async function sendPhoto() {
    if (source.frame !== 'field') return;
    const photo = await source.capturePhoto(320);
    if (photo) live.sendPhoto(photo);
  }

  function waitingText(position) {
    if (!position) return source.frame === 'field' ? 'Waiting for GPS…' : 'Starting the sim…';
    if (!world) return `Finding a good GPS fix (±${Math.round(position.accuracy)} m)…`;
    return null;
  }

  function stopLabel() {
    if (!step || !step.target.isBase) return `Stop ${step ? step.target.id : 1}/${stopCount}`;
    return step.done ? 'All stops done' : 'Base';
  }

  live.onMessage?.((m) => {
    message = { text: typeof m === 'string' ? m : m?.text ?? '', fromGround: true, until: clock() + MESSAGE_MS };
  });
  voice.onText?.((text) => {
    aiText = text;
  });

  return {
    start() {
      tick();
      intervals.push(timers.setInterval(tick, TICK_MS));
      intervals.push(timers.setInterval(sendTelemetry, TELEMETRY_MS));
      intervals.push(timers.setInterval(sendPhoto, PHOTO_MS));
    },
    stop() {
      intervals.splice(0).forEach((id) => timers.clearInterval(id));
    },
    getStatus: status,
    onTap() {
      voice.toggle();
    },

    /** What the renderer draws this frame. Heading is read fresh so the arrow turns smoothly. */
    frame() {
      const t = clock();
      if (card && t > card.until) card = null;
      if (message && t > message.until) message = null;
      const position = source.getPosition();
      const c = conditions();
      const hud = {
        o2Pct: suit.o2Pct,
        radUsvH: c?.rad_uSv_h ?? null,
        tempC: c?.temp_c ?? null,
        stopLabel: stopLabel(),
        alerts,
        message: message ? (message.fromGround ? `Ground Control: ${message.text}` : message.text) : null,
        aiText,
        listening: voice.listening,
        mustReturn,
        card: card?.stop ?? null,
        waiting: step ? null : waitingText(position),
      };
      const wallMs = now();
      Object.assign(hud, {
        timeMs: t,
        o2MinutesLeft: suit.minutesLeft,
        powerPct: suit.powerPct,
        pressurePa: c?.pressure_pa ?? null,
        site: mission.site?.name ?? 'Mars',
        marsTime: formatHours(localSolarHours(wallMs, siteLonEast)),
        sol: curiositySol(wallMs, siteLonEast),
        earthTime: new Date(wallMs).toISOString().slice(11, 19),
        lightMin: lightMinutes(wallMs),
        link,
        radDoseUsv,
        heartBpm: bio.heartBpm,
        breathsPerMin: bio.breathsPerMin,
        integrity: {
          Helmet: 'ok',
          'Life support': mustReturn || suit.o2Pct < 30 ? 'danger' : 'ok',
          Torso: 'ok',
          Arms: 'ok',
          Legs: slopeNow > 12 ? 'warn' : 'ok',
        },
      });
      if (step) {
        const heading = position?.heading ?? 0;
        hud.heading = heading;
        hud.targetBearing = step.bearingDeg;
        hud.arrowDeg = arrowAngle(step.bearingDeg, heading);
        hud.distanceM = step.distanceM * world.marsPerFrameMetre;
        hud.distanceLabel = `${Math.round(hud.distanceM)} m`;
        hud.etaMin = Math.max(1, Math.round(etaMinutes(step.distanceM, walkSpeed)));
        hud.targetName = step.target.isBase ? 'Base' : step.target.name;
        hud.targetLabel = `${hud.targetName}, about ${hud.etaMin} min`;
        if (position) hud.scene = buildScene({ world, position, heading, nextIndex: nav.nextIndex, target: step.target });
      }
      return { background: source.getBackground(), hud };
    },

    demo: {
      oxygenFast: () => suit.setSpeed(20),
      oxygenLow: () => suit.setO2(25),
      steepGround: () => {
        forcedSlopeUntil = clock() + 10000;
      },
      nextStop: () => source.sim?.jumpToStop?.(nav ? nav.nextIndex : 0),
      message: (text) => {
        message = { text, fromGround: true, until: clock() + MESSAGE_MS };
      },
    },
  };
}
