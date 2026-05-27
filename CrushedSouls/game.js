// ============================================================
//  2D PLATFORMER — game.js
//  Replace sprite sheet paths with your own image files.
//  See SPRITE SETUP section below for instructions.
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ── Canvas resolution (internal, CSS scales it) ──
canvas.width  = 900;
canvas.height = 500;

// ============================================================
//  SPRITE SETUP
//  ─────────────────────────────────────────────────────────
//  Place your sprite sheet images in the same folder as
//  index.html, then update the src paths below.
//
//  PLAYER SPRITE SHEET  →  player.png
//    Expected layout (each frame 48×48 px):
//      Row 0 (y=0)   : Run frames  — 6 frames across
//      Row 1 (y=48)  : Jump frame  — 1 frame
//      Row 2 (y=96)  : Duck frame  — 1 frame
//      Row 3 (y=144) : Idle frame  — 1 frame
//
//  ENEMY SPRITE SHEET   →  enemy.png
//    Expected layout (each frame 48×48 px):
//      Row 0 (y=0)   : Walk frames — 4 frames across
//
//  If your frames are a different size, update
//  FRAME_W / FRAME_H constants in the CONSTANTS section.
// ============================================================

// ── Sprite images ──
const playerImg = new Image();
playerImg.src   = 'player.png';   // ← your player sprite sheet

const enemyImg  = new Image();
enemyImg.src    = 'enemy.png';    // ← your enemy sprite sheet

// ── Track load state ──
let assetsLoaded = 0;
const TOTAL_ASSETS = 2;
playerImg.onload = () => { assetsLoaded++; };
enemyImg.onload  = () => { assetsLoaded++; };
// If images fail to load, fallback shapes are drawn automatically.
playerImg.onerror = () => { assetsLoaded++; };
enemyImg.onerror  = () => { assetsLoaded++; };

// ============================================================
//  CONSTANTS
// ============================================================
const GRAVITY      = 0.55;
const JUMP_FORCE   = -13;
const MOVE_SPEED   = 4.5;
const FRAME_W      = 48;   // sprite frame width  (px)
const FRAME_H      = 48;   // sprite frame height (px)
const GROUND_Y     = 430;  // y-position of the main ground surface
const CANVAS_W     = 900;
const CANVAS_H     = 500;

// ============================================================
//  LEVEL DATA
// ============================================================

// Each platform: { x, y, w, h, color }
const platforms = [
  // Ground segments (with a gap at x=520–600 to force a jump)
  { x: 0,    y: GROUND_Y, w: 320,  h: 70,  color: '#3a7d44' },
  { x: 450,  y: GROUND_Y, w: 500,  h: 70,  color: '#3a7d44' },

  // Floating platforms — stepping stones over the gap
  { x: 490,  y: 370,      w: 80,   h: 16,  color: '#6ab04c' },

  // Mid-height platforms for jumping challenges
  { x: 120,  y: 340,      w: 110,  h: 16,  color: '#6ab04c' },
  { x: 280,  y: 280,      w: 100,  h: 16,  color: '#6ab04c' },
  { x: 420,  y: 230,      w: 90,   h: 16,  color: '#6ab04c' },

  // High platform with a coin reward zone
  { x: 650,  y: 290,      w: 120,  h: 16,  color: '#6ab04c' },
  { x: 790,  y: 450,      w: 110,  h: 16,  color: '#6ab04c' },

  // LOW TUNNEL — player must duck to pass (ceiling at y=370, floor at y=430)
  // Ceiling block
  { x: 680,  y: GROUND_Y - 90, w: 160, h: 16, color: '#5c4033' },
  // Left wall pillar
  { x: 680,  y: GROUND_Y - 90, w: 16,  h: 60, color: '#5c4033' },
  // Right wall pillar
  { x: 824,  y: GROUND_Y - 90, w: 16,  h: 60, color: '#5c4033' },
];

// Collectible coins: { x, y, r, collected }
const coins = [
  { x: 175,  y: 310, r: 8, collected: false },
  { x: 330,  y: 250, r: 8, collected: false },
  { x: 465,  y: 200, r: 8, collected: false },
  { x: 530,  y: 340, r: 8, collected: false },
  { x: 710,  y: 260, r: 8, collected: false },
  { x: 840,  y: 320, r: 8, collected: false },
  // Coins inside the tunnel (require ducking)
  { x: 730,  y: 410, r: 8, collected: false },
  { x: 760,  y: 410, r: 8, collected: false },
  { x: 790,  y: 410, r: 8, collected: false },
];

