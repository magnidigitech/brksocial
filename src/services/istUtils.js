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
