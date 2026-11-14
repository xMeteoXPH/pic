// ─────────────────────────────────────────────────────────
//  Photo Booth App  —  Solo + Together (WebRTC via PeerJS)
// ─────────────────────────────────────────────────────────

// ── Debug Logger for Mobile ──────────────────────────────
const debugLog = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function addDebugLog(msg, type = 'log') {
  try {
    const panel = document.getElementById('debugPanel');
    const log = document.getElementById('debugLog');
    if (panel && log) {
      panel.style.display = 'block';
      const color = type === 'error' ? '#f00' : type === 'warn' ? '#ff0' : '#0f0';
      const time = new Date().toLocaleTimeString();
      log.innerHTML += `<div style="color:${color};margin:2px 0;">[${time}] ${msg}</div>`;
      log.scrollTop = log.scrollHeight;
    }
  } catch (e) {
    // Silently fail if DOM not ready
  }
}

console.log = function(...args) {
  originalConsoleLog.apply(console, args);
  addDebugLog(args.join(' '), 'log');
};

console.error = function(...args) {
  originalConsoleError.apply(console, args);
  addDebugLog('❌ ' + args.join(' '), 'error');
};

console.warn = function(...args) {
  originalConsoleWarn.apply(console, args);
  addDebugLog('⚠️ ' + args.join(' '), 'warn');
};

// ── Constants ──────────────────────────────────────────
const PHOTO_COUNT      = 4;
const COUNTDOWN_SEC    = 3;
const BETWEEN_SHOTS_MS = 900;
// High quality for printing: 2" x 2" at 300 DPI = 600x600 pixels
const PHOTO_W          = 600;
const PHOTO_H          = 600;
const PADDING          = 40;
const STRIP_W          = PHOTO_W + PADDING * 2;
// Together mode: 1.5" x 1.5" each at 300 DPI = 450x450 pixels
const TOG_PW           = 450;
const TOG_PH           = 450;
const TOG_SW           = TOG_PW * 2 + PADDING * 3;

// ── State ───────────────────────────────────────────────
const state = {
  mode: 'solo', stream: null,
  photos: [], partnerPhotos: [],
  currentFilter: 'none',
  currentTheme: 'sakura',
  textColor: '#000000',  // Default black text
  shooting: false,
  peer: null, conn: null,
  isHost: false, partnerReady: false, roomCode: null,
};

// ── Element refs ────────────────────────────────────────
const video            = document.getElementById('video');
const videoMe          = document.getElementById('videoMe');
const captureCanvas    = document.getElementById('captureCanvas');
const capturePartner   = document.getElementById('captureCanvasPartner');
const stripCanvas      = document.getElementById('stripCanvas');
const countdown        = document.getElementById('countdown');
const countdownMe      = document.getElementById('countdownMe');
const countdownPartner = document.getElementById('countdownPartner');
const flash            = document.getElementById('flash');
const flashMe          = document.getElementById('flashMe');
const flashPartner     = document.getElementById('flashPartner');
const startBtn         = document.getElementById('startBtn');
const retakeBtn        = document.getElementById('retakeBtn');
const downloadBtn      = document.getElementById('downloadBtn');
const newBtn           = document.getElementById('newBtn');
const stripSection     = document.getElementById('stripSection');
const captionInput     = document.getElementById('captionInput');
const showDateChk      = document.getElementById('showDate');
const soloCamera       = document.getElementById('soloCamera');
const dualCamera       = document.getElementById('dualCamera');
const togetherPanel    = document.getElementById('togetherPanel');
const roomSetup        = document.getElementById('roomSetup');
const roomConnected    = document.getElementById('roomConnected');
const roomCodeDisplay  = document.getElementById('roomCodeDisplay');
const partnerStatus    = document.getElementById('partnerStatus');
const roomCodeInput    = document.getElementById('roomCodeInput');
const startHint        = document.getElementById('startHint');

captureCanvas.width  = PHOTO_W; captureCanvas.height = PHOTO_H;
capturePartner.width = PHOTO_W; capturePartner.height = PHOTO_H;

// ── Mode switching ───────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  document.getElementById('soloModeBtn').classList.toggle('active', mode === 'solo');
  document.getElementById('togetherModeBtn').classList.toggle('active', mode === 'together');
  togetherPanel.classList.toggle('hidden', mode === 'solo');
  soloCamera.classList.toggle('hidden', mode === 'together');
  dualCamera.classList.toggle('hidden', mode === 'solo');
  if (mode === 'together' && state.stream) videoMe.srcObject = state.stream;
  if (mode === 'solo' && state.stream) video.srcObject = state.stream;
  updateStartBtn();
}

function updateStartBtn() {
  if (state.mode === 'together') {
    startBtn.disabled = !state.partnerReady;
    startHint.textContent = state.partnerReady ? 'tap the button to start!' : 'waiting for partner...';
  } else {
    startBtn.disabled = false;
    startHint.textContent = 'tap the button to start!';
  }
}

// ── Camera init ─────────────────────────────────────────
async function initCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 1920, min: 1280 }, 
        height: { ideal: 1920, min: 1280 }, 
        facingMode: 'user' 
      },
      audio: false,
    });
    video.srcObject   = state.stream;
    videoMe.srcObject = state.stream;
  } catch (err) {
    showToast('⚠️ Camera error: ' + err.message);
  }
}

// ── Theme buttons ────────────────────────────────────────
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentTheme = btn.dataset.theme;
    rebuildIfReady();
  });
});

// ── Filter buttons ───────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentFilter = btn.dataset.filter;
    applyVideoFilter(state.currentFilter);
  });
});

function applyVideoFilter(f) {
  const val = f === 'none' ? '' : f;
  video.style.filter   = val;
  videoMe.style.filter = val;
}

// ── Color picker ─────────────────────────────────────────
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.textColor = btn.dataset.color;
    rebuildIfReady();
  });
});

document.getElementById('customColorPicker').addEventListener('input', (e) => {
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  state.textColor = e.target.value;
  rebuildIfReady();
});

// ── PeerJS ───────────────────────────────────────────────
function generateCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += c[Math.floor(Math.random() * c.length)];
  return code;
}

function createRoom() {
  state.isHost = true;
  state.roomCode = generateCode();
  state.peer = new Peer('photobooth-' + state.roomCode, { debug: 0 });
  state.peer.on('open', () => { showRoomConnected(state.roomCode); showToast('Room created! Share the code 💌'); });
  state.peer.on('connection', conn => { state.conn = conn; setupConnection(conn); });
  state.peer.on('error', e => {
    if (e.type === 'unavailable-id') { state.peer.destroy(); createRoom(); }
    else showToast('Error: ' + e.message);
  });
}

function joinRoom() {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code.length < 4) { showToast('Enter a valid room code'); return; }
  state.isHost = false; state.roomCode = code;
  state.peer = new Peer(undefined, { debug: 0 });
  state.peer.on('open', () => {
    const conn = state.peer.connect('photobooth-' + code, { reliable: true });
    state.conn = conn; setupConnection(conn); showRoomConnected(code);
    showToast('Connecting...');
  });
  state.peer.on('error', () => showToast('Could not connect. Check the code.'));
}

function setupConnection(conn) {
  conn.on('open', () => {
    state.partnerReady = true; setPartnerConnected(); updateStartBtn();
    showToast('💑 Partner connected!'); startVideoStream(conn);
  });
  conn.on('data', handleMessage);
  conn.on('close', () => {
    state.partnerReady = false; updateStartBtn(); setPartnerDisconnected();
    showToast('Partner disconnected 😢');
  });
}

let streamInterval = null;
function startVideoStream(conn) {
  if (streamInterval) clearInterval(streamInterval);
  const tmp = document.createElement('canvas');
  tmp.width = 240; tmp.height = 240;
  const tc = tmp.getContext('2d');
  streamInterval = setInterval(() => {
    if (!state.stream || !conn || !conn.open) return;
    tc.save(); tc.translate(240, 0); tc.scale(-1, 1);
    tc.filter = state.currentFilter === 'none' ? 'none' : state.currentFilter;
    tc.drawImage(videoMe, 0, 0, 240, 240);
    tc.restore();
    conn.send({ type: 'videoFrame', frame: tmp.toDataURL('image/jpeg', 0.3) });
  }, 80);
}

function handleMessage(data) {
  if (data.type === 'videoFrame') renderPartnerFrame(data.frame);
  else if (data.type === 'countdown') showCountdownBoth(data.number);
  else if (data.type === 'capture') capturePartnerFrame(data.index);
  else if (data.type === 'captureData') receivePartnerPhoto(data.index, data.photo);
  else if (data.type === 'flash') { triggerFlashEl(flashPartner); triggerFlashEl(flashMe); }
  else if (data.type === 'startShooting') startShootingAsGuest();
}

