const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messagePanel = document.getElementById('messagePanel');
const startButton = document.getElementById('startButton');

const healthValue = document.getElementById('healthValue');
const ammoValue = document.getElementById('ammoValue');
const killsValue = document.getElementById('killsValue');
const zoneValue = document.getElementById('zoneValue');

const WORLD = { width: 2200, height: 2200 };
const keys = {};
const pointer = { x: canvas.width / 2, y: canvas.height / 2, down: false };

const state = {
  running: false,
  timer: 0,
  kills: 0,
  enemySpawnTimer: 0,
  pickupSpawnTimer: 0,
  zone: {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    radius: 930,
    targetRadius: 260,
    shrinkSpeed: 12,
    damage: 8,
  }
};

const player = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  radius: 18,
  speed: 260,
  hp: 100,
  maxHp: 100,
  ammo: 30,
  reserveAmmo: 90,
  maxAmmo: 30,
  fireCooldown: 0,
  shootDelay: 0.14,
  reloadTime: 1.2,
  reloading: false,
  angle: 0,
  damage: 18,
  level: 1,
  color: '#71d6ff',
};

const camera = { x: 0, y: 0 };
const bullets = [];
const enemies = [];
const pickups = [];
const particles = [];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function addParticles(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i += 1) {
    particles.push({
      x,
      y,
      vx: randRange(-80, 80),
      vy: randRange(-80, 80),
      life: randRange(0.25, 0.7),
      maxLife: randRange(0.25, 0.7),
      radius: randRange(2, 5),
      color,
    });
  }
}

function addPickup(x, y, type) {
  pickups.push({ x, y, r: 12, type, pulse: Math.random() * Math.PI * 2 });
}

function setMessage(text, showButton = true) {
  const heading = messagePanel.querySelector('h1');
  const paragraph = messagePanel.querySelector('p');
  heading.textContent = text;
  paragraph.textContent = showButton ? 'Outlast the arena. Survive the storm. Claim the drop.' : 'Press the button below to play again.';
  startButton.textContent = showButton ? 'Start Mission' : 'Restart Match';
  messagePanel.classList.remove('hidden');
}

function resetGame() {
  state.running = true;
  state.timer = 0;
  state.kills = 0;
  state.enemySpawnTimer = 0;
  state.pickupSpawnTimer = 0;

  state.zone.x = WORLD.width / 2;
  state.zone.y = WORLD.height / 2;
  state.zone.radius = 930;
  state.zone.targetRadius = 260;
  state.zone.shrinkSpeed = 12;
  state.zone.damage = 8;

  player.x = WORLD.width / 2;
  player.y = WORLD.height / 2;
  player.hp = player.maxHp;
  player.ammo = player.maxAmmo;
  player.reserveAmmo = 90;
  player.fireCooldown = 0;
  player.reloading = false;
  player.angle = 0;
  player.level = 1;
  player.damage = 18;

  bullets.length = 0;
  enemies.length = 0;
  pickups.length = 0;
  particles.length = 0;

  for (let i = 0; i < 9; i += 1) {
    spawnEnemy(true);
  }

  messagePanel.classList.add('hidden');
  updateHud();
}

function spawnEnemy(forceFar = false) {
  let x = randRange(80, WORLD.width - 80);
  let y = randRange(80, WORLD.height - 80);

  if (!forceFar) {
    const angle = Math.random() * Math.PI * 2;
    const distanceFromPlayer = randRange(650, 1100);
    x = player.x + Math.cos(angle) * distanceFromPlayer;
    y = player.y + Math.sin(angle) * distanceFromPlayer;
  }

  x = clamp(x, 50, WORLD.width - 50);
  y = clamp(y, 50, WORLD.height - 50);

  enemies.push({
    x,
    y,
    radius: 16,
    moveSpeed: randRange(85, 125),
    hp: randRange(32, 48),
    fireCooldown: randRange(0.6, 1.8),
    damage: 12,
    color: '#ff866d',
    type: Math.random() > 0.75 ? 'ranged' : 'chaser',
  });
}

