import React, { useState, useEffect, useRef } from 'react';

/**
 * PullToRefreshPreloader
 * Native iOS/Android style pull-to-refresh spinner with MagniDigi (MD) branding.
 * - Smooth touch-based pull-down with elastic resistance
 * - Snappy and glitch-free: dismisses immediately once refresh completes
 * - Zero accidental desktop mouse or trackpad bounce triggers
 */
export default function PullToRefreshPreloader({ onRefresh, isRefreshing }) {
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullYRef = useRef(0);

  const THRESHOLD = 55; // px pull distance to trigger refresh
  const MAX_PULL = 85;

  const triggerRefresh = () => {
    setIsPulling(false);
    setPullY(0);
    pullYRef.current = 0;
    if (onRefresh && !isRefreshing) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(12); } catch (_) {}
      }
      onRefresh();
    }
  };

  useEffect(() => {
    // Touch Gestures only (mobile & tablet)
    const handleTouchStart = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop <= 2 && !isRefreshing) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!isPullingRef.current || isRefreshing) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop > 2) {
        isPullingRef.current = false;
        setPullY(0);
        setIsPulling(false);
        return;
      }

      const currentY = e.touches[0].clientY;
      const rawDelta = currentY - startYRef.current;

      if (rawDelta > 0) {
        // Logarithmic / dampened elastic resistance
        const distance = Math.min(rawDelta * 0.45, MAX_PULL);
        pullYRef.current = distance;
        setPullY(distance);
        setIsPulling(true);

        if (e.cancelable && distance > 12) {
          e.preventDefault();
        }
      } else {
        pullYRef.current = 0;
        setPullY(0);
        setIsPulling(false);
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current || isRefreshing) {
        isPullingRef.current = false;
        return;
      }
      isPullingRef.current = false;
      setIsPulling(false);

      if (pullYRef.current >= THRESHOLD) {
        triggerRefresh();
      } else {
        setPullY(0);
      }
      pullYRef.current = 0;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onRefresh, isRefreshing]);

  // SVG circle circumference for r = 24 is 2 * PI * 24 ≈ 150.8
  const CIRCUMFERENCE = 150.8;
  const pullProgress = Math.min(pullY / THRESHOLD, 1);

  // Position calculation:
  // Hidden above screen at -75px
  // Glides down to +18px when pulled or refreshing
  const isVisible = isRefreshing || pullY > 0;
  const targetY = isRefreshing
    ? 18
    : (pullY > 0 ? (-70 + Math.min(pullY * 1.5, 88)) : -75);

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(10px, env(safe-area-inset-top, 10px))',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        zIndex: 9999,
        pointerEvents: 'none',
        transform: `translate3d(0, ${targetY}px, 0)`,
        transition: isPulling ? 'none' : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease',
        opacity: isVisible ? 1 : 0,
        willChange: 'transform, opacity'
      }}
    >
      {/* Top Center Circular Badge with Orbital Spinner */}
      <div
        style={{
          position: 'relative',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 8px 22px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(255, 77, 0, 0.2)',
          border: '1px solid rgba(0, 0, 0, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Orbital SVG Circular Spinner Ring */}
        <svg
          style={{
            position: 'absolute',
            inset: -3,
            width: '54px',
            height: '54px',
            transform: isRefreshing ? 'none' : `rotate(${pullY * 5 - 90}deg)`,
            transformOrigin: 'center center',
            pointerEvents: 'none'
          }}
          viewBox="0 0 60 60"
        >
          {/* Subtle background track */}
          <circle
            cx="30"
            cy="30"
            r="24"
            fill="none"
            stroke="rgba(255, 77, 0, 0.12)"
            strokeWidth="3"
          />

          {/* Active orange spinner ring */}
          <circle
            cx="30"
            cy="30"
            r="24"
            fill="none"
            stroke="#ff4d00"
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              transformOrigin: 'center center',
              animation: isRefreshing ? 'mdCircleSpinner 0.75s linear infinite' : 'none',
              transition: isPulling ? 'none' : 'stroke-dashoffset 0.15s ease'
            }}
            strokeDasharray={isRefreshing ? '95 55' : `${CIRCUMFERENCE}`}
            strokeDashoffset={isRefreshing ? '0' : `${CIRCUMFERENCE * (1 - pullProgress)}`}
          />
        </svg>

        {/* MagniDigi (MD) Logo Mark in Middle */}
        <img
          src="/images/magnidigi-logo-mark.png"
          alt="MagniDigi"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            objectFit: 'contain',
            display: 'block',
            position: 'relative',
            zIndex: 2,
            transform: `scale(${isRefreshing ? 1 : Math.min(0.85 + pullProgress * 0.15, 1)})`,
            transition: 'transform 0.15s ease'
          }}
        />
      </div>
    </div>
  );
}
