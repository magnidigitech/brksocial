import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  ShieldCheck,
  Smartphone,
  Laptop,
  Key,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Plus
} from 'lucide-react';
import { webauthnService, getBiometricMethodName, getFriendlyDeviceName } from '../services/webauthnService.js';
import { formatIST } from '../services/istUtils.js';

export function BiometricSecurityModal({ isOpen, onClose, session, onStatusChanged }) {
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: string }
  const [isSupported, setIsSupported] = useState(true);
  const [hasPlatformAuth, setHasPlatformAuth] = useState(true);

  const userId = session?.supportCode || session?.employeeId || session?.username || session?.id;
  const isEnabled = credentials.length > 0;
  const biometricName = getBiometricMethodName();
  const currentDeviceLabel = getFriendlyDeviceName();

  useEffect(() => {
    if (!isOpen) return;

    // Check device capabilities
    const supported = webauthnService.isSupported();
    setIsSupported(supported);

    if (supported) {
      webauthnService.isPlatformAuthenticatorAvailable().then(avail => {
        setHasPlatformAuth(avail);
      });
    }

    // Load registered credentials for this user
    loadCredentials();
  }, [isOpen, userId]);

  const loadCredentials = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const list = await webauthnService.getCredentials(userId);
      setCredentials(list);
    } catch (err) {
      console.warn('Could not load credentials:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (e) => {
    const shouldEnable = e.target.checked;
    setFeedback(null);

    if (shouldEnable) {
      // Begin registration flow
      setIsRegistering(true);
      const res = await webauthnService.registerPasskey(session);
      setIsRegistering(false);

      if (res.success) {
        setFeedback({
          type: 'success',
          text: 'Biometric login enabled successfully! You can now sign in with your fingerprint or passkey.'
        });
        await loadCredentials();
        if (onStatusChanged) onStatusChanged(true);
      } else {
        setFeedback({
          type: 'error',
          text: res.error || 'Failed to register biometric passkey.'
        });
      }
    } else {
      // User is turning it off: Revoke credentials
      if (credentials.length === 0) return;
      const confirmOff = window.confirm(
        'Are you sure you want to disable biometric login? This will remove registered biometric passkeys for this account.'
      );
      if (!confirmOff) return;

      setIsLoading(true);
      for (const cred of credentials) {
        await webauthnService.deleteCredential(cred.id, userId);
      }
      webauthnService.clearEnrolledUser();
      await loadCredentials();
      setIsLoading(false);

      setFeedback({
        type: 'success',
        text: 'Biometric login disabled. You can sign in using your standard credentials.'
      });
      if (onStatusChanged) onStatusChanged(false);
    }
  };

  const handleRegisterAdditional = async () => {
    setFeedback(null);
    setIsRegistering(true);
    const res = await webauthnService.registerPasskey(session);
    setIsRegistering(false);

    if (res.success) {
      setFeedback({
        type: 'success',
        text: 'New biometric passkey registered successfully.'
      });
      await loadCredentials();
      if (onStatusChanged) onStatusChanged(true);
    } else {
      setFeedback({
        type: 'error',
        text: res.error || 'Failed to register biometric passkey.'
      });
    }
  };

  const handleDeleteCredential = async (credId, label) => {
    const confirmDelete = window.confirm(`Remove passkey "${label}" from your account?`);
    if (!confirmDelete) return;

    setIsDeletingId(credId);
    setFeedback(null);
    const res = await webauthnService.deleteCredential(credId, userId);
    setIsDeletingId(null);

    if (res.success) {
      setFeedback({
        type: 'success',
        text: 'Passkey removed successfully.'
      });
      await loadCredentials();
      if (res.remainingCount === 0 && onStatusChanged) {
        onStatusChanged(false);
      }
    } else {
      setFeedback({
        type: 'error',
        text: res.error || 'Failed to remove passkey.'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isRegistering) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(226, 232, 240, 0.8)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #fafafa 0%, #ffffff 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ff4d00 0%, #ff1a40 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(255, 77, 0, 0.3)'
              }}
            >
              <Fingerprint size={24} strokeWidth={2.2} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Biometric Login & Passkeys
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Secure passwordless sign-in with {biometricName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isRegistering}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isRegistering ? 'not-allowed' : 'pointer',
              color: '#64748b',
              transition: 'all 0.2s'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Feedback Alert */}
          {feedback && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '14px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${feedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
                color: feedback.type === 'success' ? '#15803d' : '#b91c1c'
              }}
            >
              {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span style={{ flex: 1 }}>{feedback.text}</span>
            </div>
          )}

          {/* Browser / Device Compatibility Notice */}
          {!isSupported && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#b45309',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Device Unsupported:</strong> WebAuthn is not supported by your current browser. You can continue using your normal password to sign in.
              </div>
            </div>
          )}

          {/* Master Biometric Login Toggle Card */}
          <div
            style={{
              padding: '18px 20px',
              backgroundColor: '#f8fafc',
              borderRadius: '18px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Biometric Login
                </span>
                {isEnabled && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#dcfce7',
                      color: '#15803d'
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                Sign in instantly using your device's biometric sensor ({biometricName}) instead of typing your password.
              </p>
            </div>

            {/* Apple-Style Smooth Toggle Switch */}
            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '54px',
                height: '32px',
                flexShrink: 0,
                cursor: (isRegistering || isLoading || !isSupported) ? 'not-allowed' : 'pointer',
                opacity: (isRegistering || isLoading || !isSupported) ? 0.6 : 1
              }}
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={handleToggle}
                disabled={isRegistering || isLoading || !isSupported}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: isEnabled ? '#10b981' : '#cbd5e1',
                  borderRadius: '32px',
                  transition: 'background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isEnabled ? '0 2px 8px rgba(16, 185, 129, 0.4)' : 'none'
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    height: '26px',
                    width: '26px',
                    left: isEnabled ? '25px' : '3px',
                    bottom: '3px',
                    backgroundColor: '#ffffff',
                    borderRadius: '50%',
                    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isRegistering ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: '#ff4d00' }} />
                  ) : null}
                </span>
              </span>
            </label>
          </div>

          {/* Current Device Detection Status */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '14px',
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
              <Smartphone size={16} style={{ color: '#ff4d00' }} />
              <span>Current Device: <strong>{currentDeviceLabel}</strong></span>
            </div>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: 600,
              color: hasPlatformAuth ? '#16a34a' : '#94a3b8'
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: hasPlatformAuth ? '#22c55e' : '#cbd5e1'
              }} />
              {hasPlatformAuth ? 'Sensor Ready' : 'External Key'}
            </span>
          </div>

          {/* Registered Credentials List */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Registered Passkeys ({credentials.length})
              </h4>
              {isEnabled && isSupported && (
                <button
                  onClick={handleRegisterAdditional}
                  disabled={isRegistering}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff4d00',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={14} /> Add Another Device
                </button>
              )}
            </div>

            {isLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Loading registered credentials...
              </div>
            ) : credentials.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  border: '1px dashed #cbd5e1',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc'
                }}
              >
                <Lock size={28} style={{ color: '#94a3b8', margin: '0 auto 8px auto', display: 'block' }} />
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                  No biometric passkeys registered yet
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                  Turn on the toggle switch above to register this device's fingerprint or Face ID.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {credentials.map((cred) => {
                  const isDeleting = isDeletingId === cred.id;
                  return (
                    <div
                      key={cred.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: '#eff6ff',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Key size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                            {cred.deviceLabel || 'Biometric Passkey'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Added: {formatIST(cred.createdAt)}
                            {cred.lastUsedAt && ` • Last active: ${formatIST(cred.lastUsedAt)}`}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteCredential(cred.id, cred.deviceLabel)}
                        disabled={isDeleting}
                        style={{
                          backgroundColor: '#fff1f2',
                          border: '1px solid #fecdd3',
                          borderRadius: '10px',
                          padding: '6px 12px',
                          color: '#e11d48',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        title="Remove Passkey"
                      >
                        {isDeleting ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        <span>Remove</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Privacy & Cryptographic Security Guarantee */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '11px',
              color: '#64748b',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <ShieldCheck size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#334155' }}>Privacy & Hardware Security:</strong> Passkeys use public-key cryptography. Your raw biometric data (fingerprint or face) never leaves your physical device and is never sent or stored on our servers.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            disabled={isRegistering}
            style={{
              padding: '10px 24px',
              borderRadius: '9999px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: isRegistering ? 'not-allowed' : 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
