import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check
} from 'lucide-react';
import {
  getTodayISTDateString,
  getISTDateOffset,
  getMondayOfCurrentWeekIST,
  addDaysToDateStr
} from '../services/istUtils.js';

/**
 * Format a YYYY-MM-DD date string into a friendly label (e.g. "27 Oct 2026")
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${monthNames[m - 1]} ${y}`;
}

/**
 * Get date range for standard presets
 */
export function getPresetDateRange(key) {
  const today = getTodayISTDateString();
  const [y, m] = today.split('-').map(Number);

  switch (key) {
    case 'TODAY':
      return {
        startDate: today,
        endDate: today,
        preset: 'TODAY',
        label: 'Today'
      };

    case 'YESTERDAY': {
      const yesterday = getISTDateOffset(-1);
      return {
        startDate: yesterday,
        endDate: yesterday,
        preset: 'YESTERDAY',
        label: 'Yesterday'
      };
    }

    case 'THIS_WEEK': {
      const monday = getMondayOfCurrentWeekIST(today);
      const sunday = addDaysToDateStr(monday, 6);
      return {
        startDate: monday,
        endDate: sunday,
        preset: 'THIS_WEEK',
        label: 'This Week'
      };
    }

    case 'LAST_WEEK': {
      const thisMonday = getMondayOfCurrentWeekIST(today);
      const lastMonday = addDaysToDateStr(thisMonday, -7);
      const lastSunday = addDaysToDateStr(lastMonday, 6);
      return {
        startDate: lastMonday,
        endDate: lastSunday,
        preset: 'LAST_WEEK',
        label: 'Last Week'
      };
    }

    case 'THIS_MONTH': {
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate: start,
        endDate: end,
        preset: 'THIS_MONTH',
        label: 'This Month'
      };
    }

    case 'LAST_MONTH': {
      let prevY = y;
      let prevM = m - 1;
      if (prevM === 0) {
        prevM = 12;
        prevY -= 1;
      }
      const start = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
      const lastDay = new Date(prevY, prevM, 0).getDate();
      const end = `${prevY}-${String(prevM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate: start,
        endDate: end,
        preset: 'LAST_MONTH',
        label: 'Last Month'
      };
    }

    case '7DAYS': {
      const start = getISTDateOffset(-6);
      return {
        startDate: start,
        endDate: today,
        preset: '7DAYS',
        label: 'Last 7 Days'
      };
    }

    case '30DAYS': {
      const start = getISTDateOffset(-29);
      return {
        startDate: start,
        endDate: today,
        preset: '30DAYS',
        label: 'Last 30 Days'
      };
    }

    case 'THIS_YEAR': {
      return {
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
        preset: 'THIS_YEAR',
        label: 'This Year'
      };
    }

    case 'LAST_YEAR': {
      const prevYear = y - 1;
      return {
        startDate: `${prevYear}-01-01`,
        endDate: `${prevYear}-12-31`,
        preset: 'LAST_YEAR',
        label: 'Last Year'
      };
    }

    case 'ALL':
    default:
      return {
        startDate: null,
        endDate: null,
        preset: 'ALL',
        label: 'All Time'
      };
  }
}

/**
 * Format a human-friendly range label
 */
export function formatRangeLabel(startDate, endDate, preset) {
  if (preset && preset !== 'CUSTOM') {
    const p = getPresetDateRange(preset);
    if (preset === 'ALL') return 'All Time';
    if (startDate && endDate) {
      if (startDate === endDate) {
        return `${p.label} (${formatDisplayDate(startDate)})`;
      }
      return `${p.label} (${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)})`;
    }
    return p.label;
  }

  if (startDate && endDate) {
    if (startDate === endDate) {
      return formatDisplayDate(startDate);
    }
    return `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;
  }

  if (startDate) {
    return `From ${formatDisplayDate(startDate)}`;
  }

  if (endDate) {
    return `Until ${formatDisplayDate(endDate)}`;
  }

  return 'All Time';
}

export const DEFAULT_PRESETS = [
  { key: 'TODAY', label: 'Today' },
  { key: 'YESTERDAY', label: 'Yesterday' },
  { key: 'THIS_WEEK', label: 'This Week' },
  { key: 'LAST_WEEK', label: 'Last Week' },
  { key: 'THIS_MONTH', label: 'This Month' },
  { key: 'LAST_MONTH', label: 'Last Month' },
  { key: '7DAYS', label: 'Last 7 Days' },
  { key: 'ALL', label: 'All Time' },
  { key: 'CUSTOM', label: 'Custom' }
];

