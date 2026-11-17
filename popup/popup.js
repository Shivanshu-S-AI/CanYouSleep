/**
 * PW IOI Attendance Pro - Modern Popup Controller
 * Implements clean state management, reactive date simulations, and subject filtering.
 * Styled in strict adherence to Apple Design System (apple/DESIGN.md).
 * Strictly operates on live student data from the portal.
 */

import {
  DEFAULT_TARGET,
  DEFAULT_WEEKDAY_SCHEDULE,
  calculateAttendance,
  calculateDateRangeBunk,
  simulateMissScenario,
  getPresetRanges,
  formatLocalDate
} from '../utils/calculator.js';

import {
  getAttendanceData,
  getSettings,
  saveSettings,
  setStorageData
} from '../utils/storage.js';

// Application State
let state = {
  targetPercent: DEFAULT_TARGET,
  attendanceData: null,
  weekdaySchedule: { ...DEFAULT_WEEKDAY_SCHEDULE },
  theme: 'light',
  simStart: '',
  simEnd: '',
  simFutureClasses: 0,
  searchFilter: ''
};

// DOM References
const els = {
  themeToggle: document.getElementById('theme-toggle'),
  refreshBtn: document.getElementById('refresh-btn'),

  barCurrentPct: document.getElementById('bar-current-pct'),
  barAttendedTotal: document.getElementById('bar-attended-total'),
  barTargetPct: document.getElementById('bar-target-pct'),

  navButtons: document.querySelectorAll('.tab-btn, .segment-btn, .nav-btn'),
  tabViews: document.querySelectorAll('.tab-view'),

  toggleScheduleBtn: document.getElementById('toggle-schedule-btn'),
  scheduleCollapse: document.getElementById('schedule-collapse'),
  presetPills: document.querySelectorAll('.preset-chip, .apple-chip, .preset-pill'),
  simStartDate: document.getElementById('sim-start-date'),
  simEndDate: document.getElementById('sim-end-date'),
  rangeDaysCount: document.getElementById('range-days-count'),
  rangeClassesCount: document.getElementById('range-classes-count'),

  simResultCard: document.getElementById('sim-result-card'),
  simBadgeTag: document.getElementById('sim-badge-tag'),
  simAllowableVal: document.getElementById('sim-allowable-val'),
  simVerdictDesc: document.getElementById('sim-verdict-desc'),

  simWhatIfSlider: document.getElementById('sim-whatif-slider'),
  sliderCountDisplay: document.getElementById('slider-count-display'),
  sliderProjectedPct: document.getElementById('slider-projected-pct'),
  sliderStatusPill: document.getElementById('slider-status-pill'),

  subjectsTotalCount: document.getElementById('subjects-total-count'),
  subjectSearchInput: document.getElementById('subject-search-input'),
  subjectsContainer: document.getElementById('subjects-container')
};

// ==========================================
// INITIALIZATION
// ==========================================
async function init() {
  const settings = await getSettings();
  state.targetPercent = settings.targetPercent || DEFAULT_TARGET;
  state.weekdaySchedule = settings.weekdaySchedule || { ...DEFAULT_WEEKDAY_SCHEDULE };
  state.theme = settings.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  applyTheme(state.theme);

  // Initialize presets
  const presets = getPresetRanges();
  state.simStart = presets.thisWeek.start;
  state.simEnd = presets.thisWeek.end;
  els.simStartDate.value = state.simStart;
  els.simEndDate.value = state.simEnd;

  // Initialize weekday schedule inputs
  for (let d = 1; d <= 5; d++) {
    const input = document.getElementById(`sched-${d}`);
    if (input) input.value = state.weekdaySchedule[d] || 5;
  }

  // Load live attendance data
  await loadAttendanceData();

  // Attach event handlers
  setupEventListeners();
}

async function loadAttendanceData() {
  const data = await getAttendanceData();
  state.attendanceData = data;
  renderAll();
}

// ==========================================
// RENDERING
// ==========================================
function renderAll() {
  renderOverviewRibbon();
  renderSimulator();
  renderSubjects();
}

