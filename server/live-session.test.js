/**
 * Fresh two-player session driven over real Socket.IO against the running server.
 * Usage: node server/live-session.test.js [http://localhost:3000]
 */
const { io } = require("socket.io-client");

const URL = process.argv[2] || "http://localhost:3000";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function connect(name) {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { auth: { token: null }, transports: ["websocket"], forceNew: true });
    socket.name = name;
    socket.latest = null;
    socket.on("state", (s) => {
      socket.latest = s;
    });
    socket.on("connect_error", reject);
    socket.on("joined", () => resolve(socket));
    setTimeout(() => reject(new Error(`${name}: join timed out`)), 8000);
  });
}

function waitFor(socket, pred, label, ms = 12000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (socket.latest && pred(socket.latest)) return resolve(socket.latest);
      if (Date.now() - started > ms) return reject(new Error(`${socket.name}: timeout waiting for ${label}`));
      setTimeout(check, 40);
    };
    check();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function skipScript(sockets, ms = 120000) {
  // Dialogue lines have a minimum on-screen time, so keep asking to advance.
  const started = Date.now();
  while (Date.now() - started < ms) {
    const s = sockets[0].latest;
    if (s && s.phase === "play" && s.task) return;
    sockets.forEach((sock) => sock.emit("advance"));
    await sleep(120);
  }
  throw new Error("never reached a task");
}

async function finishGame1(momo, tian) {
  await waitFor(momo, (s) => s.task && s.task.index === 1, "game 1");
  const cat = momo.latest.task.category;
  assert(tian.latest.task.category === cat, "live G1: both see same category");

  // Deliberate miss, then confirm the category survives and history is kept.
  momo.emit("puzzle", { action: "ready", word: "sushi" });
  tian.emit("puzzle", { action: "ready", word: "ramen" });
  await waitFor(momo, (s) => s.task.history && s.task.history.length === 1, "miss recorded");
  await waitFor(momo, (s) => s.task.stage === "input", "next attempt");
  assert(momo.latest.task.category === cat, `live G1: category changed after miss (${momo.latest.task.category})`);
  assert(momo.latest.task.history.length === 1, "live G1: history kept");
  assert(momo.latest.task.history[0].momo === "sushi", "live G1: momo word visible");
  assert(momo.latest.task.history[0].tiantian === "ramen", "live G1: partner word visible");
  console.log(`PASS live G1 — category "${cat}" survived a miss, previous attempt visible to both`);

  momo.emit("puzzle", { action: "ready", word: "matcha" });
  tian.emit("puzzle", { action: "ready", word: "matcha" });
  await waitFor(momo, (s) => s.phase === "decide" && s.decision && s.decision.game === 1, "game 1 decision", 20000);
  assert(momo.latest.progress[0] === false, "live G1: progress waits for Move On");
  assert(momo.latest.ldrHearts === 5, "live G1: hearts wait for Move On");
  momo.emit("choosePath", { choice: "on" });
  await waitFor(momo, (s) => s.decision && s.decision.picks && s.decision.picks.momo === "on", "momo chose move on");
  assert(momo.latest.phase === "decide", "live G1: one Move On does not advance");
  tian.emit("choosePath", { choice: "on" });
  await waitFor(momo, (s) => s.progress && s.progress[0] === true, "moved on from game 1");
  assert(momo.latest.ldrHearts === 4, "live G1: moving on deducts an LDR heart");
  console.log("PASS live G1 — matching word opened Play Again / Move On, both Move On together");
}

