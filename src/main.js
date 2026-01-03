import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import nipplejs from 'nipplejs';

// ============================================================================
// TIME CLASS
// ============================================================================
class Time {
  constructor() {
    this.deltaTime = 0;
    this.lastTime = performance.now();
  }

  update() {
    const currentTime = performance.now();
    this.deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
  }
}

// ============================================================================
// INPUT MANAGER - Hybrid Keyboard + Touch Joystick
// ============================================================================
class InputManager {
  constructor() {
    // Keyboard state
    this.keys = { w: false, a: false, s: false, d: false };

    // Joystick state
    this.joystickVector = { x: 0, y: 0 };
    this.joystickActive = false;
    this.joystick = null;

    this.setupKeyboard();
    this.setupJoystick();
  }

  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) {
        this.keys[key] = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) {
        this.keys[key] = false;
        e.preventDefault();
      }
    });
  }

  setupJoystick() {
    const zone = document.getElementById('zone_joystick');
    if (!zone) return;

    // Check if mobile/touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice && window.innerWidth > 768) {
      zone.style.display = 'none';
      return;
    }

    this.joystick = nipplejs.create({
      zone: zone,
      mode: 'static',
      position: { left: '75px', bottom: '75px' },
      color: '#00ffff',
      size: 120,
      restOpacity: 0.5,
      fadeTime: 100
    });

    this.joystick.on('move', (evt, data) => {
      this.joystickActive = true;
      // Normalize the vector (force is 0-1 based on distance)
      const force = Math.min(data.force, 1);
      const angle = data.angle.radian;
      this.joystickVector.x = Math.cos(angle) * force;
      this.joystickVector.y = Math.sin(angle) * force;
    });

    this.joystick.on('end', () => {
      this.joystickActive = false;
      this.joystickVector.x = 0;
      this.joystickVector.y = 0;
    });
  }

  // Legacy method for compatibility
  getAxis(axis) {
    if (axis === 'horizontal') return (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0);
    if (axis === 'vertical') return (this.keys.w ? 1 : 0) - (this.keys.s ? 1 : 0);
    return 0;
  }

  // New unified method - returns {x, z} for 3D movement
  getMovementVector() {
    // Keyboard input
    const keyX = (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0);
    const keyZ = (this.keys.s ? 1 : 0) - (this.keys.w ? 1 : 0); // Inverted for 3D coords

    // If joystick is active, prioritize it
    if (this.joystickActive) {
      return {
        x: this.joystickVector.x,
        z: -this.joystickVector.y // Invert Y to match 3D Z axis
      };
    }

    return { x: keyX, z: keyZ };
  }
}

// ============================================================================
// SOUND MANAGER - Synthesized SFX using Web Audio API
// ============================================================================
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.3;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) { console.warn('Audio not supported'); }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : this.volume;
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  playShoot() {
    if (this.muted || !this.initialized) return;
    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    // Variable pitch for variety
    const basePitch = 800 + Math.random() * 400;
    osc.type = 'square';
    osc.frequency.setValueAtTime(basePitch, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playHit() {
    if (this.muted || !this.initialized) return;
    this.ensureContext();
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    noise.connect(gain);
    gain.connect(this.masterGain);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.05);
  }

  playExplosion() {
    if (this.muted || !this.initialized) return;
    this.ensureContext();
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.3);

    const gain = this.ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.3);
  }

  playLevelUp() {
    if (this.muted || !this.initialized) return;
    this.ensureContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = this.ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  playGameOver() {
    if (this.muted || !this.initialized) return;
    this.ensureContext();
    const notes = [392, 349.23, 293.66, 261.63]; // G4, F4, D4, C4 (descending sad)
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const t = this.ctx.currentTime + i * 0.25;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  playBossAlert() {
    if (this.muted || !this.initialized) return;
    this.ensureContext();
    // Dramatic warning sound
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.type = 'sawtooth';
      osc.frequency.value = 150;
      const t = this.ctx.currentTime + i * 0.4;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    }
  }

  playVictory() {
    if (this.muted || !this.initialized) return;
    this.ensureContext();
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5 to G6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = this.ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}

// ============================================================================
// FLOATING TEXT
// ============================================================================
class FloatingText {
  constructor() {
    this.element = null;
    this.lifetime = 1;
    this.age = 0;
    this.isDestroyed = false;
    this.startY = 0;
    this.worldPosition = new THREE.Vector3();
  }

  start(text, worldPosition, color = '#ffff00') {
    this.worldPosition.copy(worldPosition);
    this.startY = worldPosition.y;
    this.element = document.createElement('div');
    this.element.textContent = text;
    this.element.style.cssText = `
            position: fixed; color: ${color}; font-family: Arial, sans-serif;
            font-size: 24px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            pointer-events: none; z-index: 500; transform: translate(-50%, -50%);
        `;
    document.body.appendChild(this.element);
  }

  update(deltaTime, camera) {
    if (this.isDestroyed) return;
    this.age += deltaTime;
    this.worldPosition.y = this.startY + (this.age * 2);
    const screenPos = this.worldPosition.clone().project(camera);
    this.element.style.left = `${(screenPos.x * 0.5 + 0.5) * window.innerWidth}px`;
    this.element.style.top = `${(-screenPos.y * 0.5 + 0.5) * window.innerHeight}px`;
    this.element.style.opacity = 1 - (this.age / this.lifetime);
    this.element.style.transform = `translate(-50%, -50%) scale(${1 + this.age * 0.5})`;
    if (this.age >= this.lifetime) this.isDestroyed = true;
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// ============================================================================
// FLOATING TEXT MANAGER
// ============================================================================
class FloatingTextManager {
  constructor() { this.texts = []; }

  spawn(text, worldPosition, color = '#ffff00') {
    const ft = new FloatingText();
    ft.start(text, worldPosition, color);
    this.texts.push(ft);
  }

  update(deltaTime, camera) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].update(deltaTime, camera);
      if (this.texts[i].isDestroyed) {
        this.texts[i].destroy();
        this.texts.splice(i, 1);
      }
    }
  }
}

// ============================================================================
// UI MANAGER
// ============================================================================
class UIManager {
  constructor() {
    this.scoreElement = null;
    this.levelElement = null;
    this.timerElement = null;
    this.weaponElement = null;
    this.skillsElement = null;
    this.xpBarFill = null;
    this.healthBarFill = null;
    this.levelUpMenu = null;
    this.gameOverScreen = null;
    this.score = 0;
    this.kills = 0;
  }

