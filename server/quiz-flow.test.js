const { Room } = require("./room");
const fs = require("fs");
const path = require("path");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeRoom() {
  const room = new Room(() => {});
  if (room.tickTimer) clearInterval(room.tickTimer);
  room.tickTimer = null;
  return room;
}

function skipDodgeIntro(room, a) {
  if (room.task && room.task.stage === "dodgeIntro") {
    room.puzzleInput(a.playerId, { action: "tipAck" });
  }
}

function finishAttackIntro(room, a) {
  if (room.task && room.task.stage === "attackIntro") {
    room.puzzleInput(a.playerId, { action: "tipAck" });
  }
}

function advanceTip(room, playerId) {
  // Click 1 reveals the typing line; click 2 advances (safe if already revealed).
  room.puzzleInput(playerId, { action: "tipAck" });
  room.puzzleInput(playerId, { action: "tipAck" });
}

function enterPhase2(room, a) {
  room.enterPlayerAttack();
  finishAttackIntro(room, a);
}

function startBoss5(room, a) {
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
}

function twoPlayers(room) {
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(2);
  return { a, b };
}

function addQ(room, playerId, prompt, choices, correct) {
  room.puzzleInput(playerId, { action: "addQuestion", prompt, choices, correct });
}

const q = (n) => ({
  prompt: `What is my favorite food ${n}?`,
  choices: ["Sushi roll", "Pizza slice", "Ice cream"],
  correct: 0,
});

const uiSrc = fs.readFileSync(path.join(__dirname, "../public/js/ui.js"), "utf8");
const cssSrc = fs.readFileSync(path.join(__dirname, "../public/css/style.css"), "utf8");
const renderSrc = fs.readFileSync(path.join(__dirname, "../public/js/render.js"), "utf8");
const htmlSrc = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");

// --- Test A: no timer state, nothing auto-advances ---
{
  const room = makeRoom();
  const { a } = twoPlayers(room);
  const v = room.viewFor(a.playerId);
  assert(v.task.index === 2, "A: task is game 2");
  assert(!("timeLeft" in v.task), "A: Game 2 view must not include timeLeft");
  assert(!JSON.stringify(v.task).toLowerCase().includes("second"), "A: no seconds in task view");
  for (let i = 0; i < 1200; i++) room.tick();
  const later = room.viewFor(a.playerId);
  assert(later.task.stage === "create", "A: still create after 60s of ticks");
  assert(later.task.created === 0, "A: no auto-submit");
  assert(room.task.questions.momo.length === 0, "A: no questions stored");
  console.log("PASS A — no timer, no auto-advance");
}

// --- Test B: spaces stored ---
{
  const room = makeRoom();
  const { a } = twoPlayers(room);
  addQ(room, a.playerId, "What is my favorite food?", ["My favorite food is sushi", "Pizza pie", "Hot dog"], 0);
  const stored = room.task.questions.momo[0];
  assert(stored.prompt === "What is my favorite food?", `B: prompt spaces, got ${JSON.stringify(stored.prompt)}`);
  assert(stored.choices[0] === "My favorite food is sushi", `B: choice spaces, got ${JSON.stringify(stored.choices[0])}`);
  assert(stored.prompt.includes(" "), "B: prompt contains space characters");
  assert(stored.choices[0].includes(" "), "B: choice contains space characters");
  console.log("PASS B — spaces stored in question and answers");
}

// --- Test C: next question is a new empty slot ---
{
  const room = makeRoom();
  const { a } = twoPlayers(room);
  addQ(room, a.playerId, "What is my favorite food?", ["Sushi", "Pizza", "Burger"], 0);
  const v = room.viewFor(a.playerId);
  assert(v.task.created === 1, "C: created is 1");
  assert(v.task.questionNumber === 2, "C: now writing question 2");
  assert(room.task.questions.momo.length === 1, "C: only one stored question");
  assert(v.task.questionNumber !== 1, "C: form is not still question 1");
  console.log("PASS C — question 2 is a new empty slot");
}

// --- Test D: exactly 3, never 4 ---
{
  const room = makeRoom();
  const { a, b } = twoPlayers(room);
  addQ(room, a.playerId, q(1).prompt, q(1).choices, 0);
  addQ(room, a.playerId, q(2).prompt, q(2).choices, 0);
  addQ(room, a.playerId, q(3).prompt, q(3).choices, 0);
  addQ(room, a.playerId, "FOURTH?", ["A", "B", "C"], 0);
  const v = room.viewFor(a.playerId);
  assert(room.task.questions.momo.length === 3, "D: cannot store a 4th question");
  assert(v.task.created === 3, "D: created capped at 3");
  assert(v.task.waitingForPartner === true, "D: waiting after 3");
  assert(v.task.questionNumber == null, "D: no question 4 number");
  assert(v.task.stage === "create", "D: still create until partner finishes");
  const tian = room.viewFor(b.playerId);
  assert(tian.task.created === 0, "D: partner still on Q1");
  assert(tian.task.questionNumber === 1, "D: partner question number 1");
  assert(tian.task.waitingForPartner === false, "D: partner is not waiting");
  console.log("PASS D — no question 4, early finisher waits");
}

// --- Test E: answering starts only when both finished ---
{
  const room = makeRoom();
  const { a, b } = twoPlayers(room);
  for (let i = 1; i <= 3; i++) addQ(room, a.playerId, q(i).prompt, q(i).choices, 0);
  assert(room.viewFor(a.playerId).task.stage === "create", "E: momo waits");
  assert(room.viewFor(a.playerId).task.waitingForPartner === true, "E: momo waiting flag");
  assert(room.viewFor(b.playerId).task.stage === "create", "E: tian still creating");
  for (let i = 1; i <= 3; i++) addQ(room, b.playerId, `Tian q ${i} with space`, ["Matcha tea", "Coffee cup", "Coke can"], 1);
  const va = room.viewFor(a.playerId);
  const vb = room.viewFor(b.playerId);
  assert(va.task.stage === "answer", "E: momo moved to answer");
  assert(vb.task.stage === "answer", "E: tian moved to answer");
  assert(va.task.current && va.task.current.prompt.includes("Tian"), "E: momo sees partner questions");
  assert(!va.task.waitingForPartner, "E: not waiting once both done");
  console.log("PASS E — both must finish before answering");
}