/**
 * Reusable Date Range Picker Component
 * 
 * Props:
 * - value: { startDate: string|null, endDate: string|null, preset?: string, label?: string }
 * - onChange: ({ startDate, endDate, preset, label }) => void
 * - align: 'left' | 'right' (default 'left')
 * - presets: array of preset objects (defaults to standard presets)
 * - placeholder: string
 * - compact: boolean
 * - allowClear: boolean
 */
export function DateRangePicker({
  value = { startDate: null, endDate: null, preset: 'ALL' },
  onChange,
  align = 'left',
  presets = DEFAULT_PRESETS,
  placeholder = 'Select date range',
  compact = false,
  allowClear = true,
  disabled = false,
  style = {},
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Draft selection state inside the popover
  const [draftStart, setDraftStart] = useState(value?.startDate || null);
  const [draftEnd, setDraftEnd] = useState(value?.endDate || null);
  const [draftPreset, setDraftPreset] = useState(value?.preset || (value?.startDate ? 'CUSTOM' : 'ALL'));
  const [hoverDate, setHoverDate] = useState(null);

  // Active calendar view (month: 0-11, year: full year)
  const todayStr = getTodayISTDateString();
  const [todayY, todayM] = todayStr.split('-').map(Number);

  const initialDate = value?.startDate || todayStr;
  const [initY, initM] = initialDate.split('-').map(Number);
  const [viewYear, setViewYear] = useState(initY || todayY);
  const [viewMonth, setViewMonth] = useState((initM ? initM - 1 : todayM - 1));

  // Sync draft state whenever popover opens or external value changes
  useEffect(() => {
    if (isOpen) {
      setDraftStart(value?.startDate || null);
      setDraftEnd(value?.endDate || null);
      setDraftPreset(value?.preset || (value?.startDate ? 'CUSTOM' : 'ALL'));
      setHoverDate(null);

      const refDate = value?.startDate || value?.endDate || todayStr;
      const [refY, refM] = refDate.split('-').map(Number);
      if (refY && refM) {
        setViewYear(refY);
        setViewMonth(refM - 1);
      }
    }
  }, [isOpen, value]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Month title e.g. "October 2026"
  const monthTitle = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
  }, [viewYear, viewMonth]);

  // Calendar cells generation (Monday to Sunday grid)
  const calendarCells = useMemo(() => {
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // 0 is Sunday, 1 is Monday... convert so Monday is 0, Sunday is 6
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const leadingEmpty = (firstDayOfWeek + 6) % 7;

    const cells = [];

    // Prev month days
    let prevY = viewYear;
    let prevM = viewMonth; // 1-indexed for prevMonth would be viewMonth
    if (prevM === 0) {
      prevM = 12;
      prevY -= 1;
    }
    for (let i = leadingEmpty - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      cells.push({
        dayNumber: dNum,
        dateStr,
        isCurrentMonth: false,
        isPrevMonth: true
      });
    }

    // Current month days
    const currM = viewMonth + 1;
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${viewYear}-${String(currM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true
      });
    }

    // Next month days to fill remaining week grid
    const remaining = (7 - (cells.length % 7)) % 7;
    let nextY = viewYear;
    let nextM = viewMonth + 2;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    for (let d = 1; d <= remaining; d++) {
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        isNextMonth: true
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  // Date selection logic
  const handleDateClick = (dateStr) => {
    // If we haven't selected a start date or we already have both dates selected: start new selection
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(dateStr);
      setDraftEnd(null);
      setDraftPreset('CUSTOM');
      setHoverDate(null);
    } else {
      // We already have draftStart, now selecting draftEnd
      if (dateStr < draftStart) {
        setDraftEnd(draftStart);
        setDraftStart(dateStr);
      } else {
        setDraftEnd(dateStr);
      }
      setDraftPreset('CUSTOM');
      setHoverDate(null);
    }
  };

  // Preset click logic
  const handlePresetClick = (pKey) => {
    setDraftPreset(pKey);
    const range = getPresetDateRange(pKey);
    setDraftStart(range.startDate);
    setDraftEnd(range.endDate);
    setHoverDate(null);

    // Navigate calendar view to that range's start date
    if (range.startDate) {
      const [rY, rM] = range.startDate.split('-').map(Number);
      if (rY && rM) {
        setViewYear(rY);
        setViewMonth(rM - 1);
      }
    }
  };

  // Confirm and Apply selection
  const handleApply = () => {
    const label = formatRangeLabel(draftStart, draftEnd, draftPreset);
    if (onChange) {
      onChange({
        startDate: draftStart,
        endDate: draftEnd,
        preset: draftPreset,
        label
      });
    }
    setIsOpen(false);
  };

  // Clear / Reset to All Time
  const handleClear = (e) => {
    e?.stopPropagation();
    const range = getPresetDateRange('ALL');
    if (onChange) {
      onChange(range);
    }
    setDraftStart(null);
    setDraftEnd(null);
    setDraftPreset('ALL');
    setIsOpen(false);
  };

  // Effective range to render highlight for (including hover preview)
  const effectiveStart = draftStart;
  const effectiveEnd = draftEnd || (draftStart && hoverDate && hoverDate >= draftStart ? hoverDate : (draftStart && hoverDate ? hoverDate : draftStart));
  const normalizedStart = effectiveStart && effectiveEnd && effectiveStart > effectiveEnd ? effectiveEnd : effectiveStart;
  const normalizedEnd = effectiveStart && effectiveEnd && effectiveStart > effectiveEnd ? effectiveStart : effectiveEnd;

  const currentLabel = useMemo(() => {
    return formatRangeLabel(value?.startDate, value?.endDate, value?.preset);
  }, [value]);

  const hasActiveFilter = Boolean(value?.startDate || value?.endDate || (value?.preset && value?.preset !== 'ALL'));

  return (
    <div
      ref={containerRef}
      className={`date-range-picker-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        ...style
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: compact ? '6px 10px' : '7px 13px',
          borderRadius: '10px',
          border: isOpen ? '1.5px solid #0f172a' : '1px solid rgba(0, 0, 0, 0.12)',
          backgroundColor: isOpen ? '#ffffff' : (hasActiveFilter ? 'rgba(15, 23, 42, 0.04)' : '#ffffff'),
          color: '#1d1d1f',
          fontSize: compact ? '12px' : '12.5px',
          fontWeight: hasActiveFilter ? 600 : 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(0, 0, 0, 0.06)'
            : '0 1px 2px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.15s ease',
          outline: 'none',
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={(e) => {
          if (!isOpen && !disabled) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen && !disabled) {
            e.currentTarget.style.backgroundColor = hasActiveFilter ? 'rgba(15, 23, 42, 0.04)' : '#ffffff';
          }
        }}
      >
        <CalendarIcon size={14} style={{ color: hasActiveFilter ? '#0f172a' : '#86868b', flexShrink: 0 }} />
        <span>{currentLabel || placeholder}</span>

        {/* Clear (X) icon if active, otherwise chevron */}
        {allowClear && hasActiveFilter && !disabled ? (
          <span
            onClick={handleClear}
            title="Reset to All Time"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.08)',
              color: '#555',
              marginLeft: '2px',
              transition: 'all 0.12s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.18)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'}
          >
            <X size={10} strokeWidth={2.5} />
          </span>
        ) : (
          <ChevronDown
            size={13}
            style={{
              color: '#86868b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        )}
      </button>

      {/* Floating Popover Card */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            [align === 'right' ? 'right' : 'left']: 0,
            zIndex: 1050,
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.15), 0 8px 16px -4px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'row',
            overflow: 'hidden',
            width: '420px',
            maxWidth: 'calc(100vw - 24px)',
            boxSizing: 'border-box',
            animation: 'datePickerFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Left Sidebar: Presets */}
          <div
            style={{
              width: '140px',
              minWidth: '130px',
              backgroundColor: '#fafafa',
              borderRight: '1px solid rgba(0, 0, 0, 0.06)',
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}
          >
            {/* Presets List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '2px 8px 6px'
              }}>
                Presets
              </div>
              {presets.map(p => {
                const isSelected = draftPreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePresetClick(p.key)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isSelected ? 'rgba(15, 23, 42, 0.08)' : 'transparent',
                      color: isSelected ? '#0f172a' : '#475569',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span>{p.label}</span>
                    {isSelected && <Check size={12} strokeWidth={2.5} style={{ color: '#0f172a' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Section: Interactive Calendar */}
          <div
            style={{
              flex: 1,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              minWidth: '270px'
            }}
          >
            {/* Header: Month & Year with Navigation Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}
            >
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous month"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background-color 0.12s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <ChevronLeft size={15} />
              </button>

              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {monthTitle}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                title="Next month"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background-color 0.12s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Weekday Names Header (Mon Tue Wed Thu Fri Sat Sun) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                textAlign: 'center',
                marginBottom: '6px'
              }}
            >
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(w => (
                <div
                  key={w}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#94a3b8',
                    padding: '4px 0'
                  }}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                rowGap: '3px',
                columnGap: '0px'
              }}
              onMouseLeave={() => setHoverDate(null)}
            >
              {calendarCells.map((cell, idx) => {
                const dateStr = cell.dateStr;
                const isToday = dateStr === todayStr;

                const isStart = normalizedStart === dateStr;
                const isEnd = normalizedEnd === dateStr;
                const isInRange = normalizedStart && normalizedEnd && dateStr >= normalizedStart && dateStr <= normalizedEnd;
                const isSingleSelected = isStart && isEnd;

                // Day of row (0: Monday, 6: Sunday)
                const colIdx = idx % 7;
                const isFirstCol = colIdx === 0;
                const isLastCol = colIdx === 6;

                // Continuous ribbon styling
                let cellBg = 'transparent';
                let borderRadius = '0';

                if (isInRange) {
                  cellBg = '#f1f5f9';
                  if (isStart || isFirstCol) {
                    borderRadius = '8px 0 0 8px';
                  }
                  if (isEnd || isLastCol) {
                    borderRadius = isStart || isFirstCol ? '8px' : '0 8px 8px 0';
                  }
                  if (isSingleSelected) {
                    borderRadius = '8px';
                  }
                }

                return (
                  <div
                    key={dateStr + '_' + idx}
                    style={{
                      position: 'relative',
                      height: '34px',
                      backgroundColor: cellBg,
                      borderRadius: borderRadius,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.12s ease'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDateClick(dateStr)}
                      onMouseEnter={(e) => {
                        if (draftStart && !draftEnd) {
                          setHoverDate(dateStr);
                        }
                        if (!isStart && !isEnd) {
                          e.currentTarget.style.backgroundColor = isInRange ? 'rgba(15, 23, 42, 0.12)' : 'rgba(0, 0, 0, 0.05)';
                        }
                      }}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: (isStart || isEnd) ? '8px' : '6px',
                        border: isToday && !isInRange ? '1px solid rgba(15, 23, 42, 0.3)' : 'none',
                        backgroundColor: (isStart || isEnd) ? '#0f172a' : 'transparent',
                        color: (isStart || isEnd)
                          ? '#ffffff'
                          : (!cell.isCurrentMonth
                            ? '#cbd5e1'
                            : (isInRange ? '#0f172a' : '#1e293b')),
                        fontSize: '12px',
                        fontWeight: (isStart || isEnd || isToday) ? 700 : (cell.isCurrentMonth ? 500 : 400),
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        outline: 'none',
                        transition: 'all 0.12s ease'
                      }}
                      onMouseLeave={(e) => {
                        if (!isStart && !isEnd) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <span>{cell.dayNumber}</span>
                      {isToday && !(isStart || isEnd) && (
                        <span
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            backgroundColor: '#0f172a',
                            position: 'absolute',
                            bottom: '3px'
                          }}
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Selection Status Summary & Full-Width Fill Apply Button */}
            <div
              style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b'
                }}
              >
                <span>
                  {draftStart && draftEnd ? (
                    <>
                      <strong style={{ color: '#0f172a' }}>Range:</strong>{' '}
                      {formatDisplayDate(draftStart)} – {formatDisplayDate(draftEnd)}
                    </>
                  ) : draftStart ? (
                    <>
                      <strong style={{ color: '#0f172a' }}>Start:</strong> {formatDisplayDate(draftStart)} (select end date)
                    </>
                  ) : draftPreset === 'ALL' ? (
                    <strong style={{ color: '#0f172a' }}>Range: All Time</strong>
                  ) : (
                    'Select start and end date'
                  )}
                </span>

                {(draftStart || (draftPreset && draftPreset !== 'ALL')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftStart(null);
                      setDraftEnd(null);
                      setDraftPreset('ALL');
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      padding: 0
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Full-width Fill Apply Button on Calendar Side */}
              <button
                type="button"
                onClick={handleApply}
                style={{
                  width: '100%',
                  padding: '9px 16px',
                  borderRadius: '9px',
                  border: 'none',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 5px rgba(15, 23, 42, 0.22)',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f172a'}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;