  start() {
    const uiContainer = document.createElement('div');
    uiContainer.id = 'game-ui';
    uiContainer.style.cssText = `position:fixed;top:0;left:0;width:100%;padding:20px;pointer-events:none;z-index:100;`;

    this.timerElement = document.createElement('div');
    this.timerElement.style.cssText = `position:absolute;top:20px;left:50%;transform:translateX(-50%);color:white;font-family:Arial;font-size:36px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.5);`;
    this.timerElement.textContent = '00:00';

    const healthBar = document.createElement('div');
    healthBar.style.cssText = `width:100%;height:25px;background:rgba(0,0,0,0.5);border-radius:12px;overflow:hidden;margin-bottom:10px;border:2px solid rgba(255,100,100,0.5);`;
    this.healthBarFill = document.createElement('div');
    this.healthBarFill.style.cssText = `width:100%;height:100%;background:linear-gradient(90deg,#ff0000,#ff4444);border-radius:10px;transition:width 0.2s;box-shadow:0 0 10px #ff0000;`;
    healthBar.appendChild(this.healthBarFill);

    const xpBar = document.createElement('div');
    xpBar.style.cssText = `width:100%;height:15px;background:rgba(0,0,0,0.5);border-radius:8px;overflow:hidden;margin-bottom:15px;border:2px solid rgba(255,255,255,0.3);`;
    this.xpBarFill = document.createElement('div');
    this.xpBarFill.style.cssText = `width:0%;height:100%;background:linear-gradient(90deg,#00ff00,#88ff88);border-radius:6px;transition:width 0.3s;box-shadow:0 0 10px #00ff00;`;
    xpBar.appendChild(this.xpBarFill);

    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = `display:flex;gap:20px;align-items:center;flex-wrap:wrap;`;

    this.scoreElement = document.createElement('div');
    this.scoreElement.style.cssText = `color:white;font-family:Arial;font-size:22px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.5);`;
    this.scoreElement.textContent = 'Score: 0';

    this.levelElement = document.createElement('div');
    this.levelElement.style.cssText = `color:#ffff00;font-family:Arial;font-size:22px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.5);`;
    this.levelElement.textContent = 'Level: 1';

    this.weaponElement = document.createElement('div');
    this.weaponElement.style.cssText = `color:#88ffff;font-family:Arial;font-size:18px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.5);`;
    this.weaponElement.textContent = '🔫 Pistola Lv.1';

    this.skillsElement = document.createElement('div');
    this.skillsElement.style.cssText = `color:#ff88ff;font-family:Arial;font-size:16px;font-weight:bold;text-shadow:2px 2px 4px rgba(0,0,0,0.5);`;
    this.skillsElement.textContent = '';

    statsContainer.appendChild(this.scoreElement);
    statsContainer.appendChild(this.levelElement);
    statsContainer.appendChild(this.weaponElement);
    statsContainer.appendChild(this.skillsElement);

    uiContainer.appendChild(this.timerElement);
    uiContainer.appendChild(healthBar);
    uiContainer.appendChild(xpBar);
    uiContainer.appendChild(statsContainer);
    document.body.appendChild(uiContainer);

    this.createLevelUpMenu();
    this.createGameOverScreen();
  }

  createLevelUpMenu() {
    this.levelUpMenu = document.createElement('div');
    this.levelUpMenu.id = 'level-up-menu';
    this.levelUpMenu.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:none;justify-content:center;align-items:center;flex-direction:column;z-index:1000;pointer-events:auto;`;

    const content = document.createElement('div');
    content.style.cssText = `text-align:center;padding:40px;`;

    const title = document.createElement('h1');
    title.textContent = '¡LEVEL UP!';
    title.style.cssText = `color:#ffff00;font-family:Arial;font-size:48px;margin-bottom:20px;text-shadow:0 0 20px #ffff00;animation:pulse 1s infinite;`;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Elige una mejora:';
    subtitle.style.cssText = `color:white;font-family:Arial;font-size:24px;margin-bottom:30px;`;

    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = 'upgrade-buttons';
    buttonsContainer.style.cssText = `display:flex;gap:15px;justify-content:center;flex-wrap:wrap;max-width:800px;`;

    const style = document.createElement('style');
    style.textContent = `
            @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.05);} }
            .upgrade-btn { padding:15px 25px;font-size:16px;font-weight:bold;font-family:Arial;border:none;border-radius:10px;cursor:pointer;transition:all 0.2s;min-width:180px; }
            .upgrade-btn:hover { transform:scale(1.1);box-shadow:0 0 30px currentColor; }
            .upgrade-btn.pistol { background:linear-gradient(135deg,#ffaa00,#ff6600);color:white; }
            .upgrade-btn.shotgun { background:linear-gradient(135deg,#ff4444,#cc0000);color:white; }
            .upgrade-btn.heal { background:linear-gradient(135deg,#44ff44,#00cc00);color:white; }
            .upgrade-btn.orbital { background:linear-gradient(135deg,#00ffff,#0088aa);color:white; }
            .upgrade-btn.thunder { background:linear-gradient(135deg,#ffff00,#ffaa00);color:#333; }
        `;
    document.head.appendChild(style);

    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(buttonsContainer);
    this.levelUpMenu.appendChild(content);
    document.body.appendChild(this.levelUpMenu);
  }

  showLevelUpMenu(upgrades, onSelect) {
    this.levelUpMenu.style.display = 'flex';
    const container = document.getElementById('upgrade-buttons');
    container.innerHTML = '';
    upgrades.forEach(u => {
      const btn = document.createElement('button');
      btn.className = `upgrade-btn ${u.class}`;
      btn.innerHTML = `${u.label}<br><small>${u.desc}</small>`;
      btn.onclick = () => { this.hideLevelUpMenu(); onSelect(u.id); };
      container.appendChild(btn);
    });
  }

  hideLevelUpMenu() { this.levelUpMenu.style.display = 'none'; }

  updateWeaponDisplay(name, level) {
    const icon = name === 'Pistola' ? '🔫' : '💥';
    this.weaponElement.textContent = `${icon} ${name} Lv.${level}`;
  }

  updateSkillsDisplay(skills) {
    if (skills.length === 0) { this.skillsElement.textContent = ''; return; }
    this.skillsElement.textContent = skills.map(s => `${s.icon} Lv.${s.level}`).join(' | ');
  }

  updateTimer(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    this.timerElement.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  updateHealthBar(cur, max) {
    const p = (cur / max) * 100;
    this.healthBarFill.style.width = `${Math.max(0, Math.min(p, 100))}%`;
    this.healthBarFill.style.background = p < 25 ? 'linear-gradient(90deg,#880000,#ff0000)' : p < 50 ? 'linear-gradient(90deg,#ff4400,#ff8800)' : 'linear-gradient(90deg,#ff0000,#ff4444)';
  }

  updateScore(pts) {
    this.score += pts;
    this.kills++;
    this.scoreElement.textContent = `Score: ${this.score}`;
  }

  updateLevel(lvl) { this.levelElement.textContent = `Level: ${lvl}`; }
  updateXpBar(cur, max) { this.xpBarFill.style.width = `${Math.min((cur / max) * 100, 100)}%`; }
  getScore() { return this.score; }
  getKills() { return this.kills; }

  createGameOverScreen() {
    this.gameOverScreen = document.createElement('div');
    this.gameOverScreen.id = 'game-over';
    this.gameOverScreen.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:none;justify-content:center;align-items:center;flex-direction:column;z-index:2000;`;

    const content = document.createElement('div');
    content.id = 'game-over-content';
    content.style.cssText = `text-align:center;`;

    const title = document.createElement('h1');
    title.id = 'go-title';
    title.style.cssText = `color:#ff4444;font-family:Arial;font-size:64px;margin-bottom:20px;text-shadow:0 0 30px #ff0000;`;
    title.textContent = 'YOU DIED';

    const stats = document.createElement('div');
    stats.id = 'go-stats';
    stats.style.cssText = `color:white;font-family:Arial;font-size:24px;margin-bottom:40px;line-height:2;`;

    const btn = document.createElement('button');
    btn.id = 'restart-btn';
    btn.textContent = '🔄 PLAY AGAIN';
    btn.style.cssText = `padding:20px 50px;font-size:24px;font-weight:bold;font-family:Arial;border:none;border-radius:15px;cursor:pointer;background:linear-gradient(135deg,#44ff44,#00aa00);color:white;transition:all 0.2s;`;
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';

    content.appendChild(title);
    content.appendChild(stats);
    content.appendChild(btn);
    this.gameOverScreen.appendChild(content);
    document.body.appendChild(this.gameOverScreen);
  }

  showGameOver(time, level, kills, score, onRestart) {
    const m = Math.floor(time / 60), s = Math.floor(time % 60);
    document.getElementById('go-stats').innerHTML = `
      ⏱️ Tiempo Sobrevivido: <span style="color:#ffff00">${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}</span><br>
      ⭐ Nivel Alcanzado: <span style="color:#ffff00">${level}</span><br>
      💀 Enemigos Eliminados: <span style="color:#ffff00">${kills}</span><br>
      🏆 Score Final: <span style="color:#ffff00">${score}</span>
    `;
    document.getElementById('restart-btn').onclick = onRestart;
    this.gameOverScreen.style.display = 'flex';
  }

  hideGameOver() { this.gameOverScreen.style.display = 'none'; }

  reset() {
    this.score = 0;
    this.kills = 0;
    this.scoreElement.textContent = 'Score: 0';
    this.levelElement.textContent = 'Level: 1';
    this.xpBarFill.style.width = '0%';
    this.healthBarFill.style.width = '100%';
    this.hideBossBar();
    this.hideWarning();
    this.hideVictory();
  }

  // Boss HP Bar
  createBossBar() {
    this.bossBarContainer = document.createElement('div');
    this.bossBarContainer.id = 'boss-bar';
    this.bossBarContainer.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);width:60%;max-width:600px;display:none;flex-direction:column;align-items:center;z-index:150;`;

    this.bossNameElement = document.createElement('div');
    this.bossNameElement.style.cssText = `color:#ffd700;font-family:Arial;font-size:24px;font-weight:bold;text-shadow:0 0 20px #ffd700;margin-bottom:10px;`;

    const barBg = document.createElement('div');
    barBg.style.cssText = `width:100%;height:30px;background:rgba(0,0,0,0.7);border-radius:15px;border:3px solid #ffd700;overflow:hidden;`;

    this.bossBarFill = document.createElement('div');
    this.bossBarFill.style.cssText = `width:100%;height:100%;background:linear-gradient(90deg,#ff4400,#ffd700);transition:width 0.2s;box-shadow:0 0 20px #ffd700;`;

    barBg.appendChild(this.bossBarFill);
    this.bossBarContainer.appendChild(this.bossNameElement);
    this.bossBarContainer.appendChild(barBg);
    document.body.appendChild(this.bossBarContainer);
  }

