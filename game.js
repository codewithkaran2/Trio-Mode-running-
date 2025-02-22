// MODE SELECTION BUTTON EVENTS
const duoBtn = document.getElementById("duoButton");
const soloBtn = document.getElementById("soloButton");
const trioBtn = document.getElementById("trioButton");
const p2NameInput = document.getElementById("p2Name");
// Global game mode: "duo", "solo", or "trio" (default is "duo")
let gameMode = "duo";

duoBtn.addEventListener("click", () => {
  gameMode = "duo";
  duoBtn.style.border = "3px solid white";
  soloBtn.style.border = "none";
  trioBtn.style.border = "none";
  p2NameInput.disabled = false;
  p2NameInput.placeholder = "Enter 🟥 Player 2 Name";
  p2NameInput.value = "";
});
soloBtn.addEventListener("click", () => {
  gameMode = "solo";
  soloBtn.style.border = "3px solid white";
  duoBtn.style.border = "none";
  trioBtn.style.border = "none";
  p2NameInput.disabled = true;
  p2NameInput.value = "Computer";
});
trioBtn.addEventListener("click", () => {
  gameMode = "trio";
  trioBtn.style.border = "3px solid white";
  duoBtn.style.border = "none";
  soloBtn.style.border = "none";
  p2NameInput.disabled = false;
  p2NameInput.placeholder = "Enter 🟥 Player 2 Name";
  p2NameInput.value = "";
});

// Helper: draw a rounded rectangle
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Full screen toggle
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Default names and scores
const defaultP1Name = "Player 1";
const defaultP2Name = "Player 2";
let p1Name = defaultP1Name;
let p2Name = defaultP2Name;
let p1Score = 0, p2Score = 0;

const speed = 5;
let gameRunning = false;
let gamePaused = false;

// Audio elements
const bgMusic = document.getElementById("bgMusic");
const shootSound = document.getElementById("shootSound");
const hitSound = document.getElementById("hitSound");
const shieldBreakSound = document.getElementById("shieldBreakSound");

// Volume slider control
const volumeSlider = document.getElementById("volumeSlider");
volumeSlider.addEventListener("input", function() {
  const vol = parseFloat(this.value);
  bgMusic.volume = vol;
  shootSound.volume = vol;
  hitSound.volume = vol;
  shieldBreakSound.volume = vol;
});

// Start background music (triggered on game start)
function startBackgroundMusic() {
  bgMusic.play();
}

// PLAYERS
const player1 = {
  x: 100,
  y: 0,
  width: 40,
  height: 40,
  color: "blue",
  health: 100,
  shield: 100,
  shieldActive: false,
  shieldBroken: false,
  canShoot: true,
  lastDir: "right"
};
const player2 = {
  x: 600,
  y: 0,
  width: 40,
  height: 40,
  color: "red",
  health: 100,
  shield: 100,
  shieldActive: false,
  shieldBroken: false,
  canShoot: true,
  lastDir: "left"
};
// In Trio mode, add a third (computer-controlled) player:
const player3 = {
  x: 1100,
  y: 0,
  width: 40,
  height: 40,
  color: "green",
  health: 100,
  shield: 100,
  shieldActive: false,
  shieldBroken: false,
  canShoot: true,
  lastDir: "left"
};

let bullets = [];

// Controls mapping
const keys = {
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
  " ": false, q: false, Enter: false, m: false, p: false
};

// Update last direction based on key input
function updateDirection() {
  if (keys.w) { player1.lastDir = "up"; }
  else if (keys.s) { player1.lastDir = "down"; }
  else if (keys.a) { player1.lastDir = "left"; }
  else if (keys.d) { player1.lastDir = "right"; }
  
  // For duo or trio modes, update player2 direction from arrow keys
  if (gameMode === "duo" || gameMode === "trio") {
    if (keys.ArrowUp) { player2.lastDir = "up"; }
    else if (keys.ArrowDown) { player2.lastDir = "down"; }
    else if (keys.ArrowLeft) { player2.lastDir = "left"; }
    else if (keys.ArrowRight) { player2.lastDir = "right"; }
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "CapsLock") { e.preventDefault(); return; }
  if (keys.hasOwnProperty(e.key)) {
    if (e.key === "p") { togglePause(); return; }
    // Shooting events: SPACE for player1, ENTER for player2 (if not solo)
    if (e.key === " " && player1.canShoot && gameRunning && !gamePaused) {
      shootBullet(player1, 1);
      player1.canShoot = false;
    } else if (e.key === "Enter" && gameMode !== "solo" && player2.canShoot && gameRunning && !gamePaused) {
      shootBullet(player2, 2);
      player2.canShoot = false;
    }
    keys[e.key] = true;
    updateDirection();
  }
});
document.addEventListener("keyup", (e) => {
  if (e.key === "CapsLock") { e.preventDefault(); return; }
  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = false;
    if (e.key === " ") player1.canShoot = true;
    if (e.key === "Enter" && gameMode !== "solo") player2.canShoot = true;
    updateDirection();
  }
});