// --- Test F: feedback stays until continue ---
{
  const room = makeRoom();
  const { a, b } = twoPlayers(room);
  for (let i = 1; i <= 3; i++) addQ(room, a.playerId, q(i).prompt, q(i).choices, 0);
  for (let i = 1; i <= 3; i++) addQ(room, b.playerId, q(i).prompt, ["Matcha", "Coffee", "Coke"], 0);
  room.puzzleInput(a.playerId, { action: "answer", choice: 0 });
  let va = room.viewFor(a.playerId);
  assert(va.task.feedback && va.task.feedback.ok === true, "F: correct feedback");
  assert(va.task.answered === 0, "F: does not skip to next until continue");
  room.puzzleInput(a.playerId, { action: "nextAnswer" });
  va = room.viewFor(a.playerId);
  assert(va.task.answered === 1, "F: continue advances");
  assert(!va.task.feedback, "F: feedback cleared after continue");
  room.puzzleInput(a.playerId, { action: "answer", choice: 2 });
  va = room.viewFor(a.playerId);
  assert(va.task.feedback && va.task.feedback.ok === false, "F: wrong feedback");
  assert(va.task.feedback.correct === 0, "F: reveals correct index");
  console.log("PASS F — correct/wrong feedback, continue required");
}

// --- Test G: new run clears questions ---
{
  const room = makeRoom();
  const { a, b } = twoPlayers(room);
  addQ(room, a.playerId, "OLD QUESTION", ["Sushi", "Pizza", "Burger"], 0);
  const oldId = room.task.setId;
  room.startTask(2);
  const v = room.viewFor(a.playerId);
  assert(room.task.questions.momo.length === 0, "G: questions cleared");
  assert(room.task.questions.tiantian.length === 0, "G: partner questions cleared");
  assert(v.task.created === 0, "G: created is 0");
  assert(v.task.setId !== oldId, "G: new set id");
  assert(!("timeLeft" in v.task), "G: still no timer");
  void b;
  console.log("PASS G — restarting Game 2 clears all quiz state");
}

// --- Game 1: category is stable, history accumulates ---
function startGame1() {
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(1);
  return { room, a, b };
}

function attempt(room, a, b, wordA, wordB) {
  room.puzzleInput(a.playerId, { action: "ready", word: wordA });
  room.puzzleInput(b.playerId, { action: "ready", word: wordB });
  while (room.task && room.task.index === 1 && room.task.stage === "reveal") room.tick();
}

{
  const { room, a, b } = startGame1();
  const cat = room.viewFor(a.playerId).task.category;
  assert(cat, "G1: category assigned");
  assert(room.viewFor(b.playerId).task.category === cat, "G1: both players see same category");

  attempt(room, a, b, "sushi", "ramen");
  let va = room.viewFor(a.playerId);
  assert(va.task.category === cat, `G1: category unchanged after miss 1 (${va.task.category} vs ${cat})`);
  assert(va.task.history.length === 1, "G1: history has attempt 1");
  assert(va.task.history[0].momo === "sushi" && va.task.history[0].tiantian === "ramen", "G1: attempt 1 words kept");

  attempt(room, a, b, "pizza", "sushi");
  va = room.viewFor(a.playerId);
  const vb = room.viewFor(b.playerId);
  assert(va.task.category === cat, "G1: category unchanged after miss 2");
  assert(va.task.history.length === 2, "G1: history keeps both attempts");
  assert(vb.task.history.length === 2, "G1: partner sees the same history");
  assert(va.task.history[1].attempt === 2, "G1: attempt numbers recorded");
  assert(va.task.round === 3, "G1: now on attempt 3");

  attempt(room, a, b, "ramen", "ramen");
  assert(room.phase === "decide", "G1: match opens Play Again / Move On");
  assert(room.progress[0] === false, "G1: progress waits until Move On");
  assert(room.ldrHearts === 5, "G1: hearts wait until Move On");
  room.choosePath(a.playerId, "on");
  room.choosePath(b.playerId, "on");
  assert(room.progress[0] === true, "G1: both Move On completes game 1");
  assert(room.ldrHearts === 4, "G1: moving on deducts an LDR heart");
  console.log("PASS G1 — category stays fixed, history accumulates, match completes");
}

{
  const { room, a, b } = startGame1();
  attempt(room, a, b, "sushi", "ramen");
  attempt(room, a, b, "pizza", "burger");
  attempt(room, a, b, "taco", "salad");
  assert(room.phase === "decide", "FAIL1: three misses still open Play Again / Move On");
  assert(room.viewFor(a.playerId).decision.failed, "FAIL1: the decision is marked as a failed stage");
  room.choosePath(a.playerId, "on");
  room.choosePath(b.playerId, "on");
  assert(room.decision && room.decision.stage === "confirm", "FAIL1: skipping asks for confirmation");
  room.choosePath(a.playerId, "yes");
  room.choosePath(b.playerId, "yes");
  assert(room.phase === "script", "FAIL1: both YES skips to the next game intro");
  void b;
  console.log("PASS FAIL1 — a lost replay can still Move On");
}

{
  // A completely new game re-randomizes the category.
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const { room, a } = startGame1();
    seen.add(room.viewFor(a.playerId).task.category);
  }
  assert(seen.size > 1, "G1: new games can produce different categories");
  console.log("PASS G1b — new game randomizes a fresh category");
}

function drainDecision(room) {
  let n = 0;
  while (room.phase === "decide" && n < 400) {
    room.tick();
    n += 1;
  }
}

function winQuiz(room, a, b) {
  for (let i = 1; i <= 3; i++) addQ(room, a.playerId, q(i).prompt, q(i).choices, 0);
  for (let i = 1; i <= 3; i++) addQ(room, b.playerId, `Tian q ${i}`, ["Matcha", "Coffee", "Coke"], 0);
  for (let i = 0; i < 3; i++) {
    room.puzzleInput(a.playerId, { action: "answer", choice: 0 });
    room.puzzleInput(a.playerId, { action: "nextAnswer" });
    room.puzzleInput(b.playerId, { action: "answer", choice: 0 });
    room.puzzleInput(b.playerId, { action: "nextAnswer" });
  }
  while (room.task && room.task.index === 2 && room.task.stage === "score") room.tick();
}

function winDraw(room, a, b) {
  const guessAll = (drawer, guesser) => {
    for (let i = 0; i < 3; i++) {
      const word = room.viewFor(drawer.playerId).task.word;
      assert(word, "draw: drawer sees the secret word");
      const blanks = room.viewFor(guesser.playerId).task.blanks;
      assert(blanks, "draw: blanks show letter count");
      assert(blanks.split(" ").length === word.length, "draw: blanks match the word length");
      assert(!room.viewFor(guesser.playerId).task.word, "draw: guesser sees blanks only");
      room.puzzleInput(guesser.playerId, { action: "guess", word });
    }
    while (room.task && room.task.index === 3 && room.task.stage === "hold") room.tick();
  };
  guessAll(a, b);
  if (room.phase === "decide") return;
  guessAll(b, a);
}

