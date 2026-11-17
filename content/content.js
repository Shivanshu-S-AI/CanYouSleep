/**
 * PW IOI Attendance Pro - In-DOM Content Script
 * Automatically checks attendance from the DOM on app.pwioi.club
 * and injects a minimal container directly below the attendance dashboard.
 */

(function () {
  if (window.__PW_ATTENDANCE_INJECTED__) return;
  window.__PW_ATTENDANCE_INJECTED__ = true;

  console.log('[PW IOI Attendance Pro] Active on', window.location.href);

  let currentTarget = 75;
  let cachedData = null;

  // Retrieve saved target if available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['settings'], res => {
      if (res.settings && res.settings.targetPercent) {
        currentTarget = res.settings.targetPercent;
        if (cachedData) renderInDomContainer(cachedData);
      }
    });
  }

  // ==========================================
  // MATHEMATICAL LOGIC
  // ==========================================
  function calculateMetrics(attended, total, target = currentTarget) {
    attended = Math.max(0, Number(attended) || 0);
    total = Math.max(0, Number(total) || 0);
    target = Math.min(100, Math.max(1, Number(target) || 75));
    const r = target / 100;

    if (total === 0) {
      return {
        attended: 0, total: 0, currentPercent: 0,
        status: 'safe', classesToAttend: 0, daysMin: 0, daysMax: 0,
        bunkableClasses: 0, isDeficit: false
      };
    }

    const currentPercent = (attended / total) * 100;
    const isSafe = currentPercent >= target;
    const isWarning = currentPercent < target && currentPercent >= target - 5;
    const status = isSafe ? 'safe' : (isWarning ? 'warning' : 'critical');

    // Consecutive classes needed to reach target
    let classesToAttend = 0;
    if (!isSafe) {
      classesToAttend = Math.ceil((r * total - attended) / (1 - r));
      if (classesToAttend < 0) classesToAttend = 0;
    }

    // Days range based on 4-5 classes each day (Mon-Fri)
    const daysMin = classesToAttend > 0 ? Math.ceil(classesToAttend / 5) : 0;
    const daysMax = classesToAttend > 0 ? Math.ceil(classesToAttend / 4) : 0;

    // Bunk allowance (negative if below target)
    const exactBunkable = (attended - r * total) / r;
    const bunkableClasses = Math.floor(exactBunkable);
    const isDeficit = bunkableClasses < 0;

    return {
      attended,
      total,
      currentPercent: Number(currentPercent.toFixed(2)),
      status,
      classesToAttend,
      daysMin,
      daysMax,
      bunkableClasses,
      isDeficit
    };
  }

  // ==========================================
  // DOM ATTENDANCE SCRAPER
  // ==========================================
  function scrapeAttendanceFromDOM() {
    const subjects = [];
    let overallAttended = 0;
    let overallTotal = 0;

    // Strategy 1: Check table rows
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td'));
        if (cells.length >= 2) {
          const name = cells[0].innerText.trim();
          let att = null;
          let tot = null;

          for (const cell of cells) {
            const m = cell.innerText.match(/(\d+)\s*[\/|\\]\s*(\d+)/);
            if (m) {
              att = parseInt(m[1], 10);
              tot = parseInt(m[2], 10);
              break;
            }
          }

          if (att !== null && tot !== null && tot > 0) {
            subjects.push({
              name: name || 'Subject ' + (subjects.length + 1),
              attended: att,
              total: tot,
              percentage: Number(((att / tot) * 100).toFixed(2))
            });
            overallAttended += att;
            overallTotal += tot;
          }
        }
      });
    });

    // Strategy 2: Check card containers
    if (subjects.length === 0) {
      const cards = document.querySelectorAll('div[class*="rounded"], div[class*="border"], div[class*="shadow"]');
      cards.forEach(card => {
        const text = card.innerText;
        if (text.includes('%') && (text.includes('Attended') || text.includes('/') || text.includes('Classes'))) {
          const m = text.match(/(\d+)\s*\/\s*(\d+)/);
          if (m) {
            const att = parseInt(m[1], 10);
            const tot = parseInt(m[2], 10);
            if (tot > 0 && tot >= att && !subjects.some(s => s.attended === att && s.total === tot)) {
              const lines = text.split('\n').filter(l => l.trim().length > 0);
              subjects.push({
                name: lines[0] || 'Subject ' + (subjects.length + 1),
                attended: att,
                total: tot,
                percentage: Number(((att / tot) * 100).toFixed(2))
              });
              overallAttended += att;
              overallTotal += tot;
            }
          }
        }
      });
    }

    if (overallTotal > 0) {
      return {
        overall: {
          attended: overallAttended,
          total: overallTotal,
          missed: overallTotal - overallAttended,
          percentage: Number(((overallAttended / overallTotal) * 100).toFixed(2))
        },
        subjects,
        lastUpdated: new Date().toISOString()
      };
    }

    return null;
  }

  // ==========================================
  // IN-DOM CONTAINER INJECTION
  // ==========================================
  function findAttendanceDashboardContainer() {
    // 1. Look for table wrapper
    const table = document.querySelector('table');
    if (table) {
      const container = table.closest('div.bg-white, div.rounded-xl, div.rounded-lg, div[class*="border"], div[class*="shadow"]');
      if (container) return container;
      return table.parentElement;
    }

    // 2. Look for elements containing "Attendance" heading
    const headings = document.querySelectorAll('h1, h2, h3, h4');
    for (const h of headings) {
      if (h.innerText.toLowerCase().includes('attendance')) {
        const card = h.closest('div.bg-white, div.rounded-xl, div.rounded-lg, div[class*="border"]');
        if (card) return card;
        return h.parentElement;
      }
    }

    // 3. Fallback to main content container
    const main = document.querySelector('main');
    if (main) {
      const firstChild = main.querySelector('div');
      return firstChild || main;
    }

    return document.body;
  }

  function renderInDomContainer(data) {
    if (!data || !data.overall) return;
    cachedData = data;

    const targetContainer = findAttendanceDashboardContainer();
    if (!targetContainer) return;

    let helper = document.getElementById('pwioi-attendance-helper');
    if (!helper) {
      helper = document.createElement('div');
      helper.id = 'pwioi-attendance-helper';

      // Insert directly below the attendance dashboard container
      if (targetContainer.parentNode) {
        targetContainer.parentNode.insertBefore(helper, targetContainer.nextSibling);
      } else {
        document.body.appendChild(helper);
      }
    }

    const m = calculateMetrics(data.overall.attended, data.overall.total, currentTarget);

    helper.innerHTML = `
      <div class="pwa-dom-header">
        <div class="pwa-dom-title-wrap">
          <span class="pwa-dom-badge">PW IOI</span>
          <h3 class="pwa-dom-title">Attendance Planner</h3>
        </div>
        <div class="pwa-dom-target-group">
          <span class="pwa-dom-target-label">Target:</span>
          <button class="pwa-dom-pill ${currentTarget === 75 ? 'active' : ''}" data-target="75">75%</button>
          <button class="pwa-dom-pill ${currentTarget === 80 ? 'active' : ''}" data-target="80">80%</button>
          <button class="pwa-dom-pill ${currentTarget === 85 ? 'active' : ''}" data-target="85">85%</button>
          <button class="pwa-dom-pill ${currentTarget === 90 ? 'active' : ''}" data-target="90">90%</button>
          <input type="number" class="pwa-dom-custom-target" id="pwa-dom-custom-input" min="1" max="100" placeholder="Custom" value="${[75, 80, 85, 90].includes(currentTarget) ? '' : currentTarget}" />
        </div>
      </div>

      <div class="pwa-dom-content">
        <div class="pwa-dom-metric-box ${m.classesToAttend > 0 ? 'pwa-dom-metric-needed' : 'pwa-dom-metric-met'}">
          <span class="pwa-dom-metric-label">REQUIRED CLASSES (${currentTarget}%)</span>
          <span class="pwa-dom-metric-val">${m.classesToAttend > 0 ? '+' + m.classesToAttend : '0'}</span>
          <span class="pwa-dom-metric-subtag">${m.classesToAttend > 0 ? `~${m.daysMin}–${m.daysMax} days` : 'Target met'}</span>
        </div>

        <div class="pwa-dom-details">
          <div class="pwa-dom-status-text">
            ${m.classesToAttend > 0 ? `
              Current: <strong>${m.currentPercent}%</strong> (${data.overall.attended}/${data.overall.total}). Attend <strong>${m.classesToAttend} consecutive classes</strong> to reach <strong>${currentTarget}%</strong>.
            ` : `
              Current: <strong>${m.currentPercent}%</strong> (${data.overall.attended}/${data.overall.total}). Target met.
            `}
          </div>

          <div class="pwa-dom-secondary-bunk ${m.classesToAttend > 0 ? 'dom-pill-danger' : 'dom-pill-safe'}">
            ${m.classesToAttend > 0 ? `
              <span>Deficit: <strong>${Math.abs(m.bunkableClasses)} classes</strong>. Allowed absences: <strong>0</strong>.</span>
            ` : `
              <span>Allowed absences: <strong>${m.bunkableClasses} classes</strong>.</span>
            `}
          </div>
        </div>
      </div>
    `;

    // Target selector event listeners
    helper.querySelectorAll('.pwa-dom-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTarget = Number(btn.getAttribute('data-target'));
        chrome.storage.local.set({ settings: { targetPercent: currentTarget } });
        renderInDomContainer(cachedData);
        enhanceTableRows();
      });
    });

    const customInput = helper.querySelector('#pwa-dom-custom-input');
    if (customInput) {
      customInput.addEventListener('change', () => {
        const val = Number(customInput.value);
        if (val >= 1 && val <= 100) {
          currentTarget = val;
          chrome.storage.local.set({ settings: { targetPercent: currentTarget } });
          renderInDomContainer(cachedData);
          enhanceTableRows();
        }
      });
    }

    // Enhance table rows with small pills
    enhanceTableRows();
  }

  function enhanceTableRows() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td'));
        for (const cell of cells) {
          const m = cell.innerText.match(/(\d+)\s*[\/|\\]\s*(\d+)/);
          if (m) {
            const att = parseInt(m[1], 10);
            const tot = parseInt(m[2], 10);
            if (tot > 0) {
              const calc = calculateMetrics(att, tot, currentTarget);
              let badge = cell.querySelector('.pwa-table-badge');
              if (!badge) {
                badge = document.createElement('span');
                badge.className = 'pwa-table-badge';
                cell.appendChild(badge);
              }
              if (calc.isDeficit) {
                badge.className = 'pwa-table-badge pwa-table-badge-danger';
                badge.innerText = `Attend ${calc.classesToAttend}`;
              } else {
                badge.className = 'pwa-table-badge pwa-table-badge-safe';
                badge.innerText = `Allowed: ${calc.bunkableClasses}`;
              }
            }
            break;
          }
        }
      });
    });
  }

  // ==========================================
  // SYNC LOOP & MUTATION OBSERVER
  // ==========================================
  function runCheck() {
    const data = scrapeAttendanceFromDOM();
    if (data && data.overall) {
      renderInDomContainer(data);
      // Persist to storage for extension popup
      chrome.storage.local.set({ attendanceData: data });
      
      const m = calculateMetrics(data.overall.attended, data.overall.total, currentTarget);
      chrome.runtime.sendMessage({
        type: 'ATTENDANCE_UPDATED',
        payload: {
          percentage: m.currentPercent,
          status: m.status,
          isNegative: m.isDeficit,
          deficit: m.classesToAttend
        }
      });
    }
  }

  // Initial check
  runCheck();

  // Polling / MutationObserver for dynamic Next.js navigation
  const observer = new MutationObserver(() => {
    if (!document.getElementById('pwioi-attendance-helper')) {
      runCheck();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Listen for refresh messages from popup
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.type === 'REFRESH_ATTENDANCE') {
      runCheck();
      sendResponse({ success: true, data: cachedData });
      return true;
    }
  });

})();