// Goal flag position
const goal = { x: 860, y: GROUND_Y - 60, w: 20, h: 60 };

// ============================================================
//  ENEMY CLASS
// ============================================================
class Enemy {
  constructor(x, y, patrolLeft, patrolRight) {
    this.x           = x;
    this.y           = y;
    this.w           = 40;
    this.h           = 40;
    this.patrolLeft  = patrolLeft;
    this.patrolRight = patrolRight;
    this.speed       = 1.8;
    this.dir         = 1;   // 1 = right, -1 = left
    this.frame       = 0;
    this.frameTimer  = 0;
    this.frameDelay  = 10;
    this.totalFrames = 4;
    this.alive       = true;
  }

  update() {
    if (!this.alive) return;
    this.x += this.speed * this.dir;
    if (this.x > this.patrolRight) { this.x = this.patrolRight; this.dir = -1; }
    if (this.x < this.patrolLeft)  { this.x = this.patrolLeft;  this.dir =  1; }

    this.frameTimer++;
    if (this.frameTimer >= this.frameDelay) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % this.totalFrames;
    }
  }

  draw() {
    if (!this.alive) return;
    ctx.save();
    if (this.dir === -1) {
      ctx.translate(this.x + this.w, this.y);
      ctx.scale(-1, 1);
      drawSprite(enemyImg, this.frame, 0, 0, 0, this.w, this.h);
    } else {
      ctx.translate(this.x, this.y);
      drawSprite(enemyImg, this.frame, 0, 0, 0, this.w, this.h);
    }
    ctx.restore();
  }
}

// ============================================================
//  PLAYER OBJECT
// ============================================================
const player = {
  x: 40, y: GROUND_Y - FRAME_H,
  w: 36, h: 48,
  vx: 0, vy: 0,
  onGround: false,
  ducking: false,
  duckH: 28,       // height when ducking
  standH: 48,      // height when standing
  facing: 1,       // 1=right, -1=left
  frame: 0,
  frameTimer: 0,
  frameDelay: 8,
  runFrames: 6,
  lives: 3,
  score: 0,
  invincible: 0,   // invincibility frames after hit
  dead: false,

  reset(fullReset = false) {
    this.x = 40;
    this.y = GROUND_Y - this.standH;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.ducking = false;
    this.h = this.standH;
    this.invincible = 90;
    if (fullReset) {
      this.lives = 3;
      this.score = 0;
    }
  }
};

// ============================================================
//  ENEMIES
// ============================================================
let enemies = [];

function spawnEnemies() {
  enemies = [
    new Enemy(150, GROUND_Y - 40, 80,  300),
    new Enemy(640, GROUND_Y - 40, 605, 890),
    new Enemy(300, 280 - 40,      280, 380),   // on mid platform
    new Enemy(660, 290 - 40,      650, 770),   // on high platform
  ];
}

// ============================================================
//  INPUT
// ============================================================
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  // Prevent page scroll on arrow keys / space
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
    e.preventDefault();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ============================================================
//  GAME STATE
// ============================================================
let gameState = 'start'; // 'start' | 'playing' | 'dead' | 'win'
let animId;

// UI elements
const startScreen   = document.getElementById('start-screen');
const gameOverScreen= document.getElementById('game-over-screen');
const winScreen     = document.getElementById('win-screen');
const scoreEl       = document.getElementById('score');
const livesEl       = document.getElementById('lives');
const finalScoreEl  = document.getElementById('final-score');
const winScoreEl    = document.getElementById('win-score');

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('win-restart-btn').addEventListener('click', startGame);

function startGame() {
  player.reset(true);
  spawnEnemies();
  resetCoins();
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  winScreen.classList.add('hidden');
  gameState = 'playing';
  updateHUD();
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function resetCoins() {
  coins.forEach(c => c.collected = false);
}

// ============================================================
//  COLLISION HELPERS
// ============================================================
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx &&
         ay < by + bh && ay + ah > by;
}

function resolvePlatformCollision(obj) {
  obj.onGround = false;
  for (const p of platforms) {
    if (!rectOverlap(obj.x, obj.y, obj.w, obj.h, p.x, p.y, p.w, p.h)) continue;

    const overlapLeft  = (obj.x + obj.w) - p.x;
    const overlapRight = (p.x + p.w) - obj.x;
    const overlapTop   = (obj.y + obj.h) - p.y;
    const overlapBot   = (p.y + p.h) - obj.y;

    const minH = Math.min(overlapLeft, overlapRight);
    const minV = Math.min(overlapTop, overlapBot);

    if (minV < minH) {
      if (overlapTop < overlapBot) {
        // Landing on top
        obj.y = p.y - obj.h;
        obj.vy = 0;
        obj.onGround = true;
      } else {
        // Hitting from below
        obj.y = p.y + p.h;
        obj.vy = 0;
      }
    } else {
      if (overlapLeft < overlapRight) {
        obj.x = p.x - obj.w;
        obj.vx = 0;
      } else {
        obj.x = p.x + p.w;
        obj.vx = 0;
      }
    }
  }
}