async function playGame2(momo, tian) {
  await skipScript([momo, tian]);
  await waitFor(momo, (s) => s.task && s.task.index === 2, "game 2", 20000);

  const t = momo.latest.task;
  assert(t.timeLeft === undefined, "live G2: no timeLeft in state");
  assert(!JSON.stringify(t).toLowerCase().includes("second"), "live G2: no timer text in state");
  assert(t.questionNumber === 1, "live G2: starts at question 1");
  assert(t.created === 0, "live G2: no carried-over questions");
  console.log("PASS live G2 — entered with no timer state and an empty question 1");

  // Idle: nothing may auto-advance.
  const before = JSON.stringify(momo.latest.task);
  await sleep(6000);
  assert(JSON.stringify(momo.latest.task) === before, "live G2: state changed while idle");
  console.log("PASS live G2 — 6s idle changed nothing (no timeout logic)");

  const write = (sock, n, prompt, choices, correct) =>
    sock.emit("puzzle", { action: "addQuestion", prompt, choices, correct });

  write(momo, 1, "What is my favorite food?", ["My favorite food is matcha", "Coffee cup", "Coke can", "Water"], 0);
  await waitFor(momo, (s) => s.task.created === 1, "q1 saved");
  assert(momo.latest.task.questionNumber === 2, "live G2: moved to question 2");

  write(momo, 2, "Where did we first meet?", ["The book store", "A train", "School", "Cafe"], 0);
  await waitFor(momo, (s) => s.task.created === 2, "q2 saved");
  write(momo, 3, "What do I drink daily?", ["Matcha latte", "Black tea", "Water", "Juice"], 0);
  await waitFor(momo, (s) => s.task.created === 3, "q3 saved");

  // Try to sneak in a fourth.
  write(momo, 4, "FOURTH QUESTION", ["A", "B", "C", "D"], 0);
  await sleep(400);
  assert(momo.latest.task.created === 3, "live G2: a 4th question was created");
  assert(momo.latest.task.waitingForPartner === true, "live G2: should be waiting for partner");
  assert(momo.latest.task.stage === "create", "live G2: answering must not start yet");
  assert(tian.latest.task.stage === "create", "live G2: partner still writing");
  console.log("PASS live G2 — exactly 3 questions, early finisher waits for partner");

  write(tian, 1, "What is my favorite drink?", ["Matcha", "Coffee", "Coke", "Juice"], 0);
  await sleep(200);
  assert(momo.latest.task.stage === "create", "live G2: still waiting after partner q1");
  write(tian, 2, "My favorite color?", ["Pink", "Blue", "Green", "Yellow"], 0);
  write(tian, 3, "My favorite season?", ["Winter time", "Summer", "Spring", "Autumn"], 1);

  await waitFor(momo, (s) => s.task.stage === "answer", "answering starts");
  await waitFor(tian, (s) => s.task.stage === "answer", "partner answering starts");
  console.log("PASS live G2 — both transitioned to answering together");

  const q = momo.latest.task.current;
  assert(q && q.prompt === "What is my favorite drink?", "live G2: momo answers tian's questions");
  assert(q.choices[0] === "Matcha", "live G2: choices delivered");
  assert(q.number === 1, "live G2: question 1 of 3");

  // Correct answer.
  momo.emit("puzzle", { action: "answer", choice: 0 });
  await waitFor(momo, (s) => s.task.feedback, "feedback shown");
  assert(momo.latest.task.feedback.ok === true, "live G2: correct feedback");
  await sleep(1200);
  assert(momo.latest.task.feedback, "live G2: feedback must stay until CONTINUE");
  assert(momo.latest.task.answered === 0, "live G2: must not auto-advance past the result");
  momo.emit("puzzle", { action: "nextAnswer" });
  await waitFor(momo, (s) => s.task.answered === 1, "advanced after continue");

  // Wrong answer reveals the correct one.
  momo.emit("puzzle", { action: "answer", choice: 2 });
  await waitFor(momo, (s) => s.task.feedback, "wrong feedback");
  assert(momo.latest.task.feedback.ok === false, "live G2: wrong feedback");
  assert(momo.latest.task.feedback.correct === 0, "live G2: correct answer revealed");
  console.log("PASS live G2 — CORRECT/WRONG feedback persists and reveals the answer");

  // Spaces survived the whole round trip.
  const withSpaces = momo.latest.task;
  void withSpaces;
  tian.emit("puzzle", { action: "answer", choice: 0 });
  await waitFor(tian, (s) => s.task.feedback, "partner feedback");
  const partnerQ = tian.latest.task.current;
  assert(partnerQ.prompt === "What is my favorite food?", `live G2: spaces in prompt -> ${partnerQ.prompt}`);
  assert(partnerQ.choices[0] === "My favorite food is matcha", `live G2: spaces in choice -> ${partnerQ.choices[0]}`);
  console.log("PASS live G2 — spaces preserved end to end through the server");
}

async function main() {
  const momo = await connect("momo");
  const tian = await connect("tiantian");

  momo.emit("selectCharacter", "momo");
  tian.emit("selectCharacter", "tiantian");
  await waitFor(momo, (s) => s.myCharacter === "momo", "momo seated");
  await waitFor(tian, (s) => s.myCharacter === "tiantian", "tian seated");
  console.log("PASS live — fresh two-player session started");

  await skipScript([momo, tian]);
  await finishGame1(momo, tian);
  await playGame2(momo, tian);

  console.log("\nAll live multiplayer checks passed.");
  momo.close();
  tian.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
