/**
 * Indian Standard Time (IST, UTC+05:30) & Follower Validation Rules
 * 
 * Implements strict business logic for Instagram follower verification:
 * 1. Window: [submittedAt - 24 hours, submittedAt + 24 hours]
 * 2. Pre-existing followers (before submittedAt - 24h) -> 'Already Followed' (Not counted as valid)
 * 3. Duplicate submissions -> 'Already Followed' (Not counted as valid)
 * 4. New usernames awaiting follower JSON -> 'Pending Submission' (Not counted as valid until verified)
 * 5. Followers inside window -> 'Valid Submission' (Counted as valid)
 * 6. Followers outside window -> 'Invalid Submission' (Not counted as valid)
 */

export const IST_TIMEZONE = 'Asia/Kolkata';
export const VALIDATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 Hours in Milliseconds

/**
 * Format any date or timestamp into IST (DD/MM/YYYY HH:mm)
 */
export function formatIST(dateOrTimestamp, options = {}) {
  if (!dateOrTimestamp) return '';
  const date = typeof dateOrTimestamp === 'number'
    ? new Date(dateOrTimestamp < 1e11 ? dateOrTimestamp * 1000 : dateOrTimestamp)
    : new Date(dateOrTimestamp);

  if (isNaN(date.getTime())) return '';

  const { timeOnly = false, dateOnly = false, includeSeconds = false } = options;

  if (timeOnly) {
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);
    const h = parts.find(p => p.type === 'hour')?.value;
    const min = parts.find(p => p.type === 'minute')?.value;
    return `${h}:${min}`;
  }

  if (dateOnly) {
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).formatToParts(date);
    const d = parts.find(p => p.type === 'day')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const y = parts.find(p => p.type === 'year')?.value;
    return `${d}/${m}/${y}`;
  }

  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const d = parts.find(p => p.type === 'day')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const y = parts.find(p => p.type === 'year')?.value;
  const h = parts.find(p => p.type === 'hour')?.value;
  const min = parts.find(p => p.type === 'minute')?.value;
  return `${d}/${m}/${y} ${h}:${min}`;
}

/**
 * Returns current date in IST formatted as YYYY-MM-DD
 */
export function getTodayISTDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

/**
 * Returns date in IST with a day offset formatted as YYYY-MM-DD
 * e.g. getISTDateOffset(-1) for yesterday, getISTDateOffset(-7) for 7 days ago
 */
