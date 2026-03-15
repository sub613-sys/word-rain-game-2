
const socket = io();

let myId = null;
let myName = "";
let gameTick = null;
let wordMap = new Map();
let encourageList = [
  "🌸 너무 잘하고 있어요!",
  "💖 빠르게 입력해 보세요!",
  "🐰 한 문제 더 도전!",
  "✨ 집중하면 잡을 수 있어요!",
  "🍓 좋아요! 계속 가요!"
];

const gameArea = document.getElementById("gameArea");
const overlay = document.getElementById("overlay");
const answerCard = document.getElementById("answerCard");
const joinCard = document.getElementById("joinCard");
const answerInput = document.getElementById("answer");
const myNameBox = document.getElementById("myName");
const encourageBox = document.getElementById("encourage");
const leaderboardList = document.getElementById("leaderboardList");
const timerEl = document.getElementById("timer");
const playerCountEl = document.getElementById("playerCount");
const wordBankCountEl = document.getElementById("wordBankCount");
const canvas = document.getElementById("fireworks");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

document.getElementById("joinBtn").addEventListener("click", () => {
  const name = document.getElementById("name").value.trim();
  socket.emit("join", name);
});

answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    socket.emit("answer", { answer: answerInput.value.trim() });
    answerInput.value = "";
  }
});

socket.on("joined", (data) => {
  myId = data.id;
  myName = data.name;
  joinCard.style.display = "none";
  answerCard.style.display = "block";
  myNameBox.textContent = `👩‍🎓 ${myName} 님, 준비 완료`;
  encourageBox.textContent = "🌸 교사가 시작하면 단어가 떨어져요!";
  answerInput.focus();
});

socket.on("wordBankCount", (count) => {
  wordBankCountEl.textContent = count;
});

socket.on("playerCount", (count) => {
  playerCountEl.textContent = count;
});

socket.on("gameState", (state) => {
  if (gameTick) clearInterval(gameTick);
  let remain = state.remaining || 0;
  timerEl.textContent = remain;
  if (state.running) {
    gameTick = setInterval(() => {
      remain = Math.max(0, remain - 1);
      timerEl.textContent = remain;
      if (remain <= 0) clearInterval(gameTick);
    }, 1000);
  }
});

socket.on("resetBoard", () => {
  clearWords();
  overlay.classList.add("hidden");
  encourageBox.textContent = "💖 새 게임이 시작돼요!";
});

socket.on("clearWords", () => {
  clearWords();
});

socket.on("initialWords", (list) => {
  clearWords();
  list.forEach(spawnWord);
});

socket.on("spawnWord", (word) => {
  spawnWord(word);
});

socket.on("wordSolved", (data) => {
  const entry = wordMap.get(data.id);
  if (entry) {
    showSolveBadge(entry.el, data.player, data.points, data.lane);
    entry.el.remove();
    wordMap.delete(data.id);
  }
  encourageBox.textContent = randomItem(encourageList);
  burstFireworks();
});

socket.on("players", (players) => {
  leaderboardList.innerHTML = players.map((p, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    return `<div class="rank-item">${medal} ${escapeHtml(p.name)} <span style="float:right">${p.score}점</span></div>`;
  }).join("");
});

socket.on("gameEnd", () => {
  showFinalBoard();
  burstFireworks(true);
});

function clearWords() {
  wordMap.forEach(entry => entry.el.remove());
  wordMap.clear();
}

function spawnWord(word) {
  const el = document.createElement("div");
  el.className = `word-chip word-${word.lane}`;
  el.textContent = word.lane === "golden" ? `⭐ ${word.word} +${word.points}` : `${word.word} +${word.points}`;
  el.style.left = `${word.x}%`;
  el.style.top = `0px`;
  gameArea.appendChild(el);

  const state = {
    id: word.id,
    el,
    y: 0,
    speed: word.speed
  };
  wordMap.set(word.id, state);

  const step = () => {
    if (!wordMap.has(word.id)) return;
    state.y += state.speed;
    el.style.transform = `translateY(${state.y}px)`;
    if (state.y > gameArea.clientHeight - 40) {
      el.remove();
      wordMap.delete(word.id);
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function showSolveBadge(targetEl, player, points, lane) {
  const rect = targetEl.getBoundingClientRect();
  const gameRect = gameArea.getBoundingClientRect();
  const badge = document.createElement("div");
  badge.className = "solve-badge";
  badge.textContent = `${randomItem(["🎉", "💖", "🌸", "✨", "🐰"])} ${player} +${points}`;
  badge.style.left = `${rect.left - gameRect.left}px`;
  badge.style.top = `${rect.top - gameRect.top}px`;
  gameArea.appendChild(badge);
  setTimeout(() => badge.remove(), 1600);
}

function showFinalBoard() {
  const items = Array.from(document.querySelectorAll(".rank-item")).map(x => x.textContent);
  overlay.innerHTML = `
    <div class="final-card">
      <h2>💖 FINAL RANK 💖</h2>
      <div class="final-rank">${items.map(t => `<div class="final-item">${t}</div>`).join("")}</div>
      <p class="soft-text" style="margin-top:16px;font-weight:800;">🌸 Great job everyone! 🌸</p>
    </div>
  `;
  overlay.classList.remove("hidden");
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, s => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[s]));
}

// Simple fireworks
let particles = [];
function burstFireworks(big=false) {
  const count = big ? 80 : 28;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.6 + 40,
      vx: (Math.random() - 0.5) * (big ? 8 : 5),
      vy: (Math.random() - 0.5) * (big ? 8 : 5),
      life: big ? 70 : 40,
      size: Math.random() * 3 + 2,
      color: randomItem(["#ff6fa8", "#ffb4d1", "#ffd86b", "#ffffff", "#ffa6c8"])
    });
  }
}

function drawFireworks() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.03;
    p.life -= 1;
    ctx.globalAlpha = Math.max(0, p.life / 70);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(drawFireworks);
}
drawFireworks();
