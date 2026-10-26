import React, { useState, useEffect, useRef } from 'react';

/**
 * PullToRefreshPreloader
 * Handles native mobile touch pull-down gesture to trigger data refresh.
 * Features animated MagniDigi (MD) logo mark with dynamic rotation and pulsing halo.
 */
export default function PullToRefreshPreloader({ onRefresh, isRefreshing }) {
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullYRef = useRef(0);

  const THRESHOLD = 65; // px distance to trigger sync
  const MAX_PULL = 100;

  useEffect(() => {
    const handleTouchStart = (e) => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop <= 2 && !isRefreshing) {
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
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;

      if (rawDelta > 0 && scrollTop <= 2) {
        const distance = Math.min(Math.pow(rawDelta, 0.82), MAX_PULL);
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
      if (!isPullingRef.current || isRefreshing) return;
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

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, isRefreshing]);

  // Reset pull offset when refreshing concludes
  useEffect(() => {
    if (!isRefreshing && !isPulling) {
      setPullY(0);
    }
  }, [isRefreshing, isPulling]);

  const activeY = isRefreshing ? 60 : pullY;
  const isTriggered = pullY >= THRESHOLD || isRefreshing;
  const rotation = isRefreshing ? 0 : pullY * 5;
  const scale = Math.min(Math.max(pullY / THRESHOLD, 0.45), 1);

  if (activeY <= 0 && !isRefreshing) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        zIndex: 9990,
        pointerEvents: 'none',
        transform: `translateY(${activeY - 56}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '8px 18px 8px 10px',
          borderRadius: '9999px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(234, 88, 12, 0.2)',
          border: '1.5px solid rgba(234, 88, 12, 0.25)',
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
                inset: -4,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(234, 88, 12, 0.4) 0%, transparent 70%)',
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
              fontSize: '12px',
              fontWeight: 800,
              color: isTriggered ? '#ea580c' : '#0f172a',
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
          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
            {isRefreshing ? 'Checking official followers' : 'BRK Social TaskHub'}
          </span>
        </div>
      </div>
    </div>
  );
}
