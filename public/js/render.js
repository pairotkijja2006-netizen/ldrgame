const Render = (() => {
  const W = 1280;
  const H = 720;
  const MOMO_H = { dinner: 186, play: 128, end: 168 };
  const TIAN_H = { dinner: 158, play: 108, end: 142 };

  let canvas;
  let ctx;
  let spriteCanvas;
  let sctx;
  let assets = {};
  let ldrBuf;
  let ldrCtx;
  let birdieBuf;
  let birdieBctx;
  const display = new Map();
  const particles = [];
  let shake = { mag: 0, until: 0 };
  let flash = { a: 0, color: "#fff" };
  let t0 = performance.now();

  function init(el, spriteEl, loaded) {
    canvas = el;
    ctx = canvas.getContext("2d");
    spriteCanvas = spriteEl;
    sctx = spriteCanvas.getContext("2d");
    ldrBuf = document.createElement("canvas");
    ldrBuf.width = 48;
    ldrBuf.height = 48;
    ldrCtx = ldrBuf.getContext("2d");
    birdieBuf = document.createElement("canvas");
    birdieBuf.width = 16;
    birdieBuf.height = 16;
    birdieBctx = birdieBuf.getContext("2d");
    birdieBctx.imageSmoothingEnabled = false;
    assets = loaded;
  }

  function dpr() {
    return Math.min(2, window.devicePixelRatio || 1);
  }

  function sizeCanvas(el, c) {
    const scale = dpr();
    const w = W * scale;
    const h = H * scale;
    if (el.width !== w || el.height !== h) {
      el.width = w;
      el.height = h;
    }
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.imageSmoothingEnabled = false;
  }

  function fit() {
    sizeCanvas(canvas, ctx);
    if (spriteCanvas && sctx) sizeCanvas(spriteCanvas, sctx);
  }

  function spawnHearts(n, x, y) {
    for (let i = 0; i < n; i++) {
      particles.push({
        kind: "heart",
        x: (x ?? 640) + (Math.random() - 0.5) * 80,
        y: (y ?? 360) + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -1.2 - Math.random() * 1.6,
        life: 1,
        s: 6 + Math.random() * 6,
      });
    }
  }

  function spawnConfettiSides(n) {
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      particles.push({
        kind: "confetti",
        x: left ? 8 : W - 8,
        y: 80 + Math.random() * 500,
        vx: left ? 2.2 + Math.random() * 3.2 : -(2.2 + Math.random() * 3.2),
        vy: -1 + Math.random() * 2,
        life: 1,
        color: ["#ff6b9d", "#ffd36a", "#7cffb2", "#c9b7ff", "#fff"][i % 5],
        s: 4 + (i % 4),
      });
    }
  }

  function spawnConfetti(n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        kind: "confetti",
        x: Math.random() * W,
        y: -10 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 2,
        vy: 1.5 + Math.random() * 2,
        life: 1,
        color: ["#ff6b9d", "#ffd36a", "#7cffb2", "#c9b7ff", "#fff"][i % 5],
        s: 4 + (i % 4),
      });
    }
  }

  function applyFx(list) {
    if (!list) return;
    for (const fx of list) {
      if (fx.type === "shake") {
        shake.mag = fx.mag || 8;
        shake.until = performance.now() + (fx.dur || 400);
      }
      if (fx.type === "flash") {
        flash.a = 0.85;
        flash.color = fx.color || "#fff";
      }
      if (fx.type === "hearts") spawnHearts(fx.n || 8, fx.x, fx.y);
      if (fx.type === "confettiSides") spawnConfettiSides(fx.n || 24);
      if (fx.type === "explode") {
        const n = fx.n || 36;
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n;
          const sp = 2.4 + Math.random() * 4.5;
          particles.push({
            kind: "confetti",
            x: fx.x || W / 2,
            y: fx.y || 120,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 1.2,
            life: 1,
            color: ["#050505", "#c41424", "#ffe14a", "#fff", "#c9b7ff"][i % 5],
            s: 5 + (i % 5),
          });
        }
      }
      if (fx.type === "note") {
        if (fx.hold) AudioBus.startHold(fx.freq || 261.63, fx.id);
        else AudioBus.playNote(fx.freq || 261.63);
      }
      if (fx.type === "noteOff") AudioBus.stopHold(fx.id);
      if (fx.type === "sfx" && fx.name) AudioBus.playSfx(fx.name);
    }
  }

  function lerpPlayers(players) {
    const seen = new Set();
    for (const p of players || []) {
      if (!p.character) continue;
      seen.add(p.id);
      let d = display.get(p.id);
      if (!d) d = { x: p.x, y: p.y };
      d.x += (p.x - d.x) * 0.3;
      d.y += (p.y - d.y) * 0.3;
      d.facing = p.facing;
      d.moving = p.moving;
      d.anim = p.anim;
      d.character = p.character;
      d.connected = p.connected;
      display.set(p.id, d);
    }
    for (const id of display.keys()) if (!seen.has(id)) display.delete(id);
  }

  function px(c) {
    (c || ctx).imageSmoothingEnabled = false;
  }

  function onSprites(fn) {
    if (!sctx) return;
    const prev = ctx;
    ctx = sctx;
    fn();
    ctx = prev;
  }

  function drawCafe(alpha) {
    const img = assets.cafe;
    if (!img) return;
    px();
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, W, H);
    ctx.restore();
  }

  function drawShadow(x, y, w) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, w * 0.35, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function charHeight(who, mode) {
    return who === "momo" ? MOMO_H[mode] || MOMO_H.play : TIAN_H[mode] || TIAN_H.play;
  }

  function drawCharacter(who, x, y, opts) {
    const img = who === "momo" ? assets.momo : assets.tiantian;
    if (!img) return;
    const mode = (opts && opts.mode) || "play";
    const targetH = charHeight(who, mode);
    const scale = targetH / img.height;
    const dw = img.width * scale;
    const t = (performance.now() - t0) / 1000;
    const walk = opts && opts.moving;
    const hug = opts && opts.anim === "hug";
    const sip = opts && opts.anim === "sip";
    const bob = Math.sin(t * (walk ? 14 : sip ? 8 : 4) + x * 0.01) * (walk ? 3.2 : sip ? 2.4 : 1.4);
    const facing = opts && opts.facing === -1 ? -1 : 1;
    drawShadow(x, y, dw);
    px();
    ctx.save();
    if (opts && opts.ghost) ctx.globalAlpha = 0.55;
    ctx.translate(x, y + bob);
    ctx.scale(facing, hug ? 1 : walk ? 0.97 : 1);
    if (sip) ctx.rotate(-0.18);
    ctx.drawImage(img, -dw / 2, -targetH, dw, targetH);
    if (sip) {
      ctx.rotate(0.35);
      ctx.fillStyle = "#7dffb0";
      ctx.fillRect(8, -targetH + 28, 10, 14);
      ctx.fillStyle = "#3a2418";
      ctx.fillRect(7, -targetH + 26, 12, 3);
    }
    ctx.restore();
  }

  function drawTable(x, y, tira) {
    ctx.fillStyle = "#3b2418";
    ctx.fillRect(x - 130, y - 28, 260, 18);
    ctx.fillStyle = "#6a4128";
    ctx.fillRect(x - 136, y - 40, 272, 16);
    ctx.fillStyle = "#2a1810";
    ctx.fillRect(x - 118, y - 10, 12, 36);
    ctx.fillRect(x + 106, y - 10, 12, 36);
    ctx.fillStyle = "#e8d8c0";
    ctx.beginPath();
    ctx.ellipse(x - 46, y - 48, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 46, y - 48, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7dffb0";
    ctx.fillRect(x - 54, y - 70, 14, 18);
    const lift = tira || 0;
    const bob = lift ? Math.sin(performance.now() / 140) * 5 : 0;
    const tx = x + 40 - lift * 38;
    const ty = y - 70 - lift * 18 + bob;
    ctx.fillStyle = "#5a3a28";
    ctx.fillRect(tx, ty, 16, 16);
    ctx.fillStyle = "#8a5a38";
    ctx.fillRect(tx + 2, ty + 2, 12, 5);
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(tx + 3, ty + 8, 10, 4);
    ctx.fillStyle = "#ff6b9d";
    ctx.font = "8px 'Press Start 2P'";
    ctx.fillText("M+T", x - 14, y - 48);
  }

  function drawLDR(x, y, r, mood, t) {
    const s = 48;
    ldrCtx.clearRect(0, 0, s, s);
    ldrCtx.imageSmoothingEnabled = false;
    const wob = mood === "hurt" ? 0.85 : 1;
    const rad = (s / 2 - 2) * wob;
    ldrCtx.fillStyle = "#050505";
    ldrCtx.beginPath();
    ldrCtx.arc(s / 2, s / 2, rad, 0, Math.PI * 2);
    ldrCtx.fill();
    ldrCtx.fillStyle = "#1a1a1a";
    ldrCtx.fillRect(10, 8, 28, 8);
    ldrCtx.fillStyle = "#fff";
    const blink = Math.sin(t * (mood === "angry" ? 12 : 3)) > 0.92;
    if (!blink) {
      ldrCtx.fillRect(12, 16, 8, mood === "angry" ? 4 : 8);
      ldrCtx.fillRect(28, 16, 8, mood === "angry" ? 4 : 8);
    }
    ldrCtx.fillStyle = "#ff3b6b";
    if (mood === "laugh" || mood === "attack") {
      ldrCtx.fillRect(16, 30, 16, 6);
      ldrCtx.fillRect(14, 28, 4, 4);
      ldrCtx.fillRect(30, 28, 4, 4);
    } else if (mood === "hurt") {
      ldrCtx.fillRect(18, 32, 12, 3);
    } else {
      ldrCtx.fillRect(18, 30, 12, 4);
    }
    ldrCtx.fillStyle = "#fff";
    ldrCtx.fillRect(18, 32, 3, 3);
    ldrCtx.fillRect(26, 32, 3, 3);
    px();
    ctx.drawImage(ldrBuf, 0, 0, s, s, x - r, y - r, r * 2, r * 2);
  }

  function drawLabel(text, x, y, color) {
    ctx.font = "8px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color || "#f4e4c1";
    ctx.fillText(text, x, y);
    ctx.textAlign = "left";
  }

  function drawVoidFloor() {
    ctx.fillStyle = "#120814";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1d1018";
    ctx.fillRect(0, 600, W, 120);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = i % 2 ? "#24141c" : "#1a0e14";
      ctx.fillRect(i * 80, 600, 80, 8);
    }
    ctx.fillStyle = "#2a1820";
    ctx.fillRect(0, 608, W, 112);
  }

  function drawDinner(state, t) {
    drawCafe(1);
    ctx.fillStyle = "rgba(40, 16, 20, 0.18)";
    ctx.fillRect(0, 0, W, H);
    if (state.dinnerDark) {
      ctx.fillStyle = `rgba(8, 4, 10, ${state.dinnerDark})`;
      ctx.fillRect(0, 0, W, H);
    }
    const momo = [...display.values()].find((p) => p.character === "momo");
    const tian = [...display.values()].find((p) => p.character === "tiantian");
    if (state.ldr && state.ldr.visible) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawDinnerActors(state) {
    const momo = [...display.values()].find((p) => p.character === "momo");
    const tian = [...display.values()].find((p) => p.character === "tiantian");
    const sep = state.cinematic && state.cinematic.name === "separate";
    const mx = momo ? momo.x : 520;
    const tx = tian ? tian.x : 760;
    const my = momo ? momo.y : 490;
    const ty = tian ? tian.y : 490;
    if (momo) drawCharacter("momo", mx, my, { mode: "dinner", facing: momo.facing, moving: sep, anim: momo.anim });
    if (tian) drawCharacter("tiantian", tx, ty, { mode: "dinner", facing: tian.facing, moving: sep, anim: tian.anim });
    if (!sep) drawTable(640, 518, state.dinnerTira || 0);
    if (state.ldr && state.ldr.visible) {
      const r = 150 * (state.ldr.scale || 1);
      drawLDR(640, 168, r, state.ldr.mood, (performance.now() - t0) / 1000);
    }
  }

  function drawBlack(state) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (state.cinematic && state.cinematic.text) {
      ctx.fillStyle = "#f4e4c1";
      ctx.font = "18px 'Press Start 2P'";
      ctx.textAlign = "center";
      ctx.fillText(state.cinematic.text, W / 2, H / 2);
      ctx.textAlign = "left";
    }
  }

  function drawTaskArena(state, t) {
    const task = state.task;
    if (task && task.index === 4) {
      drawPiano(task);
      return;
    }
    if (task && task.index === 5) {
      drawCourt(state);
      return;
    }
    drawVoidFloor();
    if (task) {
      ctx.fillStyle = "rgba(20, 10, 16, 0.35)";
      ctx.fillRect(300, 160, 680, 280);
    }
  }

  function drawPiano(task) {
    ctx.fillStyle = "#120814";
    ctx.fillRect(0, 0, W, H);
    const x0 = 280;
    const w = 720;
    const y0 = 40;
    const h = 640;
    const lanes = 6;
    const lw = w / lanes;
    const keys = ["A", "S", "D", "F", "G", "H"];
    for (let i = 0; i < lanes; i++) {
      ctx.fillStyle = i % 2 ? "#1d1018" : "#25141c";
      ctx.fillRect(x0 + i * lw, y0, lw, h);
      ctx.strokeStyle = i < 3 ? "#ff4d4d" : "#4aa8ff";
      ctx.lineWidth = 4;
      ctx.strokeRect(x0 + i * lw + 2, y0 + 2, lw - 4, h - 4);
    }
    const hitY = y0 + h * 0.82;
    ctx.fillStyle = "#ff6b9d";
    ctx.fillRect(x0, hitY - 3, w, 6);
    for (const tile of task.tiles || []) {
      const lane = Math.max(0, Math.min(lanes - 1, Number(tile.lane) || 0));
      const tx = x0 + lane * lw + 6;
      const tw = lw - 12;
      const len = tile.hold ? Math.max(0.28, tile.len || 0.32) : 0.08;
      const tileH = Math.max(36, len * h);
      const head = y0 + tile.y * h;
      const ty = tile.hold ? head - tileH : head - 26;
      const base = tile.color === "blue" || tile.lane >= 3 ? "#4aa8ff" : "#ff4d4d";
      ctx.fillStyle = base;
      ctx.fillRect(tx, ty, tw, tileH);
      if (tile.hold) {
        const prog = Math.max(0, Math.min(1, tile.holdProg || (tile.holding ? 0.05 : 0)));
        ctx.fillStyle = tile.holding ? "#7cffb2" : "rgba(255, 247, 194, 0.28)";
        const fillH = Math.max(4, tileH * prog);
        ctx.fillRect(tx, ty + tileH - fillH, tw, fillH);
        if (tile.holding) {
          ctx.fillStyle = "#140c12";
          ctx.font = "8px 'Press Start 2P'";
          ctx.textAlign = "center";
          ctx.fillText("HOLD", tx + tw / 2, ty + tileH / 2 + 4);
        }
      } else if (tile.holding) {
        ctx.fillStyle = "#7cffb2";
        ctx.fillRect(tx, ty, tw, tileH);
      }
      ctx.strokeStyle = tile.holding ? "#7cffb2" : "#fff7c2";
      ctx.lineWidth = 3;
      ctx.strokeRect(tx, ty, tw, tileH);
      ctx.strokeStyle = "#140c12";
      ctx.lineWidth = 2;
      ctx.strokeRect(tx + 3, ty + 3, tw - 6, tileH - 6);
    }
    ctx.font = "10px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff4d4d";
    ctx.fillText("MOMO", x0 + lw * 1.5, y0 + h - 36);
    ctx.fillStyle = "#4aa8ff";
    ctx.fillText("TIAN TIAN", x0 + lw * 4.5, y0 + h - 36);
    ctx.font = "14px 'Press Start 2P'";
    ctx.fillStyle = "#f4e4c1";
    for (let i = 0; i < lanes; i++) {
      ctx.fillText(keys[i], x0 + i * lw + lw / 2, y0 + h - 14);
    }
    if (task.noteMsg === "MISS!" || (task.lastHit && task.lastHit.ok === false)) {
      ctx.fillStyle = "#ff4d4d";
      ctx.font = "18px 'Press Start 2P'";
      ctx.fillText("MISS!", x0 + w / 2, hitY - 18);
    } else if (task.noteMsg === "HOLD COMPLETE") {
      ctx.fillStyle = "#7cffb2";
      ctx.font = "14px 'Press Start 2P'";
      ctx.fillText("HOLD COMPLETE", x0 + w / 2, hitY - 18);
    }
    ctx.textAlign = "left";
  }

  function drawCourt(state) {
    const img = assets.court;
    const c = (state.task && state.task.court) || { x: 360, y: 16, w: 560, h: 688 };
    ctx.fillStyle = "#0b1a33";
    ctx.fillRect(0, 0, W, H);
    if (img) {
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate(Math.PI / 2);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, -c.h / 2, -c.w / 2, c.h, c.w);
      ctx.restore();
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.fillStyle = "#163a6b";
      ctx.fillRect(c.x, c.y, c.w, c.h);
    }
    const netY = (state.task && state.task.netY) || c.y + c.h / 2;
    ctx.strokeStyle = "#fff";
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x, netY);
    ctx.lineTo(c.x + c.w, netY);
    ctx.stroke();
    ctx.setLineDash([]);

    const t = state.task;
    if (t && t.ldr && !t.ldr.explode) {
      const r = t.ldr.r || 26;
      const angry = t.ldr.angry || t.angry || t.ldr.aoe || (t.aoe && t.aoe.zones);
      if (angry) {
        ctx.fillStyle = "rgba(255, 50, 60, 0.35)";
        ctx.beginPath();
        ctx.arc(t.ldr.x, t.ldr.y, r + 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = angry ? "#c41424" : "#050505";
      ctx.beginPath();
      ctx.arc(t.ldr.x, t.ldr.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = angry ? "#ff6b6b" : "#c9b7ff";
      ctx.lineWidth = 3;
      ctx.stroke();
      const hp = t.hp != null ? t.hp : Math.max(0, (t.need || 40) - (t.hits || 0));
      ctx.fillStyle = "#c9b7ff";
      ctx.font = "8px 'Press Start 2P'";
      ctx.textAlign = "center";
      ctx.fillText("LDR", t.ldr.x, t.ldr.y - r - 10);
      ctx.fillStyle = "#fff7c2";
      ctx.fillText(hp + "/" + (t.need || 40), t.ldr.x, t.ldr.y + r + 16);
      ctx.textAlign = "left";
    }
    if (t && t.yellowWarn) {
      ctx.strokeStyle = "#ffe14a";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(t.yellowWarn.x0, t.yellowWarn.y0);
      ctx.lineTo(t.yellowWarn.x1, t.yellowWarn.y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 225, 74, 0.25)";
      ctx.beginPath();
      ctx.arc(t.yellowWarn.x1, t.yellowWarn.y1, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t && t.aoe && t.aoe.zones) {
      const purple = t.aoe.color === "purple";
      for (const zone of t.aoe.zones) {
        const flashing = zone.flash || (t.aoe && t.aoe.flash);
        ctx.strokeStyle = flashing ? "#ffffff" : purple ? "#c07bff" : "#ff6b4a";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = flashing
          ? "rgba(255, 255, 255, 0.88)"
          : purple
            ? "rgba(168, 48, 255, 0.55)"
            : "rgba(255, 80, 48, 0.5)";
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = purple ? "#e9b8ff" : "#ffb39a";
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = purple ? "#ffd6ff" : "#ffe0d0";
        ctx.font = "10px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText("!", zone.x, zone.y + 4);
        ctx.textAlign = "left";
      }
    }
    for (const wall of (t && t.walls) || []) {
      const locked = !!(t.finalPhase || t.stage === "final") && !!t.finalWallLocked;
      const flashing = (wall.flash || 0) > 0;
      const white = locked || flashing;
      ctx.fillStyle = white ? "rgba(255, 255, 255, 0.94)" : "rgba(220, 40, 50, 0.92)";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = white ? "#fff" : "#ff8a90";
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
      const hp = wall.hp == null ? 6 : wall.hp;
      const maxHp = wall.maxHp || 6;
      const frac = Math.max(0, Math.min(1, hp / maxHp));
      const cx = wall.x + wall.w / 2;
      const cy = wall.y + wall.h / 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(18, wall.h + 10), 0, Math.PI * 2);
      ctx.stroke();
      if (frac > 0) {
        ctx.strokeStyle = white ? "#d0d0d0" : flashing ? "#fff" : "#ffe14a";
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(18, wall.h + 10), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
      }
    }
    if (t && t.blueWall) {
      const wall = t.blueWall;
      const flashing = (wall.flash || 0) > 0;
      ctx.fillStyle = flashing ? "rgba(255, 255, 255, 0.92)" : "rgba(64, 150, 255, 0.9)";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = flashing ? "#fff" : "#9ecbff";
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
      const hp = wall.hp == null ? 8 : wall.hp;
      const maxHp = wall.maxHp || 8;
      const frac = Math.max(0, Math.min(1, hp / maxHp));
      const cx = wall.x + wall.w / 2;
      const cy = wall.y + wall.h / 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(14, wall.h + 8), 0, Math.PI * 2);
      ctx.stroke();
      if (frac > 0) {
        ctx.strokeStyle = flashing ? "#fff" : "#cfe4ff";
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(14, wall.h + 8), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
      }
    }
    for (const pack of (t && t.coinsOnCourt) || []) {
      ctx.fillStyle = "#ff9a2e";
      ctx.fillRect(pack.x - 8, pack.y - 8, 16, 16);
      ctx.strokeStyle = "#ffe14a";
      ctx.lineWidth = 2;
      ctx.strokeRect(pack.x - 8, pack.y - 8, 16, 16);
    }
    for (const pack of (t && t.hpOnCourt) || []) {
      ctx.fillStyle = "#2ad66a";
      ctx.fillRect(pack.x - 8, pack.y - 8, 16, 16);
      ctx.strokeStyle = "#b6ffd0";
      ctx.lineWidth = 2;
      ctx.strokeRect(pack.x - 8, pack.y - 8, 16, 16);
      ctx.fillStyle = "#083018";
      ctx.font = "10px 'Press Start 2P'";
      ctx.textAlign = "center";
      ctx.fillText("+", pack.x, pack.y + 4);
      ctx.textAlign = "left";
    }
    for (const m of (t && t.minions) || []) {
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r || 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "8px 'Press Start 2P'";
      ctx.textAlign = "center";
      ctx.fillText(String(m.hp || 0), m.x, m.y + 3);
      ctx.textAlign = "left";
    }
    if (t && t.buffs && t.buffs.racket) {
      for (const p of display.values()) {
        if (!p.character) continue;
        const hearts = (t.hearts || {})[p.character] || 0;
        if (hearts <= 0) continue;
        const charges = (t.racket && t.racket[p.character]) || 0;
        const frac = Math.max(0, Math.min(1, charges / 2));
        if (frac > 0) {
          ctx.strokeStyle = "rgba(255, 140, 40, 0.28)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 44, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255, 140, 40, 0.95)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
          ctx.stroke();
        }
      }
    }
    const drawShot = (shot, color, size) => {
      const s = size || 12;
      ctx.fillStyle = shot.white || shot.dead ? "#fff" : color;
      ctx.fillRect(shot.x - s / 2, shot.y - s / 2, s, s);
      if (shot.white || shot.dead) {
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 2;
        ctx.strokeRect(shot.x - s / 2, shot.y - s / 2, s, s);
      }
    };
    // Cropped birdie fills an invisible 16×16 hitbox. Tint on an offscreen
    // buffer so PNG alpha masks the color (no tinted rectangle on the court).
    const drawBirdie = (shot, color) => {
      const img = assets.birdie;
      const box = 16;
      if (!img || !birdieBctx) {
        drawShot(shot, color || "#4aa8ff", box);
        return;
      }
      const sx = 102;
      const sy = 80;
      const sw = 296;
      const sh = 341;
      const vx = shot.vx || 0;
      const vy = shot.vy || 0;
      // Source art faces downward (+Y). Rotate so cork leads flight direction.
      const angle = Math.atan2(vy, vx) - Math.PI / 2;

      birdieBctx.clearRect(0, 0, box, box);
      birdieBctx.globalCompositeOperation = "source-over";
      birdieBctx.globalAlpha = 1;
      birdieBctx.drawImage(img, sx, sy, sw, sh, 0, 0, box, box);
      if (shot.white) {
        birdieBctx.globalCompositeOperation = "source-atop";
        birdieBctx.fillStyle = "#ffffff";
        birdieBctx.fillRect(0, 0, box, box);
      } else if (color) {
        // Multiply keeps black edges; destination-in restores PNG alpha mask.
        birdieBctx.globalCompositeOperation = "multiply";
        birdieBctx.fillStyle = color;
        birdieBctx.fillRect(0, 0, box, box);
        birdieBctx.globalCompositeOperation = "destination-in";
        birdieBctx.drawImage(img, sx, sy, sw, sh, 0, 0, box, box);
      }
      birdieBctx.globalCompositeOperation = "source-over";
      birdieBctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(shot.x, shot.y);
      ctx.rotate(angle);
      ctx.drawImage(birdieBuf, -box / 2, -box / 2);
      ctx.restore();
    };
    for (const shot of (t && t.red) || []) drawBirdie(shot, "#ff3b4a");
    for (const shot of (t && t.minionShots) || []) drawBirdie(shot, "#ff3b4a");
    for (const shot of (t && t.yellow) || []) drawBirdie(shot, "#ffe14a");
    for (const shot of (t && t.reflect) || []) drawBirdie(shot, "#ff3b4a");
    for (const shot of (t && t.blue) || []) drawBirdie(shot, "#4aa8ff");
  }

  function drawTaskActors(state) {
    const task = state.task;
    if (task && task.index === 4) return;
    if (task && task.index === 5) {
      drawBossPlayers(state);
      return;
    }
    const t = (performance.now() - t0) / 1000;
    if (state.ldr && state.ldr.visible) {
      const playing = state.phase === "play" && state.task;
      const base = playing ? 70 : 148;
      const r = base * (state.ldr.scale || 1);
      drawLDR(640, playing ? 110 : 168, Math.max(28, r), state.ldr.mood || "idle", t);
      drawLabel("LDR", 640, (playing ? 110 : 168) + Math.max(28, r) + 16, "#c9b7ff");
    }
    const me = state.myCharacter;
    for (const p of display.values()) {
      if (!p.character) continue;
      drawCharacter(p.character, p.x, p.y, {
        mode: "play",
        facing: p.facing,
        moving: p.moving,
        anim: p.anim,
      });
      const name = p.character === "momo" ? "MOMO" : "TIAN TIAN";
      drawLabel(name, p.x, p.y + 14, p.character === me ? "#7cffb2" : "#f4e4c1");
    }
  }

  function drawBossPlayers(state) {
    const hearts = (state.task && state.task.hearts) || {};
    for (const p of display.values()) {
      if (!p.character) continue;
      const out = (hearts[p.character] || 0) <= 0;
      const shieldHits = (state.task && state.task.shieldHits) || {};
      const shieldCharges = shieldHits[p.character] || 0;
      const hurt = state.task && state.task.hurtFlash && state.task.hurtFlash[p.character] > 0;
      ctx.globalAlpha = out ? 0.35 : 1;
      if (shieldCharges > 0 && !out) {
        const frac = Math.max(0, Math.min(1, shieldCharges / 4));
        ctx.strokeStyle = "rgba(74, 208, 255, 0.28)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(74, 208, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
      }
      ctx.fillStyle = hurt && !out ? "#ff3b4a" : "#fff";
      ctx.fillRect(p.x - 13, p.y - 13, 26, 26);
      ctx.strokeStyle = "#140c12";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 13, p.y - 13, 26, 26);
      ctx.fillStyle = hurt && !out ? "#fff" : "#140c12";
      ctx.font = "12px 'Press Start 2P'";
      ctx.textAlign = "center";
      ctx.fillText(p.character === "momo" ? "M" : "T", p.x, p.y + 5);
      ctx.font = "8px 'Press Start 2P'";
      ctx.fillStyle = "#fff";
      ctx.fillText(p.character === "momo" ? "MOMO" : "TIAN TIAN", p.x, p.y + 28);
      const hp = hearts[p.character] || 0;
      ctx.fillStyle = "#ff6b9d";
      ctx.fillText("♥".repeat(hp) + "♡".repeat(Math.max(0, 3 - hp)), p.x, p.y + 42);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    }
  }

  function drawMaze(task) {
    const { rows, tile, originX, originY } = task;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const cell = rows[r][c];
        const x = originX + c * tile;
        const y = originY + r * tile;
        if (cell === "W") {
          ctx.fillStyle = "#0d0810";
          ctx.fillRect(x, y, tile, tile);
          ctx.fillStyle = "#2a1620";
          ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        } else {
          ctx.fillStyle = (r + c) % 2 ? "#3a2a22" : "#32241e";
          ctx.fillRect(x, y, tile, tile);
        }
        if (cell === "X") {
          ctx.fillStyle = "#ff3b6b";
          ctx.beginPath();
          ctx.moveTo(x + 8, y + tile - 8);
          ctx.lineTo(x + tile / 2, y + 8);
          ctx.lineTo(x + tile - 8, y + tile - 8);
          ctx.closePath();
          ctx.fill();
        }
        if (cell === "S") {
          ctx.fillStyle = "#7cffb2";
          ctx.fillRect(x + 12, y + 12, tile - 24, tile - 24);
        }
        if (cell === "G") {
          ctx.fillStyle = "#ffd36a";
          ctx.fillRect(x + 10, y + 10, tile - 20, tile - 20);
        }
      }
    }
    ctx.strokeStyle = "#f4e4c1";
    ctx.lineWidth = 3;
    ctx.strokeRect(originX - 2, originY - 2, task.cols * tile + 4, task.nrows * tile + 4);
  }

  function drawConnection(task, t) {
    ctx.fillStyle = "#09060c";
    ctx.fillRect(540, 180, 200, 460);
    ctx.fillStyle = "rgba(80, 20, 40, 0.35)";
    ctx.fillRect(540, 180, 200, 460);
    ctx.fillStyle = "#2a1820";
    ctx.fillRect(60, 180, 480, 440);
    ctx.fillRect(740, 180, 480, 440);
    ctx.strokeStyle = "#f4e4c1";
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 180, 480, 440);
    ctx.strokeRect(740, 180, 480, 440);

    for (const c of task.crystals || []) {
      if (c.got) continue;
      const pulse = 8 + Math.sin(t * 6 + c.x) * 2;
      ctx.fillStyle = "#ff6b9d";
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - pulse);
      ctx.lineTo(c.x + pulse, c.y);
      ctx.lineTo(c.x, c.y + pulse);
      ctx.lineTo(c.x - pulse, c.y);
      ctx.closePath();
      ctx.fill();
    }
    for (const h of task.hazards || []) {
      ctx.fillStyle = "#110814";
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ff3b6b";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const key of ["momo", "tiantian"]) {
      const sw = task.switches && task.switches[key];
      if (!sw) continue;
      ctx.fillStyle = sw.on ? "#7cffb2" : "#443038";
      ctx.fillRect(sw.x - 28, sw.y - 10, 56, 20);
      ctx.strokeStyle = "#f4e4c1";
      ctx.strokeRect(sw.x - 28, sw.y - 10, 56, 20);
    }
    if (task.charge > 0) {
      ctx.fillStyle = "#140c12";
      ctx.fillRect(490, 150, 300, 16);
      ctx.fillStyle = "#ff6b9d";
      ctx.fillRect(492, 152, 296 * task.charge, 12);
    }
  }

  function drawReunion(state, t) {
    drawCafe(1);
    ctx.fillStyle = "rgba(255, 214, 180, 0.18)";
    ctx.fillRect(0, 0, W, H);
  }

  function drawReunionActors(state) {
    if (state.ldr && state.ldr.visible) {
      const r = 90 * (state.ldr.scale || 1);
      drawLDR(640, 220, r, state.ldr.mood || "hurt", (performance.now() - t0) / 1000);
    }
    for (const p of display.values()) {
      if (!p.character) continue;
      drawCharacter(p.character, p.x, p.y, {
        mode: "end",
        facing: p.facing,
        moving: p.moving,
        anim: p.anim,
      });
    }
    drawTable(640, 518);
  }

  function updateParticles() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.01;
      if (p.kind === "heart") p.vy -= 0.01;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.kind === "heart") {
        ctx.fillStyle = "#ff6b9d";
        ctx.fillRect(p.x, p.y, p.s, p.s);
        ctx.fillRect(p.x - p.s * 0.5, p.y - p.s * 0.4, p.s, p.s);
        ctx.fillRect(p.x + p.s * 0.5, p.y - p.s * 0.4, p.s, p.s);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.s, p.s * 1.4);
      }
      ctx.globalAlpha = 1;
    }
  }

  function frame(state) {
    if (!ctx) return;
    px();
    const t = (performance.now() - t0) / 1000;
    lerpPlayers(state.players || []);
    updateParticles();

    const scale = dpr();
    let ox = 0;
    let oy = 0;
    if (performance.now() < shake.until) {
      ox = (Math.random() - 0.5) * shake.mag * 2;
      oy = (Math.random() - 0.5) * shake.mag * 2;
    }
    ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
    ctx.imageSmoothingEnabled = false;
    if (sctx) {
      sctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
      sctx.imageSmoothingEnabled = false;
      sctx.clearRect(-40, -40, W + 80, H + 80);
    }

    ctx.fillStyle = "#140c12";
    ctx.fillRect(-20, -20, W + 40, H + 40);

    const scene = state.scene || "select";
    const overlayUp =
      !state.myCharacter ||
      state.phase === "lobby" ||
      state.phase === "select" ||
      state.phase === "complete";
    if (spriteCanvas) spriteCanvas.style.visibility = overlayUp ? "hidden" : "visible";

    if (scene === "dinner") drawDinner(state, t);
    else if (scene === "black") drawBlack(state);
    else if (scene === "task" || scene === "lobby") {
      if (scene === "lobby") {
        drawCafe(0.85);
        ctx.fillStyle = "rgba(10,6,8,0.35)";
        ctx.fillRect(0, 0, W, H);
      } else drawTaskArena(state, t);
    } else if (scene === "reunion") {
      drawReunion(state, t);
      if (state.phase === "complete" && particles.filter((p) => p.kind === "confetti").length < 40) {
        spawnConfetti(3);
      }
    } else {
      drawCafe(0.55);
      ctx.fillStyle = "rgba(10,6,8,0.45)";
      ctx.fillRect(0, 0, W, H);
    }

    drawParticles();

    if (!overlayUp) {
      onSprites(() => {
        if (scene === "dinner") drawDinnerActors(state);
        else if (scene === "task") drawTaskActors(state);
        else if (scene === "reunion") drawReunionActors(state);
      });
    }

    if (flash.a > 0) {
      const paintFlash = (c) => {
        c.fillStyle = flash.color;
        c.globalAlpha = flash.a;
        c.fillRect(-20, -20, W + 40, H + 40);
        c.globalAlpha = 1;
      };
      paintFlash(ctx);
      if (sctx) paintFlash(sctx);
      flash.a *= 0.86;
      if (flash.a < 0.02) flash.a = 0;
    }
  }

  return { init, fit, frame, applyFx, spawnHearts, spawnConfetti };
})();
