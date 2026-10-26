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

/**
 * Returns dynamic default sample patterns and instructions based on platform and submission type
 */
export function getDefaultSamplePatterns(platform = 'Instagram', submissionType = 'Instagram Handle') {
  const normType = String(submissionType || '').toLowerCase();
  const normPlat = String(platform || '').toLowerCase();

  if (normType.includes('mobile') || normPlat.includes('mobile') || normType.includes('phone') || normType.includes('number')) {
    return [
      { pattern: '9876543210', label: '10-digit mobile number' },
      { pattern: '+91 9876543210', label: 'With country code (+91)' },
      { pattern: '98765 43210', label: 'Mobile with space' }
    ];
  }

  if (normPlat.includes('whatsapp')) {
    return [
      { pattern: '9876543210', label: '10-digit voter WhatsApp number' },
      { pattern: '+91 9876543210', label: 'With +91 country code' },
      { pattern: 'https://wa.me/919876543210', label: 'Direct WhatsApp link' }
    ];
  }

  if (normPlat.includes('youtube')) {
    return [
      { pattern: '@channelname', label: 'Channel handle' },
      { pattern: 'https://youtube.com/@channelname', label: 'Channel profile URL' },
      { pattern: 'https://youtu.be/...', label: 'Video or Short link' }
    ];
  }

  if (normPlat.includes('x') || normPlat.includes('twitter')) {
    return [
      { pattern: '@handle', label: 'Twitter / X handle' },
      { pattern: 'https://x.com/handle', label: 'Profile link' }
    ];
  }

  if (normPlat.includes('facebook')) {
    return [
      { pattern: 'https://facebook.com/username', label: 'Facebook profile link' }
    ];
  }

  if (normType.includes('link') || normType.includes('url')) {
    return [
      { pattern: 'https://...', label: 'Full web URL link' }
    ];
  }

  if (normType.includes('text') || normPlat.includes('survey')) {
    return [
      { pattern: 'ABC1234567', label: 'Voter ID card number' },
      { pattern: 'Door No. 12-3, Ward 4', label: 'Citizen address or survey note' }
    ];
  }

  // Default for Instagram
  return [
    { pattern: '@username', label: 'With @ prefix' },
    { pattern: 'username', label: 'Plain handle' },
    { pattern: 'https://instagram.com/username', label: 'Profile URL' },
    { pattern: 'https://instagram.com/username?igsh=...', label: 'Share URL' }
  ];
}

/**
 * Format patterns array to a multiline editable string: "pattern | label"
 */
export function patternsToString(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return '';
  return patterns.map(p => `${p.pattern} | ${p.label}`).join('\n');
}

/**
 * Parse multiline string back to patterns array
 */
export function stringToPatterns(str) {
  if (!str || !str.trim()) return [];
  return str.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('|');
      return {
        pattern: parts[0]?.trim() || '',
        label: parts[1]?.trim() || 'Format'
      };
    })
    .filter(p => p.pattern);
}
