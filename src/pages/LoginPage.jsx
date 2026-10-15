import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ShieldCheck, UserCheck, Fingerprint, Loader2 } from 'lucide-react';
import { authService } from '../services/auth.js';
import { webauthnService, getBiometricMethodName } from '../services/webauthnService.js';

export function LoginPage({ onLoginSuccess }) {
  const [isAdminMode, setIsAdminMode] = useState(false); // Default: Employee Sign-In (false)

  // Employee Login State
  const [empId, setEmpId] = useState('');
  const [empPass, setEmpPass] = useState('');

  // Admin Login State
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Biometric / WebAuthn Passkeys State
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  const [enrolledUser, setEnrolledUser] = useState(null);
  const [hasPasskeyForInput, setHasPasskeyForInput] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  useEffect(() => {
    // Check WebAuthn support
    const supported = webauthnService.isSupported();
    setWebauthnSupported(supported);

    if (supported) {
      const enrolled = webauthnService.getEnrolledUser();
      if (enrolled?.userId) {
        // Verify with server that passkey is still valid
        webauthnService.checkUserHasPasskey(enrolled.userId).then((hasKey) => {
          if (hasKey) {
            setEnrolledUser(enrolled);
          } else {
            webauthnService.clearEnrolledUser();
          }
        }).catch(() => {});
      }
    }
  }, []);

  // Check if typed identifier has a registered passkey
  useEffect(() => {
    const inputIdentifier = (isAdminMode ? adminUser : empId).trim();
    if (!webauthnSupported || !inputIdentifier) {
      setHasPasskeyForInput(false);
      return;
    }

    const timer = setTimeout(() => {
      webauthnService.checkUserHasPasskey(inputIdentifier).then((hasKey) => {
        setHasPasskeyForInput(hasKey);
      }).catch(() => {});
    }, 350);

    return () => clearTimeout(timer);
  }, [isAdminMode, adminUser, empId, webauthnSupported]);

  // 3D Cursor Tilt & Multi-Layer Depth Parallax State
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, layerX: 0, layerY: 0 });
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleHeroMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate 3D tilt angle (max 5 deg as requested)
    const rotateX = -((y - centerY) / centerY) * 5;
    const rotateY = ((x - centerX) / centerX) * 5;

    // Calculate depth parallax offset per layer
    const layerX = ((x - centerX) / centerX) * 8;
    const layerY = ((y - centerY) / centerY) * 8;

    // Calculate mouse percentage coordinates for border glow spotlight
    const posX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const posY = Math.max(0, Math.min(100, (y / rect.height) * 100));

    setTilt({ rotateX, rotateY, layerX, layerY });
    setMousePos({ x: posX, y: posY });
  };

  const handleHeroMouseEnter = () => setIsHovered(true);

  const handleHeroMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0, layerX: 0, layerY: 0 });
  };

  const handleEmployeeSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const res = authService.loginEmployee(empId, empPass);
    if (res.success) {
      onLoginSuccess(res.session);
    } else {
      setErrorMsg(res.error);
    }
  };

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const res = authService.loginAdmin(adminUser, adminPass);
    if (res.success) {
      onLoginSuccess(res.session);
    } else {
      setErrorMsg(res.error);
    }
  };

  // Biometric / Passkey Login Trigger
  const handleBiometricLogin = async () => {
    if (!webauthnSupported) {
      setErrorMsg('Biometric authentication is not supported by your browser.');
      return;
    }

    setErrorMsg('');
    setIsBiometricLoading(true);

    try {
      // Determine user identifier hint if available
      const inputIdentifier = (isAdminMode ? adminUser : empId).trim();
      const targetId = inputIdentifier || enrolledUser?.userId || null;

      const res = await webauthnService.authenticateWithPasskey(targetId);

      if (res.success && res.session) {
        authService.setSession(res.session);
        onLoginSuccess(res.session);
      } else {
        if (!res.cancelled) {
          setErrorMsg(res.error || 'Biometric authentication failed. Please enter your password.');
        } else {
          setErrorMsg('Biometric prompt was cancelled. Click again or use password to sign in.');
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Biometric sign in error.');
    } finally {
      setIsBiometricLoading(false);
    }
  };


  return (
    <div className="login-page-container">
      {/* LEFT HALF: Hero Dark Panel (100% on mobile, 50% on desktop) */}
      <div className="login-left-panel">
        {/* Top Tagline & Branding */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', color: '#a8a29e', fontWeight: '500', margin: 0 }}>
            Centralized Task & Outreach Platform — Andhra Pradesh
          </p>
        </div>

        {/* Hero Section & Layered Animated Graphic */}
        <div className="login-hero-container">
          <h1 className="login-hero-title">
            Empowering <br />
            <span style={{ color: '#d6d3d1' }}>Outreach & Leadership</span>
          </h1>

          {/* Multi-Layer 3D Tilt Animated Composite Header Graphic */}
          <div
            className="login-banner-wrapper animate-layer-float"
            onMouseMove={handleHeroMouseMove}
            onMouseEnter={handleHeroMouseEnter}
            onMouseLeave={handleHeroMouseLeave}
            style={{
              transform: isHovered
                ? `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale(1.02)`
                : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)',
              transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              transformStyle: 'preserve-3d',
              willChange: 'transform',
              cursor: 'pointer'
            }}
          >
            {/* Dynamic Cursor Border Glow Highlight Overlay strictly on Card Border (Yellow Shade) */}
            <div
              style={{
                position: 'absolute',
                inset: '-1px',
                borderRadius: '16px',
                padding: '1.5px',
                background: isHovered
                  ? `radial-gradient(280px circle at ${mousePos.x}% ${mousePos.y}%, #ffd700 0%, #f59e0b 55%, transparent 100%)`
                  : 'transparent',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                pointerEvents: 'none',
                zIndex: 10,
                transition: isHovered ? 'background 0.05s ease-out' : 'background 0.4s ease-out'
              }}
            />



            {/* Layer 1: Background */}
            <img
              src="/images/header_bg.png"
              alt="Header Background"
              className="animate-layer-bg"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 1,
                transform: `translate3d(${tilt.layerX * 0.25}px, ${tilt.layerY * 0.25}px, 0px)`,
                transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />

            {/* Layer 2: Nara Lokesh Garu (Beneath CBN) */}
            <img
              src="/images/header_lokesh.png"
              alt="Nara Lokesh"
              className="animate-layer-lokesh"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 2,
                transform: `translate3d(${tilt.layerX * 0.6}px, ${tilt.layerY * 0.6}px, 15px)`,
                transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />

            {/* Layer 3: Bhashyam Ramakrishna Garu (Beneath CBN) */}
            <img
              src="/images/header_brk.png"
              alt="Bhashyam Ramakrishna"
              className="animate-layer-brk"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 2,
                transform: `translate3d(${tilt.layerX * 0.6}px, ${tilt.layerY * 0.6}px, 15px)`,
                transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />

            {/* Layer 4: N. Chandrababu Naidu Garu (ON TOP of Lokesh & BRK) */}
            <img
              src="/images/header_cbn.png"
              alt="CBN"
              className="animate-layer-cbn"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 3,
                transform: `translate3d(${tilt.layerX * 1.1}px, ${tilt.layerY * 1.1}px, 30px)`,
                transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />

            {/* Layer 5: BRK / TDP Logo Overlay (On top of everything) */}
            <img
              src="/images/header_logo.png"
              alt="BRK Social Emblem"
              className="animate-layer-logo"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 4,
                transform: `translate3d(${tilt.layerX * 1.5}px, ${tilt.layerY * 1.5}px, 45px)`,
                transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />
          </div>
        </div>




        {/* Bottom Left Info Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#78716c', marginTop: '16px' }}>
          <span>25 Parliament • 175 Assembly Constituencies</span>
          <span>v1.2 Enterprise</span>
        </div>
      </div>

      {/* RIGHT HALF: Sign-In Crisp White Panel (100% on mobile, 50% on desktop) */}
      <div className="login-right-panel">
        {/* Top Header Bar */}
        {/* Top Role Selector Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: '#f1f5f9',
          padding: '4px',
          borderRadius: '9999px',
          border: '1px solid #cbd5e1',
          width: '100%',
          maxWidth: '420px',
          margin: '0 auto 24px auto'
        }}>
          <button
            type="button"
            onClick={() => { setIsAdminMode(false); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: !isAdminMode ? '#ffffff' : 'transparent',
              color: !isAdminMode ? '#0f172a' : '#64748b',
              boxShadow: !isAdminMode ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <UserCheck size={16} style={{ color: !isAdminMode ? '#ff4d00' : '#64748b' }} />
            <span>Employee Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => { setIsAdminMode(true); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: isAdminMode ? '#ffffff' : 'transparent',
              color: isAdminMode ? '#0f172a' : '#64748b',
              boxShadow: isAdminMode ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <ShieldCheck size={16} style={{ color: isAdminMode ? '#ff4d00' : '#64748b' }} />
            <span>Admin Portal</span>
          </button>
        </div>

        {/* Center Form Container */}
        <div style={{ width: '100%', maxWidth: '420px', margin: 'auto auto' }}>
          <h2 className="login-form-title" style={{ textAlign: 'center' }}>
            {isAdminMode ? 'Admin Portal Sign In' : 'Employee Sign In'}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '24px', textAlign: 'center' }}>
            {isAdminMode
              ? 'Enter administrator credentials to proceed to Admin Page.'
              : 'Sign in with your Support Code, Staff ID, Personal Mobile, or Office Mobile.'}
          </p>

          {/* Biometric / Passkey Login Option (Displayed only when registered credential exists on device or user) */}
          {webauthnSupported && (enrolledUser || hasPasskeyForInput) && (
            <div style={{ marginBottom: '24px' }}>
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={isBiometricLoading}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 77, 0, 0.35)',
                  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.16)',
                  cursor: isBiometricLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  textAlign: 'left',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
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
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(255, 77, 0, 0.35)'
                  }}
                >
                  {isBiometricLoading ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <Fingerprint size={24} strokeWidth={2.2} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                    {isBiometricLoading ? 'Verifying Identity...' : `Login with ${getBiometricMethodName()}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {enrolledUser?.userName
                      ? `Passkey ready for ${enrolledUser.userName}`
                      : 'Fast, secure one-touch authentication'}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    backgroundColor: 'rgba(255, 77, 0, 0.18)',
                    color: '#ff6633',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(255, 77, 0, 0.3)',
                    flexShrink: 0
                  }}
                >
                  PASSKEY
                </span>
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '20px',
                  marginBottom: '6px',
                  color: '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                <span>or use password</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div style={{
              marginBottom: '20px',
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '14px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#b91c1c',
              textAlign: 'center'
            }}>
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={isAdminMode ? handleAdminSubmit : handleEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {isAdminMode ? 'Admin Username' : 'Staff Identifier'}
                </label>
                {!isAdminMode && (
                  <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>
                    Support Code / Staff ID / Mobile
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={isAdminMode ? adminUser : empId}
                onChange={(e) => isAdminMode ? setAdminUser(e.target.value) : setEmpId(e.target.value)}
                placeholder={isAdminMode ? "Admin Username" : "e.g. APP01, Palakonda_010, or 7997955186"}
                style={{
                  width: '100%',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '9999px',
                  padding: '14px 22px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {!isAdminMode && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', paddingLeft: '8px' }}>
                  💡 <strong>Parliament Staff:</strong> Use Support Code (APP01-APP25) or Personal Mobile
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={isAdminMode ? adminPass : empPass}
                  onChange={(e) => isAdminMode ? setAdminPass(e.target.value) : setEmpPass(e.target.value)}
                  placeholder="Password"
                  style={{
                    width: '100%',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '9999px',
                    padding: '16px 24px',
                    paddingRight: '54px',
                    fontSize: '15px',
                    fontWeight: '500',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px',
                    borderRadius: '50%',
                    transition: 'color 0.2s, background-color 0.2s',
                    outline: 'none',
                    WebkitAppearance: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#0f172a';
                    e.currentTarget.style.backgroundColor = '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '18px 28px',
                borderRadius: '9999px',
                background: 'linear-gradient(90deg, #ff4d00 0%, #ff1a40 100%)',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 10px 25px rgba(255, 77, 0, 0.4)',
                marginTop: '8px'
              }}
            >
              {isAdminMode ? 'Sign In as Admin →' : 'Sign In →'}
            </button>
          </form>


        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: '420px',
          margin: '24px auto 0 auto',
          fontSize: '12px',
          color: '#94a3b8',
          paddingTop: '16px',
          borderTop: '1px solid #f1f5f9'
        }}>
          <span>© 2026 BRK Social • Bhashyam Ramakrishna</span>
          <span>Contact Support</span>
        </div>
      </div>
    </div>
  );
}

