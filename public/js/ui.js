const UI = (() => {
  const root = () => document.getElementById("ui");
  const dlgRoot = () => document.getElementById("dialogue");
  let lastKey = "";
  let pausedLocal = false;
  let typeLen = 0;
  let dialogueSkipKey = "";
  let dialogueSkipped = false;
  let draftWord = "";
  let draftQuiz = { prompt: "", a: "", b: "", c: "", correct: null };

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setDialogue(html, state) {
    const host = dlgRoot();
    if (!host) return;
    host.innerHTML = html || "";
    const dlg = host.querySelector(".dialogue");
    if (dlg) {
      dlg.addEventListener("click", () => {
        if (state && state.line && state.line.text) {
          const key = `${state.line.startedAt}|${state.line.text}`;
          const full = state.line.text.length;
          const elapsed = Date.now() - state.line.startedAt;
          const n =
            state.line.revealed || (dialogueSkipped && dialogueSkipKey === key)
              ? full
              : Math.min(full, Math.floor(elapsed / 28));
          if (n < full) {
            dialogueSkipKey = key;
            dialogueSkipped = true;
            const textEl = dlg.querySelector("#dlg-text") || dlg.querySelector(".text");
            if (textEl) textEl.textContent = state.line.text;
            const next = dlg.querySelector(".next");
            if (next) next.style.display = state.cinematic ? "none" : "";
            Net.emit("advance");
            return;
          }
        }
        Net.emit("advance");
      });
    }
  }

  function setPause(v) {
    pausedLocal = v;
  }
  function isPaused() {
    return pausedLocal;
  }

  function keyOf(state, extra) {
    if (!state) return extra || "none";
    return [
      state.phase,
      state.scene,
      state.myCharacter,
      state.playerCount,
      state.countdown,
      state.taken && state.taken.momo,
      state.taken && state.taken.tiantian,
      state.line && state.line.text,
      state.line && state.line.startedAt,
      state.task && state.task.index,
      state.task && state.task.stage,
      state.task && state.task.round,
      state.task && state.task.category,
      state.task && state.task.myReady,
      state.task && state.task.partnerReady,
      state.task && state.task.banner,
      state.task && state.task.last && JSON.stringify(state.task.last),
      state.task && state.task.setId,
      state.task && state.task.waitingForPartner,
      state.task && state.task.questionNumber,
      state.task && state.task.created,
      state.task && state.task.partnerCreated,
      state.task && state.task.answered,
      state.task && state.task.feedback && JSON.stringify(state.task.feedback),
      state.task && state.task.current && state.task.current.prompt,
      state.task && state.task.scores && JSON.stringify(state.task.scores),
      state.task && state.task.picks && `${state.task.picks.momo}-${state.task.picks.tiantian}`,
      state.task && state.task.streak,
      state.task && state.task.taunt,
      state.task && state.task.word,
      state.task && state.task.blanks,
      state.task && state.task.hintLeft,
      state.task && state.task.hintPos,
      state.task && state.task.wordIndex,
      state.task && state.task.guessed,
      state.task && state.task.banner,
      state.task && state.task.tool,
      state.task && state.task.iDraw,
      state.task && state.task.stage,
      state.task && state.task.hits,
      state.task && state.task.coins,
      state.task && state.task.gunLevel,
      state.task && state.task.brief && state.task.brief.overlay,
      state.task && state.task.buffs && JSON.stringify(state.task.buffs),
      state.task && state.task.shopVote && JSON.stringify(state.task.shopVote),
      state.task && state.task.shopReady && JSON.stringify(state.task.shopReady),
      state.task && Math.ceil(state.task.shopTimer || 0),
      state.task && state.task.shopPick,
      state.task && state.task.shopMsg,
      state.task && state.task.shopToast,
      state.task && state.task.myRacket,
      state.task && Math.ceil(state.task.myRacketRegen || 0),
      state.task && state.task.myShieldHits,
      state.task && state.task.finalPhase,
      state.task && state.task.brief && state.task.brief.text,
      state.task && state.task.brief && state.task.brief.kind,
      state.task && state.task.brief && state.task.brief.titleStyle,
      state.task && state.task.brief && state.task.brief.startedAt,
      state.task && state.task.brief && state.task.brief.revealed,
      state.task && state.task.bonusFlashTimer,
      state.task && state.task.hearts && JSON.stringify(state.task.hearts),
      state.task && state.task.noteMsg,
      state.task && state.task.walls && JSON.stringify(state.task.walls.map((w) => w.hp)),
      state.task && state.task.shielded && JSON.stringify(state.task.shielded),
      state.task && state.task.shopBought && JSON.stringify(state.task.shopBought),
      state.decision && state.decision.game,
      state.decision && state.decision.stage,
      state.decision && state.decision.picks && `${state.decision.picks.momo}-${state.decision.picks.tiantian}`,
      state.failMessage,
      state.disconnectedName,
      pausedLocal,
      state.completeStage,
      Math.ceil(state.endTimer || 0),
      extra || "",
    ].join("|");
  }

  function el(html) {
    const d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function renderFull() {
    root().innerHTML = "";
    root().appendChild(
      el(`<div class="overlay solid">
        <div class="title">SERVER FULL</div>
        <p class="subtitle">Momo and Tian Tian are already playing!<br/><br/>Please try again later.</p>
      </div>`)
    );
  }

  function renderLost() {
    root().innerHTML = "";
    root().appendChild(
      el(`<div class="overlay">
        <div class="title">CONNECTION LOST</div>
        <p class="subtitle">Trying to reconnect...</p>
      </div>`)
    );
  }

  function renderSelect(state) {
    const taken = state.taken || {};
    const mine = state.myCharacter;
    const card = (id, name, cls) => {
      const isTaken = taken[id] && mine !== id;
      const isMine = mine === id;
      const disabled = !!mine && !isMine;
      let badge = "AVAILABLE";
      let extra = "";
      if (isMine) badge = "✓ SELECTED";
      else if (isTaken) {
        badge = "TAKEN";
        extra = `<div class="stamp">TAKEN</div>`;
      }
      return `<button class="char-card ${cls} ${isTaken ? "taken" : ""} ${isMine ? "mine" : ""} ${disabled ? "disabled" : ""}" data-char="${id}" ${isTaken || disabled ? "disabled" : ""}>
        ${extra}
        <img class="pixel" src="/assets/${id === "momo" ? "momo" : "tiantian"}.png" alt="${name}" />
        <h2>${name}</h2>
        <div class="badge ${isTaken ? "taken" : ""}">${badge}</div>
      </button>`;
    };
    root().innerHTML = "";
    const wrap = el(`<div class="overlay soft">
      <div class="title">WHO ARE YOU?</div>
      <p class="subtitle">A 2-player cooperative love story.<br/>Pick your person.</p>
      <p class="subtitle">Players: ${state.playerCount != null ? state.playerCount : 0} / ${state.maxPlayers || 2}</p>
      <div class="row">
        ${card("momo", "MOMO", "momo")}
        ${card("tiantian", "TIAN TIAN", "tian")}
      </div>
      <p class="subtitle">Momo is taller, but Tian Tian is stronger.</p>
    </div>`);
    wrap.querySelectorAll("[data-char]").forEach((btn) => {
      btn.addEventListener("click", () => {
        AudioBus.playSfx("click");
        Net.emit("selectCharacter", btn.getAttribute("data-char"));
      });
    });
    root().appendChild(wrap);
  }

  function renderLobby(state) {
    const players = state.players || [];
    const momo = players.find((p) => p.character === "momo");
    const tian = players.find((p) => p.character === "tiantian");
    const momoStatus = momo ? (momo.connected ? "✓ READY" : "DISCONNECTED") : "WAITING...";
    const tianStatus = tian ? (tian.connected ? "✓ READY" : "DISCONNECTED") : "WAITING...";
    const both = momo && tian;
    root().innerHTML = "";
    const html = `<div class="overlay soft">
      <div class="title">${both ? "Both players are here!" : "WAITING ROOM"}</div>
      <p class="subtitle">Players: ${state.playerCount != null ? state.playerCount : 0} / ${state.maxPlayers || 2}</p>
      <div class="row">
        <div class="lobby-card">
          <h3>MOMO</h3>
          <div class="status ${momo ? "ok" : ""}">${momoStatus}</div>
        </div>
        <div class="lobby-card">
          <h3>TIAN TIAN</h3>
          <div class="status ${tian ? "ok" : ""}">${tianStatus}</div>
        </div>
      </div>
      ${state.countdown != null ? `<div class="countdown">${state.countdown}</div>` : `<p class="subtitle">Waiting for ${!momo ? "Momo" : "Tian Tian"}...</p>`}
    </div>`;
    root().appendChild(el(html));
  }

  function hud(state) {
    const hearts = "♥".repeat(state.ldrHearts || 0) + "♡".repeat(Math.max(0, 5 - (state.ldrHearts || 0)));
    const p = state.progress || [false, false, false, false, false];
    const me = state.myCharacter === "momo" ? "MOMO" : state.myCharacter === "tiantian" ? "TIAN TIAN" : "";
    const current = state.currentStage || 0;
    const checks = [1, 2, 3, 4, 5]
      .map((n) => `${p[n - 1] ? "[✓] CLEARED" : "[ ]"} GAME ${n}`)
      .join("<br/>");
    return `<div class="hud">
      <div class="box">LDR<br/><span class="hearts">${hearts}</span></div>
      <div class="box">CURRENT STAGE<br/>${current ? "GAME " + current : "—"}</div>
      <div class="box">STAGES CLEARED<br/>${checks}</div>
      ${me ? `<div class="box you-are">YOU ARE ${me}</div>` : ""}
    </div>`;
  }

  function dialoguePlace(state) {
    if (state.scene === "dinner" || state.scene === "reunion") return "bottom";
    const players = state.players || [];
    if (players.some((p) => (p.y || 0) > 560)) return "top";
    return "bottom";
  }

  function dialogueBox(state, typed) {
    if (!state.line || !state.line.text) return "";
    const who = state.line.speaker || "";
    const cls = who === "LDR" || (who && String(who).indexOf("LDR") === 0) ? "ldr" : who === "SYSTEM" ? "sys" : "";
    const done = typed >= state.line.text.length;
    const showNext = done && !(state.cinematic);
    const scene = state.scene || "story";
    const place = dialoguePlace(state);
    const portrait =
      who === "Momo" ? "/assets/dlg-momo.png" : who === "Tian Tian" ? "/assets/dlg-tiantian.png" : "";
    const portraitCls = portrait ? " has-portrait" : "";
    return `<div class="dialogue over-world place-${place} scene-${scene}${portraitCls}">
      ${portrait ? `<img class="dlg-portrait" src="${portrait}" alt="" />` : ""}
      <div class="dlg-copy">
        ${who ? `<div class="who ${cls}">${who}</div>` : ""}
        <div class="text" id="dlg-text"></div>
      </div>
      ${showNext ? `<div class="next">▼</div>` : ""}
    </div>`;
  }

  function choiceTag(i) {
    return ["A)", "B)", "C)", "D)"][i] || "";
  }

  function emptyQuizDraft() {
    return { prompt: "", a: "", b: "", c: "", d: "", correct: null };
  }

  function bindTextField(el, onChange) {
    if (!el) return;
    el.addEventListener(
      "keydown",
      (e) => {
        e.stopPropagation();
      },
      true
    );
    el.addEventListener("keyup", (e) => e.stopPropagation(), true);
    el.addEventListener("keypress", (e) => e.stopPropagation(), true);
    el.addEventListener("input", () => {
      if (onChange) onChange();
    });
    // Fields render read-only so the browser cannot autofill them with a previous
    // run's answers; they become editable once the initial paint is done.
    const unlock = () => el.removeAttribute("readonly");
    el.addEventListener("pointerdown", unlock);
    el.addEventListener("focus", unlock);
    requestAnimationFrame(unlock);
  }

  function moveLabel(m) {
    if (m === "rock") return "ROCK";
    if (m === "paper") return "PAPER";
    if (m === "scissors") return "SCISSORS";
    return "?";
  }

  function game1Panel(state) {
    const t = state.task;
    if (!t || t.index !== 1) return "";
    const history = t.history || [];
    const hist = history.length
      ? `<div class="hist-title">PREVIOUS ATTEMPTS</div>` +
        history
          .map(
            (h, i) =>
              `<div class="hist ${h.match ? "ok" : ""}">ATTEMPT ${h.attempt || i + 1}<br/>MOMO ${esc(h.momo)}<br/>TIAN TIAN ${esc(h.tiantian)}</div>`
          )
          .join("")
      : "";
    if (t.banner) {
      return `<div class="game-panel" id="game-panel"><div class="win-banner">${esc(t.banner)}</div>
        <div class="reveal">MOMO<br/><b>${esc(t.last && t.last.momo)}</b><br/><br/>TIAN TIAN<br/><b>${esc(t.last && t.last.tiantian)}</b></div></div>`;
    }
    if (t.stage === "reveal" && t.last) {
      return `<div class="game-panel" id="game-panel">
        <div class="timer-block">TIME<br/><span id="time-left">00</span></div>
        <div class="cat">CATEGORY<br/><span>${esc(t.category)}</span></div>
        <div class="reveal">Momo chose: <b>${esc(t.last.momo)}</b><br/>Tian Tian chose: <b>${esc(t.last.tiantian)}</b></div>
        <div class="fail">${esc(state.failMessage || "")}</div>
        <div class="hist-wrap">${hist}</div>
      </div>`;
    }
    return `<div class="game-panel scroll" id="game-panel">
      <div class="timer-block">TIME<br/><span id="time-left">25</span></div>
      <div class="cat">CATEGORY<br/><span>${esc(t.category)}</span></div>
      <p class="tiny">Do not talk, hint, or share answers.</p>
      <p class="tiny">ATTEMPT ${t.round || 1}  ·  Partner: ${t.partnerReady ? "READY ✓" : "thinking..."}</p>
      <input class="pixel-input" id="tele-word" maxlength="24" placeholder="one word" autocomplete="off" />
      <div class="actions"><button class="btn ${t.myReady ? "vote-yes" : "good"}" id="btn-ready">${t.myReady ? "READY ✓" : "READY"}</button></div>
      <div class="hist-wrap">${hist}</div>
    </div>`;
  }

  function game2Panel(state) {
    const t = state.task;
    if (!t || t.index !== 2) return "";
    if (t.stage === "create" && (t.waitingForPartner || t.created >= 3)) {
      return `<div class="game-panel" id="game-panel" data-game="2">
        <div class="cat">3 / 3 DONE</div>
        <div class="win-banner">PLEASE WAIT FOR YOUR PARTNER TO FINISH</div>
        <p class="qtext">${esc(t.partnerName || "Your partner")} is still writing their questions...</p>
      </div>`;
    }
    if (t.stage === "create") {
      const n = t.questionNumber || Math.min(3, (t.created || 0) + 1);
      if (n > 3) {
        return `<div class="game-panel" id="game-panel" data-game="2">
          <div class="win-banner">PLEASE WAIT FOR YOUR PARTNER TO FINISH</div>
        </div>`;
      }
      const key = `${t.setId || "set"}-${n}`;
      return `<div class="game-panel scroll" id="game-panel" data-game="2">
        <div class="cat">WRITE QUESTION ${n} / 3 ABOUT YOU</div>
        <p class="tiny">Partner has written ${t.partnerCreated} / 3</p>
        <form autocomplete="off" onsubmit="return false">
          <textarea class="pixel-input" id="q-prompt" name="ldr-q-${key}-prompt" rows="2" maxlength="72" placeholder="Question" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" readonly></textarea>
          <label class="labeled-input quiz-choice-row"><span class="lab">A)</span><input class="pixel-input" id="q-a" name="ldr-q-${key}-a" type="text" maxlength="28" placeholder="Answer" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" readonly /><button class="btn quiz-mark" type="button" data-correct="0" title="Mark A as correct">○</button></label>
          <label class="labeled-input quiz-choice-row"><span class="lab">B)</span><input class="pixel-input" id="q-b" name="ldr-q-${key}-b" type="text" maxlength="28" placeholder="Answer" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" readonly /><button class="btn quiz-mark" type="button" data-correct="1" title="Mark B as correct">○</button></label>
          <label class="labeled-input quiz-choice-row"><span class="lab">C)</span><input class="pixel-input" id="q-c" name="ldr-q-${key}-c" type="text" maxlength="28" placeholder="Answer" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" readonly /><button class="btn quiz-mark" type="button" data-correct="2" title="Mark C as correct">○</button></label>
          <label class="labeled-input quiz-choice-row"><span class="lab">D)</span><input class="pixel-input" id="q-d" name="ldr-q-${key}-d" type="text" maxlength="28" placeholder="Answer" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" readonly /><button class="btn quiz-mark" type="button" data-correct="3" title="Mark D as correct">○</button></label>
        </form>
        <p class="tiny">Tap ○ next to the correct answer</p>
        <div class="actions"><button class="btn good" type="button" id="btn-save-q">SAVE QUESTION</button></div>
        ${state.failMessage ? `<div class="fail">${esc(state.failMessage)}</div>` : ""}
      </div>`;
    }
    if (t.stage === "answer" && t.feedback && t.current) {
      const c = t.current.choices || [];
      const fb = t.feedback;
      const n = t.current.number || Math.min(3, (t.answered || 0) + 1);
      const rows = [0, 1, 2, 3]
        .map((i) => {
          const mark = i === fb.choice ? (fb.ok ? " ✓" : " ✗") : "";
          const cls = i === fb.choice ? (fb.ok ? "choice-ok" : "choice-bad") : i === fb.correct && !fb.ok ? "choice-true" : "";
          return `<div class="btn wide static ${cls}">${choiceTag(i)} ${esc(c[i] || "")}${mark}</div>`;
        })
        .join("");
      const reveal = fb.ok
        ? ""
        : `<div class="reveal">Correct answer:<br/><b>${choiceTag(fb.correct)} ${esc(c[fb.correct] || "")}</b></div>`;
      return `<div class="game-panel" id="game-panel" data-game="2">
        <div class="cat">ABOUT YOUR PARTNER  ${n} / 3</div>
        <p class="qtext">${esc(t.current.prompt)}</p>
        <div class="choice-col">${rows}</div>
        <div class="quiz-result ${fb.ok ? "ok" : "bad"}">${fb.ok ? "CORRECT! ✓" : "WRONG! ✗"}</div>
        ${reveal}
        <div class="actions"><button class="btn good" type="button" id="btn-next-q">CONTINUE</button></div>
      </div>`;
    }
    if (t.stage === "answer" && t.answered >= 3) {
      return `<div class="game-panel" id="game-panel" data-game="2">
        <div class="cat">3 / 3 ANSWERED</div>
        <div class="win-banner">PLEASE WAIT FOR YOUR PARTNER TO FINISH</div>
        <p class="qtext">${esc(t.partnerName || "Your partner")} is still answering...</p>
      </div>`;
    }
    if (t.stage === "answer" && t.current) {
      const c = t.current.choices || [];
      const n = t.current.number || Math.min(3, (t.answered || 0) + 1);
      return `<div class="game-panel" id="game-panel" data-game="2">
        <div class="cat">ABOUT YOUR PARTNER  ${n} / 3</div>
        <p class="qtext">${esc(t.current.prompt)}</p>
        <div class="choice-col">
          <button class="btn wide" type="button" data-choice="0">${choiceTag(0)} ${esc(c[0] || "")}</button>
          <button class="btn wide" type="button" data-choice="1">${choiceTag(1)} ${esc(c[1] || "")}</button>
          <button class="btn wide" type="button" data-choice="2">${choiceTag(2)} ${esc(c[2] || "")}</button>
          <button class="btn wide" type="button" data-choice="3">${choiceTag(3)} ${esc(c[3] || "")}</button>
        </div>
      </div>`;
    }
    if (t.stage === "score" && t.scores) {
      const mark = (n) => (n >= 2 ? "✓" : "✗");
      return `<div class="game-panel" id="game-panel" data-game="2">
        <div class="cat">${t.passed ? "GAME COMPLETE!" : "FAILED"}</div>
        <p>MOMO<br/>${t.scores.momo} / 3 ${mark(t.scores.momo)}</p>
        <p>TIAN TIAN<br/>${t.scores.tiantian} / 3 ${mark(t.scores.tiantian)}</p>
        ${t.passed ? "" : `<div class="fail">${esc(state.failMessage || "Both need at least 2 / 3. Write a new set!")}</div>`}
      </div>`;
    }
    return `<div class="game-panel" id="game-panel" data-game="2">
      <div class="win-banner">PLEASE WAIT FOR YOUR PARTNER TO FINISH</div>
    </div>`;
  }

  function game3Panel(state) {
    const t = state.task;
    if (!t || t.index !== 3) return "";
    const current = Math.min(3, (t.wordIndex || 0) + 1);
    const who = t.iDraw ? "YOUR DRAW" : "YOUR GUESS";
    const partner = t.iDraw
      ? (t.guesser === "momo" ? "MOMO" : "TIAN TIAN") + " GUESSES"
      : (t.drawer === "momo" ? "MOMO" : "TIAN TIAN") + " DRAWS";
    const secret = t.iDraw ? t.word || t.drawWord || "" : "";
    const hintLeft = t.hintLeft == null ? 2 : t.hintLeft;
    let tools = "";
    if (t.iDraw && t.stage === "draw") {
      tools = `<div class="draw-tools">
        <button class="btn ${t.tool === "pencil" ? "picked" : ""}" type="button" data-tool="pencil">PENCIL</button>
        <button class="btn ${t.tool === "eraser" ? "picked" : ""}" type="button" data-tool="eraser">ERASER</button>
      </div>`;
    }
    let guess = "";
    if (!t.iDraw && t.stage === "draw") {
      guess = `<div class="guess-row">
        <input class="pixel-input" id="guess-word" maxlength="16" placeholder="guess" autocomplete="off" />
        <button class="btn good" type="button" id="btn-guess">SUBMIT</button>
      </div>`;
    }
    const fb = t.feedback ? (t.feedback.ok ? `<div class="win-banner">CORRECT! ✓</div>` : `<div class="fail">WRONG! ✗</div>`) : "";
    const info = t.iDraw
      ? `<div class="draw-secret" id="draw-secret">DRAW: ${esc(secret || "...")}</div>`
      : `<div class="cat">${esc(partner)}</div>`;
    const blanks = t.iDraw ? "" : `<div class="blanks" id="draw-blanks">${esc(t.blanks || "")}</div>`;
    const hintBtn =
      t.iDraw && t.stage === "draw"
        ? `<button class="btn ${hintLeft ? "good" : ""}" type="button" data-hint="1" ${hintLeft ? "" : "disabled"}>${hintLeft ? "USE HINT" : "USED"}</button>`
        : "";
    return `<div class="draw-hud">
      <div class="cat" id="draw-turn">${who}</div>
      <div class="timer-block"><span id="time-left">90</span></div>
      ${info}
      <p class="draw-progress">WORD: ${current} / 3</p>
      ${blanks}
      <p class="draw-progress">HINTS: ${hintLeft}</p>
      ${hintBtn ? `<div class="draw-hint-btn">${hintBtn}</div>` : ""}
      ${fb}
      ${t.banner ? `<div class="win-banner">${esc(t.banner)}</div>` : ""}
    </div>${tools}${guess}`;
  }

  function game4Panel(state) {
    const t = state.task;
    if (!t || t.index !== 4) return "";
    const h = t.hearts == null ? 3 : t.hearts;
    const hearts = "♥".repeat(h) + "♡".repeat(Math.max(0, 3 - h));
    const msg = t.noteMsg || t.banner || "";
    const intro =
      t.stage === "intro"
        ? `<div class="shop-pop">
        <h3>PIANO</h3>
        <p class="shop-blurb">Hint: notes and keys come in red and blue. You can pick either color and focus on those keys — it makes teamwork a lot easier!</p>
        <button class="btn good" type="button" data-piano-intro="1">TAP TO CONTINUE</button>
      </div>`
        : "";
    return `${intro}<div class="piano-hud">
      <div class="timer-block">TIME<br/><span id="time-left">40</span></div>
      <div class="cat">HIT A S D F G H</div>
      <div class="hearts">LIVES: ${hearts}</div>
      ${msg ? `<div class="${msg === "MISS!" ? "fail" : "win-banner"}">${esc(msg)}</div>` : ""}
    </div>
    <div class="piano-lanes">
      ${["A", "S", "D", "F", "G", "H"].map((k, i) => `<button type="button" data-lane="${i}">${k}</button>`).join("")}
    </div>`;
  }

  const GUN_ICONS = ["gun-default.png", "upgrade1.png", "upgrade2.png", "upgrade3.png"];
  const GUN_NAMES = ["Base Gun", "Rapid Fire", "Shotgun", "Big Gun"];
  const NEXT_GUN_NAMES = ["Rapid Fire", "Shotgun", "Big Gun"];
  const GUN_COSTS = [10, 15, 20];

  const GUN_SHOP_TIPS = [
    "Upgrade to Rapid Fire: the fastest single-birdie fire rate for both players.",
    "Upgrade to Shotgun: both players fire two birdies side-by-side, with a slower cooldown.",
    "Upgrade to Big Gun: two birdies at Rapid Fire speed — the best of both upgrades.",
  ];
  const GUN_OWNED_TIPS = [
    "Rapid Fire equipped — fastest single-birdie fire rate.",
    "Shotgun equipped — two birdies per shot, slower cooldown.",
    "Big Gun equipped — two birdies at the fastest fire rate.",
  ];

  function game5Panel(state) {
    const t = state.task;
    if (!t || t.index !== 5) return "";
    const me = state.myCharacter;
    const gunLevel = typeof t.gunLevel === "number" ? t.gunLevel : t.myGunLevel || 0;
    const coins = t.coins || 0;
    const myShield = t.myShieldHits != null ? t.myShieldHits : (t.shieldHits || {})[me] || 0;
    const myShieldMax =
      t.myShieldMax != null
        ? t.myShieldMax
        : typeof t.shieldMax === "number"
          ? t.shieldMax
          : (t.shieldMax && t.shieldMax[me]) || 4;
    const myRacket = t.myRacket != null ? t.myRacket : (t.racket || {})[me] || 0;
    const myRegen = t.myRacketRegen != null ? t.myRacketRegen : (t.racketRegen || {})[me] || 0;
    const racketCd =
      t.buffs && t.buffs.racket && myRacket < 2 && myRegen > 0
        ? `<span class="attr-count">${Math.ceil(myRegen)}</span>`
        : "";
    const shieldCount =
      t.buffs && t.buffs.shield ? `<span class="attr-count">${myShield}/${myShieldMax}</span>` : "";
    const icon = (name, tip, countHtml) =>
      `<span class="buff-tip-wrap"><span class="hud-ico-slot"><img class="hud-ico" src="/assets/${name}" alt="" />${
        countHtml || ""
      }</span><span class="buff-tip">${esc(tip)}</span></span>`;
    const attrIcons = [
      t.buffs && t.buffs.racket ? icon("shop-racket.png", "Badminton Racket", racketCd) : "",
      t.buffs && t.buffs.shield ? icon("shop-shield.png", "Shield", shieldCount) : "",
      gunLevel > 0 ? icon(GUN_ICONS[gunLevel], GUN_NAMES[gunLevel] || "Gun Upgrade") : "",
    ]
      .filter(Boolean)
      .join("");
    const bottomHud = `<div class="boss-hud-bars">
      <div class="boss-stat-box boss-coin-attr-box">
        <span class="coin-count"><span class="coin-sq"></span> ${coins}</span>
        ${attrIcons ? `<div class="buff-row">${attrIcons}</div>` : ""}
      </div>
    </div>
    ${t.shopToast ? `<div class="shop-toast">${esc(t.shopToast)}</div>` : ""}`;
    let shop = "";
    if (t.stage === "shopAsk") {
      const vote = t.shopVote || {};
      const voteLabel = (ch) => {
        const v = vote[ch];
        if (v === "yes") return "YES";
        if (v === "no") return "NO";
        return "…";
      };
      shop = `<div class="shop-pop">
        <h3>WOULD YOU LIKE TO VISIT THE SHOP?</h3>
        <p class="shop-time">TIME: ${Math.ceil(t.shopTimer || 0)}</p>
        <div class="shop-btns">
          <button class="btn ${vote[me] === "yes" ? "vote-yes" : ""}" type="button" data-shop="yes">YES</button>
          <button class="btn ${vote[me] === "no" ? "vote-no" : ""}" type="button" data-shop="no">NO</button>
        </div>
        <p class="shop-ready">MOMO: ${voteLabel("momo")} · TIAN TIAN: ${voteLabel("tiantian")}</p>
      </div>`;
    }
    if (t.stage === "shop") {
      const ready = t.shopReady || {};
      const pick = t.shopPick || null;
      const buy = t.shopBuyVote || {};
      const bought = t.shopBought || {};
      const readyLabel = (ch) => (ready[ch] ? "READY" : "…");
      const itemRow = (id, label, cost, tip, img, ownedTip) => {
        const picked = pick === id;
        const owned = (id === "racket" && t.buffs && t.buffs.racket) || !!bought[id];
        const imgTag = `<img class="shop-ico" src="/assets/${img}" alt="" />`;
        if (owned) {
          return `<div class="shop-row"><button class="shop-item disabled" type="button" disabled>${imgTag}<span class="shop-label">${label} — ${cost} coins</span></button><span class="shop-tip">${ownedTip || tip}</span></div>`;
        }
        return `<div class="shop-row"><button class="shop-item${picked ? " picked" : ""}" type="button" data-select="${id}">${imgTag}<span class="shop-label">${label} — ${cost} coins</span></button><span class="shop-tip">${tip}</span></div>`;
      };
      const nextGun = gunLevel < 3 ? NEXT_GUN_NAMES[gunLevel] : null;
      const nextGunIcon = gunLevel < 3 ? GUN_ICONS[gunLevel + 1] : null;
      const nextGunCost = gunLevel < 3 ? GUN_COSTS[gunLevel] : 0;
      let gunRow = "";
      if (nextGun) {
        gunRow = itemRow(
          "gun",
          `Upgrade Gun — ${nextGun}`,
          nextGunCost,
          GUN_SHOP_TIPS[gunLevel],
          nextGunIcon,
          GUN_OWNED_TIPS[gunLevel - 1]
        );
      } else {
        gunRow = `<div class="shop-row"><p class="shop-blurb">MAX UPGRADE — ${GUN_OWNED_TIPS[2]}</p></div>`;
      }
      shop = `<div class="shop-pop">
        <h3>SHOP</h3>
        <p class="shop-blurb">BUY YOUR UPGRADES</p>
        <p class="shop-blurb">Both players must be READY to continue.</p>
        <p class="coin-count"><span class="coin-sq"></span> ${coins} SHARED</p>
        ${itemRow(
          "shield",
          "Shield",
          5,
          "Personal shield. Buying again while you still have charges adds +4 (current+4 becomes the new max). Once per shop visit.",
          "shop-shield.png",
          "Shield bought — capacity refreshed for this shop visit."
        )}
        ${itemRow(
          "racket",
          "Badminton Racket",
          10,
          "Gives each player 2 deflect charges. Automatically deflects red birdies from any side. 5-second regeneration per charge.",
          "shop-racket.png",
          "Racket bought — 5-second deflect regeneration."
        )}
        ${gunRow}
        ${t.shopMsg ? `<p class="shop-funds">${esc(t.shopMsg)}</p>` : ""}
        ${
          pick
            ? `<div class="shop-confirm-box">
          <p class="shop-blurb">Are you sure you want to buy it?</p>
          <div class="shop-btns">
            <button class="btn ${buy[me] === "yes" ? "vote-yes" : ""}" type="button" data-shop="buyYes">YES</button>
            <button class="btn ${buy[me] === "no" ? "vote-no" : ""}" type="button" data-shop="buyNo">NO</button>
          </div>
        </div>`
            : ""
        }
        <p class="shop-ready">MOMO: ${readyLabel("momo")} · TIAN TIAN: ${readyLabel("tiantian")}</p>
        <button class="btn ${ready[me] ? "vote-yes" : ""}" type="button" data-shop="ready">${ready[me] ? "READY ✓" : "READY"}</button>
      </div>`;
    }
    let phaseHud = `<div class="timer-block">DODGE — <span id="time-left">35</span></div><div class="phase-hint">DON'T SHOOT · COLLECT COINS</div>`;
    if (t.stage === "phase1" && (t.bonusFlashTimer || 0) > 0) {
      phaseHud = `<div class="timer-block">DODGE — <span id="time-left">35</span><div class="timer-bonus-flash">+8 SECONDS</div></div><div class="phase-hint">DON'T SHOOT · COLLECT COINS</div>`;
    }
    if (t.stage === "phase2") {
      const bonus =
        (t.bonusFlashTimer || 0) > 0 ? `<div class="timer-bonus-flash">+8 SECONDS</div>` : "";
      phaseHud = `<div class="timer-block">ATTACK!<br/><span id="time-left">20</span>${bonus}</div>`;
    } else if (t.stage === "final" || t.stage === "finalTitle") {
      phaseHud = `<div class="timer-block">FINAL PHASE<br/><span class="phase-hint">DEFEAT LDR</span></div>`;
    } else if (t.stage === "attackIntro") phaseHud = `<div class="timer-block">GET READY!</div>`;
    else if (t.stage === "dodgeIntro") phaseHud = `<div class="timer-block">DODGE!</div>`;
    else if (t.stage === "shop" || t.stage === "shopAsk") phaseHud = `<div class="timer-block">SHOP PHASE</div>`;
    const canAttack = t.stage === "phase2" || t.stage === "final";
    let titleHtml = "";
    if (t.brief && t.brief.titleStyle) {
      if (t.brief.kind === "dodgeIntro") {
        titleHtml = `<div class="boss-stage-title" data-tip-ack="1">
        <h2>DODGE</h2>
        <p>DODGE THE BOSS AND COLLECT COINS</p>
      </div>`;
      } else if (t.brief.kind === "attackIntro") {
        titleHtml = `<div class="boss-stage-title" data-tip-ack="1">
        <h2>ATTACKING STAGE</h2>
        <p>PRESS SPACE TO SHOOT AT THE BOSS</p>
      </div>`;
      } else if (t.brief.kind === "finalTitle") {
        titleHtml = `<div class="boss-stage-title" data-tip-ack="1">
        <h2>FINAL PHASE</h2>
      </div>`;
      } else {
        titleHtml = `<div class="boss-stage-title" data-tip-ack="1">
        <h2>${esc(t.brief.text || "")}</h2>
      </div>`;
      }
    }
    const brief = t.brief
      ? t.brief.titleStyle
        ? titleHtml
        : `<div class="boss-tip dialogue place-bottom-left boss-tip-large" data-tip-ack="1">
        <div class="who ldr">LDR</div>
        <div class="text" id="boss-tip-text">${esc(t.brief.text || "")}</div>
      </div>`
      : "";
    const defeat =
      t.stage === "failShow" || t.stage === "failWait" || t.stage === "fail1"
        ? `<div class="boss-defeat">
        <h2>YOU LOST</h2>
        <button class="btn good" type="button" data-retry-boss="1">CLICK HERE TO PLAY AGAIN</button>
        <button class="btn" type="button" data-skip-boss="1">MOVE ON</button>
      </div>`
        : t.stage === "winWait"
          ? `<div class="boss-congrats" data-win-continue="1">
        <h2>CONGRATULATIONS!</h2>
      </div>`
        : "";
    const controls =
      t.stage === "failShow" || t.stage === "failWait" || t.stage === "fail1" || t.stage === "winWait"
        ? ""
        : `<div class="boss-controls boss-controls-touch">
      <button class="btn" type="button" data-move="up">▲</button>
      <div class="boss-move-row">
        <button class="btn" type="button" data-move="left">◀</button>
        ${canAttack ? `<button class="btn good" type="button" data-fire="1">ATTACK</button>` : `<button class="btn disabled" type="button" disabled>—</button>`}
        <button class="btn" type="button" data-move="right">▶</button>
      </div>
      <button class="btn" type="button" data-move="down">▼</button>
    </div>`;
    return `${bottomHud}<div class="boss-hud">
      ${phaseHud}
      ${t.banner && t.stage !== "winWait" ? `<div class="win-banner">${esc(t.banner)}</div>` : ""}
    </div>
    ${shop}
    ${brief}
    ${defeat}
    ${controls}`;
  }

  function bindGames(state) {
    const t = state && state.task;
    if (!t) return;
    if (t.index === 1) {
      const input = document.getElementById("tele-word");
      const ready = document.getElementById("btn-ready");
      if (input) {
        input.value = draftWord || t.myWord || "";
        input.addEventListener("input", () => {
          draftWord = input.value;
          Net.emit("puzzle", { action: "type", word: input.value });
        });
        input.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.code === "Enter") {
            e.preventDefault();
            draftWord = input.value;
            Net.emit("puzzle", { action: "ready", word: input.value });
          }
        });
      }
      if (ready) {
        ready.onclick = () => {
          const word = (document.getElementById("tele-word") || {}).value || draftWord;
          draftWord = word;
          Net.emit("puzzle", { action: "ready", word });
        };
      }
    }
    if (t.index === 2 && t.stage === "create" && t.created < 3 && !t.waitingForPartner) {
      const readDraft = () => {
        draftQuiz.prompt = (document.getElementById("q-prompt") || {}).value || "";
        draftQuiz.a = (document.getElementById("q-a") || {}).value || "";
        draftQuiz.b = (document.getElementById("q-b") || {}).value || "";
        draftQuiz.c = (document.getElementById("q-c") || {}).value || "";
        draftQuiz.d = (document.getElementById("q-d") || {}).value || "";
      };
      const fill = (el, value) => {
        if (!el) return;
        el.value = "";
        el.defaultValue = "";
        el.value = value || "";
      };
      const syncMarks = () => {
        document.querySelectorAll("[data-correct]").forEach((btn) => {
          const selected = draftQuiz.correct != null && Number(btn.getAttribute("data-correct")) === draftQuiz.correct;
          btn.classList.toggle("picked", selected);
          btn.textContent = selected ? "●" : "○";
        });
      };
      fill(document.getElementById("q-prompt"), draftQuiz.prompt);
      fill(document.getElementById("q-a"), draftQuiz.a);
      fill(document.getElementById("q-b"), draftQuiz.b);
      fill(document.getElementById("q-c"), draftQuiz.c);
      fill(document.getElementById("q-d"), draftQuiz.d);
      ["q-prompt", "q-a", "q-b", "q-c", "q-d"].forEach((id) => bindTextField(document.getElementById(id), readDraft));
      document.querySelectorAll("[data-correct]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          draftQuiz.correct = Number(btn.getAttribute("data-correct"));
          syncMarks();
        });
      });
      syncMarks();
      const save = document.getElementById("btn-save-q");
      if (save) {
        save.onclick = () => {
          readDraft();
          const prompt = (draftQuiz.prompt || "").trim();
          const choices = [draftQuiz.a, draftQuiz.b, draftQuiz.c, draftQuiz.d].map((x) => (x || "").trim());
          let fail = null;
          if (!prompt) fail = "Please enter a question.";
          else if (choices.some((c) => !c)) fail = "Please fill in all four answer choices.";
          else if (draftQuiz.correct == null || ![0, 1, 2, 3].includes(Number(draftQuiz.correct))) {
            fail = "Please select the correct answer.";
          }
          if (fail) {
            const box = document.querySelector("#game-panel .fail");
            if (box) box.textContent = fail;
            else {
              const panel = document.getElementById("game-panel");
              if (panel) {
                const div = document.createElement("div");
                div.className = "fail";
                div.textContent = fail;
                panel.appendChild(div);
              }
            }
            return;
          }
          Net.emit("puzzle", {
            action: "addQuestion",
            prompt: draftQuiz.prompt,
            choices: [draftQuiz.a, draftQuiz.b, draftQuiz.c, draftQuiz.d],
            correct: draftQuiz.correct,
          });
        };
      }
    }
    if (t.index === 2 && t.stage === "answer") {
      document.querySelectorAll("[data-choice]").forEach((btn) => {
        btn.addEventListener("click", () => Net.emit("puzzle", { action: "answer", choice: Number(btn.getAttribute("data-choice")) }));
      });
      const next = document.getElementById("btn-next-q");
      if (next) next.onclick = () => Net.emit("puzzle", { action: "nextAnswer" });
    }
    if (t.index === 3) {
      document.querySelectorAll("[data-tool]").forEach((btn) => {
        btn.addEventListener("click", () => Net.emit("puzzle", { action: "tool", tool: btn.getAttribute("data-tool") }));
      });
      document.querySelectorAll("[data-hint]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (btn.disabled) return;
          Net.emit("puzzle", { action: "hint" });
        });
      });
      const guess = document.getElementById("guess-word");
      const submit = document.getElementById("btn-guess");
      const sendGuess = () => {
        const el = document.getElementById("guess-word");
        Net.emit("puzzle", { action: "guess", word: el ? el.value : "" });
        if (el) el.value = "";
      };
      if (guess) {
        guess.addEventListener(
          "keydown",
          (e) => {
            if (e.code === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              sendGuess();
            }
          },
          true
        );
        bindTextField(guess);
      }
      if (submit) submit.onclick = sendGuess;
      bindDrawBoard();
    }
    if (t.index === 4) {
      document.querySelectorAll("[data-piano-intro]").forEach((btn) => {
        btn.onclick = () => Net.emit("puzzle", { action: "introAck" });
      });
      document.querySelectorAll("[data-lane]").forEach((btn) => {
        const lane = Number(btn.getAttribute("data-lane"));
        const down = (e) => {
          e.preventDefault();
          if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
          Input.setPianoLane(lane, true, e.pointerId);
          Net.emit("puzzle", { action: "press", lane });
        };
        const up = (e) => {
          e.preventDefault();
          Input.setPianoLane(lane, false, e.pointerId);
          Net.emit("puzzle", { action: "release", lane });
        };
        btn.addEventListener("pointerdown", down);
        btn.addEventListener("pointerup", up);
        btn.addEventListener("pointercancel", up);
      });
    }
    if (t.index === 5) {
      document.querySelectorAll("[data-move]").forEach((btn) => {
        const dir = btn.getAttribute("data-move");
        const set = (v) => {
          if (dir === "left") Input.tapLeft = v;
          if (dir === "right") Input.tapRight = v;
          if (dir === "up") Input.tapUp = v;
          if (dir === "down") Input.tapDown = v;
        };
        btn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          set(true);
        });
        btn.addEventListener("pointerup", () => set(false));
        btn.addEventListener("pointerleave", () => set(false));
        btn.addEventListener("pointercancel", () => set(false));
      });
      const fire = document.querySelector("[data-fire]");
      if (fire) {
        fire.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          Net.emit("puzzle", { action: "fire" });
        });
      }
      document.querySelectorAll("[data-shop]").forEach((btn) => {
        btn.onclick = () => {
          const v = btn.getAttribute("data-shop");
          if (v === "yes") Net.emit("puzzle", { action: "shopYes" });
          if (v === "no") Net.emit("puzzle", { action: "shopNo" });
          if (v === "ready") Net.emit("puzzle", { action: "ready" });
          if (v === "confirm" || v === "buyYes") Net.emit("puzzle", { action: "buyYes" });
          if (v === "cancel" || v === "buyNo") Net.emit("puzzle", { action: "buyNo" });
        };
      });
      document.querySelectorAll("[data-select]").forEach((btn) => {
        btn.onpointerdown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          Net.emit("puzzle", { action: "select", item: btn.getAttribute("data-select") });
        };
      });
      document.querySelectorAll("[data-tip-ack]").forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          Net.emit("puzzle", { action: "tipAck" });
        };
      });
      document.querySelectorAll("[data-retry-boss]").forEach((btn) => {
        btn.onclick = () => Net.emit("puzzle", { action: "retryBoss" });
      });
      document.querySelectorAll("[data-skip-boss]").forEach((btn) => {
        btn.onclick = () => Net.emit("puzzle", { action: "skipBoss" });
      });
      document.querySelectorAll("[data-win-continue]").forEach((btn) => {
        btn.onclick = () => Net.emit("puzzle", { action: "winContinue" });
      });
    }
  }

  let drawState = null;

  function bindDrawBoard() {
    const canvas = document.getElementById("drawboard");
    if (!canvas || bindDrawBoard.done) return;
    bindDrawBoard.done = true;
    let drawing = false;
    let strokeId = "";
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: clamp01((e.clientX - r.left) / r.width),
        y: clamp01((e.clientY - r.top) / r.height),
      };
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!drawState || !drawState.iDraw || drawState.stage !== "draw") return;
      e.preventDefault();
      drawing = true;
      strokeId = "s" + Date.now().toString(36);
      const p = pos(e);
      Net.emit("puzzle", { action: "drawStart", id: strokeId, x: p.x, y: p.y });
    });
    canvas.addEventListener("pointermove", (e) => {
      const p = pos(e);
      const cur = document.getElementById("eraser-cursor");
      if (cur && drawState && drawState.tool === "eraser" && drawState.iDraw) {
        const r = canvas.getBoundingClientRect();
        cur.style.left = e.clientX - r.left + "px";
        cur.style.top = e.clientY - r.top + "px";
        cur.hidden = false;
      }
      if (!drawing || !drawState || !drawState.iDraw) return;
      Net.emit("puzzle", { action: "drawMove", id: strokeId, x: p.x, y: p.y });
    });
    const end = () => {
      if (!drawing) return;
      drawing = false;
      Net.emit("puzzle", { action: "drawEnd", id: strokeId });
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointerleave", end);
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function paintDraw(state) {
    bindDrawBoard();
    drawState = state && state.task && state.task.index === 3 ? state.task : null;
    const wrap = document.getElementById("draw-wrap");
    const canvas = document.getElementById("drawboard");
    const cursor = document.getElementById("eraser-cursor");
    const t = state && state.task;
    const readyWord = !t || !t.iDraw || !!(t.word || "").trim();
    const show = state && state.phase === "play" && t && t.index === 3 && t.stage === "draw" && readyWord;
    if (wrap) {
      wrap.hidden = !show;
      wrap.style.pointerEvents = show && state.task && state.task.iDraw ? "auto" : "none";
    }
    if (!show || !canvas) {
      if (cursor) cursor.hidden = true;
      return;
    }
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4e4c1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const strokes = state.task.strokes || [];
    for (const s of strokes) {
      const pts = s.pts || [];
      if (!pts.length) continue;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = 28;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#140c12";
        ctx.lineWidth = 4;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * canvas.width, pts[0][1] * canvas.height);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * canvas.width, pts[i][1] * canvas.height);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    if (cursor) cursor.hidden = state.task.tool !== "eraser" || !state.task.iDraw;
  }

  function renderPause(state) {
    const disc = state.pauseReason === "disconnect";
    const name = state.disconnectedName || "Partner";
    if (disc) {
      return `<div class="overlay"><div class="banner">
        <div class="title" style="font-size:16px">${name} has disconnected.</div>
        <p class="subtitle">Waiting for another player to join...</p>
      </div></div>`;
    }
    return `<div class="overlay">
      <div class="title">PAUSED</div>
      <div class="pause-list">
        <label class="vol-row">MUSIC <input type="range" min="0" max="100" value="${Math.round((AudioBus.volumes().music || 0) * 100)}" data-vol="music" /></label>
        <label class="vol-row">SOUNDS <input type="range" min="0" max="100" value="${Math.round((AudioBus.volumes().sfx || 0) * 100)}" data-vol="sfx" /></label>
        <button class="btn" data-act="resume">RESUME</button>
        <button class="btn" data-act="restart-task">RESTART TASK</button>
        <button class="btn" data-act="restart-game">RESTART GAME</button>
      </div>
    </div>`;
  }

  function decisionPanel(state) {
    const d = state.decision;
    if (!d) return "";
    const mine = d.mine;
    const confirm = d.failed && d.stage === "confirm";
    const label = (pick) => {
      if (confirm) {
        if (pick === "yes") return `<div class="picked-label">✓ YES</div>`;
        if (pick === "no") return `<div class="picked-label" style="color:#ff3b4a">✓ NO</div>`;
        return `<div class="waiting-label">WAITING...</div>`;
      }
      if (pick === "again") return `<div class="picked-label">✓ PLAY AGAIN</div>`;
      if (pick === "on") return `<div class="picked-label">✓ ${d.failed ? "SKIP TO NEXT LEVEL" : "MOVE ON"}</div>`;
      return `<div class="waiting-label">WAITING...</div>`;
    };
    const bothAgain = d.picks && d.picks.momo === "again" && d.picks.tiantian === "again";
    const title = confirm
      ? "ARE YOU SURE YOU WANT TO SKIP THIS LEVEL?"
      : d.failed
        ? "STAGE FAILED"
        : `GAME ${d.game} COMPLETE!`;
    const blurb = confirm
      ? ""
      : d.failed
        ? `<p class="tiny">Do you want to play again or skip to the next level?</p>`
        : "";
    const actions = confirm
      ? `<div class="actions">
        <button class="btn ${mine === "yes" ? "vote-yes" : "good"}" type="button" data-path="yes">${mine === "yes" ? "YES ✓" : "YES"}</button>
        <button class="btn ${mine === "no" ? "vote-no" : ""}" type="button" data-path="no">${mine === "no" ? "NO ✓" : "NO"}</button>
      </div>`
      : `<div class="actions">
        <button class="btn ${mine === "again" ? "vote-yes" : "good"}" type="button" data-path="again">${mine === "again" ? "PLAY AGAIN ✓" : "PLAY AGAIN"}</button>
        <button class="btn ${mine === "on" ? "vote-yes" : "good"}" type="button" data-path="on">${
          mine === "on" ? (d.failed ? "SKIP TO NEXT LEVEL ✓" : "MOVE ON ✓") : d.failed ? "SKIP TO NEXT LEVEL" : "MOVE ON"
        }</button>
      </div>`;
    return `<div class="decision-panel" id="decision-panel">
      <div class="win-banner">${title}</div>
      ${blurb}
      <div class="status-row">
        <div><h3>MOMO</h3>${label(d.picks && d.picks.momo)}</div>
        <div><h3>TIAN TIAN</h3>${label(d.picks && d.picks.tiantian)}</div>
      </div>
      ${bothAgain ? `<p class="tiny">RESTARTING...</p>` : ""}
      ${actions}
      ${d.failed ? "" : `<div class="timer-block">TIME LEFT<br/><span id="decide-time">10</span></div>`}
    </div>`;
  }

  function renderComplete(state) {
    if (state && state.completeStage === "credits") {
      return `<div class="overlay solid end-credits" id="end-screen">
        <div class="end-title">LONG DISTANCE DEFEATED</div>
        <p class="subtitle anniversary">Happy 8th Anniversary!</p>
        <img class="end-photo" src="/assets/endcred.png" alt="" />
        <p class="subtitle end-replay">CLICK ANYWHERE TO PLAY AGAIN</p>
      </div>`;
    }
    return `<div class="overlay soft" id="end-screen">
      <div class="end-title">LONG DISTANCE CAN'T KEEP YOU APART.</div>
      <p class="subtitle">♥ MOMO + TIAN TIAN ♥<br/><br/>LONG DISTANCE DEFEATED</p>
      <p class="tiny" style="margin-top:28px">TAP ANYWHERE TO CONTINUE</p>
    </div>`;
  }

  function renderError() {
    setDialogue("");
    root().innerHTML = "";
    root().appendChild(
      el(`<div class="overlay solid">
        <div class="title">Something went wrong.</div>
        <p class="subtitle">Please refresh and try again.</p>
      </div>`)
    );
  }

  function typedCount(state) {
    if (!state.line) return 0;
    const key = `${state.line.startedAt}|${state.line.text}`;
    if (key !== dialogueSkipKey) {
      dialogueSkipKey = key;
      dialogueSkipped = false;
      typeLen = 0;
    }
    if (state.line.revealed || dialogueSkipped) return state.line.text.length;
    const elapsed = Date.now() - state.line.startedAt;
    const n = Math.min(state.line.text.length, Math.floor(elapsed / 28));
    if (n > typeLen) {
      AudioBus.playSfx("type");
    }
    typeLen = n;
    return n;
  }

  function sync(state, flags) {
    if (flags && flags.connecting) {
      if (lastKey !== "connecting") {
        lastKey = "connecting";
        setDialogue("");
        root().innerHTML = "";
        root().appendChild(
          el(`<div class="overlay solid">
            <div class="title">CONNECTING...</div>
            <p class="subtitle">Finding Momo and Tian Tian.</p>
          </div>`)
        );
      }
      return;
    }
    if (flags && flags.full) {
      if (lastKey !== "full") {
        lastKey = "full";
        setDialogue("");
        renderFull();
      }
      return;
    }
    if (flags && flags.lost) {
      if (lastKey !== "lost") {
        lastKey = "lost";
        setDialogue("");
        renderLost();
      }
      return;
    }
    if (!state) return;

    const n = typedCount(state);
    const showSelect = !state.myCharacter && state.phase !== "complete";
    const struct = keyOf(state, showSelect ? "sel" : "x");
    const needRebuild = struct !== lastKey;
    const keptGuess = (document.getElementById("guess-word") || {}).value || "";

    if (needRebuild) {
      lastKey = struct;
      if (state.task && state.task.index === 1 && state.task.round !== bindGames._round) {
        draftWord = "";
        bindGames._round = state.task.round;
      }
      if (!state.task || state.task.index !== 1) {
        draftWord = "";
        bindGames._round = null;
      }
      if (!state.task || state.task.index !== 2) {
        draftQuiz = emptyQuizDraft();
        bindGames._quizSetId = null;
        bindGames._quizCreated = -1;
      } else if (state.task.setId !== bindGames._quizSetId) {
        draftQuiz = emptyQuizDraft();
        bindGames._quizSetId = state.task.setId;
        bindGames._quizCreated = state.task.created;
      } else if (state.task.created !== bindGames._quizCreated) {
        draftQuiz = emptyQuizDraft();
        bindGames._quizCreated = state.task.created;
      }
      const r = root();
      r.innerHTML = "";

      if (showSelect) {
        setDialogue("");
        renderSelect(state);
        paintDraw(state);
        return;
      }
      if (state.phase === "lobby" || (state.phase === "select" && state.myCharacter)) {
        setDialogue("");
        renderLobby(state);
        paintDraw(state);
        return;
      }

      let html = "";
      if (state.phase === "play" || state.phase === "decide" || state.scene === "task" || state.scene === "reunion" || state.scene === "dinner") {
        html += hud(state);
      }
      if (state.phase === "play" && state.task && state.task.index === 1) html += game1Panel(state);
      if (state.phase === "play" && state.task && state.task.index === 2) html += game2Panel(state);
      if (state.phase === "play" && state.task && state.task.index === 3) html += game3Panel(state);
      if (state.phase === "play" && state.task && state.task.index === 4) html += game4Panel(state);
      if (state.phase === "play" && state.task && state.task.index === 5) html += game5Panel(state);
      if (state.phase === "decide") html += decisionPanel(state);
      if (state.phase === "complete") html += renderComplete(state);
      if (state.phase === "paused" || pausedLocal) html += renderPause(state);

      r.innerHTML = html;
      setDialogue(dialogueBox(state, n), state);
      bindGames(state);
      const guessKeep = document.getElementById("guess-word");
      if (guessKeep && keptGuess) guessKeep.value = keptGuess;
      r.querySelectorAll("[data-path]").forEach((btn) => {
        btn.addEventListener("click", () => Net.emit("choosePath", { choice: btn.getAttribute("data-path") }));
      });
      const endScreen = document.getElementById("end-screen");
      if (endScreen) endScreen.onclick = () => Net.emit("playAgain");
      r.querySelectorAll("[data-act]").forEach((b) => {
        b.addEventListener("click", () => {
          const act = b.getAttribute("data-act");
          if (act === "resume") {
            pausedLocal = false;
            Net.emit("resume");
          }
          if (act === "restart-task") Net.emit("restartTask");
          if (act === "restart-game") Net.emit("restartGame");
          lastKey = "";
        });
      });
      r.querySelectorAll("[data-vol]").forEach((el) => {
        el.addEventListener("input", () => {
          const v = Number(el.value) / 100;
          if (el.getAttribute("data-vol") === "music") AudioBus.setMusicVolume(v);
          else AudioBus.setSfxVolume(v);
        });
      });
    }

    const textEl = document.getElementById("dlg-text");
    if (textEl && state.line) {
      textEl.textContent = state.line.text.slice(0, n);
    }
    const tipText = document.getElementById("boss-tip-text");
    if (tipText && state.task && state.task.brief && state.task.brief.text && !state.task.brief.titleStyle) {
      const full = state.task.brief.text;
      if (state.task.brief.revealed) tipText.textContent = full;
      else {
        const started = state.task.brief.startedAt || Date.now();
        const typed = Math.min(full.length, Math.floor((Date.now() - started) / 28));
        tipText.textContent = full.slice(0, typed);
      }
    }
    const timerEl = document.getElementById("time-left");
    if (timerEl && state.task && state.task.index !== 2 && state.task.timeLeft != null) {
      timerEl.textContent = String(Math.max(0, Math.ceil(state.task.timeLeft))).padStart(2, "0");
    }
    const blanksEl = document.getElementById("draw-blanks");
    if (blanksEl && state.task && state.task.index === 3) {
      blanksEl.textContent = state.task.blanks || "";
    }
    const secretEl = document.getElementById("draw-secret");
    if (secretEl && state.task && state.task.index === 3 && state.task.word) {
      secretEl.textContent = "DRAW: " + String(state.task.word).toUpperCase();
    }
    const decideEl = document.getElementById("decide-time");
    if (decideEl && state.decision && state.decision.timeLeft != null) {
      decideEl.textContent = String(Math.max(0, Math.ceil(state.decision.timeLeft)));
    }
    paintDraw(state);
  }

  return { sync, renderFull, renderLost, renderError, setPause, isPaused, set lastKey(v) { lastKey = v; } };
})();
