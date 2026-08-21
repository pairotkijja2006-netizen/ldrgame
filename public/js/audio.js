const AudioBus = (() => {
  let ctx = null;
  let muted = false;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let track = null;
  let step = 0;
  let fadeTimer = null;
  const holds = new Map();
  const files = Object.create(null);
  let musicVol = 0.72;
  let sfxVol = 1;

  try {
    const m = parseFloat(localStorage.getItem("ldr_music_vol"));
    const s = parseFloat(localStorage.getItem("ldr_sfx_vol"));
    if (!Number.isNaN(m)) musicVol = Math.max(0, Math.min(1, m));
    if (!Number.isNaN(s)) sfxVol = Math.max(0, Math.min(1, s));
  } catch (err) {
    /* ignore */
  }

  const FILE_TRACKS = {
    background: "/assets/backgroundtheme.mp3",
    boss: "/assets/bosstheme.mp3",
  };

  const TRACKS = {
    ending: { bpm: 80, notes: [261.63, 329.63, 392.0, 523.25, 493.88, 392.0, 329.63, 311.13], wave: "triangle", vol: 0.08 },
  };

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 1;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(master);
  }

  async function unlock() {
    ensure();
    if (ctx.state === "suspended") await ctx.resume();
    for (const name of Object.keys(FILE_TRACKS)) getFile(name);
  }

  function getFile(name) {
    if (!FILE_TRACKS[name]) return null;
    if (!files[name]) {
      const el = new Audio(FILE_TRACKS[name]);
      el.loop = true;
      el.preload = "auto";
      el.volume = 0;
      files[name] = el;
    }
    return files[name];
  }

  function beep(freq, dur, type, vol, dest) {
    const isMusic = dest === musicGain;
    const mul = isMusic ? musicVol : sfxVol;
    if (muted || !ctx || mul <= 0) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime((vol || 0.08) * mul, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(dest || sfxGain);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol) {
    if (muted || !ctx) return;
    const n = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = n;
    const g = ctx.createGain();
    g.gain.value = vol || 0.12;
    src.connect(g);
    g.connect(sfxGain);
    src.start();
  }

  function playSfx(name) {
    if (muted || sfxVol <= 0) return;
    ensure();
    switch (name) {
      case "click":
        beep(880, 0.07, "square", 0.32);
        break;
      case "shoot":
        beep(980, 0.06, "square", 0.34);
        beep(1320, 0.05, "triangle", 0.18);
        break;
      case "shot":
        beep(220, 0.08, "sawtooth", 0.22);
        beep(140, 0.12, "square", 0.16);
        break;
      case "switch":
        beep(220, 0.08, "sawtooth", 0.22);
        beep(140, 0.12, "square", 0.16);
        break;
      case "barrier":
        beep(180, 0.08, "square", 0.28);
        beep(520, 0.1, "triangle", 0.22);
        noise(0.12, 0.22);
        break;
      case "type":
        beep(420 + Math.random() * 80, 0.03, "square", 0.08);
        break;
      case "boom":
        beep(60, 0.4, "sawtooth", 0.28);
        noise(0.35, 0.32);
        break;
      case "rumble":
        beep(48, 0.5, "sawtooth", 0.18);
        break;
      case "hurt":
        beep(180, 0.12, "square", 0.16);
        beep(90, 0.2, "sawtooth", 0.14);
        break;
      case "success":
        beep(523, 0.1, "square", 0.2);
        setTimeout(() => beep(659, 0.1, "square", 0.2), 80);
        setTimeout(() => beep(784, 0.18, "square", 0.22), 160);
        break;
      case "collect":
        beep(660, 0.07, "triangle", 0.07);
        beep(990, 0.1, "triangle", 0.05);
        break;
      case "heal":
        beep(392, 0.09, "square", 0.07);
        setTimeout(() => beep(523, 0.1, "square", 0.08), 70);
        setTimeout(() => beep(659, 0.16, "triangle", 0.09), 150);
        break;
      case "deflect":
        beep(740, 0.06, "square", 0.09);
        beep(980, 0.08, "triangle", 0.07);
        break;
      case "separate":
        beep(90, 0.3, "sawtooth", 0.14);
        noise(0.4, 0.18);
        break;
      case "victory":
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle", 0.09), i * 120));
        break;
      case "sip":
        beep(320, 0.08, "triangle", 0.05);
        beep(180, 0.12, "sine", 0.04);
        break;
      case "note":
        break;
      default:
        break;
    }
  }

  function playNote(freq) {
    if (muted || sfxVol <= 0) return;
    ensure();
    beep(freq, 0.32, "triangle", 0.16);
    beep(freq * 2, 0.14, "sine", 0.05);
  }

  function startHold(freq, id) {
    const key = String(id || freq);
    stopHold(key);
    if (muted || sfxVol <= 0) return;
    ensure();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    o1.type = "triangle";
    o2.type = "sine";
    o1.frequency.value = freq;
    o2.frequency.value = freq * 2;
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.11 * sfxVol, ctx.currentTime + 0.04);
    o1.connect(filter);
    o2.connect(g);
    filter.connect(g);
    g.connect(sfxGain);
    o1.start();
    o2.start();
    holds.set(key, { o1, o2, g });
  }

  function keepHolds(ids) {
    const live = new Set((ids || []).map((id) => String(id)));
    for (const key of [...holds.keys()]) {
      if (!live.has(String(key))) stopHold(key);
    }
  }

  function stopHold(id) {
    if (!id) {
      for (const key of [...holds.keys()]) stopHold(key);
      return;
    }
    const v = holds.get(String(id));
    if (!v) return;
    holds.delete(String(id));
    try {
      v.g.gain.cancelScheduledValues(ctx.currentTime);
      v.g.gain.setValueAtTime(Math.max(0.0001, v.g.gain.value), ctx.currentTime);
      v.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      v.o1.stop(ctx.currentTime + 0.1);
      v.o2.stop(ctx.currentTime + 0.1);
    } catch (err) {
      /* already stopped */
    }
  }

  function stopSynth() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function stopFiles(except) {
    for (const [name, el] of Object.entries(files)) {
      if (name === except) continue;
      el.pause();
      el.volume = 0;
      try {
        el.currentTime = 0;
      } catch (err) {
        /* ignore */
      }
    }
  }

  function clearFade() {
    if (fadeTimer) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  function fadeVolume(el, to, ms, then) {
    clearFade();
    const from = el.volume;
    const steps = Math.max(6, Math.round(ms / 40));
    let i = 0;
    fadeTimer = setInterval(() => {
      i += 1;
      const t = i / steps;
      el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (i >= steps) {
        clearFade();
        el.volume = to;
        if (then) then();
      }
    }, 40);
  }

  function startSynth() {
    const t = TRACKS[track];
    if (!t || muted || musicTimer) return;
    ensure();
    step = 0;
    const interval = 60000 / t.bpm / 2;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const f = t.notes[step % t.notes.length];
      beep(f, 0.18, t.wave, t.vol, musicGain);
      step += 1;
    }, interval);
  }

  function playFile(name) {
    const el = getFile(name);
    if (!el || muted) return;
    stopSynth();
    stopFiles(name);
    const start = () => {
      el.volume = 0;
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
      fadeVolume(el, (name === "boss" ? 0.2 : 0.26) * musicVol, 420);
    };
    if (!el.paused && el.volume > 0.05) return;
    start();
  }

  function startDesired() {
    if (muted || !track || track === "off") return;
    if (FILE_TRACKS[track]) playFile(track);
    else startSynth();
  }

  function setTrack(name) {
    if (!name) return;
    if (name === "off") {
      track = "off";
      clearFade();
      stopSynth();
      stopFiles();
      return;
    }
    if (track === name) {
      if (muted) return;
      if (fadeTimer) return;
      if (FILE_TRACKS[name]) {
        const el = getFile(name);
        if (el && !el.paused) return;
      } else if (musicTimer) return;
      startDesired();
      return;
    }
    const prev = track;
    track = name;
    if (muted) {
      stopSynth();
      stopFiles();
      return;
    }
    if (FILE_TRACKS[prev]) {
      const old = getFile(prev);
      fadeVolume(old, 0, 380, () => {
        old.pause();
        old.volume = 0;
        startDesired();
      });
      return;
    }
    stopSynth();
    stopFiles();
    startDesired();
  }

  function setMuted(v) {
    muted = v;
    if (muted) {
      clearFade();
      stopSynth();
      stopHold();
      for (const el of Object.values(files)) el.pause();
      return;
    }
    startDesired();
  }

  function setMusicVolume(v) {
    musicVol = Math.max(0, Math.min(1, Number(v) || 0));
    try {
      localStorage.setItem("ldr_music_vol", String(musicVol));
    } catch (err) {
      /* ignore */
    }
    if (FILE_TRACKS[track] && !muted) {
      const el = getFile(track);
      if (el && !el.paused) el.volume = (track === "boss" ? 0.2 : 0.26) * musicVol;
      if (musicVol <= 0 && el) {
        el.pause();
        el.volume = 0;
      } else if (musicVol > 0 && el && el.paused) startDesired();
    }
  }

  function setSfxVolume(v) {
    sfxVol = Math.max(0, Math.min(1, Number(v) || 0));
    try {
      localStorage.setItem("ldr_sfx_vol", String(sfxVol));
    } catch (err) {
      /* ignore */
    }
  }

  function volumes() {
    return { music: musicVol, sfx: sfxVol };
  }

  return {
    unlock,
    playSfx,
    playNote,
    startHold,
    stopHold,
    keepHolds,
    setMusicVolume,
    setSfxVolume,
    volumes,
    setTrack,
    setMuted,
    isMuted: () => muted,
    toggle() {
      setMuted(!muted);
      return muted;
    },
  };
})();
