const crypto = require("crypto");
const { birdieHitsCircle, birdieOverlap } = require("./birdie-hit");

const MAX_PLAYERS = 2;
const IDLE_RESET_MS = 5 * 60 * 1000;
const ENRAGE_GRACE_S = 8;
const BIRDIE_WHITE_FLASH = 0.15;
const BIRDIE_DEAD_FADE = 0.35;
const BONUS_FLASH_S = 2.5;
const TICK_MS = 50;
const DIALOGUE_MS_PER_CHAR = 28;
const DIALOGUE_MIN_MS = 700;
const WIDTH = 1280;
const HEIGHT = 720;
const TELEPATHY_TIME = 25;
const DECISION_TIME = 10;
const DRAW_TURN = 90;
const DRAW_EARLY = 40;
const PIANO_TIME = 40;
const PIANO_FAST_AT = 30;
const BOSS_PHASE1 = 35;
const BOSS_PHASE2 = 20;
const BOSS_HITS = 70;
const BOSS_ANGRY_HP = 40;
const BOSS_FINAL_HP = 20;
const BOSS_ANGRY_HITS = BOSS_HITS - BOSS_ANGRY_HP;
const BOSS_FINAL_HITS = BOSS_HITS - BOSS_FINAL_HP;
const BOSS_SHOT_EVERY = 2.5;
const BOSS_R = 26;
const BOSS_BOUNCES = 4;
const BOSS_FIRE_CD = 0.85;
const GUN_UPGRADE_COSTS = [10, 15, 20];
const GUN_FIRE_CD = [0.95, 0.58, 1.2, 0.58];
const GUN_SHOTS = [[0], [0], [-7, 7], [-7, 7]];
const GUN_NAMES = ["Base Gun", "Rapid Fire", "Shotgun", "Big Gun"];
const BOSS_MOVE_S = 3;
const BOSS_REST_S = 2.5;
const BOSS_YELLOW_EVERY = 3.5;
const BOSS_YELLOW_WARN = 0.5;
const BOSS_YELLOW_WARN_NORMAL = 0.78;
const BOSS_YELLOW_STAGGER = 0.7;
const BOSS_AOE_EVERY = 4;
const BOSS_AOE_WARN = 0.82;
const BOSS_AOE_R = 64;
const BOSS_AOE_FLASH = 0.1;
const SHIELD_MAX = 4;
const COIN_EVERY = 5;
const COIN_ANGRY_CUT = 1.5;
const BLUE_WALL_HP = 8;
const BLUE_WALL_CD = 8;
const FINAL_MINION_SHOT = 2.5;
const MINION_HP_BASE = 2;
const MINION_HP_STEP = 2;
const FINAL_MINION_HP = 10;
const HP_EVERY = 13;
const PICKUP_GAP = 32;
const SHOP_ASK = 5;
const RACKET_MAX = 2;
const RACKET_REGEN = 5;
const RACKET_ZONE = 44;
const SHOP_COST = { shield: 5, gun: 10, racket: 10 };
const FINAL_WALL_HP = 20;
const PIANO_HIT = 0.16;
const RED_SPEED = 210;
const WALL_THICK = 22;
const WALL_HP = 6;
const MINION_CAP = 12;
const WALL_CD = 7;
const PIANO_HEARTS = 3;
const LDR_MAX_HEARTS = 5;
const FEET_Y = 490;
const COURT = { x: 360, y: 16, w: 560, h: 688 };
const NET_Y = COURT.y + COURT.h / 2;
const BOSS_Y = COURT.y + 118;
const CONTROL_UI = { x: COURT.x + 92, y: COURT.y + COURT.h - 196, w: COURT.w - 184, h: 196 };
const PIANO_FREQ = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const DRAW_WORDS = [
  "CAT",
  "DOG",
  "BIRD",
  "FISH",
  "TREE",
  "HOUSE",
  "SUN",
  "MOON",
  "STAR",
  "HEART",
  "CAKE",
  "PIZZA",
  "APPLE",
  "CAR",
  "BUS",
  "BOAT",
  "RAIN",
  "CLOUD",
  "BOOK",
  "PHONE",
  "CHAIR",
  "CUP",
  "HAT",
  "SHOE",
  "BALL",
  "KEY",
  "CLOCK",
  "FROG",
  "BEAR",
  "LION",
  "DUCK",
  "ROSE",
  "LEAF",
  "GIFT",
  "SNAKE",
  "GHOST",
  "PLANE",
  "SMILE",
  "WAVE",
  "FORK",
];
const CATEGORIES = [
  "FOOD",
  "DRINK",
  "COLOR",
  "ANIMAL",
  "PLACE",
  "SNACK",
  "MOVIE",
  "SONG",
  "GAME",
  "SEASON",
  "HOBBY",
  "DESSERT",
  "CITY",
  "WEATHER",
  "ANIME",
];

function uid() {
  return crypto.randomBytes(8).toString("hex");
}

function emptyRacketSideCd() {
  return { momo: { left: 0, right: 0 }, tiantian: { left: 0, right: 0 } };
}

function gunUpgradeCost(currentLevel) {
  return GUN_UPGRADE_COSTS[currentLevel] || GUN_UPGRADE_COSTS[0];
}

function teamGunLevel(t) {
  if (!t) return 0;
  if (typeof t.gunLevel === "number") return t.gunLevel;
  if (t.gunLevel && typeof t.gunLevel === "object") {
    return Math.max(t.gunLevel.momo || 0, t.gunLevel.tiantian || 0);
  }
  return 0;
}

function normalizeCoins(coins) {
  if (typeof coins === "number") return coins;
  if (coins && typeof coins === "object") return (coins.momo || 0) + (coins.tiantian || 0);
  return 0;
}

function briefPausesGame(brief, stage) {
  if (stage === "attackIntro" || stage === "dodgeIntro" || stage === "finalTitle") return true;
  if (brief?.kind === "attackIntro" || brief?.kind === "dodgeIntro" || brief?.kind === "finalTitle") return true;
  if (brief && ["rage", "wall", "minion", "yellow", "special", "final"].includes(brief.kind)) return true;
  return false;
}

function coinSpawnInterval(task) {
  if (bossAngry(task.hits) && !task.finalPhase) return Math.max(0.5, COIN_EVERY - COIN_ANGRY_CUT);
  return COIN_EVERY;
}

function phaseTitleBrief(kind) {
  if (kind === "dodgeIntro") {
    return {
      kind: "dodgeIntro",
      titleStyle: true,
      lines: ["DODGE", "DODGE THE BOSS AND COLLECT COINS"],
      i: 0,
      acked: false,
      ack: { momo: false, tiantian: false },
      overlay: false,
      startedAt: now(),
      revealed: true,
    };
  }
  if (kind === "attackIntro") {
    return {
      kind: "attackIntro",
      titleStyle: true,
      lines: ["ATTACKING STAGE", "PRESS SPACE TO SHOOT AT THE BOSS"],
      i: 0,
      acked: false,
      ack: { momo: false, tiantian: false },
      overlay: false,
      startedAt: now(),
      revealed: true,
    };
  }
  return {
    kind: "finalTitle",
    titleStyle: true,
    lines: ["FINAL PHASE"],
    i: 0,
    acked: false,
    ack: { momo: false, tiantian: false },
    overlay: false,
    startedAt: now(),
    revealed: true,
  };
}

function spawnBlueWall(task) {
  if (task.blueWall) return;
  const { span } = bossBounds();
  const w = Math.max(48, Math.round(span / 5));
  const h = Math.max(14, WALL_THICK - 4);
  const cx = COURT.x + COURT.w / 2;
  const minX = cx - 110;
  const maxX = cx + 110 - w;
  const minY = NET_Y + 48;
  const maxY = NET_Y + 150;
  const x = clamp(minX + Math.random() * Math.max(8, maxX - minX), COURT.x + 24, COURT.x + COURT.w - w - 24);
  const y = clamp(minY + Math.random() * Math.max(8, maxY - minY), NET_Y + 36, COURT.y + COURT.h - 120);
  task.blueWall = {
    id: uid(),
    x,
    y,
    w,
    h,
    hp: BLUE_WALL_HP,
    maxHp: BLUE_WALL_HP,
    flash: 0,
    color: "blue",
  };
  task.blueWallTimer = 0;
}

function phaseDuration(task) {
  if (task.stage === "final" || task.finalPhase) return Infinity;
  const base = task.stage === "phase1" ? BOSS_PHASE1 : BOSS_PHASE2;
  return base + (task.timerBonus || 0);
}

function syncBossTimeLeft(task) {
  if (task.stage === "final" || task.finalPhase) {
    task.timeLeft = null;
    return;
  }
  task.timeLeft = Math.max(0, phaseDuration(task) - (task.elapsed || 0));
}

function canPlayerAttack(task) {
  return task && (task.stage === "phase2" || task.stage === "final");
}

function spawnFinalWall(task) {
  const ldr = task.ldr;
  const { span } = bossBounds();
  const w = Math.round(span / 3);
  const h = WALL_THICK;
  const wall = {
    id: uid(),
    x: 0,
    y: 0,
    w,
    h,
    hp: FINAL_WALL_HP,
    maxHp: FINAL_WALL_HP,
    flash: 0,
    final: true,
  };
  attachWallToBoss(wall, ldr || { x: COURT.x + COURT.w / 2, y: BOSS_Y, r: BOSS_R });
  task.walls = [wall];
}

function spawnFinalMinions(task) {
  if (!task.ldr) return;
  const bx = task.ldr.x;
  const by = task.ldr.y;
  const offsets = [
    [-90, -36],
    [-110, 8],
    [-90, 52],
    [90, -36],
    [110, 8],
    [90, 52],
  ];
  const z = minionZone();
  task.minions = offsets.map((off, i) => {
    const x = clamp(bx + off[0], z.minX + 12, z.maxX - 12);
    const y = clamp(by + off[1], z.minY + 12, z.maxY - 12);
    return {
      id: uid(),
      x,
      y,
      vx: (i % 2 === 0 ? -1 : 1) * 22,
      vy: i % 2 === 0 ? 14 : -14,
      hp: FINAL_MINION_HP,
      r: 12,
      nextShot: 0.5 + Math.random() * 0.6,
    };
  });
}