// ============================================================
//  SPRITE DRAW HELPER
// ============================================================
function drawSprite(img, frameX, frameY, dx, dy, dw, dh) {
  // img        — Image object
  // frameX/Y   — frame index (column/row) in the sprite sheet
  // dx/dy      — destination x/y on canvas (relative to current transform)
  // dw/dh      — destination width/height
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(
      img,
      frameX * FRAME_W, frameY * FRAME_H, FRAME_W, FRAME_H,
      dx, dy, dw, dh
    );
  } else {
    // Fallback coloured rectangle when sprite not loaded
    ctx.fillStyle = (img === playerImg) ? '#4af' : '#f84';
    ctx.fillRect(dx, dy, dw, dh);
  }
}

// ============================================================
//  DRAW BACKGROUND
// ============================================================
function drawBackground() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  sky.addColorStop(0,   '#0d1b4b');
  sky.addColorStop(0.6, '#1a3a6e');
  sky.addColorStop(1,   '#2e6b9e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const starPositions = [
    [60,30],[150,55],[240,20],[380,45],[500,15],[620,50],
    [720,25],[820,40],[870,70],[50,80],[310,90],[460,75],
  ];
  for (const [sx, sy] of starPositions) {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant mountains
  ctx.fillStyle = '#1e3a5f';
  drawMountain(80,  380, 160);
  drawMountain(260, 380, 140);
  drawMountain(500, 380, 180);
  drawMountain(720, 380, 150);

  // Ground fill below platforms
  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(0, GROUND_Y + 70, CANVAS_W, CANVAS_H - GROUND_Y - 70);
}

function drawMountain(cx, base, height) {
  ctx.beginPath();
  ctx.moveTo(cx - height * 0.7, base);
  ctx.lineTo(cx, base - height);
  ctx.lineTo(cx + height * 0.7, base);
  ctx.closePath();
  ctx.fill();
}

// ============================================================
//  DRAW PLATFORMS
// ============================================================
function drawPlatforms() {
  for (const p of platforms) {
    // Main body
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(p.x, p.y, p.w, 4);

    // Bottom shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
  }

  // Draw tunnel label hint
  ctx.save();
  ctx.fillStyle = 'rgba(255,220,80,0.85)';
  ctx.font = 'bold 11px Courier New';
  ctx.fillText('↓ DUCK', 718, GROUND_Y - 100);
  ctx.restore();
}

// ============================================================
//  DRAW COINS
// ============================================================
function drawCoins() {
  for (const c of coins) {
    if (c.collected) continue;
    ctx.save();
    ctx.fillStyle = '#ffe94a';
    ctx.shadowColor = '#ffe94a';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a06000';
    ctx.font = 'bold 9px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', c.x, c.y);
    ctx.restore();
  }
}

// ============================================================
//  DRAW GOAL FLAG
// ============================================================
function drawGoal() {
  // Pole
  ctx.fillStyle = '#aaa';
  ctx.fillRect(goal.x + 8, goal.y, 4, goal.h);
  // Flag
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(goal.x + 12, goal.y);
  ctx.lineTo(goal.x + 30, goal.y + 12);
  ctx.lineTo(goal.x + 12, goal.y + 24);
  ctx.closePath();
  ctx.fill();
}

// ============================================================
//  DRAW PLAYER
// ============================================================
function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible / 6) % 2 === 0) return;

  ctx.save();
  const drawX = player.x;
  const drawY = player.y;

  if (player.facing === -1) {
    ctx.translate(drawX + player.w, drawY);
    ctx.scale(-1, 1);
    drawPlayerSprite(0, 0);
  } else {
    ctx.translate(drawX, drawY);
    drawPlayerSprite(0, 0);
  }
  ctx.restore();
}

function drawPlayerSprite(dx, dy) {
  let frameX = 0;
  let frameY = 3; // idle row

  if (player.ducking) {
    frameX = 0; frameY = 2; // duck row
  } else if (!player.onGround) {
    frameX = 0; frameY = 1; // jump row
  } else if (Math.abs(player.vx) > 0.1) {
    frameX = player.frame; frameY = 0; // run row
  }

  drawSprite(playerImg, frameX, frameY, dx, dy, player.w, player.h);
}