{
  const { room, a, b } = startGame1();
  const firstCat = room.viewFor(a.playerId).task.category;
  attempt(room, a, b, "ramen", "ramen");
  assert(room.phase === "decide", "D1: match opens decision");
  const d = room.viewFor(a.playerId).decision;
  assert(d && d.game === 1, "D1: decision is for game 1");
  assert(Math.ceil(d.timeLeft) === 10, "D1: 10 second timer");
  assert(d.picks.momo === null && d.picks.tiantian === null, "D1: no picks yet");

  room.choosePath(a.playerId, "again");
  assert(room.phase === "decide", "D1: one Play Again does not restart");
  assert(room.viewFor(a.playerId).decision.picks.momo === "again", "D1: momo pick stored");
  assert(room.viewFor(b.playerId).decision.picks.tiantian === null, "D1: partner still waiting");
  assert(room.task === null, "D1: current game has not restarted yet");

  room.choosePath(b.playerId, "on");
  assert(room.phase === "decide", "D1: mixed votes stay on the decision screen");
  assert(room.progress[0] === false, "D1: mixed votes do not move on");

  room.choosePath(b.playerId, "again");
  assert(room.phase === "play", "D1: both Play Again restarts game 1");
  assert(room.task && room.task.index === 1, "D1: back on game 1");
  assert(room.task.round === 1, "D1: attempt counter reset");
  assert((room.task.history || []).length === 0, "D1: history cleared");
  assert(room.progress[0] === false, "D1: campaign progress unchanged");
  assert(room.ldrHearts === 5, "D1: hearts unchanged after Play Again");
  const replayCat = room.viewFor(a.playerId).task.category;
  assert(replayCat && replayCat !== firstCat, `D1: new category (${replayCat} vs ${firstCat})`);
  console.log("PASS D1 — both Play Again restarts Game 1 with a fresh category");
}

{
  const { room, a, b } = startGame1();
  attempt(room, a, b, "matcha", "matcha");
  room.choosePath(a.playerId, "again");
  drainDecision(room);
  assert(room.progress[0] === true, "D2: timer expiry moves on");
  assert(room.ldrHearts === 4, "D2: timer expiry deducts an LDR heart");
  assert(room.phase === "script", "D2: moved into the next intro");
  assert(!room.decision, "D2: decision cleared");
  void b;
  console.log("PASS D2 — timeout auto Move On and penalizes LDR");
}