function applyEnrageTimerBonus(task) {
  if (!task || task.enrageGraceApplied) return;
  task.enrageGraceApplied = true;
  task.timerBonus = (task.timerBonus || 0) + ENRAGE_GRACE_S;
  task.bonusFlashTimer = BONUS_FLASH_S;
  // Authoritative remaining time grows by 8 immediately (elapsed stays put).
  task.timeLeft = Math.max(0, (task.timeLeft || 0) + ENRAGE_GRACE_S);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function now() {
  return Date.now();
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function normWord(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function cleanText(s, max) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function emptyProgress() {
  return [false, false, false, false, false];
}

function drawBlanks(word, hintPos) {
  const revealed = Array.isArray(hintPos) ? hintPos : hintPos == null || hintPos === "" ? [] : [hintPos];
  return String(word || "")
    .split("")
    .map((ch, i) => (revealed.includes(i) ? ch.toUpperCase() : "_"))
    .join(" ");
}

function pickDrawWords(used) {
  const seen = used || new Set();
  let pool = DRAW_WORDS.filter((w) => !seen.has(w));
  if (pool.length < 3) {
    seen.clear();
    pool = DRAW_WORDS.slice();
  }
  const out = [];
  while (out.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    const word = pool.splice(i, 1)[0];
    out.push(word);
    seen.add(word);
  }
  return out;
}

function laneColor(lane) {
  return lane < 3 ? "red" : "blue";
}

function pianoChart() {
  const reds = [0, 1, 2];
  const blues = [3, 4, 5];
  const events = [];
  let t = 0.5 + Math.random() * 0.2;
  let prevRed = -1;
  let prevBlue = -1;
  let sinceDual = 0;
  while (t < PIANO_TIME - 0.4) {
    const late = t >= PIANO_FAST_AT;
    const step = (late ? 0.46 : 0.58) + Math.random() * (late ? 0.22 : 0.32);
    sinceDual += 1;
    const wantDual = sinceDual >= 2 && Math.random() < (late ? 0.7 : 0.58);
    const pick = (pool, avoid) => {
      const opts = pool.filter((n) => n !== avoid);
      const src = opts.length ? opts : pool;
      return src[Math.floor(Math.random() * src.length)];
    };
    if (wantDual) {
      const red = pick(reds, prevRed);
      const blue = pick(blues, prevBlue);
      prevRed = red;
      prevBlue = blue;
      sinceDual = 0;
      events.push({
        t,
        notes: [
          { lane: red, hold: Math.random() < 0.22 ? 0.34 : 0 },
          { lane: blue, hold: Math.random() < 0.18 ? 0.32 : 0 },
        ],
      });
    } else {
      const redSide = Math.random() < 0.5;
      const lane = redSide ? pick(reds, prevRed) : pick(blues, prevBlue);
      if (redSide) prevRed = lane;
      else prevBlue = lane;
      events.push({ t, notes: [{ lane, hold: Math.random() < 0.28 ? 0.36 : 0 }] });
    }
    t += step;
  }
  return events;
}

function bossBounds() {
  const minX = COURT.x + 16;
  const maxX = COURT.x + COURT.w - 16;
  return { minX, maxX, span: maxX - minX };
}

function minionZone() {
  return {
    minX: COURT.x + 28,
    maxX: COURT.x + COURT.w - 28,
    minY: COURT.y + 96,
    maxY: NET_Y - 26,
  };
}

function attachWallToBoss(wall, ldr) {
  if (!wall || !ldr) return;
  const { span } = bossBounds();
  const w = wall.w || Math.round(span / 3);
  const h = wall.h || WALL_THICK;
  let x = ldr.x - w / 2;
  x = clamp(x, COURT.x + 12, COURT.x + COURT.w - w - 12);
  wall.x = x;
  wall.y = ldr.y + (ldr.r || BOSS_R) + 14;
  wall.w = w;
  wall.h = h;
}

function spawnBossWall(task) {
  if (task.walls && task.walls.length) return;
  const ldr = task.ldr;
  const { span } = bossBounds();
  const w = Math.round(span / 3);
  const h = WALL_THICK;
  const wall = { id: uid(), x: 0, y: 0, w, h, hp: WALL_HP, maxHp: WALL_HP, flash: 0 };
  attachWallToBoss(wall, ldr || { x: COURT.x + COURT.w / 2, y: BOSS_Y, r: BOSS_R });
  task.walls = [wall];
}

function placeAoeZones(living, maxZones) {
  const r = BOSS_AOE_R;
  const limit = maxZones == null ? 2 : Math.max(1, maxZones);
  const minX = COURT.x + 28;
  const maxX = COURT.x + COURT.w - 28;
  const minY = NET_Y + 28;
  const maxY = COURT.y + COURT.h - 28;
  const clampZone = (x, y) => ({ x: clamp(x, minX, maxX), y: clamp(y, minY, maxY), r });
  let zones;
  if (!living.length) {
    const cx = COURT.x + COURT.w / 2;
    const cy = NET_Y + 120;
    zones = [clampZone(cx - r - 8, cy), clampZone(cx + r + 8, cy)];
  } else if (living.length === 1) {
    const p = living[0].p;
    zones = [clampZone(p.x, p.y), clampZone(p.x, p.y)];
  } else {
    zones = [clampZone(living[0].p.x, living[0].p.y), clampZone(living[1].p.x, living[1].p.y)];
  }
  return zones.slice(0, limit);
}

function damageBlueWall(task, amount) {
  const wall = task.blueWall;
  if (!wall) return false;
  const dmg = amount == null ? 1 : amount;
  wall.hp = (wall.hp == null ? BLUE_WALL_HP : wall.hp) - dmg;
  wall.flash = 0.14;
  if (wall.hp <= 0) {
    task.blueWall = null;
    task.blueWallTimer = BLUE_WALL_CD;
  }
  return true;
}

function aoeOverlapsWall(zone, wall) {
  if (!zone || !wall) return false;
  const nearestX = clamp(zone.x, wall.x, wall.x + wall.w);
  const nearestY = clamp(zone.y, wall.y, wall.y + wall.h);
  return Math.hypot(zone.x - nearestX, zone.y - nearestY) <= (zone.r || 0);
}

function coinBlockedByControls(x, y) {
  return x >= CONTROL_UI.x && x <= CONTROL_UI.x + CONTROL_UI.w && y >= CONTROL_UI.y && y <= CONTROL_UI.y + CONTROL_UI.h;
}

function bossAngry(hits) {
  return (hits || 0) >= BOSS_ANGRY_HITS;
}

function playerName(ch) {
  return ch === "momo" ? "Momo" : "Tian Tian";
}

function pickupTooClose(x, y, packs) {
  return (packs || []).some((p) => Math.hypot((p.x || 0) - x, (p.y || 0) - y) < PICKUP_GAP);
}

function randomPickupPos(task) {
  const minX = COURT.x + 36;
  const maxX = COURT.x + COURT.w - 36;
  const minY = NET_Y + 36;
  const maxY = COURT.y + COURT.h - 36;
  const others = [].concat(task.coinsOnCourt || [], task.hpOnCourt || []);
  let x = minX + Math.random() * (maxX - minX);
  let y = minY + Math.random() * (maxY - minY);
  const blocked = () => coinBlockedByControls(x, y) || pickupTooClose(x, y, others);
  for (let i = 0; i < 48 && blocked(); i++) {
    x = minX + Math.random() * (maxX - minX);
    y = minY + Math.random() * (maxY - minY);
  }
  if (blocked()) {
    const left = minX + Math.random() * Math.max(8, CONTROL_UI.x - minX - 12);
    const right = CONTROL_UI.x + CONTROL_UI.w + 12 + Math.random() * Math.max(8, maxX - (CONTROL_UI.x + CONTROL_UI.w) - 12);
    x = Math.random() < 0.5 ? left : right;
    y = minY + Math.random() * Math.max(8, CONTROL_UI.y - minY - 8);
    if (pickupTooClose(x, y, others)) return null;
  }
  if (coinBlockedByControls(x, y) || pickupTooClose(x, y, others)) return null;
  return { x, y };
}

function spawnArenaCoin(task) {
  task.coinsOnCourt = task.coinsOnCourt || [];
  task.nextCoin = (task.elapsed || 0) + coinSpawnInterval(task);
  if (task.coinsOnCourt.length >= 4) return;
  const pos = randomPickupPos(task);
  if (!pos) return;
  task.coinsOnCourt.push({ id: uid(), x: pos.x, y: pos.y });
}

function spawnArenaHp(task) {
  task.hpOnCourt = task.hpOnCourt || [];
  task.nextHp = (task.elapsed || 0) + HP_EVERY;
  if (task.hpOnCourt.length >= 3) return;
  const pos = randomPickupPos(task);
  if (!pos) return;
  task.hpOnCourt.push({ id: uid(), x: pos.x, y: pos.y });
}

function pathHitsPlayer(x0, y0, x1, y1, px, py) {
  const hw = 22;
  const hh = 22;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    if (Math.abs(x - px) < hw && Math.abs(y - py) < hh) return true;
  }
  return false;
}

function wallHitsShot(wall, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    if (x >= wall.x && x <= wall.x + wall.w && y >= wall.y && y <= wall.y + wall.h) return true;
  }
  return false;
}

function bounceShotFromWall(shot, wall) {
  const vx = shot.vx || 0;
  const vy = shot.vy || 0;
  if (wall.w >= wall.h) {
    shot.vx = vx * 0.5;
    shot.vy = -vy * 0.5;
    if (vy <= 0) shot.y = wall.y + wall.h + 10;
    else shot.y = wall.y - 10;
  } else {
    shot.vx = -vx * 0.5;
    shot.vy = vy * 0.5;
    if (vx <= 0) shot.x = wall.x + wall.w + 10;
    else shot.x = wall.x - 10;
  }
  if (Math.abs(shot.vx) < 8 && Math.abs(shot.vy) < 8) shot.vy = vy <= 0 ? 120 : -120;
}

function minionOverlaps(task, x, y, r) {
  return (task.minions || []).some((m) => Math.hypot((m.x || 0) - x, (m.y || 0) - y) < (m.r || 12) + r + 10);
}

function randomMinionPos(task) {
  const z = minionZone();
  const r = 12;
  for (let i = 0; i < 64; i++) {
    const x = z.minX + r + Math.random() * Math.max(8, z.maxX - z.minX - 2 * r);
    const y = z.minY + r + Math.random() * Math.max(8, z.maxY - z.minY - 2 * r);
    if (x < z.minX + r || x > z.maxX - r || y < z.minY + r || y > z.maxY - r) continue;
    if (!minionOverlaps(task, x, y, r)) return { x, y };
  }
  return null;
}

function angryMinionHp(task) {
  const wave = Math.max(1, task.angryAttackWave || 1);
  return MINION_HP_BASE + (wave - 1) * MINION_HP_STEP;
}

function advanceAngryAttackWave(task) {
  task.angryAttackWave = (task.angryAttackWave || 0) + 1;
}

function shieldMaxFor(task, ch) {
  const m = task && task.shieldMax;
  if (m == null) return SHIELD_MAX;
  if (typeof m === "number") return m;
  return m[ch] || SHIELD_MAX;
}

function grantShieldPurchase(task) {
  task.buffs = task.buffs || { shield: false, racket: false };
  task.buffs.shield = true;
  task.shieldHits = task.shieldHits || { momo: 0, tiantian: 0 };
  const nextMax = {};
  const nextHits = {};
  for (const who of ["momo", "tiantian"]) {
    const current = task.shieldHits[who] || 0;
    const max = current > 0 ? current + 4 : SHIELD_MAX;
    nextMax[who] = max;
    nextHits[who] = max;
  }
  task.shieldMax = nextMax;
  task.shieldHits = nextHits;
}

function spawnMinions(task) {
  if (!task.ldr) return false;
  task.minions = task.minions || [];
  const z = minionZone();
  const hp = angryMinionHp(task);
  let added = 0;
  for (let n = 0; n < 2; n++) {
    if (task.minions.length >= MINION_CAP) break;
    const pos = randomMinionPos(task);
    if (!pos) continue;
    const x = clamp(pos.x, z.minX + 12, z.maxX - 12);
    const y = clamp(pos.y, z.minY + 12, z.maxY - 12);
    task.minions.push({
      id: uid(),
      x,
      y,
      vx: (added % 2 === 0 ? -1 : 1) * 22,
      vy: 14,
      hp,
      r: 12,
      nextShot: 0.6 + Math.random() * 0.5,
    });
    added += 1;
  }
  return added > 0;
}

function applyPhaseHearts(hearts, healAlive) {
  const out = { momo: hearts.momo, tiantian: hearts.tiantian };
  for (const ch of ["momo", "tiantian"]) {
    if (out[ch] <= 0) out[ch] = 2;
    else if (healAlive) out[ch] = Math.min(3, out[ch] + 1);
  }
  return out;
}

function lineDuration(text) {
  return Math.max(DIALOGUE_MIN_MS, (text || "").length * DIALOGUE_MS_PER_CHAR + 400);
}

const INTRO_SCRIPT = [
  {
    type: "line",
    scene: "dinner",
    speaker: "",
    text: "Momo and Tian Tian is enjoying their last few days at UBC before they head for summer break.",
  },
  {
    type: "line",
    scene: "dinner",
    speaker: "Momo",
    text: "mmm this matcha tastes very good! Have a taste tian tian!",
    fx: "sipMomo",
  },
  {
    type: "line",
    scene: "dinner",
    speaker: "Tian Tian",
    text: "ooo ur right! Its not too sweet and its very yummy!",
    fx: "sipTian",
  },
  {
    type: "line",
    scene: "dinner",
    speaker: "Tian Tian",
    text: "have a taste of my tiramisu i took it from place vanier its very delicious!",
    fx: "offerTira",
  },
  {
    type: "line",
    scene: "dinner",
    speaker: "Momo",
    text: "Your right! I always love the tiramisu you gave me :D",
    fx: "tasteTira",
  },
  {
    type: "line",
    scene: "dinner",
    speaker: "Tian Tian",
    text: "momo its a couple more days till we have to go in our different ways do you think we’ll be okay?",
  },
  {
    type: "line",
    scene: "dinner",
    speaker: "Momo",
    text: "of course whatever it is we’ll get through it together <3",
  },
  {
    type: "line",
    scene: "dinner",
    speaker: "LDR (Long Distance Relationship)",
    text: "My name is LDR and I am here to ruin your cute little relationship!",
    fx: "ldrAppear",
  },
  {
    type: "line",
    scene: "dinner",
    speaker: "LDR",
    text: "If you want to defeat me you have to go through 5 tasks in order to reconnect back together, but you'll never ever defeat me!!",
  },
  { type: "cinematic", scene: "dinner", name: "separate", ms: 2200 },
  { type: "cinematic", scene: "black", name: "fade", ms: 1400, text: "..." },
  { type: "beginTask", index: 1 },
];

const TASK_INTROS = {
  1: [
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "First, let's test your guys' brain connection...",
    },
    {
      type: "line",
      scene: "task",
      speaker: "SYSTEM",
      text: "GAME 1  —  TELEPATHY. Think of the same word. Do not talk, type to each other, or give hints.",
    },
    { type: "startTask", index: 1 },
  ],
  2: [
    {
      type: "line",
      scene: "task",
      speaker: "SYSTEM",
      text: "GAME 1 COMPLETE!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "WHAT?! You actually thought of the SAME thing?!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "You got lucky on the first game! Let's step it up a notch.",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "Now I'm going to test how well you actually know each other!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "SYSTEM",
      text: "GAME 2  —  HOW WELL DO YOU KNOW EACH OTHER? Write exactly 3 questions about yourself. Then answer your partner's.",
    },
    { type: "startTask", index: 2 },
  ],
  3: [
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "I gotta admit, you guys know a lot about each other.",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "However, this challenge will test your teamwork and artistic skills!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "I'm sure that you will fail this one hahahahahaha!!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "SYSTEM",
      text: "GAME 3  —  DRAW & GUESS. One draws, the other guesses 3 words. Then switch.",
    },
    { type: "startTask", index: 3 },
  ],
  4: [
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "You guys are really testing my limit!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "Now I am really angry!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "It's time to challenge you with some of my hardest games now!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "SYSTEM",
      text: "GAME 4  —  PIANO. Hit the falling tiles with A S D F G H. Hint: you can pick either the blue or the red keys and focus on those for easier teamwork!",
    },
    { type: "startTask", index: 4 },
  ],
  5: [
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "ARGGH! U GUYS ARE SO ANNOYING!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "Can't you guys just give up already?!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "It looks like I have to come down and face you in this final game!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "Alright, here's how this works. I've got 70 HP, and your job is to somehow knock me all the way down to zero.",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "First, you'll have 35 seconds to survive my attacks. You can't damage me during this part, so focus on dodging, grabbing coins and those green HP pickups, and staying alive.",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "When that timer is up, you'll get a chance to visit my little shop. And here's a little bonus for you two — every time you enter the shop, you'll recover 1 HP.",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "Once shopping is over, it's attack time. You'll respawn when the attack phase begins, so make sure you're ready to fight.",
    },
    {
      type: "line",
      scene: "task",
      speaker: "LDR",
      text: "Buy some upgrades, shoot me whenever you can, and somehow try to bring my HP to zero. Think you can actually beat me?!",
    },
    {
      type: "line",
      scene: "task",
      speaker: "SYSTEM",
      text: "GAME 5  —  BADMINTON BOSS. Dodge 35s, shop, then attack. Bring LDR from 70 HP to 0.",
    },
    { type: "startTask", index: 5 },
  ],
};

const ENDING_SCRIPT = [
  {
    type: "line",
    scene: "reunion",
    speaker: "LDR",
    text: "NOOOOOOO! YOU ACTUALLY BEAT ME?!",
    fx: "ldrShrink",
  },
  { type: "cinematic", scene: "reunion", name: "hug", ms: 1600 },
  {
    type: "line",
    scene: "reunion",
    speaker: "SYSTEM",
    text: "Well, it seems like even long distance couldn't keep Momo and Tian Tian apart.",
  },
  {
    type: "line",
    scene: "reunion",
    speaker: "Momo",
    text: "Tian Tian, thank you for working through this long distance with me.",
  },
  {
    type: "line",
    scene: "reunion",
    speaker: "Momo",
    text: "I know it wasn't always easy, especially not being able to see each other for almost half a year.",
  },
  {
    type: "line",
    scene: "reunion",
    speaker: "Momo",
    text: "But I'm really glad we made it through.",
  },
  {
    type: "line",
    scene: "reunion",
    speaker: "Momo",
    text: "It might sound a little corny, but I hope that whenever we face something difficult, we'll keep facing it together—just like we did with long distance.",
  },
  {
    type: "line",
    scene: "reunion",
    speaker: "Momo",
    text: "I'm looking forward to seeing you again in just a few days.",
  },
  {
    type: "line",
    scene: "reunion",
    speaker: "Momo",
    text: "I love you, and I miss you so much. :D",
  },
  { type: "complete" },
];