function renderOverviewRibbon() {
  if (!state.attendanceData || !state.attendanceData.overall) {
    els.barCurrentPct.innerText = '--%';
    els.barCurrentPct.className = 'overview-value font-mono';
    els.barAttendedTotal.innerText = '-- / --';
    els.barTargetPct.innerText = `${state.targetPercent}%`;
    return;
  }

  const overall = state.attendanceData.overall;
  els.barCurrentPct.innerText = `${overall.percentage}%`;
  els.barCurrentPct.className = overall.percentage >= state.targetPercent
    ? 'overview-value font-mono text-safe'
    : 'overview-value font-mono text-danger';
  els.barAttendedTotal.innerText = `${overall.attended} / ${overall.total}`;
  els.barTargetPct.innerText = `${state.targetPercent}%`;
}

function renderSimulator() {
  if (!state.attendanceData || !state.attendanceData.overall) {
    els.rangeDaysCount.innerText = '--d';
    els.rangeClassesCount.innerText = '--c';
    els.simResultCard.className = 'vercel-card sim-card status-safe';
    els.simBadgeTag.innerText = 'NO DATA';
    els.simAllowableVal.innerText = '--';
    els.simVerdictDesc.innerText = 'Open portal attendance page to sync data.';
    els.sliderProjectedPct.innerText = '--%';
    return;
  }

  const overall = state.attendanceData.overall;
  const sim = calculateDateRangeBunk(
    overall.attended,
    overall.total,
    state.targetPercent,
    state.simStart,
    state.simEnd,
    state.weekdaySchedule
  );

  state.simFutureClasses = sim.futureClasses;
  els.rangeDaysCount.innerText = `${sim.weekdaysCount}d`;
  els.rangeClassesCount.innerText = `${sim.futureClasses}c`;

  if (sim.isNegative) {
    els.simResultCard.className = 'vercel-card sim-card status-danger';
    els.simBadgeTag.innerText = 'DEFICIT';
    els.simAllowableVal.innerText = `${sim.maxMissable}`;
    els.simVerdictDesc.innerText = sim.verdict;
  } else {
    els.simResultCard.className = 'vercel-card sim-card status-safe';
    els.simBadgeTag.innerText = 'ALLOWED ABSENCES';
    els.simAllowableVal.innerText = `+${sim.maxMissable}`;
    els.simVerdictDesc.innerText = sim.verdict;
  }

  // Update slider bounds
  els.simWhatIfSlider.max = Math.max(1, sim.futureClasses);
  if (Number(els.simWhatIfSlider.value) > sim.futureClasses) {
    els.simWhatIfSlider.value = 0;
  }
  updateWhatIfSlider();
}

function updateWhatIfSlider() {
  if (!state.attendanceData || !state.attendanceData.overall) {
    els.sliderProjectedPct.innerText = '--%';
    return;
  }

  const missCount = Number(els.simWhatIfSlider.value) || 0;
  els.sliderCountDisplay.innerText = missCount;

  const overall = state.attendanceData.overall;
  const scenario = simulateMissScenario(
    overall.attended,
    overall.total,
    state.simFutureClasses,
    missCount
  );

  els.sliderProjectedPct.innerText = `${scenario.newPercent}%`;

  if (scenario.newPercent >= state.targetPercent) {
    els.sliderStatusPill.className = 'status-pill pill-safe';
    els.sliderStatusPill.innerText = 'Target Met';
  } else {
    els.sliderStatusPill.className = 'status-pill pill-danger';
    els.sliderStatusPill.innerText = 'Deficit';
  }
}