// MOVE PLAYERS
function movePlayers() {
  let oldP1 = { x: player1.x, y: player1.y };
  let oldP2 = { x: player2.x, y: player2.y };
  let oldP3 = gameMode === "trio" ? { x: player3.x, y: player3.y } : null;
  
  // Player1 movement
  let dx1 = 0, dy1 = 0;
  if (keys.a && player1.x > 0) dx1 = -speed;
  if (keys.d && player1.x + player1.width < canvas.width) dx1 = speed;
  if (keys.w && player1.y > 0) dy1 = -speed;
  if (keys.s && player1.y + player1.height < canvas.height) dy1 = speed;
  
  // Player2 movement (human in duo/trio)
  let dx2 = 0, dy2 = 0;
  if (gameMode === "duo" || gameMode === "trio") {
    if (keys.ArrowLeft && player2.x > 0) dx2 = -speed;
    if (keys.ArrowRight && player2.x + player2.width < canvas.width) dx2 = speed;
    if (keys.ArrowUp && player2.y > 0) dy2 = -speed;
    if (keys.ArrowDown && player2.y + player2.height < canvas.height) dy2 = speed;
  }
  
  // Horizontal move for player1 and player2
  player1.x += dx1;
  player2.x += dx2;
  if (rectCollision(player1, player2)) {
    player1.x = oldP1.x;
    player2.x = oldP2.x;
  }
  
  // Vertical move for player1 and player2
  player1.y += dy1;
  player2.y += dy2;
  if (rectCollision(player1, player2)) {
    player1.y = oldP1.y;
    player2.y = oldP2.y;
  }
  
  // In Solo mode, update AI for player2
  if (gameMode === "solo") {
    updateAI();
  }
  
  // In Trio mode, update AI for player3 and check collisions with it
  if (gameMode === "trio") {
    updateAIForPlayer3();
    if (rectCollision(player1, player3)) {
      player1.x = oldP1.x;
      player3.x = oldP3.x;
      player1.y = oldP1.y;
      player3.y = oldP3.y;
    }
    if (rectCollision(player2, player3)) {
      player2.x = oldP2.x;
      player3.x = oldP3.x;
      player2.y = oldP2.y;
      player3.y = oldP3.y;
    }
  }
  
  // Shield toggles
  player1.shieldActive = keys.q;
  player2.shieldActive = keys.m;
  updateDirection();
}

/* 
  rectCollision with margin
*/
function rectCollision(rect1, rect2) {
  const margin = 5;
  return rect1.x < rect2.x + rect2.width + margin &&
         rect1.x + rect1.width > rect2.x - margin &&
         rect1.y < rect2.y + rect2.height + margin &&
         rect1.y + rect1.height > rect2.y - margin;
}

/* 
  AI for Solo mode (for player2 in solo mode)
*/
function updateAI() {
  if (gameMode === "solo") {
    let oldP2x = player2.x;
    let oldP2y = player2.y;
    
    let centerX1 = player1.x + player1.width / 2;
    let centerY1 = player1.y + player1.height / 2;
    let centerX2 = player2.x + player2.width / 2;
    let centerY2 = player2.y + player2.height / 2;
    
    let diffX = centerX1 - centerX2;
    let diffY = centerY1 - centerY2;
    
    let factor = 0.3;
    let moveX = Math.max(-speed, Math.min(speed, diffX * factor));
    let moveY = Math.max(-speed, Math.min(speed, diffY * factor));
    
    player2.x += moveX;
    player2.y += moveY;
    
    if (rectCollision(player1, player2)) {
      player2.x = oldP2x;
      player2.y = oldP2y;
    }
    
    let distance = Math.sqrt(diffX * diffX + diffY * diffY);
    if (distance < 300 && player2.canShoot && gameRunning && !gamePaused) {
      shootBullet(player2, 2);
      player2.canShoot = false;
      setTimeout(() => { player2.canShoot = true; }, 50);
    }
  }
}