class Room {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.players = new Map();
    this.tickTimer = null;
    this.timer = null;
    this.reset(false);
    this.startTick();
  }

  startTick() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error("tick error", err);
      }
    }, TICK_MS);
  }

  reset(keepPlayers) {
    this.clearTimer();
    this.phase = "select";
    this.scene = "select";
    this.serverState = "WAITING";
    this.script = [];
    this.scriptIndex = 0;
    this.line = null;
    this.cinematic = null;
    this.cinematicUntil = 0;
    this.scriptLockUntil = 0;
    this.countdown = null;
    this.taskIndex = 0;
    this.progress = emptyProgress();
    this.ldrHearts = LDR_MAX_HEARTS;
    this.ldr = { visible: false, scale: 1, mood: "idle" };
    this.fx = [];
    this.paused = false;
    this.pauseReason = null;
    this.task = null;
    this.decision = null;
    this.failMessage = null;
    this.openCharacter = null;
    this.dinnerDark = 0;
    this.dinnerTira = 0;
    this.usedCategories = [];
    this.usedDrawWords = new Set();
    this.telepathyCategory = null;
    this.switchPress = { momo: 0, tiantian: 0 };
    this.inputs = new Map();
    this.moveCool = new Map();
    this.endedAt = 0;
    this.completeStage = null;
    this.endTimer = 0;
    this.dodgeTutorialShown = false;
    this.attackTutorialShown = false;
    this.clearIdleReset();

    if (!keepPlayers) {
      this.players.clear();
      this.inputs.clear();
    } else {
      for (const p of this.players.values()) {
        p.x = p.character === "momo" ? 560 : 720;
        p.y = FEET_Y;
        p.col = 1;
        p.row = 1;
        p.moving = false;
        p.facing = p.character === "momo" ? 1 : -1;
        p.anim = "idle";
      }
    }
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  clearIdleReset() {
    if (this.idleResetTimer) {
      clearTimeout(this.idleResetTimer);
      this.idleResetTimer = null;
    }
  }

  scheduleIdleResetIfEmpty() {
    this.clearIdleReset();
    if (this.connectedPlayers().length > 0) return;
    // Empty room: wipe immediately so the next visitor starts fresh.
    this.reset(false);
    this.emit();
  }

  playerList() {
    return [...this.players.values()];
  }

  connectedPlayers() {
    return this.playerList().filter((p) => p.connected);
  }

  byCharacter(ch) {
    return this.connectedPlayers().find((p) => p.character === ch) || null;
  }

  getPlayer(id) {
    return this.players.get(id) || null;
  }

  takenMap() {
    return {
      momo: this.connectedPlayers().some((p) => p.character === "momo"),
      tiantian: this.connectedPlayers().some((p) => p.character === "tiantian"),
    };
  }

  placeJoinedCharacter(player, character) {
    if (!player || (character !== "momo" && character !== "tiantian")) return;
    player.character = character;
    player.facing = character === "momo" ? 1 : -1;
    player.x = character === "momo" ? 520 : 760;
    player.y = FEET_Y;
    if (this.phase === "play" || this.phase === "script" || this.phase === "decide") {
      // Keep mid-game joiners on the court if a boss/task is already running.
      if (this.task && this.task.index === 5) {
        player.x = character === "momo" ? COURT.x + 160 : COURT.x + 400;
        player.y = NET_Y + 140;
      }
    }
  }

  resumeAfterPartnerJoin() {
    if (this.pauseReason !== "disconnect") return;
    if (this.connectedPlayers().length < MAX_PLAYERS) return;
    if (!this.byCharacter("momo") || !this.byCharacter("tiantian")) return;
    this.paused = false;
    this.pauseReason = null;
    this.openCharacter = null;
    this.serverState = this.phase === "play" ? "PLAYING" : this.serverState;
    this.pushFx("sfx", { name: "success" });
  }

  join(socketId, token) {
    // Same-tab refresh: reclaim an existing connected/disconnected seat by token.
    if (token && this.players.has(token)) {
      const p = this.players.get(token);
      if (!p.connected) {
        p.socketId = socketId;
        p.connected = true;
        p.disconnectedAt = null;
        this.clearIdleReset();
        this.resumeAfterPartnerJoin();
        return { ok: true, playerId: p.id, token: p.id, reconnected: true };
      }
    }

    // Only active connections fill the room.
    if (this.connectedPlayers().length >= MAX_PLAYERS) {
      return { full: true };
    }

    const id = uid();
    const player = {
      id,
      socketId,
      character: null,
      connected: true,
      disconnectedAt: null,
      x: 640,
      y: FEET_Y,
      col: 1,
      row: 1,
      facing: 1,
      moving: false,
      anim: "idle",
    };

    // Mid-session vacancy: take the freed character so play can resume.
    if (
      this.openCharacter &&
      this.phase !== "select" &&
      this.phase !== "lobby" &&
      this.phase !== "complete"
    ) {
      this.placeJoinedCharacter(player, this.openCharacter);
      this.openCharacter = null;
    }

    this.players.set(id, player);
    this.clearIdleReset();
    if (this.phase === "select") this.serverState = "WAITING";
    this.resumeAfterPartnerJoin();
    return { ok: true, playerId: id, token: id, reconnected: false };
  }

  disconnect(socketId) {
    const p = this.playerList().find((pl) => pl.socketId === socketId);
    if (!p) return;

    const freedCharacter = p.character;
    this.inputs.delete(p.id);
    this.players.delete(p.id);

    if (this.connectedPlayers().length === 0) {
      this.clearIdleReset();
      this.openCharacter = null;
      this.reset(false);
      this.emit();
      return;
    }

    // One player remains — keep session, free the slot.
    if (this.phase === "select" || this.phase === "lobby") {
      this.clearTimer();
      this.countdown = null;
      this.openCharacter = null;
      const stillHasPick = this.connectedPlayers().some((pl) => pl.character);
      this.phase = stillHasPick ? "lobby" : "select";
      this.scene = this.phase;
      this.serverState = "WAITING";
      this.paused = false;
      this.pauseReason = null;
    } else if (this.phase !== "complete") {
      this.openCharacter = freedCharacter || this.openCharacter;
      this.paused = true;
      this.pauseReason = "disconnect";
      this.serverState = "PAUSED";
      this.clearTimer();
    }

    this.emit();
  }

  selectCharacter(playerId, character) {
    if (this.phase !== "select" && this.phase !== "lobby") return { error: "too late" };
    if (character !== "momo" && character !== "tiantian") return { error: "invalid" };
    const p = this.getPlayer(playerId);
    if (!p) return { error: "unknown player" };
    if (p.character) return { error: "already selected" };
    if (this.byCharacter(character)) return { error: "taken" };

    p.character = character;
    p.facing = character === "momo" ? 1 : -1;
    p.x = character === "momo" ? 520 : 760;
    p.y = FEET_Y;

    const both = this.byCharacter("momo") && this.byCharacter("tiantian");
    this.phase = "lobby";
    this.scene = "lobby";
    this.serverState = both ? "READY" : "WAITING";
    this.pushFx("sfx", { name: "click" });

    if (both) {
      this.startCountdown();
    }
    this.emit();
    return { ok: true };
  }

  startCountdown() {
    this.clearTimer();
    this.countdown = 3;
    this.emit();
    const tick = () => {
      if (this.countdown == null) return;
      if (this.countdown <= 1) {
        this.countdown = null;
        this.beginIntro();
        return;
      }
      this.countdown -= 1;
      this.emit();
      this.timer = setTimeout(tick, 900);
    };
    this.timer = setTimeout(tick, 900);
  }

  beginIntro() {
    this.serverState = "PLAYING";
    this.ldr = { visible: false, scale: 1, mood: "idle" };
    this.progress = emptyProgress();
    this.ldrHearts = LDR_MAX_HEARTS;
    this.dinnerDark = 0;
    this.dinnerTira = 0;
    this.usedCategories = [];
    this.usedDrawWords = new Set();
    this.telepathyCategory = null;
    this.decision = null;
    this.runScript(INTRO_SCRIPT);
  }

  playAgain() {
    if (this.phase !== "complete") return;
    if (this.completeStage !== "credits") {
      this.completeStage = "credits";
      this.endTimer = 0;
      this.emit();
      return;
    }
    this.resetToSelect();
  }

  resetToSelect() {
    this.endTimer = 0;
    this.completeStage = null;
    this.reset(true);
    for (const p of this.players.values()) {
      p.character = null;
      p.x = 640;
      p.y = FEET_Y;
      p.anim = "idle";
      p.facing = 1;
    }
    this.phase = "select";
    this.scene = "select";
    this.serverState = "WAITING";
    this.emit();
  }

  runScript(script) {
    this.phase = "script";
    this.script = script;
    this.scriptIndex = 0;
    this.line = null;
    this.cinematic = null;
    for (const [idx, intro] of Object.entries(TASK_INTROS)) {
      if (intro === script) this.taskIndex = Number(idx);
    }
    if (Object.values(TASK_INTROS).includes(script)) this.showIntroLdr();
    if (script === ENDING_SCRIPT) this.placeReunion();
    this.playNextScript();
  }

  showIntroLdr() {
    this.ldr.visible = true;
    this.ldr.scale = 1;
    this.ldr.mood = "laugh";
  }

  placeReunion() {
    const momo = this.byCharacter("momo");
    const tian = this.byCharacter("tiantian");
    if (momo) {
      momo.x = 380;
      momo.y = FEET_Y;
      momo.anim = "idle";
      momo.facing = 1;
      momo.moving = false;
    }
    if (tian) {
      tian.x = 900;
      tian.y = FEET_Y;
      tian.anim = "idle";
      tian.facing = -1;
      tian.moving = false;
    }
  }

  playNextScript() {
    this.clearTimer();
    const step = this.script[this.scriptIndex];
    if (!step) return;

    if (step.scene) this.scene = step.scene;

    if (step.type === "line") {
      for (const p of this.playerList()) {
        if (p.anim === "sip") p.anim = "idle";
      }
      if (step.fx) this.applyFx(step.fx);
      this.line = {
        speaker: step.speaker,
        text: step.text,
        startedAt: now(),
        minMs: lineDuration(step.text),
      };
      this.cinematic = null;
      this.lockScriptAdvance(280);
      this.emit();
      return;
    }

    if (step.type === "fx") {
      this.applyFx(step.name);
      this.line = null;
      this.scheduleScript(step.ms || 600);
      this.emit();
      return;
    }

    if (step.type === "cinematic") {
      this.applyFx(step.name);
      this.cinematic = { name: step.name, startedAt: now(), ms: step.ms, text: step.text || "" };
      this.line = step.text
        ? { speaker: "", text: step.text, startedAt: now(), minMs: step.ms }
        : null;
      this.scheduleScript(step.ms);
      this.emit();
      return;
    }

    if (step.type === "beginTask") {
      this.runScript(TASK_INTROS[step.index]);
      return;
    }

    if (step.type === "startTask") {
      this.startTask(step.index);
      return;
    }

    if (step.type === "complete") {
      this.phase = "complete";
      this.completeStage = "apart";
      this.endTimer = 0;
      this.scene = "reunion";
      this.serverState = "COMPLETED";
      this.line = null;
      this.ldr.visible = false;
      this.emit();
    }
  }

  advanceScript() {
    this.scriptIndex += 1;
    if (this.scriptIndex >= this.script.length) return;
    this.playNextScript();
  }

  lockScriptAdvance(ms) {
    this.scriptLockUntil = now() + Math.max(0, ms || 0);
  }

  advanceDialogue(playerId) {
    if (this.paused) return;
    if (this.phase !== "script") return;
    if (now() < (this.scriptLockUntil || 0)) return;

    // Let players skip cinematics (e.g. post-boss hug) so dialogue stays click-driven.
    if (this.cinematic) {
      this.clearTimer();
      this.cinematic = null;
      this.line = null;
      this.pushFx("sfx", { name: "click" });
      this.lockScriptAdvance(320);
      this.advanceScript();
      return;
    }

    if (!this.line) return;
    const elapsed = now() - this.line.startedAt;
    const typeDone = Math.floor(elapsed / DIALOGUE_MS_PER_CHAR) >= this.line.text.length;
    if (!this.line.revealed && !typeDone) {
      this.line.revealed = true;
      this.pushFx("sfx", { name: "click" });
      this.emit();
      return;
    }
    this.pushFx("sfx", { name: "click" });
    this.lockScriptAdvance(280);
    this.advanceScript();
  }

  applyFx(name) {
    if (name === "sipMomo" || name === "sipTian") {
      const who = name === "sipMomo" ? "momo" : "tiantian";
      const p = this.byCharacter(who);
      if (p) p.anim = "sip";
      this.pushFx("sfx", { name: "sip" });
    }
    if (name === "offerTira") {
      this.dinnerTira = 1;
      const tian = this.byCharacter("tiantian");
      if (tian) tian.anim = "sip";
      this.pushFx("sfx", { name: "sip" });
    }
    if (name === "tasteTira") {
      this.dinnerTira = 2;
      const momo = this.byCharacter("momo");
      if (momo) momo.anim = "sip";
      this.pushFx("sfx", { name: "sip" });
    }
    if (name === "uneasy") {
      this.dinnerDark = 0.5;
      this.pushFx("shake", { mag: 4, dur: 1800 });
      this.pushFx("sfx", { name: "rumble" });
    }
    if (name === "rumble") {
      this.pushFx("shake", { mag: 5, dur: 700 });
      this.pushFx("sfx", { name: "rumble" });
    }
    if (name === "ldrAppear") {
      this.ldr.visible = true;
      this.ldr.scale = 1;
      this.ldr.mood = "laugh";
      this.dinnerDark = 0.55;
      this.pushFx("shake", { mag: 14, dur: 900 });
      this.pushFx("flash", { color: "#ffffff", dur: 180 });
      this.pushFx("sfx", { name: "boom" });
    }
    if (name === "separate") {
      this.ldr.mood = "attack";
      const momo = this.byCharacter("momo");
      const tian = this.byCharacter("tiantian");
      if (momo) {
        momo.x = 160;
        momo.y = FEET_Y;
        momo.facing = 1;
      }
      if (tian) {
        tian.x = 1120;
        tian.y = FEET_Y;
        tian.facing = -1;
      }
      this.pushFx("shake", { mag: 18, dur: 1200 });
      this.pushFx("sfx", { name: "separate" });
    }
    if (name === "fade") {
      this.ldr.mood = "idle";
    }
    if (name === "ldrShrink") {
      this.ldr.mood = "hurt";
      this.ldr.scale = 0.35;
      this.pushFx("sfx", { name: "victory" });
    }
    if (name === "hug") {
      this.placeReunion();
      this.ldr.visible = false;
      this.dinnerDark = 0;
      this.pushFx("hearts", { n: 24 });
      this.pushFx("confettiSides", { n: 40 });
      this.pushFx("sfx", { name: "victory" });
    }
  }

  pushFx(type, data) {
    this.fx.push({ type, id: uid(), ...(data || {}) });
    if (this.fx.length > 24) this.fx = this.fx.slice(-16);
  }

  consumeFx() {
    const out = this.fx;
    this.fx = [];
    return out;
  }

  placeSplit() {
    const momo = this.byCharacter("momo");
    const tian = this.byCharacter("tiantian");
    if (momo) {
      momo.x = 180;
      momo.y = FEET_Y;
      momo.facing = 1;
      momo.anim = "idle";
    }
    if (tian) {
      tian.x = 1100;
      tian.y = FEET_Y;
      tian.facing = -1;
      tian.anim = "idle";
    }
  }

  startTask(index) {
    this.decision = null;
    this.taskIndex = index;
    this.phase = "play";
    this.scene = "task";
    this.line = null;
    this.cinematic = null;
    this.failMessage = null;
    this.placeSplit();
    if (index === 1) this.setupTask1();
    if (index === 2) this.setupTask2();
    if (index === 3) this.setupTask3();
    if (index === 4) this.setupTask4();
    if (index === 5) this.setupTask5();
    this.emit();
  }

  setupTask1() {
    this.usedCategories = this.usedCategories || [];
    this.telepathyCategory = this.nextCategory();
    this.nextTelepathyRound(true);
    this.ldr.visible = true;
    this.ldr.scale = 0.42;
    this.ldr.mood = "idle";
  }

  nextCategory() {
    const left = CATEGORIES.filter((c) => !(this.usedCategories || []).includes(c));
    const pool = left.length ? left : CATEGORIES.slice();
    const cat = pick(pool);
    this.usedCategories = (this.usedCategories || []).concat([cat]);
    return cat;
  }

  nextTelepathyRound(fresh) {
    this.failMessage = null;
    const history = fresh ? [] : (this.task && this.task.history) || [];
    const round = fresh ? 1 : (this.task.round || 1) + 1;
    if (fresh && !this.telepathyCategory) this.telepathyCategory = this.nextCategory();
    const category = fresh ? this.telepathyCategory : (this.task && this.task.category) || this.telepathyCategory;
    this.task = {
      index: 1,
      stage: "input",
      round,
      category,
      timeLeft: TELEPATHY_TIME,
      words: { momo: "", tiantian: "" },
      ready: { momo: false, tiantian: false },
      history,
      last: null,
      hold: 0,
    };
  }

  setupTask2() {
    this.resetQuizSet();
    this.ldr.visible = true;
    this.ldr.scale = 0.4;
    this.ldr.mood = "idle";
  }

  resetQuizSet() {
    this.failMessage = null;
    this.task = {
      index: 2,
      setId: uid(),
      stage: "create",
      questions: { momo: [], tiantian: [] },
      answers: { momo: [], tiantian: [] },
      feedback: { momo: null, tiantian: null },
      scores: { momo: 0, tiantian: 0 },
      passed: false,
      hold: 0,
    };
  }

  setupTask3() {
    this.ldr.visible = false;
    this.beginDrawTurn("momo", { momo: false, tiantian: false });
  }

  beginDrawTurn(drawer, passedTurns) {
    this.failMessage = null;
    if (!(this.usedDrawWords instanceof Set)) this.usedDrawWords = new Set(this.usedDrawWords || []);
    const words = pickDrawWords(this.usedDrawWords);
    this.task = {
      index: 3,
      stage: "draw",
      drawer,
      guesser: drawer === "momo" ? "tiantian" : "momo",
      words,
      wordIndex: 0,
      guessed: 0,
      timeLeft: DRAW_TURN,
      elapsed: 0,
      strokes: [],
      strokeId: null,
      tool: "pencil",
      guess: "",
      feedback: null,
      banner: null,
      hold: 0,
      hintLeft: 2,
      hintPos: [],
      passedTurns: passedTurns || { momo: false, tiantian: false },
    };
    this.emit();
  }

  setupTask4() {
    this.ldr.visible = false;
    this.task = {
      index: 4,
      stage: "intro",
      timeLeft: PIANO_TIME,
      elapsed: 0,
      tiles: [],
      chart: pianoChart(),
      nextEvent: 0,
      hearts: PIANO_HEARTS,
      banner: null,
      lastHit: null,
      pressCount: [0, 0, 0, 0, 0, 0],
      noteMsg: null,
      noteMsgUntil: 0,
    };
  }

  setupTask5() {
    this.ldr.visible = false;
    this.resetBossPhase1();
  }

  resetBossPhase1() {
    this.beginBossFight(true);
  }

  beginBossFight(fresh) {
    const prev = this.task && this.task.index === 5 ? this.task : null;
    const momo = this.byCharacter("momo");
    const tian = this.byCharacter("tiantian");
    if (momo) {
      momo.x = COURT.x + 160;
      momo.y = NET_Y + 140;
    }
    if (tian) {
      tian.x = COURT.x + 400;
      tian.y = NET_Y + 140;
    }
    const hearts = fresh || !prev ? { momo: 3, tiantian: 3 } : applyPhaseHearts(prev.hearts, false);
    const ownedShield = !!(prev && prev.buffs && prev.buffs.shield);
    const buffs =
      fresh || !prev || !prev.buffs
        ? { shield: false, racket: false }
        : { shield: ownedShield, racket: !!prev.buffs.racket };
    const gunLevel =
      fresh || !prev
        ? 0
        : teamGunLevel(prev) || (prev.buffs && prev.buffs.rapid ? 2 : 0);
    const coins = fresh || !prev ? 0 : normalizeCoins(prev.coins);
    this.task = {
      index: 5,
      stage: "dodgeIntro",
      timeLeft: BOSS_PHASE1,
      elapsed: 0,
      nextShot: 0,
      nextYellow: BOSS_YELLOW_EVERY,
      yellowAtk: null,
      silence: false,
      hearts,
      invuln: { momo: 0, tiantian: 0 },
      hurtFlash: { momo: 0, tiantian: 0 },
      fireCd: { momo: 0, tiantian: 0 },
      red: [],
      blue: [],
      yellow: [],
      yellowWarn: null,
      aoe: null,
      nextAoe: BOSS_AOE_EVERY,
      walls: [],
      wallTimer: 0,
      blueWall: null,
      blueWallTimer: 0,
      reflect: [],
      coins,
      gunLevel,
      coinsOnCourt: [],
      nextCoin: COIN_EVERY,
      hpOnCourt: [],
      nextHp: HP_EVERY,
      buffs,
      minions: fresh || !prev ? [] : prev.minions || [],
      minionShots: fresh || !prev ? [] : prev.minionShots || [],
      racket: fresh || !prev || !prev.racket ? { momo: RACKET_MAX, tiantian: RACKET_MAX } : prev.racket,
      racketRegen: fresh || !prev || !prev.racketRegen ? { momo: 0, tiantian: 0 } : prev.racketRegen,
      racketCd: fresh || !prev || !prev.racketCd ? emptyRacketSideCd() : prev.racketCd,
      shieldHits:
        fresh || !prev || !prev.shieldHits
          ? {
              momo: ownedShield && !fresh ? shieldMaxFor(prev, "momo") : 0,
              tiantian: ownedShield && !fresh ? shieldMaxFor(prev, "tiantian") : 0,
            }
          : { momo: prev.shieldHits.momo || 0, tiantian: prev.shieldHits.tiantian || 0 },
      shieldMax:
        fresh || !prev
          ? { momo: SHIELD_MAX, tiantian: SHIELD_MAX }
          : typeof prev.shieldMax === "number"
            ? { momo: prev.shieldMax, tiantian: prev.shieldMax }
            : {
                momo: (prev.shieldMax && prev.shieldMax.momo) || SHIELD_MAX,
                tiantian: (prev.shieldMax && prev.shieldMax.tiantian) || SHIELD_MAX,
              },
      angryAttackWave: fresh || !prev ? 0 : prev.angryAttackWave || 0,
      seenTips:
        fresh || !prev || !prev.seenTips
          ? { rage: false, wall: false, minion: false, yellow: false, special: false }
          : prev.seenTips,
      timerBonus: 0,
      enrageGraceApplied: false,
      bonusFlashTimer: 0,
      tipQueue: [],
      brief: phaseTitleBrief("dodgeIntro"),
      shopPick: null,
      shopBuyVote: { momo: null, tiantian: null },
      shopLast: null,
      shopMsg: null,
      smash: [],
      shopBought: { shield: false, racket: false },
      shopHealed: false,
      shopVote: { momo: null, tiantian: null },
      shopReady: { momo: false, tiantian: false },
      shopTimer: 0,
      ldr: { x: COURT.x + COURT.w / 2, y: BOSS_Y, r: BOSS_R, dir: 1, cycle: 0, angry: false, phaseRest: 0, aoe: false },
      hits: fresh || !prev ? 0 : prev.hits || 0,
      banner: "DODGE!",
      hold: 0,
      finalPhase: false,
      finalWallLocked: false,
    };
    this.task.ldr.angry = bossAngry(this.task.hits);
  }

  placeBossPlayers() {
    const momo = this.byCharacter("momo");
    const tian = this.byCharacter("tiantian");
    if (momo) {
      momo.x = COURT.x + 160;
      momo.y = NET_Y + 140;
    }
    if (tian) {
      tian.x = COURT.x + 400;
      tian.y = NET_Y + 140;
    }
  }

  noteShopClick(ch, text) {
    const t = this.task;
    t.shopLast = { who: playerName(ch), text };
  }

  beginShopAsk() {
    const t = this.task;
    t.stage = "shopAsk";
    t.shopTimer = SHOP_ASK;
    t.shopVote = { momo: null, tiantian: null };
    t.shopReady = { momo: false, tiantian: false };
    t.shopPick = null;
    t.brief = null;
    t.tipQueue = [];
    t.banner = "WOULD YOU LIKE TO VISIT THE SHOP?";
    t.aoe = null;
    t.yellowWarn = null;
    t.coinsOnCourt = [];
    t.hpOnCourt = [];
    t.shopHealed = false;
    t.shopLast = null;
    t.shopLdr = null;
    t.shopToast = null;
    t.shopToastTimer = 0;
    t.shopBuyVote = { momo: null, tiantian: null };
    t.shopMsg = null;
    if (t.ldr) t.ldr.aoe = false;
  }

  openShop() {
    const t = this.task;
    t.stage = "shop";
    t.shopTimer = 0;
    t.shopReady = { momo: false, tiantian: false };
    t.shopPick = null;
    t.shopBuyVote = { momo: null, tiantian: null };
    t.shopBought = { shield: false, racket: false };
    t.shopMsg = null;
    t.shopLdr = null;
    t.shopToast = null;
    t.shopToastTimer = 0;
    t.banner = "SHOP";
    if (!t.shopHealed) {
      t.hearts = t.hearts || { momo: 3, tiantian: 3 };
      for (const ch of ["momo", "tiantian"]) t.hearts[ch] = Math.min(3, (t.hearts[ch] || 0) + 1);
      t.shopHealed = true;
    }
    this.pushFx("sfx", { name: "click" });
  }

  enterPlayerAttack() {
    const t = this.task;
    this.placeBossPlayers();
    t.hearts = t.hearts || { momo: 3, tiantian: 3 };
    for (const ch of ["momo", "tiantian"]) {
      if ((t.hearts[ch] || 0) <= 0) t.hearts[ch] = 2;
    }
    t.coinsOnCourt = [];
    t.hpOnCourt = [];
    t.banner = "GET READY!";
    t.hold = 0;
    t.fireCd = { momo: 0, tiantian: 0 };
    t.shopVote = { momo: null, tiantian: null };
    t.shopReady = { momo: false, tiantian: false };
    t.shopPick = null;
    t.shopBuyVote = { momo: null, tiantian: null };
    t.brief = null;
    t.timeLeft = BOSS_PHASE2;
    t.elapsed = 0;
    t.timerBonus = 0;
    t.enrageGraceApplied = false;
    t.bonusFlashTimer = 0;
    t.blue = [];
    t.red = [];
    t.yellow = [];
    t.yellowWarn = null;
    t.aoe = null;
    t.reflect = [];
    if (t.ldr) {
      t.ldr.angry = bossAngry(t.hits);
      t.ldr.phaseRest = 0;
      t.ldr.cycle = 0;
      t.ldr.aoe = false;
    }
    t.walls = [];
    t.stage = "attackIntro";
    t.brief = phaseTitleBrief("attackIntro");
  }

  startBossPhase2() {
    const t = this.task;
    t.stage = "phase2";
    t.brief = null;
    t.banner = "NOW ATTACK LDR!";
    if (t.ldr) {
      t.ldr.angry = bossAngry(t.hits);
      t.ldr.phaseRest = t.ldr.angry ? 1.5 : 0;
      t.ldr.cycle = 0;
      t.ldr.aoe = false;
    }
    if (t.ldr && t.ldr.angry) {
      applyEnrageTimerBonus(t);
      t.wallTimer = 0;
      spawnBossWall(t);
      advanceAngryAttackWave(t);
      spawnMinions(t);
      this.queueBossTip("rage");
      this.queueBossTip("wall");
      this.queueBossTip("minion");
      this.queueBossTip("yellow");
      this.queueBossTip("special");
    } else t.walls = [];
  }

  beginFinalPhase() {
    const t = this.task;
    if (!t || t.finalPhase) return;
    t.finalPhase = true;
    t.stage = "final";
    t.hits = BOSS_FINAL_HITS;
    t.timeLeft = null;
    t.banner = "FINAL PHASE!";
    t.tipQueue = [];
    t.blue = [];
    t.red = [];
    t.yellow = [];
    t.yellowWarn = null;
    t.yellowAtk = null;
    t.reflect = [];
    t.aoe = null;
    if (t.ldr) {
      t.ldr.x = COURT.x + COURT.w / 2;
      t.ldr.y = BOSS_Y;
      t.ldr.angry = true;
      t.ldr.dir = 0;
      t.ldr.phaseRest = 0;
      t.ldr.cycle = 0;
      t.ldr.aoe = false;
    }
    spawnFinalMinions(t);
    spawnFinalWall(t);
    t.finalWallLocked = true;
    t.blueWall = null;
    t.blueWallTimer = 0.6;
    t.nextShot = (t.elapsed || 0) + 0.8;
    t.nextYellow = (t.elapsed || 0) + 1.2;
    t.nextAoe = (t.elapsed || 0) + 2.5;
    t.nextHp = (t.elapsed || 0) + HP_EVERY;
    t.brief = {
      kind: "final",
      lines: [
        "This is it! My FINAL form! No more timers, no more breaks — just you versus ME!",
        "I brought SIX of my finest minions, and a red wall that stays WHITE and invincible while even one of them still stands!",
        "Your blue birdies? They bounce right off my wall! But MY red and yellow birdies sail straight through — ha!",
        "I'll drop BLUE walls on YOUR side — red and yellow both smash into them (yellow hits harder!). Your blue shots still fly straight through!",
        "Watch for my AOE blasts too! Clear my minions, smash the red wall, then finish me. Guns are free game!",
      ],
      i: 0,
      acked: false,
      ack: { momo: false, tiantian: false },
      overlay: false,
      startedAt: now(),
      revealed: false,
    };
    this.pushFx("flash", { color: "#ff3b4a", dur: 400 });
    this.pushFx("sfx", { name: "rumble" });
    this.pushFx("shake", { mag: 10, dur: 320 });
    this.emit();
  }

  damageBoss(amount) {
    const t = this.task;
    if (!t || t.index !== 5) return;
    const n = amount == null ? 1 : amount;
    if (t.finalPhase) {
      if (t.brief && (t.brief.kind === "final" || t.brief.kind === "finalTitle")) return;
      t.hits = Math.min(BOSS_HITS, (t.hits || 0) + n);
      return;
    }
    const next = (t.hits || 0) + n;
    if (next >= BOSS_FINAL_HITS) {
      t.hits = BOSS_FINAL_HITS;
      this.beginFinalPhase();
      return;
    }
    t.hits = next;
  }

  queueBossTip(kind) {
    const t = this.task;
    if (!t || t.index !== 5) return;
    t.seenTips = t.seenTips || { rage: false, wall: false, minion: false, yellow: false, special: false };
    if (t.seenTips[kind]) return;
    t.seenTips[kind] = true;
    const lines =
      kind === "rage"
        ? ["NOW I AM FURIOUS!"]
        : kind === "wall"
          ? [
              "Whoa, whoa! Don't get too comfortable! See that red wall? It blocks your birdies, reflects them back, and even changes their color. Hitting me just got a lot harder!",
            ]
          : kind === "minion"
            ? [
                "Oh, and I brought some little helpers!",
                "They'll keep firing at you while you're trying to fight me.",
                "I'd recommend taking them out first!",
              ]
            : kind === "yellow"
              ? [
                  "And now that I'm angry, I've got a new trick!",
                  "I'll fire TWO yellow birdies instead of one!",
                  "I'll target one of you first, then I'll target the other!",
                  "So pay attention to those warning lines and don't get caught!",
                ]
              : [
                  "Oh, and watch out for my purple attacks! During the attack phase, purple circles will appear around the arena. Stay outside them when they trigger, unless you're looking to lose a heart!",
                ];
    t.tipQueue = t.tipQueue || [];
    t.tipQueue.push({ kind, lines });
    if (!t.brief) this.openNextBossTip();
  }

  openNextBossTip() {
    const t = this.task;
    const next = (t.tipQueue || []).shift();
    if (!next) {
      t.brief = null;
      t.grace = 0;
      this.emit();
      return;
    }
    t.brief = {
      kind: next.kind,
      lines: next.lines,
      i: 0,
      acked: false,
      ack: { momo: false, tiantian: false },
      overlay: false,
      startedAt: now(),
      revealed: false,
    };
    this.pushFx("sfx", { name: "click" });
    this.emit();
  }

  ackBossTip(ch) {
    const t = this.task;
    if (!t || !t.brief || t.brief.acked) return;
    this.pushFx("sfx", { name: "click" });
    if (t.brief.kind === "dodgeIntro") {
      t.brief.acked = true;
      t.brief = null;
      t.stage = "phase1";
      t.elapsed = 0;
      t.timeLeft = BOSS_PHASE1 + (t.timerBonus || 0);
      this.emit();
      return;
    }
    if (t.brief.kind === "attackIntro") {
      t.brief.acked = true;
      this.startBossPhase2();
      this.emit();
      return;
    }
    if (t.brief.kind === "finalTitle") {
      t.brief.acked = true;
      t.brief = null;
      t.stage = "final";
      spawnBlueWall(t);
      this.emit();
      return;
    }
    const text = (t.brief.lines || [])[t.brief.i] || "";
    const elapsed = now() - (t.brief.startedAt || now());
    const typeDone = Math.floor(elapsed / DIALOGUE_MS_PER_CHAR) >= text.length;
    if (!t.brief.revealed && !typeDone) {
      t.brief.revealed = true;
      this.emit();
      return;
    }
    if (t.brief.i < (t.brief.lines || []).length - 1) {
      t.brief.i += 1;
      t.brief.startedAt = now();
      t.brief.revealed = false;
      this.emit();
      return;
    }
    if (t.brief.kind === "final") {
      t.brief = phaseTitleBrief("finalTitle");
      t.stage = "finalTitle";
      this.emit();
      return;
    }
    t.brief.acked = true;
    this.openNextBossTip();
  }

  setInput(playerId, data) {
    this.inputs.set(playerId, data || {});
  }

  tick() {
    if (this.paused) return;
    const dt = TICK_MS / 1000;
    if (this.phase === "complete") {
      this.tickComplete(dt);
      return;
    }
    if (this.phase === "decide") {
      this.tickDecision(dt);
      return;
    }
    if (this.phase !== "play" || !this.task) return;
    const index = this.task.index;
    if (index === 1) {
      this.tickTask1(dt);
      if (this.phase === "play" && this.task) this.emit();
    } else if (index === 2) {
      if (this.task.stage === "score") {
        this.tickTask2(dt);
        if (this.phase === "play" && this.task) this.emit();
      }
    } else if (index === 3) {
      this.tickTask3(dt);
      if (this.phase === "play" && this.task) this.emit();
    } else if (index === 4) {
      this.tickTask4(dt);
      if (this.phase === "play" && this.task) this.emit();
    } else if (index === 5) {
      this.tickTask5(dt);
      if (this.phase === "play" && this.task) this.emit();
    }
  }

  tickComplete() {
    // Final credits wait for click — no auto countdown / restart.
  }

  tickTask1(dt) {
    const t = this.task;
    if (t.stage === "input") {
      t.timeLeft = Math.max(0, t.timeLeft - dt);
      if (t.timeLeft <= 0 || (t.ready.momo && t.ready.tiantian)) this.resolveTelepathy();
    } else if (t.stage === "reveal") {
      t.hold -= dt;
      if (t.hold <= 0) {
        if (t.last && t.last.match) this.completeTask();
        else if ((t.round || 1) >= 3) this.beginDecision(1, true);
        else this.nextTelepathyRound(false);
      }
    }
  }

  resolveTelepathy() {
    const t = this.task;
    if (t.stage !== "input") return;
    const a = normWord(t.words.momo);
    const b = normWord(t.words.tiantian);
    const match = a.length > 0 && a === b;
    t.last = {
      attempt: t.round,
      momo: t.words.momo || "(blank)",
      tiantian: t.words.tiantian || "(blank)",
      match,
    };
    t.history = (t.history || []).concat([t.last]);
    t.stage = "reveal";
    t.hold = match ? 1.2 : 3.2;
    if (match) {
      this.pushFx("sfx", { name: "victory" });
      this.pushFx("confettiSides", { n: 36 });
      this.pushFx("flash", { color: "#ffd1e8", dur: 280 });
      t.hold = 1.8;
      t.banner = "GAME 1 COMPLETE!";
    } else {
      this.failMessage = "LDR: Hah! Your brain connection isn't THAT strong!";
      this.pushFx("sfx", { name: "hurt" });
      this.ldr.mood = "laugh";
    }
  }

  tickTask2(dt) {
    const t = this.task;
    if (t.stage === "score") {
      t.hold -= dt;
      if (t.hold <= 0) {
        if (t.passed) this.completeTask();
        else this.beginDecision(2, true);
      }
    }
  }

  tickTask3(dt) {
    const t = this.task;
    if (t.stage === "hold") {
      t.hold -= dt;
      if (t.hold <= 0) this.afterDrawHold();
      return;
    }
    if (t.stage !== "draw") return;
    t.elapsed += dt;
    t.timeLeft = Math.max(0, DRAW_TURN - t.elapsed);
    if (t.feedback && t.feedback.until) {
      if (now() > t.feedback.until) t.feedback = null;
    }
    if (t.guessed >= 3) {
      this.finishDrawTurn(true);
      return;
    }
    if (t.timeLeft <= 0) this.finishDrawTurn(false);
  }

  finishDrawTurn(success) {
    const t = this.task;
    if (t.stage !== "draw") return;
    if (success) t.passedTurns[t.drawer] = true;
    t.stage = "hold";
    t.hold = 1.6;
    t.banner = success ? "TURN COMPLETE!" : "TIME UP!";
    t.strokes = [];
    t.strokeId = null;
    this.pushFx("sfx", { name: success ? "success" : "hurt" });
    if (success) this.pushFx("confettiSides", { n: 16 });
  }

  afterDrawHold() {
    const t = this.task;
    const passed = t.passedTurns;
    if (passed.momo && passed.tiantian) {
      this.completeTask();
      return;
    }
    const next = t.drawer === "momo" ? "tiantian" : "momo";
    const who = passed[next] ? t.drawer : next;
    this.beginDrawTurn(who, passed);
  }

  tickTask4(dt) {
    const t = this.task;
    if (t.stage === "intro") return;
    if (t.stage === "fail") {
      t.hold -= dt;
      if (t.hold <= 0) this.beginDecision(4, true);
      return;
    }
    if (t.stage === "done") {
      t.hold -= dt;
      if (t.hold <= 0) this.completeTask();
      return;
    }
    t.elapsed += dt;
    t.timeLeft = Math.max(0, PIANO_TIME - t.elapsed);
    const speed = t.elapsed >= PIANO_FAST_AT ? 0.82 : 0.52;
    const hitLine = 0.82;
    if (!t.pressCount) t.pressCount = [0, 0, 0, 0, 0, 0];
    const held = this.pianoLanesHeld();
    if (t.noteMsgUntil && t.elapsed >= t.noteMsgUntil) {
      t.noteMsg = null;
      t.noteMsgUntil = 0;
      if (t.banner === "MISS!" || t.banner === "HOLD COMPLETE") t.banner = null;
    }

    for (const tile of t.tiles) {
      tile.y += speed * dt;
    }

    const missTile = (tile) => {
      if (tile.holding || tile.hold) this.pushFx("noteOff", { id: tile.id });
      t.hearts = Math.max(0, (t.hearts == null ? PIANO_HEARTS : t.hearts) - 1);
      t.lastHit = { lane: tile.lane, ok: false };
      t.noteMsg = "MISS!";
      t.banner = "MISS!";
      t.noteMsgUntil = t.elapsed + 0.55;
      this.pushFx("sfx", { name: "hurt" });
    };

    const kept = [];
    for (const tile of t.tiles) {
      const lane = tile.lane;
      const pressing = !!held[lane];
      if (tile.hold) {
        const len = Math.max(0.28, tile.len || 0.32);
        tile.len = len;
        const inBox = tile.y >= hitLine - PIANO_HIT && tile.y - len <= hitLine + PIANO_HIT;
        if (!tile.holding && !tile.hit && pressing && inBox) {
          tile.holding = true;
          tile.heldFor = 0;
          tile.holdProg = 0;
          this.pushFx("note", { freq: PIANO_FREQ[lane], hold: true, id: tile.id });
        }
        if (tile.holding) {
          if (!pressing) {
            missTile(tile);
            continue;
          }
          tile.heldFor = (tile.heldFor || 0) + dt;
          tile.holdProg = clamp((tile.y - hitLine) / Math.max(0.12, len), 0, 1);
          if (tile.y - len >= hitLine - 0.02 && tile.heldFor >= 0.08) {
            tile.hit = true;
            tile.holding = false;
            tile.holdProg = 1;
            t.lastHit = { lane, ok: true, hold: true };
            t.noteMsg = "HOLD COMPLETE";
            t.banner = "HOLD COMPLETE";
            t.noteMsgUntil = t.elapsed + 0.55;
            this.pushFx("noteOff", { id: tile.id });
            this.pushFx("sfx", { name: "success" });
            continue;
          }
        } else if (!pressing && tile.y > hitLine + PIANO_HIT) {
          missTile(tile);
          continue;
        }
        kept.push(tile);
        continue;
      }
      if (tile.hit) continue;
      if (tile.y > 0.94) {
        missTile(tile);
        continue;
      }
      kept.push(tile);
    }
    t.tiles = kept;

    if (t.hearts <= 0) {
      t.stage = "fail";
      t.hold = 1.6;
      t.banner = "TOO MANY MISSES! TRY AGAIN";
      for (const tile of t.tiles) this.pushFx("noteOff", { id: tile.id });
      t.tiles = [];
      this.pushFx("sfx", { name: "hurt" });
      return;
    }

    while (t.nextEvent < t.chart.length && t.chart[t.nextEvent].t <= t.elapsed) {
      const ev = t.chart[t.nextEvent];
      const notes = (ev.notes || (ev.lanes || []).map((lane) => ({ lane, hold: 0 }))).slice(0, 2);
      const toAdd = [];
      const imagined = t.tiles.slice();
      for (const n of notes) {
        if (imagined.length >= 2) break;
        const col = laneColor(n.lane);
        if (imagined.some((tile) => laneColor(tile.lane) === col)) continue;
        toAdd.push(n);
        imagined.push({ lane: n.lane });
      }
      if (!toAdd.length) break;
      t.nextEvent += 1;
      for (const n of toAdd) {
        t.tiles.push({
          id: uid(),
          lane: n.lane,
          y: 0,
          hit: false,
          hold: !!n.hold,
          len: n.hold ? Math.max(0.32, n.hold) : 0.07,
          holding: false,
          heldFor: 0,
          holdProg: 0,
          color: laneColor(n.lane),
        });
      }
    }
    if (t.elapsed >= PIANO_TIME) {
      t.stage = "done";
      t.hold = 1.4;
      t.banner = "GAME 4 COMPLETE!";
      for (const tile of t.tiles) this.pushFx("noteOff", { id: tile.id });
      t.tiles = [];
      this.pushFx("sfx", { name: "victory" });
      this.pushFx("confettiSides", { n: 28 });
    }
  }

  tickTask5(dt) {
    const t = this.task;
    if (t.stage === "fail1" || t.stage === "failShow" || t.stage === "failWait") return;
    if (t.brief && briefPausesGame(t.brief, t.stage)) return;
    if (t.stage === "winWait") return;
    if (t.stage === "win") {
      t.hold -= dt;
      if (t.hold <= 0) this.completeTask();
      return;
    }
    if (t.stage === "to2") {
      t.hold -= dt;
      if (t.hold <= 0) this.beginShopAsk();
      return;
    }
    if (t.stage === "shopAsk") {
      t.shopTimer = Math.max(0, (t.shopTimer || 0) - dt);
      const v = t.shopVote || { momo: null, tiantian: null };
      if (v.momo === "no" && v.tiantian === "no") {
        this.enterPlayerAttack();
        return;
      }
      if (v.momo === "yes" && v.tiantian === "yes") {
        this.openShop();
        return;
      }
      if (t.shopTimer <= 0) this.openShop();
      return;
    }
    if (t.stage === "shop") {
      if ((t.shopToastTimer || 0) > 0) {
        t.shopToastTimer = Math.max(0, t.shopToastTimer - dt);
        if (t.shopToastTimer <= 0) t.shopToast = null;
      }
      const r = t.shopReady || { momo: false, tiantian: false };
      if (r.momo && r.tiantian) this.enterPlayerAttack();
      return;
    }
    if (t.stage === "attackIntro" || t.stage === "dodgeIntro" || t.stage === "finalTitle") return;

    if (t.bonusFlashTimer > 0) {
      t.bonusFlashTimer = Math.max(0, t.bonusFlashTimer - dt);
    }

    if (t.stage === "to1") {
      t.hold -= dt;
      if (t.hold <= 0) this.beginBossFight(false);
      return;
    }

    t.invuln.momo = Math.max(0, t.invuln.momo - dt);
    t.invuln.tiantian = Math.max(0, t.invuln.tiantian - dt);
    t.hurtFlash = t.hurtFlash || { momo: 0, tiantian: 0 };
    t.hurtFlash.momo = Math.max(0, t.hurtFlash.momo - dt);
    t.hurtFlash.tiantian = Math.max(0, t.hurtFlash.tiantian - dt);
    t.fireCd.momo = Math.max(0, t.fireCd.momo - dt);
    t.fireCd.tiantian = Math.max(0, t.fireCd.tiantian - dt);

    if ((t.grace || 0) > 0) t.grace = 0;
    t.elapsed += dt;
    if ((t.shopToastTimer || 0) > 0) {
      t.shopToastTimer = Math.max(0, t.shopToastTimer - dt);
      if (t.shopToastTimer <= 0) t.shopToast = null;
    }
    syncBossTimeLeft(t);

    this.tickBossPlayers(dt);
    this.tickRacketRegen(dt);
    this.tickBossLdr(dt);
    if (t.walls && t.walls[0] && t.ldr) attachWallToBoss(t.walls[0], t.ldr);
    this.tickBossShots(dt);
    const nowAngry = bossAngry(t.hits);
    if (nowAngry && t.ldr && !t.ldr.angry && !t.finalPhase) {
      t.ldr.angry = true;
      applyEnrageTimerBonus(t);
      t.ldr.phaseRest = t.stage === "phase2" ? 1.5 : t.ldr.phaseRest;
      this.pushFx("flash", { color: "#ff3b4a", dur: 320 });
      this.pushFx("sfx", { name: "rumble" });
      this.pushFx("shake", { mag: 8, dur: 280 });
      this.queueBossTip("rage");
      this.queueBossTip("wall");
      this.queueBossTip("minion");
      this.queueBossTip("yellow");
      this.queueBossTip("special");
      if (t.stage === "phase2") {
        if (!(t.angryAttackWave > 0)) t.angryAttackWave = 1;
        spawnMinions(t);
        spawnBossWall(t);
      }
    }
    if (t.ldr) t.ldr.angry = nowAngry || !!t.finalPhase;
    if (t.stage === "final" || t.finalPhase) {
      t.finalWallLocked = (t.minions || []).length > 0;
      if (t.walls && t.walls[0]) {
        t.walls[0].flash = Math.max(0, (t.walls[0].flash || 0) - dt);
        if (t.ldr) attachWallToBoss(t.walls[0], t.ldr);
      } else if (!t.finalWallLocked) {
        // Wall already destroyed and unlocked — stay open.
      } else {
        spawnFinalWall(t);
      }
      if (t.blueWall) {
        t.blueWall.flash = Math.max(0, (t.blueWall.flash || 0) - dt);
      } else {
        t.blueWallTimer = Math.max(0, (t.blueWallTimer || 0) - dt);
        if ((t.blueWallTimer || 0) <= 0 && !t.brief) spawnBlueWall(t);
      }
    } else if (t.stage === "phase2" && nowAngry) {
      if (t.walls && t.walls[0]) {
        t.walls[0].flash = Math.max(0, (t.walls[0].flash || 0) - dt);
      } else {
        t.wallTimer = (t.wallTimer || 0) - dt;
        if ((t.wallTimer || 0) <= 0) spawnBossWall(t);
      }
    } else if (t.stage !== "final") {
      t.walls = [];
      t.blueWall = null;
    }
    if (t.stage !== "phase1" && t.stage !== "final" && !t.finalPhase) {
      t.aoe = null;
      t.shieldPickups = [];
      if (t.ldr) t.ldr.aoe = false;
    }

    if (t.stage === "phase1") {
      if (t.hearts.momo <= 0 && t.hearts.tiantian <= 0) {
        this.startBossDefeat();
        return;
      }
      if (t.timeLeft <= 0) {
        t.stage = "to2";
        t.hold = 0.4;
        t.banner = "NOW ATTACK LDR!";
        t.red = [];
        t.yellow = [];
        t.yellowWarn = null;
        t.aoe = null;
        t.walls = [];
        t.reflect = [];
        t.shieldPickups = [];
        if (t.ldr) t.ldr.aoe = false;
        this.pushFx("sfx", { name: "success" });
      }
    } else if (t.stage === "phase2" || t.stage === "final") {
      if (t.hits >= BOSS_HITS) {
        t.stage = "winWait";
        t.hold = 0;
        t.banner = null;
        t.silence = true;
        t.brief = null;
        t.blue = [];
        t.red = [];
        t.yellow = [];
        t.yellowPend = null;
        t.yellowWarn = null;
        t.aoe = null;
        t.walls = [];
        t.blueWall = null;
        t.reflect = [];
        t.shieldPickups = [];
        t.minions = [];
        t.minionShots = [];
        if (t.ldr) {
          t.ldr.explode = true;
          t.ldr.mood = "hurt";
        }
        this.pushFx("shake", { mag: 16, dur: 700 });
        this.pushFx("explode", { x: t.ldr.x, y: t.ldr.y, n: 48 });
        this.pushFx("flash", { color: "#fff7c2", dur: 220 });
        this.pushFx("sfx", { name: "boom" });
        this.pushFx("sfx", { name: "victory" });
        this.pushFx("confettiSides", { n: 40 });
        return;
      }
      if (t.hearts.momo <= 0 && t.hearts.tiantian <= 0) {
        this.startBossDefeat();
        return;
      }
      if (t.stage === "phase2" && !t.finalPhase && t.timeLeft <= 0) {
        t.stage = "to1";
        t.hold = 1.2;
        t.banner = "BOSS ATTACKS AGAIN!";
        t.blue = [];
        t.walls = [];
        t.reflect = [];
        this.pushFx("sfx", { name: "hurt" });
      }
    }
  }

  tickBossPlayers(dt) {
    const t = this.task;
    const size = 26;
    const players = [
      { ch: "momo", p: this.byCharacter("momo") },
      { ch: "tiantian", p: this.byCharacter("tiantian") },
    ];
    const speed = 240;
    const minX = COURT.x + 18;
    const maxX = COURT.x + COURT.w - 18;
    const minY = NET_Y + 18;
    const maxY = COURT.y + COURT.h - 18;

    for (const { ch, p } of players) {
      if (!p) continue;
      if (t.hearts[ch] <= 0) {
        p.moving = false;
        continue;
      }
      const inp = this.inputs.get(p.id) || {};
      let dx = 0;
      let dy = 0;
      if (inp.left) dx -= 1;
      if (inp.right) dx += 1;
      if (inp.up) dy -= 1;
      if (inp.down) dy += 1;
      if (dx && dy) {
        dx *= 0.707;
        dy *= 0.707;
      }
      p.x = clamp(p.x + dx * speed * dt, minX, maxX);
      p.y = clamp(p.y + dy * speed * dt, minY, maxY);
      p.moving = !!(dx || dy);
      if (dx) p.facing = dx > 0 ? 1 : -1;
      if (inp.fire && canPlayerAttack(t)) this.tryBossFire(ch);
    }

    const a = players[0].p;
    const b = players[1].p;
    if (a && b && t.hearts.momo > 0 && t.hearts.tiantian > 0) {
      const overlapX = size - Math.abs(a.x - b.x);
      const overlapY = size - Math.abs(a.y - b.y);
      if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) {
          const dir = a.x < b.x ? -1 : 1;
          a.x += dir * overlapX * 0.5;
          b.x -= dir * overlapX * 0.5;
        } else {
          const dir = a.y < b.y ? -1 : 1;
          a.y += dir * overlapY * 0.5;
          b.y -= dir * overlapY * 0.5;
        }
        a.x = clamp(a.x, minX, maxX);
        b.x = clamp(b.x, minX, maxX);
        a.y = clamp(a.y, minY, maxY);
        b.y = clamp(b.y, minY, maxY);
      }
    }

    t.coinsOnCourt = (t.coinsOnCourt || []).filter((pack) => {
      for (const { ch, p } of players) {
        if (!p || t.hearts[ch] <= 0) continue;
        if (Math.abs(p.x - pack.x) < 20 && Math.abs(p.y - pack.y) < 20) {
          t.coins = (t.coins || 0) + 1;
          this.pushFx("sfx", { name: "success" });
          return false;
        }
      }
      return true;
    });
    t.hpOnCourt = (t.hpOnCourt || []).filter((pack) => {
      for (const { ch, p } of players) {
        if (!p || t.hearts[ch] <= 0) continue;
        if (Math.abs(p.x - pack.x) < 20 && Math.abs(p.y - pack.y) < 20) {
          t.hearts[ch] = Math.min(3, (t.hearts[ch] || 0) + 1);
          this.pushFx("sfx", { name: "success" });
          return false;
        }
      }
      return true;
    });
  }

  startBossDefeat() {
    this.pushFx("sfx", { name: "hurt" });
    this.pushFx("shake", { mag: 10, dur: 500 });
    this.pushFx("flash", { color: "#ff3b4a", dur: 280 });
    this.beginDecision(5, true);
  }

  tickRacketRegen(dt) {
    const t = this.task;
    if (!t.buffs || !t.buffs.racket) return;
    t.racket = t.racket || { momo: RACKET_MAX, tiantian: RACKET_MAX };
    t.racketRegen = t.racketRegen || { momo: 0, tiantian: 0 };
    for (const ch of ["momo", "tiantian"]) {
      if ((t.racket[ch] || 0) >= RACKET_MAX) {
        t.racket[ch] = RACKET_MAX;
        t.racketRegen[ch] = 0;
        continue;
      }
      if (!(t.racketRegen[ch] > 0)) continue;
      t.racketRegen[ch] -= dt;
      if (t.racketRegen[ch] <= 0) {
        t.racket[ch] += 1;
        t.racketRegen[ch] = t.racket[ch] < RACKET_MAX ? RACKET_REGEN : 0;
      }
    }
  }

  autoRacketDeflect(list) {
    const t = this.task;
    if (!t.buffs || !t.buffs.racket) return list;
    t.racket = t.racket || { momo: RACKET_MAX, tiantian: RACKET_MAX };
    t.racketRegen = t.racketRegen || { momo: 0, tiantian: 0 };
    return (list || []).filter((shot) => {
      if (shot.dead || shot.white) return true;
      for (const ch of ["momo", "tiantian"]) {
        if (t.hearts[ch] <= 0) continue;
        if ((t.racket[ch] || 0) <= 0) continue;
        const p = this.byCharacter(ch);
        if (!p) continue;
        if (Math.hypot(shot.x - p.x, shot.y - p.y) > RACKET_ZONE) continue;
        t.racket[ch] -= 1;
        if (!(t.racketRegen[ch] > 0)) t.racketRegen[ch] = RACKET_REGEN;
        t.blue = t.blue || [];
        t.blue.push({
          id: uid(),
          x: shot.x,
          y: shot.y,
          vx: -(shot.vx || 0),
          vy: -(shot.vy || 0) || -400,
          fromDeflect: true,
        });
        this.pushFx("sfx", { name: "deflect", for: ch });
        return false;
      }
      return true;
    });
  }

  tryBossFire(ch) {
    const t = this.task;
    if (!canPlayerAttack(t)) return;
    if (t.hearts[ch] <= 0) return;
    if (t.fireCd[ch] > 0) return;
    const p = this.byCharacter(ch);
    if (!p) return;
    const level = teamGunLevel(t);
    t.fireCd[ch] = GUN_FIRE_CD[level] || GUN_FIRE_CD[0];
    const shots = GUN_SHOTS[level] || GUN_SHOTS[0];
    for (const ox of shots) {
      t.blue.push({
        id: uid(),
        x: p.x + ox,
        y: p.y - 16,
        vx: 0,
        vy: -680,
        owner: ch,
      });
    }
    this.pushFx("sfx", { name: "shoot" });
  }

  tickBossLdr(dt) {
    const t = this.task;
    const ldr = t.ldr;
    if (!ldr) return;
    const angry = bossAngry(t.hits) || !!t.finalPhase;
    ldr.r = BOSS_R;
    if (t.finalPhase || t.stage === "final") {
      ldr.y = BOSS_Y;
      ldr.angry = true;
      if ((t.minions || []).length > 0) {
        ldr.x = COURT.x + COURT.w / 2;
        ldr.dir = 0;
        return;
      }
      const { minX, maxX } = bossBounds();
      const speed = 140;
      ldr.cycle = (ldr.cycle || 0) + dt;
      if (!ldr.dir) ldr.dir = 1;
      const rest = BOSS_REST_S + 1;
      const move = BOSS_MOVE_S;
      const period = move + rest;
      if (ldr.cycle % period >= move) return;
      ldr.x += ldr.dir * speed * dt;
      if (ldr.x < minX) {
        ldr.x = minX;
        ldr.dir = 1;
      }
      if (ldr.x > maxX) {
        ldr.x = maxX;
        ldr.dir = -1;
      }
      return;
    }
    const { minX, maxX } = bossBounds();
    if ((ldr.phaseRest || 0) > 0 && angry) {
      ldr.phaseRest -= dt;
      return;
    }
    const speed = angry ? 140 : 220;
    ldr.cycle = (ldr.cycle || 0) + dt;
    if (!ldr.dir) ldr.dir = 1;
    const rest = angry ? BOSS_REST_S + 1 : BOSS_REST_S;
    const move = t.stage === "phase2" && angry ? 2.2 : BOSS_MOVE_S;
    const period = move + rest;
    const inRest = ldr.cycle % period >= move;
    if (inRest) return;
    ldr.x += ldr.dir * speed * dt;
    if (ldr.x < minX) {
      ldr.x = minX;
      ldr.dir = 1;
    }
    if (ldr.x > maxX) {
      ldr.x = maxX;
      ldr.dir = -1;
    }
  }

  tickBossShots(dt) {
    const t = this.task;
    const left = COURT.x + 8;
    const right = COURT.x + COURT.w - 8;
    const top = COURT.y + 8;
    const bot = COURT.y + COURT.h - 8;
    const living = () => {
      const out = [];
      for (const ch of ["momo", "tiantian"]) {
        if (t.hearts[ch] <= 0) continue;
        const p = this.byCharacter(ch);
        if (p) out.push({ ch, p });
      }
      return out;
    };
    const closest = () => {
      const list = living();
      if (!list.length) return { x: COURT.x + COURT.w / 2, y: NET_Y + 120 };
      let best = list[0].p;
      let bestD = 1e9;
      for (const { p } of list) {
        const d = Math.hypot(p.x - t.ldr.x, p.y - t.ldr.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    };

    t.smash = (t.smash || []).filter((s) => (s.until || 0) > t.elapsed);
    if ((t.stage === "phase1" || t.stage === "final") && t.elapsed >= t.nextShot) {
      const list = living();
      const aim = list.length ? list[Math.floor(Math.random() * list.length)].p : closest();
      const dx = aim.x - t.ldr.x;
      const dy = aim.y - t.ldr.y;
      const mag = Math.max(1, Math.hypot(dx, dy));
      t.red.push({
        id: uid(),
        x: t.ldr.x,
        y: t.ldr.y + (t.ldr.r || BOSS_R) - 4,
        vx: (dx / mag) * RED_SPEED,
        vy: (dy / mag) * RED_SPEED,
        bounces: 0,
      });
      const shotEvery = bossAngry(t.hits) || t.finalPhase ? Math.max(0.7, BOSS_SHOT_EVERY - 0.5) : BOSS_SHOT_EVERY;
      t.nextShot += shotEvery;
      this.pushFx("sfx", { name: "shot" });
    }

    if (t.stage === "phase1" || t.stage === "final") {
      this.tickYellowAttack(living);
    } else if (t.ldr) {
      t.ldr.aoe = false;
      t.yellowAtk = null;
      t.yellowWarn = null;
      t.yellowPend = null;
    }

    const hurtPlayer = (ch, opts) => {
      if (t.hearts[ch] <= 0) return false;
      if (!(opts && opts.ignoreInvuln) && t.invuln[ch] > 0) return false;
      t.buffs = t.buffs || { shield: false, racket: false };
      t.shieldHits = t.shieldHits || { momo: 0, tiantian: 0 };
      if ((t.shieldHits[ch] || 0) > 0) {
        t.shieldHits[ch] -= 1;
        t.invuln[ch] = 0.35;
        this.pushFx("sfx", { name: "click" });
        return true;
      }
      t.hearts[ch] -= 1;
      t.invuln[ch] = 1.1;
      t.hurtFlash = t.hurtFlash || { momo: 0, tiantian: 0 };
      t.hurtFlash[ch] = 0.35;
      this.pushFx("sfx", { name: "hurt" });
      this.pushFx("shake", { mag: 6, dur: 200 });
      if (t.hearts[ch] <= 0) {
        t.banner = ch === "momo" ? "MOMO IS OUT!" : "TIAN TIAN IS OUT!";
      }
      return true;
    };
    const yellowHitsPlayer = (ox, oy, nx, ny) => {
      for (const ch of ["momo", "tiantian"]) {
        if (t.hearts[ch] <= 0) continue;
        const p = this.byCharacter(ch);
        if (!p) continue;
        if (pathHitsPlayer(ox, oy, nx, ny, p.x, p.y)) {
          hurtPlayer(ch, { ignoreInvuln: true });
          return true;
        }
      }
      return false;
    };
    const hitPlayer = (shot) => {
      for (const ch of ["momo", "tiantian"]) {
        if (t.hearts[ch] <= 0 || t.invuln[ch] > 0) continue;
        const p = this.byCharacter(ch);
        if (!p) continue;
        if (Math.abs(p.x - shot.x) < 18 && Math.abs(p.y - shot.y) < 18) {
          hurtPlayer(ch);
          return true;
        }
      }
      return false;
    };

    if ((t.stage === "phase1" || t.stage === "final") && (bossAngry(t.hits) || t.finalPhase)) {
      if (!t.aoe && t.elapsed >= (t.nextAoe || BOSS_AOE_EVERY)) {
        const finalAoe = t.stage === "final" || !!t.finalPhase;
        t.aoe = {
          zones: placeAoeZones(living(), finalAoe ? 1 : 2),
          until: t.elapsed + BOSS_AOE_WARN,
          flash: false,
          color: "rage",
        };
        t.nextAoe = t.elapsed + BOSS_AOE_EVERY;
        if (t.ldr) t.ldr.aoe = true;
        this.pushFx("sfx", { name: "rumble" });
      }
      if (t.aoe && !t.aoe.flash && t.elapsed >= t.aoe.until) {
        for (const zone of t.aoe.zones || []) {
          for (const { ch, p } of living()) {
            if (t.invuln[ch] > 0) continue;
            if (Math.hypot(p.x - zone.x, p.y - zone.y) <= zone.r) hurtPlayer(ch);
          }
          if ((t.stage === "final" || t.finalPhase) && aoeOverlapsWall(zone, t.blueWall)) {
            damageBlueWall(t);
            this.pushFx("sfx", { name: "hurt" });
          }
        }
        t.aoe.flash = true;
        t.aoe.flashUntil = t.elapsed + BOSS_AOE_FLASH;
        if (t.ldr) t.ldr.aoe = false;
        this.pushFx("sfx", { name: "boom" });
      }
      if (t.aoe && t.aoe.flash && t.elapsed >= (t.aoe.flashUntil || 0)) {
        t.aoe = null;
      }
    }
    if (t.stage === "phase1" && (t.nextCoin || 0) <= t.elapsed) spawnArenaCoin(t);
    if ((t.stage === "phase1" || t.stage === "final") && (t.nextHp || 0) <= t.elapsed) spawnArenaHp(t);

    const hitWall = (x0, y0, x1, y1) => {
      for (const wall of t.walls || []) {
        if (wallHitsShot(wall, x0, y0, x1, y1)) return wall;
      }
      return null;
    };
    const hitBlueWall = (x0, y0, x1, y1) => {
      const wall = t.blueWall;
      if (!wall) return null;
      if (wallHitsShot(wall, x0, y0, x1, y1)) return wall;
      return null;
    };
    const finalMode = t.stage === "final" || !!t.finalPhase;
    const wallLocked = finalMode && ((t.minions || []).length > 0 || t.finalWallLocked);

    const markDead = (shot) => {
      shot.dead = BIRDIE_DEAD_FADE;
      shot.vx = 0;
      shot.vy = 0;
      shot.white = true;
      shot.whiteUntil = (t.elapsed || 0) + BIRDIE_WHITE_FLASH;
    };
    const tickShotFlash = (shot) => {
      if (shot.whiteUntil && (t.elapsed || 0) >= shot.whiteUntil) {
        shot.white = false;
        shot.whiteUntil = 0;
      }
    };
    const collideBlueRed = () => {
      for (const blu of t.blue || []) {
        tickShotFlash(blu);
        if (blu.dead) continue;
        for (const red of t.red || []) {
          tickShotFlash(red);
          if (red.white || red.dead) continue;
          if (birdieOverlap(blu, red)) {
            markDead(blu);
            markDead(red);
          }
        }
        for (const red of t.minionShots || []) {
          tickShotFlash(red);
          if (red.white || red.dead) continue;
          if (birdieOverlap(blu, red)) {
            markDead(blu);
            markDead(red);
          }
        }
      }
    };

    t.red = (t.red || []).filter((shot) => {
      if (shot.dead || shot.white) {
        shot.dead = (shot.dead || 1) - dt;
        return shot.dead > 0;
      }
      const ox = shot.x;
      const oy = shot.y;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (hitBlueWall(ox, oy, shot.x, shot.y)) {
        damageBlueWall(t);
        this.pushFx("sfx", { name: "hurt" });
        return false;
      }
      let bounced = false;
      if (shot.x < left || shot.x > right) {
        shot.vx *= -1;
        shot.x = clamp(shot.x, left, right);
        bounced = true;
      }
      if (shot.y < top || shot.y > bot) {
        shot.vy *= -1;
        shot.y = clamp(shot.y, top, bot);
        bounced = true;
      }
      if (bounced) {
        shot.bounces += 1;
        if (shot.bounces >= BOSS_BOUNCES) return false;
      }
      return true;
    });
    t.red = this.autoRacketDeflect(t.red);
    t.red = (t.red || []).filter((shot) => {
      if (shot.dead || shot.white) return true;
      if (hitPlayer(shot)) return false;
      return true;
    });

    t.yellow = (t.yellow || []).filter((shot) => {
      const ox = shot.x;
      const oy = shot.y;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (hitBlueWall(ox, oy, shot.x, shot.y)) {
        damageBlueWall(t, 2);
        this.pushFx("sfx", { name: "hurt" });
        return false;
      }
      if (!finalMode) {
        const wall = hitWall(ox, oy, shot.x, shot.y);
        if (wall) {
          this.pushFx("sfx", { name: "barrier" });
          return false;
        }
      }
      if (yellowHitsPlayer(ox, oy, shot.x, shot.y)) return false;
      if (shot.x < left || shot.x > right || shot.y < top || shot.y > bot) return false;
      return true;
    });

    t.blue = (t.blue || []).filter((shot) => {
      tickShotFlash(shot);
      if (shot.dead || shot.white) {
        shot.dead = (shot.dead || 1) - dt;
        return shot.dead > 0;
      }
      const ox = shot.x;
      const oy = shot.y;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.y < top || shot.x < left || shot.x > right) return false;
      const wall = hitWall(ox, oy, shot.x, shot.y);
      if (wall) {
        if (finalMode && wallLocked) {
          this.pushFx("sfx", { name: "barrier" });
          return false;
        }
        bounceShotFromWall(shot, wall);
        t.reflect = t.reflect || [];
        t.reflect.push({
          id: shot.id || uid(),
          x: shot.x,
          y: shot.y,
          vx: shot.vx,
          vy: shot.vy,
        });
        wall.hp = (wall.hp == null ? WALL_HP : wall.hp) - 1;
        wall.flash = 0.14;
        if (wall.hp <= 0) {
          t.walls = [];
          if (!finalMode) t.wallTimer = WALL_CD;
        }
        this.pushFx("sfx", { name: "hurt" });
        return false;
      }
      let hitMinion = false;
      t.minions = (t.minions || []).filter((m) => {
        if (hitMinion) return true;
        if (birdieHitsCircle(shot, m.x, m.y, m.r || 12)) {
          m.hp -= 1;
          hitMinion = true;
          this.pushFx("sfx", { name: "hurt" });
          if (m.hp <= 0) {
            t.coins = (t.coins || 0) + 2;
            this.pushFx("sfx", { name: "success" });
            return false;
          }
        }
        return true;
      });
      if (hitMinion) return false;
      const wallUp = t.walls && t.walls[0] && (t.walls[0].hp || 0) > 0;
      if (t.ldr && birdieHitsCircle(shot, t.ldr.x, t.ldr.y, t.ldr.r || BOSS_R)) {
        if (wallUp) return false;
        this.damageBoss(1);
        this.pushFx("sfx", { name: "success" });
        return false;
      }
      return true;
    });

    collideBlueRed();

    t.reflect = (t.reflect || []).filter((shot) => {
      const ox = shot.x;
      const oy = shot.y;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.x < left || shot.x > right || shot.y < top || shot.y > bot) return false;
      if (hitWall(ox, oy, shot.x, shot.y)) return false;
      if (hitPlayer(shot)) return false;
      return true;
    });

    const zone = minionZone();
    t.minions = t.minions || [];
    for (const m of t.minions) {
      const r = m.r || 12;
      m.x += (m.vx || 0) * dt;
      m.y += (m.vy || 0) * dt;
      if (m.x - r <= zone.minX) {
        m.x = zone.minX + r;
        m.vx = Math.abs(m.vx || 22);
      } else if (m.x + r >= zone.maxX) {
        m.x = zone.maxX - r;
        m.vx = -Math.abs(m.vx || 22);
      }
      if (m.y - r <= zone.minY) {
        m.y = zone.minY + r;
        m.vy = Math.abs(m.vy || 14);
      } else if (m.y + r >= zone.maxY) {
        m.y = zone.maxY - r;
        m.vy = -Math.abs(m.vy || 14);
      }
      m.nextShot = (m.nextShot || 0) - dt;
      if (m.nextShot <= 0) {
        const list = living();
        const aim = list.length ? list[Math.floor(Math.random() * list.length)].p : closest();
        const dx = aim.x - m.x;
        const dy = aim.y - m.y;
        const mag = Math.max(1, Math.hypot(dx, dy));
        t.minionShots = t.minionShots || [];
        t.minionShots.push({
          id: uid(),
          x: m.x,
          y: m.y,
          vx: (dx / mag) * 160,
          vy: (dy / mag) * 160,
        });
        this.pushFx("sfx", { name: "shot" });
        m.nextShot = finalMode ? FINAL_MINION_SHOT : 1.35;
      }
    }
    t.minionShots = (t.minionShots || []).filter((shot) => {
      if (shot.dead || shot.white) {
        shot.dead = (shot.dead || 1) - dt;
        return shot.dead > 0;
      }
      const ox = shot.x;
      const oy = shot.y;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (hitBlueWall(ox, oy, shot.x, shot.y)) {
        damageBlueWall(t);
        this.pushFx("sfx", { name: "hurt" });
        return false;
      }
      if (shot.x < left || shot.x > right || shot.y < top || shot.y > bot) return false;
      return true;
    });
    t.minionShots = this.autoRacketDeflect(t.minionShots);
    t.minionShots = (t.minionShots || []).filter((shot) => {
      if (shot.dead || shot.white) return true;
      if (hitPlayer(shot)) return false;
      return true;
    });
  }

  puzzleInput(playerId, payload) {
    if (this.paused || this.phase !== "play" || !this.task) return;
    const p = this.getPlayer(playerId);
    if (!p || !p.character) return;
    const t = this.task;
    if (t.index === 1) this.inputTelepathy(p.character, payload);
    else if (t.index === 2) this.inputQuiz(p.character, payload);
    else if (t.index === 3) this.inputDraw(p.character, payload);
    else if (t.index === 4) this.inputPiano(p.character, payload);
    else if (t.index === 5) this.inputBoss(p.character, payload);
  }

  inputTelepathy(ch, payload) {
    const t = this.task;
    if (t.stage !== "input") return;
    if (payload.action === "type") {
      t.words[ch] = cleanText(payload.word, 24);
      return;
    }
    if (payload.action === "ready") {
      t.words[ch] = cleanText(payload.word, 24);
      if (!normWord(t.words[ch])) {
        this.failMessage = "Type a word first.";
        this.emit();
        return;
      }
      t.ready[ch] = !t.ready[ch];
      this.failMessage = null;
      this.pushFx("sfx", { name: "click" });
      if (t.ready.momo && t.ready.tiantian) this.resolveTelepathy();
      else this.emit();
    }
  }

  inputQuiz(ch, payload) {
    const t = this.task;
    if (!t.feedback) t.feedback = { momo: null, tiantian: null };
    if (t.stage === "create" && payload.action === "addQuestion") {
      if (t.questions[ch].length >= 3) {
        this.emit();
        return;
      }
      const prompt = cleanText(payload.prompt, 72);
      const choices = [0, 1, 2].map((i) => cleanText((payload.choices || [])[i], 28));
      const correct = Number(payload.correct);
      if (!prompt || choices.some((c) => !c) || ![0, 1, 2].includes(correct)) {
        this.failMessage = "Fill the question, 3 answers, and mark the correct one.";
        this.emit();
        return;
      }
      t.questions[ch].push({ prompt, choices, correct });
      this.failMessage = null;
      this.pushFx("sfx", { name: "click" });
      if (t.questions[ch].length > 3) t.questions[ch].length = 3;
      if (t.questions.momo.length === 3 && t.questions.tiantian.length === 3) {
        t.stage = "answer";
        t.answers = { momo: [], tiantian: [] };
        t.feedback = { momo: null, tiantian: null };
      }
      this.emit();
      return;
    }
    if (t.stage === "answer" && payload.action === "answer") {
      if (t.feedback[ch]) return;
      if (t.answers[ch].length >= 3) return;
      const choice = Number(payload.choice);
      if (![0, 1, 2].includes(choice)) return;
      const other = ch === "momo" ? "tiantian" : "momo";
      const q = (t.questions[other] || [])[t.answers[ch].length];
      if (!q) return;
      const ok = choice === q.correct;
      t.feedback[ch] = {
        choice,
        correct: q.correct,
        ok,
        prompt: q.prompt,
        choices: q.choices.slice(),
      };
      this.pushFx("sfx", { name: ok ? "success" : "hurt" });
      this.emit();
      return;
    }
    if (t.stage === "answer" && payload.action === "nextAnswer") {
      const fb = t.feedback[ch];
      if (!fb) return;
      t.answers[ch].push(fb.choice);
      t.feedback[ch] = null;
      if (t.answers.momo.length === 3 && t.answers.tiantian.length === 3) this.scoreQuiz();
      else this.emit();
    }
  }

  scoreQuiz() {
    const t = this.task;
    const score = (who, about) => {
      let n = 0;
      for (let i = 0; i < 3; i++) {
        if (t.answers[who][i] === t.questions[about][i].correct) n += 1;
      }
      return n;
    };
    t.scores.momo = score("momo", "tiantian");
    t.scores.tiantian = score("tiantian", "momo");
    t.passed = t.scores.momo >= 2 && t.scores.tiantian >= 2;
    t.stage = "score";
    t.hold = 3.2;
    if (t.passed) {
      this.pushFx("sfx", { name: "success" });
      this.pushFx("confettiSides", { n: 20 });
    } else {
      this.failMessage = "FAILED — both of you need at least 2 / 3. Write a new set!";
      this.pushFx("sfx", { name: "hurt" });
    }
    this.emit();
  }

  inputDraw(ch, payload) {
    const t = this.task;
    if (!t || t.index !== 3 || t.stage !== "draw") return;
    const action = payload && payload.action;
    if (ch === t.drawer) {
      if (action === "hint") {
        if ((t.hintLeft || 0) <= 0) return;
        const secret = String(t.words[t.wordIndex] || "");
        if (!secret) return;
        const used = Array.isArray(t.hintPos) ? t.hintPos.slice() : t.hintPos == null ? [] : [t.hintPos];
        const free = [];
        for (let i = 0; i < secret.length; i++) if (!used.includes(i)) free.push(i);
        if (!free.length) return;
        t.hintLeft -= 1;
        t.hintPos = used.concat([free[Math.floor(Math.random() * free.length)]]);
        this.pushFx("sfx", { name: "click" });
        this.emit();
        return;
      }
      if (action === "tool") {
        t.tool = payload.tool === "eraser" ? "eraser" : "pencil";
        this.emit();
        return;
      }
      if (action === "drawStart") {
        const id = String(payload.id || uid()).slice(0, 16);
        t.strokeId = id;
        t.strokes.push({
          id,
          tool: t.tool,
          pts: [[clamp(Number(payload.x) || 0, 0, 1), clamp(Number(payload.y) || 0, 0, 1)]],
        });
        if (t.strokes.length > 80) t.strokes = t.strokes.slice(-60);
        this.emit();
        return;
      }
      if (action === "drawMove" && t.strokeId) {
        const stroke = t.strokes.find((s) => s.id === t.strokeId);
        if (stroke && stroke.pts.length < 400) {
          stroke.pts.push([clamp(Number(payload.x) || 0, 0, 1), clamp(Number(payload.y) || 0, 0, 1)]);
          this.emit();
        }
        return;
      }
      if (action === "drawEnd") {
        t.strokeId = null;
        this.emit();
      }
      return;
    }
    if (ch === t.guesser && action === "guess") {
      const word = normWord(payload.word);
      const target = normWord(t.words[t.wordIndex]);
      if (!word) return;
      if (word === target) {
        t.guessed += 1;
        t.hintPos = [];
        t.strokes = [];
        t.strokeId = null;
        t.feedback = { ok: true, until: now() + 700 };
        this.pushFx("sfx", { name: "success" });
        if (t.guessed >= 3) {
          this.finishDrawTurn(true);
        } else {
          t.wordIndex += 1;
        }
      } else {
        t.feedback = { ok: false, until: now() + 700 };
        this.pushFx("sfx", { name: "hurt" });
      }
      this.emit();
    }
  }

  pianoLanesHeld() {
    const held = [false, false, false, false, false, false];
    for (const inp of this.inputs.values()) {
      const piano = inp && inp.piano;
      if (!Array.isArray(piano)) continue;
      for (let i = 0; i < 6; i++) if (piano[i]) held[i] = true;
    }
    const t = this.task;
    if (t && t.pressCount) {
      for (let i = 0; i < 6; i++) if ((t.pressCount[i] || 0) > 0) held[i] = true;
    }
    return held;
  }

  inputPiano(ch, payload) {
    const t = this.task;
    if (!t || t.index !== 4) return;
    const action = payload && payload.action;
    if (t.stage === "intro" && (action === "introAck" || action === "press" || action === "hit")) {
      t.stage = "play";
      this.emit();
      if (action === "introAck") return;
    }
    if (t.stage !== "play") return;
    const lane = Number(payload.lane);
    if (lane < 0 || lane > 5) return;
    if (!t.pressCount) t.pressCount = [0, 0, 0, 0, 0, 0];
    if (action === "release") {
      t.pressCount[lane] = Math.max(0, (t.pressCount[lane] || 0) - 1);
      this.emit();
      return;
    }
    if (action !== "hit" && action !== "press") return;
    t.pressCount[lane] = (t.pressCount[lane] || 0) + 1;
    const hitLine = 0.82;
    let best = null;
    let bestDist = PIANO_HIT;
    for (const tile of t.tiles) {
      if (tile.hit || tile.lane !== lane) continue;
      if (tile.hold && tile.holding) continue;
      const dist = Math.abs(tile.y - hitLine);
      if (dist < bestDist) {
        best = tile;
        bestDist = dist;
      }
    }
    const approachingHold = t.tiles.find(
      (tile) =>
        !tile.hit &&
        tile.lane === lane &&
        tile.hold &&
        !tile.holding &&
        tile.y < hitLine + PIANO_HIT &&
        tile.y - Math.max(0.28, tile.len || 0.32) < hitLine + PIANO_HIT
    );
    if (best) {
      if (best.hold) {
        const len = Math.max(0.28, best.len || 0.32);
        if (best.y - len >= hitLine + PIANO_HIT) {
          t.lastHit = { lane, ok: false };
          t.hearts = Math.max(0, (t.hearts == null ? PIANO_HEARTS : t.hearts) - 1);
          t.noteMsg = "MISS!";
          t.banner = "MISS!";
          t.noteMsgUntil = t.elapsed + 0.55;
          this.pushFx("sfx", { name: "hurt" });
        } else {
          best.holding = true;
          best.heldFor = 0;
          best.holdProg = 0;
          t.lastHit = { lane, ok: true };
          this.pushFx("note", { freq: PIANO_FREQ[lane], hold: true, id: best.id });
        }
      } else {
        best.hit = true;
        t.lastHit = { lane, ok: true };
        this.pushFx("note", { freq: PIANO_FREQ[lane] });
      }
    } else if (approachingHold) {
      t.lastHit = { lane, ok: true };
    } else {
      t.lastHit = { lane, ok: false };
      t.hearts = Math.max(0, (t.hearts == null ? PIANO_HEARTS : t.hearts) - 1);
      t.noteMsg = "MISS!";
      t.banner = "MISS!";
      t.noteMsgUntil = t.elapsed + 0.55;
      this.pushFx("sfx", { name: "hurt" });
      if (t.hearts <= 0) {
        t.stage = "fail";
        t.hold = 1.6;
        t.banner = "TOO MANY MISSES! TRY AGAIN";
        for (const tile of t.tiles) this.pushFx("noteOff", { id: tile.id });
        t.tiles = [];
      }
    }
    this.emit();
  }

  inputBoss(ch, payload) {
    const t = this.task;
    if (!t || t.index !== 5) return;
    const action = payload && payload.action;
    if (t.brief && briefPausesGame(t.brief, t.stage)) {
      if (action === "tipAck") this.ackBossTip(ch);
      return;
    }
    if (t.stage === "winWait" && action === "winContinue") {
      this.completeTask();
      return;
    }
    if ((t.stage === "failWait" || t.stage === "failShow" || t.stage === "fail1") && action === "skipBoss") {
      this.skipGame();
      return;
    }
    if ((t.stage === "failWait" || t.stage === "failShow" || t.stage === "fail1") && action === "retryBoss") {
      this.beginBossFight(true);
      this.emit();
      return;
    }
    if (t.stage === "shopAsk") {
      if (action === "shopYes") t.shopVote[ch] = t.shopVote[ch] === "yes" ? null : "yes";
      if (action === "shopNo") t.shopVote[ch] = t.shopVote[ch] === "no" ? null : "no";
      if (action === "shopYes" || action === "shopNo") {
        const v = t.shopVote[ch];
        this.noteShopClick(ch, v ? `clicked ${v.toUpperCase()}` : "undid their choice");
        this.pushFx("sfx", { name: "click" });
        this.emit();
      }
      return;
    }
    if (t.stage === "shop") {
      if (action === "select") {
        const item = payload.item;
        if (!SHOP_COST[item]) return;
        t.shopBought = t.shopBought || { shield: false, racket: false };
        if (item === "gun") {
          if (teamGunLevel(t) >= 3) return;
          const cost = gunUpgradeCost(teamGunLevel(t));
          if ((t.coins || 0) < cost) {
            t.shopMsg = "INSUFFICIENT FUNDS";
            t.shopPick = null;
            this.noteShopClick(ch, "tried to buy with insufficient funds");
            this.pushFx("sfx", { name: "hurt" });
            this.emit();
            return;
          }
        } else {
          if (t.shopBought[item]) return;
          if (item === "racket" && t.buffs && t.buffs.racket) return;
          if ((t.coins || 0) < SHOP_COST[item]) {
            t.shopMsg = "INSUFFICIENT FUNDS";
            t.shopPick = null;
            this.noteShopClick(ch, "tried to buy with insufficient funds");
            this.pushFx("sfx", { name: "hurt" });
            this.emit();
            return;
          }
        }
        t.shopMsg = null;
        t.shopPick = item;
        t.shopBuyVote = { momo: null, tiantian: null };
        this.noteShopClick(ch, `selected ${item}`);
        this.pushFx("sfx", { name: "click" });
        this.emit();
        return;
      }
      if (action === "buyNo" || action === "cancelBuy") {
        t.shopBuyVote = t.shopBuyVote || { momo: null, tiantian: null };
        t.shopBuyVote[ch] = t.shopBuyVote[ch] === "no" ? null : "no";
        this.noteShopClick(ch, t.shopBuyVote[ch] === "no" ? "clicked NO" : "undid their choice");
        if (t.shopBuyVote[ch] === "no") {
          t.shopPick = null;
          t.shopBuyVote = { momo: null, tiantian: null };
        }
        this.pushFx("sfx", { name: "click" });
        this.emit();
        return;
      }
      if (action === "buyYes" || action === "confirmBuy") {
        t.shopBuyVote = t.shopBuyVote || { momo: null, tiantian: null };
        t.shopBuyVote[ch] = "yes";
        this.noteShopClick(ch, "clicked YES");
        this.confirmShopBuy();
        return;
      }
      if (action === "ready") {
        t.shopReady = t.shopReady || { momo: false, tiantian: false };
        t.shopReady[ch] = !t.shopReady[ch];
        this.noteShopClick(ch, t.shopReady[ch] ? "is READY" : "unreadied");
        this.pushFx("sfx", { name: "click" });
        this.emit();
      }
      return;
    }
    if (action === "addCoins") {
      t.coins = (t.coins || 0) + 5;
      this.pushFx("sfx", { name: "success" });
      this.emit();
      return;
    }
    if (action === "fire") this.tryBossFire(ch);
  }

  yellowSpawn() {
    const t = this.task;
    const ldr = t && t.ldr;
    if (!ldr) return { x: COURT.x + COURT.w / 2, y: BOSS_Y };
    return { x: ldr.x, y: ldr.y + (ldr.r || BOSS_R) - 4 };
  }

  pickYellowTargets(living) {
    const list = typeof living === "function" ? living() : living || [];
    const alive = [];
    for (const row of list) {
      if (row && row.ch && !alive.includes(row.ch)) alive.push(row.ch);
    }
    if (!alive.length) return { firstTarget: null, secondTarget: null };
    const firstTarget = alive[Math.floor(Math.random() * alive.length)];
    const other = alive.find((ch) => ch !== firstTarget);
    const secondTarget = other || firstTarget;
    return { firstTarget, secondTarget };
  }

  pointForYellowTarget(ch) {
    const t = this.task;
    const p = this.byCharacter(ch);
    if (p && t && t.hearts[ch] > 0) return p;
    const fallback = t.hearts.momo > 0 ? "momo" : t.hearts.tiantian > 0 ? "tiantian" : null;
    return this.byCharacter(fallback) || { x: COURT.x + COURT.w / 2, y: NET_Y + 120 };
  }

  setYellowWarnLine(targetCh) {
    const t = this.task;
    const origin = this.yellowSpawn();
    const aim = this.pointForYellowTarget(targetCh);
    t.yellowWarn = {
      x0: origin.x,
      y0: origin.y,
      x1: aim.x,
      y1: aim.y,
      target: targetCh,
    };
  }

  tickYellowAttack(living) {
    const t = this.task;
    const angry = bossAngry(t.hits);
    if (!t.yellowAtk && t.elapsed >= (t.nextYellow || BOSS_YELLOW_EVERY)) {
      const picks = this.pickYellowTargets(living);
      if (!picks.firstTarget) return;
      t.yellowAtk = {
        firstTarget: picks.firstTarget,
        secondTarget: picks.secondTarget,
        step: "warn1",
        until: t.elapsed + (angry ? BOSS_YELLOW_WARN : BOSS_YELLOW_WARN_NORMAL),
      };
      t.nextYellow = (t.nextYellow || BOSS_YELLOW_EVERY);
      this.pushFx("sfx", { name: "rumble" });
    }
    const atk = t.yellowAtk;
    if (!atk) {
      t.yellowWarn = null;
      return;
    }
    if (atk.step === "warn1") this.setYellowWarnLine(atk.firstTarget);
    else if (atk.step === "warn2") this.setYellowWarnLine(atk.secondTarget);
    else t.yellowWarn = null;

    if (t.elapsed < atk.until) return;
    const origin = this.yellowSpawn();
    if (atk.step === "warn1") {
      this.fireYellowShot(origin.x, origin.y, atk.firstTarget);
      t.yellowWarn = null;
      if (!angry) {
        t.yellowAtk = null;
        t.nextYellow = t.elapsed + BOSS_YELLOW_EVERY;
        return;
      }
      atk.step = "wait";
      atk.until = t.elapsed + BOSS_YELLOW_STAGGER;
      return;
    }
    if (atk.step === "wait") {
      atk.step = "warn2";
      atk.until = t.elapsed + BOSS_YELLOW_WARN;
      this.pushFx("sfx", { name: "rumble" });
      return;
    }
    if (atk.step === "warn2") {
      this.fireYellowShot(origin.x, origin.y, atk.secondTarget);
      t.yellowWarn = null;
      t.yellowAtk = null;
      t.nextYellow = t.elapsed + BOSS_YELLOW_EVERY;
    }
  }

  fireYellowShot(x0, y0, who) {
    const t = this.task;
    if (!t) return;
    const p = this.byCharacter(who);
    const aim = p && t.hearts[who] > 0 ? p : this.byCharacter(t.hearts.momo > 0 ? "momo" : "tiantian") || { x: COURT.x + COURT.w / 2, y: NET_Y + 120 };
    const dx = aim.x - x0;
    const dy = aim.y - y0;
    const mag = Math.max(1, Math.hypot(dx, dy));
    const spd = RED_SPEED * 5;
    t.yellow = t.yellow || [];
    t.yellow.push({
      id: uid(),
      x: x0,
      y: y0,
      vx: (dx / mag) * spd,
      vy: (dy / mag) * spd,
    });
    this.pushFx("sfx", { name: "boom" });
  }

  addSmash(x, y) {
    const t = this.task;
    t.smash = t.smash || [];
    t.smash.push({ id: uid(), x, y, until: (t.elapsed || 0) + 0.42 });
  }

  confirmShopBuy() {
    const t = this.task;
    const item = t.shopPick;
    if (!item) return;
    t.buffs = t.buffs || { shield: false, racket: false };
    if (item === "gun") {
      const level = teamGunLevel(t);
      if (level >= 3) {
        t.shopPick = null;
        this.emit();
        return;
      }
      const cost = gunUpgradeCost(level);
      if ((t.coins || 0) < cost) {
        t.shopMsg = "INSUFFICIENT FUNDS";
        t.shopPick = null;
        t.shopBuyVote = { momo: null, tiantian: null };
        this.emit();
        return;
      }
      t.coins -= cost;
      t.gunLevel = level + 1;
      t.shopToast = "UPGRADE GUN BOUGHT";
      t.shopToastTimer = 2.2;
      t.shopLdr = null;
    } else {
      const cost = SHOP_COST[item];
      if (!cost || (t.coins || 0) < cost) {
        t.shopMsg = "INSUFFICIENT FUNDS";
        t.shopPick = null;
        t.shopBuyVote = { momo: null, tiantian: null };
        this.emit();
        return;
      }
      if (item === "racket" && t.buffs.racket) {
        t.shopPick = null;
        this.emit();
        return;
      }
      t.coins -= cost;
      t.shopBought = t.shopBought || { shield: false, racket: false };
      t.shopBought[item] = true;
      if (item === "shield") {
        grantShieldPurchase(t);
        t.shopToast = "SHIELD BOUGHT";
        t.shopToastTimer = 2.2;
        t.shopLdr = null;
      }
      if (item === "racket") {
        t.buffs.racket = true;
        t.racket = { momo: RACKET_MAX, tiantian: RACKET_MAX };
        t.racketRegen = { momo: 0, tiantian: 0 };
        t.shopToast = "RACKET BOUGHT";
        t.shopToastTimer = 2.2;
        t.shopLdr = null;
      }
    }
    t.shopPick = null;
    t.shopBuyVote = { momo: null, tiantian: null };
    this.pushFx("sfx", { name: "success" });
    this.emit();
  }

  scheduleScript(ms) {
    this.clearTimer();
    const wait = Math.max(16, ms || 0);
    this.scriptDue = now() + wait;
    this.timer = setTimeout(() => {
      this.scriptDue = 0;
      this.advanceScript();
    }, wait);
  }

  setPaused(wantPause) {
    if (this.phase === "select" || this.phase === "lobby" || this.phase === "complete") return;
    if (this.pauseReason === "disconnect") return;
    if (wantPause) {
      if (this.paused) return;
      this.paused = true;
      this.pauseReason = "manual";
      if (this.scriptDue) this.pauseRemain = Math.max(16, this.scriptDue - now());
      else this.pauseRemain = 0;
      this.clearTimer();
      this.pushFx("sfx", { name: "click" });
      this.emit();
      return;
    }
    if (!this.paused || this.pauseReason !== "manual") return;
    this.paused = false;
    this.pauseReason = null;
    if (this.pauseRemain) this.scheduleScript(this.pauseRemain);
    this.pauseRemain = 0;
    this.pushFx("sfx", { name: "click" });
    this.emit();
  }

  skipGame() {
    this.paused = false;
    this.pauseReason = null;
    this.clearTimer();
    if (this.script === INTRO_SCRIPT) {
      this.task = null;
      this.decision = null;
      this.failMessage = null;
      this.line = null;
      this.cinematic = null;
      this.runScript(TASK_INTROS[1]);
      return;
    }
    if (this.script === ENDING_SCRIPT || this.phase === "complete") return;
    let idx = 0;
    if (this.phase === "script" && this.script) {
      const step = this.script.find((s) => s.type === "startTask" || s.type === "beginTask");
      if (step && step.index) idx = step.index;
    } else if (this.task) {
      idx = this.task.index;
    } else if (this.decision) {
      idx = this.decision.game;
    } else {
      idx = this.taskIndex || 0;
    }
    this.task = null;
    this.decision = null;
    this.failMessage = null;
    this.line = null;
    this.cinematic = null;
    if (idx >= 5) {
      this.runScript(ENDING_SCRIPT);
      return;
    }
    const next = Math.max(1, idx + 1);
    if (next > 5) this.runScript(ENDING_SCRIPT);
    else this.runScript(TASK_INTROS[next]);
  }

  completeTask() {
    if (!this.task) return;
    const idx = this.task.index;
    this.beginDecision(idx, false);
  }

  beginDecision(idx, failed) {
    this.task = null;
    this.failMessage = null;
    this.line = null;
    this.cinematic = null;
    this.phase = "decide";
    this.scene = "task";
    this.taskIndex = idx;
    this.decision = {
      game: idx,
      timeLeft: failed ? 0 : DECISION_TIME,
      picks: { momo: null, tiantian: null },
      failed: !!failed,
      stage: "pick",
    };
    this.pushFx("flash", { color: "#ffd1e8", dur: 220 });
    this.pushFx("sfx", { name: failed ? "hurt" : "success" });
    this.emit();
  }

  tickDecision(dt) {
    const d = this.decision;
    if (!d) return;
    d.timeLeft = Math.max(0, d.timeLeft - dt);
    if (!d.failed && d.timeLeft <= 0) this.resolveDecision("timeout");
    else this.emit();
  }

  choosePath(playerId, choice) {
    if (this.paused || this.phase !== "decide" || !this.decision) return;
    const p = this.getPlayer(playerId);
    if (!p || !p.character) return;
    const d = this.decision;
    if (d.failed && d.stage === "confirm") {
      const pick = choice === "yes" ? "yes" : choice === "no" ? "no" : null;
      if (!pick) return;
      d.picks[p.character] = d.picks[p.character] === pick ? null : pick;
      this.pushFx("sfx", { name: "click" });
      const a = d.picks.momo;
      const b = d.picks.tiantian;
      if (a === "yes" && b === "yes") this.resolveDecision("on");
      else if (a === "no" && b === "no") {
        d.stage = "pick";
        d.picks = { momo: null, tiantian: null };
        this.emit();
      } else this.emit();
      return;
    }
    const pick = choice === "again" ? "again" : choice === "on" ? "on" : null;
    if (!pick) return;
    d.picks[p.character] = d.picks[p.character] === pick ? null : pick;
    this.pushFx("sfx", { name: "click" });
    const a = d.picks.momo;
    const b = d.picks.tiantian;
    if (a === "again" && b === "again") this.resolveDecision("again");
    else if (a === "on" && b === "on") {
      if (d.failed) {
        d.stage = "confirm";
        d.picks = { momo: null, tiantian: null };
        this.emit();
      } else this.resolveDecision("on");
    } else this.emit();
  }

  resolveDecision(reason) {
    if (this.phase !== "decide" || !this.decision) return;
    const idx = this.decision.game;
    this.decision = null;
    if (reason === "again") {
      this.pushFx("sfx", { name: "click" });
      this.replayTask(idx);
      return;
    }
    this.moveOn(idx, reason === "timeout");
  }

  replayTask(idx) {
    this.phase = "play";
    if (idx === 1) this.telepathyCategory = null;
    this.startTask(idx);
  }

  moveOn(idx, timedOut) {
    this.progress[idx - 1] = true;
    this.ldrHearts = Math.max(0, LDR_MAX_HEARTS - this.progress.filter(Boolean).length);
    this.pushFx("flash", { color: "#ffd1e8", dur: 220 });
    this.pushFx("sfx", { name: timedOut ? "hurt" : "success" });
    if (timedOut) this.ldr.mood = "hurt";
    if (idx >= 5) {
      this.ldr.mood = "hurt";
      this.runScript(ENDING_SCRIPT);
    } else {
      this.runScript(TASK_INTROS[idx + 1]);
    }
  }

  restartTask() {
    if (this.phase !== "play" || !this.taskIndex) return;
    this.startTask(this.taskIndex);
    this.pushFx("sfx", { name: "click" });
  }

  restartGame() {
    if (!this.byCharacter("momo") || !this.byCharacter("tiantian")) return;
    this.paused = false;
    this.pauseReason = null;
    this.usedCategories = [];
    this.usedDrawWords = new Set();
    this.beginIntro();
  }

  interact(playerId) {
    if (this.phase === "script") this.advanceDialogue(playerId);
  }

  viewFor(playerId) {
    const me = this.getPlayer(playerId);
    const fx = this.fx;
    const base = {
      phase: this.paused ? "paused" : this.phase,
      serverState: this.serverState,
      scene: this.scene,
      pauseReason: this.pauseReason,
      countdown: this.countdown,
      line: this.line,
      cinematic: this.cinematic,
      taken: this.takenMap(),
      progress: this.progress,
      taskIndex: this.taskIndex,
      currentStage: this.decision ? this.decision.game : (this.task && this.task.index) || this.taskIndex || 0,
      completeStage: this.completeStage,
      endTimer: this.endTimer,
      ldrHearts: this.ldrHearts,
      ldr: this.ldr,
      failMessage: this.failMessage,
      dinnerDark: this.dinnerDark,
      dinnerTira: this.dinnerTira || 0,
      fx: this.fx.filter((f) => !f.for || f.for === (me && me.character)),
      me: playerId,
      myCharacter: me ? me.character : null,
      playerCount: this.connectedPlayers().length,
      maxPlayers: MAX_PLAYERS,
      players: this.connectedPlayers().map((p) => ({
        id: p.id,
        character: p.character,
        connected: p.connected,
        x: p.x,
        y: p.y,
        facing: p.facing,
        moving: p.moving,
        anim: p.anim,
      })),
    };
    if (this.paused && this.pauseReason === "disconnect") {
      base.disconnectedName = this.openCharacter
        ? this.openCharacter === "momo"
          ? "Momo"
          : "Tian Tian"
        : "Partner";
    }
    if (this.task) base.task = this.taskView(me);
    if (this.decision) {
      const ch = me && me.character;
      base.decision = {
        game: this.decision.game,
        timeLeft: this.decision.timeLeft,
        picks: this.decision.picks,
        failed: !!this.decision.failed,
        stage: this.decision.stage || "pick",
        mine: ch ? this.decision.picks[ch] : null,
      };
    }
    return base;
  }

  taskView(me) {
    const t = this.task;
    const ch = me && me.character;
    if (t.index === 1) {
      const reveal = t.stage === "reveal";
      return {
        index: 1,
        stage: t.stage,
        round: t.round,
        category: t.category,
        timeLeft: t.timeLeft,
        myWord: ch ? t.words[ch] : "",
        myReady: ch ? t.ready[ch] : false,
        partnerReady: ch ? t.ready[ch === "momo" ? "tiantian" : "momo"] : false,
        last: reveal || t.banner ? t.last : null,
        history: t.history || [],
        banner: t.banner || null,
      };
    }
    if (t.index === 2) {
      const other = ch === "momo" ? "tiantian" : "momo";
      const mine = t.questions[ch] || [];
      const theirs = t.questions[other] || [];
      const myAnswers = t.answers[ch] || [];
      const fb = t.feedback && t.feedback[ch] ? t.feedback[ch] : null;
      const q = t.stage === "answer" ? theirs[myAnswers.length] || null : null;
      const currentQ = fb || q;
      const created = Math.min(3, mine.length);
      const partnerCreated = Math.min(3, theirs.length);
      return {
        index: 2,
        setId: t.setId || "",
        stage: t.stage,
        created,
        partnerCreated,
        waitingForPartner: t.stage === "create" && created >= 3,
        answered: Math.min(3, myAnswers.length),
        partnerName: other === "momo" ? "MOMO" : "TIAN TIAN",
        questionNumber: t.stage === "create" && created < 3 ? created + 1 : null,
        current: currentQ
          ? {
              prompt: currentQ.prompt,
              choices: currentQ.choices,
              number: Math.min(3, myAnswers.length + 1),
            }
          : null,
        feedback: fb
          ? {
              choice: fb.choice,
              correct: fb.correct,
              ok: !!fb.ok,
            }
          : null,
        scores: t.stage === "score" ? t.scores : null,
        passed: t.stage === "score" ? t.passed : null,
      };
    }
    if (t.index === 3) {
      const isDrawer = ch === t.drawer;
      const list = t.words || [];
      const wordIdx = Math.min(Math.max(0, t.wordIndex || 0), Math.max(0, list.length - 1));
      const word = String(list[wordIdx] || "");
      return {
        index: 3,
        stage: t.stage,
        drawer: t.drawer,
        guesser: t.guesser,
        wordIndex: t.wordIndex,
        guessed: t.guessed,
        wordLen: word.length,
        blanks: drawBlanks(word, t.hintPos),
        word: isDrawer && word ? word : "",
        timeLeft: t.timeLeft,
        elapsed: t.elapsed,
        strokes: t.strokes,
        tool: t.tool,
        feedback: t.feedback,
        banner: t.banner,
        passedTurns: t.passedTurns,
        iDraw: isDrawer,
        hintLeft: t.hintLeft == null ? 2 : t.hintLeft,
        hintPos: isDrawer ? null : t.hintPos,
      };
    }
    if (t.index === 4) {
      return {
        index: 4,
        stage: t.stage,
        timeLeft: t.timeLeft,
        tiles: (t.tiles || []).map((tile) => ({
          id: tile.id,
          lane: tile.lane,
          y: tile.y,
          hit: !!tile.hit,
          hold: !!tile.hold,
          len: tile.len || 0.07,
          holding: !!tile.holding,
          holdProg: tile.holdProg || 0,
          color: tile.color || (tile.lane < 3 ? "red" : "blue"),
        })),
        hearts: t.hearts == null ? PIANO_HEARTS : t.hearts,
        banner: t.banner,
        noteMsg: t.noteMsg || null,
        lastHit: t.lastHit,
      };
    }
    if (t.index === 5) {
      return {
        index: 5,
        stage: t.stage,
        timeLeft: t.timeLeft,
        hearts: t.hearts,
        hits: t.hits,
        need: BOSS_HITS,
        hp: Math.max(0, BOSS_HITS - (t.hits || 0)),
        ldr: t.ldr,
        red: t.red,
        blue: t.blue,
        yellow: t.yellow,
        yellowWarn: t.yellowWarn,
        yellowAtk: t.yellowAtk
          ? { firstTarget: t.yellowAtk.firstTarget, secondTarget: t.yellowAtk.secondTarget, step: t.yellowAtk.step }
          : null,
        aoe: t.aoe,
        angry: bossAngry(t.hits) || !!t.finalPhase,
        finalPhase: !!t.finalPhase,
        finalWallLocked: !!t.finalWallLocked,
        walls: t.walls || [],
        blueWall: t.blueWall || null,
        reflect: t.reflect || [],
        coins: t.coins || 0,
        gunLevel: teamGunLevel(t),
        gunNextCost: teamGunLevel(t) < 3 ? gunUpgradeCost(teamGunLevel(t)) : 0,
        coinsOnCourt: t.coinsOnCourt || [],
        hpOnCourt: t.hpOnCourt || [],
        shopPick: t.shopPick || null,
        shopBuyVote: t.shopBuyVote || { momo: null, tiantian: null },
        shopLast: t.shopLast || null,
        shopMsg: t.shopMsg || null,
        shopLdr: null,
        shopToast: t.shopToast || null,
        shopToastTimer: t.shopToastTimer || 0,
        shopBought: t.shopBought || { shield: false, racket: false },
        silence: !!t.silence,
        smash: t.smash || [],
        buffs: t.buffs || { shield: false, racket: false },
        shieldHits: t.shieldHits || { momo: 0, tiantian: 0 },
        shieldMax: t.shieldMax || { momo: SHIELD_MAX, tiantian: SHIELD_MAX },
        myShieldHits: (t.shieldHits || {})[ch] || 0,
        myShieldMax: shieldMaxFor(t, ch),
        minions: t.minions || [],
        minionShots: t.minionShots || [],
        shopVote: t.shopVote || { momo: null, tiantian: null },
        shopReady: t.shopReady || { momo: false, tiantian: false },
        shopTimer: t.shopTimer || 0,
        racket: t.racket || { momo: RACKET_MAX, tiantian: RACKET_MAX },
        myRacket: (t.racket || {})[ch] || 0,
        racketRegen: t.racketRegen || { momo: 0, tiantian: 0 },
        myRacketRegen: (t.racketRegen || {})[ch] || 0,
        brief: t.brief
          ? {
              kind: t.brief.kind,
              text: (t.brief.lines || [])[t.brief.i] || "",
              ack: t.brief.ack || { momo: false, tiantian: false },
              overlay: !!t.brief.overlay,
              titleStyle: !!t.brief.titleStyle,
              startedAt: t.brief.startedAt || 0,
              revealed: !!t.brief.revealed,
            }
          : null,
        bonusFlashTimer: t.bonusFlashTimer || 0,
        hurtFlash: t.hurtFlash || { momo: 0, tiantian: 0 },
        banner: t.banner,
        court: COURT,
        netY: NET_Y,
      };
    }
    return null;
  }

  emit() {
    this.broadcast();
  }
}

Room.MAX_PLAYERS = MAX_PLAYERS;
Room.TICK_MS = TICK_MS;
Room.WIDTH = WIDTH;
Room.HEIGHT = HEIGHT;
Room.TASK_INTROS = TASK_INTROS;

module.exports = { Room, TASK_INTROS };
