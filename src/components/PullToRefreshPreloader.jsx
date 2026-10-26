import React, { useState, useEffect, useRef } from 'react';

/**
 * PullToRefreshPreloader
 * Handles native mobile touch pull-down, trackpad wheel, and mouse drag to trigger data refresh.
 * Features animated MagniDigi (MD) logo mark with dynamic rotation and pulsing halo.
 */
export default function PullToRefreshPreloader({ onRefresh, isRefreshing }) {
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullYRef = useRef(0);
  const wheelDeltaRef = useRef(0);
  const wheelTimerRef = useRef(null);
  const isMousePullingRef = useRef(false);

  const THRESHOLD = 65; // px distance to trigger sync
  const MAX_PULL = 95;

  useEffect(() => {
    // TOUCH EVENTS (Mobile)
    const handleTouchStart = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop <= 5 && !isRefreshing) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!isPullingRef.current || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const rawDelta = currentY - startYRef.current;

      if (rawDelta > 0) {
        // Linear damped pull
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
      if (!isPullingRef.current || isRefreshing) {
        isPullingRef.current = false;
        return;
      }
      isPullingRef.current = false;
      setIsPulling(false);

      if (pullYRef.current >= THRESHOLD) {
        setPullY(THRESHOLD);
        if (onRefresh) {
          onRefresh();
        }
      } else {
        setPullY(0);
      }
      pullYRef.current = 0;
    };

    // MOUSE DRAG EVENTS (Desktop / Responsive Simulator)
    const handleMouseDown = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop <= 5 && !isRefreshing && e.button === 0 && e.clientY < 200) {
        startYRef.current = e.clientY;
        isMousePullingRef.current = true;
      }
    };

    const handleMouseMove = (e) => {
      if (!isMousePullingRef.current || isRefreshing) return;
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
      if (!isMousePullingRef.current || isRefreshing) {
        isMousePullingRef.current = false;
        return;
      }
      isMousePullingRef.current = false;
      setIsPulling(false);

      if (pullYRef.current >= THRESHOLD) {
        setPullY(THRESHOLD);
        if (onRefresh) {
          onRefresh();
        }
      } else {
        setPullY(0);
      }
      pullYRef.current = 0;
    };

    // TRACKPAD / MOUSE WHEEL SCROLL AT TOP
    const handleWheel = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollTop <= 2 && e.deltaY < -8 && !isRefreshing) {
        wheelDeltaRef.current += Math.abs(e.deltaY) * 0.35;
        const distance = Math.min(wheelDeltaRef.current, MAX_PULL);
        pullYRef.current = distance;
        setPullY(distance);
        setIsPulling(true);

        clearTimeout(wheelTimerRef.current);
        if (distance >= THRESHOLD) {
          wheelDeltaRef.current = 0;
          setPullY(THRESHOLD);
          if (onRefresh) onRefresh();
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
  }, [onRefresh, isRefreshing]);

  // Reset pull offset when refreshing concludes
  useEffect(() => {
    if (!isRefreshing && !isPulling) {
      setPullY(0);
    }
  }, [isRefreshing, isPulling]);

  const pullProgress = Math.min(pullY / THRESHOLD, 1);
  const isTriggered = pullY >= THRESHOLD || isRefreshing;
  const rotation = isRefreshing ? 0 : pullY * 6;
  const scale = isRefreshing ? 1 : Math.min(0.55 + pullProgress * 0.45, 1);

  // Position calculation:
  // Starts offscreen at -80px
  // As user pulls, smoothly drops down into view below safe area
  // When refreshing, rests stably at +18px
  const targetY = isRefreshing
    ? 18
    : (isPulling || pullY > 0
      ? (-75 + Math.min(pullY * 1.35, 95))
      : -110);

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
        transition: isPulling ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '8px 18px 8px 10px',
          borderRadius: '9999px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.14), 0 2px 10px rgba(255, 77, 0, 0.22)',
          border: '1.5px solid rgba(255, 77, 0, 0.3)',
          pointerEvents: 'auto'
        }}
      >
        {/* Animated MD Logo Mark */}
        <div
          style={{
            position: 'relative',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {/* Pulsing Aura Halo */}
          {isRefreshing && (
            <div
              style={{
                position: 'absolute',
                inset: -5,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255, 77, 0, 0.45) 0%, transparent 70%)',
                animation: 'mdHaloPulse 1.2s ease-in-out infinite'
              }}
            />
          )}

          <img
            src="/images/magnidigi-logo-mark.png"
            alt="Loading"
            style={{
              width: '32px',
              height: '32px',
              objectFit: 'contain',
              display: 'block',
              borderRadius: '50%',
              transform: isRefreshing ? 'none' : `rotate(${rotation}deg) scale(${scale})`,
              animation: isRefreshing ? 'mdLogoSpin 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite' : 'none',
              transition: isPulling ? 'none' : 'transform 0.18s ease'
            }}
          />
        </div>

        {/* Status Text & Indicator */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: 800,
              color: isTriggered ? '#ff4d00' : '#0f172a',
              letterSpacing: '-0.01em',
              lineHeight: 1.2
            }}
          >
            {isRefreshing
              ? 'Syncing with Server...'
              : isTriggered
              ? 'Release to Refresh'
              : 'Pull Down to Refresh'}
          </span>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
            {isRefreshing ? 'Checking latest submissions' : 'BRK Social TaskHub'}
          </span>
        </div>
      </div>
    </div>
  );
}