export function getISTDateOffset(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

/**
 * Returns the Monday date of the current week in IST (YYYY-MM-DD)
 */
export function getMondayOfCurrentWeekIST(referenceDateStr = null) {
  const baseStr = referenceDateStr || getTodayISTDateString();
  const d = new Date(baseStr + 'T12:00:00+05:30');
  const day = d.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(monday);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const dayVal = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${dayVal}`;
}

/**
 * Returns date in IST formatted as YYYY-MM-DD from any ISO string
 */
export function getISTDateFromISO(isoString) {
  if (!isoString) return getTodayISTDateString();
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return getTodayISTDateString();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

/**
 * Add or subtract days from an ISO date string (YYYY-MM-DD)
 */
export function addDaysToDateStr(dateStr, days) {
  if (!dateStr) return getTodayISTDateString();
  const [y, m, d] = dateStr.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + days * 86400000;
  const dt = new Date(ms);
  const resY = dt.getUTCFullYear();
  const resM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(dt.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

/**
 * Difference in days between two ISO date strings (dateStr2 - dateStr1)
 */
export function diffDaysBetweenDateStr(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 0;
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((ms2 - ms1) / 86400000);
}

/**
 * Resolves the active cycle for a task on any reference date (defaulting to today in IST).
 * Supports:
 * - 'Daily': Resets daily.
 * - 'Weekly': 7-day recurring cycles (Week 1, Week 2, Week 3, ...).
 * - 'Custom': Custom N-day recurring cycles (e.g. 10 days: 1st, 11th, 21st, ...).
 * - 'Campaign Total': Entire duration from startDate to today/endDate without week limits.
 */
export function getTaskCycleInfo(task, referenceDateStr = null) {
  const refDate = referenceDateStr || getTodayISTDateString();
  const frequency = task?.frequency || 'Daily';
  
  if (frequency === 'Daily') {
    return {
      frequency: 'Daily',
      cycleNumber: null,
      cycleIndex: 0,
      cycleLabel: `Daily (${refDate})`,
      shortLabel: 'Daily Target',
      startDate: refDate,
      endDate: refDate,
      target: Number(task?.dailyTarget) || 10,
      isWeekly: false,
      isCustom: false,
      isCampaignTotal: false,
      isDaily: true,
      isOngoing: true
    };
  }

  const baseStart = task?.startDate || task?.weekStartDate || task?.createdDate || refDate;
  const taskEnd = task?.endDate || null;

  if (frequency === 'Campaign Total') {
    const end = taskEnd ? (refDate < taskEnd ? refDate : taskEnd) : refDate;
    const target = Number(task?.campaignTarget || task?.dailyTarget || task?.weeklyTarget) || 100;
    return {
      frequency: 'Campaign Total',
      cycleNumber: 1,
      cycleIndex: 0,
      cycleLabel: `Campaign Duration (${baseStart} → ${taskEnd ? taskEnd : 'Today'})`,
      shortLabel: 'Campaign Duration',
      startDate: baseStart,
      endDate: end,
      taskStartDate: baseStart,
      taskEndDate: taskEnd,
      target,
      isWeekly: false,
      isCustom: false,
      isCampaignTotal: true,
      isDaily: false,
      isOngoing: !taskEnd || refDate <= taskEnd
    };
  }

  // Frequency is 'Weekly' or 'Custom'
  const isWeekly = frequency === 'Weekly';
  const repeatDays = isWeekly ? 7 : Math.max(1, Number(task?.cycleDays) || 7);
  const diffDays = diffDaysBetweenDateStr(baseStart, refDate);
  
  let cycleIdx = 0;
  if (diffDays >= 0) {
    cycleIdx = Math.floor(diffDays / repeatDays);
  } else {
    cycleIdx = 0; // if before baseStart, lock to cycle 1
  }

  const cycleStartDate = addDaysToDateStr(baseStart, cycleIdx * repeatDays);
  let cycleEndDate = addDaysToDateStr(cycleStartDate, repeatDays - 1);
  if (taskEnd && cycleEndDate > taskEnd) {
    cycleEndDate = taskEnd;
  }

  const cycleNumber = cycleIdx + 1;
  const shortLabel = isWeekly ? `Week ${cycleNumber}` : `Cycle ${cycleNumber}`;
  const cycleLabel = isWeekly 
    ? `Week ${cycleNumber} (${cycleStartDate} to ${cycleEndDate})`
    : `Cycle ${cycleNumber} (${repeatDays} Days: ${cycleStartDate} to ${cycleEndDate})`;

  const target = isWeekly 
    ? Number(task?.weeklyTarget || task?.cycleTarget || task?.dailyTarget) || 10
    : Number(task?.cycleTarget || task?.weeklyTarget || task?.dailyTarget) || 10;

  return {
    frequency,
    cycleNumber,
    cycleIndex: cycleIdx,
    repeatDays,
    cycleLabel,
    shortLabel,
    startDate: cycleStartDate,
    endDate: cycleEndDate,
    taskStartDate: baseStart,
    taskEndDate: taskEnd,
    target,
    isWeekly,
    isCustom: !isWeekly,
    isCampaignTotal: false,
    isDaily: false,
    isCurrent: refDate >= cycleStartDate && refDate <= cycleEndDate,
    isPast: refDate > cycleEndDate,
    isFuture: refDate < cycleStartDate
  };
}

/**
 * Returns an array of all cycles from task start date up to current reference date (or task end date)
 */
export function getAllTaskCycles(task, referenceDateStr = null) {
  const frequency = task?.frequency || 'Daily';
  if (frequency === 'Daily' || frequency === 'Campaign Total') {
    return [getTaskCycleInfo(task, referenceDateStr)];
  }

  const refDate = referenceDateStr || getTodayISTDateString();
  const baseStart = task?.startDate || task?.weekStartDate || task?.createdDate || refDate;
  const isWeekly = frequency === 'Weekly';
  const repeatDays = isWeekly ? 7 : Math.max(1, Number(task?.cycleDays) || 7);
  const taskEnd = task?.endDate || null;

  const maxLimitDate = taskEnd && taskEnd < refDate ? taskEnd : refDate;
  const diffDays = Math.max(0, diffDaysBetweenDateStr(baseStart, maxLimitDate));
  const totalCycles = Math.min(52, Math.floor(diffDays / repeatDays) + 1);

  const cycles = [];
  for (let i = 0; i < totalCycles; i++) {
    const cycleStart = addDaysToDateStr(baseStart, i * repeatDays);
    let cycleEnd = addDaysToDateStr(cycleStart, repeatDays - 1);
    if (taskEnd && cycleEnd > taskEnd) {
      cycleEnd = taskEnd;
    }
    const cycleNum = i + 1;
    const isCurrent = refDate >= cycleStart && refDate <= cycleEnd;
    const target = isWeekly 
      ? Number(task?.weeklyTarget || task?.cycleTarget || task?.dailyTarget) || 10
      : Number(task?.cycleTarget || task?.weeklyTarget || task?.dailyTarget) || 10;

    cycles.push({
      cycleNumber: cycleNum,
      cycleIndex: i,
      startDate: cycleStart,
      endDate: cycleEnd,
      isCurrent,
      isWeekly,
      shortLabel: isWeekly ? `Week ${cycleNum}` : `Cycle ${cycleNum}`,
      label: isWeekly 
        ? `Week ${cycleNum} (${cycleStart} - ${cycleEnd})`
        : `Cycle ${cycleNum} (${cycleStart} - ${cycleEnd})`,
      target
    });
  }
  return cycles;
}

/**
 * Validates an Instagram follower submission based on the strict business logic:
 * - 24-hour window: [submittedAt - 24h, submittedAt + 24h]
 * - Followed earlier than window -> 'Already Followed'
 * - Followed later than window -> 'Invalid Submission'
 * - Followed inside window -> 'Valid Submission'
 * - Follower not yet in JSON -> 'Pending Submission'
 * - Username already exists in submissions -> 'Already Followed'
 */
export function validateFollowerSubmission({
  normalizedUsername,
  submittedAtIso,
  followerRecord = null,
  existingSubmissions = [],
  currentSubmissionId = null
}) {
  const cleanUsername = String(normalizedUsername || '').trim().toLowerCase().replace(/^@+/, '');
  const subDate = new Date(submittedAtIso || Date.now());
  const subTimeMs = isNaN(subDate.getTime()) ? Date.now() : subDate.getTime();
  
  const minEligibleMs = subTimeMs - VALIDATION_WINDOW_MS;
  const maxEligibleMs = subTimeMs + VALIDATION_WINDOW_MS;

  // 1. Check duplicate submission in existing submissions database
  const priorDuplicate = existingSubmissions.find(s => 
    s.id !== currentSubmissionId &&
    String(s.username || '').trim().toLowerCase().replace(/^@+/, '') === cleanUsername
  );

  if (priorDuplicate) {
    return {
      status: 'Already Followed',
      isValid: false,
      isDuplicate: true,
      isFollower: !!priorDuplicate.isFollower,
      duplicateOf: priorDuplicate.id,
      duplicateEmployeeName: priorDuplicate.employeeName,
      message: `Already submitted! '@${cleanUsername}' was previously submitted by ${priorDuplicate.employeeName || 'staff'}.`,
      verificationBadge: 'Duplicate Submission',
      verificationNote: `Duplicate of submission by ${priorDuplicate.employeeName || 'staff'}`,
      followedAtFormatted: priorDuplicate.followedAtFormatted || null,
      followedAtTimestamp: priorDuplicate.followedAtTimestamp || null
    };
  }

  // 2. Check follower in Instagram follower database
  const follower = followerRecord?.follower || followerRecord;
  const isFoundInDb = !!(follower && (follower.timestamp || follower.followedAtFormatted));

  if (!isFoundInDb) {
    // Not found in followers JSON yet -> Pending Submission
    return {
      status: 'Pending Submission',
      isValid: false,
      isFollower: false,
      isDuplicate: false,
      message: `Accepted! '@${cleanUsername}' recorded as Pending Submission. It will be verified when official follower JSON is uploaded.`,
      verificationBadge: 'Pending Follow Sync',
      verificationNote: 'Awaiting next official follower JSON sync',
      followedAtFormatted: null,
      followedAtTimestamp: null
    };
  }

  // Extract follow timestamp
  const rawTs = follower.timestamp;
  let followTimeMs = 0;
  if (typeof rawTs === 'number') {
    followTimeMs = rawTs < 1e11 ? rawTs * 1000 : rawTs;
  } else if (rawTs) {
    followTimeMs = new Date(rawTs).getTime();
  }

  const formattedIstDate = formatIST(followTimeMs);

  // 3. Follow date is earlier than (submittedAt - 24 hours): Existing Follower
  if (followTimeMs < minEligibleMs) {
    return {
      status: 'Already Followed',
      isValid: false,
      isFollower: true,
      isDuplicate: false,
      followedAtTimestamp: Math.floor(followTimeMs / 1000),
      followedAtFormatted: formattedIstDate,
      message: `'@${cleanUsername}' is an existing follower (Followed on ${formattedIstDate} IST). This is prior to the tracking campaign window and cannot be counted as a new follower.`,
      verificationBadge: `✓ Existing Follower: ${formattedIstDate}`,
      verificationNote: 'Followed prior to 24h campaign window'
    };
  }

  // 4. Follow date is later than (submittedAt + 24 hours): Outside window
  if (followTimeMs > maxEligibleMs) {
    return {
      status: 'Invalid Submission',
      isValid: false,
      isFollower: true,
      isDuplicate: false,
      followedAtTimestamp: Math.floor(followTimeMs / 1000),
      followedAtFormatted: formattedIstDate,
      message: `'@${cleanUsername}' follow timestamp (${formattedIstDate} IST) falls outside the permitted 24-hour validation window.`,
      verificationBadge: `Outside 24h Window: ${formattedIstDate}`,
      verificationNote: 'Followed after 24h window expired'
    };
  }

  // 5. Follow date is INSIDE eligible [submittedAt - 24h, submittedAt + 24h] window!
  return {
    status: 'Valid Submission',
    isValid: true,
    isFollower: true,
    isDuplicate: false,
    followedAtTimestamp: Math.floor(followTimeMs / 1000),
    followedAtFormatted: formattedIstDate,
    message: `Accepted! '@${cleanUsername}' verified as a genuine new follower (Followed on ${formattedIstDate} IST).`,
    verificationBadge: `✓ Followed: ${formattedIstDate}`,
    verificationNote: 'Verified within 24h campaign window'
  };
}