  showBossBar(name) {
    if (!this.bossBarContainer) this.createBossBar();
    this.bossNameElement.textContent = `👑 ${name} 👑`;
    this.bossBarContainer.style.display = 'flex';
  }

  updateBossBar(percent) {
    if (this.bossBarFill) this.bossBarFill.style.width = `${Math.max(0, percent * 100)}%`;
  }

  hideBossBar() {
    if (this.bossBarContainer) this.bossBarContainer.style.display = 'none';
  }

  // Warning text
  showWarning(text) {
    if (!this.warningElement) {
      this.warningElement = document.createElement('div');
      this.warningElement.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff0000;font-family:Arial;font-size:48px;font-weight:bold;text-shadow:0 0 30px #ff0000;z-index:500;animation:warningPulse 0.5s infinite;`;
      const style = document.createElement('style');
      style.textContent = `@keyframes warningPulse{0%,100%{opacity:1;transform:translate(-50%,-50%) scale(1);}50%{opacity:0.5;transform:translate(-50%,-50%) scale(1.1);}}`;
      document.head.appendChild(style);
      document.body.appendChild(this.warningElement);
    }
    this.warningElement.textContent = text;
    this.warningElement.style.display = 'block';
    setTimeout(() => this.hideWarning(), 3000);
  }

  hideWarning() {
    if (this.warningElement) this.warningElement.style.display = 'none';
  }

  // Victory screen
  showVictory(time, level, kills, score, onRestart) {
    if (!this.victoryScreen) {
      this.victoryScreen = document.createElement('div');
      this.victoryScreen.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:none;justify-content:center;align-items:center;flex-direction:column;z-index:2000;`;

      const content = document.createElement('div');
      content.style.cssText = `text-align:center;`;

      this.victoryTitle = document.createElement('h1');
      this.victoryTitle.style.cssText = `color:#ffd700;font-family:Arial;font-size:72px;margin-bottom:20px;text-shadow:0 0 40px #ffd700;`;
      this.victoryTitle.textContent = '🏆 VICTORY! 🏆';

      this.victoryStats = document.createElement('div');
      this.victoryStats.style.cssText = `color:white;font-family:Arial;font-size:24px;margin-bottom:40px;line-height:2;`;

      this.victoryBtn = document.createElement('button');
      this.victoryBtn.textContent = '🎮 PLAY AGAIN';
      this.victoryBtn.style.cssText = `padding:20px 50px;font-size:24px;font-weight:bold;font-family:Arial;border:none;border-radius:15px;cursor:pointer;background:linear-gradient(135deg,#ffd700,#ff8800);color:white;transition:all 0.2s;`;
      this.victoryBtn.onmouseover = () => this.victoryBtn.style.transform = 'scale(1.1)';
      this.victoryBtn.onmouseout = () => this.victoryBtn.style.transform = 'scale(1)';

      content.appendChild(this.victoryTitle);
      content.appendChild(this.victoryStats);
      content.appendChild(this.victoryBtn);
      this.victoryScreen.appendChild(content);
      document.body.appendChild(this.victoryScreen);
    }

    const m = Math.floor(time / 60), s = Math.floor(time % 60);
    this.victoryStats.innerHTML = `
      ⏱️ Tiempo: <span style="color:#ffd700">${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}</span><br>
      ⭐ Nivel: <span style="color:#ffd700">${level}</span><br>
      💀 Eliminados: <span style="color:#ffd700">${kills}</span><br>
      🏆 Score: <span style="color:#ffd700">${score}</span>
    `;
    this.victoryBtn.onclick = onRestart;
    this.victoryScreen.style.display = 'flex';
  }

  hideVictory() {
    if (this.victoryScreen) this.victoryScreen.style.display = 'none';
  }
}

// ============================================================================
// PARTICLE & PARTICLE SYSTEM
// ============================================================================
class Particle {
  constructor(scene) {
    this.scene = scene; this.mesh = null; this.velocity = new THREE.Vector3();
    this.lifetime = 0.5; this.age = 0; this.isDestroyed = false; this.initialScale = 1;
  }

  start(pos, color) {
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(pos);
    this.velocity.set((Math.random() - 0.5) * 10, Math.random() * 8 + 2, (Math.random() - 0.5) * 10);
    this.initialScale = 0.8 + Math.random() * 0.4;
    this.mesh.scale.setScalar(this.initialScale);
    this.scene.add(this.mesh);
  }

  update(dt) {
    if (this.isDestroyed) return;
    this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
    this.velocity.y -= 15 * dt;
    this.mesh.rotation.x += dt * 5; this.mesh.rotation.y += dt * 3;
    this.age += dt;
    this.mesh.scale.setScalar(this.initialScale * (1 - this.age / this.lifetime));
    if (this.age >= this.lifetime) this.isDestroyed = true;
  }

  destroy() {
    this.isDestroyed = true;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose(); this.mesh.material.dispose();
  }
}

class ParticleSystem {
  constructor(scene) { this.scene = scene; this.particles = []; }

  spawnExplosion(pos, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const p = new Particle(this.scene);
      p.start(pos.clone(), color);
      this.particles.push(p);
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].isDestroyed) {
        this.particles[i].destroy();
        this.particles.splice(i, 1);
      }
    }
  }
}

// ============================================================================
// EXPERIENCE GEM
// ============================================================================
class ExperienceGem {
  constructor(scene) {
    this.scene = scene; this.mesh = null; this.xpValue = 10;
    this.isCollected = false; this.magnetRange = 3; this.magnetSpeed = 15;
    this.floatOffset = Math.random() * Math.PI * 2;
  }

  start(pos) {
    const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1.5 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(pos); this.mesh.position.y = 0.3;
    this.scene.add(this.mesh);
  }

  update(dt, playerPos) {
    if (this.isCollected) return;
    this.floatOffset += dt * 3;
    this.mesh.position.y = 0.3 + Math.sin(this.floatOffset) * 0.1;
    this.mesh.rotation.y += dt * 2;
    const dist = this.mesh.position.distanceTo(playerPos);
    if (dist < this.magnetRange) {
      const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position).normalize();
      const speed = this.magnetSpeed * (1 + (1 - dist / this.magnetRange) * 2);
      this.mesh.position.x += dir.x * speed * dt;
      this.mesh.position.z += dir.z * speed * dt;
    }
  }

  getPosition() { return this.mesh.position; }
  collect() { this.isCollected = true; }
  destroy() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// ============================================================================
