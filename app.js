// ─────────────────────────────────────────────────────────
//  Photo Booth App  —  Solo + Together (WebRTC via PeerJS)
// ─────────────────────────────────────────────────────────

// ── Constants ──────────────────────────────────────────
const PHOTO_COUNT      = 4;
const COUNTDOWN_SEC    = 3;
const BETWEEN_SHOTS_MS = 900;
const PHOTO_W          = 360;
const PHOTO_H          = 360;
const PADDING          = 22;
const STRIP_W          = PHOTO_W + PADDING * 2;
const TOG_PW           = 260;
const TOG_PH           = 260;
const TOG_SW           = TOG_PW * 2 + PADDING * 3;

// ── State ───────────────────────────────────────────────
const state = {
  mode: 'solo', stream: null,
  photos: [], partnerPhotos: [],
  currentFilter: 'none',
  currentTheme: 'sakura',
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
      video: { width: { ideal: 720 }, height: { ideal: 720 }, facingMode: 'user' },
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
  else if (data.type === 'flash') { triggerFlashEl(flashPartner); triggerFlashEl(flashMe); }
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
    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.85);
    
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
  if (state.mode === 'together') send({ type: 'startShooting' });

  console.log('Starting photo shoot...');

  for (let i = 0; i < PHOTO_COUNT; i++) {
    await runCountdown(COUNTDOWN_SEC);
    triggerFlash();
    if (state.mode === 'together') { send({ type: 'flash' }); triggerFlashEl(flashPartner); }
    
    const photo = captureMyFrame();
    console.log('Photo', i+1, 'captured, length:', photo.length, 'starts with:', photo.substring(0, 30));
    state.photos.push(photo);
    
    if (state.mode === 'together') { capturePartnerFrame(i); send({ type: 'capture', index: i }); }
    setDot(i, true);
    if (i < PHOTO_COUNT - 1) await sleep(BETWEEN_SHOTS_MS);
  }

  console.log('All photos captured:', state.photos.length, 'photos');
  console.log('Photo array check:', state.photos.map((p, i) => `Photo ${i}: ${p ? 'exists' : 'MISSING'}`));

  state.shooting = false;
  showCountdownBoth(null);
  retakeBtn.classList.remove('hidden');
  startHint.textContent = '';
  
  // Show loading message
  showToast('✨ Creating your strip...');
  
  try {
    await buildStrip();
    console.log('Strip built successfully');
    showToast('🎉 Strip ready!');
  } catch (err) {
    console.error('Error building strip:', err);
    console.error('Error type:', err.name);
    console.error('Error message:', err.message);
    
    // Try a simplified version without theme decorations
    try {
      console.log('Attempting simplified strip...');
      await buildSimpleStrip();
      showToast('✨ Strip created (simple mode)');
    } catch (simpleErr) {
      console.error('Simple strip also failed:', simpleErr);
      showToast('⚠️ Error creating strip. Check console.');
      
      // Show the strip section anyway so user can see what we have
      stripSection.style.display = 'flex';
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function send(data) {
  if (state.conn && state.conn.open) state.conn.send(data);
}

// ── Build strip ──────────────────────────────────────────
async function buildStrip() {
  console.log('buildStrip() called');
  console.log('Photos:', state.photos.length, 'Partner photos:', state.partnerPhotos.length);
  
  try {
    // Validate we have all photos
    if (state.photos.length !== PHOTO_COUNT) {
      throw new Error('Not enough photos captured');
    }
    
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

    stripCanvas.width  = SW;
    stripCanvas.height = totalH;

    const ctx = stripCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    console.log('Canvas setup complete:', SW, 'x', totalH);

    // Draw background - simple solid color first
    ctx.fillStyle = theme.color || '#ffb7c5';
    ctx.fillRect(0, 0, SW, totalH);
    console.log('Background drawn');
    
    // Draw aesthetic decorations on top (if theme has them)
    // Use setTimeout to prevent blocking on mobile
    if (typeof theme.draw === 'function') {
      try { 
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        theme.draw(ctx, SW, totalH);
        ctx.restore();
        console.log('Theme decorations drawn');
      } catch(e) { 
        console.warn('Theme draw error (continuing anyway):', e);
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
          
          const myImg = await loadImage(state.photos[i]);
          const ptImg = await loadImage(state.partnerPhotos[i]);
          drawRoundedImage(ctx, myImg, PADDING, y, PW, PH, 8);
          drawRoundedImage(ctx, ptImg, PADDING + PW + PADDING, y, PW, PH, 8);
        } else {
          if (!state.photos[i]) throw new Error(`Missing photo at index ${i}`);
          
          const img = await loadImage(state.photos[i]);
          drawRoundedImage(ctx, img, PADDING, y, PW, PH, 10);
        }
        console.log('Photo', i+1, 'drawn');
      } catch (imgError) {
        console.error('Error loading photo', i, ':', imgError);
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
    console.error('Error in buildStrip():', error);
    console.error('Error details:', error.message, error.stack);
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
  if (state.photos.length === PHOTO_COUNT) buildStrip();
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
  a.download = 'our-photobooth-strip.png';
  a.href = stripCanvas.toDataURL('image/png');
  a.click();
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
