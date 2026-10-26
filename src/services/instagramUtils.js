/**
 * Instagram & Meta Export Normalization Utilities
 * 
 * Provides consistent username extraction, URL parsing, deduplication,
 * and format validation for Instagram follower tracking and reconciliation.
 */

/**
 * Normalizes an Instagram username or profile URL into a clean canonical key and display format.
 * 
 * Rules:
 * - Extracts username from profile URLs (e.g. instagram.com/username)
 * - Removes leading '@'
 * - Trims whitespace
 * - Strips query parameters (?igsh=...) and trailing slashes
 * - Validates allowable Instagram characters (letters, numbers, periods, underscores, 1-30 chars)
 */
export function normalizeInstagramUsername(input) {
  if (!input || typeof input !== 'string') return null;
  let str = input.trim();
  if (!str) return null;

  // 1. Extract from profile URL if present
  // Matches: https://www.instagram.com/user, instagram.com/user, instagr.am/user
  const urlMatch = str.match(/(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._]+)/i);
  if (urlMatch && urlMatch[1]) {
    str = urlMatch[1];
  }

  // 2. Remove leading '@' characters
  str = str.replace(/^@+/, '').trim();

  // 3. Remove query parameters, hashes, or trailing path components
  str = str.split('?')[0].split('#')[0].split('/')[0].trim();

  // 4. Validate allowed Instagram username characters & length (1-30 characters)
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(str)) {
    return null;
  }

  // Special reserved words on Instagram that cannot be individual user accounts
  const reserved = new Set(['about', 'explore', 'reels', 'stories', 'direct', 'p', 'reel', 'tv']);
  if (reserved.has(str.toLowerCase())) {
    return null;
  }

  return {
    cleanKey: str.toLowerCase(),
    displayUsername: str,
    href: `https://www.instagram.com/${str.toLowerCase()}`
  };
}

/**
 * Parses a single raw follower item from Instagram / Meta exports
 * Supports:
 * 1. Meta / Instagram Data Download format:
 *    { title: "", string_list_data: [ { href, value, timestamp } ] }
 * 2. Object format: { username, href, timestamp } or { value, href, timestamp }
 * 3. Direct string username or URL
 */
export function parseFollowerItem(rawItem) {
  if (!rawItem) return null;

  let rawUsername = '';
  let href = '';
  let timestamp = 0;

  // 1. Meta Data Download JSON structure
  if (rawItem.string_list_data && Array.isArray(rawItem.string_list_data) && rawItem.string_list_data.length > 0) {
    const d = rawItem.string_list_data[0];
    rawUsername = d.value || d.href || rawItem.title || '';
    href = d.href || '';
    timestamp = Number(d.timestamp) || 0;
  }
  // 2. Direct object format
  else if (typeof rawItem === 'object') {
    rawUsername = rawItem.username || rawItem.value || rawItem.title || rawItem.name || rawItem.handle || '';
    href = rawItem.href || rawItem.profile_url || rawItem.url || '';
    timestamp = Number(rawItem.timestamp) || 0;
  }
  // 3. String format
  else if (typeof rawItem === 'string') {
    rawUsername = rawItem;
  }

  // Fallback to title or href if username still blank
  if (!rawUsername) {
    rawUsername = rawItem?.title || rawItem?.href || '';
  }

  const norm = normalizeInstagramUsername(rawUsername);
  if (!norm) return null;

  const effTimestamp = timestamp || Math.floor(Date.now() / 1000);

  return {
    username: norm.displayUsername,
    key: norm.cleanKey,
    href: href || norm.href,
    timestamp: effTimestamp
  };
}

/**
 * Extracts raw follower items from whatever root structure was parsed from JSON
 */
export function extractItemsFromParsedJson(json) {
  const items = [];
  if (!json) return items;

  if (Array.isArray(json)) {
    for (let i = 0; i < json.length; i++) {
      if (json[i]) items.push(json[i]);
    }
  } else if (typeof json === 'object') {
    const candidateArrays = [
      json.followers,
      json.relationships_followers,
      json.data,
      json.items,
      json.users
    ];
    for (const arr of candidateArrays) {
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i]) items.push(arr[i]);
        }
        break;
      }
    }
    // If not found in candidate array keys, check if object values contain arrays
    if (items.length === 0) {
      for (const val of Object.values(json)) {
        if (Array.isArray(val) && val.length > 0) {
          items.push(...val);
          break;
        }
      }
    }
  }

  return items;
}

/**
 * Validates, deduplicates, and structures an entire follower list payload
 */
export function processFollowerPayload(rawItems) {
  const items = extractItemsFromParsedJson(rawItems);
  const totalSubmitted = items.length;

  if (totalSubmitted === 0) {
    return {
      isValid: false,
      error: 'Empty follower payload. No items found in the uploaded JSON.',
      totalSubmitted: 0,
      validUnique: 0,
      uniqueMap: new Map(),
      invalidCount: 0,
      duplicateCount: 0
    };
  }

  const uniqueMap = new Map();
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < items.length; i++) {
    const parsed = parseFollowerItem(items[i]);
    if (!parsed) {
      invalidCount++;
      continue;
    }

    if (uniqueMap.has(parsed.key)) {
      duplicateCount++;
      // Keep earliest timestamp or existing
      const existing = uniqueMap.get(parsed.key);
      if (parsed.timestamp && (!existing.timestamp || parsed.timestamp < existing.timestamp)) {
        uniqueMap.set(parsed.key, parsed);
      }
    } else {
      uniqueMap.set(parsed.key, parsed);
    }
  }

  return {
    isValid: uniqueMap.size > 0,
    error: uniqueMap.size === 0 ? 'No valid unique Instagram usernames found.' : null,
    totalSubmitted,
    validUnique: uniqueMap.size,
    uniqueMap,
    invalidCount,
    duplicateCount
  };
}