{
  const room = makeRoom();
  const { a, b } = twoPlayers(room);
  winQuiz(room, a, b);
  assert(room.phase === "decide", "D3: Game 2 complete opens decision");
  assert(room.viewFor(a.playerId).decision.game === 2, "D3: decision is for game 2");
  assert(room.viewFor(a.playerId).currentStage === 2, "D3: HUD current stage stays on game 2 until Move On");
  assert(room.progress[1] === false, "D3: Game 2 not marked complete yet");
  room.choosePath(a.playerId, "again");
  room.choosePath(b.playerId, "again");
  assert(room.phase === "play" && room.task.index === 2, "D3: Game 2 restarted");
  assert(room.task.questions.momo.length === 0, "D3: questions cleared");
  assert(room.task.questions.tiantian.length === 0, "D3: partner questions cleared");
  assert(room.task.scores.momo === 0 && room.task.scores.tiantian === 0, "D3: scores cleared");
  assert(room.viewFor(a.playerId).task.questionNumber === 1, "D3: back on question 1");
  assert(room.viewFor(a.playerId).task.created === 0, "D3: created is 0");
  assert(!("timeLeft" in room.viewFor(a.playerId).task), "D3: still no Game 2 timer");
  console.log("PASS D3 — Game 2 Play Again clears questions, answers, scores");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(3);
  assert(room.task.index === 3 && room.task.drawer === "momo", "D4: momo draws first");
  winDraw(room, a, b);
  assert(room.phase === "decide", "D4: Game 3 complete opens decision");
  assert(room.viewFor(a.playerId).decision.game === 3, "D4: decision is for game 3");
  room.choosePath(a.playerId, "again");
  room.choosePath(b.playerId, "again");
  assert(room.phase === "play" && room.task.index === 3, "D4: Game 3 restarted");
  assert(room.task.guessed === 0, "D4: guessed reset");
  assert((room.task.strokes || []).length === 0, "D4: strokes cleared");
  winDraw(room, a, b);
  room.choosePath(a.playerId, "on");
  room.choosePath(b.playerId, "on");
  assert(room.progress[2] === true, "D4: both Move On completes Game 3");
  assert(room.phase === "script", "D4: Game 4 intro starts");
  assert(room.scene !== "reunion", "D4: Game 3 Move On does not skip to the ending");
  console.log("PASS D4 — Draw & Guess play again, then Move On to Game 4");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(4);
  room.puzzleInput(a.playerId, { action: "introAck" });
  room.task.hearts = 99;
  let sawDual = false;
  let sawHold = false;
  for (let i = 0; i < 20; i++) room.tick();
  const pianoView = room.viewFor(a.playerId).task;
  assert(Array.isArray(pianoView.tiles), "D5: piano tiles are included in the client view");
  assert(pianoView.tiles.length > 0, "D5: falling tiles are spawned for clients");
  assert(
    pianoView.tiles.every((tile) => tile.lane >= 0 && tile.lane <= 5),
    "D5: tiles stay in the six A-S-D-F-G-H lanes"
  );
  for (let i = 0; i < 900; i++) {
    if (room.task && room.task.tiles) {
      assert(room.task.tiles.length <= 2, "D5: never more than two simultaneous notes");
      if (room.task.tiles.length === 2) {
        sawDual = true;
        const colors = room.task.tiles.map((tile) => (tile.lane < 3 ? "red" : "blue"));
        assert(colors.includes("red") && colors.includes("blue"), "D5: two notes must be one red and one blue");
      }
      if (room.task.tiles.some((tile) => tile.hold)) sawHold = true;
    }
    room.tick();
    if (room.phase === "decide") break;
  }
  assert(sawDual, "D5: two notes can fall at the same time");
  assert(sawHold, "D5: hold notes appear in the chart");
  assert(room.phase === "decide", "D5: piano duration completes Game 4");
  assert(room.viewFor(a.playerId).decision.game === 4, "D5: decision is for game 4");
  void b;
  console.log("PASS D5 — Game 4 piano completes after ~40 seconds");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(4);
  room.task.chart = [];
  room.task.nextEvent = 99;
  room.task.tiles = [
    { id: "hold1", lane: 0, y: 0.82, hit: false, hold: true, len: 0.32, holding: false, heldFor: 0, holdProg: 0, color: "red" },
  ];
  const hearts = room.task.hearts;
  room.puzzleInput(a.playerId, { action: "press", lane: 0 });
  room.puzzleInput(a.playerId, { action: "release", lane: 0 });
  room.setInput(a.playerId, { piano: [false, false, false, false, false, false] });
  room.setInput(b.playerId, { piano: [false, false, false, false, false, false] });
  room.tick();
  assert(room.task.hearts === hearts - 1, "HOLD: releasing a long note early costs a life");
  assert(!(room.task.tiles || []).some((tile) => tile.id === "hold1" && tile.hit), "HOLD: a tap does not complete a hold note");
  room.startTask(4);
  room.task.chart = [];
  room.task.nextEvent = 99;
  room.task.tiles = [
    { id: "hold2", lane: 0, y: 0.82, hit: false, hold: true, len: 0.32, holding: false, heldFor: 0, holdProg: 0, color: "red" },
  ];
  room.puzzleInput(a.playerId, { action: "press", lane: 0 });
  let completed = false;
  for (let i = 0; i < 40; i++) {
    room.setInput(a.playerId, { piano: [true, false, false, false, false, false] });
    room.tick();
    if (!(room.task.tiles || []).some((tile) => tile.id === "hold2")) {
      completed = room.task.noteMsg === "HOLD COMPLETE";
      break;
    }
  }
  assert(completed, "HOLD: keeping the key down through the tile completes it");
  room.startTask(4);
  room.task.chart = [];
  room.task.nextEvent = 99;
  room.task.tiles = [
    { id: "hold3", lane: 0, y: 0.55, hit: false, hold: true, len: 0.32, holding: false, heldFor: 0, holdProg: 0, color: "red" },
  ];
  const earlyHearts = room.task.hearts;
  room.puzzleInput(a.playerId, { action: "press", lane: 0 });
  room.setInput(a.playerId, { piano: [true, false, false, false, false, false] });
  let earlyOk = false;
  for (let i = 0; i < 50; i++) {
    room.setInput(a.playerId, { piano: [true, false, false, false, false, false] });
    room.tick();
    const tile = (room.task.tiles || []).find((n) => n.id === "hold3");
    if (tile && tile.holding) earlyOk = true;
    if (!(room.task.tiles || []).some((n) => n.id === "hold3")) {
      earlyOk = room.task.noteMsg === "HOLD COMPLETE";
      break;
    }
  }
  assert(room.task.hearts === earlyHearts, "HOLD: holding early does not miss when the note enters the hitbox");
  assert(earlyOk, "HOLD: a key already down registers when the hold note reaches the hitbox");
  room.startTask(4);
  room.task.tiles = [];
  room.task.chart = [];
  room.task.nextEvent = 99;
  const before = room.task.hearts;
  room.puzzleInput(a.playerId, { action: "press", lane: 2 });
  assert(room.task.hearts === before - 1, "MISS: a wrong lane costs a life");
  assert(room.task.noteMsg === "MISS!", "MISS: wrong notes show MISS feedback");
  void b;
  console.log("PASS HOLD — long notes require a real hold; wrong notes cost a life");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.stage = "phase2";
  room.task.brief = null;
  room.task.elapsed = 0;
  room.task.timeLeft = 20;
  room.task.hits = 70;
  room.task.banner = "NOW ATTACK LDR!";
  for (let i = 0; i < 80; i++) room.tick();
  assert(room.task && room.task.stage === "winWait", "D6: 70 HP shows the victory screen");
  room.puzzleInput(a.playerId, { action: "winContinue" });
  assert(room.phase === "decide", "D6: continue from victory opens Play Again");
  room.choosePath(a.playerId, "on");
  room.choosePath(b.playerId, "on");
  assert(room.scene === "reunion", "D6: Game 5 Move On goes to the reunion ending");
  console.log("PASS D6 — Game 5 70 HP then Move On to ending");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(3);
  const word = room.viewFor(a.playerId).task.word;
  assert(word, "HINT: word is ready when the drawing screen starts");
  assert(room.task.hintLeft === 2, "HINT: two hints at the start of a turn");
  const before = room.viewFor(b.playerId).task.blanks;
  assert(before.split(" ").every((ch) => ch === "_"), "HINT: guesser starts with only underscores");
  room.puzzleInput(a.playerId, { action: "hint" });
  assert(room.task.hintLeft === 1, "HINT: using a hint spends one");
  const after = room.viewFor(b.playerId).task.blanks;
  const revealed = after.split(" ").filter((ch) => ch !== "_");
  assert(revealed.length === 1, "HINT: exactly one character position is revealed");
  assert(after.split(" ").length === word.length, "HINT: blanks keep the same length");
  room.puzzleInput(a.playerId, { action: "hint" });
  assert(room.task.hintLeft === 0, "HINT: the second hint spends the last charge");
  const after2 = room.viewFor(b.playerId).task.blanks;
  const revealed2 = after2.split(" ").filter((ch) => ch !== "_");
  assert(revealed2.length === 2, "HINT: two hint uses reveal two character positions");
  room.puzzleInput(a.playerId, { action: "hint" });
  assert(room.task.hintLeft === 0, "HINT: a third click does nothing");
  room.puzzleInput(b.playerId, { action: "guess", word });
  assert(room.task.hintLeft === 0, "HINT: hint does not reset on the next word");
  assert(!(room.task.hintPos && room.task.hintPos.length), "HINT: the revealed letters clear for the next word");
  const nextBlanks = room.viewFor(b.playerId).task.blanks;
  assert(nextBlanks.split(" ").every((ch) => ch === "_"), "HINT: the next word hides all letters again");
  void a;
  void b;
  console.log("PASS HINT — two hints per drawing turn, one letter position each");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(3);
  const first = room.task.words.slice();
  room.beginDrawTurn("tiantian", { momo: true, tiantian: false });
  const second = room.task.words.slice();
  const six = first.concat(second);
  assert(new Set(six).size === 6, "DRAW: Momo and Tian Tian never share a word in one Game 3 session");
  room.startTask(3);
  const retry = room.task.words.slice();
  assert(retry.every((w) => !six.includes(w)), "DRAW: Play Again still excludes words already used this session");
  void a;
  void b;
  console.log("PASS DRAW — unique word pool for the Game 3 session");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  assert(room.task.timeLeft === 35, "G5: dodge phase lasts 35 seconds");
  room.task.hits = 8;
  room.task.hearts = { momo: 0, tiantian: 2 };
  room.task.brief = null;
  room.task.stage = "phase2";
  room.task.elapsed = 19.9;
  for (let i = 0; i < 50; i++) room.tick();
  skipDodgeIntro(room, a);
  assert(room.task.stage === "phase1", "G5: player attack returns to a boss attack");
  assert(room.task.hits === 8, "G5: LDR damage persists between phases");
  assert(room.task.hearts.momo === 2, "G5: a dead player respawns with 2 hearts");
  assert(room.task.hearts.tiantian === 2, "G5: living hearts are not refilled on boss attack");
  assert(room.viewFor(a.playerId).task.hp === 62, "G5: remaining HP is 70 minus damage");
  void b;
  console.log("PASS G5 — damage and hearts persist; dead players respawn");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.hearts = { momo: 99, tiantian: 99 };
  room.task.invuln = { momo: 999, tiantian: 999 };
  assert((room.task.coinsOnCourt || []).length === 0, "COIN: no arena coin at dodge start");
  for (let i = 0; i < 110; i++) room.tick();
  assert((room.task.coinsOnCourt || []).length >= 1, "COIN: an orange coin spawns after 5 seconds of dodge");
  assert(
    (room.task.coinsOnCourt || []).every((pack) => pack.y < 508 || Math.abs(pack.x - 640) > 168),
    "COIN: coins do not spawn under the movement/attack labels"
  );
  const first = room.task.coinsOnCourt.length;
  for (let i = 0; i < 110; i++) room.tick();
  assert((room.task.coinsOnCourt || []).length >= first, "COIN: dodge keeps spawning coins about every 5 seconds");
  for (let i = 0; i < 160; i++) room.tick();
  assert((room.task.hpOnCourt || []).length >= 1, "HP: a green HP pickup spawns about every 13 seconds of dodge");
  room.task.stage = "phase2";
  room.task.elapsed = 0;
  room.task.nextCoin = 0;
  room.task.nextHp = 0;
  const duringAttack = room.task.coinsOnCourt.length;
  const hpAttack = (room.task.hpOnCourt || []).length;
  for (let i = 0; i < 40; i++) room.tick();
  assert((room.task.coinsOnCourt || []).length === duringAttack, "COIN: arena coins do not spawn during the attack phase");
  assert((room.task.hpOnCourt || []).length === hpAttack, "HP: green pickups do not spawn during the attack phase");
  void a;
  void b;
  console.log("PASS COIN — dodge-only coins every 5 seconds");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  assert(!room.task.ldr.angry, "RED: starts in normal mode");
  room.task.hits = 25;
  room.task.seenTips = { rage: true, wall: true, minion: true, yellow: true, special: true };
  room.task.brief = null;
  room.tick();
  assert(room.task.ldr.angry, "RED: 20 HP remaining enters red mode");
  room.task.stage = "to1";
  room.task.hold = 0;
  room.tick();
  skipDodgeIntro(room, a);
  assert(room.task.ldr.angry, "RED: red mode persists into the next boss-attack phase");
  assert((room.task.walls || []).length === 0, "RED: walls are not used during boss-attack");
  room.task.elapsed = 4;
  room.task.nextAoe = 4;
  room.tick();
  assert(room.task.aoe && room.task.aoe.zones.length === 2, "RED: red-mode boss-attack places two AOE warnings");
  assert(room.task.ldr.aoe, "RED: LDR turns red while the AOE warning is active");
  const view = room.viewFor(a.playerId).task;
  assert(view.purple == null, "RED: purple projectiles are removed from the boss fight");
  enterPhase2(room, a);
  assert((room.task.walls || []).length === 1, "RED: player-attack red mode has exactly one wall");
  assert(room.task.walls[0].hp === 6, "RED: the red wall starts at 6 health");
  assert(room.task.walls[0].y > room.task.ldr.y, "RED: wall sits in front of LDR");
  assert(room.task.walls[0].y + room.task.walls[0].h < 360, "RED: wall stays on LDR's side of the court");
  assert(!room.task.aoe, "RED: AOE does not run during the player-attack phase");
  assert(!(room.task.shieldPickups && room.task.shieldPickups.length), "RED: green shields do not spawn in the player-attack phase");
  const beforeX = room.task.ldr.x;
  room.task.ldr.x = beforeX + 80;
  room.task.brief = null;
  room.tick();
  assert((room.task.walls || []).length === 1, "RED: a second wall is not allowed while one exists");
  assert(Math.abs(room.task.walls[0].x + room.task.walls[0].w / 2 - room.task.ldr.x) < 8, "RED: the wall stays in front of LDR as LDR moves");
  void a;
  void b;
  console.log("PASS RED — LDR stays in red mode after 25 damage");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.coins = 20;
  room.beginShopAsk();
  assert(room.task.stage === "shopAsk", "SHOP: dodge-to-attack opens the shop prompt");
  room.puzzleInput(a.playerId, { action: "shopNo" });
  room.puzzleInput(b.playerId, { action: "shopNo" });
  room.tick();
  finishAttackIntro(room, a);
  assert(room.task.stage === "phase2", "SHOP: both NO skips the shop immediately");
  room.task.hits = 25;
  enterPhase2(room, a);
  assert((room.task.minions || []).length === 2, "MINION: two minions spawn at 20 HP during attack");
  const keep = room.task.minions.length;
  room.task.stage = "to1";
  room.task.hold = 0;
  room.tick();
  assert((room.task.minions || []).length === keep, "MINION: minions persist into the next dodge phase");
  room.beginShopAsk();
  room.task.hearts = { momo: 2, tiantian: 1 };
  room.puzzleInput(a.playerId, { action: "shopYes" });
  room.puzzleInput(b.playerId, { action: "shopYes" });
  room.tick();
  assert(room.task.stage === "shop", "SHOP: both YES opens the shop");
  assert(room.task.hearts.momo === 3 && room.task.hearts.tiantian === 2, "SHOP: entering the shop heals each player by 1");
  room.puzzleInput(a.playerId, { action: "select", item: "shield" });
  assert(room.task.shopPick === "shield", "SHOP: clicking an item selects it");
  assert(room.task.coins === 20, "SHOP: selecting does not spend coins yet");
  room.puzzleInput(a.playerId, { action: "confirmBuy" });
  assert(room.task.coins === 15, "SHOP: shield costs 5 shared coins");
  assert(room.task.buffs.shield === true, "SHOP: shield is unlocked for both players");
  assert(room.task.shieldHits.momo === 4 && room.task.shieldHits.tiantian === 4, "SHOP: each player gets 4 personal shield hits");
  assert(room.task.shopToast === "SHIELD BOUGHT", "SHOP: buying shield shows a short purchase toast");
  assert(room.task.shopBought.shield, "SHOP: shield is marked bought for this visit");
  room.puzzleInput(a.playerId, { action: "select", item: "shield" });
  assert(!room.task.shopPick, "SHOP: shield cannot be bought twice in one visit");
  assert(room.viewFor(b.playerId).task.coins === 15, "SHOP: coin total is shared");
  assert(!room.task.shopPick, "SHOP: confirm clears the pending purchase");
  room.puzzleInput(a.playerId, { action: "ready" });
  room.puzzleInput(b.playerId, { action: "ready" });
  room.tick();
  finishAttackIntro(room, a);
  assert(room.task.stage === "phase2", "SHOP: both READY leaves the shop");
  assert((room.task.minions || []).length === 4, "MINION: a later attack phase adds two more minions");
  room.task.brief = null;
  room.task.tipQueue = [];
  room.task.invuln = { momo: 0, tiantian: 0 };
  const momo = room.byCharacter("momo");
  room.task.red = [{ id: "hit-momo", x: momo.x, y: momo.y, vx: 0, vy: 0, bounces: 99 }];
  room.tick();
  assert(room.task.shieldHits.momo === 3, "SHOP: Momo's shield loses one hit");
  assert(room.task.shieldHits.tiantian === 4, "SHOP: Tian Tian's shield is unchanged");
  assert(room.task.hearts.momo === 3, "SHOP: a blocked hit does not cost a heart");
  void a;
  void b;
  console.log("PASS SHOP — shared coins, skip/ready, and persistent minions");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.hits = 25;
  enterPhase2(room, a);
  room.task.brief = null;
  room.task.tipQueue = [];
  room.task.grace = 0;
  room.task.ldr.phaseRest = 2;
  const wall = room.task.walls[0];
  assert(wall, "WALL: enraged attack phase still has a wall");
  const momo = room.byCharacter("momo");
  momo.x = wall.x + wall.w / 2;
  momo.y = wall.y + wall.h + 48;
  room.task.blue = [
    { id: "b1", x: momo.x, y: momo.y - 16, vx: 0, vy: -680 },
    { id: "b2", x: momo.x, y: momo.y - 4, vx: 0, vy: -680 },
  ];
  let sawTwo = false;
  let half = true;
  for (let i = 0; i < 8; i++) {
    room.tick();
    const refl = room.task.reflect || [];
    if (refl.length >= 2) sawTwo = true;
    if (refl.some((shot) => shot.vy <= 0 || Math.abs(shot.vy - 340) >= 8)) half = false;
  }
  assert(sawTwo, "WALL: later bullets still reflect instead of passing through");
  assert(half, "WALL: reflected bullets travel at half speed");
  assert(room.task.walls[0] && room.task.walls[0].hp === 4, "WALL: each colliding bullet is handled");
  const hitsBefore = room.task.hits;
  room.task.ldr.phaseRest = 2;
  room.task.blue = [{ id: "b3", x: room.task.ldr.x, y: room.task.ldr.y + 4, vx: 0, vy: -40 }];
  room.tick();
  assert(room.task.hits === hitsBefore, "WALL: the boss cannot be damaged while the red shield is up");
  const beforeHearts = { ...room.task.hearts };
  room.task.reflect = [];
  room.task.red = [];
  room.task.yellow = [];
  room.task.minionShots = [];
  room.task.invuln = { momo: 0, tiantian: 0 };
  room.task.blue = [{ id: "friendly", x: momo.x, y: momo.y, vx: 0, vy: 0 }];
  room.tick();
  assert(room.task.hearts.momo === beforeHearts.momo, "WALL: birdies never damage players");
  void b;
  console.log("PASS WALL — every hit reflects at half speed; blues are friendly");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.stage = "phase1";
  room.task.brief = null;
  room.task.hearts = { momo: 0, tiantian: 0 };
  room.tick();
  assert(room.phase === "decide", "LOSE: defeat opens the play again / skip screen");
  assert(room.decision && room.decision.failed, "LOSE: the decision is a failed stage");
  room.choosePath(a.playerId, "again");
  room.choosePath(b.playerId, "again");
  assert(room.phase === "play" && room.task, "LOSE: both Play Again restarts the boss fight");
  skipDodgeIntro(room, a);
  assert(room.task.stage === "phase1", "LOSE: dodge title leads into the dodge phase");
  void b;
  console.log("PASS LOSE — click here to play again is available immediately");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.stage = "phase1";
  room.task.brief = null;
  room.task.hearts = { momo: 0, tiantian: 0 };
  room.tick();
  room.choosePath(a.playerId, "on");
  room.choosePath(b.playerId, "on");
  room.choosePath(a.playerId, "yes");
  room.choosePath(b.playerId, "yes");
  assert(room.phase === "script", "LOSE2: Move On leaves the failed boss fight");
  assert(room.scene === "reunion", "LOSE2: skipping the boss continues to the ending");
  void b;
  console.log("PASS LOSE2 — a boss loss can still Move On");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.hearts = { momo: 1, tiantian: 0 };
  enterPhase2(room, a);
  assert(room.task.hearts.momo === 1, "G5s: living hearts are unchanged when skipping the shop");
  assert(room.task.hearts.tiantian === 2, "G5s: defeated players respawn with 2 hearts on attack");
  const momo = room.byCharacter("momo");
  assert(momo.y === 360 + 140, "G5s: attack phase respawns players at the starting line");
  room.task.hearts = { momo: 3, tiantian: 2 };
  enterPhase2(room, a);
  assert(room.task.hearts.momo === 3, "G5s: full health does not go past 3");
  assert(room.task.hearts.tiantian === 2, "G5s: living players are not auto-healed on attack");
  void a;
  void b;
  console.log("PASS G5s — attack respawn restores fallen players");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.beginShopAsk();
  room.task.shopTimer = 0;
  room.tick();
  assert(room.task.stage === "shop", "SHOP: first timer expiry always opens the shop");
  enterPhase2(room, a);
  room.beginShopAsk();
  room.puzzleInput(a.playerId, { action: "shopNo" });
  room.task.shopTimer = 0;
  room.tick();
  assert(room.task.stage === "shop", "SHOP: later timer expiry still opens the shop");
  room.task.coins = 2;
  room.puzzleInput(a.playerId, { action: "select", item: "shield" });
  assert(room.task.shopMsg === "INSUFFICIENT FUNDS", "SHOP: too few coins shows INSUFFICIENT FUNDS");
  assert(!room.task.shopPick, "SHOP: a failed buy does not select the item");
  assert(room.task.coins === 2, "SHOP: a failed buy does not spend coins");
  void b;
  console.log("PASS SHOP2 — every ask timer opens shop; insufficient funds stay in shop");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.brief = null;
  room.task.invuln = { momo: 0, tiantian: 0 };
  room.task.shieldHits = { momo: 0, tiantian: 0 };
  room.task.hearts = { momo: 3, tiantian: 3 };
  const momo = room.byCharacter("momo");
  room.task.yellow = [{ id: "fast", x: momo.x, y: momo.y - 90, vx: 0, vy: 2200 }];
  room.tick();
  assert(room.task.hearts.momo === 2, "YELLOW: a fast yellow bullet that crosses a player still deals damage");
  assert(!(room.task.yellow || []).length, "YELLOW: the bullet is consumed on hit");
  room.task.invuln = { momo: 1.1, tiantian: 0 };
  room.task.yellow = [{ id: "second", x: momo.x, y: momo.y - 90, vx: 0, vy: 2200 }];
  room.tick();
  assert(room.task.hearts.momo === 1, "YELLOW: a later yellow bullet still damages through leftover i-frames");
  room.task.invuln = { momo: 0, tiantian: 0 };
  room.task.shieldHits = { momo: 4, tiantian: 4 };
  room.task.hearts = { momo: 3, tiantian: 3 };
  room.task.yellow = [{ id: "shielded", x: momo.x, y: momo.y - 90, vx: 0, vy: 2200 }];
  room.tick();
  assert(room.task.shieldHits.momo === 3, "YELLOW: a shielded hit consumes one personal shield charge");
  assert(room.task.shieldHits.tiantian === 4, "YELLOW: the partner's shield is unchanged");
  assert(room.task.hearts.momo === 3, "YELLOW: a shielded yellow hit does not cost a heart");
  void a;
  void b;
  console.log("PASS YELLOW — swept hits, i-frames, and personal shields");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.openShop();
  room.puzzleInput(a.playerId, { action: "ready" });
  room.task.shopTimer = 0;
  for (let i = 0; i < 40; i++) room.tick();
  assert(room.task.stage === "shop", "SHOP3: the shop never auto-closes without both Ready");
  room.puzzleInput(b.playerId, { action: "ready" });
  room.tick();
  finishAttackIntro(room, a);
  assert(room.task.stage === "phase2", "SHOP3: both Ready immediately resumes the fight");
  void a;
  void b;
  console.log("PASS SHOP3 — no shop timer; both Ready to leave");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.hits = 25;
  enterPhase2(room, a);
  assert(room.task.brief && room.task.brief.kind === "rage", "TIP: enraged attack starts with NOW I AM FURIOUS");
  assert(Math.abs((room.task.timeLeft || 0) - 28) < 0.2, "TIP: attack timer gains 8 seconds immediately when enraged");
  advanceTip(room, a.playerId);
  assert(room.task.brief && room.task.brief.kind === "wall", "TIP: furious is followed by the wall card");
  advanceTip(room, a.playerId);
  assert(room.task.brief && room.task.brief.kind === "minion", "TIP: one tap from either player advances to minions");
  advanceTip(room, b.playerId);
  assert(room.task.brief && room.task.brief.kind === "minion", "TIP: minion explanation stays for the next line");
  advanceTip(room, b.playerId);
  advanceTip(room, a.playerId);
  assert(room.task.brief && room.task.brief.kind === "yellow", "TIP: yellow two-shot explanation comes after minions");
  advanceTip(room, a.playerId);
  advanceTip(room, a.playerId);
  advanceTip(room, a.playerId);
  advanceTip(room, a.playerId);
  assert(room.task.brief && room.task.brief.kind === "special", "TIP: the other player can advance the shared cards");
  advanceTip(room, a.playerId);
  assert(!room.task.brief, "TIP: the last card resumes the fight");
  assert(Math.abs((room.task.timeLeft || 0) - 28) < 0.2, "TIP: attack timer visibly gains 8 seconds");
  room.task.minions = [];
  enterPhase2(room, a);
  assert((room.task.minions || []).length === 2, "MINION: a later enraged attack respawns two minions");
  room.task.hits = 70;
  room.tick();
  assert(room.task.stage === "winWait", "WIN: defeating LDR shows the victory screen first");
  room.puzzleInput(a.playerId, { action: "winContinue" });
  assert(room.phase === "decide", "WIN: one click continues to Play Again");
  void b;
  console.log("PASS BOSS2 — dialogue, minion respawn, and victory continue");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(5);
  skipDodgeIntro(room, a);
  room.task.seenTips = { rage: true, wall: true, minion: true, yellow: true, special: true };
  room.task.hits = 25;
  enterPhase2(room, a);
  assert(Math.abs((room.task.timeLeft || 0) - 28) < 0.05, "TIMER: enrage adds 8 to a fresh 20s attack timer");
  room.task.elapsed = 22;
  room.task.timeLeft = 6;
  room.task.brief = null;
  room.tick();
  assert(room.task.stage === "phase2", "TIMER: phase does not end while bonus time remains");
  assert(room.task.timeLeft > 5.5, "TIMER: remaining time tracks elapsed against phase+bonus");
  room.task.elapsed = 28;
  room.task.timeLeft = 0.01;
  room.tick();
  assert(room.task.stage === "to1", "TIMER: phase ends only when real remaining time hits zero");
  void a;
  void b;
  console.log("PASS TIMER — +8 extends the real attack phase");
}

