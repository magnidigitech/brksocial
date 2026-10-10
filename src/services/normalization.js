/**
 * BRK Social - Instagram Username Normalization Algorithm
 * 
 * Rules specified in Phase 1:
 * - TRIM spaces
 * - Remove Instagram URL prefixes (https://instagram.com/, www.instagram.com, etc.)
 * - Remove trailing /
 * - Remove leading @
 * - Convert to lowercase
 * - Validate format (1-30 chars, alphanumerics, underscores, dots)
 */

export function normalizeInstagramUsername(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      isValid: false,
      raw: rawInput || '',
      normalized: '',
      error: 'Username cannot be empty.'
    };
  }

  let cleaned = rawInput.trim();

  // Remove URL query parameters or hash fragments
  cleaned = cleaned.split('?')[0].split('#')[0];

  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');

  // Strip standard Instagram URL prefixes
  // Match https://, http://, www., instagram.com/ or insta.me/
  const urlRegex = /^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._]+)/i;
  const urlMatch = cleaned.match(urlRegex);

  if (urlMatch && urlMatch[1]) {
    cleaned = urlMatch[1];
  } else {
    // If it was a URL like instagram.com/username without path regex match, try fallback split
    if (cleaned.includes('instagram.com/')) {
      const parts = cleaned.split('instagram.com/');
      cleaned = parts[parts.length - 1];
    }
  }

  // Remove leading @ symbols (handles multiple @@@ if typed accidentally)
  cleaned = cleaned.replace(/^@+/, '').trim();

  // Convert to lowercase
  const normalized = cleaned.toLowerCase();

  // Validate Instagram Username rules:
  // - Length: 1 to 30 characters
  // - Characters allowed: letters (a-z), numbers (0-9), periods (.), underscores (_)
  // - Cannot start or end with a period
  const instagramRegex = /^[a-z0-9._]{1,30}$/;

  if (!normalized) {
    return {
      isValid: false,
      raw: rawInput,
      normalized: '',
      error: 'Please enter a valid Instagram handle or profile URL.'
    };
  }

  if (normalized.startsWith('.') || normalized.endsWith('.')) {
    return {
      isValid: false,
      raw: rawInput,
      normalized,
      error: 'Instagram username cannot start or end with a period.'
    };
  }

  if (normalized.includes('..')) {
    return {
      isValid: false,
      raw: rawInput,
      normalized,
      error: 'Instagram username cannot contain consecutive periods.'
    };
  }

  if (!instagramRegex.test(normalized)) {
    return {
      isValid: false,
      raw: rawInput,
      normalized,
      error: 'Invalid format. Use 1-30 letters, numbers, underscores, or periods.'
    };
  }

  return {
    isValid: true,
    raw: rawInput,
    normalized,
    error: null
  };
}
