/**
 * BRK Social - WebAuthn / Passkeys Biometric Authentication Service
 * Standard-compliant FIDO2/WebAuthn client wrapper using @simplewebauthn/browser.
 * Never handles raw biometric or fingerprint data.
 */
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
  startAuthentication
} from '@simplewebauthn/browser';

const LOCAL_STORAGE_KEY = 'brk_passkey_enrolled_v1';

/**
 * Returns a friendly label representing the user's current device & browser.
 */
export function getFriendlyDeviceName() {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
  let os = 'Device';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows NT/i.test(ua)) os = 'Windows PC';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome|CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  return `${os} (${browser} Passkey)`;
}

/**
 * Returns the human-friendly name of the biometric method based on platform.
 */
export function getBiometricMethodName() {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
  if (/iPhone|iPad|Macintosh|Mac OS X/i.test(ua)) {
    return 'Face ID / Touch ID';
  } else if (/Android/i.test(ua)) {
    return 'Fingerprint / Face Unlock';
  } else if (/Windows NT/i.test(ua)) {
    return 'Windows Hello / Fingerprint';
  }
  return 'Fingerprint / Biometric Passkey';
}

export const webauthnService = {
  /**
   * Check if the current browser environment supports the Web Authentication API
   */
  isSupported() {
    try {
      return browserSupportsWebAuthn();
    } catch (e) {
      return false;
    }
  },

  /**
   * Check if a platform authenticator (e.g. Touch ID, Face ID, Android Biometric, Windows Hello) is available
   */
  async isPlatformAuthenticatorAvailable() {
    try {
      if (!this.isSupported()) return false;
      return await platformAuthenticatorIsAvailable();
    } catch (e) {
      return false;
    }
  },

  /**
   * Get enrolled passkey user state saved on this device / browser
   */
  getEnrolledUser() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Save enrolled passkey user state on this device
   */
  setEnrolledUser(data) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not persist passkey enrollment state:', e);
    }
  },

  /**
   * Clear enrolled passkey user state from this device
   */
  clearEnrolledUser() {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {}
  },

  /**
   * Query the backend to see if a specific user identifier has registered passkeys
   */
  async checkUserHasPasskey(identifier) {
    if (!identifier) return false;
    try {
      const res = await fetch(`/api/webauthn/check/${encodeURIComponent(identifier.trim())}`);
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.hasPasskey;
    } catch (e) {
      console.warn('Check passkey error:', e);
      return false;
    }
  },

  /**
   * Register a new Passkey / Biometric Credential for an authenticated user.
   * Requires verified authenticated session.
   */
  async registerPasskey(session) {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'WebAuthn biometric authentication is not supported by this browser.'
      };
    }

    const userId = session?.supportCode || session?.employeeId || session?.username || session?.id;
    const userName = session?.name || session?.username || 'User';
    const userRole = session?.role || 'Employee';

    if (!userId) {
      return {
        success: false,
        error: 'No active session or user identifier found.'
      };
    }

    try {
      // 1. Request registration options and challenge from backend
      const optionsRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName, userRole })
      });

      if (!optionsRes.ok) {
        const errData = await optionsRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to obtain registration options from server.');
      }

      const options = await optionsRes.json();

      // 2. Invoke native WebAuthn navigator.credentials.create()
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Send response to backend for cryptographic verification and persistence
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userType: userRole,
          response: regResponse,
          deviceLabel: getFriendlyDeviceName()
        })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'Biometric verification failed on server.');
      }

      // 4. Save enrolled flag locally on this device
      this.setEnrolledUser({
        userId,
        userName,
        userRole,
        deviceLabel: getFriendlyDeviceName(),
        enrolledAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Biometric login enabled successfully.',
        credential: verifyData.credential
      };
    } catch (err) {
      console.error('WebAuthn registration error:', err);

      // Handle user cancellation gracefully
      const isCancelled =
        err.name === 'NotAllowedError' ||
        err.name === 'AbortError' ||
        (err.message && (
          err.message.includes('cancel') ||
          err.message.includes('timed out') ||
          err.message.includes('not allowed')
        ));

      return {
        success: false,
        cancelled: isCancelled,
        error: isCancelled
          ? 'Biometric registration was cancelled by the user.'
          : (err.message || 'An unexpected error occurred during biometric registration.')
      };
    }
  },

  /**
   * Authenticate the user using an existing registered passkey.
   * Prompts the operating system's native biometric prompt (Fingerprint, Touch ID, Face ID, etc.).
   */
  async authenticateWithPasskey(identifier = null) {
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'WebAuthn biometric authentication is not supported by this browser.'
      };
    }

    try {
      // 1. Request authentication options & fresh single-use challenge from backend
      const optionsRes = await fetch('/api/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });

      if (!optionsRes.ok) {
        const errData = await optionsRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to obtain authentication options from server.');
      }

      const options = await optionsRes.json();

      // 2. Invoke native WebAuthn navigator.credentials.get()
      const authResponse = await startAuthentication({ optionsJSON: options });

      // 3. Send assertion to server for cryptographic signature verification
      const verifyRes = await fetch('/api/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: authResponse,
          identifier
        })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified || !verifyData.session) {
        throw new Error(verifyData.error || 'Biometric authentication verification failed.');
      }

      // 4. Update enrolled state on device
      this.setEnrolledUser({
        userId: verifyData.session.supportCode || verifyData.session.employeeId || verifyData.session.username,
        userName: verifyData.session.name,
        userRole: verifyData.session.role,
        lastUsedAt: new Date().toISOString()
      });

      return {
        success: true,
        session: verifyData.session
      };
    } catch (err) {
      console.error('WebAuthn authentication error:', err);

      const isCancelled =
        err.name === 'NotAllowedError' ||
        err.name === 'AbortError' ||
        (err.message && (
          err.message.includes('cancel') ||
          err.message.includes('timed out') ||
          err.message.includes('not allowed')
        ));

      return {
        success: false,
        cancelled: isCancelled,
        error: isCancelled
          ? 'Biometric prompt was cancelled.'
          : (err.message || 'Biometric authentication could not be completed.')
      };
    }
  },

  /**
   * Fetch registered credentials for the current user
   */
  async getCredentials(userId) {
    if (!userId) return [];
    try {
      const res = await fetch(`/api/webauthn/credentials?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.credentials || [];
    } catch (e) {
      console.warn('Failed to fetch credentials:', e);
      return [];
    }
  },

  /**
   * Revoke/delete a registered credential
   */
  async deleteCredential(credentialId, userId) {
    if (!credentialId || !userId) return { success: false, error: 'Missing parameters' };
    try {
      const res = await fetch(`/api/webauthn/credentials/${encodeURIComponent(credentialId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove credential');
      }

      // If user has 0 credentials left, clear local enrollment
      if (data.remainingCount === 0) {
        this.clearEnrolledUser();
      }

      return {
        success: true,
        remainingCount: data.remainingCount,
        message: data.message
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
};