// PROJECTILE
// ============================================================================
class Projectile {
  constructor(scene, damage = 1, color = 0xffff00) {
    this.scene = scene; this.mesh = null; this.speed = 25;
    this.direction = new THREE.Vector3(); this.lifetime = 2;
    this.age = 0; this.isDestroyed = false; this.damage = damage; this.color = color;
  }

  start(pos, dir) {
    const geo = new THREE.SphereGeometry(0.3, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 2.0 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(pos); this.mesh.position.y = 1;
    this.direction.copy(dir).normalize(); this.direction.y = 0;
    this.scene.add(this.mesh);
  }

  update(dt) {
    if (this.isDestroyed) return;
    this.mesh.position.x += this.direction.x * this.speed * dt;
    this.mesh.position.z += this.direction.z * this.speed * dt;
    this.age += dt;
    if (this.age >= this.lifetime) this.isDestroyed = true;
  }

  getPosition() { return this.mesh.position; }
  getDamage() { return this.damage; }
  destroy() { this.isDestroyed = true; this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// ============================================================================
// WEAPON CLASS
// ============================================================================
class Weapon {
  constructor(type = 'pistol') {
    this.type = type; this.level = 1;
    if (type === 'pistol') {
      this.name = 'Pistola'; this.damage = 1; this.fireRate = 0.5;
      this.range = 15; this.projectileCount = 1; this.spreadAngle = 0; this.color = 0xffff00;
    } else {
      this.name = 'Escopeta'; this.damage = 1.5; this.fireRate = 1.2;
      this.range = 8; this.projectileCount = 3; this.spreadAngle = Math.PI / 8; this.color = 0xff6600;
    }
  }

  upgrade() {
    this.level++;
    if (this.type === 'pistol') { this.fireRate *= 0.85; this.damage *= 1.1; }
    else { if (this.level % 2 === 0) this.projectileCount++; else this.damage *= 1.2; }
  }

  fire(scene, playerPos, targetPos, projectiles) {
    const baseDir = new THREE.Vector3().subVectors(targetPos, playerPos);
    baseDir.y = 0; baseDir.normalize();

    if (this.projectileCount === 1) {
      const p = new Projectile(scene, this.damage, this.color);
      p.start(playerPos.clone(), baseDir);
      projectiles.push(p);
    } else {
      const half = this.spreadAngle * (this.projectileCount - 1) / 2;
      for (let i = 0; i < this.projectileCount; i++) {
        const angle = -half + this.spreadAngle * i;
        const dir = this.rotateY(baseDir.clone(), angle);
        const p = new Projectile(scene, this.damage, this.color);
        p.start(playerPos.clone(), dir);
        projectiles.push(p);
      }
    }
  }

  rotateY(v, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = v.x * c - v.z * s, z = v.x * s + v.z * c;
    v.x = x; v.z = z; return v;
  }
}

// ============================================================================
// SKILL CLASSES - Orbital Shield & Thunder Strike
// ============================================================================
class Skill {
  constructor(name, icon) {
    this.name = name; this.icon = icon; this.level = 1; this.isActive = false;
  }
  upgrade() { this.level++; }
  start(scene, player) { this.isActive = true; }
  update(dt, scene, player, enemies, floatingText) { }
  destroy(scene) { this.isActive = false; }
}

class OrbitalShield extends Skill {
  constructor() {
    super('Orbital Shield', '🛡️');
    this.orbitals = [];
    this.orbitRadius = 2;
    this.orbitSpeed = 3;
    this.damage = 10;
    this.damageInterval = 0.5;
    this.damageCooldowns = new Map();
    this.orbitalCount = 2;
  }

  upgrade() {
    super.upgrade();
    this.orbitSpeed += 0.5;
    this.damage += 5;
    if (this.level % 2 === 0) this.orbitalCount++;
  }

  start(scene, player) {
    super.start(scene, player);
    this.createOrbitals(scene);
  }

  createOrbitals(scene) {
    // Clear existing
    this.orbitals.forEach(o => {
      scene.remove(o.mesh);
      o.mesh.geometry.dispose();
      o.mesh.material.dispose();
    });
    this.orbitals = [];

    for (let i = 0; i < this.orbitalCount; i++) {
      const geo = new THREE.SphereGeometry(0.4, 16, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2.0, transparent: true, opacity: 0.9
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      scene.add(mesh);
      this.orbitals.push({
        mesh,
        angle: (Math.PI * 2 / this.orbitalCount) * i
      });
    }
  }

  update(dt, scene, player, enemies, floatingText) {
    if (!this.isActive) return;

    // Add more orbitals if needed
    if (this.orbitals.length < this.orbitalCount) {
      this.createOrbitals(scene);
    }

    const playerPos = player.getPosition();

    // Update orbital positions
    this.orbitals.forEach(orbital => {
      orbital.angle += this.orbitSpeed * dt;
      orbital.mesh.position.x = playerPos.x + Math.cos(orbital.angle) * this.orbitRadius;
      orbital.mesh.position.z = playerPos.z + Math.sin(orbital.angle) * this.orbitRadius;
      orbital.mesh.position.y = 1;
      orbital.mesh.rotation.y += dt * 5;
    });

    // Check collisions with enemies
    for (const enemy of enemies) {
      if (enemy.isDestroyed) continue;

      for (const orbital of this.orbitals) {
        const dist = orbital.mesh.position.distanceTo(enemy.getPosition());
        if (dist < 1.2) {
          // Check cooldown
          const lastHit = this.damageCooldowns.get(enemy) || 0;
          const now = performance.now() / 1000;
          if (now - lastHit >= this.damageInterval) {
            this.damageCooldowns.set(enemy, now);

            // Apply damage
            const died = enemy.takeDamage(this.damage);

            // Show damage number
            const pos = enemy.getPosition().clone();
            pos.y += 1.5;
            floatingText.spawn(this.damage.toString(), pos, '#00ffff');

            // Knockback
            const knockDir = new THREE.Vector3().subVectors(enemy.getPosition(), playerPos).normalize();
            enemy.mesh.position.x += knockDir.x * 0.5;
            enemy.mesh.position.z += knockDir.z * 0.5;

            if (died) {
              return { died: true, enemy };
            }
          }
        }
      }
    }
    return null;
  }

  destroy(scene) {
    super.destroy(scene);
    this.orbitals.forEach(o => {
      scene.remove(o.mesh);
      o.mesh.geometry.dispose();
      o.mesh.material.dispose();
    });
    this.orbitals = [];
    this.damageCooldowns.clear();
  }
}

class ThunderStrike extends Skill {
  constructor() {
    super('Thunder Strike', '⚡');
    this.cooldown = 3;
    this.timer = 0;
    this.damage = 50;
    this.lightningBolts = [];
  }

  upgrade() {
    super.upgrade();
    this.cooldown = Math.max(1, this.cooldown - 0.3);
    this.damage += 15;
  }

  update(dt, scene, player, enemies, floatingText) {
    if (!this.isActive) return;

    // Update existing lightning bolts
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      bolt.age += dt;
      if (bolt.age >= bolt.lifetime) {
        scene.remove(bolt.line);
        bolt.line.geometry.dispose();
        bolt.line.material.dispose();
        this.lightningBolts.splice(i, 1);
      }
    }

    this.timer += dt;
    if (this.timer >= this.cooldown && enemies.length > 0) {
      this.timer = 0;

      // Pick random enemy
      const validEnemies = enemies.filter(e => !e.isDestroyed);
      if (validEnemies.length === 0) return null;

      const target = validEnemies[Math.floor(Math.random() * validEnemies.length)];
      const targetPos = target.getPosition().clone();

      // Create lightning visual
      const points = [
        new THREE.Vector3(targetPos.x + (Math.random() - 0.5) * 2, 20, targetPos.z + (Math.random() - 0.5) * 2),
        new THREE.Vector3(targetPos.x, targetPos.y + 0.5, targetPos.z)
      ];

      // Add zigzag points
      const segments = 5;
      const fullPoints = [points[0]];
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const basePoint = new THREE.Vector3().lerpVectors(points[0], points[1], t);
        basePoint.x += (Math.random() - 0.5) * 1.5;
        basePoint.z += (Math.random() - 0.5) * 1.5;
        fullPoints.push(basePoint);
      }
      fullPoints.push(points[1]);

      const geo = new THREE.BufferGeometry().setFromPoints(fullPoints);
      const mat = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 3 });
      const line = new THREE.Line(geo, mat);
      scene.add(line);

      this.lightningBolts.push({ line, age: 0, lifetime: 0.15 });

      // Apply damage
      const died = target.takeDamage(this.damage);

      // Show damage number
      const pos = targetPos.clone();
      pos.y += 2;
      floatingText.spawn(this.damage.toString(), pos, '#ffff00');

      if (died) {
        return { died: true, enemy: target };
      }
    }
    return null;
  }

