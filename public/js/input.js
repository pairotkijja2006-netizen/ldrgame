const Input = (() => {
  const down = Object.create(null);
  const taps = { left: false, right: false, up: false, down: false };
  const piano = [false, false, false, false, false, false];
  const pianoPointers = new Map();

  function isTextField(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type = (el.type || "text").toLowerCase();
      return !["button", "submit", "checkbox", "radio", "range", "file", "color", "reset", "image", "hidden"].includes(type);
    }
    return false;
  }

  function isTyping(e) {
    const active = document.activeElement;
    const target = e && e.target;
    if (isTextField(active) || isTextField(target)) return true;
    if (target && target.closest && target.closest("input, textarea, [contenteditable='true']")) return true;
    return false;
  }

  function bind() {
    window.addEventListener(
      "keydown",
      (e) => {
        if (isTyping(e)) return;
        down[e.code] = true;
        down[e.key] = true;
        if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
          e.preventDefault();
        }
      },
      true
    );
    window.addEventListener(
      "keyup",
      (e) => {
        down[e.code] = false;
        down[e.key] = false;
      },
      true
    );
    window.addEventListener("blur", () => {
      for (const k of Object.keys(down)) down[k] = false;
      for (let i = 0; i < 6; i++) piano[i] = false;
      pianoPointers.clear();
    });
    window.addEventListener("pointerup", (e) => {
      const lane = pianoPointers.get(e.pointerId);
      if (lane == null) return;
      piano[lane] = false;
      pianoPointers.delete(e.pointerId);
    });
    window.addEventListener("pointercancel", (e) => {
      const lane = pianoPointers.get(e.pointerId);
      if (lane == null) return;
      piano[lane] = false;
      pianoPointers.delete(e.pointerId);
    });
  }

  function snapshot() {
    return {
      up: !!(down.KeyW || down.ArrowUp || taps.up),
      down: !!(down.KeyS || down.ArrowDown || taps.down),
      left: !!(down.KeyA || down.ArrowLeft || taps.left),
      right: !!(down.KeyD || down.ArrowRight || taps.right),
      fire: !!(down.Space || down.KeyJ),
      piano: [
        !!(piano[0] || down.KeyA),
        !!(piano[1] || down.KeyS),
        !!(piano[2] || down.KeyD),
        !!(piano[3] || down.KeyF),
        !!(piano[4] || down.KeyG),
        !!(piano[5] || down.KeyH),
      ],
    };
  }

  function pressed(code) {
    return !!down[code];
  }

  return {
    bind,
    snapshot,
    pressed,
    down,
    isTextField,
    isTyping,
    get tapLeft() {
      return taps.left;
    },
    set tapLeft(v) {
      taps.left = !!v;
    },
    get tapRight() {
      return taps.right;
    },
    set tapRight(v) {
      taps.right = !!v;
    },
    get tapUp() {
      return taps.up;
    },
    set tapUp(v) {
      taps.up = !!v;
    },
    get tapDown() {
      return taps.down;
    },
    set tapDown(v) {
      taps.down = !!v;
    },
    setPianoLane(lane, held, pointerId) {
      const i = Number(lane);
      if (i < 0 || i > 5) return;
      piano[i] = !!held;
      if (pointerId == null) return;
      if (held) pianoPointers.set(pointerId, i);
      else pianoPointers.delete(pointerId);
    },
  };
})();