function renderSubjects() {
  const allSubjects = state.attendanceData?.subjects || [];
  const query = state.searchFilter.trim().toLowerCase();
  const subjects = query
    ? allSubjects.filter(s => s.name.toLowerCase().includes(query) || (s.code && s.code.toLowerCase().includes(query)))
    : allSubjects;

  els.subjectsTotalCount.innerText = `${subjects.length}`;

  if (subjects.length === 0) {
    els.subjectsContainer.innerHTML = `
      <div style="text-align: center; padding: 28px 12px; color: var(--fg-tertiary); font-size: 11.5px; line-height: 1.5;">
        ${allSubjects.length === 0 ? 'No course data.<br/><span style="font-size: 10.5px; opacity: 0.8;">Open portal attendance page to sync.</span>' : 'No courses found.'}
      </div>
    `;
    return;
  }

  els.subjectsContainer.innerHTML = subjects.map((sub, idx) => {
    const calc = calculateAttendance(sub.attended, sub.total, state.targetPercent);
    const isSafe = calc.status === 'safe';
    const isWarn = calc.status === 'warning';
    const badgeColor = isSafe ? 'var(--green-fg)' : (isWarn ? 'var(--red-fg)' : 'var(--red-fg)');
    const barColor = isSafe ? 'var(--green-dot)' : 'var(--red-dot)';
    const code = sub.code || `C${idx + 1}`;

    const pillClass = calc.isDeficit ? 'pill-danger' : 'pill-safe';
    const pillText = calc.isDeficit ? `Attend ${calc.classesToAttend}` : `Allowed: ${calc.bunkableClasses}`;

    return `
      <div class="course-row-item">
        <div class="course-top-row">
          <div class="course-info">
            <span class="course-tag font-mono">${code}</span>
            <span class="course-title" title="${sub.name}">${sub.name}</span>
          </div>
          <span class="course-percent font-mono" style="color: ${badgeColor};">${calc.currentPercent}%</span>
        </div>
        <div class="course-bar">
          <div class="course-bar-fill" style="width: ${Math.min(100, calc.currentPercent)}%; background-color: ${barColor};"></div>
        </div>
        <div class="course-foot">
          <span class="course-ratio font-mono">${sub.attended} / ${sub.total}</span>
          <span class="course-pill ${pillClass}">${pillText}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// THEME & EVENT HANDLERS
// ==========================================
function applyTheme(theme) {
  state.theme = theme;
  document.body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
  if (els.themeToggle) {
    const glyph = els.themeToggle.querySelector('.icon-glyph') || els.themeToggle.querySelector('span');
    if (glyph) glyph.innerText = theme === 'dark' ? '☀️' : '🌙';
  }
  saveSettings({ theme });
}

function setupEventListeners() {
  // Theme Toggle
  if (els.themeToggle) {
    els.themeToggle.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
  }

  // Refresh Sync Button
  if (els.refreshBtn) {
    els.refreshBtn.addEventListener('click', () => {
      els.refreshBtn.classList.add('rotating');
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs[0] && tabs[0].url && tabs[0].url.includes('pwioi.club')) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'REFRESH_ATTENDANCE' }, res => {
              if (res && res.data) {
                state.attendanceData = res.data;
                renderAll();
              }
            });
          }
        });
      }
      setTimeout(() => els.refreshBtn.classList.remove('rotating'), 600);
    });
  }

  // Navigation Segment Control
  els.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      els.navButtons.forEach(b => b.classList.remove('active'));
      els.tabViews.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const targetEl = document.getElementById(targetTabId);
      if (targetEl) targetEl.classList.add('active');
    });
  });

  // Schedule Drawer Toggle
  if (els.toggleScheduleBtn && els.scheduleCollapse) {
    els.toggleScheduleBtn.addEventListener('click', () => {
      els.scheduleCollapse.classList.toggle('hidden');
    });
  }

  // Schedule Inputs
  for (let d = 1; d <= 5; d++) {
    const input = document.getElementById(`sched-${d}`);
    if (input) {
      input.addEventListener('change', () => {
        state.weekdaySchedule[d] = Math.max(0, Number(input.value) || 0);
        saveSettings({ weekdaySchedule: state.weekdaySchedule });
        renderSimulator();
      });
    }
  }

  // Presets
  const presets = getPresetRanges();
  els.presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      els.presetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const presetKey = pill.getAttribute('data-preset');
      const p = presets[presetKey];
      if (p) {
        state.simStart = p.start;
        state.simEnd = p.end;
        if (els.simStartDate) els.simStartDate.value = p.start;
        if (els.simEndDate) els.simEndDate.value = p.end;
        renderSimulator();
      }
    });
  });

  // Date Inputs
  if (els.simStartDate) {
    els.simStartDate.addEventListener('change', e => {
      state.simStart = e.target.value;
      els.presetPills.forEach(p => p.classList.remove('active'));
      renderSimulator();
    });
  }

  if (els.simEndDate) {
    els.simEndDate.addEventListener('change', e => {
      state.simEnd = e.target.value;
      els.presetPills.forEach(p => p.classList.remove('active'));
      renderSimulator();
    });
  }

  // What-If Slider
  if (els.simWhatIfSlider) {
    els.simWhatIfSlider.addEventListener('input', updateWhatIfSlider);
  }

  // Subject Search Filter
  if (els.subjectSearchInput) {
    els.subjectSearchInput.addEventListener('input', e => {
      state.searchFilter = e.target.value;
      renderSubjects();
    });
  }

  // Listen for target percentage changes from storage (e.g. if updated in DOM container)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings && newSettings.targetPercent && newSettings.targetPercent !== state.targetPercent) {
          state.targetPercent = newSettings.targetPercent;
          renderAll();
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