  destroy(scene) {
    super.destroy(scene);
    this.lightningBolts.forEach(bolt => {
      scene.remove(bolt.line);
      bolt.line.geometry.dispose();
      bolt.line.material.dispose();
    });
    this.lightningBolts = [];
  }
}

// ============================================================================
// SKILL MANAGER
// ============================================================================
class SkillManager {
  constructor() {
    this.skills = {};
  }

  addSkill(skillType, scene, player) {
    if (this.skills[skillType]) {
      this.skills[skillType].upgrade();
    } else {
      let skill;
      if (skillType === 'orbital') skill = new OrbitalShield();
      else if (skillType === 'thunder') skill = new ThunderStrike();
      if (skill) {
        skill.start(scene, player);
        this.skills[skillType] = skill;
      }
    }
  }

  hasSkill(skillType) {
    return !!this.skills[skillType];
  }

  getSkill(skillType) {
    return this.skills[skillType];
  }

  getActiveSkills() {
    return Object.values(this.skills);
  }

  update(dt, scene, player, enemies, floatingText) {
    const results = [];
    for (const skill of Object.values(this.skills)) {
      const result = skill.update(dt, scene, player, enemies, floatingText);
      if (result) results.push(result);
    }
    return results;
  }

  destroy(scene) {
    for (const skill of Object.values(this.skills)) {
      skill.destroy(scene);
    }
    this.skills = {};
  }
}

// ============================================================================
// PLAYER CLASS
// ============================================================================
class Player {
  constructor(scene, inputManager) {
    this.scene = scene;
    this.inputManager = inputManager;
    this.mesh = null;
    this.inputVector = new THREE.Vector3();

    this.maxHealth = 100;
    this.currentHealth = 100;
    this.healthRegen = 0.5;

    this.level = 1;
    this.currentXp = 0;
    this.xpToNextLevel = 20;
    this.xpScaling = 1.5;

    this.moveSpeed = 8;

    this.weapons = { pistol: new Weapon('pistol'), shotgun: null };
    this.activeWeapon = this.weapons.pistol;
    this.fireTimer = 0;

    this.skillManager = new SkillManager();

    this.projectiles = null;
    this.enemies = null;
    this.gameManager = null;
  }

  start() {
    const geo = new THREE.CapsuleGeometry(0.5, 1, 8, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x001133, metalness: 0.3, roughness: 0.4 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = 1;
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);
  }

  setProjectilesArray(p) { this.projectiles = p; }
  setEnemiesArray(e) { this.enemies = e; }
  setGameManager(gm) { this.gameManager = gm; }

  update(dt) {
    this.handleMovement(dt);
    this.handleShooting(dt);
    this.handleRegen(dt);
  }

  handleMovement(dt) {
    const move = this.inputManager.getMovementVector();
    this.inputVector.set(move.x, 0, move.z);
    if (this.inputVector.length() > 0) this.inputVector.normalize();
    this.mesh.position.x += this.inputVector.x * this.moveSpeed * dt;
    this.mesh.position.z += this.inputVector.z * this.moveSpeed * dt;
  }

  handleShooting(dt) {
    this.fireTimer += dt;
    if (this.fireTimer < this.activeWeapon.fireRate) return;
    if (!this.enemies || this.enemies.length === 0) return;

    const closest = this.findClosestEnemy();
    if (!closest) return;

    const dist = this.mesh.position.distanceTo(closest.getPosition());
    if (dist > this.activeWeapon.range) return;

    this.fireTimer = 0;
    this.activeWeapon.fire(this.scene, this.mesh.position, closest.getPosition(), this.projectiles);
    if (this.gameManager?.soundManager) {
      this.gameManager.soundManager.init();
      this.gameManager.soundManager.playShoot();
    }
  }

  handleRegen(dt) {
    if (this.currentHealth < this.maxHealth) {
      this.currentHealth = Math.min(this.currentHealth + this.healthRegen * dt, this.maxHealth);
    }
  }

  findClosestEnemy() {
    let closest = null, minDist = Infinity;
    for (const e of this.enemies) {
      const d = this.mesh.position.distanceTo(e.getPosition());
      if (d < minDist) { minDist = d; closest = e; }
    }
    return closest;
  }

  takeDamage(amt) { this.currentHealth -= amt; return this.currentHealth <= 0; }
  heal(amt) { this.currentHealth = Math.min(this.currentHealth + amt, this.maxHealth); }
  healPercent(pct) { this.heal(this.maxHealth * pct / 100); }

  gainXp(amt) {
    this.currentXp += amt;
    if (this.currentXp >= this.xpToNextLevel) {
      this.currentXp -= this.xpToNextLevel;
      this.level++;
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * this.xpScaling);
      if (this.gameManager) this.gameManager.triggerLevelUp();
    }
  }

  upgradePistol() { this.weapons.pistol.upgrade(); }
  upgradeShotgun() {
    if (!this.weapons.shotgun) { this.weapons.shotgun = new Weapon('shotgun'); this.activeWeapon = this.weapons.shotgun; }
    else this.weapons.shotgun.upgrade();
  }
  hasShotgun() { return !!this.weapons.shotgun; }
  getActiveWeapon() { return this.activeWeapon; }
  switchWeapon(type) {
    if (type === 'pistol') this.activeWeapon = this.weapons.pistol;
    else if (type === 'shotgun' && this.weapons.shotgun) this.activeWeapon = this.weapons.shotgun;
  }

  addSkill(type) { this.skillManager.addSkill(type, this.scene, this); }
  hasSkill(type) { return this.skillManager.hasSkill(type); }
  getSkillManager() { return this.skillManager; }

  getPosition() { return this.mesh.position; }
  getLevel() { return this.level; }
  getCurrentXp() { return this.currentXp; }
  getXpToNextLevel() { return this.xpToNextLevel; }
  getCurrentHealth() { return this.currentHealth; }
  getMaxHealth() { return this.maxHealth; }
}

// ============================================================================
// ENEMY TYPES & ENEMY CLASS
// ============================================================================
const ENEMY_TYPES = {
  normal: { color: 0xff0000, emissive: 0x330000, scale: 1, speed: 3, health: 3, contactDamage: 10, xpValue: 10, weight: 70 },
  runner: { color: 0xff8800, emissive: 0x442200, scale: 0.7, speed: 6, health: 1, contactDamage: 5, xpValue: 8, weight: 20 },
  tank: { color: 0x9900ff, emissive: 0x220044, scale: 1.5, speed: 1.5, health: 10, contactDamage: 20, xpValue: 25, weight: 10 }
};