function dropPickup(x, y) {
  const roll = Math.random();
  const type = roll < 0.45 ? 'medkit' : roll < 0.8 ? 'ammo' : 'upgrade';
  addPickup(x, y, type);
}

function updateHud() {
  healthValue.textContent = Math.max(0, Math.ceil(player.hp));
  ammoValue.textContent = `${player.ammo} / ${player.reserveAmmo}`;
  killsValue.textContent = state.kills;
  const zonePercent = Math.max(0, Math.min(100, (state.zone.radius / 930) * 100));
  zoneValue.textContent = `${Math.round(zonePercent)}%`;
}

function shootBullet(source, targetX, targetY, damage, speed = 520, color = '#fce57a') {
  const dx = targetX - source.x;
  const dy = targetY - source.y;
  const length = Math.hypot(dx, dy) || 1;

  bullets.push({
    x: source.x,
    y: source.y,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    radius: source === player ? 4 : 3,
    damage,
    fromPlayer: source === player,
    color,
    life: 1.4,
  });
}

function tryReload() {
  if (player.reloading || player.ammo >= player.maxAmmo || player.reserveAmmo <= 0) return;
  player.reloading = true;

  setTimeout(() => {
    const needed = player.maxAmmo - player.ammo;
    const loaded = Math.min(needed, player.reserveAmmo);
    player.ammo += loaded;
    player.reserveAmmo -= loaded;
    player.reloading = false;
  }, player.reloadTime * 1000);
}

function handlePlayerInput(dt) {
  let moveX = 0;
  let moveY = 0;

  if (keys['w'] || keys['arrowup']) moveY -= 1;
  if (keys['s'] || keys['arrowdown']) moveY += 1;
  if (keys['a'] || keys['arrowleft']) moveX -= 1;
  if (keys['d'] || keys['arrowright']) moveX += 1;

  const length = Math.hypot(moveX, moveY) || 1;
  const moveSpeed = player.speed * dt;

  if (moveX !== 0 || moveY !== 0) {
    player.x += (moveX / length) * moveSpeed;
    player.y += (moveY / length) * moveSpeed;
  }

  player.x = clamp(player.x, player.radius, WORLD.width - player.radius);
  player.y = clamp(player.y, player.radius, WORLD.height - player.radius);

  const angle = Math.atan2(pointer.y - canvas.height / 2, pointer.x - canvas.width / 2);
  player.angle = angle;

  if (pointer.down && player.fireCooldown <= 0 && !player.reloading) {
    if (player.ammo <= 0) {
      tryReload();
    } else {
      const spread = player.level >= 2 ? 0.12 : 0.08;
      const shootAngle = angle + randRange(-spread, spread);
      const targetX = player.x + Math.cos(shootAngle) * 1000;
      const targetY = player.y + Math.sin(shootAngle) * 1000;
      shootBullet(player, targetX, targetY, player.damage + player.level * 4, 640, '#fef0a6');
      player.ammo -= 1;
      player.fireCooldown = player.shootDelay;
      addParticles(player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20, '#fff3a0', 6);

      if (player.ammo <= 0 && player.reserveAmmo > 0) {
        tryReload();
      }
    }
  }

  if (keys['r']) {
    tryReload();
  }

  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.x < -30 ||
      bullet.x > WORLD.width + 30 ||
      bullet.y < -30 ||
      bullet.y > WORLD.height + 30 ||
      bullet.life <= 0
    ) {
      bullets.splice(i, 1);
      continue;
    }

    if (bullet.fromPlayer) {
      for (let j = enemies.length - 1; j >= 0; j -= 1) {
        const enemy = enemies[j];
        if (distance(bullet, enemy) <= bullet.radius + enemy.radius) {
          enemy.hp -= bullet.damage;
          addParticles(bullet.x, bullet.y, '#ffb36a', 8);
          bullets.splice(i, 1);

          if (enemy.hp <= 0) {
            if (Math.random() < 0.36) {
              dropPickup(enemy.x, enemy.y);
            }
            enemies.splice(j, 1);
            addParticles(enemy.x, enemy.y, '#ff6a62', 18);
            state.kills += 1;

            if (state.kills >= 18) {
              state.running = false;
              setMessage('MATCH WON', false);
            }
          }
          break;
        }
      }
    } else {
      if (distance(bullet, player) <= bullet.radius + player.radius) {
        player.hp -= bullet.damage;
        addParticles(bullet.x, bullet.y, '#ff5c7a', 8);
        bullets.splice(i, 1);
        if (player.hp <= 0) {
          state.running = false;
          setMessage('YOU WERE ELIMINATED', false);
        }
      }
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    enemy.fireCooldown -= dt;

    if (dist > 1) {
      const speed = enemy.moveSpeed * dt;
      const moveX = (dx / dist) * speed;
      const moveY = (dy / dist) * speed;
      enemy.x += moveX;
      enemy.y += moveY;
    }

    enemy.x = clamp(enemy.x, 30, WORLD.width - 30);
    enemy.y = clamp(enemy.y, 30, WORLD.height - 30);

    if (dist < 500 && enemy.fireCooldown <= 0) {
      const shotSpeed = enemy.type === 'ranged' ? 380 : 320;
      shootBullet(enemy, player.x, player.y, enemy.damage, shotSpeed, '#ff8c71');
      enemy.fireCooldown = enemy.type === 'ranged' ? 1.2 : 1.7;
    }
  }
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    pickup.pulse += dt * 3;

    if (distance(player, pickup) <= player.radius + pickup.r + 4) {
      if (pickup.type === 'medkit') {
        player.hp = Math.min(player.maxHp, player.hp + 30);
      } else if (pickup.type === 'ammo') {
        player.reserveAmmo += 20;
      } else {
        player.level = Math.min(3, player.level + 1);
        player.damage += 6;
      }

      addParticles(pickup.x, pickup.y, '#8af5c1', 14);
      pickups.splice(i, 1);
    }
  }
}

