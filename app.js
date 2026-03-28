const STORAGE_KEY = 'daily-scheduler';
const HISTORY_KEY = 'daily-scheduler-history';
const SCHEDULE_HOUR = 9;
const SCHEDULE_MINUTE = 0;

let scheduledUrl = localStorage.getItem(STORAGE_KEY) || '';
let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
let countdownTimer = null;
let scheduleTimer = null;

// Elements
const urlForm = document.getElementById('url-form');
const urlInput = document.getElementById('url-input');
const statusBox = document.getElementById('status-box');
const currentUrlEl = document.getElementById('current-url');
const nextTimeEl = document.getElementById('next-time');
const countdownEl = document.getElementById('countdown');
const visitNowBtn = document.getElementById('visit-now-btn');
const removeBtn = document.getElementById('remove-btn');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

function getNext9AM() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(SCHEDULE_HOUR, SCHEDULE_MINUTE, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function formatCountdown(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function formatDateTime(date) {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(url) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Daily Scheduler', {
      body: `Opening ${url}`,
      icon: 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(url),
    });
  }
}

function visitUrl(url) {
  window.open(url, '_blank', 'noopener');
  sendNotification(url);
  addHistory(url);
}

function addHistory(url) {
  history.unshift({ url, time: new Date().toISOString() });
  if (history.length > 50) history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<li class="empty">No visits yet.</li>';
    clearHistoryBtn.classList.add('hidden');
    return;
  }

  clearHistoryBtn.classList.remove('hidden');
  historyList.innerHTML = history.map(entry => {
    const d = new Date(entry.time);
    return `<li>
      <span class="hist-time">${formatDateTime(d)}</span>
      <span class="hist-url" title="${entry.url}">${entry.url}</span>
    </li>`;
  }).join('');
}

function startCountdown() {
  clearInterval(countdownTimer);
  clearTimeout(scheduleTimer);

  function tick() {
    const next = getNext9AM();
    const msUntil = next - Date.now();
    nextTimeEl.textContent = formatDateTime(next);
    countdownEl.textContent = formatCountdown(msUntil);

    // Schedule the actual visit
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(() => {
      visitUrl(scheduledUrl);
      // Restart after visit to schedule next day
      setTimeout(startCountdown, 1000);
    }, msUntil);
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function stopTimers() {
  clearInterval(countdownTimer);
  clearTimeout(scheduleTimer);
}

function renderSchedule() {
  if (scheduledUrl) {
    urlInput.value = scheduledUrl;
    currentUrlEl.textContent = scheduledUrl;
    statusBox.classList.remove('hidden');
    startCountdown();
    requestNotificationPermission();
  } else {
    statusBox.classList.add('hidden');
    stopTimers();
  }
}

// Form submit
urlForm.addEventListener('submit', e => {
  e.preventDefault();
  const val = urlInput.value.trim();
  if (!val) return;

  // Prepend https:// if no protocol given
  const url = /^https?:\/\//i.test(val) ? val : 'https://' + val;
  urlInput.value = url;

  scheduledUrl = url;
  localStorage.setItem(STORAGE_KEY, scheduledUrl);
  renderSchedule();
});

visitNowBtn.addEventListener('click', () => {
  if (scheduledUrl) visitUrl(scheduledUrl);
});

removeBtn.addEventListener('click', () => {
  scheduledUrl = '';
  localStorage.removeItem(STORAGE_KEY);
  urlInput.value = '';
  renderSchedule();
});

clearHistoryBtn.addEventListener('click', () => {
  history = [];
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

// Init
renderHistory();
renderSchedule();