class Enemy {
  constructor(scene, target, type = 'normal') {
    this.scene = scene; this.target = target; this.mesh = null; this.material = null;
    this.direction = new THREE.Vector3(); this.isDestroyed = false;

    const cfg = ENEMY_TYPES[type];
    this.type = type; this.color = cfg.color; this.originalColor = cfg.color;
    this.emissiveColor = cfg.emissive; this.scale = cfg.scale; this.speed = cfg.speed;
    this.maxHealth = cfg.health; this.health = cfg.health;
    this.contactDamage = cfg.contactDamage; this.xpValue = cfg.xpValue;

    this.isFlashing = false; this.flashTimer = 0; this.flashDuration = 0.1;
  }

  start(pos, healthMult = 1) {
    this.maxHealth = Math.floor(this.maxHealth * healthMult);
    this.health = this.maxHealth;
    const size = this.scale;
    const geo = new THREE.BoxGeometry(size, size, size);
    this.material = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.emissiveColor,
      emissiveIntensity: 0.3,
      roughness: 0.6,
      metalness: 0.2
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.copy(pos); this.mesh.position.y = size / 2;
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);
  }

  update(dt) {
    if (this.isDestroyed) return;
    if (this.isFlashing) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.isFlashing = false;
        this.material.color.setHex(this.originalColor);
        this.material.emissive.setHex(this.emissiveColor);
        this.material.emissiveIntensity = 0.3;
      }
    }
    this.direction.subVectors(this.target.getPosition(), this.mesh.position);
    this.direction.y = 0; this.direction.normalize();
    this.mesh.position.x += this.direction.x * this.speed * dt;
    this.mesh.position.z += this.direction.z * this.speed * dt;
    this.mesh.lookAt(this.target.getPosition().x, this.mesh.position.y, this.target.getPosition().z);
  }

  takeDamage(amt) {
    this.health -= amt;
    this.isFlashing = true; this.flashTimer = this.flashDuration;
    this.material.color.setHex(0xffffff);
    this.material.emissive.setHex(0xffffff);
    this.material.emissiveIntensity = 3.0;
    return this.health <= 0;
  }

  getPosition() { return this.mesh.position; }
  getColor() { return this.originalColor; }
  getContactDamage() { return this.contactDamage; }
  getXpValue() { return this.xpValue; }

  destroy() {
    this.isDestroyed = true;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose(); this.material.dispose();
  }
}

// ============================================================================
// BOSS CLASS - The Cube King
// ============================================================================
class Boss {
  constructor(scene, target) {
    this.scene = scene;
    this.target = target;
    this.mesh = null;
    this.material = null;
    this.direction = new THREE.Vector3();
    this.isDestroyed = false;
    this.isBoss = true;

    this.name = 'The Cube King';
    this.maxHealth = 5000;
    this.health = 5000;
    this.speed = 1.5;
    this.scale = 4.0;
    this.contactDamage = 50;
    this.xpValue = 500;
    this.color = 0xffd700;
    this.emissiveColor = 0xaa8800;

    this.isFlashing = false;
    this.flashTimer = 0;
    this.flashDuration = 0.15;
  }