{
  const { room, a, b } = startGame1();
  room.skipGame();
  assert(room.phase === "script", "DBG: skip stays in the story");
  assert(room.scene !== "reunion", "DBG: skipping Game 1 does not jump to the ending");
  void a;
  void b;
  console.log("PASS DBG — NEXT GAME skips one game at a time");
}

{
  const { room, a, b } = startGame1();
  const left = room.task.timeLeft;
  room.setPaused(true);
  for (let i = 0; i < 40; i++) room.tick();
  assert(room.paused === true, "PAUSE: server is paused");
  assert(Math.abs(room.task.timeLeft - left) < 0.001, "PAUSE: timer is frozen");
  room.setPaused(false);
  room.tick();
  assert(room.task.timeLeft < left, "PAUSE: timer resumes");
  void a;
  void b;
  console.log("PASS PAUSE — one pause freezes the shared timer");
}

{
  const room = makeRoom();
  const { a, b } = twoPlayers(room);
  winQuiz(room, a, b);
  room.choosePath(a.playerId, "on");
  room.choosePath(b.playerId, "on");
  assert(room.progress[1] === true, "STAGE: skipping Game 2 marks Game 2 cleared");
  assert(room.ldrHearts === 4, "STAGE: skipping Game 2 deducts an LDR heart");
  assert(room.viewFor(a.playerId).currentStage === 3, "STAGE: current stage becomes Game 3 after Game 2 is recorded");
  void b;
  console.log("PASS STAGE — skip records the current game before showing the next");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.phase = "complete";
  room.completeStage = "apart";
  room.playAgain();
  assert(room.completeStage === "credits", "END: first tap opens the anniversary page");
  assert((room.endTimer || 0) === 0, "END: credits have no restart countdown");
  for (let i = 0; i < 240; i++) room.tick();
  assert(room.phase === "complete" && room.completeStage === "credits", "END: credits wait for a click");
  room.playAgain();
  assert(room.phase === "select", "END: a click returns to character select");
  assert(!room.task, "END: game state is cleared");
  assert(room.progress.every((v) => !v), "END: cleared stages reset");
  void a;
  void b;
  console.log("PASS END — tap-anywhere credits then a clean restart");
}

