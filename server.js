
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let words = [];
let activeWords = [];
let gameRunning = false;
let gameEndsAt = 0;
let spawnTimer = null;
let gameTimer = null;
let roundSeconds = 180;
let nextWordId = 1;
let recentWordIndices = [];

function broadcastPlayers() {
  const arr = Object.entries(players).map(([id, p]) => ({
    id,
    name: p.name,
    score: p.score
  })).sort((a, b) => b.score - a.score);
  io.emit("players", arr);
  io.emit("playerCount", arr.length);
}

function sanitizeWordList(list) {
  if (!Array.isArray(list)) return [];
  const cleaned = list
    .map(item => ({
      word: String(item.word || "").trim(),
      meaning: String(item.meaning || "").trim()
    }))
    .filter(item => item.word && item.meaning);
  return cleaned;
}

function getNextWord() {
  if (words.length === 0) return null;
  if (words.length === 1) return words[0];

  const recentLimit = Math.min(5, Math.max(1, Math.floor(words.length / 3)));
  let tries = 0;
  let idx = Math.floor(Math.random() * words.length);

  while (tries < 20 && recentWordIndices.includes(idx)) {
    idx = Math.floor(Math.random() * words.length);
    tries++;
  }

  recentWordIndices.push(idx);
  if (recentWordIndices.length > recentLimit) recentWordIndices.shift();
  return words[idx];
}

function makeSpawn() {
  const picked = getNextWord();
  if (!picked) return null;

  const fastChance = Math.random();
  let lane = "slow";
  let speed = 0.28 + Math.random() * 0.16; // much slower overall
  let points = 2;

  if (fastChance < 0.18) {
    lane = "fast";
    speed = 0.62 + Math.random() * 0.22;   // only some are faster
    points = 6;
  } else if (fastChance < 0.50) {
    lane = "medium";
    speed = 0.42 + Math.random() * 0.14;
    points = 4;
  }

  const golden = Math.random() < 0.08;
  if (golden) {
    lane = "golden";
    speed = 0.95 + Math.random() * 0.18;
    points = 10;
  }

  return {
    id: nextWordId++,
    word: picked.word,
    meaning: picked.meaning,
    speed,
    points,
    lane,
    x: Math.random() * 78 + 2,
    createdAt: Date.now()
  };
}

function removeActiveWord(id) {
  activeWords = activeWords.filter(w => w.id !== id);
}

function scheduleNextSpawn() {
  if (!gameRunning) return;
  const delay = 1200 + Math.floor(Math.random() * 900); // 1.2 ~ 2.1s
  spawnTimer = setTimeout(() => {
    if (!gameRunning) return;
    const spawn = makeSpawn();
    if (spawn) {
      activeWords.push(spawn);
      io.emit("spawnWord", spawn);
    }
    scheduleNextSpawn();
  }, delay);
}

function startGame(seconds) {
  if (!words.length) return false;

  if (spawnTimer) clearTimeout(spawnTimer);
  if (gameTimer) clearTimeout(gameTimer);

  activeWords = [];
  gameRunning = true;
  roundSeconds = seconds;
  gameEndsAt = Date.now() + seconds * 1000;

  Object.values(players).forEach(p => {
    p.score = 0;
    p.correctStreak = 0;
  });

  io.emit("resetBoard");
  broadcastPlayers();
  io.emit("gameState", { running: true, remaining: roundSeconds });

  for (let i = 0; i < 4; i++) {
    const spawn = makeSpawn();
    if (spawn) activeWords.push(spawn);
  }
  io.emit("initialWords", activeWords);

  scheduleNextSpawn();

  gameTimer = setTimeout(() => {
    gameRunning = false;
    activeWords = [];
    io.emit("clearWords");
    io.emit("gameState", { running: false, remaining: 0 });
    broadcastPlayers();
    io.emit("gameEnd");
  }, seconds * 1000);

  return true;
}

io.on("connection", (socket) => {
  socket.on("join", (name) => {
    const cleanName = String(name || "").trim() || `학생${Math.floor(Math.random() * 900 + 100)}`;
    players[socket.id] = {
      name: cleanName,
      score: 0,
      correctStreak: 0
    };
    socket.emit("joined", { id: socket.id, name: cleanName });
    socket.emit("wordBankCount", words.length);
    if (gameRunning) {
      socket.emit("gameState", {
        running: true,
        remaining: Math.max(0, Math.ceil((gameEndsAt - Date.now()) / 1000))
      });
      socket.emit("initialWords", activeWords);
    }
    broadcastPlayers();
  });

  socket.on("setWords", (list) => {
    const cleaned = sanitizeWordList(list);
    if (cleaned.length > 0) {
      words = cleaned;
      recentWordIndices = [];
      io.emit("wordBankCount", words.length);
      socket.emit("teacherMessage", `단어 ${words.length}개 설정 완료`);
    } else {
      socket.emit("teacherMessage", "유효한 단어가 없습니다.");
    }
  });

  socket.on("startGame", (seconds) => {
    const parsed = Math.max(30, Math.min(900, parseInt(seconds, 10) || 180));
    const ok = startGame(parsed);
    socket.emit("teacherMessage", ok ? `게임 시작! (${parsed}초)` : "단어를 먼저 설정해 주세요.");
  });

  socket.on("answer", (payload) => {
    if (!gameRunning || !players[socket.id]) return;
    const answer = String(payload?.answer || "").trim();
    if (!answer) return;

    const found = activeWords.find(w => w.meaning === answer);
    if (!found) {
      players[socket.id].correctStreak = 0;
      return;
    }

    removeActiveWord(found.id);

    let earned = found.points;
    players[socket.id].correctStreak += 1;
    if (players[socket.id].correctStreak >= 3) earned += 2;

    players[socket.id].score += earned;

    io.emit("wordSolved", {
      id: found.id,
      word: found.word,
      player: players[socket.id].name,
      points: earned,
      lane: found.lane
    });

    broadcastPlayers();
  });

  socket.on("resetGame", () => {
    if (spawnTimer) clearTimeout(spawnTimer);
    if (gameTimer) clearTimeout(gameTimer);
    gameRunning = false;
    activeWords = [];
    Object.values(players).forEach(p => {
      p.score = 0;
      p.correctStreak = 0;
    });
    io.emit("clearWords");
    io.emit("gameState", { running: false, remaining: 0 });
    broadcastPlayers();
    io.emit("teacherMessage", "게임이 초기화되었습니다.");
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    broadcastPlayers();
  });
});

server.listen(3000, () => {
  console.log("Word Rain Ultimate running on 3000");
});
