/**
 * PW IOI Attendance Pro - Core Mathematics & Simulator Engine
 * Handles precise attendance calculation, bunk limits, recovery thresholds,
 * weekday counting, and date-range simulations.
 */

export const DEFAULT_TARGET = 75;
export const DEFAULT_DAILY_CLASSES = 5;

// Default Monday to Friday class distribution (4-5 classes per day)
export const DEFAULT_WEEKDAY_SCHEDULE = {
  1: 5, // Monday
  2: 5, // Tuesday
  3: 5, // Wednesday
  4: 4, // Thursday
  5: 5  // Friday
};

/**
 * Calculates current attendance, status, classes to attend, and safe bunks.
 * @param {number} attended - Classes attended so far
 * @param {number} total - Total classes held so far
 * @param {number} targetPercent - Target percentage (e.g. 75, 80, 85)
 * @param {number} dailyAvgClasses - Expected classes per day (default 4.5 or 5)
 */
export function calculateAttendance(attended, total, targetPercent = DEFAULT_TARGET, dailyAvgClasses = DEFAULT_DAILY_CLASSES) {
  attended = Math.max(0, Number(attended) || 0);
  total = Math.max(0, Number(total) || 0);
  targetPercent = Math.min(100, Math.max(1, Number(targetPercent) || DEFAULT_TARGET));
  const r = targetPercent / 100;

  if (total === 0) {
    return {
      attended: 0,
      total: 0,
      missed: 0,
      currentPercent: 0,
      targetPercent,
      status: 'safe',
      classesToAttend: 0,
      daysToAttendMin: 0,
      daysToAttendMax: 0,
      bunkableClasses: 0,
      isDeficit: false,
      deficitClasses: 0
    };
  }

  const missed = Math.max(0, total - attended);
  const currentPercent = (attended / total) * 100;

  // Status badge
  let status = 'safe';
  if (currentPercent < targetPercent - 5) {
    status = 'critical';
  } else if (currentPercent < targetPercent) {
    status = 'warning';
  }

  // Classes required consecutively to hit target
  let classesToAttend = 0;
  if (currentPercent < targetPercent) {
    // Formula: (A + x) / (T + x) >= r  =>  x >= (r*T - A) / (1 - r)
    classesToAttend = Math.ceil((r * total - attended) / (1 - r));
    if (classesToAttend < 0) classesToAttend = 0;
  }

  // Days needed based on 4 to 5 classes per day range
  const daysToAttendMin = classesToAttend > 0 ? Math.ceil(classesToAttend / 5) : 0;
  const daysToAttendMax = classesToAttend > 0 ? Math.ceil(classesToAttend / 4) : 0;

  // Bunkable classes
  // Formula: A / (T + y) >= r  =>  y <= (A - r*T) / r
  // If A/T < r, the value is negative, indicating a deficit (need to attend, cannot bunk)
  const exactBunkable = (attended - r * total) / r;
  let bunkableClasses = 0;
  let isDeficit = false;
  let deficitClasses = 0;

  if (currentPercent >= targetPercent) {
    bunkableClasses = Math.floor(exactBunkable);
    isDeficit = false;
    deficitClasses = 0;
  } else {
    // Negative value represents how far behind the student is
    bunkableClasses = Math.floor(exactBunkable); // Negative number, e.g. -4
    isDeficit = true;
    deficitClasses = classesToAttend; // Consecutive classes required to break even
  }

  return {
    attended,
    total,
    missed,
    currentPercent: Number(currentPercent.toFixed(2)),
    targetPercent,
    status,
    classesToAttend,
    daysToAttendMin,
    daysToAttendMax,
    bunkableClasses, // Can be positive or negative
    isDeficit,
    deficitClasses
  };
}

/**
 * Calculates date range details, college weekdays count, and future class count.
 * @param {string|Date} startDate 
 * @param {string|Date} endDate 
 * @param {Object} schedule - mapping of day number (1=Mon...5=Fri) to class count
 */
export function getCollegeDaysInRange(startDate, endDate, schedule = DEFAULT_WEEKDAY_SCHEDULE) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (end < start) {
    return {
      totalDays: 0,
      weekdaysCount: 0,
      totalClasses: 0,
      dayList: []
    };
  }

  const dayList = [];
  const curr = new Date(start);
  let weekdaysCount = 0;
  let totalClasses = 0;

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  while (curr <= end) {
    const dayOfWeek = curr.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const classes = isWeekend ? 0 : (schedule[dayOfWeek] ?? DEFAULT_DAILY_CLASSES);

    const dayObj = {
      date: curr.toISOString().split('T')[0],
      dayName: weekdayNames[dayOfWeek],
      shortDay: shortDays[dayOfWeek],
      isWeekend,
      classes
    };

    dayList.push(dayObj);

    if (!isWeekend) {
      weekdaysCount++;
      totalClasses += classes;
    }

    curr.setDate(curr.getDate() + 1);
  }

  return {
    totalDays: dayList.length,
    weekdaysCount,
    totalClasses,
    dayList
  };
}

/**
 * Date-Range Bunk Simulator
 * Calculates how many classes a student can miss during a specified date range
 * while maintaining the target attendance threshold.
 * 
 * Supports negative values to highlight attendance shortage.
 * 
 * @param {number} attended - Current attended classes
 * @param {number} total - Current total classes
 * @param {number} targetPercent - Target percentage (e.g. 75)
 * @param {string|Date} startDate - Start of range
 * @param {string|Date} endDate - End of range
 * @param {Object} schedule - Classes per weekday (Mon-Fri)
 */
