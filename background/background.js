/**
 * PW IOI Attendance Pro - Background Service Worker
 * Manages badge indicator, tab communication, and portal links.
 */

// Colors matching PW IOI / modern alert design
const BADGE_COLORS = {
  safe: '#10B981',     // Emerald Green
  warning: '#F59E0B',  // Amber
  critical: '#EF4444', // Danger Red
  default: '#1B3A6A'   // PW IOI Brand Navy
};

// Update extension icon badge
function updateBadge(percentage, status, isNegative, deficit) {
  if (typeof chrome === 'undefined' || !chrome.action) return;

  if (percentage === undefined || percentage === null) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  const rounded = Math.round(percentage);
  let text = `${rounded}%`;
  
  if (isNegative && deficit > 0) {
    text = `-${deficit}`;
  }

  chrome.action.setBadgeText({ text });

  let color = BADGE_COLORS.safe;
  if (status === 'critical') {
    color = BADGE_COLORS.critical;
  } else if (status === 'warning') {
    color = BADGE_COLORS.warning;
  }

  chrome.action.setBadgeBackgroundColor({ color });
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('PW IOI Attendance Pro installed.');
  chrome.storage.local.get(['attendanceData'], result => {
    if (result.attendanceData && result.attendanceData.overall) {
      const p = result.attendanceData.overall.percentage;
      const status = p >= 75 ? 'safe' : (p >= 70 ? 'warning' : 'critical');
      updateBadge(p, status, p < 75, 0);
    } else {
      chrome.action.setBadgeText({ text: 'PW' });
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.default });
    }
  });
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ATTENDANCE_UPDATED') {
    const { percentage, status, isNegative, deficit } = message.payload || {};
    updateBadge(percentage, status, isNegative, deficit);
    sendResponse({ success: true });
  } else if (message.type === 'OPEN_PORTAL') {
    const targetUrl = 'https://app.pwioi.club/dashboard/student/attendance';
    chrome.tabs.query({ url: '*://app.pwioi.club/*' }, tabs => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true, url: targetUrl });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: targetUrl });
      }
    });
    sendResponse({ success: true });
  }
  return true;
});

// Storage change listener
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.attendanceData) {
    const data = changes.attendanceData.newValue;
    if (data && data.overall) {
      const p = data.overall.percentage;
      const status = p >= 75 ? 'safe' : (p >= 70 ? 'warning' : 'critical');
      updateBadge(p, status, p < 75, 0);
    }
  }
});
