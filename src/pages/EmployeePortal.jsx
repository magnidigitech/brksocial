import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  LogOut, 
  Target, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Send, 
  Instagram, 
  MessageSquare, 
  Twitter, 
  Facebook, 
  Youtube, 
  ClipboardList, 
  Share2, 
  Building2, 
  MapPin,
  ShieldAlert,
  Award,
  Copy,
  Check,
  ExternalLink,
  MousePointerClick,
  Flame
} from 'lucide-react';
import { dbService } from '../services/db.js';
import { normalizeInstagramUsername } from '../services/normalization.js';

const PLATFORM_ICONS = {
  'Instagram': Instagram,
  'WhatsApp': MessageSquare,
  'X (Twitter)': Twitter,
  'Facebook': Facebook,
  'YouTube': Youtube,
  'Ground Survey': ClipboardList,
  'Custom': Share2
};

export function EmployeePortal({ session, onLogout }) {
  const [employee, setEmployee] = useState(null);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [taskStats, setTaskStats] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackingLink, setTrackingLink] = useState(null);
  const [linkClicks, setLinkClicks] = useState({ totalClicks: 0, validClicks: 0, uniqueIps: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [session]);

  // Real-time live update for clicks and submissions across devices
  useEffect(() => {
    const handleLiveRefresh = () => {
      const empId = employee?.id || session?.employeeId || session?.id || 'APP13';
      const taskId = activeTask?.id || 'TASK-INSTA-001';
      const today = new Date().toISOString().split('T')[0];
      const stats = dbService.getEmployeeDailyStats(empId, today, taskId);
      setTaskStats(stats);
      const link = dbService.getTrackingLinkForEmployee(taskId, empId);
      setTrackingLink(link);
      const clicks = dbService.getEmployeeTaskClicks(empId, taskId, today);
      setLinkClicks(clicks || { totalClicks: 0, validClicks: 0, uniqueIps: 0 });
    };

    window.addEventListener('brk_link_click_event', handleLiveRefresh);
    window.addEventListener('storage', handleLiveRefresh);
    window.addEventListener('brk_submission_event', handleLiveRefresh);

    const interval = setInterval(() => {
      dbService.syncClicksWithServer().then(() => {
        handleLiveRefresh();
      }).catch(() => {});
    }, 2500);

    return () => {
      window.removeEventListener('brk_link_click_event', handleLiveRefresh);
      window.removeEventListener('storage', handleLiveRefresh);
      window.removeEventListener('brk_submission_event', handleLiveRefresh);
      clearInterval(interval);
    };
  }, [employee, session, activeTask]);

  const loadData = () => {
    const empId = session?.employeeId || session?.id || 'APP13';
    const empData = dbService.getEmployeeById(empId);
    setEmployee(empData || session);

    // Get assigned tasks for this employee based on parliament/assembly scope
    const tasks = dbService.getTasksForEmployee(empId);
    setAssignedTasks(tasks);

    if (tasks.length > 0) {
      const selected = activeTask ? (tasks.find(t => t.id === activeTask.id) || tasks[0]) : tasks[0];
      setActiveTask(selected);
      updateStats(empId, selected.id);
    }
  };

  const updateStats = (empId, taskId) => {
    const today = new Date().toISOString().split('T')[0];
    const stats = dbService.getEmployeeDailyStats(empId, today, taskId);
    setTaskStats(stats);

    // Fetch employee tracking link & live clicks
    if (empId) {
      const link = dbService.getTrackingLinkForEmployee(taskId, empId);
      setTrackingLink(link);
      const clicks = dbService.getEmployeeTaskClicks(empId, taskId, today);
      setLinkClicks(clicks || { totalClicks: 0, validClicks: 0, uniqueIps: 0 });
    }
  };

  const handleTaskSwitch = (task) => {
    setActiveTask(task);
    setInputVal('');
    setFeedback(null);
    const empId = employee?.id || session?.employeeId || session?.id || 'APP13';
    updateStats(empId, task.id);
  };

  const effectiveLink = trackingLink || (activeTask && (employee?.id || session?.employeeId || session?.id)
    ? dbService.getTrackingLinkForEmployee(activeTask.id, employee?.id || session?.employeeId || session?.id)
    : null);

  const getFullTrackingUrl = () => {
    const link = effectiveLink;
    if (!link) return '';
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://social.bhashyamramakrishna.in';
    const slug = link.slug || link.urlSlug || 'go';
    return `${origin}/${slug}/${link.token}`;
  };

  const handleCopyLink = () => {
    const url = getFullTrackingUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const handleWhatsAppShare = () => {
    const url = getFullTrackingUrl();
    if (!url) return;
    const msg = `నమస్కారం! శ్రీ భాష్యం రామకృష్ణ గారి అధికారిక సోషల్ మీడియా పేజీని ఫాలో అవ్వండి:\n👉 ${url}\n\nFollow Sri Bhashyam Ramakrishna!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim() || !activeTask) return;

    setIsSubmitting(true);
    setFeedback(null);

    const empId = employee?.id || session?.employeeId;

    // Standardize input
    let normalized = inputVal.trim();
    if (activeTask.platform === 'Instagram' || activeTask.submissionType.includes('Handle')) {
      const normRes = normalizeInstagramUsername(inputVal);
      if (!normRes.isValid) {
        setFeedback({
          type: 'error',
          message: normRes.error || 'Invalid Instagram handle.'
        });
        setIsSubmitting(false);
        return;
      }
      normalized = normRes.normalized;
    } else {
      normalized = normalized.toLowerCase();
    }

    // Process submission via DB Service
    const res = dbService.processSubmission({
      employeeId: empId,
      taskId: activeTask.id,
      normalizedUsername: normalized,
      rawInput: inputVal.trim()
    });

    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Accepted! '${normalized}' saved successfully.`
      });
      setInputVal('');
    } else {
      setFeedback({
        type: res.status === 'Duplicate' ? 'error' : 'warning',
        message: res.message
      });
    }

    updateStats(empId, activeTask.id);
    setIsSubmitting(false);
  };

  const PlatformIcon = activeTask ? (PLATFORM_ICONS[activeTask.platform] || Share2) : Share2;

  return (
    <div className="dashboard-page-wrapper">
      {/* Background Soft Glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '450px',
        height: '450px',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.5,
        filter: 'blur(80px)',
        background: 'radial-gradient(circle, rgba(255, 77, 0, 0.2) 0%, rgba(255, 26, 64, 0.08) 50%, transparent 75%)'
      }} />

      {/* Main Container Frame */}
      <div className="dashboard-main-frame" style={{ maxWidth: '1000px' }}>
        {/* Top Header & Staff Info */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '20px'
        }}>
          {/* Staff Badge & Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#fff7ed',
              border: '1.5px solid #ffedd5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ea580c',
              flexShrink: 0
            }}>
              <UserCheck size={20} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  {employee?.name || session?.name || 'Field Staff'}
                </h1>
                <span style={{
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1'
                }}>
                  Code: {employee?.supportCode || employee?.id || session?.employeeId}
                </span>

                {(employee?.staffId || session?.staffId) && (
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe'
                  }}>
                    ID: {employee?.staffId || session?.staffId}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 500, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Building2 size={13} style={{ color: '#ff4d00' }} />
                  {employee?.parliamentName} Parliament
                </span>
                {employee?.assemblyName && (
                  <>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} style={{ color: '#0284c7' }} />
                      {employee?.assemblyName} Segment
                    </span>
                  </>
                )}
                {(employee?.mobilePersonal || session?.mobilePersonal) && (
                  <>
                    <span>•</span>
                    <span>Mob: <strong style={{ color: '#0f172a' }}>{employee?.mobilePersonal || session?.mobilePersonal}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '9999px',
              backgroundColor: '#fff1f2',
              color: '#e11d48',
              border: '1px solid #fecdd3',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* ASSIGNED TASKS SELECTOR (If Multiple Tasks exist) */}
        {assignedTasks.length > 1 && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Select Assigned Task ({assignedTasks.length} Active Tasks):
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {assignedTasks.map((t) => {
                const Icon = PLATFORM_ICONS[t.platform] || Share2;
                const isSel = activeTask?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleTaskSwitch(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isSel ? '1.5px solid #ff4d00' : '1px solid #cbd5e1',
                      backgroundColor: isSel ? '#fff7ed' : '#ffffff',
                      color: isSel ? '#c2410c' : '#475569',
                      boxShadow: isSel ? '0 4px 12px rgba(255, 77, 0, 0.15)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Icon size={16} />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ACTIVE TASK CARD & PROGRESS BAR */}
        {activeTask ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Task Overview Box */}
            <div className="dashboard-section-card" style={{ backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#ff4d00',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <PlatformIcon size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                      {activeTask.name}
                    </h2>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
                      {activeTask.description || `Platform: ${activeTask.platform}`}
                    </p>
                  </div>
                </div>

                <div style={{
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#334155'
                }}>
                  Target: <strong>{activeTask.dailyTarget}</strong> {activeTask.submissionType || 'entries'} / day
                </div>
              </div>

              {/* Progress Bar */}
              {taskStats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    <span>Daily Completion Progress</span>
                    <span style={{ color: taskStats.validCount >= activeTask.dailyTarget ? '#16a34a' : '#ea580c' }}>
                      {taskStats.validCount} / {activeTask.dailyTarget} Valid ({taskStats.progressPercent}%)
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    height: '10px',
                    backgroundColor: '#e2e8f0',
                    borderRadius: '9999px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${taskStats.progressPercent}%`,
                      height: '100%',
                      background: taskStats.validCount >= activeTask.dailyTarget 
                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' 
                        : 'linear-gradient(90deg, #ff4d00 0%, #ff1a40 100%)',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* YOUR UNIQUE OUTREACH TRACKING LINK CARD */}
            {effectiveLink && (
              <div className="dashboard-section-card" style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fdf8f6 100%)',
                border: '1.5px solid #ffedd5',
                boxShadow: '0 10px 25px -5px rgba(255, 77, 0, 0.08)'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #ff4d00 0%, #ea580c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      boxShadow: '0 4px 10px rgba(234, 88, 12, 0.3)'
                    }}>
                      <Share2 size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                        Your Citizen Outreach Tracking Link
                      </h3>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                        Redirects visitors to official Instagram while recording your staff attribution.
                      </p>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    Live Active Link
                  </span>
                </div>

                {/* Tracking URL Container */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '8px 14px',
                  marginBottom: '14px',
                  overflow: 'hidden',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: '220px', overflow: 'hidden' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Exclusive Tracking URL
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }}>
                      {getFullTrackingUrl()}
                    </div>
                  </div>

                  {/* 1-Tap Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        backgroundColor: copied ? '#ecfdf5' : '#f1f5f9',
                        color: copied ? '#059669' : '#334155',
                        border: copied ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleWhatsAppShare}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 18px',
                        borderRadius: '10px',
                        backgroundColor: '#25D366',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <MessageSquare size={14} />
                      <span>Share on WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Real-time Click Metrics Bar */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '10px',
                  backgroundColor: '#ffffff',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #fed7aa'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Verified Clicks Today</span>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#ea580c' }}>
                      {linkClicks.validClicks || 0}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Unique Visitors</span>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7' }}>
                      {linkClicks.uniqueIps || 0}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Link Hits</span>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#334155' }}>
                      {linkClicks.totalClicks || 0}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#059669',
                      backgroundColor: '#ecfdf5',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #d1fae5',
                      textAlign: 'center'
                    }}>
                      ✓ WhatsApp Preview Bots Filtered
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Submission Form */}
            <div className="dashboard-section-card">
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 14px 0' }}>
                New Submission Entry ({activeTask.submissionType || 'Input'})
              </h3>

              {feedback && (
                <div style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: feedback.type === 'success' ? '#ecfdf5' : (feedback.type === 'warning' ? '#fffbebf' : '#fef2f2'),
                  color: feedback.type === 'success' ? '#047857' : (feedback.type === 'warning' ? '#b45309' : '#b91c1c'),
                  border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : (feedback.type === 'warning' ? '#fde68a' : '#fca5a5')}`
                }}>
                  {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{feedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  placeholder={
                    activeTask.submissionType === 'Mobile Number' 
                      ? 'Enter 10-digit voter mobile number...' 
                      : `Enter ${activeTask.submissionType} or URL...`
                  }
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  style={{
                    flex: '1 1 200px',
                    minWidth: '180px',
                    padding: '12px 16px',
                    borderRadius: '9999px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 500,
                    outline: 'none',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a'
                  }}
                />

                <button
                  type="submit"
                  disabled={isSubmitting || !inputVal.trim()}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'linear-gradient(90deg, #ff4d00 0%, #ff1a40 100%)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(255, 77, 0, 0.35)',
                    whiteSpace: 'nowrap',
                    flex: '0 0 auto'
                  }}
                >
                  <Send size={15} />
                  <span>Submit Entry</span>
                </button>
              </form>
            </div>

            {/* Today's Submissions Log Table */}
            <div className="dashboard-section-card">
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 14px 0' }}>
                Today's Submission Log ({taskStats?.todaySubmissions?.length || 0})
              </h3>

              {taskStats?.todaySubmissions?.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                        <th style={{ padding: '10px', fontWeight: 700 }}>Entry Input</th>
                        <th style={{ padding: '10px', fontWeight: 700 }}>Time</th>
                        <th style={{ padding: '10px', fontWeight: 700 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskStats.todaySubmissions.map((sub) => (
                        <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 10px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                            {sub.username || sub.rawInput}
                          </td>
                          <td style={{ padding: '12px 10px', color: '#64748b' }}>
                            {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor: sub.status === 'Valid' ? '#ecfdf5' : (sub.status === 'Repeated' ? '#fffbebf' : '#fef2f2'),
                              color: sub.status === 'Valid' ? '#047857' : (sub.status === 'Repeated' ? '#b45309' : '#b91c1c'),
                              border: `1px solid ${sub.status === 'Valid' ? '#a7f3d0' : (sub.status === 'Repeated' ? '#fde68a' : '#fca5a5')}`
                            }}>
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>
                  No entries submitted yet today for this task. Use the box above to record your first entry.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <Award size={40} style={{ color: '#d1d5db', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#374151', margin: 0 }}>No Tasks Currently Assigned</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              Check back later or contact your administrator to assign campaign tasks to your constituency.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
