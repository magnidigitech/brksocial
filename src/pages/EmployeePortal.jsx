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
  Flame,
  RefreshCw,
  AlertCircle,
  XCircle,
  QrCode,
  Download,
  X,
  Menu,
  Info,
  Phone
} from 'lucide-react';
import { dbService } from '../services/db.js';
import { normalizeInstagramUsername } from '../services/normalization.js';
import { formatIST, validateFollowerSubmission, getTodayISTDateString, getISTDateFromISO } from '../services/istUtils.js';
import VerificationBottomSheet from '../components/VerificationBottomSheet.jsx';

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
  const [liveCheck, setLiveCheck] = useState(null);
  const [isLiveChecking, setIsLiveChecking] = useState(false);
  const [isSyncingFollowers, setIsSyncingFollowers] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [submissionTab, setSubmissionTab] = useState('today'); // 'today' | 'previous'
  const [selectedSubForInfo, setSelectedSubForInfo] = useState(null);

  useEffect(() => {
    loadData();
    // Auto-revalidate existing submissions against follower DB on mount
    dbService.revalidateSubmissionsWithFollowers().catch(() => { });
  }, [session]);

  const handleSyncFollowers = async () => {
    setIsSyncingFollowers(true);
    try {
      await dbService.syncSubmissionsWithServer();
      const res = await dbService.revalidateSubmissionsWithFollowers();
      const empId = employee?.id || session?.employeeId || session?.id || 'APP13';
      const taskId = activeTask?.id || 'TASK-INSTA-001';
      const today = getTodayISTDateString();
      const stats = dbService.getEmployeeDailyStats(empId, today, taskId);
      setTaskStats(stats);
      setFeedback({
        type: 'success',
        message: `Follower synchronization complete! ${res.updatedCount > 0 ? `Updated ${res.updatedCount} submission statuses.` : 'All submissions are currently up to date.'}`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.warn('Sync followers error:', err);
    } finally {
      setIsSyncingFollowers(false);
    }
  };

  // Real-time live update for clicks and submissions across devices
  useEffect(() => {
    const handleLiveRefresh = () => {
      const empId = employee?.id || session?.employeeId || session?.id || 'APP13';
      const taskId = activeTask?.id || 'TASK-INSTA-001';
      const today = getTodayISTDateString();
      const stats = dbService.getEmployeeDailyStats(empId, today, taskId);
      setTaskStats(stats);
      const link = dbService.getTrackingLinkForEmployee(taskId, empId);
      setTrackingLink(link);
      const clicks = dbService.getEmployeeTaskClicks(empId, taskId, today);
      setLinkClicks(clicks || { totalClicks: 0, validClicks: 0, uniqueIps: 0 });
    };

    const triggerSync = () => {
      Promise.allSettled([
        dbService.syncClicksWithServer(),
        dbService.syncSubmissionsWithServer()
      ]).then(() => {
        handleLiveRefresh();
      }).catch(() => { });
    };

    // Immediate sync on load
    triggerSync();

    window.addEventListener('brk_link_click_event', handleLiveRefresh);
    window.addEventListener('storage', handleLiveRefresh);
    window.addEventListener('brk_submission_event', handleLiveRefresh);
    window.addEventListener('focus', triggerSync);
    document.addEventListener('visibilitychange', triggerSync);

    const interval = setInterval(triggerSync, 2000);

    return () => {
      window.removeEventListener('brk_link_click_event', handleLiveRefresh);
      window.removeEventListener('storage', handleLiveRefresh);
      window.removeEventListener('brk_submission_event', handleLiveRefresh);
      window.removeEventListener('focus', triggerSync);
      document.removeEventListener('visibilitychange', triggerSync);
      clearInterval(interval);
    };
  }, [employee, session, activeTask]);

  // Live debounced follower database & duplicate cross-check as employee types
  useEffect(() => {
    const raw = inputVal.trim();
    if (!raw || !activeTask) {
      setLiveCheck(null);
      setIsLiveChecking(false);
      return;
    }

    if (activeTask.platform === 'Instagram' || activeTask.submissionType?.includes('Handle')) {
      const normRes = normalizeInstagramUsername(raw);
      if (!normRes.isValid) {
        setLiveCheck({ status: 'invalid', message: normRes.error || 'Invalid handle format' });
        setIsLiveChecking(false);
        return;
      }

      const cleanHandle = normRes.normalized;
      setIsLiveChecking(true);

      const allSubs = dbService.getSubmissions();
      const existingSub = allSubs.find(s =>
        s.taskId === activeTask.id &&
        String(s.username || '').toLowerCase() === cleanHandle
      );

      const timer = setTimeout(async () => {
        try {
          const followerRes = await dbService.checkInstagramFollower(cleanHandle);
          const val = validateFollowerSubmission({
            normalizedUsername: cleanHandle,
            submittedAtIso: new Date().toISOString(),
            followerRecord: followerRes?.exists ? followerRes : null,
            existingSubmissions: allSubs.filter(s => s.taskId === activeTask.id)
          });

          setLiveCheck({
            cleanHandle,
            status: val.status,
            isValid: val.isValid,
            isDuplicate: !!val.isDuplicate,
            existingSub: existingSub || null,
            isFollower: !!val.isFollower,
            follower: followerRes?.follower || null,
            message: val.message,
            verificationBadge: val.verificationBadge
          });
        } catch (err) {
          setLiveCheck({
            cleanHandle,
            status: 'Pending Submission',
            isValid: false,
            isDuplicate: !!existingSub,
            existingSub: existingSub || null,
            isFollower: false,
            message: 'Awaiting follower verification on daily JSON sync.'
          });
        } finally {
          setIsLiveChecking(false);
        }
      }, 250);

      return () => clearTimeout(timer);
    } else {
      setLiveCheck(null);
      setIsLiveChecking(false);
    }
  }, [inputVal, activeTask]);

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
    const today = getTodayISTDateString();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || !activeTask) return;

    setIsSubmitting(true);
    setFeedback(null);

    const empId = employee?.id || session?.employeeId;

    // Standardize input
    let normalized = inputVal.trim();
    let followerCheckResult = null;

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

      // Cross-check existing Instagram followers database!
      try {
        followerCheckResult = await dbService.checkInstagramFollower(normalized);
      } catch (err) {
        console.warn('Follower check error:', err);
      }
    } else {
      normalized = normalized.toLowerCase();
    }

    // Process submission via DB Service with followerVerification
    const res = dbService.processSubmission({
      employeeId: empId,
      taskId: activeTask.id,
      normalizedUsername: normalized,
      rawInput: inputVal.trim(),
      followerVerification: followerCheckResult
    });

    if (res.status === 'Valid Submission') {
      setFeedback({
        type: 'success',
        status: res.status,
        message: res.message
      });
      setInputVal('');
      setLiveCheck(null);
    } else if (res.status === 'Pending Submission') {
      setFeedback({
        type: 'pending',
        status: res.status,
        message: res.message
      });
      setInputVal('');
      setLiveCheck(null);
    } else if (res.status === 'Already Followed') {
      setFeedback({
        type: 'warning',
        status: res.status,
        message: res.message
      });
      setInputVal('');
      setLiveCheck(null);
    } else {
      setFeedback({
        type: 'error',
        status: res.status,
        message: res.message
      });
    }

    updateStats(empId, activeTask.id);
    dbService.syncSubmissionsWithServer().then(() => {
      updateStats(empId, activeTask.id);
    }).catch(() => { });
    setIsSubmitting(false);
  };

  const todayStr = getTodayISTDateString();
  const allLocalSubs = dbService.getSubmissions();
  const currentEmpId = employee?.id || session?.employeeId || session?.id || '';
  const previousSubmissions = allLocalSubs.filter(s =>
    s && s.employeeId &&
    s.employeeId.toUpperCase() === currentEmpId.toUpperCase() &&
    (!activeTask || s.taskId === activeTask.id) &&
    s.date !== todayStr &&
    getISTDateFromISO(s.submittedAt) !== todayStr
  );

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
        {/* Compact Top Header Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          marginBottom: '18px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
        }}>
          {/* Staff Badge & Name Only */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '38px',
              height: '38px',
              minWidth: '38px',
              minHeight: '38px',
              borderRadius: '50%',
              backgroundColor: '#fff7ed',
              border: '1.5px solid #ffedd5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ea580c',
              flexShrink: 0
            }}>
              <UserCheck size={18} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Field Outreach Staff
              </div>
              <h1 style={{
                fontSize: '16px',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {employee?.name || session?.name || 'Field Staff'}
              </h1>
            </div>
          </div>

          {/* Hamburger Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            aria-label="Open staff details menu"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#334155',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.15s ease'
            }}
          >
            <Menu size={20} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. Task Overview Box with Daily Completion Progress */}
            <div className="dashboard-section-card" style={{ backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Perfectly Round Platform Icon */}
                  <div style={{
                    width: '42px',
                    height: '42px',
                    minWidth: '42px',
                    minHeight: '42px',
                    borderRadius: '50%',
                    aspectRatio: '1 / 1',
                    backgroundColor: '#ff4d00',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 10px rgba(255, 77, 0, 0.25)'
                  }}>
                    <PlatformIcon size={22} />
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

            {/* 2. SUBMISSION ENTRY FORM (MOVED HERE DIRECTLY BELOW DAILY PROGRESS) */}
            <div className="dashboard-section-card">
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 14px 0' }}>
                New Submission Entry ({activeTask.submissionType || 'Input'})
              </h3>

              {feedback && (
                <div style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: feedback.type === 'success'
                    ? '#ecfdf5'
                    : (feedback.type === 'pending'
                      ? 'rgba(0, 113, 227, 0.08)'
                      : (feedback.type === 'warning' ? '#fffbeb' : '#fef2f2')),
                  color: feedback.type === 'success'
                    ? '#047857'
                    : (feedback.type === 'pending'
                      ? '#0071e3'
                      : (feedback.type === 'warning' ? '#b45309' : '#b91c1c')),
                  border: `1px solid ${feedback.type === 'success'
                    ? '#a7f3d0'
                    : (feedback.type === 'pending'
                      ? 'rgba(0, 113, 227, 0.25)'
                      : (feedback.type === 'warning' ? '#fde68a' : '#fca5a5'))
                    }`
                }}>
                  {feedback.type === 'success' ? (
                    <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                  ) : feedback.type === 'pending' ? (
                    <Clock size={16} style={{ color: '#0071e3', flexShrink: 0 }} />
                  ) : feedback.type === 'warning' ? (
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  ) : (
                    <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    required
                    disabled={isSubmitting}
                    placeholder={
                      activeTask.submissionType === 'Mobile Number'
                        ? 'Enter 10-digit voter mobile number...'
                        : `Enter ${activeTask.submissionType} or URL (e.g. lakshmisettylavanya)...`
                    }
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    style={{
                      flex: '1 1 200px',
                      minWidth: '180px',
                      padding: '10px 16px',
                      borderRadius: '980px',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      outline: 'none',
                      backgroundColor: 'rgba(118, 118, 128, 0.06)',
                      color: '#1d1d1f'
                    }}
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting || !inputVal.trim()}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '980px',
                      border: 'none',
                      backgroundColor: '#0071e3',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(0, 113, 227, 0.3)',
                      whiteSpace: 'nowrap',
                      flex: '0 0 auto',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Send size={14} />
                    <span>{isSubmitting ? 'Verifying...' : 'Submit Entry'}</span>
                  </button>
                </div>

                {/* Live Real-Time Follower & Duplicate Preview Badge */}
                {liveCheck && !feedback && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    backgroundColor: liveCheck.status === 'Valid Submission'
                      ? 'rgba(52, 199, 89, 0.08)'
                      : (liveCheck.status === 'Already Followed'
                        ? 'rgba(255, 149, 0, 0.10)'
                        : (liveCheck.status === 'Pending Submission'
                          ? 'rgba(0, 113, 227, 0.06)'
                          : 'rgba(255, 59, 48, 0.08)')),
                    border: `1px solid ${liveCheck.status === 'Valid Submission'
                      ? 'rgba(52, 199, 89, 0.25)'
                      : (liveCheck.status === 'Already Followed'
                        ? 'rgba(255, 149, 0, 0.3)'
                        : (liveCheck.status === 'Pending Submission'
                          ? 'rgba(0, 113, 227, 0.2)'
                          : 'rgba(255, 59, 48, 0.25)'))
                      }`,
                    color: liveCheck.status === 'Valid Submission'
                      ? '#1b5e20'
                      : (liveCheck.status === 'Already Followed'
                        ? '#c2410c'
                        : (liveCheck.status === 'Pending Submission'
                          ? '#0071e3'
                          : '#b91c1c'))
                  }}>
                    {liveCheck.status === 'Valid Submission' ? (
                      <>
                        <CheckCircle2 size={16} style={{ color: '#34c759', flexShrink: 0 }} />
                        <span>
                          <strong>Verified New Follower:</strong> Followed on <strong style={{ fontFamily: 'monospace' }}>{liveCheck.follower?.followedAtFormatted}</strong> IST.
                        </span>
                      </>
                    ) : liveCheck.status === 'Already Followed' ? (
                      <>
                        <AlertTriangle size={16} style={{ color: '#ea580c', flexShrink: 0 }} />
                        <span>
                          <strong>Already Followed:</strong> {liveCheck.message}
                        </span>
                      </>
                    ) : liveCheck.status === 'Pending Submission' ? (
                      <>
                        <Clock size={16} style={{ color: '#0071e3', flexShrink: 0 }} />
                        <span>
                          <strong>Pending Verification:</strong> '@{liveCheck.cleanHandle}' will be saved as <strong>Pending Submission</strong>.
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                        <span>
                          <strong>{liveCheck.status}:</strong> {liveCheck.message}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </form>
            </div>

            {/* 3. YOUR UNIQUE OUTREACH TRACKING LINK CARD */}
            {effectiveLink && (
              <div className="dashboard-section-card" style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #fdf8f6 100%)',
                border: '1.5px solid #ffedd5',
                boxShadow: '0 10px 25px -5px rgba(255, 77, 0, 0.08)'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Perfectly Round Share Icon */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      minWidth: '42px',
                      minHeight: '42px',
                      borderRadius: '50%',
                      aspectRatio: '1 / 1',
                      background: 'linear-gradient(135deg, #ff4d00 0%, #ea580c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0,
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

                {/* Tracking URL Box with Multiline Full Link Wrap */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  marginBottom: '14px'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                    Exclusive Tracking URL
                  </div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#0f172a',
                    wordBreak: 'break-all',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'normal',
                    lineHeight: 1.45,
                    padding: '8px 10px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    {getFullTrackingUrl()}
                  </div>

                  {/* 1-Line Actions: WhatsApp (1st), Copy (2nd), QR Code (3rd) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '10px',
                    width: '100%'
                  }}>
                    {/* 1. Share on WhatsApp (FIRST) */}
                    <button
                      type="button"
                      onClick={handleWhatsAppShare}
                      title="Share on WhatsApp"
                      style={{
                        flex: 1,
                        height: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        backgroundColor: '#25D366',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <MessageSquare size={16} />
                      <span>WhatsApp</span>
                    </button>

                    {/* 2. Copy Link (SECOND) */}
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      title="Copy Link"
                      style={{
                        flex: 1,
                        height: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        backgroundColor: copied ? '#ecfdf5' : '#f1f5f9',
                        color: copied ? '#059669' : '#334155',
                        border: copied ? '1.5px solid #a7f3d0' : '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>

                    {/* 3. QR Code (THIRD) */}
                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      title="View QR Code"
                      style={{
                        width: '42px',
                        height: '42px',
                        minWidth: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '10px',
                        backgroundColor: '#fff7ed',
                        color: '#ea580c',
                        border: '1px solid #ffedd5',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <QrCode size={18} />
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

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        dbService.syncClicksWithServer().then(() => {
                          const empId = employee?.id || session?.employeeId || session?.id || 'APP13';
                          const taskId = activeTask?.id || 'TASK-INSTA-001';
                          const today = getTodayISTDateString();
                          const clicks = dbService.getEmployeeTaskClicks(empId, taskId, today);
                          setLinkClicks(clicks || { totalClicks: 0, validClicks: 0, uniqueIps: 0 });
                        }).catch(() => { });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#0284c7',
                        backgroundColor: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <RefreshCw size={12} />
                      Sync Clicks
                    </button>
                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: 600,
                      color: '#059669',
                      textAlign: 'center'
                    }}>
                      ✓ WhatsApp Bots Filtered
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SUBMISSIONS LOG (WITH TABS FOR TODAY & PREVIOUS SUBMISSIONS) */}
            <div className="dashboard-section-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                  Submissions History
                </h3>

                <button
                  type="button"
                  onClick={handleSyncFollowers}
                  disabled={isSyncingFollowers}
                  title="Cross-check all submissions with official Instagram followers JSON"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: '9999px',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    cursor: isSyncingFollowers ? 'wait' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <RefreshCw size={12} style={{ animation: isSyncingFollowers ? 'fastSpin 0.7s linear infinite' : 'none' }} />
                  <span>{isSyncingFollowers ? 'Syncing...' : 'Sync Follower Status'}</span>
                </button>
              </div>

              {/* Submissions Navigation Tabs */}
              <div style={{
                display: 'flex',
                gap: '6px',
                backgroundColor: '#f1f5f9',
                padding: '4px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '14px'
              }}>
                <button
                  type="button"
                  onClick={() => setSubmissionTab('today')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '9px',
                    fontSize: '12px',
                    fontWeight: submissionTab === 'today' ? 700 : 500,
                    backgroundColor: submissionTab === 'today' ? '#ffffff' : 'transparent',
                    color: submissionTab === 'today' ? '#0f172a' : '#64748b',
                    border: 'none',
                    boxShadow: submissionTab === 'today' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Today ({taskStats?.todaySubmissions?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionTab('previous')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '9px',
                    fontSize: '12px',
                    fontWeight: submissionTab === 'previous' ? 700 : 500,
                    backgroundColor: submissionTab === 'previous' ? '#ffffff' : 'transparent',
                    color: submissionTab === 'previous' ? '#0f172a' : '#64748b',
                    border: 'none',
                    boxShadow: submissionTab === 'previous' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Previous ({previousSubmissions.length})
                </button>
              </div>

              {/* TAB 1: TODAY'S SUBMISSIONS */}
              {submissionTab === 'today' && (
                <div>
                  {taskStats?.todaySubmissions?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {taskStats.todaySubmissions.map((sub, idx) => {
                        const isStatusValid = sub.status === 'Valid Submission' || sub.status === 'Valid';
                        const isStatusPending = sub.status === 'Pending Submission';
                        const isStatusDuplicateOrInvalid = sub.isDuplicate || sub.status === 'Already Followed' || sub.status === 'Duplicate' || sub.status === 'Invalid Submission';

                        return (
                          <div
                            key={sub.id || idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                              gap: '10px'
                            }}
                          >
                            {/* Single Line: Entry / Name */}
                            <div style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '13.5px',
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              minWidth: 0,
                              flex: 1
                            }}>
                              @{String(sub.username || sub.rawInput || '').replace(/^@+/, '')}
                            </div>

                            {/* Color-Coded Status Badge (Valid: Green+White, Invalid/Dup: Red+White, Pending: Orange+White) + Info Icon */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: isStatusValid ? '#16a34a' : (isStatusPending ? '#ea580c' : '#dc2626'),
                                color: '#ffffff',
                                whiteSpace: 'nowrap',
                                boxShadow: isStatusValid
                                  ? '0 1px 4px rgba(22, 163, 74, 0.25)'
                                  : (isStatusPending ? '0 1px 4px rgba(234, 88, 12, 0.25)' : '0 1px 4px rgba(220, 38, 38, 0.25)')
                              }}>
                                {isStatusValid ? 'Valid' : (isStatusPending ? 'Pending' : (sub.isDuplicate || sub.status === 'Already Followed' ? 'Duplicate' : 'Invalid'))}
                              </span>

                              {/* Tooltip / Info Popover Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedSubForInfo(sub)}
                                title="Click to view follower verification status & time details"
                                aria-label="View details"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  backgroundColor: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#475569',
                                  cursor: 'pointer',
                                  padding: 0,
                                  flexShrink: 0,
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <Info size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                      <p style={{ fontSize: '13px', margin: 0, fontWeight: 500 }}>
                        No entries submitted yet today for this task.
                      </p>
                      <p style={{ fontSize: '11.5px', marginTop: '4px', color: '#94a3b8' }}>
                        Use the submission entry box above to record your first entry.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PREVIOUS SUBMISSIONS (ALL TIME EXCLUDING TODAY) */}
              {submissionTab === 'previous' && (
                <div>
                  {previousSubmissions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {previousSubmissions.map((sub, idx) => {
                        const isStatusValid = sub.status === 'Valid Submission' || sub.status === 'Valid';
                        const isStatusPending = sub.status === 'Pending Submission';

                        return (
                          <div
                            key={sub.id || idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                              gap: '10px'
                            }}
                          >
                            {/* Single Line: Entry + Date */}
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '13.5px',
                                color: '#0f172a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                @{String(sub.username || sub.rawInput || '').replace(/^@+/, '')}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                {sub.date || formatIST(sub.submittedAt, { dateOnly: true })} • {formatIST(sub.submittedAt, { timeOnly: true })} IST
                              </span>
                            </div>

                            {/* Color-Coded Status Badge + Info Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: isStatusValid ? '#16a34a' : (isStatusPending ? '#ea580c' : '#dc2626'),
                                color: '#ffffff',
                                whiteSpace: 'nowrap',
                                boxShadow: isStatusValid
                                  ? '0 1px 4px rgba(22, 163, 74, 0.25)'
                                  : (isStatusPending ? '0 1px 4px rgba(234, 88, 12, 0.25)' : '0 1px 4px rgba(220, 38, 38, 0.25)')
                              }}>
                                {isStatusValid ? 'Valid' : (isStatusPending ? 'Pending' : (sub.isDuplicate || sub.status === 'Already Followed' ? 'Duplicate' : 'Invalid'))}
                              </span>

                              <button
                                type="button"
                                onClick={() => setSelectedSubForInfo(sub)}
                                title="Click to view follower verification status & time details"
                                aria-label="View details"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  backgroundColor: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#475569',
                                  cursor: 'pointer',
                                  padding: 0,
                                  flexShrink: 0,
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <Info size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                      <p style={{ fontSize: '13px', margin: 0, fontWeight: 500 }}>
                        No previous submissions recorded prior to today.
                      </p>
                      <p style={{ fontSize: '11.5px', marginTop: '4px', color: '#94a3b8' }}>
                        All previous completed submissions will appear in this history tab.
                      </p>
                    </div>
                  )}
                </div>
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

      {/* Citizen Scan & Follow QR Code Modal */}
      {showQrModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setShowQrModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              maxWidth: '380px',
              width: '100%',
              padding: '28px 24px',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              position: 'relative'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowQrModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: 'rgba(255, 77, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ff4d00',
              margin: '0 auto 12px auto'
            }}>
              <QrCode size={24} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Citizen Outreach QR Code
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 18px 0' }}>
              Scan with any smartphone camera to follow Sri Bhashyam Ramakrishna on Instagram.
            </p>

            {/* QR Code Container */}
            <div style={{
              padding: '16px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              border: '2px solid #ffedd5',
              boxShadow: '0 4px 15px rgba(255, 77, 0, 0.08)',
              display: 'inline-block',
              marginBottom: '16px'
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(getFullTrackingUrl())}`}
                alt="Outreach Tracking QR Code"
                style={{ width: '220px', height: '220px', display: 'block', borderRadius: '8px' }}
              />
            </div>

            {/* Staff Attribution Badge */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '18px',
              fontSize: '11.5px',
              color: '#475569',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em' }}>
                Attributed Field Staff
              </div>
              <strong style={{ color: '#0f172a', fontSize: '13px' }}>{employee?.name || session?.name}</strong>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                {employee?.parliamentName} {employee?.assemblyName ? `• ${employee?.assemblyName}` : ''} ({employee?.supportCode || employee?.id})
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=15&data=${encodeURIComponent(getFullTrackingUrl())}`}
                target="_blank"
                rel="noreferrer"
                download={`BRK_QR_${employee?.supportCode || employee?.id || 'outreach'}.png`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  borderRadius: '9999px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                <span>Save High-Res Image</span>
              </a>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hamburger Drawer Menu */}
      {showMenu && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setShowMenu(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '340px',
              height: '100%',
              backgroundColor: '#ffffff',
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px 20px',
              overflowY: 'auto'
            }}
          >
            <div>
              {/* Drawer Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={20} style={{ color: '#ff4d00' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Staff Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMenu(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Staff Profile Card inside Drawer */}
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                  {employee?.name || session?.name}
                </h2>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    backgroundColor: '#ffffff',
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px', color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={15} style={{ color: '#ff4d00', flexShrink: 0 }} />
                    <span><strong>Parliament:</strong> {employee?.parliamentName || 'All'}</span>
                  </div>
                  {employee?.assemblyName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={15} style={{ color: '#0284c7', flexShrink: 0 }} />
                      <span><strong>Segment:</strong> {employee?.assemblyName}</span>
                    </div>
                  )}
                  {(employee?.mobilePersonal || session?.mobilePersonal) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={15} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <span><strong>Mobile:</strong> {employee?.mobilePersonal || session?.mobilePersonal}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sign Out at bottom of menu */}
            <button
              type="button"
              onClick={() => {
                setShowMenu(false);
                onLogout();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 18px',
                borderRadius: '12px',
                backgroundColor: '#fff1f2',
                color: '#e11d48',
                border: '1.5px solid #fecdd3',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: '20px',
                boxShadow: '0 2px 8px rgba(225, 29, 72, 0.12)'
              }}
            >
              <LogOut size={17} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Follower Verification Status & Detail Bottom Sheet (shadcn style + swipe down to dismiss) */}
      {selectedSubForInfo && (
        <VerificationBottomSheet
          submission={selectedSubForInfo}
          onClose={() => setSelectedSubForInfo(null)}
        />
      )}
    </div>
  );
}