// ── Partner video canvas ─────────────────────────────────
(function patchPartnerVideo() {
  const canvas = document.createElement('canvas');
  canvas.width = 240; canvas.height = 240;
  canvas.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
  canvas.id = 'videoPartner';
  const ctx = canvas.getContext('2d');
  const wrapper = document.getElementById('partnerVideoWrapper');
  wrapper.replaceChild(canvas, document.getElementById('videoPartner'));
  let frame = null;
  canvas.setFrame = img => { frame = img; };
  (function loop() {
    if (frame) {
      ctx.drawImage(frame, 0, 0, 240, 240);
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, 240, 240);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = 'bold 13px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('waiting for partner ♡', 120, 120);
    }
    requestAnimationFrame(loop);
  })();
  canvas._setFrame = img => { frame = img; };
})();

function renderPartnerFrame(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const c = document.getElementById('videoPartner');
    if (c && c._setFrame) c._setFrame(img);
  };
  img.src = dataUrl;
}

// ── Partner status ───────────────────────────────────────
function showRoomConnected(code) {
  roomSetup.classList.add('hidden');
  roomConnected.classList.remove('hidden');
  roomCodeDisplay.textContent = code;
}
function setPartnerConnected() {
  partnerStatus.innerHTML = `<span class="dot connected"></span> Partner connected 💑`;
}
function setPartnerDisconnected() {
  partnerStatus.innerHTML = `<span class="dot waiting"></span> Waiting for partner...`;
}
function copyRoomCode() {
  navigator.clipboard.writeText(state.roomCode).then(() => showToast('Code copied! 📋'));
}

// ── Shot dots ────────────────────────────────────────────
function setDot(i, done) {
  const d = document.getElementById('dot' + i);
  if (done) d.classList.add('done'); else d.classList.remove('done');
}
function resetDots() { for (let i = 0; i < PHOTO_COUNT; i++) setDot(i, false); }

// ── Flash ────────────────────────────────────────────────
function triggerFlashEl(el) {
  el.classList.remove('hidden', 'go');
  void el.offsetWidth;
  el.classList.add('go');
  setTimeout(() => el.classList.add('hidden'), 500);
}
function triggerFlash() {
  if (state.mode === 'together') triggerFlashEl(flashMe);
  else triggerFlashEl(flash);
}

// ── Countdown ────────────────────────────────────────────
function showCountdownBoth(n) {
  const els = state.mode === 'together' ? [countdownMe, countdownPartner] : [countdown];
  els.forEach(el => {
    if (n === null) { el.classList.add('hidden'); el.textContent = ''; }
    else {
      el.classList.remove('hidden'); el.textContent = n;
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    }
  });
}

function runCountdown(sec) {
  return new Promise(resolve => {
    let r = sec;
    const tick = () => {
      if (r <= 0) { showCountdownBoth(null); resolve(); return; }
      showCountdownBoth(r);
      if (state.mode === 'together') send({ type: 'countdown', number: r });
      r--; setTimeout(tick, 1000);
    };
    tick();
  });
}

// ── Capture ──────────────────────────────────────────────
function captureMyFrame() {
  try {
    const sourceVideo = state.mode === 'together' ? videoMe : video;
    
    // Check if video is ready
    if (!sourceVideo || sourceVideo.readyState < 2) {
      console.error('Video not ready:', sourceVideo ? sourceVideo.readyState : 'no video');
      throw new Error('Video not ready for capture');
    }
    
    const ctx = captureCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get capture canvas context');
    }
    
    // Clear canvas first
    ctx.clearRect(0, 0, PHOTO_W, PHOTO_H);
    
    ctx.save(); 
    ctx.translate(PHOTO_W, 0); 
    ctx.scale(-1, 1);
    ctx.filter = state.currentFilter === 'none' ? 'none' : state.currentFilter;
    ctx.drawImage(sourceVideo, 0, 0, PHOTO_W, PHOTO_H);
    ctx.restore();
    
    // Lower quality for mobile compatibility (0.85 instead of 0.92)
    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.92);
    
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('Failed to create image data');
    }
    
    console.log('Frame captured successfully, size:', dataUrl.length);
    return dataUrl;
  } catch (err) {
    console.error('Error in captureMyFrame:', err);
    throw err;
  }
}

function capturePartnerFrame(index) {
  const el = document.getElementById('videoPartner');
  const ctx = capturePartner.getContext('2d');
  ctx.drawImage(el, 0, 0, PHOTO_W, PHOTO_H);
  // Lower quality for mobile compatibility
  state.partnerPhotos[index] = capturePartner.toDataURL('image/jpeg', 0.85);
}

// Receive partner's high quality photo data
function receivePartnerPhoto(index, photoData) {
  console.log('Received partner photo', index, 'length:', photoData.length);
  state.partnerPhotos[index] = photoData;
}

// Guest device starts shooting when host triggers
async function startShootingAsGuest() {
  if (state.shooting) return;
  console.log('Guest device: Starting shoot sequence...');
  startShooting();
}

// ── Shoot sequence ───────────────────────────────────────

