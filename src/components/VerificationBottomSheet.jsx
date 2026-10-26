import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Info, X } from 'lucide-react';
import { formatIST } from '../services/istUtils.js';

/**
 * shadcn-style Bottom Sheet with Touch & Mouse Swipe-Down to Dismiss
 * Displays verification details for an Instagram task submission
 */
export default function VerificationBottomSheet({ submission, onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const currentYRef = useRef(0);
  const sheetRef = useRef(null);

  // Trigger smooth close animation
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 240);
  }, [isClosing, onClose]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Mount animation (slide-up)
  useEffect(() => {
    // Lock body scrolling when bottom sheet is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Slide up immediately on mount
    const timer = requestAnimationFrame(() => {
      setIsOpen(true);
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(timer);
    };
  }, []);

  // --- Touch Gesture Handlers for Swipe Down ---
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    currentYRef.current = touch.clientY;
    startTimeRef.current = Date.now();
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    currentYRef.current = touch.clientY;
    const deltaY = touch.clientY - startYRef.current;

    // Only allow pulling down (positive deltaY)
    if (deltaY > 0) {
      setDragY(deltaY);
      // Prevent default scrolling when pulling sheet down
      if (e.cancelable) {
        e.preventDefault();
      }
    } else {
      // Slight resistance if pulled upward
      setDragY(deltaY * 0.15);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaY = currentYRef.current - startYRef.current;
    const duration = Date.now() - startTimeRef.current;
    const velocity = deltaY / Math.max(duration, 1); // px per ms

    // Dismiss criteria: pulled down > 70px OR fast flick down (> 25px with velocity > 0.4)
    if (deltaY > 70 || (deltaY > 25 && velocity > 0.4)) {
      handleClose();
    } else {
      // Snap back smoothly
      setDragY(0);
    }
  };

  // --- Mouse Drag Handlers (for desktop browser testing) ---
  const handleMouseDown = (e) => {
    startYRef.current = e.clientY;
    currentYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    setIsDragging(true);

    const onMouseMove = (moveEvent) => {
      currentYRef.current = moveEvent.clientY;
      const deltaY = moveEvent.clientY - startYRef.current;
      if (deltaY > 0) {
        setDragY(deltaY);
      } else {
        setDragY(deltaY * 0.15);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);

      const deltaY = currentYRef.current - startYRef.current;
      const duration = Date.now() - startTimeRef.current;
      const velocity = deltaY / Math.max(duration, 1);

      if (deltaY > 70 || (deltaY > 25 && velocity > 0.4)) {
        handleClose();
      } else {
        setDragY(0);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!submission) return null;

  // Calculate backdrop opacity dynamically while dragging
  const dragRatio = Math.min(Math.max(dragY, 0) / 280, 0.9);
  const backdropOpacity = isClosing || !isOpen ? 0 : Math.max(0.1, 1 - dragRatio);

  // Status color calculation
  const isStatusValid = submission.status === 'Valid Submission' || submission.status === 'Valid';
  const isStatusPending = submission.status === 'Pending Submission';
  const statusBg = isStatusValid ? '#16a34a' : (isStatusPending ? '#ea580c' : '#dc2626');

  // Sheet transform
  const sheetTransform = !isOpen || isClosing 
    ? 'translateY(100%)' 
    : `translateY(${Math.max(0, dragY)}px)`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        pointerEvents: 'auto'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
    >
      {/* Dimmed Blurred Backdrop Overlay */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          opacity: backdropOpacity,
          transition: isDragging ? 'none' : 'opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto'
        }}
      />

      {/* shadcn Bottom Sheet Card Container */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.22), 0 -2px 10px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          borderBottom: 'none',
          padding: '12px 20px calc(24px + env(safe-area-inset-bottom, 0px)) 20px',
          transform: sheetTransform,
          transition: isDragging ? 'none' : 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
          zIndex: 10000,
          userSelect: isDragging ? 'none' : 'auto'
        }}
      >
        {/* Grab Handle Header Bar - signature shadcn bottom sheet indicator */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            padding: '2px 0 14px 0',
            touchAction: 'none'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '5px',
              borderRadius: '9999px',
              backgroundColor: '#cbd5e1',
              transition: 'background-color 0.2s ease'
            }}
          />
        </div>

        {/* Modal / Sheet Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                backgroundColor: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7'
              }}
            >
              <Info size={18} />
            </div>
            <div>
              <h3
                id="sheet-title"
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: 0,
                  lineHeight: 1.2
                }}
              >
                Verification Details
              </h3>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0 0', fontWeight: 500 }}>
                Swipe down to dismiss
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close details"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Details List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
          {/* Handle / Entry */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Handle / Entry:</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 800,
                color: '#0f172a',
                fontSize: '14.5px',
                backgroundColor: '#f8fafc',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #f1f5f9'
              }}
            >
              @{String(submission.username || submission.rawInput || '').replace(/^@+/, '')}
            </span>
          </div>

          {/* Status Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Status:</span>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '11.5px',
                fontWeight: 800,
                backgroundColor: statusBg,
                color: '#ffffff',
                boxShadow: `0 2px 6px ${statusBg}40`,
                letterSpacing: '0.2px'
              }}
            >
              {submission.status}
            </span>
          </div>

          {/* Submission Time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Submission Time:</span>
            <span style={{ fontWeight: 600, color: '#334155' }}>
              {formatIST(submission.submittedAt) || submission.timeFormattedIST || 'Today'} IST
            </span>
          </div>

          {/* Follower Timestamp */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Follower Timestamp:</span>
            <span style={{ fontWeight: 600, color: '#334155', textAlign: 'right' }}>
              {submission.followedAtFormatted || (submission.isFollower ? 'Verified' : 'Pending JSON Sync')}
            </span>
          </div>

          {/* Verification Info Box */}
          {submission.verificationBadge && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Verification Info:</span>
              <div
                style={{
                  fontSize: '12px',
                  backgroundColor: '#f8fafc',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  fontWeight: 500,
                  lineHeight: 1.45
                }}
              >
                {submission.verificationBadge}
                {submission.verificationNote ? ` • ${submission.verificationNote}` : ''}
              </div>
            </div>
          )}

          {/* Duplicate Flag */}
          {submission.isDuplicate && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '4px',
                backgroundColor: '#fef2f2',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #fecaca'
              }}
            >
              <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '12px' }}>Duplicate Flag:</span>
              <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                {submission.duplicateOf ? `Duplicate of ${submission.duplicateOf}` : 'Duplicate attempt flagged'}
              </span>
            </div>
          )}
        </div>

        {/* Full-width Close Action Button */}
        <button
          type="button"
          onClick={handleClose}
          style={{
            width: '100%',
            marginTop: '20px',
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: 'none',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0f172a')}
        >
          Close
        </button>
      </div>
    </div>
  );
}