/* 
  AI for Trio mode (for player3)
*/
function updateAIForPlayer3() {
  if (gameMode === "trio") {
    let centerX1 = player1.x + player1.width/2;
    let centerY1 = player1.y + player1.height/2;
    let centerX2 = player2.x + player2.width/2;
    let centerY2 = player2.y + player2.height/2;
    let centerX3 = player3.x + player3.width/2;
    let centerY3 = player3.y + player3.height/2;
    
    // Choose the closer human target  
    let dx1 = centerX1 - centerX3;
    let dy1 = centerY1 - centerY3;
    let dx2 = centerX2 - centerX3;
    let dy2 = centerY2 - centerY3;
    let dist1 = Math.sqrt(dx1*dx1 + dy1*dy1);
    let dist2 = Math.sqrt(dx2*dx2 + dy2*dy2);
    let target = dist1 < dist2 ? player1 : player2;
    
    let oldP3x = player3.x;
    let oldP3y = player3.y;
    let centerX_target = target.x + target.width/2;
    let centerY_target = target.y + target.height/2;
    let diffX = centerX_target - centerX3;
    let diffY = centerY_target - centerY3;
    let factor = 0.3;
    let moveX = Math.max(-speed, Math.min(speed, diffX * factor));
    let moveY = Math.max(-speed, Math.min(speed, diffY * factor));
    player3.x += moveX;
    player3.y += moveY;
    if (rectCollision(player3, target)) {
      player3.x = oldP3x;
      player3.y = oldP3y;
    }
    let distance = Math.sqrt(diffX*diffX + diffY*diffY);
    if (distance < 300 && player3.canShoot && gameRunning && !gamePaused) {
      shootBullet(player3, 3);
      player3.canShoot = false;
      setTimeout(() => { player3.canShoot = true; }, 50);
    }
  }
}

// New: Draw players on canvas
function drawPlayers() {
  // Draw Player 1
  ctx.fillStyle = player1.color;
  ctx.fillRect(player1.x, player1.y, player1.width, player1.height);
  
  // Draw Player 2
  ctx.fillStyle = player2.color;
  ctx.fillRect(player2.x, player2.y, player2.width, player2.height);
  
  // Draw Player 3 if in Trio mode
  if (gameMode === "trio") {
    ctx.fillStyle = player3.color;
    ctx.fillRect(player3.x, player3.y, player3.width, player3.height);
  }
}