// ── Shoot sequence ───────────────────────────────────────
async function startShooting() {
  if (state.shooting) return;
  if (state.mode === 'together' && !state.partnerReady) { showToast('Waiting for partner 💌'); return; }
  state.shooting = true;
  state.photos = []; state.partnerPhotos = [];
  resetDots();
  startBtn.classList.add('hidden');
  retakeBtn.classList.add('hidden');
  stripSection.style.display = 'none';
  startHint.textContent = '';
  
  // Only host starts the sequence, guest will start when receiving startShooting message
  if (state.mode === 'together' && state.isHost) {
    send({ type: 'startShooting' });
  }

  console.log('Starting photo shoot...');

  for (let i = 0; i < PHOTO_COUNT; i++) {
    await runCountdown(COUNTDOWN_SEC);
    triggerFlash();
    if (state.mode === 'together') { 
      send({ type: 'flash' }); 
      triggerFlashEl(flashPartner); 
    }
    
    // Capture my own photo
    const photo = captureMyFrame();
    console.log('Photo', i+1, 'captured, length:', photo.length, 'starts with:', photo.substring(0, 30));
    state.photos.push(photo);
    
    // In together mode, send my photo to partner
    if (state.mode === 'together') { 
      console.log('Sending my photo', i, 'to partner...');
      send({ type: 'captureData', index: i, photo: photo });
    }
    
    setDot(i, true);
    if (i < PHOTO_COUNT - 1) await sleep(BETWEEN_SHOTS_MS);
  }

  console.log('All photos captured:', state.photos.length, 'photos');
  
  // Wait a bit for partner photos to arrive
  if (state.mode === 'together') {
    console.log('Waiting for partner photos...');
    showToast('⏳ Waiting for partner...');
    
    // Wait up to 5 seconds for all partner photos
    let waitTime = 0;
    while (state.partnerPhotos.length < PHOTO_COUNT && waitTime < 5000) {
      await sleep(100);
      waitTime += 100;
    }
    
    if (state.partnerPhotos.length === PHOTO_COUNT) {
      console.log('All partner photos received!');
    } else {
      console.warn('Only received', state.partnerPhotos.length, 'partner photos');
    }
  }
  
  state.shooting = false;
  showCountdownBoth(null);
  retakeBtn.classList.remove('hidden');
  startHint.textContent = '';
  
  // Show loading message
  showToast('✨ Creating your strip...');
  console.log('Starting strip build process...');
  
  // Direct simple build
  try {
    console.log('Step 1: Get theme info');
    const caption = captionInput.value.trim();
    const showDate = showDateChk.checked;
    
    // Define themes inline with professional decorations
    const themes = {
      'sakura': { 
        color: '#ffd6e7',
        draw: (ctx, w, h) => {
          // Multi-layer gradient
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#fff0f5');
          g.addColorStop(0.4, '#ffd6e7');
          g.addColorStop(1, '#ffb7c5');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          
          // Radial glow
          const glow = ctx.createRadialGradient(w*0.3, h*0.2, 0, w*0.3, h*0.2, w*0.6);
          glow.addColorStop(0, 'rgba(255,200,220,0.3)');
          glow.addColorStop(1, 'rgba(255,200,220,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, w, h);
          
          // Cherry blossom petals
          ctx.fillStyle = 'rgba(255,77,136,0.25)';
          for (let i = 0; i < 35; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 12 + (i % 4) * 6;
            // 5-petal flower
            for (let p = 0; p < 5; p++) {
              const angle = (Math.PI * 2 / 5) * p;
              ctx.beginPath();
              ctx.ellipse(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5, 
                          size * 0.35, size * 0.2, angle, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          
          // Elegant border
          ctx.strokeStyle = 'rgba(255,77,136,0.4)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255,77,136,0.2)';
          ctx.strokeRect(14, 14, w - 28, h - 28);
        }
      },
      'midnight-rose': { 
        color: '#2a0018',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#1a0010');
          g.addColorStop(0.5, '#3d0030');
          g.addColorStop(1, '#1a001a');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          
          // Glowing orbs
          [{x:0.2, y:0.2, r:0.4}, {x:0.8, y:0.65, r:0.45}].forEach(o => {
            const gl = ctx.createRadialGradient(o.x*w, o.y*h, 0, o.x*w, o.y*h, o.r*w);
            gl.addColorStop(0, 'rgba(180,0,80,0.18)');
            gl.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(0, 0, w, h);
          });
          
          // Roses pattern
          ctx.fillStyle = 'rgba(204,0,60,0.35)';
          for (let i = 0; i < 25; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 18 + (i % 3) * 8;
            // Rose spiral
            for (let r = 0; r < 3; r++) {
              ctx.beginPath();
              ctx.arc(x, y, size - r * 6, 0, Math.PI * 2);
              ctx.globalAlpha = 0.15 - r * 0.03;
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
          
          ctx.strokeStyle = 'rgba(204,0,60,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'cottagecore': { 
        color: '#fde8c8',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#fffbf0');
          g.addColorStop(0.5, '#fde8c8');
          g.addColorStop(1, '#f5d0a0');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          
          // Linen texture
          ctx.globalAlpha = 0.04;
          ctx.strokeStyle = '#c8a87a';
          ctx.lineWidth = 0.5;
          for (let i = 0; i < w; i += 4) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, h);
            ctx.stroke();
          }
          for (let i = 0; i < h; i += 4) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(w, i);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          
          // Wildflowers
          const colors = ['#e8765a', '#d45a3a', '#f29070'];
          for (let i = 0; i < 28; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 14 + (i % 3) * 6;
            const col = colors[i % 3];
            
            // Flower
            ctx.fillStyle = col;
            ctx.globalAlpha = 0.4;
            for (let p = 0; p < 6; p++) {
              const angle = (Math.PI * 2 / 6) * p;
              ctx.beginPath();
              ctx.arc(x + Math.cos(angle) * size * 0.4, y + Math.sin(angle) * size * 0.4, size * 0.3, 0, Math.PI * 2);
              ctx.fill();
            }
            // Center
            ctx.fillStyle = '#fef3c7';
            ctx.beginPath();
            ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          
          // Decorative border
          ctx.strokeStyle = 'rgba(200,120,58,0.5)';
          ctx.lineWidth = 3;
          ctx.strokeRect(8, 8, w - 16, h - 16);
          // Corner ornaments
          const corner = 25;
          ctx.lineWidth = 2;
          [[8,8], [w-8,8], [8,h-8], [w-8,h-8]].forEach(([cx, cy]) => {
            const xDir = cx < w/2 ? 1 : -1;
            const yDir = cy < h/2 ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(cx, cy + yDir * corner);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx + xDir * corner, cy);
            ctx.stroke();
          });
        }
      },
      'aurora': { 
        color: '#050a14',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#050a14');
          g.addColorStop(0.4, '#08122a');
          g.addColorStop(1, '#050a14');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          
          // Aurora bands
          [
            {color: 'rgba(0,255,180,0.2)', y: 0.15},
            {color: 'rgba(60,80,255,0.18)', y: 0.35},
            {color: 'rgba(0,200,255,0.2)', y: 0.58},
            {color: 'rgba(160,0,255,0.16)', y: 0.78}
          ].forEach(band => {
            const gg = ctx.createLinearGradient(0, band.y * h - 60, 0, band.y * h + 60);
            gg.addColorStop(0, 'rgba(0,0,0,0)');
            gg.addColorStop(0.5, band.color);
            gg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gg;
            ctx.fillRect(0, 0, w, h);
          });
          
          // Stars
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 120; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 0.5 + (i % 4) * 0.4;
            ctx.globalAlpha = 0.3 + (i % 5) * 0.14;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          
          // Gradient border
          const borderGrad = ctx.createLinearGradient(0, 0, w, h);
          borderGrad.addColorStop(0, 'rgba(0,255,180,0.5)');
          borderGrad.addColorStop(0.5, 'rgba(80,120,255,0.5)');
          borderGrad.addColorStop(1, 'rgba(160,0,255,0.5)');
          ctx.strokeStyle = borderGrad;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'golden-hour': { 
        color: '#ff9f1c',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#ff6b35');
          g.addColorStop(0.35, '#ff9f1c');
          g.addColorStop(0.7, '#ffcb47');
          g.addColorStop(1, '#ffe08a');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          
          // Sun glow
          const sun = ctx.createRadialGradient(w * 0.5, -h * 0.1, 0, w * 0.5, -h * 0.1, w * 0.75);
          sun.addColorStop(0, 'rgba(255,245,180,0.5)');
          sun.addColorStop(0.5, 'rgba(255,200,60,0.15)');
          sun.addColorStop(1, 'rgba(255,140,0,0)');
          ctx.fillStyle = sun;
          ctx.fillRect(0, 0, w, h);
          
          // Light rays
          ctx.globalAlpha = 0.08;
          ctx.strokeStyle = '#fff9e0';
          ctx.lineWidth = 3;
          for (let a = 0; a < 12; a++) {
            const angle = (a / 12) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(w * 0.5, 0);
            ctx.lineTo(w * 0.5 + Math.cos(angle) * w * 1.5, Math.sin(angle) * h * 1.5);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          
          // Bokeh circles
          for (let i = 0; i < 20; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 8 + (i % 5) * 7;
            ctx.strokeStyle = 'rgba(255,249,204,0.15)';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.08 + (i % 4) * 0.02;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          
          ctx.strokeStyle = 'rgba(255,107,53,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'lavender-dream': { 
        color: '#e9d5ff',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#f3e8ff');
          g.addColorStop(0.5, '#e9d5ff');
          g.addColorStop(1, '#c4b5fd');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          
          // Soft glows
          [{x:0.2,y:0.25,r:0.45,c:'rgba(167,139,250,0.2)'}, {x:0.8,y:0.7,r:0.5,c:'rgba(192,132,252,0.18)'}].forEach(o => {
            const gl = ctx.createRadialGradient(o.x*w, o.y*h, 0, o.x*w, o.y*h, o.r*w);
            gl.addColorStop(0, o.c);
            gl.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(0, 0, w, h);
          });
          
          // Sparkles and stars
          for (let i = 0; i < 30; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 6 + (i % 4) * 5;
            ctx.fillStyle = '#8b5cf6';
            ctx.globalAlpha = 0.35 + (i % 3) * 0.15;
            // 4-point star
            ctx.beginPath();
            for (let p = 0; p < 8; p++) {
              const angle = (Math.PI / 4) * p;
              const r = p % 2 === 0 ? size : size * 0.4;
              const px = x + Math.cos(angle) * r;
              const py = y + Math.sin(angle) * r;
              if (p === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          
          ctx.strokeStyle = 'rgba(139,92,246,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'neon-cyber': { 
        color: '#03001e',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#03001e');
          g.addColorStop(0.5, '#0a0030');
          g.addColorStop(1, '#03001e');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          
          // Grid
          ctx.strokeStyle = 'rgba(0,255,224,0.12)';
          ctx.lineWidth = 0.5;
          for (let x = 0; x < w; x += 25) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 0; y < h; y += 25) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
          
          // Glowing blobs
          [{x:0.2,y:0.25,c:'rgba(0,255,224,0.15)'}, {x:0.85,y:0.75,c:'rgba(255,0,128,0.15)'}].forEach(o => {
            const gl = ctx.createRadialGradient(o.x*w, o.y*h, 0, o.x*w, o.y*h, w*0.4);
            gl.addColorStop(0, o.c);
            gl.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(0, 0, w, h);
          });
          
          // Neon diamonds
          const colors = ['#00ffe0', '#ff0080', '#7700ff'];
          for (let i = 0; i < 20; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 5 + (i % 4) * 4;
            const col = colors[i % 3];
            ctx.fillStyle = col;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size * 0.6, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size * 0.6, y);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          
          // Gradient border
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(0,255,224,0.7)');
          borderG.addColorStop(0.5, 'rgba(255,0,128,0.7)');
          borderG.addColorStop(1, 'rgba(119,0,255,0.7)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'blue-sky': { 
        color: '#bae6fd',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#bae6fd');
          g.addColorStop(0.6, '#7dd3fc');
          g.addColorStop(1, '#38bdf8');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          
          // Sun
          const sun = ctx.createRadialGradient(w * 0.8, h * 0.08, 0, w * 0.8, h * 0.08, 70);
          sun.addColorStop(0, 'rgba(255,245,150,0.95)');
          sun.addColorStop(0.4, 'rgba(255,220,80,0.3)');
          sun.addColorStop(1, 'rgba(255,180,0,0)');
          ctx.fillStyle = sun;
          ctx.fillRect(0, 0, w, h);
          
          // Fluffy clouds
          const clouds = [[0.15,0.12,28], [0.55,0.08,24], [0.35,0.22,36], [0.75,0.18,20], 
                          [0.12,0.38,30], [0.88,0.45,26], [0.25,0.65,28], [0.7,0.7,24]];
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          clouds.forEach(([xf, yf, r]) => {
            const cx = xf * w;
            const cy = yf * h;
            [[-r*0.5,r*0.1], [0,-r*0.1], [r*0.5,r*0.1], [r*0.9,r*0.2], [-r*0.9,r*0.2], [0,r*0.25]].forEach(([dx, dy]) => {
              ctx.beginPath();
              ctx.arc(cx + dx, cy + dy, r * 0.45, 0, Math.PI * 2);
              ctx.fill();
            });
          });
          
          ctx.strokeStyle = 'rgba(14,165,233,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'forest-moss': { 
        color: '#dcfce7',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#f0fdf4');
          g.addColorStop(0.4, '#dcfce7');
          g.addColorStop(1, '#86efac');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 14; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 22 + i * 8;
            const gg = ctx.createRadialGradient(x, y, 0, x, y, size);
            gg.addColorStop(0, 'rgba(255,255,220,0.22)');
            gg.addColorStop(1, 'rgba(255,255,220,0)');
            ctx.fillStyle = gg;
            ctx.fillRect(0, 0, w, h);
          }
          for (let i = 0; i < 25; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 8 + (i % 4) * 5;
            ctx.fillStyle = '#4ade80';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.ellipse(x, y, size, size * 0.5, (i % 8) * Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(22,163,74,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'galaxy': { 
        color: '#0d0630',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#02011a');
          g.addColorStop(0.4, '#0d0630');
          g.addColorStop(1, '#1a0545');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          [{x:0.3,y:0.35,c:'rgba(80,0,160,0.28)'}, {x:0.7,y:0.6,c:'rgba(0,80,200,0.2)'}].forEach(o => {
            const gl = ctx.createRadialGradient(o.x*w, o.y*h, 0, o.x*w, o.y*h, w*0.48);
            gl.addColorStop(0, o.c);
            gl.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(0, 0, w, h);
          });
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 180; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 0.3 + (i % 5) * 0.3;
            ctx.globalAlpha = 0.2 + (i % 7) * 0.11;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          for (let i = 0; i < 15; i++) {
            const x = (i * 97.3) % w;
            const y = (i * 0.432 * h) % h;
            const size = 6 + (i % 3) * 4;
            ctx.fillStyle = '#e0d7ff';
            ctx.globalAlpha = 0.5;
            ctx.fillRect(x - size, y - 1, size * 2, 2);
            ctx.fillRect(x - 1, y - size, 2, size * 2);
          }
          ctx.globalAlpha = 1;
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(160,100,255,0.5)');
          borderG.addColorStop(1, 'rgba(60,0,200,0.5)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'retro-film': { 
        color: '#f0e8d0',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#f5efe0');
          g.addColorStop(1, '#e8d8b0');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const vig = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.85);
          vig.addColorStop(0, 'rgba(139,100,40,0)');
          vig.addColorStop(1, 'rgba(80,40,0,0.35)');
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(160,120,60,0.35)';
          for (let y = 24; y < h - 24; y += 32) {
            ctx.fillRect(5, y, 11, 18);
            ctx.fillRect(w - 16, y, 11, 18);
          }
          ctx.globalAlpha = 0.15;
          for (let i = 0; i < 200; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 1 + (i % 3) * 0.5;
            ctx.fillStyle = '#8b6a3a';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(139,106,58,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'y2k-holo': { 
        color: '#ffe0f7',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#ffe0f7');
          g.addColorStop(0.3, '#d0f0ff');
          g.addColorStop(0.6, '#e8d0ff');
          g.addColorStop(1, '#ffd0e8');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 12; i++) {
            const hue = i * 30;
            const gg = ctx.createLinearGradient(0, i * h / 12, w, (i + 1) * h / 12);
            gg.addColorStop(0, `hsla(${hue},100%,80%,0)`);
            gg.addColorStop(0.5, `hsla(${hue},100%,80%,0.12)`);
            gg.addColorStop(1, `hsla(${hue},100%,80%,0)`);
            ctx.fillStyle = gg;
            ctx.fillRect(0, 0, w, h);
          }
          for (let i = 0; i < 25; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 7 + (i % 4) * 4;
            const hue = (i * 60) % 360;
            ctx.fillStyle = `hsl(${hue},100%,70%)`;
            ctx.globalAlpha = 0.5;
            for (let p = 0; p < 8; p++) {
              const angle = (Math.PI / 4) * p;
              const r = p % 2 === 0 ? size : size * 0.35;
              const px = x + Math.cos(angle) * r;
              const py = y + Math.sin(angle) * r;
              ctx.beginPath();
              ctx.arc(px, py, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(255,100,200,0.6)');
          borderG.addColorStop(0.5, 'rgba(100,200,255,0.6)');
          borderG.addColorStop(1, 'rgba(200,100,255,0.6)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'dark-academia': { 
        color: '#2d1e0a',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#1a1208');
          g.addColorStop(0.5, '#2d1e0a');
          g.addColorStop(1, '#1a0f05');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const vig = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.8);
          vig.addColorStop(0, 'rgba(80,50,10,0)');
          vig.addColorStop(1, 'rgba(10,5,0,0.5)');
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = 'rgba(200,160,80,0.35)';
          ctx.lineWidth = 1.5;
          for (let x = 16; x < w - 16; x += 22) {
            ctx.beginPath();
            ctx.moveTo(x, 14);
            ctx.lineTo(x + 10, 26);
            ctx.lineTo(x, 38);
            ctx.lineTo(x - 10, 26);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, h - 38);
            ctx.lineTo(x + 10, h - 26);
            ctx.lineTo(x, h - 14);
            ctx.lineTo(x - 10, h - 26);
            ctx.closePath();
            ctx.stroke();
          }
          for (let y = 60; y < h - 60; y += 40) {
            ctx.beginPath();
            ctx.arc(20, y, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(w - 20, y, 5, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(200,160,80,0.4)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'winter-snow': { 
        color: '#e0f2fe',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#e0f2fe');
          g.addColorStop(0.5, '#f0f9ff');
          g.addColorStop(1, '#bae6fd');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const shimmer = ctx.createRadialGradient(w * 0.5, 0, 0, w * 0.5, 0, w * 0.75);
          shimmer.addColorStop(0, 'rgba(255,255,255,0.3)');
          shimmer.addColorStop(1, 'rgba(200,230,255,0)');
          ctx.fillStyle = shimmer;
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 35; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 6 + (i % 4) * 4;
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.4 + (i % 3) * 0.15;
            for (let a = 0; a < 6; a++) {
              const angle = (Math.PI / 3) * a;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
              ctx.stroke();
              const bx = x + Math.cos(angle) * size * 0.6;
              const by = y + Math.sin(angle) * size * 0.6;
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(angle + Math.PI / 6) * size * 0.3, by + Math.sin(angle + Math.PI / 6) * size * 0.3);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(angle - Math.PI / 6) * size * 0.3, by + Math.sin(angle - Math.PI / 6) * size * 0.3);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
          for (let i = 0; i < 60; i++) {
            const x = (i * 97.3) % w;
            const y = (i * 0.432 * h) % h;
            const size = 1 + (i % 4) * 1.2;
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.5 + (i % 4) * 0.12;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(56,189,248,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'velvet-night': { 
        color: '#0a0014',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#0a0014');
          g.addColorStop(0.4, '#1a0030');
          g.addColorStop(1, '#0a0014');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const glow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.85);
          glow.addColorStop(0, 'rgba(80,0,120,0.45)');
          glow.addColorStop(0.6, 'rgba(40,0,80,0.25)');
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 150; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 0.4 + (i % 5) * 0.35;
            ctx.globalAlpha = 0.25 + (i % 6) * 0.12;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          for (let i = 0; i < 20; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 8 + (i % 3) * 5;
            ctx.fillStyle = '#d8b4fe';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            for (let p = 0; p < 8; p++) {
              const angle = (Math.PI / 4) * p;
              const r = p % 2 === 0 ? size : size * 0.35;
              const px = x + Math.cos(angle) * r;
              const py = y + Math.sin(angle) * r;
              if (p === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(192,132,252,0.55)');
          borderG.addColorStop(1, 'rgba(80,0,160,0.55)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'pastel-candy': { 
        color: '#fff0f8',
        draw: (ctx, w, h) => {
          ctx.fillStyle = '#fff0f8';
          ctx.fillRect(0, 0, w, h);
          const stripes = ['rgba(255,183,197,0.35)', 'rgba(183,220,255,0.35)', 'rgba(183,255,210,0.35)', 'rgba(255,225,183,0.35)', 'rgba(220,183,255,0.35)'];
          for (let i = 0; i < 24; i++) {
            ctx.fillStyle = stripes[i % stripes.length];
            const x = -h + i * (w + h) / 12;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + (w + h) / 12, 0);
            ctx.lineTo(x + (w + h) / 12 + h, h);
            ctx.lineTo(x + h, h);
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 30; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 8 + (i % 3) * 4;
            const hue = (i * 40 + i * 70) % 360;
            ctx.fillStyle = `hsl(${hue},100%,72%)`;
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.arc(x - size * 0.25, y, size * 0.25, 0, Math.PI * 2);
            ctx.arc(x + size * 0.25, y, size * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x - size * 0.5, y);
            ctx.lineTo(x, y + size * 0.5);
            ctx.lineTo(x + size * 0.5, y);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(255,100,150,0.5)');
          borderG.addColorStop(0.5, 'rgba(100,150,255,0.5)');
          borderG.addColorStop(1, 'rgba(255,150,100,0.5)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      }
    };
    
    const theme = themes[state.currentTheme] || themes['sakura'];
    console.log('Using theme:', state.currentTheme);
    
    // Check if we're in together mode with partner photos
    const isTogether = state.mode === 'together' && state.partnerPhotos.length === PHOTO_COUNT;
    const PW = isTogether ? 450 : 600;  // Photo width (high res for printing)
    const PH = isTogether ? 450 : 600;  // Photo height
    const SW = isTogether ? (450 * 2 + 40 * 3) : 680;  // Strip width
    const stripH = 40 + (PH + 40) * 4 + 120;  // Strip height with footer
    
    console.log('Step 2: Setup canvas - isTogether:', isTogether, 'Width:', SW, 'Height:', stripH);
    stripCanvas.width = SW;
    stripCanvas.height = stripH;
    const ctx = stripCanvas.getContext('2d');
    
    console.log('Step 3: Draw background');
    ctx.fillStyle = theme.color;
    ctx.fillRect(0, 0, SW, stripH);
    
    // Draw theme decorations if available
    if (theme.draw) {
      try {
        ctx.save();
        theme.draw(ctx, SW, stripH);
        ctx.restore();
        console.log('Theme decorations drawn');
      } catch (e) {
        console.warn('Theme decoration failed:', e.message);
      }
    }
    
    // Reset context
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    
    console.log('Step 4: Draw photos');
    // Draw each photo
    for (let i = 0; i < 4; i++) {
      const y = 40 + i * (PH + 40);
      console.log('Drawing photo', i+1, 'of 4...');
      
      try {
        if (isTogether) {
          // Together mode - draw both photos side by side
          console.log('Drawing together mode - my photo and partner photo', i);
          const myImg = await loadImage(state.photos[i]);
          const ptImg = await loadImage(state.partnerPhotos[i]);
          ctx.drawImage(myImg, 40, y, PW, PH);
          ctx.drawImage(ptImg, 40 + PW + 40, y, PW, PH);
          console.log('Both photos', i+1, 'drawn successfully');
        } else {
          // Solo mode - draw single photo
          const img = await loadImage(state.photos[i]);
          ctx.drawImage(img, 40, y, PW, PH);
          console.log('Photo', i+1, 'drawn successfully');
        }
      } catch (imgErr) {
        console.error('Photo', i+1, 'failed:', imgErr.message);
        // Draw error box
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(40, y, PW, PH);
        if (isTogether) {
          ctx.fillRect(40 + PW + 40, y, PW, PH);
        }
        ctx.fillStyle = '#fff';
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Error ' + (i+1), isTogether ? SW/2 : 340, y + PH/2);
      }
    }
    
    console.log('Step 5: Draw text');
    // Footer text
    if (caption || showDate) {
      ctx.fillStyle = state.textColor;
      ctx.textAlign = 'center';
      const baseY = stripH - 80;
      const centerX = SW / 2;  // Use dynamic center based on strip width
      
      if (caption) {
        ctx.font = 'bold 28px "Dancing Script", cursive';
        ctx.fillText(caption, centerX, baseY);
      }
      if (showDate) {
        ctx.font = '20px "Nunito", sans-serif';
        const d = new Date().toLocaleDateString();
        ctx.fillText(d, centerX, caption ? baseY + 40 : baseY);
      }
    }
    
    console.log('Step 6: Show strip');
    stripSection.style.display = 'flex';
    await new Promise(r => setTimeout(r, 100));
    stripSection.scrollIntoView({ behavior: 'smooth' });
    
    console.log('SUCCESS: Strip complete!');
    showToast('🎉 Strip ready!');
    
  } catch (err) {
    console.error('FAILED at some step:', err.message);
    console.error('Full error:', err);
    showToast('⚠️ Error: ' + err.message);
    // Show strip section anyway
    stripSection.style.display = 'flex';
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function send(data) {
  if (state.conn && state.conn.open) state.conn.send(data);
}

// ── Build strip ──────────────────────────────────────────
async function buildStrip() {
  try {
    console.log('buildStrip() STARTED');
    console.log('Photos:', state.photos.length, 'Partner photos:', state.partnerPhotos.length);
    
    // Validate we have all photos
    if (state.photos.length !== PHOTO_COUNT) {
      throw new Error('Not enough photos captured');
    }
    
    console.log('Photo count validated');
    
    const caption    = captionInput.value.trim();
    const showDate   = showDateChk.checked;
    const theme      = THEMES[state.currentTheme] || THEMES['sakura'];
    const isTogether = state.mode === 'together' && state.partnerPhotos.length === PHOTO_COUNT;

    console.log('Theme:', state.currentTheme, 'Mode:', state.mode, 'isTogether:', isTogether);

    const PW = isTogether ? TOG_PW : PHOTO_W;
    const PH = isTogether ? TOG_PH : PHOTO_H;
    const SW = isTogether ? TOG_SW : STRIP_W;

    const footerH = (caption || showDate) ? 70 : 32;
    const totalH  = PADDING + PHOTO_COUNT * (PH + PADDING) + footerH;

    console.log('About to set canvas size:', SW, 'x', totalH);
    stripCanvas.width  = SW;
    stripCanvas.height = totalH;

    console.log('Getting canvas context...');
    const ctx = stripCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    console.log('Canvas setup complete:', SW, 'x', totalH);

    // Draw background - simple solid color first
    console.log('Drawing background color:', theme.color);
    ctx.fillStyle = theme.color || '#ffb7c5';
    ctx.fillRect(0, 0, SW, totalH);
    console.log('Background drawn');
    
    // Draw aesthetic decorations on top (if theme has them)
    // Use setTimeout to prevent blocking on mobile
    if (typeof theme.draw === 'function') {
      try { 
        console.log('Drawing theme decorations...');
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        theme.draw(ctx, SW, totalH);
        ctx.restore();
        console.log('Theme decorations drawn');
      } catch(e) { 
        console.warn('Theme draw error (continuing anyway):', e.message);
        // Continue even if theme fails
      }
    }

    // Reset context state to ensure photos draw correctly
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Draw photos with rounded corners
    console.log('Starting to draw photos...');
    for (let i = 0; i < PHOTO_COUNT; i++) {
      const y = PADDING + i * (PH + PADDING);
      
      try {
        if (isTogether) {
          if (!state.photos[i]) throw new Error(`Missing my photo at index ${i}`);
          if (!state.partnerPhotos[i]) throw new Error(`Missing partner photo at index ${i}`);
          
          console.log('Loading together photos', i);
          const myImg = await loadImage(state.photos[i]);
          const ptImg = await loadImage(state.partnerPhotos[i]);
          drawRoundedImage(ctx, myImg, PADDING, y, PW, PH, 8);
          drawRoundedImage(ctx, ptImg, PADDING + PW + PADDING, y, PW, PH, 8);
        } else {
          if (!state.photos[i]) throw new Error(`Missing photo at index ${i}`);
          
          console.log('Loading solo photo', i, 'data length:', state.photos[i].length);
          const img = await loadImage(state.photos[i]);
          console.log('Image loaded, drawing...');
          drawRoundedImage(ctx, img, PADDING, y, PW, PH, 10);
        }
        console.log('Photo', i+1, 'drawn');
      } catch (imgError) {
        console.error('Error loading photo', i, ':', imgError.message);
        throw imgError;
      }
    }

    // Reset context for text
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Footer
    const textColor = theme.text || '#222';
    ctx.fillStyle   = textColor;
    ctx.textAlign   = 'center';
    const baseY = totalH - footerH + 20;

    if (caption) {
      ctx.font = `bold 18px 'Nunito', sans-serif`;
      ctx.fillText(caption, SW / 2, baseY);
      console.log('Caption drawn:', caption);
    }
    if (showDate) {
      ctx.font = `13px 'Nunito', sans-serif`;
      ctx.globalAlpha = 0.6;
      const d = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      ctx.fillText(d, SW / 2, caption ? baseY + 26 : baseY);
      ctx.globalAlpha = 1;
      console.log('Date drawn:', d);
    }

    console.log('Showing strip section...');
    stripSection.style.display = 'flex';
    
    // Small delay to ensure DOM updates on mobile
    await new Promise(resolve => setTimeout(resolve, 100));
    
    stripSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    console.log('buildStrip() completed successfully');
    
  } catch (error) {
    console.error('Error in buildStrip():', error.message);
    console.error('Error stack:', error.stack);
    throw error; // Re-throw to be caught by the calling function
  }
}

// ── Build simple strip (fallback without theme decorations) ──
async function buildSimpleStrip() {
  console.log('buildSimpleStrip() called - no theme decorations');
  console.log('Photos in state:', state.photos.length);
  
  // First, test if canvas works at all
  const ctx = stripCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot get canvas context');
  }
  
  const caption    = captionInput.value.trim();
  const showDate   = showDateChk.checked;
  const theme      = THEMES[state.currentTheme] || THEMES['sakura'];
  const isTogether = state.mode === 'together' && state.partnerPhotos.length === PHOTO_COUNT;

  const PW = isTogether ? TOG_PW : PHOTO_W;
  const PH = isTogether ? TOG_PH : PHOTO_H;
  const SW = isTogether ? TOG_SW : STRIP_W;

  const footerH = (caption || showDate) ? 70 : 32;
  const totalH  = PADDING + PHOTO_COUNT * (PH + PADDING) + footerH;

  console.log('Setting canvas size:', SW, 'x', totalH);
  stripCanvas.width  = SW;
  stripCanvas.height = totalH;

  // Test: Draw a red rectangle to confirm canvas is working
  ctx.fillStyle = 'red';
  ctx.fillRect(0, 0, 50, 50);
  console.log('Test red square drawn');

  // Simple solid background
  ctx.fillStyle = theme.color || '#ffb7c5';
  ctx.fillRect(0, 0, SW, totalH);
  console.log('Background filled');

  // Draw photos - NO rounded corners, just simple rectangles
  for (let i = 0; i < PHOTO_COUNT; i++) {
    const y = PADDING + i * (PH + PADDING);
    console.log('Drawing photo', i+1, 'at y:', y);
    
    try {
      if (isTogether) {
        console.log('Together mode - loading 2 images');
        const myImg = await loadImage(state.photos[i]);
        const ptImg = await loadImage(state.partnerPhotos[i]);
        console.log('Images loaded, drawing...');
        ctx.drawImage(myImg, PADDING, y, PW, PH);
        ctx.drawImage(ptImg, PADDING + PW + PADDING, y, PW, PH);
      } else {
        console.log('Solo mode - loading 1 image, data length:', state.photos[i] ? state.photos[i].length : 'NULL');
        if (!state.photos[i]) {
          throw new Error(`Photo ${i} is null or undefined`);
        }
        const img = await loadImage(state.photos[i]);
        console.log('Image loaded, width:', img.width, 'height:', img.height);
        ctx.drawImage(img, PADDING, y, PW, PH);
        console.log('Image drawn to canvas');
      }
    } catch (imgErr) {
      console.error('Failed to draw photo', i, ':', imgErr);
      // Draw error placeholder
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(PADDING, y, PW, PH);
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Error', PADDING + PW/2, y + PH/2);
    }
  }

  // Simple text
  ctx.fillStyle = theme.text || '#222';
  ctx.textAlign = 'center';
  const baseY = totalH - footerH + 20;

  if (caption) {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(caption, SW / 2, baseY);
  }
  if (showDate) {
    ctx.font = '13px sans-serif';
    const d = new Date().toLocaleDateString();
    ctx.fillText(d, SW / 2, caption ? baseY + 26 : baseY);
  }

  console.log('Making strip visible...');
  stripSection.style.display = 'flex';
  await new Promise(resolve => setTimeout(resolve, 100));
  stripSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  console.log('Simple strip complete');
}

function drawRoundedImage(ctx, img, x, y, w, h, r) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      reject(new Error('Image load timeout'));
    }, 5000); // 5 second timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };
    img.src = src;
  });
}

function rebuildIfReady() {
  if (state.photos.length === PHOTO_COUNT) {
    console.log('Rebuilding strip after settings change...');
    
    // Rebuild using same method with decorations
    const caption = captionInput.value.trim();
    const showDate = showDateChk.checked;
    
    // Define themes inline with decorations (same as build)
    const themes = {
      'sakura': { 
        color: '#ffd6e7',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#fff0f5');
          g.addColorStop(0.4, '#ffd6e7');
          g.addColorStop(1, '#ffb7c5');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const glow = ctx.createRadialGradient(w*0.3, h*0.2, 0, w*0.3, h*0.2, w*0.6);
          glow.addColorStop(0, 'rgba(255,200,220,0.3)');
          glow.addColorStop(1, 'rgba(255,200,220,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,77,136,0.25)';
          for (let i = 0; i < 35; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 12 + (i % 4) * 6;
            for (let p = 0; p < 5; p++) {
              const angle = (Math.PI * 2 / 5) * p;
              ctx.beginPath();
              ctx.ellipse(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5, 
                          size * 0.35, size * 0.2, angle, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.strokeStyle = 'rgba(255,77,136,0.4)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255,77,136,0.2)';
          ctx.strokeRect(14, 14, w - 28, h - 28);
        }
      },
      'midnight-rose': { 
        color: '#2a0018',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#1a0010');
          g.addColorStop(0.5, '#3d0030');
          g.addColorStop(1, '#1a001a');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          [{x:0.2, y:0.2, r:0.4}, {x:0.8, y:0.65, r:0.45}].forEach(o => {
            const gl = ctx.createRadialGradient(o.x*w, o.y*h, 0, o.x*w, o.y*h, o.r*w);
            gl.addColorStop(0, 'rgba(180,0,80,0.18)');
            gl.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(0, 0, w, h);
          });
          ctx.fillStyle = 'rgba(204,0,60,0.35)';
          for (let i = 0; i < 25; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 18 + (i % 3) * 8;
            for (let r = 0; r < 3; r++) {
              ctx.beginPath();
              ctx.arc(x, y, size - r * 6, 0, Math.PI * 2);
              ctx.globalAlpha = 0.15 - r * 0.03;
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = 'rgba(204,0,60,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'cottagecore': { 
        color: '#fde8c8',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#fffbf0');
          g.addColorStop(0.5, '#fde8c8');
          g.addColorStop(1, '#f5d0a0');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 0.04;
          ctx.strokeStyle = '#c8a87a';
          ctx.lineWidth = 0.5;
          for (let i = 0; i < w; i += 4) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, h);
            ctx.stroke();
          }
          for (let i = 0; i < h; i += 4) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(w, i);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          const colors = ['#e8765a', '#d45a3a', '#f29070'];
          for (let i = 0; i < 28; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 14 + (i % 3) * 6;
            const col = colors[i % 3];
            ctx.fillStyle = col;
            ctx.globalAlpha = 0.4;
            for (let p = 0; p < 6; p++) {
              const angle = (Math.PI * 2 / 6) * p;
              ctx.beginPath();
              ctx.arc(x + Math.cos(angle) * size * 0.4, y + Math.sin(angle) * size * 0.4, size * 0.3, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#fef3c7';
            ctx.beginPath();
            ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = 'rgba(200,120,58,0.5)';
          ctx.lineWidth = 3;
          ctx.strokeRect(8, 8, w - 16, h - 16);
          const corner = 25;
          ctx.lineWidth = 2;
          [[8,8], [w-8,8], [8,h-8], [w-8,h-8]].forEach(([cx, cy]) => {
            const xDir = cx < w/2 ? 1 : -1;
            const yDir = cy < h/2 ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(cx, cy + yDir * corner);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx + xDir * corner, cy);
            ctx.stroke();
          });
        }
      },
      'aurora': { 
        color: '#050a14',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#050a14');
          g.addColorStop(0.4, '#08122a');
          g.addColorStop(1, '#050a14');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          [
            {color: 'rgba(0,255,180,0.2)', y: 0.15},
            {color: 'rgba(60,80,255,0.18)', y: 0.35},
            {color: 'rgba(0,200,255,0.2)', y: 0.58},
            {color: 'rgba(160,0,255,0.16)', y: 0.78}
          ].forEach(band => {
            const gg = ctx.createLinearGradient(0, band.y * h - 60, 0, band.y * h + 60);
            gg.addColorStop(0, 'rgba(0,0,0,0)');
            gg.addColorStop(0.5, band.color);
            gg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gg;
            ctx.fillRect(0, 0, w, h);
          });
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 120; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 0.5 + (i % 4) * 0.4;
            ctx.globalAlpha = 0.3 + (i % 5) * 0.14;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          const borderGrad = ctx.createLinearGradient(0, 0, w, h);
          borderGrad.addColorStop(0, 'rgba(0,255,180,0.5)');
          borderGrad.addColorStop(0.5, 'rgba(80,120,255,0.5)');
          borderGrad.addColorStop(1, 'rgba(160,0,255,0.5)');
          ctx.strokeStyle = borderGrad;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'golden-hour': { 
        color: '#ff9f1c',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#ff6b35');
          g.addColorStop(0.35, '#ff9f1c');
          g.addColorStop(0.7, '#ffcb47');
          g.addColorStop(1, '#ffe08a');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const sun = ctx.createRadialGradient(w * 0.5, -h * 0.1, 0, w * 0.5, -h * 0.1, w * 0.75);
          sun.addColorStop(0, 'rgba(255,245,180,0.5)');
          sun.addColorStop(0.5, 'rgba(255,200,60,0.15)');
          sun.addColorStop(1, 'rgba(255,140,0,0)');
          ctx.fillStyle = sun;
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 0.08;
          ctx.strokeStyle = '#fff9e0';
          ctx.lineWidth = 3;
          for (let a = 0; a < 12; a++) {
            const angle = (a / 12) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(w * 0.5, 0);
            ctx.lineTo(w * 0.5 + Math.cos(angle) * w * 1.5, Math.sin(angle) * h * 1.5);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          for (let i = 0; i < 20; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 8 + (i % 5) * 7;
            ctx.strokeStyle = 'rgba(255,249,204,0.15)';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.08 + (i % 4) * 0.02;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255,107,53,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'lavender-dream': { 
        color: '#e9d5ff',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#f3e8ff');
          g.addColorStop(0.5, '#e9d5ff');
          g.addColorStop(1, '#c4b5fd');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          [{x:0.2,y:0.25,r:0.45,c:'rgba(167,139,250,0.2)'}, {x:0.8,y:0.7,r:0.5,c:'rgba(192,132,252,0.18)'}].forEach(o => {
            const gl = ctx.createRadialGradient(o.x*w, o.y*h, 0, o.x*w, o.y*h, o.r*w);
            gl.addColorStop(0, o.c);
            gl.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(0, 0, w, h);
          });
          for (let i = 0; i < 30; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 6 + (i % 4) * 5;
            ctx.fillStyle = '#8b5cf6';
            ctx.globalAlpha = 0.35 + (i % 3) * 0.15;
            ctx.beginPath();
            for (let p = 0; p < 8; p++) {
              const angle = (Math.PI / 4) * p;
              const r = p % 2 === 0 ? size : size * 0.4;
              const px = x + Math.cos(angle) * r;
              const py = y + Math.sin(angle) * r;
              if (p === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(139,92,246,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'neon-cyber': { 
        color: '#03001e',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#03001e');
          g.addColorStop(0.5, '#0a0030');
          g.addColorStop(1, '#03001e');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = 'rgba(0,255,224,0.12)';
          ctx.lineWidth = 0.5;
          for (let x = 0; x < w; x += 25) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 0; y < h; y += 25) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
          [{x:0.2,y:0.25,c:'rgba(0,255,224,0.15)'}, {x:0.85,y:0.75,c:'rgba(255,0,128,0.15)'}].forEach(o => {
            const gl = ctx.createRadialGradient(o.x*w, o.y*h, 0, o.x*w, o.y*h, w*0.4);
            gl.addColorStop(0, o.c);
            gl.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(0, 0, w, h);
          });
          const colors = ['#00ffe0', '#ff0080', '#7700ff'];
          for (let i = 0; i < 20; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 5 + (i % 4) * 4;
            const col = colors[i % 3];
            ctx.fillStyle = col;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size * 0.6, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size * 0.6, y);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(0,255,224,0.7)');
          borderG.addColorStop(0.5, 'rgba(255,0,128,0.7)');
          borderG.addColorStop(1, 'rgba(119,0,255,0.7)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'blue-sky': { 
        color: '#bae6fd',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#bae6fd');
          g.addColorStop(0.6, '#7dd3fc');
          g.addColorStop(1, '#38bdf8');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const sun = ctx.createRadialGradient(w * 0.8, h * 0.08, 0, w * 0.8, h * 0.08, 70);
          sun.addColorStop(0, 'rgba(255,245,150,0.95)');
          sun.addColorStop(0.4, 'rgba(255,220,80,0.3)');
          sun.addColorStop(1, 'rgba(255,180,0,0)');
          ctx.fillStyle = sun;
          ctx.fillRect(0, 0, w, h);
          const clouds = [[0.15,0.12,28], [0.55,0.08,24], [0.35,0.22,36], [0.75,0.18,20], 
                          [0.12,0.38,30], [0.88,0.45,26], [0.25,0.65,28], [0.7,0.7,24]];
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          clouds.forEach(([xf, yf, r]) => {
            const cx = xf * w;
            const cy = yf * h;
            [[-r*0.5,r*0.1], [0,-r*0.1], [r*0.5,r*0.1], [r*0.9,r*0.2], [-r*0.9,r*0.2], [0,r*0.25]].forEach(([dx, dy]) => {
              ctx.beginPath();
              ctx.arc(cx + dx, cy + dy, r * 0.45, 0, Math.PI * 2);
              ctx.fill();
            });
          });
          ctx.strokeStyle = 'rgba(14,165,233,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'forest-moss': { 
        color: '#dcfce7',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#f0fdf4');
          g.addColorStop(0.4, '#dcfce7');
          g.addColorStop(1, '#86efac');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 14; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 22 + i * 8;
            const gg = ctx.createRadialGradient(x, y, 0, x, y, size);
            gg.addColorStop(0, 'rgba(255,255,220,0.22)');
            gg.addColorStop(1, 'rgba(255,255,220,0)');
            ctx.fillStyle = gg;
            ctx.fillRect(0, 0, w, h);
          }
          for (let i = 0; i < 25; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 8 + (i % 4) * 5;
            ctx.fillStyle = '#4ade80';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.ellipse(x, y, size, size * 0.5, (i % 8) * Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(22,163,74,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'galaxy': { 
        color: '#0d0630',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#02011a');
          g.addColorStop(0.4, '#0d0630');
          g.addColorStop(1, '#1a0545');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          [{x:0.3,y:0.35,c:'rgba(80,0,160,0.28)'}, {x:0.7,y:0.6,c:'rgba(0,80,200,0.2)'}].forEach(o => {
            const gl = ctx.createRadialGradient(o.x*w, o.y*h, 0, o.x*w, o.y*h, w*0.48);
            gl.addColorStop(0, o.c);
            gl.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(0, 0, w, h);
          });
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 180; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 0.3 + (i % 5) * 0.3;
            ctx.globalAlpha = 0.2 + (i % 7) * 0.11;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          for (let i = 0; i < 15; i++) {
            const x = (i * 97.3) % w;
            const y = (i * 0.432 * h) % h;
            const size = 6 + (i % 3) * 4;
            ctx.fillStyle = '#e0d7ff';
            ctx.globalAlpha = 0.5;
            ctx.fillRect(x - size, y - 1, size * 2, 2);
            ctx.fillRect(x - 1, y - size, 2, size * 2);
          }
          ctx.globalAlpha = 1;
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(160,100,255,0.5)');
          borderG.addColorStop(1, 'rgba(60,0,200,0.5)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'retro-film': { 
        color: '#f0e8d0',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#f5efe0');
          g.addColorStop(1, '#e8d8b0');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const vig = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.85);
          vig.addColorStop(0, 'rgba(139,100,40,0)');
          vig.addColorStop(1, 'rgba(80,40,0,0.35)');
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(160,120,60,0.35)';
          for (let y = 24; y < h - 24; y += 32) {
            ctx.fillRect(5, y, 11, 18);
            ctx.fillRect(w - 16, y, 11, 18);
          }
          ctx.globalAlpha = 0.15;
          for (let i = 0; i < 200; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 1 + (i % 3) * 0.5;
            ctx.fillStyle = '#8b6a3a';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(139,106,58,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'y2k-holo': { 
        color: '#ffe0f7',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, h);
          g.addColorStop(0, '#ffe0f7');
          g.addColorStop(0.3, '#d0f0ff');
          g.addColorStop(0.6, '#e8d0ff');
          g.addColorStop(1, '#ffd0e8');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 12; i++) {
            const hue = i * 30;
            const gg = ctx.createLinearGradient(0, i * h / 12, w, (i + 1) * h / 12);
            gg.addColorStop(0, `hsla(${hue},100%,80%,0)`);
            gg.addColorStop(0.5, `hsla(${hue},100%,80%,0.12)`);
            gg.addColorStop(1, `hsla(${hue},100%,80%,0)`);
            ctx.fillStyle = gg;
            ctx.fillRect(0, 0, w, h);
          }
          for (let i = 0; i < 25; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 7 + (i % 4) * 4;
            const hue = (i * 60) % 360;
            ctx.fillStyle = `hsl(${hue},100%,70%)`;
            ctx.globalAlpha = 0.5;
            for (let p = 0; p < 8; p++) {
              const angle = (Math.PI / 4) * p;
              const r = p % 2 === 0 ? size : size * 0.35;
              const px = x + Math.cos(angle) * r;
              const py = y + Math.sin(angle) * r;
              ctx.beginPath();
              ctx.arc(px, py, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(255,100,200,0.6)');
          borderG.addColorStop(0.5, 'rgba(100,200,255,0.6)');
          borderG.addColorStop(1, 'rgba(200,100,255,0.6)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'dark-academia': { 
        color: '#2d1e0a',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#1a1208');
          g.addColorStop(0.5, '#2d1e0a');
          g.addColorStop(1, '#1a0f05');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const vig = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.8);
          vig.addColorStop(0, 'rgba(80,50,10,0)');
          vig.addColorStop(1, 'rgba(10,5,0,0.5)');
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = 'rgba(200,160,80,0.35)';
          ctx.lineWidth = 1.5;
          for (let x = 16; x < w - 16; x += 22) {
            ctx.beginPath();
            ctx.moveTo(x, 14);
            ctx.lineTo(x + 10, 26);
            ctx.lineTo(x, 38);
            ctx.lineTo(x - 10, 26);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, h - 38);
            ctx.lineTo(x + 10, h - 26);
            ctx.lineTo(x, h - 14);
            ctx.lineTo(x - 10, h - 26);
            ctx.closePath();
            ctx.stroke();
          }
          for (let y = 60; y < h - 60; y += 40) {
            ctx.beginPath();
            ctx.arc(20, y, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(w - 20, y, 5, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(200,160,80,0.4)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'winter-snow': { 
        color: '#e0f2fe',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#e0f2fe');
          g.addColorStop(0.5, '#f0f9ff');
          g.addColorStop(1, '#bae6fd');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const shimmer = ctx.createRadialGradient(w * 0.5, 0, 0, w * 0.5, 0, w * 0.75);
          shimmer.addColorStop(0, 'rgba(255,255,255,0.3)');
          shimmer.addColorStop(1, 'rgba(200,230,255,0)');
          ctx.fillStyle = shimmer;
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 35; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 6 + (i % 4) * 4;
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.4 + (i % 3) * 0.15;
            for (let a = 0; a < 6; a++) {
              const angle = (Math.PI / 3) * a;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
              ctx.stroke();
              const bx = x + Math.cos(angle) * size * 0.6;
              const by = y + Math.sin(angle) * size * 0.6;
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(angle + Math.PI / 6) * size * 0.3, by + Math.sin(angle + Math.PI / 6) * size * 0.3);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.lineTo(bx + Math.cos(angle - Math.PI / 6) * size * 0.3, by + Math.sin(angle - Math.PI / 6) * size * 0.3);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
          for (let i = 0; i < 60; i++) {
            const x = (i * 97.3) % w;
            const y = (i * 0.432 * h) % h;
            const size = 1 + (i % 4) * 1.2;
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.5 + (i % 4) * 0.12;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(56,189,248,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'velvet-night': { 
        color: '#0a0014',
        draw: (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#0a0014');
          g.addColorStop(0.4, '#1a0030');
          g.addColorStop(1, '#0a0014');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          const glow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.85);
          glow.addColorStop(0, 'rgba(80,0,120,0.45)');
          glow.addColorStop(0.6, 'rgba(40,0,80,0.25)');
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 150; i++) {
            const x = (i * 137.508) % w;
            const y = (i * 0.618 * h) % h;
            const size = 0.4 + (i % 5) * 0.35;
            ctx.globalAlpha = 0.25 + (i % 6) * 0.12;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          for (let i = 0; i < 20; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 8 + (i % 3) * 5;
            ctx.fillStyle = '#d8b4fe';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            for (let p = 0; p < 8; p++) {
              const angle = (Math.PI / 4) * p;
              const r = p % 2 === 0 ? size : size * 0.35;
              const px = x + Math.cos(angle) * r;
              const py = y + Math.sin(angle) * r;
              if (p === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(192,132,252,0.55)');
          borderG.addColorStop(1, 'rgba(80,0,160,0.55)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      },
      'pastel-candy': { 
        color: '#fff0f8',
        draw: (ctx, w, h) => {
          ctx.fillStyle = '#fff0f8';
          ctx.fillRect(0, 0, w, h);
          const stripes = ['rgba(255,183,197,0.35)', 'rgba(183,220,255,0.35)', 'rgba(183,255,210,0.35)', 'rgba(255,225,183,0.35)', 'rgba(220,183,255,0.35)'];
          for (let i = 0; i < 24; i++) {
            ctx.fillStyle = stripes[i % stripes.length];
            const x = -h + i * (w + h) / 12;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + (w + h) / 12, 0);
            ctx.lineTo(x + (w + h) / 12 + h, h);
            ctx.lineTo(x + h, h);
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 30; i++) {
            const x = (i * 137.5) % w;
            const y = (i * 61.8) % h;
            const size = 8 + (i % 3) * 4;
            const hue = (i * 40 + i * 70) % 360;
            ctx.fillStyle = `hsl(${hue},100%,72%)`;
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.arc(x - size * 0.25, y, size * 0.25, 0, Math.PI * 2);
            ctx.arc(x + size * 0.25, y, size * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x - size * 0.5, y);
            ctx.lineTo(x, y + size * 0.5);
            ctx.lineTo(x + size * 0.5, y);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          const borderG = ctx.createLinearGradient(0, 0, w, h);
          borderG.addColorStop(0, 'rgba(255,100,150,0.5)');
          borderG.addColorStop(0.5, 'rgba(100,150,255,0.5)');
          borderG.addColorStop(1, 'rgba(255,150,100,0.5)');
          ctx.strokeStyle = borderG;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(8, 8, w - 16, h - 16);
        }
      }
    };
    
    const theme = themes[state.currentTheme] || themes['sakura'];
    
    const isTogether = state.mode === 'together' && state.partnerPhotos.length === PHOTO_COUNT;
    const PW = isTogether ? 450 : 600;
    const PH = isTogether ? 450 : 600;
    const SW = isTogether ? (450 * 2 + 40 * 3) : 680;
    const stripH = 40 + (PH + 40) * 4 + 120;
    
    stripCanvas.width = SW;
    stripCanvas.height = stripH;
    const ctx = stripCanvas.getContext('2d');
    
    // Background with decorations
    ctx.fillStyle = theme.color;
    ctx.fillRect(0, 0, SW, stripH);
    
    if (theme.draw) {
      try {
        ctx.save();
        theme.draw(ctx, SW, stripH);
        ctx.restore();
      } catch (e) {
        console.warn('Theme decoration failed:', e.message);
      }
    }
    
    // Reset context
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    
    // Draw photos
    state.photos.forEach((photoData, i) => {
      const img = new Image();
      img.onload = () => {
        const y = 40 + i * (PH + 40);
        
        if (isTogether && state.partnerPhotos[i]) {
          // Draw both photos side by side
          ctx.drawImage(img, 40, y, PW, PH);
          const ptImg = new Image();
          ptImg.onload = () => {
            ctx.drawImage(ptImg, 40 + PW + 40, y, PW, PH);
            // Draw text on last photo
            if (i === 3 && (caption || showDate)) {
              ctx.fillStyle = state.textColor;
              ctx.textAlign = 'center';
              const baseY = stripH - 80;
              const centerX = SW / 2;
              
              if (caption) {
                ctx.font = 'bold 28px "Dancing Script", cursive';
                ctx.fillText(caption, centerX, baseY);
              }
              if (showDate) {
                ctx.font = '20px "Nunito", sans-serif';
                const d = new Date().toLocaleDateString();
                ctx.fillText(d, centerX, caption ? baseY + 40 : baseY);
              }
            }
          };
          ptImg.src = state.partnerPhotos[i];
        } else {
          // Solo mode - single photo
          ctx.drawImage(img, 40, y, PW, PH);
          // Draw text on last photo
          if (i === 3 && (caption || showDate)) {
            ctx.fillStyle = state.textColor;
            ctx.textAlign = 'center';
            const baseY = stripH - 80;
            const centerX = SW / 2;
            
            if (caption) {
              ctx.font = 'bold 28px "Dancing Script", cursive';
              ctx.fillText(caption, centerX, baseY);
            }
            if (showDate) {
              ctx.font = '20px "Nunito", sans-serif';
              const d = new Date().toLocaleDateString();
              ctx.fillText(d, centerX, caption ? baseY + 40 : baseY);
            }
          }
        }
      };
      img.src = photoData;
    });
  }
}

captionInput.addEventListener('input', rebuildIfReady);
showDateChk.addEventListener('change', rebuildIfReady);

// ── Button handlers ──────────────────────────────────────
startBtn.addEventListener('click', startShooting);

retakeBtn.addEventListener('click', () => {
  state.photos = []; state.partnerPhotos = [];
  resetDots();
  retakeBtn.classList.add('hidden');
  startBtn.classList.remove('hidden');
  stripSection.style.display = 'none';
  startHint.textContent = 'tap the button to start!';
});

downloadBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.download = `photobooth-${date}.png`;
  // PNG for lossless quality - best for printing
  a.href = stripCanvas.toDataURL('image/png');
  a.click();
  showToast('📥 High-res image saved!');
});

newBtn.addEventListener('click', () => {
  state.photos = []; state.partnerPhotos = [];
  resetDots();
  retakeBtn.classList.add('hidden');
  startBtn.classList.remove('hidden');
  stripSection.style.display = 'none';
  captionInput.value = '';
  startHint.textContent = 'tap the button to start!';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Toast ────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Init ─────────────────────────────────────────────────
initCamera();
