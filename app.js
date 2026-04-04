// ── State ────────────────────────────────────────────────────────────────────
let medicines = JSON.parse(localStorage.getItem('medicines') || '[]');
let alreadyFired = JSON.parse(localStorage.getItem('alreadyFired') || '{}'); // {YYYY-MM-DD_HH:MM_id: true}

// ── Helpers ───────────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('medicines', JSON.stringify(medicines));
}

function saveFired() {
  localStorage.setItem('alreadyFired', JSON.stringify(alreadyFired));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function firedKey(id, time) {
  return `${todayStr()}_${time}_${id}`;
}

function isScheduledToday(med) {
  const day = new Date().getDay(); // 0=Sun,6=Sat
  if (med.days === 'daily') return true;
  if (med.days === 'weekdays') return day >= 1 && day <= 5;
  if (med.days === 'weekends') return day === 0 || day === 6;
  return true;
}

function formatTime(hhmm) {
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function daysLabel(days) {
  if (days === 'daily') return 'Every day';
  if (days === 'weekdays') return 'Weekdays';
  if (days === 'weekends') return 'Weekends';
  return days;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Audio alarm (Web Audio API) ───────────────────────────────────────────────
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = (start, freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.4);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.4);
    };
    beep(0,    880);
    beep(0.45, 1100);
    beep(0.9,  880);
    beep(1.35, 1100);
  } catch (_) { /* audio blocked by browser policy – silently skip */ }
}

// ── Notification permission ───────────────────────────────────────────────────
const banner = document.getElementById('notification-banner');
const bannerMsg = document.getElementById('notification-msg');
const enableBtn = document.getElementById('enable-notifications');

function checkNotificationPermission() {
  if (!('Notification' in window)) {
    bannerMsg.textContent = 'Your browser does not support notifications. In-app alerts will still work.';
    banner.classList.remove('hidden');
    document.getElementById('enable-notifications').style.display = 'none';
    return;
  }
  if (Notification.permission === 'default') {
    bannerMsg.textContent = 'Enable notifications to get medicine reminders even when the tab is in the background.';
    banner.classList.remove('hidden');
  } else if (Notification.permission === 'denied') {
    bannerMsg.textContent = 'Notifications are blocked. Please allow them in your browser settings for reminders.';
    banner.classList.remove('hidden');
    enableBtn.style.display = 'none';
  }
}

enableBtn.addEventListener('click', async () => {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    banner.classList.add('hidden');
  } else {
    bannerMsg.textContent = 'Notifications blocked. Reminders will appear as in-app alerts only.';
    enableBtn.style.display = 'none';
  }
});

// ── In-app alarm overlay ──────────────────────────────────────────────────────
const overlay = document.createElement('div');
overlay.id = 'alarm-overlay';
overlay.className = 'hidden';
overlay.innerHTML = `
  <div id="alarm-box">
    <div class="alarm-icon">⏰</div>
    <h3 id="alarm-title">Time to take your medicine!</h3>
    <p id="alarm-body"></p>
    <button id="alarm-dismiss">Got it</button>
  </div>`;
document.body.appendChild(overlay);

document.getElementById('alarm-dismiss').addEventListener('click', () => {
  overlay.classList.add('hidden');
});