function drawTopStatus() {
  const barWidth = 200, barHeight = 15;
  if (gameMode === "trio") {
    // --- Player1 (left)
    const leftX = 20, topY = 20;
    ctx.fillStyle = "red";
    ctx.fillRect(leftX, topY, (player1.health / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(leftX, topY, barWidth, barHeight);
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.fillText("Health: " + player1.health + "%", leftX + 5, topY + 13);
    let shieldColor1 = player1.shield > 0
      ? ctx.createLinearGradient(leftX, topY + barHeight + 5, leftX + barWidth, topY + barHeight + 5)
      : "#777";
    if (player1.shield > 0) {
      shieldColor1.addColorStop(0, "#4A90E2");
      shieldColor1.addColorStop(1, "#003366");
    }
    ctx.fillStyle = shieldColor1;
    ctx.fillRect(leftX, topY + barHeight + 5, (player1.shield / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(leftX, topY + barHeight + 5, barWidth, barHeight);
    ctx.fillStyle = "white";
    ctx.fillText("Shield: " + player1.shield + "% 🛡️", leftX + 5, topY + barHeight * 2 + 3);
    if (player1.shieldActive) {
      ctx.strokeStyle = "cyan";
      ctx.lineWidth = 3;
      ctx.strokeRect(leftX - 2, topY - 2, barWidth + 4, barHeight * 2 + 9);
    }
    
    // --- Player2 (center)
    const centerX = (canvas.width - barWidth) / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = "red";
    ctx.fillRect(centerX, topY, (player2.health / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(centerX, topY, barWidth, barHeight);
    ctx.fillStyle = "white";
    ctx.fillText("Health: " + player2.health + "%", centerX + barWidth/2, topY + 13);
    let shieldColor2 = player2.shield > 0
      ? ctx.createLinearGradient(centerX, topY + barHeight + 5, centerX + barWidth, topY + barHeight + 5)
      : "#777";
    if (player2.shield > 0) {
      shieldColor2.addColorStop(0, "#4A90E2");
      shieldColor2.addColorStop(1, "#003366");
    }
    ctx.fillStyle = shieldColor2;
    ctx.fillRect(centerX, topY + barHeight + 5, (player2.shield / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(centerX, topY + barHeight + 5, barWidth, barHeight);
    ctx.fillStyle = "white";
    ctx.fillText("Shield: " + player2.shield + "% 🛡️", centerX + barWidth/2, topY + barHeight * 2 + 3);
    if (player2.shieldActive) {
      ctx.strokeStyle = "orange";
      ctx.lineWidth = 3;
      ctx.strokeRect(centerX - 2, topY - 2, barWidth + 4, barHeight * 2 + 9);
    }
    
    // --- Player3 (right)
    const rightX = canvas.width - barWidth - 20;
    ctx.textAlign = "right";
    ctx.fillStyle = "green";
    ctx.fillRect(rightX, topY, (player3.health / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(rightX, topY, barWidth, barHeight);
    ctx.font = "14px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("Health: " + player3.health + "%", rightX + barWidth - 5, topY + 13);
    let shieldColor3 = player3.shield > 0
      ? ctx.createLinearGradient(rightX, topY + barHeight + 5, rightX + barWidth, topY + barHeight + 5)
      : "#777";
    if (player3.shield > 0) {
      shieldColor3.addColorStop(0, "#90ee90");
      shieldColor3.addColorStop(1, "#006400");
    }
    ctx.fillStyle = shieldColor3;
    ctx.fillRect(rightX, topY + barHeight + 5, (player3.shield / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(rightX, topY + barHeight + 5, barWidth, barHeight);
    ctx.fillStyle = "white";
    ctx.fillText("Shield: " + player3.shield + "% 🛡️", rightX + barWidth - 5, topY + barHeight * 2 + 3);
    if (player3.shieldActive) {
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 3;
      ctx.strokeRect(rightX - 2, topY - 2, barWidth + 4, barHeight * 2 + 9);
    }
    
    // --- Name Boxes for Trio Mode
    const nameBoxWidth = 160, nameBoxHeight = 30;
    // Player1 name box (left)
    ctx.fillStyle = "white";
    ctx.fillRect(20, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.strokeStyle = "black";
    ctx.strokeRect(20, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.textAlign = "center";
    ctx.fillStyle = "blue";
    ctx.font = "bold 16px Arial";
    ctx.fillText("🟦 " + p1Name, 20 + nameBoxWidth/2, topY + barHeight * 2 + 40);
    
    // Player2 name box (center)
    const centerBoxX = (canvas.width - nameBoxWidth) / 2;
    ctx.fillStyle = "white";
    ctx.fillRect(centerBoxX, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.strokeStyle = "black";
    ctx.strokeRect(centerBoxX, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.fillStyle = "red";
    ctx.fillText("🟥 " + p2Name, centerBoxX + nameBoxWidth/2, topY + barHeight * 2 + 40);
    
    // Player3 name box (right)
    const rightBoxX = canvas.width - nameBoxWidth - 20;
    ctx.fillStyle = "white";
    ctx.fillRect(rightBoxX, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.strokeStyle = "black";
    ctx.strokeRect(rightBoxX, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.fillStyle = "green";
    ctx.fillText("🟩 " + "Computer", rightBoxX + nameBoxWidth/2, topY + barHeight * 2 + 40);
    ctx.textAlign = "left";
  } else {
    // Duo/Solo Mode status
    const leftX = 20, topY = 20;
    ctx.fillStyle = "red";
    ctx.fillRect(leftX, topY, (player1.health / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(leftX, topY, barWidth, barHeight);
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.fillText("Health: " + player1.health + "%", leftX + 5, topY + 13);
    
    let shieldColor1 = player1.shield > 0 
      ? ctx.createLinearGradient(leftX, topY + barHeight + 5, leftX + barWidth, topY + barHeight + 5) 
      : "#777";
    if (player1.shield > 0) {
      shieldColor1.addColorStop(0, "#4A90E2");
      shieldColor1.addColorStop(1, "#003366");
    }
    ctx.fillStyle = shieldColor1;
    ctx.fillRect(leftX, topY + barHeight + 5, (player1.shield / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(leftX, topY + barHeight + 5, barWidth, barHeight);
    ctx.fillStyle = "white";
    ctx.fillText("Shield: " + player1.shield + "% 🛡️", leftX + 5, topY + barHeight * 2 + 3);
    if (player1.shieldActive) {
      ctx.strokeStyle = "cyan";
      ctx.lineWidth = 3;
      ctx.strokeRect(leftX - 2, topY - 2, barWidth + 4, barHeight * 2 + 9);
    }
    
    const rightX = canvas.width - barWidth - 20;
    ctx.textAlign = "right";
    ctx.fillStyle = "red";
    ctx.fillRect(rightX, topY, (player2.health / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(rightX, topY, barWidth, barHeight);
    ctx.font = "14px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("Health: " + player2.health + "%", rightX + barWidth - 5, topY + 13);
    
    let shieldColor2 = player2.shield > 0 
      ? ctx.createLinearGradient(rightX, topY + barHeight + 5, rightX + barWidth, topY + barHeight + 5) 
      : "#777";
    if (player2.shield > 0) {
      shieldColor2.addColorStop(0, "#4A90E2");
      shieldColor2.addColorStop(1, "#003366");
    }
    ctx.fillStyle = shieldColor2;
    ctx.fillRect(rightX, topY + barHeight + 5, (player2.shield / 100) * barWidth, barHeight);
    ctx.strokeStyle = "white";
    ctx.strokeRect(rightX, topY + barHeight + 5, barWidth, barHeight);
    ctx.fillStyle = "white";
    ctx.fillText("Shield: " + player2.shield + "% 🛡️", rightX + barWidth - 5, topY + barHeight * 2 + 3);
    if (player2.shieldActive) {
      ctx.strokeStyle = "orange";
      ctx.lineWidth = 3;
      ctx.strokeRect(rightX - 2, topY - 2, barWidth + 4, barHeight * 2 + 9);
    }
    
    const nameBoxWidth = 220, nameBoxHeight = 30;
    ctx.fillStyle = "white";
    ctx.fillRect(leftX, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.textAlign = "center";
    ctx.fillStyle = "blue";
    ctx.font = "bold 16px Arial";
    ctx.fillText("🟦 " + p1Name, leftX + nameBoxWidth / 2, topY + barHeight * 2 + 27);
    
    ctx.fillStyle = "white";
    ctx.fillRect(rightX, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(rightX, topY + barHeight * 2 + 20, nameBoxWidth, nameBoxHeight);
    ctx.fillStyle = "red";
    ctx.fillText("🟥 " + (gameMode === "solo" ? "Computer" : p2Name), rightX + nameBoxWidth / 2, topY + barHeight * 2 + 27);
    ctx.textAlign = "left";
  }
}

function drawControls() {
  const boxWidth = 300, boxHeight = 50, padding = 20, radius = 10;
  if (gameMode === "trio") {
    // Three control boxes: left (P1), center (P2), right (P3: AI)
    // Left control box for Player1
    const leftX = padding;
    const leftY = canvas.height - boxHeight - padding;
    let grad1 = ctx.createLinearGradient(leftX, leftY, leftX, leftY + boxHeight);
    grad1.addColorStop(0, "#777");
    grad1.addColorStop(1, "#444");
    ctx.save();
    ctx.shadowColor = "black";
    ctx.shadowBlur = 6;
    drawRoundedRect(ctx, leftX, leftY, boxWidth, boxHeight, radius);
    ctx.fillStyle = grad1;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.fillText("🟦P1: WASD | SPACE shoot | Q shield", leftX + 10, leftY + 30);
    
    // Center control box for Player2
    const centerX = (canvas.width - boxWidth) / 2;
    const centerY = canvas.height - boxHeight - padding;
    let grad2 = ctx.createLinearGradient(centerX, centerY, centerX, centerY + boxHeight);
    grad2.addColorStop(0, "#777");
    grad2.addColorStop(1, "#444");
    ctx.save();
    ctx.shadowColor = "black";
    ctx.shadowBlur = 6;
    drawRoundedRect(ctx, centerX, centerY, boxWidth, boxHeight, radius);
    ctx.fillStyle = grad2;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.fillText("🟥P2: Arrow Keys | ENTER shoot | M shield", centerX + 10, centerY + 30);
    
    // Right control box for Player3 (Computer)
    const rightX = canvas.width - boxWidth - padding;
    const rightY = canvas.height - boxHeight - padding;
    let grad3 = ctx.createLinearGradient(rightX, rightY, rightX, rightY + boxHeight);
    grad3.addColorStop(0, "#777");
    grad3.addColorStop(1, "#444");
    ctx.save();
    ctx.shadowColor = "black";
    ctx.shadowBlur = 6;
    drawRoundedRect(ctx, rightX, rightY, boxWidth, boxHeight, radius);
    ctx.fillStyle = grad3;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.fillText("🟩P3 (Computer): AI controlled", rightX + 10, rightY + 30);
  } else {
    // Duo/Solo Mode: two control boxes
    // Left control box for Player1
    const leftX = padding;
    const leftY = canvas.height - boxHeight - padding;
    let grad1 = ctx.createLinearGradient(leftX, leftY, leftX, leftY + boxHeight);
    grad1.addColorStop(0, "#777");
    grad1.addColorStop(1, "#444");
    ctx.save();
    ctx.shadowColor = "black";
    ctx.shadowBlur = 6;
    drawRoundedRect(ctx, leftX, leftY, boxWidth, boxHeight, radius);
    ctx.fillStyle = grad1;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.fillText("🟦P1: WASD | SPACE shoot | Q shield", leftX + 10, leftY + 30);
    
    // Right control box for Player2 or Computer
    const rightX = canvas.width - boxWidth - padding;
    const rightY = canvas.height - boxHeight - padding;
    let grad2 = ctx.createLinearGradient(rightX, rightY, rightX, rightY + boxHeight);
    grad2.addColorStop(0, "#777");
    grad2.addColorStop(1, "#444");
    ctx.save();
    ctx.shadowColor = "black";
    ctx.shadowBlur = 6;
    drawRoundedRect(ctx, rightX, rightY, boxWidth, boxHeight, radius);
    ctx.fillStyle = grad2;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    if (gameMode === "solo") {
      ctx.fillText("🟥P2: Computer AI", rightX + 10, rightY + 30);
    } else {
      ctx.fillText("🟥P2: Arrow Keys | ENTER shoot | M shield", rightX + 10, rightY + 30);
    }
  }
}

// Example implementations for additional functionality

function togglePause() {
  gamePaused = !gamePaused;
  const pauseScreen = document.getElementById("pauseScreen");
  if (gamePaused) pauseScreen.classList.remove("hidden");
  else pauseScreen.classList.add("hidden");
}

function shootBullet(player, playerNum) {
  // Example bullet creation logic
  const bullet = {
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
    speed: 10,
    direction: player.lastDir,
    player: playerNum
  };
  bullets.push(bullet);
  // Play shoot sound
  shootSound.currentTime = 0;
  shootSound.play();
}

// A simple game loop (expand as needed)
function gameLoop() {
  if (!gameRunning || gamePaused) return;
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw players on canvas
  drawPlayers();
  
  // Update game elements
  movePlayers();
  // (Update and draw bullets, handle collisions, etc.)
  
  // Draw UI elements
  drawTopStatus();
  drawControls();
  
  // Request next frame
  requestAnimationFrame(gameLoop);
}

// Functions called from HTML buttons

function startGame() {
  // Hide start screen overlay
  document.getElementById("startScreen").classList.add("hidden");
  // Retrieve player names if provided
  const p1Input = document.getElementById("p1Name");
  if (p1Input.value.trim() !== "") p1Name = p1Input.value;
  const p2Input = document.getElementById("p2Name");
  if (p2Input.value.trim() !== "") p2Name = p2Input.value;
  gameRunning = true;
  startBackgroundMusic();
  gameLoop();
}

function restartGame() {
  // For simplicity, reload the page
  location.reload();
}

function playAgain() {
  restartGame();
}

// Expose functions to the global scope so that inline HTML onclicks work
window.startGame = startGame;
window.restartGame = restartGame;
window.togglePause = togglePause;
window.playAgain = playAgain;
