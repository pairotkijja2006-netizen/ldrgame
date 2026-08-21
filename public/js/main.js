(() => {
  const canvas = document.getElementById("game");
  let state = null;
  let full = false;
  let lost = false;
  let loaded = false;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function musicFor(s) {
    if (!s) return null;
    if (s.task && s.task.silence) return "off";
    if (s.phase === "play" && s.task && s.task.index === 5 && s.task.stage === "winWait") return "off";
    if (s.phase === "complete" || s.scene === "reunion") return "background";
    if (s.decision && s.decision.game === 5) return "background";
    if (s.phase === "play" && s.task && s.task.index === 5) return "boss";
    return "background";
  }

  function onState(next) {
    lost = false;
    const prevFx = next.fx;
    state = next;
    Render.applyFx(prevFx);
    if (!state.task || state.task.index !== 4) AudioBus.stopHold();
    else {
      AudioBus.keepHolds((state.task.tiles || []).filter((tile) => tile.holding).map((tile) => tile.id));
    }
    const track = musicFor(state);
    if (track) AudioBus.setTrack(track);
  }

  Net.on("full", () => {
    full = true;
    state = null;
  });
  Net.on("lost", () => {
    if (!full) lost = true;
  });
  Net.on("connect", () => {
    lost = false;
  });
  Net.on("joined", () => {
    lost = false;
    full = false;
  });
  Net.on("state", onState);
  Net.on("notice", () => {});

  window.addEventListener(
    "keydown",
    (e) => {
      AudioBus.unlock();
      if (e.code === "Enter") {
        if (state && state.phase === "play" && state.task && state.task.index === 3 && !state.task.iDraw) {
          const el = document.getElementById("guess-word");
          e.preventDefault();
          Net.emit("puzzle", { action: "guess", word: el ? el.value : "" });
          if (el) el.value = "";
          return;
        }
      }
      if (Input.isTyping(e)) return;
      if (e.code === "Escape") {
        if (state && state.pauseReason === "disconnect") return;
        if (state && state.phase === "paused") Net.emit("resume");
        else Net.emit("pause");
      }
      if (e.code === "Space" || e.code === "Enter") {
        if (state && state.task && state.task.brief) {
          e.preventDefault();
          return;
        }
        if (state && state.phase === "script") Net.emit("advance");
      }
      if (e.code === "KeyE") Net.emit("interact");
      if (state && state.phase === "play" && state.task && state.task.index === 4) {
        const lanes = { KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyG: 4, KeyH: 5 };
        if (lanes[e.code] != null) {
          if (e.repeat) return;
          e.preventDefault();
          Net.emit("puzzle", { action: "press", lane: lanes[e.code] });
        }
      }
    },
    true
  );

  window.addEventListener(
    "keyup",
    (e) => {
      if (!state || state.phase !== "play" || !state.task || state.task.index !== 4) return;
      const lanes = { KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyG: 4, KeyH: 5 };
      if (lanes[e.code] != null) Net.emit("puzzle", { action: "release", lane: lanes[e.code] });
    },
    true
  );

  document.getElementById("mute-btn").addEventListener("click", async () => {
    await AudioBus.unlock();
    const muted = AudioBus.toggle();
    document.getElementById("mute-btn").textContent = muted ? "♪ OFF" : "♪ ON";
  });

  const fsBtn = document.getElementById("fullscreen-btn");
  const stageEl = document.getElementById("stage");
  function syncFullscreenBtn() {
    if (!fsBtn) return;
    fsBtn.textContent = document.fullscreenElement ? "EXIT FULLSCREEN" : "FULLSCREEN";
  }
  if (fsBtn && stageEl) {
    fsBtn.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await stageEl.requestFullscreen();
      } catch (err) {
        console.error(err);
      }
    });
    document.addEventListener("fullscreenchange", () => {
      syncFullscreenBtn();
      if (loaded) Render.fit();
    });
    syncFullscreenBtn();
  }

  window.addEventListener("pointerdown", () => AudioBus.unlock(), { once: false });

  function loop() {
    if (full) UI.sync(null, { full: true });
    else if (lost) UI.sync(state, { lost: true });
    else if (state) {
      UI.sync(state);
      if (loaded) Render.frame(state);
    } else {
      UI.sync(null, { connecting: true });
    }
    requestAnimationFrame(loop);
  }

  setInterval(() => {
    if (!state || full) return;
    if (state.phase === "paused") return;
    if (state.phase === "play") Net.emit("input", Input.snapshot());
  }, 50);

  async function boot() {
    try {
      const [momo, tiantian, cafe, court, birdie] = await Promise.all([
        loadImage("/assets/momo.png"),
        loadImage("/assets/tiantian.png"),
        loadImage("/assets/cafe.png"),
        loadImage("/assets/court.png"),
        loadImage("/assets/birdie.png"),
      ]);
      Render.init(canvas, document.getElementById("sprites"), { momo, tiantian, cafe, court, birdie });
      Render.fit();
      loaded = true;
    } catch (err) {
      console.error(err);
      UI.renderError();
      return;
    }
    Input.bind();
    window.addEventListener("resize", () => Render.fit());
    Net.connect();
    loop();
  }

  boot();
})();