function showAlarm(med) {
  const dose = med.dose ? ` — ${med.dose}` : '';
  document.getElementById('alarm-title').textContent = `Time for ${med.name}!`;
  document.getElementById('alarm-body').textContent = `${med.name}${dose}\nScheduled at ${formatTime(med.time)}`;
  overlay.classList.remove('hidden');
  playAlarm();

  if (Notification.permission === 'granted') {
    new Notification('Medicine Reminder', {
      body: `${med.name}${dose} at ${formatTime(med.time)}`,
      icon: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f48a.png',
    });
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
const medList = document.getElementById('med-list');
const upcomingList = document.getElementById('upcoming-list');

function renderMedicines() {
  medList.innerHTML = '';
  if (medicines.length === 0) {
    medList.innerHTML = '<p class="empty-state">No medicines added yet.</p>';
    return;
  }
  medicines.forEach((med, i) => {
    const card = document.createElement('div');
    card.className = `med-card${med.active ? '' : ' inactive'}`;

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'med-toggle';
    toggle.checked = med.active;
    toggle.title = med.active ? 'Disable reminder' : 'Enable reminder';
    toggle.addEventListener('change', () => {
      medicines[i].active = toggle.checked;
      save();
      renderMedicines();
      renderUpcoming();
    });

    const info = document.createElement('div');
    info.className = 'med-info';
    info.innerHTML = `
      <div class="med-name">${escHtml(med.name)}</div>
      <div class="med-meta">${formatTime(med.time)} &nbsp;·&nbsp; ${escHtml(med.dose || 'no dosage')} &nbsp;·&nbsp; ${daysLabel(med.days)}</div>
    `;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '×';
    del.title = 'Delete';
    del.addEventListener('click', () => {
      medicines.splice(i, 1);
      save();
      renderMedicines();
      renderUpcoming();
    });

    card.append(toggle, info, del);
    medList.appendChild(card);
  });
}

function renderUpcoming() {
  upcomingList.innerHTML = '';
  const now = nowHHMM();
  const todayMeds = medicines
    .filter(m => m.active && isScheduledToday(m))
    .map(m => ({ ...m }))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (todayMeds.length === 0) {
    upcomingList.innerHTML = '<p class="empty-state">Nothing scheduled for today.</p>';
    return;
  }

  // Find the next upcoming medicine
  const nextMed = todayMeds.find(m => m.time >= now);

  todayMeds.forEach(med => {
    const item = document.createElement('div');
    let statusClass, badge;
    if (med === nextMed) {
      statusClass = 'next';
      badge = 'Next';
    } else if (med.time < now) {
      statusClass = 'past';
      badge = 'Taken?';
    } else {
      statusClass = 'future';
      badge = 'Later';
    }

    item.className = `upcoming-item ${statusClass}`;
    item.innerHTML = `
      <span class="upcoming-time">${formatTime(med.time)}</span>
      <span class="upcoming-name">${escHtml(med.name)}</span>
      <span class="upcoming-dose">${escHtml(med.dose || '')}</span>
      <span class="upcoming-badge">${badge}</span>
    `;
    upcomingList.appendChild(item);
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Clock ─────────────────────────────────────────────────────────────────────
const clockEl = document.getElementById('current-time');

function updateClock() {
  const d = new Date();
  clockEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Alarm checker (runs every 30 seconds) ─────────────────────────────────────
function checkAlarms() {
  const now = nowHHMM();
  medicines.forEach(med => {
    if (!med.active) return;
    if (!isScheduledToday(med)) return;
    if (med.time !== now) return;

    const key = firedKey(med.id, med.time);
    if (alreadyFired[key]) return;

    alreadyFired[key] = true;
    saveFired();
    showAlarm(med);
  });

  // Clean up old fired keys (keep only today)
  const today = todayStr();
  Object.keys(alreadyFired).forEach(k => {
    if (!k.startsWith(today)) delete alreadyFired[k];
  });
  saveFired();
}

// ── Form ──────────────────────────────────────────────────────────────────────
const form = document.getElementById('med-form');
form.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('med-name').value.trim();
  const dose = document.getElementById('med-dose').value.trim();
  const time = document.getElementById('med-time').value;
  const days = document.getElementById('med-days').value;

  if (!name || !time) return;

  medicines.push({ id: generateId(), name, dose, time, days, active: true });
  save();
  renderMedicines();
  renderUpcoming();

  document.getElementById('med-name').value = '';
  document.getElementById('med-dose').value = '';
  document.getElementById('med-time').value = '';
});

// ── Init ──────────────────────────────────────────────────────────────────────
checkNotificationPermission();
renderMedicines();
renderUpcoming();
updateClock();

setInterval(updateClock, 1000);
setInterval(() => {
  checkAlarms();
  renderUpcoming(); // refresh "Next/Later" labels as time passes
}, 30_000);
checkAlarms(); // run once immediately on load