// ============================================================
//  UPDATE PLAYER
// ============================================================
function updatePlayer() {
  if (player.dead) return;

  // ── Horizontal movement ──
  if (keys['ArrowLeft']) {
    player.vx = -MOVE_SPEED;
    player.facing = -1;
  } else if (keys['ArrowRight']) {
    player.vx = MOVE_SPEED;
    player.facing = 1;
  } else {
    player.vx *= 0.75; // friction
  }

  // ── Jump ──
  if ((keys['ArrowUp'] || keys['KeyZ']) && player.onGround && !player.ducking) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }

  // ── Duck ──
  const wasDucking = player.ducking;
  player.ducking = keys['ArrowDown'] && player.onGround;

  if (player.ducking && !wasDucking) {
    // Shrink hitbox — shift y down so feet stay on ground
    player.y += (player.standH - player.duckH);
    player.h = player.duckH;
  } else if (!player.ducking && wasDucking) {
    // Restore hitbox
    player.y -= (player.standH - player.duckH);
    player.h = player.standH;
  }

  // ── Gravity ──
  player.vy += GRAVITY;
  player.x  += player.vx;
  player.y  += player.vy;

  // ── World bounds ──
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > CANVAS_W) player.x = CANVAS_W - player.w;

  // ── Fell off screen ──
  if (player.y > CANVAS_H + 50) {
    loseLife();
    return;
  }

  // ── Platform collision ──
  resolvePlatformCollision(player);

  // ── Animate run frames ──
  if (player.onGround && Math.abs(player.vx) > 0.5) {
    player.frameTimer++;
    if (player.frameTimer >= player.frameDelay) {
      player.frameTimer = 0;
      player.frame = (player.frame + 1) % player.runFrames;
    }
  } else {
    player.frame = 0;
  }

  // ── Invincibility countdown ──
  if (player.invincible > 0) player.invincible--;
}

// ============================================================
//  COIN COLLECTION
// ============================================================
function checkCoins() {
  for (const c of coins) {
    if (c.collected) continue;
    const dx = (player.x + player.w / 2) - c.x;
    const dy = (player.y + player.h / 2) - c.y;
    if (Math.sqrt(dx * dx + dy * dy) < c.r + 14) {
      c.collected = true;
      player.score += 100;
      updateHUD();
    }
  }
}

// ============================================================
//  ENEMY INTERACTION
// ============================================================
function checkEnemies() {
  if (player.invincible > 0) return;

  for (const e of enemies) {
    if (!e.alive) continue;
    if (!rectOverlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) continue;

    // Stomp — player falling onto enemy from above
    const playerBottom = player.y + player.h;
    const enemyTop     = e.y;
    if (player.vy > 0 && playerBottom < e.y + e.h * 0.5) {
      e.alive = false;
      player.vy = JUMP_FORCE * 0.4; // bounce
      player.score += 200;
      updateHUD();
    } else {
      loseLife();
    }
  }
}

// ============================================================
//  GOAL CHECK
// ============================================================
function checkGoal() {
  if (rectOverlap(player.x, player.y, player.w, player.h,
                  goal.x, goal.y, goal.w, goal.h)) {
    // Bonus for remaining coins
    const remaining = coins.filter(c => !c.collected).length;
    player.score += (coins.length - remaining) * 50;
    winScoreEl.textContent = player.score;
    winScreen.classList.remove('hidden');
    gameState = 'win';
  }
}

// ============================================================
//  LIVES / DEATH
// ============================================================
function loseLife() {
  player.lives--;
  updateHUD();
  if (player.lives <= 0) {
    finalScoreEl.textContent = player.score;
    gameOverScreen.classList.remove('hidden');
    gameState = 'dead';
  } else {
    player.reset(false);
  }
}

// ============================================================
//  HUD
// ============================================================
function updateHUD() {
  scoreEl.textContent = player.score;
  livesEl.textContent = player.lives;
}

// ============================================================
//  MAIN LOOP
// ============================================================
function loop() {
  if (gameState !== 'playing') return;

  // Clear
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw world
  drawBackground();
  drawPlatforms();
  drawCoins();
  drawGoal();

  // Update & draw enemies
  enemies.forEach(e => { e.update(); e.draw(); });

  // Update & draw player
  updatePlayer();
  checkCoins();
  checkEnemies();
  checkGoal();
  drawPlayer();

  animId = requestAnimationFrame(loop);
}

// ── Kick off ──
updateHUD();