  start(pos) {
    const size = this.scale;
    const geo = new THREE.BoxGeometry(size, size, size);
    this.material = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.emissiveColor,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.8
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.copy(pos);
    this.mesh.position.y = size / 2;
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);
  }

  update(dt) {
    if (this.isDestroyed) return;

    // Flash effect
    if (this.isFlashing) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.isFlashing = false;
        this.material.color.setHex(this.color);
        this.material.emissive.setHex(this.emissiveColor);
        this.material.emissiveIntensity = 1.5;
      }
    }

    // Move towards player
    this.direction.subVectors(this.target.getPosition(), this.mesh.position);
    this.direction.y = 0;
    this.direction.normalize();
    this.mesh.position.x += this.direction.x * this.speed * dt;
    this.mesh.position.z += this.direction.z * this.speed * dt;

    // Rotate menacingly
    this.mesh.rotation.y += dt * 0.5;
  }

  takeDamage(amt) {
    this.health -= amt;
    this.isFlashing = true;
    this.flashTimer = this.flashDuration;
    this.material.color.setHex(0xffffff);
    this.material.emissive.setHex(0xffffff);
    this.material.emissiveIntensity = 4.0;
    return this.health <= 0;
  }

  getPosition() { return this.mesh.position; }
  getColor() { return this.color; }
  getContactDamage() { return this.contactDamage; }
  getXpValue() { return this.xpValue; }
  getHealthPercent() { return this.health / this.maxHealth; }
  getName() { return this.name; }

  destroy() {
    this.isDestroyed = true;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

// ============================================================================
// WAVE MANAGER & ENEMY SPAWNER
// ============================================================================
class WaveManager {
  constructor() {
    this.gameTime = 0; this.healthMult = 1; this.spawnMult = 1;
  }

  update(dt) {
    this.gameTime += dt;
    this.healthMult = 1 + Math.floor(this.gameTime / 60) * 0.5;
    this.spawnMult = Math.max(0.3, 1 - Math.floor(this.gameTime / 30) * 0.1);
  }

  getGameTime() { return this.gameTime; }
  getHealthMult() { return this.healthMult; }
  getSpawnMult() { return this.spawnMult; }
}

class EnemySpawner {
  constructor(scene, player, waveManager) {
    this.scene = scene; this.player = player; this.waveManager = waveManager;
    this.enemies = []; this.baseInterval = 0.8; this.timer = 0; this.spawnDist = 20;
    this.totalWeight = Object.values(ENEMY_TYPES).reduce((s, t) => s + t.weight, 0);
  }

  update(dt) {
    const interval = this.baseInterval * this.waveManager.getSpawnMult();
    this.timer += dt;
    if (this.timer >= interval) { this.timer = 0; this.spawn(); }
    this.enemies.forEach(e => e.update(dt));
  }

  selectType() {
    let roll = Math.random() * this.totalWeight, cum = 0;
    for (const [type, cfg] of Object.entries(ENEMY_TYPES)) {
      cum += cfg.weight;
      if (roll < cum) return type;
    }
    return 'normal';
  }

  spawn() {
    const type = this.selectType();
    const e = new Enemy(this.scene, this.player, type);
    const angle = Math.random() * Math.PI * 2;
    const pos = new THREE.Vector3(
      this.player.getPosition().x + Math.cos(angle) * this.spawnDist,
      0,
      this.player.getPosition().z + Math.sin(angle) * this.spawnDist
    );
    e.start(pos, this.waveManager.getHealthMult());
    this.enemies.push(e);
  }

  removeEnemy(e) {
    const idx = this.enemies.indexOf(e);
    if (idx > -1) { e.destroy(); this.enemies.splice(idx, 1); }
  }

  getEnemies() { return this.enemies; }
}

// ============================================================================
// CAMERA CONTROLLER
// ============================================================================
class CameraController {
  constructor(camera, target) {
    this.camera = camera; this.target = target;
    this.offset = new THREE.Vector3(15, 20, 15); this.smooth = 5;
  }

  update(dt) {
    const targetPos = this.target.getPosition().clone().add(this.offset);
    this.camera.position.lerp(targetPos, this.smooth * dt);
    this.camera.lookAt(this.target.getPosition());
  }
}

// ============================================================================
// GAME MANAGER
// ============================================================================
class GameManager {
  constructor() {
    this.scene = null; this.camera = null; this.renderer = null;
    this.composer = null;
    this.time = null; this.inputManager = null; this.uiManager = null;
    this.particleSystem = null; this.waveManager = null; this.floatingTextManager = null;
    this.soundManager = null;
    this.player = null; this.enemySpawner = null; this.cameraController = null;
    this.projectiles = []; this.experienceGems = [];
    this.isGameOver = false; this.isPaused = false; this.animationId = null;
    this.collisionDist = 1.2; this.projectileHitDist = 1.0; this.gemCollectDist = 0.8;
    this.contactDmgTimer = 0; this.contactDmgInterval = 0.5;

    // Boss state
    this.boss = null;
    this.bossSpawned = false;
    this.bossSpawnTime = 60; // Spawn boss at 60 seconds
    this.isVictory = false;
    this.slowMoScale = 1.0;
    this.slowMoTimer = 0;
  }

  awake() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);
    this.scene.fog = new THREE.Fog(0x050505, 30, 80);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(15, 20, 15);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });

    // Enhanced directional light with shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(10, 30, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    this.scene.add(dirLight);
    this.scene.add(new THREE.AmbientLight(0x404060, 0.4));

    // Tron-style procedural grid floor
    const gridSize = 200;
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    const cellSize = 32;
    for (let i = 0; i <= 512; i += cellSize) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    ctx.strokeStyle = '#0088aa';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += cellSize * 4) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
    const gridTexture = new THREE.CanvasTexture(canvas);
    gridTexture.wrapS = gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(gridSize / 10, gridSize / 10);

    const groundGeo = new THREE.PlaneGeometry(gridSize, gridSize);
    const groundMat = new THREE.MeshStandardMaterial({
      map: gridTexture, roughness: 0.9, metalness: 0.1,
      emissive: 0x001111, emissiveIntensity: 0.2
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Post-processing with Bloom
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,  // strength
      0.4,  // radius
      0.1   // threshold
    );
    this.composer.addPass(bloomPass);

    this.time = new Time();
    this.inputManager = new InputManager();
    this.uiManager = new UIManager();
    this.particleSystem = new ParticleSystem(this.scene);
    this.waveManager = new WaveManager();
    this.floatingTextManager = new FloatingTextManager();
    this.soundManager = new SoundManager();
  }

  start() {
    this.uiManager.start();
    this.player = new Player(this.scene, this.inputManager);
    this.player.start();
    this.player.setGameManager(this);

    this.enemySpawner = new EnemySpawner(this.scene, this.player, this.waveManager);
    this.player.setProjectilesArray(this.projectiles);
    this.player.setEnemiesArray(this.enemySpawner.getEnemies());

    this.cameraController = new CameraController(this.camera, this.player);

    this.uiManager.updateXpBar(0, this.player.getXpToNextLevel());
    this.uiManager.updateHealthBar(this.player.getCurrentHealth(), this.player.getMaxHealth());
    this.updateWeaponUI();
    this.updateSkillsUI();
    this.createMuteButton();
  }

  createMuteButton() {
    const btn = document.createElement('button');
    btn.id = 'mute-btn';
    btn.textContent = '🔊';
    btn.style.cssText = `position:fixed;top:80px;right:20px;width:50px;height:50px;font-size:24px;border:none;border-radius:50%;background:rgba(0,0,0,0.6);color:white;cursor:pointer;z-index:1000;transition:all 0.2s;pointer-events:auto;`;
    btn.onclick = () => {
      this.soundManager.init();
      const muted = this.soundManager.toggleMute();
      btn.textContent = muted ? '🔇' : '🔊';
      btn.style.opacity = muted ? '0.5' : '1';
    };
    document.body.appendChild(btn);
  }

  updateWeaponUI() {
    const w = this.player.getActiveWeapon();
    this.uiManager.updateWeaponDisplay(w.name, w.level);
  }

  updateSkillsUI() {
    const skills = this.player.getSkillManager().getActiveSkills();
    this.uiManager.updateSkillsDisplay(skills);
  }

  update() {
    const dt = this.time.deltaTime;

    this.waveManager.update(dt);
    this.uiManager.updateTimer(this.waveManager.getGameTime());

    this.player.update(dt);
    this.enemySpawner.update(dt);

    // Update skills
    const skillResults = this.player.getSkillManager().update(
      dt, this.scene, this.player, this.enemySpawner.getEnemies(), this.floatingTextManager
    );
    for (const result of skillResults) {
      if (result?.died) {
        const e = result.enemy;
        const pos = e.getPosition().clone();
        const color = e.getColor();
        const xp = e.getXpValue();
        this.enemySpawner.removeEnemy(e);
        this.uiManager.updateScore(10);
        this.particleSystem.spawnExplosion(pos, color, 6);
        this.spawnGem(pos, xp);
        this.soundManager.playExplosion();
      }
    }

    this.updateProjectiles(dt);
    this.updateGems(dt);
    this.particleSystem.update(dt);
    this.floatingTextManager.update(dt, this.camera);
    this.cameraController.update(dt);

    // Boss spawn check
    if (!this.bossSpawned && this.waveManager.getGameTime() >= this.bossSpawnTime) {
      this.spawnBoss();
    }

    // Update boss
    if (this.boss && !this.boss.isDestroyed) {
      this.boss.update(dt * this.slowMoScale);
      this.uiManager.updateBossBar(this.boss.getHealthPercent());
      this.checkBossCollisions();
    }

    // Slow-mo timer
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= this.time.deltaTime;
      if (this.slowMoTimer <= 0) {
        this.slowMoScale = 1.0;
        this.showVictoryScreen();
      }
    }

    this.checkPlayerEnemyCollisions(dt);
    this.checkProjectileEnemyCollisions();
    this.checkGemCollections();

    this.uiManager.updateXpBar(this.player.getCurrentXp(), this.player.getXpToNextLevel());
    this.uiManager.updateHealthBar(this.player.getCurrentHealth(), this.player.getMaxHealth());
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(dt);
      if (this.projectiles[i].isDestroyed) {
        this.projectiles[i].destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateGems(dt) {
    const pPos = this.player.getPosition();
    for (let i = this.experienceGems.length - 1; i >= 0; i--) {
      this.experienceGems[i].update(dt, pPos);
      if (this.experienceGems[i].isCollected) {
        this.experienceGems[i].destroy();
        this.experienceGems.splice(i, 1);
      }
    }
  }

  checkPlayerEnemyCollisions(dt) {
    const pPos = this.player.getPosition();
    const enemies = this.enemySpawner.getEnemies();
    this.contactDmgTimer += dt;
    let inContact = false, totalDmg = 0;
    for (const e of enemies) {
      if (pPos.distanceTo(e.getPosition()) < this.collisionDist) {
        inContact = true; totalDmg += e.getContactDamage();
      }
    }
    if (inContact && this.contactDmgTimer >= this.contactDmgInterval) {
      this.contactDmgTimer = 0;
      if (this.player.takeDamage(totalDmg)) this.gameOver();
    }
  }

  checkProjectileEnemyCollisions() {
    const enemies = this.enemySpawner.getEnemies();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.isDestroyed) continue;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (e.isDestroyed) continue;
        if (p.getPosition().distanceTo(e.getPosition()) < this.projectileHitDist) {
          const dmg = p.getDamage();
          const died = e.takeDamage(dmg);
          const pos = e.getPosition().clone(); pos.y += 1.5;
          this.floatingTextManager.spawn(Math.round(dmg).toString(), pos, died ? '#ff4444' : '#ffff00');
          const deathPos = e.getPosition().clone();
          const color = e.getColor();
          p.destroy(); this.projectiles.splice(i, 1);
          if (died) {
            const xp = e.getXpValue();
            this.enemySpawner.removeEnemy(e);
            this.uiManager.updateScore(10);
            this.particleSystem.spawnExplosion(deathPos, color, 6);
            this.spawnGem(deathPos, xp);
            this.soundManager.playExplosion();
          } else {
            this.soundManager.playHit();
          }
          break;
        }
      }
    }
  }

  spawnGem(pos, xp = 10) {
    const g = new ExperienceGem(this.scene);
    g.xpValue = xp; g.start(pos);
    this.experienceGems.push(g);
  }

  checkGemCollections() {
    const pPos = this.player.getPosition();
    for (const g of this.experienceGems) {
      if (!g.isCollected && pPos.distanceTo(g.getPosition()) < this.gemCollectDist) {
        g.collect();
        this.player.gainXp(g.xpValue);
      }
    }
  }

  triggerLevelUp() {
    this.isPaused = true;
    this.uiManager.updateLevel(this.player.getLevel());
    this.soundManager.playLevelUp();
    const upgrades = this.generateUpgrades();
    this.uiManager.showLevelUpMenu(upgrades, (id) => {
      this.applyUpgrade(id);
      this.updateWeaponUI();
      this.updateSkillsUI();
      this.isPaused = false;
    });
  }

  generateUpgrades() {
    const opts = [];

    // Pistol
    const pistol = this.player.weapons.pistol;
    opts.push({ id: 'pistol', label: '🔫 Mejorar Pistola', desc: `Lv.${pistol.level}→${pistol.level + 1}`, class: 'pistol' });

    // Shotgun
    if (this.player.hasShotgun()) {
      const sg = this.player.weapons.shotgun;
      opts.push({ id: 'shotgun', label: '💥 Mejorar Escopeta', desc: `Lv.${sg.level}→${sg.level + 1}`, class: 'shotgun' });
    } else {
      opts.push({ id: 'shotgun', label: '💥 Equipar Escopeta', desc: '3 balas en arco', class: 'shotgun' });
    }

    // Orbital Shield
    if (this.player.hasSkill('orbital')) {
      const sk = this.player.getSkillManager().getSkill('orbital');
      opts.push({ id: 'orbital', label: '🛡️ Mejorar Orbital', desc: `Lv.${sk.level}→${sk.level + 1}`, class: 'orbital' });
    } else {
      opts.push({ id: 'orbital', label: '🛡️ Orbital Shield', desc: 'Esferas giratorias', class: 'orbital' });
    }

    // Thunder Strike
    if (this.player.hasSkill('thunder')) {
      const sk = this.player.getSkillManager().getSkill('thunder');
      opts.push({ id: 'thunder', label: '⚡ Mejorar Rayo', desc: `Lv.${sk.level}→${sk.level + 1}`, class: 'thunder' });
    } else {
      opts.push({ id: 'thunder', label: '⚡ Thunder Strike', desc: 'Rayo cada 3s', class: 'thunder' });
    }

    // Heal
    opts.push({ id: 'heal', label: '💖 Curar Vida', desc: 'Recupera 50% HP', class: 'heal' });

    // Return 4 random options
    return opts.sort(() => 0.5 - Math.random()).slice(0, 4);
  }

  applyUpgrade(id) {
    switch (id) {
      case 'pistol': this.player.upgradePistol(); this.player.switchWeapon('pistol'); break;
      case 'shotgun': this.player.upgradeShotgun(); this.player.switchWeapon('shotgun'); break;
      case 'orbital': this.player.addSkill('orbital'); break;
      case 'thunder': this.player.addSkill('thunder'); break;
      case 'heal': this.player.healPercent(50); break;
    }
  }

  gameOver() {
    this.isGameOver = true;
    this.isPaused = true;
    this.player.getSkillManager().destroy(this.scene);
    this.soundManager.playGameOver();

    this.uiManager.showGameOver(
      this.waveManager.getGameTime(),
      this.player.getLevel(),
      this.uiManager.getKills(),
      this.uiManager.getScore(),
      () => this.restart()
    );
  }

  restart() {
    // Clear all entities
    for (const p of this.projectiles) p.destroy();
    this.projectiles.length = 0;

    for (const g of this.experienceGems) g.destroy();
    this.experienceGems.length = 0;

    for (const e of [...this.enemySpawner.getEnemies()]) this.enemySpawner.removeEnemy(e);

    // Reset player
    this.scene.remove(this.player.mesh);
    this.player.mesh.geometry.dispose();
    this.player.mesh.material.dispose();

    this.player = new Player(this.scene, this.inputManager);
    this.player.start();
    this.player.setGameManager(this);
    this.player.setProjectilesArray(this.projectiles);
    this.player.setEnemiesArray(this.enemySpawner.getEnemies());

    // Reset spawner reference
    this.enemySpawner.player = this.player;
    this.enemySpawner.timer = 0;

    // Reset wave manager
    this.waveManager.gameTime = 0;
    this.waveManager.healthMult = 1;
    this.waveManager.spawnMult = 1;

    // Reset camera
    this.cameraController.target = this.player;

    // Reset UI
    this.uiManager.reset();
    this.uiManager.hideGameOver();
    this.updateWeaponUI();
    this.updateSkillsUI();

    // Reset state
    this.contactDmgTimer = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.isVictory = false;

    // Reset boss state
    if (this.boss) {
      this.boss.destroy();
      this.boss = null;
    }
    this.bossSpawned = false;
    this.slowMoScale = 1.0;
    this.slowMoTimer = 0;

    // Restart animation loop
    this.animate();
  }

  spawnBoss() {
    this.bossSpawned = true;

    // Alert!
    this.soundManager.init();
    this.soundManager.playBossAlert();
    this.uiManager.showWarning('⚠️ WARNING: BOSS APPROACHING ⚠️');

    // Spawn boss far from player
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 35;
    const pos = new THREE.Vector3(
      this.player.getPosition().x + Math.cos(angle) * spawnDist,
      0,
      this.player.getPosition().z + Math.sin(angle) * spawnDist
    );

    this.boss = new Boss(this.scene, this.player);
    this.boss.start(pos);

    // Show boss HP bar
    this.uiManager.showBossBar(this.boss.getName());
  }

  checkBossCollisions() {
    if (!this.boss || this.boss.isDestroyed) return;

    const bossPos = this.boss.getPosition();
    const pPos = this.player.getPosition();

    // Check player collision with boss (larger hitbox)
    if (pPos.distanceTo(bossPos) < 3.0) {
      this.contactDmgTimer += this.time.deltaTime;
      if (this.contactDmgTimer >= this.contactDmgInterval) {
        this.contactDmgTimer = 0;
        if (this.player.takeDamage(this.boss.getContactDamage())) {
          this.gameOver();
        }
      }
    }

    // Check projectile collisions with boss
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.isDestroyed) continue;

      if (p.getPosition().distanceTo(bossPos) < 3.0) {
        const dmg = p.getDamage();
        const died = this.boss.takeDamage(dmg);

        const pos = bossPos.clone();
        pos.y += 3;
        this.floatingTextManager.spawn(Math.round(dmg).toString(), pos, died ? '#ffd700' : '#ffff00');
        this.soundManager.playHit();

        p.destroy();
        this.projectiles.splice(i, 1);

        if (died) {
          this.triggerVictory();
          break;
        }
      }
    }
  }

  triggerVictory() {
    this.isVictory = true;
    this.slowMoScale = 0.2;
    this.slowMoTimer = 3.0;

    // Massive golden explosion
    const pos = this.boss.getPosition().clone();
    for (let i = 0; i < 30; i++) {
      this.particleSystem.spawnExplosion(pos, 0xffd700, 6);
    }

    this.soundManager.playVictory();
    this.uiManager.hideBossBar();

    // Give XP
    this.player.gainXp(this.boss.getXpValue());
    this.uiManager.updateScore(1000);

    this.boss.destroy();
  }

  showVictoryScreen() {
    this.isPaused = true;
    this.player.getSkillManager().destroy(this.scene);

    this.uiManager.showVictory(
      this.waveManager.getGameTime(),
      this.player.getLevel(),
      this.uiManager.getKills(),
      this.uiManager.getScore(),
      () => this.restart()
    );
  }

  animate() {
    if (this.isGameOver && !this.isVictory) return;
    this.animationId = requestAnimationFrame(() => this.animate());
    this.time.update();
    if (!this.isPaused) this.update();
    this.composer.render();
  }

  run() { this.awake(); this.start(); this.animate(); }
}

// ============================================================================
// INIT
// ============================================================================
const game = new GameManager();
game.run();
