document.addEventListener("DOMContentLoaded", () => {

const APP_REGISTRY = {
  home: {
    title: 'Home',
    winId: 'win-home',
    onOpen: null,
  },

  about: {
    title: 'About Me',
    winId: 'win-about',
    onOpen: null,
  },

  spotify: {
    title: 'Spotify',
    winId: 'win-spotify',
    onOpen: null,
  },

  photobooth: {
    title: 'Photobooth',
    winId: 'win-photobooth',
    onOpen: initPhotobooth,
  },
}

function updateClock() {
  const clockEl = document.getElementById('topbar-clock');
  const now = new Date();

  const date = now.toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });

  const time = now.toLocaleTimeString('en-GB', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  clockEl.textContent = `${date},  ${time}`;
}

updateClock();
setInterval(updateClock, 1000);

let zTop = 200;

function openApp(appKey) {
  const app = APP_REGISTRY[appKey];
  if (!app) { console.warn(`myOS: unknown app "${appKey}"`); return; }

  const win = document.getElementById(app.winId);
  if (!win) { console.warn(`myOS: window #${app.winId} not found`); return; }

  if (win.classList.contains('window-open')) {
    focusWin(win);
    return;
  }

  const desktop = document.getElementById('desktop');
  const dw = desktop.clientWidth;
  const dh = desktop.clientHeight;
  const ww = win.offsetWidth  || parseInt(win.style.width)  || 420;
  const wh = win.offsetHeight || parseInt(win.style.height) || 320;

  const jitter = () => (Math.random() - 0.5) * 60;
  win.style.left = `${Math.max(10, (dw - ww) / 2 + jitter())}px`;
  win.style.top  = `${Math.max(10, (dh - wh) / 2 + jitter())}px`;


  win.classList.add('window-open');
  focusWin(win);


  if (typeof app.onOpen === 'function') {
    app.onOpen(win);
  }
}


function closeApp(appKey) {
  const app = APP_REGISTRY[appKey];
  if (!app) return;
  const win = document.getElementById(app.winId);
  if (!win) return;
  win.classList.remove('window-open');
}


function focusWin(win) {
  zTop += 1;
  win.style.zIndex = zTop;
  document.querySelectorAll('.window').forEach(w => w.classList.remove('focused'));
  win.classList.add('focused');
}


document.querySelectorAll('.desktop-icon').forEach(icon => {
  icon.addEventListener('dblclick', () => {
    const appKey = icon.dataset.app;
    openApp(appKey);
  });
});

document.querySelectorAll('.desktop-icon').forEach(icon => {
  icon.addEventListener('click', () => {
    const appKey = icon.dataset.app;
    openApp(appKey);
  });
});

document.querySelectorAll('.window').forEach(win => {
  win.addEventListener('mousedown', () => focusWin(win));
});


document.querySelectorAll('.dot-close').forEach(dot => {
  dot.addEventListener('click', e => {
    e.stopPropagation();
    const win = dot.closest('.window');
    win.classList.remove('window-open');
  });
});

document.querySelectorAll('.home-card').forEach(btn => {
  btn.addEventListener('click', () => {
    const appKey = btn.dataset.app;
    if (appKey) {
      openApp(appKey);
    }
  });
});


document.querySelectorAll('.window-titlebar').forEach(titlebar => {
  titlebar.addEventListener('mousedown', startDrag);
});

function startDrag(e) {
  if (e.target.classList.contains('dot')) return;

  const win      = e.currentTarget.closest('.window');
  const desktop  = document.getElementById('desktop');
  focusWin(win);

  const startX   = e.clientX - win.offsetLeft;
  const startY   = e.clientY - win.offsetTop - parseInt(getComputedStyle(document.getElementById('topbar')).height);

  const maxX = () => desktop.clientWidth  - win.offsetWidth;
  const maxY = () => desktop.clientHeight - 40;

  function onMove(ev) {
    let newLeft = ev.clientX - startX;
    let newTop  = ev.clientY - startY - parseInt(getComputedStyle(document.getElementById('topbar')).height || 36);
    newLeft = Math.max(0, Math.min(newLeft, maxX()));
    newTop  = Math.max(0, Math.min(newTop,  maxY()));
    win.style.left = `${newLeft}px`;
    win.style.top  = `${newTop}px`;
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

const CUTE_EMOJIS = ['🤍','👻','🐰','🐢','🦎','🐛','🧟‍♀️','🎲','🔊','🎹','🧪','🖇️','🧃','🍀','☃️','💚'];
let pbStream = null, pbPhotos = [], pbInitialised = false;

function initPhotobooth(win) {
  if (pbInitialised) return;
  pbInitialised = true;

  const video = document.getElementById('pb-video');
  const startBtn = document.getElementById('pb-start-btn');
  const saveBtn = document.getElementById('pb-save-btn');
  const canvas = document.getElementById('pb-canvas');
  const countdown = document.getElementById('pb-countdown');

  navigator.mediaDevices.getUserMedia({ 
    video: { 
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user'
    }, 
    audio: false 
  })
    .then(stream => {
      pbStream = stream;
      video.srcObject = stream;
      video.play().catch(err => {
        console.error('Video play failed:', err);
      });
    })
    .catch(err => {
      console.error('Photobooth: camera error', err);
      countdown.textContent = '📷 Camera access denied';
      countdown.classList.remove('hidden');
      startBtn.disabled = true;
    });

  startBtn.addEventListener('click', () => runPhotoStrip(video, canvas, countdown, startBtn, saveBtn));
  saveBtn.addEventListener('click',  () => downloadStrip(canvas));
}

async function runPhotoStrip(video, canvas, countdownEl, startBtn, saveBtn) {
  if (!video.srcObject || video.readyState < 2) {
    alert('Please wait for camera to initialize');
    return;
  }

  pbPhotos = [];
  startBtn.disabled = true;
  saveBtn.classList.add('hidden');
  canvas.classList.add('hidden');

  for (let shot = 0; shot < 4; shot++) {
    for (let n = 3; n >= 1; n--) {
      countdownEl.textContent = n;
      countdownEl.classList.remove('hidden');
      await sleep(800);
    }
    countdownEl.textContent = '📸';
    await sleep(200);
    countdownEl.classList.add('hidden');

    const snap = captureFrame(video);
    pbPhotos.push(snap);
    if (shot < 3) await sleep(600);
  }

  drawStrip(canvas, pbPhotos);
  canvas.classList.remove('hidden');
  saveBtn.classList.remove('hidden');
  startBtn.disabled = false;
}

function captureFrame(video) {
  const c = document.createElement('canvas');
  c.width  = video.videoWidth  || 640;
  c.height = video.videoHeight || 480;
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c;
}

function drawStrip(canvas, photos) {
  const PHOTO_W = 300, PHOTO_H = 225;
  const PADDING = 16, GAP = 14;
  const EMOJI_ZONE = 50, BOTTOM_PAD = 50;

  const POLAROID_PAD = 10;
  const POLAROID_BOTTOM = 26;

  const FRAME_W = PHOTO_W + POLAROID_PAD * 2;
  const FRAME_H = PHOTO_H + POLAROID_PAD + POLAROID_BOTTOM;

  const stripW = FRAME_W + PADDING * 2 + EMOJI_ZONE * 2;
  const stripH = (FRAME_H + GAP) * 4 - GAP + PADDING * 2 + BOTTOM_PAD;

  canvas.width = stripW;
  canvas.height = stripH;

  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, stripH);
  grad.addColorStop(0, '#e8fdef');
  grad.addColorStop(0.5, '#f4fee8');
  grad.addColorStop(1, '#e8f3fd');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, stripW, stripH);

  photos.forEach((photoCanvas, i) => {
    const frameX = EMOJI_ZONE + PADDING;
    const frameY = PADDING + i * (FRAME_H + GAP);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(frameX, frameY, FRAME_W, FRAME_H);

    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillRect(frameX, frameY, FRAME_W, FRAME_H);
    ctx.shadowColor = 'transparent';

    const imgX = frameX + POLAROID_PAD;
    const imgY = frameY + POLAROID_PAD;

    ctx.save();
    roundRectClip(ctx, imgX, imgY, PHOTO_W, PHOTO_H, 6);

    const srcW = photoCanvas.width;
    const srcH = photoCanvas.height;

    const targetRatio = PHOTO_W / PHOTO_H;
    const srcRatio = srcW / srcH;

    let sx, sy, sWidth, sHeight;

    if (srcRatio > targetRatio) {
      sHeight = srcH;
      sWidth = sHeight * targetRatio;
      sx = (srcW - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = srcW;
      sHeight = sWidth / targetRatio;
      sx = 0;
      sy = (srcH - sHeight) / 2;
    }

    ctx.drawImage(photoCanvas, sx, sy, sWidth, sHeight, imgX, imgY, PHOTO_W, PHOTO_H);
    ctx.restore();

    const now = new Date();
    const date = now.toLocaleDateString('en-GB');
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    ctx.fillStyle = 'rgba(60,60,60,0.8)';
    ctx.font = "10px 'Space Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(`${date} ${time}`, frameX + FRAME_W / 2, frameY + FRAME_H - 8);
  });

  ctx.fillStyle = 'rgba(100, 80, 90, 0.5)';
  ctx.font = `bold 11px 'Space Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('✦ myOS photobooth ✦', stripW / 2, stripH - 18);


  const emojiCount = 14 + Math.floor(Math.random() * 8);
  ctx.font = '18px serif';
  ctx.textAlign = 'left';

  for (let i = 0; i < emojiCount; i++) {
    const emoji = CUTE_EMOJIS[Math.floor(Math.random() * CUTE_EMOJIS.length)];
    const ex = Math.random() < 0.5
      ? Math.random() * (EMOJI_ZONE + 10)
      : EMOJI_ZONE + PADDING * 2 + FRAME_W + Math.random() * (EMOJI_ZONE + 10);

    const ey = PADDING + Math.random() * (stripH - PADDING * 2);
    const angle = (Math.random() - 0.5) * 0.8;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  }
}

function downloadStrip(canvas) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `myOS-photobooth-${Date.now()}.png`;
  localStorage.setItem('photostrip', canvas.toDataURL());
  a.click();
}

function roundRectClip(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.clip();
}

function roundRectStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async function fetchWeather() {
    try {
      const lat = 25.2048;
      const lon = 55.2708;
      
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
      );
      
      const data = await response.json();
      
      if (data.current) {
        const temp = Math.round(data.current.temperature_2m);
        const humidity = data.current.relative_humidity_2m;
        const windSpeed = Math.round(data.current.wind_speed_10m);
        const weatherCode = data.current.weather_code;
        
        document.getElementById('weather-temp').textContent = `${temp}°C`;
        
        const weatherDesc = getWeatherDescription(weatherCode);
        document.getElementById('weather-desc').textContent = weatherDesc;
        

        document.getElementById('weather-details').innerHTML = `
          <span>💨 ${windSpeed} km/h</span>
          <span>💧 ${humidity}%</span>
        `;
        
        const weatherIcon = getWeatherIcon(weatherCode);
        document.querySelector('.weather-icon').textContent = weatherIcon;
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
      document.getElementById('weather-desc').textContent = 'Unable to load';
    }
  }

  function getWeatherDescription(code) {
    const descriptions = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Foggy',
      51: 'Light drizzle',
      53: 'Drizzle',
      55: 'Heavy drizzle',
      61: 'Light rain',
      63: 'Rain',
      65: 'Heavy rain',
      71: 'Light snow',
      73: 'Snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Light showers',
      81: 'Showers',
      82: 'Heavy showers',
      85: 'Light snow showers',
      86: 'Snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with hail',
      99: 'Heavy thunderstorm'
    };
    return descriptions[code] || 'Unknown';
  }

  function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '🌤️';
    if (code <= 48) return '🌫️';
    if (code <= 55) return '🌦️';
    if (code <= 65) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌧️';
    if (code <= 86) return '🌨️';
    return '⛈️';
  }

  fetchWeather();
  

  setInterval(fetchWeather, 600000);

  setTimeout(() => {
    openApp('home');
  }, 100);

});
