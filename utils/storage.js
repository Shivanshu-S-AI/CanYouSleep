/**
 * Storage & Sync Helper for PW IOI Attendance Pro
 * Manages chrome.storage.local persistence and settings.
 * Purely handles live student attendance data from the portal.
 */

import { DEFAULT_TARGET, DEFAULT_WEEKDAY_SCHEDULE } from './calculator.js';

const DEFAULT_SETTINGS = {
  targetPercent: DEFAULT_TARGET,
  weekdaySchedule: DEFAULT_WEEKDAY_SCHEDULE,
  theme: 'system' // 'system', 'light', 'dark'
};

/**
 * Get items from chrome storage with fallback to localStorage
 */
export async function getStorageData(keys) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, resolve);
    } else {
      const result = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(k => {
        try {
          const item = localStorage.getItem('pw_attendance_' + k);
          if (item) result[k] = JSON.parse(item);
        } catch (e) {}
      });
      resolve(result);
    }
  });
}

/**
 * Set items in chrome storage with fallback
 */
export async function setStorageData(data) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(data, resolve);
    } else {
      Object.entries(data).forEach(([k, v]) => {
        try {
          localStorage.setItem('pw_attendance_' + k, JSON.stringify(v));
        } catch (e) {}
      });
      resolve();
    }
  });
}

/**
 * Get student settings
 */
export async function getSettings() {
  const data = await getStorageData(['settings']);
  return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
}

/**
 * Save student settings
 */
export async function saveSettings(settings) {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await setStorageData({ settings: updated });
  return updated;
}

/**
 * Get live attendance data scraped from portal DOM
 * Returns null if the user hasn't visited their attendance portal yet
 */
export async function getAttendanceData() {
  const data = await getStorageData(['attendanceData']);
  return data.attendanceData || null;
}

/**
 * Save live synced attendance data from portal DOM
 */
export async function saveSyncedAttendance(attendanceData) {
  const payload = {
    ...attendanceData,
    lastUpdated: new Date().toISOString()
  };
  await setStorageData({ attendanceData: payload });
  return payload;
}