export function calculateDateRangeBunk(
  attended,
  total,
  targetPercent = DEFAULT_TARGET,
  startDate,
  endDate,
  schedule = DEFAULT_WEEKDAY_SCHEDULE
) {
  attended = Math.max(0, Number(attended) || 0);
  total = Math.max(0, Number(total) || 0);
  targetPercent = Math.min(100, Math.max(1, Number(targetPercent) || DEFAULT_TARGET));
  const r = targetPercent / 100;

  const rangeInfo = getCollegeDaysInRange(startDate, endDate, schedule);
  const futureClasses = rangeInfo.totalClasses;

  // Current baseline
  const currentCalc = calculateAttendance(attended, total, targetPercent);

  if (futureClasses === 0) {
    return {
      ...rangeInfo,
      futureClasses: 0,
      maxMissable: currentCalc.bunkableClasses,
      isNegative: currentCalc.bunkableClasses < 0,
      mustAttendClasses: currentCalc.classesToAttend,
      projectedAttendanceIfAllAttended: currentCalc.currentPercent,
      projectedAttendanceIfAllMissed: currentCalc.currentPercent,
      verdict: 'No classes scheduled in selected range.'
    };
  }

  // Scenario 1: Attend ALL future classes in range
  const totalIfAllAttended = total + futureClasses;
  const attendedIfAllAttended = attended + futureClasses;
  const pctIfAllAttended = (attendedIfAllAttended / totalIfAllAttended) * 100;

  // Scenario 2: Miss ALL future classes in range
  const totalIfAllMissed = total + futureClasses;
  const attendedIfAllMissed = attended;
  const pctIfAllMissed = (attendedIfAllMissed / totalIfAllMissed) * 100;

  // Maximum classes that can be missed in this period while maintaining >= target:
  // (A + F - m) / (T + F) >= r  =>  m <= (A + F) - r*(T + F)
  const exactMaxMissable = (attended + futureClasses) - r * (total + futureClasses);
  let maxMissable = Math.floor(exactMaxMissable);

  let isNegative = false;
  let mustAttendClasses = 0;
  let verdict = '';

  if (maxMissable < 0) {
    isNegative = true;
    mustAttendClasses = Math.ceil((r * totalIfAllAttended - attendedIfAllAttended) / (1 - r));
    if (mustAttendClasses < 0) mustAttendClasses = 0;

    verdict = `Attend all scheduled classes plus ${currentCalc.classesToAttend} consecutive classes to reach ${targetPercent}%.`;
  } else if (maxMissable === 0) {
    verdict = `Attend all scheduled classes to maintain ${targetPercent}%.`;
  } else if (maxMissable >= futureClasses) {
    verdict = `You can miss all scheduled classes. Projected: ${pctIfAllMissed.toFixed(1)}%.`;
  } else {
    verdict = `You can miss up to ${maxMissable} scheduled classes and maintain ${targetPercent}%.`;
  }

  return {
    ...rangeInfo,
    futureClasses,
    maxMissable, // Can be negative
    isNegative,
    mustAttendClasses: currentCalc.classesToAttend,
    projectedAttendanceIfAllAttended: Number(pctIfAllAttended.toFixed(2)),
    projectedAttendanceIfAllMissed: Number(pctIfAllMissed.toFixed(2)),
    verdict
  };
}

/**
 * Simulates a specific what-if scenario:
 * "What happens if I miss exactly 'missCount' classes during a range of 'futureClasses'?"
 */
export function simulateMissScenario(attended, total, futureClasses, missCount) {
  missCount = Math.max(0, Math.min(futureClasses, Number(missCount) || 0));
  const attendedFuture = Math.max(0, futureClasses - missCount);
  const newTotal = total + futureClasses;
  const newAttended = attended + attendedFuture;
  const newPercent = newTotal > 0 ? (newAttended / newTotal) * 100 : 0;

  return {
    newTotal,
    newAttended,
    newPercent: Number(newPercent.toFixed(2)),
    classesMissed: missCount,
    classesAttended: attendedFuture
  };
}

/**
 * Returns formatted YYYY-MM-DD string in local timezone
 */
export function formatLocalDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns common preset date ranges formatted as YYYY-MM-DD
 */
export function getPresetRanges() {
  const today = new Date();

  // Rest of this week (through Friday)
  const thisWeekEnd = new Date(today);
  const day = today.getDay();
  const diffToFriday = (5 - day + 7) % 7;
  thisWeekEnd.setDate(today.getDate() + (diffToFriday === 0 && day > 5 ? 5 : diffToFriday));

  // Next week Monday to Friday
  const nextMon = new Date(today);
  const daysUntilNextMon = ((1 - day + 7) % 7) || 7;
  nextMon.setDate(today.getDate() + daysUntilNextMon);

  const nextFri = new Date(nextMon);
  nextFri.setDate(nextMon.getDate() + 4);

  // Next 2 weeks
  const twoWeeksEnd = new Date(nextFri);
  twoWeeksEnd.setDate(twoWeeksEnd.getDate() + 7);

  // Next 30 days
  const monthEnd = new Date(today);
  monthEnd.setDate(today.getDate() + 30);

  return {
    today: {
      name: 'Today',
      start: formatLocalDate(today),
      end: formatLocalDate(today)
    },
    thisWeek: {
      name: 'This Week',
      start: formatLocalDate(today),
      end: formatLocalDate(thisWeekEnd)
    },
    nextWeek: {
      name: 'Next Week',
      start: formatLocalDate(nextMon),
      end: formatLocalDate(nextFri)
    },
    twoWeeks: {
      name: '2 Weeks',
      start: formatLocalDate(today),
      end: formatLocalDate(twoWeeksEnd)
    },
    month: {
      name: '30 Days',
      start: formatLocalDate(today),
      end: formatLocalDate(monthEnd)
    }
  };
}