{
  const room = makeRoom();
  const a = room.join("sock-a");
  const b = room.join("sock-b");
  room.selectCharacter(a.playerId, "momo");
  room.selectCharacter(b.playerId, "tiantian");
  room.clearTimer();
  room.countdown = null;
  room.startTask(1);
  room.disconnect("sock-a");
  assert(room.idleResetTimer == null, "IDLE: one disconnected player does not start the 5-minute reset");
  assert(room.phase === "play" || room.paused, "IDLE: the remaining player keeps the session");
  room.disconnect("sock-b");
  assert(!!room.idleResetTimer, "IDLE: both players gone starts the 5-minute reset");
  room.clearIdleReset();
  const again = room.join("sock-a", a.playerId);
  assert(again.reconnected, "IDLE: a player can still reconnect");
  assert(room.idleResetTimer == null, "IDLE: a reconnect cancels the empty-session reset");
  void b;
  console.log("PASS IDLE — reset only after both players are gone");
}

// Opening scene layering: table, drinks and both characters draw on the sprite layer
{
  const dinnerActors = renderSrc.slice(
    renderSrc.indexOf("function drawDinnerActors"),
    renderSrc.indexOf("function drawBlack")
  );
  assert(dinnerActors.includes('drawCharacter("momo"'), "Scene: momo on sprite layer");
  assert(dinnerActors.includes('drawCharacter("tiantian"'), "Scene: tian tian on sprite layer");
  assert(dinnerActors.includes("drawTable("), "Scene: table and drinks on sprite layer");
  assert(dinnerActors.includes("drawLDR("), "Scene: LDR on sprite layer");
  const ldrY = Number((dinnerActors.match(/drawLDR\(640,\s*(\d+)/) || [])[1]);
  assert(ldrY > 0 && ldrY <= 200, `Scene: LDR raised above the couple (y=${ldrY})`);

  const dinnerWorld = renderSrc.slice(renderSrc.indexOf("function drawDinner("), renderSrc.indexOf("function drawDinnerActors"));
  assert(!dinnerWorld.includes("drawCharacter("), "Scene: characters are not drawn on the background canvas");
  assert(!dinnerWorld.includes("drawTable("), "Scene: table is not drawn on the background canvas");

  assert(cssSrc.includes(".dlg-portrait"), "CSS: Momo/Tian Tian dialogue portraits");
  const dialogueZ = Number((htmlSrc, cssSrc.match(/#dialogue\s*\{[^}]*z-index:\s*(\d+)/) || [])[1]);
  const spritesZ = Number((cssSrc.match(/#sprites\s*\{[^}]*z-index:\s*(\d+)/) || [])[1]);
  assert(dialogueZ >= 5 && spritesZ >= 5, `Scene: dialogue and sprites are layered (${dialogueZ}, ${spritesZ})`);
  console.log("PASS Scene — sprites/table/drinks above the textbox, LDR raised");
}

// Client source must not contain Game 2 timer UI
assert(!/WRITE Q \$\{t\.created \+ 1\}/.test(uiSrc), "UI: no unclamped Q4 header");
assert(!/45 SECONDS|45 seconds|QUIZ_CREATE|No timer/i.test(uiSrc), "UI: no Game 2 timer copy");
assert(!/data-game="2"[\s\S]{0,200}timer-block/.test(uiSrc), "UI: game 2 panel has no timer-block nearby");
assert(uiSrc.includes("PLEASE WAIT FOR YOUR PARTNER TO FINISH"), "UI: waiting copy present");
assert(uiSrc.includes("CORRECT! ✓"), "UI: correct copy");
assert(uiSrc.includes("WRONG! ✗"), "UI: wrong copy");
assert(cssSrc.includes("background: var(--panel)"), "CSS: dialogue is opaque");
assert(!/#dialogue\s+\.dialogue[\s\S]{0,400}rgba\(34,\s*20,\s*28/.test(cssSrc), "CSS: dialogue is not the transparent overlay");
assert(/min-height:\s*118px/.test(cssSrc), "CSS: textbox is slightly taller");
assert(htmlSrc.includes("debug-skip") && htmlSrc.includes("NEXT GAME"), "HTML: debug next-game button");
assert(uiSrc.includes("[1, 2, 3, 4, 5]"), "UI: five-game HUD");
assert(uiSrc.includes("A)"), "UI: A) labels");
assert(uiSrc.includes('data-path="again"'), "UI: Play Again button");
assert(uiSrc.includes('data-path="on"'), "UI: Move On button");
assert(uiSrc.includes("choosePath"), "UI: decisions go through the server");
assert(uiSrc.includes("WAITING..."), "UI: waiting copy");
assert(uiSrc.includes("RESTARTING..."), "UI: restarting copy");

assert(uiSrc.includes("Happy 8th Anniversary!"), "UI: anniversary is one line");
assert(uiSrc.includes("TAP ANYWHERE TO CONTINUE"), "UI: pre-end tap anywhere");
assert(uiSrc.includes("CLICK ANYWHERE TO PLAY AGAIN"), "UI: final play-again prompt");
assert(renderSrc.includes('fx.type === "sfx"'), "Render: boss SFX are played");
assert(fs.existsSync(path.join(__dirname, "..", "public/assets/endcred.png")), "Assets: ending portrait");

console.log("\nAll Game 2 flow tests passed.");