function updateZone(dt) {
  state.zone.radius = Math.max(state.zone.targetRadius, state.zone.radius - state.zone.shrinkSpeed * dt);

  if (distance(player, state.zone) > state.zone.radius) {
    player.hp -= state.zone.damage * dt;
  }

  for (const enemy of enemies) {
    if (distance(enemy, state.zone) > state.zone.radius) {
      enemy.hp -= state.zone.damage * dt * 0.9;
    }
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    if (enemies[i].hp <= 0) {
      const enemy = enemies[i];
      addParticles(enemy.x, enemy.y, '#ff6a62', 10);
      enemies.splice(i, 1);
      state.kills += 1;
    }
  }

  if (player.hp <= 0 && state.running) {
    state.running = false;
    setMessage('YOU WERE ELIMINATED', false);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function update(dt) {
  if (!state.running) {
    return;
  }

  state.timer += dt;
  state.enemySpawnTimer += dt;
  state.pickupSpawnTimer += dt;

  if (state.enemySpawnTimer > 2.2) {
    state.enemySpawnTimer = 0;
    if (enemies.length < 18) {
      spawnEnemy();
    }
  }

  if (state.pickupSpawnTimer > 7) {
    state.pickupSpawnTimer = 0;
    if (pickups.length < 4) {
      addPickup(randRange(120, WORLD.width - 120), randRange(120, WORLD.height - 120), Math.random() > 0.5 ? 'ammo' : 'medkit');
    }
  }

  handlePlayerInput(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updatePickups(dt);
  updateZone(dt);
  updateParticles(dt);

  camera.x = clamp(player.x - canvas.width / 2, 0, WORLD.width - canvas.width);
  camera.y = clamp(player.y - canvas.height / 2, 0, WORLD.height - canvas.height);

  updateHud();
}

function drawGrid() {
  const gridSize = 50;
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.height);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawZone() {
  const screenX = state.zone.x - camera.x;
  const screenY = state.zone.y - camera.y;

  ctx.save();
  ctx.beginPath();
  ctx.arc(screenX, screenY, state.zone.radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(116, 227, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(screenX, screenY, state.zone.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(92, 156, 255, 0.08)';
  ctx.fill();
  ctx.restore();
}

function drawPickup(pickup) {
  const x = pickup.x - camera.x;
  const y = pickup.y - camera.y;
  const pulse = Math.sin(pickup.pulse) * 2.5;

  ctx.save();
  ctx.translate(x, y);

  if (pickup.type === 'medkit') {
    ctx.fillStyle = '#82f7b2';
    ctx.fillRect(-10, -8, 20, 16);
    ctx.fillStyle = '#0f2b22';
    ctx.fillRect(-2, -12, 4, 24);
    ctx.fillRect(-12, -2, 24, 4);
  } else if (pickup.type === 'ammo') {
    ctx.fillStyle = '#ffd167';
    ctx.fillRect(-12, -8, 24, 16);
    ctx.fillStyle = '#1a1507';
    ctx.fillRect(-3, -12, 6, 24);
  } else {
    ctx.fillStyle = '#75d9ff';
    ctx.beginPath();
    ctx.arc(0, 0, 12 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eaf9ff';
    ctx.fillRect(-8, -3, 16, 6);
    ctx.fillRect(-3, -8, 6, 16);
  }

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const x = p.x - camera.x;
    const y = p.y - camera.y;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.beginPath();
    ctx.arc(x, y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBullet(bullet) {
  const x = bullet.x - camera.x;
  const y = bullet.y - camera.y;
  ctx.fillStyle = bullet.color;
  ctx.beginPath();
  ctx.arc(x, y, bullet.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(enemy) {
  const x = enemy.x - camera.x;
  const y = enemy.y - camera.y;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-12, -22, 24, 5);
  ctx.fillStyle = '#ffefef';
  ctx.fillRect(-12, -22, (enemy.hp / 48) * 24, 5);
  ctx.restore();
}

function drawPlayer() {
  const x = player.x - camera.x;
  const y = player.y - camera.y;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.angle);

  ctx.beginPath();
  ctx.fillStyle = '#7cc6ff';
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff0c7';
  ctx.fillRect(8, -3, 24, 6);

  ctx.restore();
}

function drawStatusText() {
  ctx.fillStyle = '#edf5ff';
  ctx.font = '20px Arial';
  ctx.fillText(`HP: ${Math.ceil(player.hp)}`, 24, canvas.height - 20);
  ctx.fillText(`Kills: ${state.kills}`, 180, canvas.height - 20);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawZone();

  for (const pickup of pickups) drawPickup(pickup);
  for (const bullet of bullets) drawBullet(bullet);
  for (const enemy of enemies) drawEnemy(enemy);
  drawPlayer();
  drawParticles();
  drawStatusText();
}

let lastTime = 0;
function gameLoop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000 || 0.016);
  lastTime = timestamp;

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function setPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  pointer.x = (event.clientX - rect.left) * scaleX;
  pointer.y = (event.clientY - rect.top) * scaleY;
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (key === ' ') {
    event.preventDefault();
    pointer.down = true;
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = false;
  if (key === ' ') pointer.down = false;
});

canvas.addEventListener('mousemove', setPointerPosition);
canvas.addEventListener('mousedown', (event) => {
  setPointerPosition(event);
  pointer.down = true;
});
canvas.addEventListener('mouseup', () => {
  pointer.down = false;
});
canvas.addEventListener('mouseleave', () => {
  pointer.down = false;
});

startButton.addEventListener('click', () => {
  resetGame();
});

setMessage('TRAPPED FIRE');
resetGame();
requestAnimationFrame(gameLoop);
