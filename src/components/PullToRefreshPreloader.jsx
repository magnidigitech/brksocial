import React, { useState, useEffect, useRef } from 'react';

/**
 * PullToRefreshPreloader
 * Circular spinner loader with MagniDigi (MD) logo in the center.
 * Features smooth swipe-down animation with 1.5 second refresh delay and orbital SVG ring spinner.
 */
export default function PullToRefreshPreloader({ onRefresh, isRefreshing }) {
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshingInternal, setIsRefreshingInternal] = useState(false);

  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullYRef = useRef(0);
  const wheelDeltaRef = useRef(0);
  const wheelTimerRef = useRef(null);
  const isMousePullingRef = useRef(false);

  const THRESHOLD = 60; // px pull distance to trigger refresh
  const MAX_PULL = 90;

  const activeRefreshing = isRefreshing || isRefreshingInternal;

  const triggerRefreshWithDelay = () => {
    setIsRefreshingInternal(true);
    setPullY(THRESHOLD);

    const startMs = Date.now();
    const handleDone = () => {
      const elapsed = Date.now() - startMs;
      const remainingDelay = Math.max(0, 1500 - elapsed);
      setTimeout(() => {
        setIsRefreshingInternal(false);
        setPullY(0);
      }, remainingDelay);
    };

    if (onRefresh) {
      Promise.resolve(onRefresh()).finally(handleDone);
    } else {
      handleDone();
    }
  };

  useEffect(() => {
    // TOUCH GESTURES (Mobile)
    const handleTouchStart = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop <= 5 && !activeRefreshing) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!isPullingRef.current || activeRefreshing) return;
      const currentY = e.touches[0].clientY;
      const rawDelta = currentY - startYRef.current;

      if (rawDelta > 0) {
        const distance = Math.min(rawDelta * 0.55, MAX_PULL);
        pullYRef.current = distance;
        setPullY(distance);
        setIsPulling(true);

        if (e.cancelable && distance > 10) {
          e.preventDefault();
        }
      } else {
        pullYRef.current = 0;
        setPullY(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current || activeRefreshing) {
        isPullingRef.current = false;
        return;
      }
      isPullingRef.current = false;
      setIsPulling(false);

      if (pullYRef.current >= THRESHOLD) {
        triggerRefreshWithDelay();
      } else {
        setPullY(0);
      }
      pullYRef.current = 0;
    };

    // MOUSE DRAG GESTURES (Desktop / DevTools Simulator)
    const handleMouseDown = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop <= 5 && !activeRefreshing && e.button === 0 && e.clientY < 180) {
        startYRef.current = e.clientY;
        isMousePullingRef.current = true;
      }
    };

    const handleMouseMove = (e) => {
      if (!isMousePullingRef.current || activeRefreshing) return;
      const rawDelta = e.clientY - startYRef.current;
      if (rawDelta > 0) {
        const distance = Math.min(rawDelta * 0.5, MAX_PULL);
        pullYRef.current = distance;
        setPullY(distance);
        setIsPulling(true);
      } else {
        setPullY(0);
      }
    };

    const handleMouseUp = () => {
      if (!isMousePullingRef.current || activeRefreshing) {
        isMousePullingRef.current = false;
        return;
      }
      isMousePullingRef.current = false;
      setIsPulling(false);

      if (pullYRef.current >= THRESHOLD) {
        triggerRefreshWithDelay();
      } else {
        setPullY(0);
      }
      pullYRef.current = 0;
    };

    // TRACKPAD WHEEL PULL-DOWN AT TOP
    const handleWheel = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop <= 2 && e.deltaY < -8 && !activeRefreshing) {
        wheelDeltaRef.current += Math.abs(e.deltaY) * 0.35;
        const distance = Math.min(wheelDeltaRef.current, MAX_PULL);
        pullYRef.current = distance;
        setPullY(distance);
        setIsPulling(true);

        clearTimeout(wheelTimerRef.current);
        if (distance >= THRESHOLD) {
          wheelDeltaRef.current = 0;
          triggerRefreshWithDelay();
        } else {
          wheelTimerRef.current = setTimeout(() => {
            wheelDeltaRef.current = 0;
            setPullY(0);
            setIsPulling(false);
          }, 350);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);

      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      clearTimeout(wheelTimerRef.current);
    };
  }, [onRefresh, activeRefreshing]);

  // SVG circle circumference for r = 24 is 2 * PI * 24 ≈ 150.8
  const CIRCUMFERENCE = 150.8;
  const pullProgress = Math.min(pullY / THRESHOLD, 1);

  // Position calculation:
  // Starts offscreen above viewport at -85px
  // As user pulls down, smoothly glides down into center
  // While refreshing, rests comfortably at +22px below safe area
  const isVisible = pullY > 0 || activeRefreshing;
  const targetY = activeRefreshing
    ? 22
    : (isPulling || pullY > 0
      ? (-80 + Math.min(pullY * 1.5, 102))
      : -95);

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(14px, env(safe-area-inset-top, 14px))',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        zIndex: 9999,
        pointerEvents: 'none',
        transform: `translateY(${targetY}px)`,
        transition: isPulling ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
        opacity: isVisible ? 1 : 0,
        willChange: 'transform, opacity'
      }}
    >
      {/* Top Center Circular Badge with Orbital Spinner */}
      <div
        style={{
          position: 'relative',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(255, 77, 0, 0.22)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto'
        }}
      >
        {/* Orbital SVG Circular Spinner Ring */}
        <svg
          style={{
            position: 'absolute',
            inset: -4,
            width: '60px',
            height: '60px',
            transform: activeRefreshing ? 'none' : `rotate(${pullY * 4.5 - 90}deg)`,
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
            stroke="rgba(255, 77, 0, 0.15)"
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
              animation: activeRefreshing ? 'mdCircleSpinner 0.9s linear infinite' : 'none',
              transition: isPulling ? 'none' : 'stroke-dashoffset 0.2s ease'
            }}
            strokeDasharray={activeRefreshing ? '95 55' : `${CIRCUMFERENCE}`}
            strokeDashoffset={activeRefreshing ? '0' : `${CIRCUMFERENCE * (1 - pullProgress)}`}
          />
        </svg>

        {/* MagniDigi (MD) Logo Mark in Middle */}
        <img
          src="/images/magnidigi-logo-mark.png"
          alt="MagniDigi"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            objectFit: 'contain',
            display: 'block',
            position: 'relative',
            zIndex: 2,
            transform: `scale(${activeRefreshing ? 1 : Math.min(0.8 + pullProgress * 0.2, 1)})`,
            transition: 'transform 0.2s ease'
          }}
        />
      </div>
    </div>
  );
}
