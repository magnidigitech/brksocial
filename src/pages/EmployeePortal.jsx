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
  X
} from 'lucide-react';
import { dbService } from '../services/db.js';
import { normalizeInstagramUsername } from '../services/normalization.js';
import { formatIST, validateFollowerSubmission, getTodayISTDateString } from '../services/istUtils.js';

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

  useEffect(() => {
    loadData();
    // Auto-revalidate existing submissions against follower DB on mount
    dbService.revalidateSubmissionsWithFollowers().catch(() => {});
  }, [session]);

  const handleSyncFollowers = async () => {
    setIsSyncingFollowers(true);
    try {
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
      dbService.syncClicksWithServer().then(() => {
        handleLiveRefresh();
      }).catch(() => {});
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

                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        backgroundColor: '#f8fafc',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <QrCode size={14} style={{ color: '#ff4d00' }} />
                      <span>QR Code</span>
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
                        }).catch(() => {});
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
                  border: `1px solid ${
                    feedback.type === 'success' 
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
                    border: `1px solid ${
                      liveCheck.status === 'Valid Submission'
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
                          <strong>Verified New Follower:</strong> Followed on <strong style={{ fontFamily: 'monospace' }}>{liveCheck.follower?.followedAtFormatted}</strong> IST (Inside eligible 24h window • Will be counted as Valid Submission).
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
                          <strong>Pending Verification:</strong> '@{liveCheck.cleanHandle}' is not in current followers database yet. Submission will be saved as <strong>Pending Submission</strong> and verified upon next follower JSON sync.
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

            {/* Today's Submissions Log Table */}
            <div className="dashboard-section-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                  Today's Submission Log ({taskStats?.todaySubmissions?.length || 0})
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
                  <span>{isSyncingFollowers ? 'Syncing Follower DB...' : 'Sync Follower Status'}</span>
                </button>
              </div>

              {taskStats?.todaySubmissions?.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)', color: '#86868b' }}>
                        <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Entry Input</th>
                        <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Time (IST)</th>
                        <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Follower Verification (dd/mm/yyyy hh:mm)</th>
                        <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskStats.todaySubmissions.map((sub) => {
                        const isStatusValid = sub.status === 'Valid Submission' || sub.status === 'Valid';
                        const isStatusPending = sub.status === 'Pending Submission';
                        const isStatusAlready = sub.status === 'Already Followed' || sub.status === 'Duplicate' || sub.status === 'Repeated';
                        const isStatusInvalid = sub.status === 'Invalid Submission';

                        return (
                          <tr key={sub.id} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                            <td style={{ padding: '10px', fontWeight: 600, color: '#1d1d1f', fontFamily: 'monospace' }}>
                              {sub.username || sub.rawInput}
                            </td>
                            <td style={{ padding: '10px', color: '#64748b', fontSize: '12px' }}>
                              {formatIST(sub.submittedAt, { timeOnly: true }) || '08:21'}
                            </td>
                            <td style={{ padding: '10px' }}>
                              {isStatusValid ? (
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '980px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(52, 199, 89, 0.1)',
                                  color: '#15803d',
                                  border: '1px solid rgba(52, 199, 89, 0.25)'
                                }}>
                                  ✓ Followed: {sub.followedAtFormatted || 'Within 24h Window'}
                                </span>
                              ) : isStatusAlready ? (
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '980px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(255, 149, 0, 0.1)',
                                  color: '#c2410c',
                                  border: '1px solid rgba(255, 149, 0, 0.25)'
                                }}>
                                  {sub.verificationBadge || (sub.followedAtFormatted ? `✓ Existing Follower: ${sub.followedAtFormatted}` : 'Duplicate Submission')}
                                </span>
                              ) : isStatusInvalid ? (
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '980px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  color: '#dc2626',
                                  border: '1px solid rgba(239, 68, 68, 0.2)'
                                }}>
                                  Outside 24h Window: {sub.followedAtFormatted}
                                </span>
                              ) : (
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '980px',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  backgroundColor: 'rgba(118, 118, 128, 0.08)',
                                  color: '#64748b',
                                  border: '1px solid rgba(118, 118, 128, 0.15)'
                                }}>
                                  Pending Follow Sync
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '980px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: isStatusValid
                                  ? 'rgba(52, 199, 89, 0.12)'
                                  : (isStatusPending
                                    ? 'rgba(255, 149, 0, 0.12)'
                                    : (isStatusAlready
                                      ? 'rgba(239, 68, 68, 0.10)'
                                      : 'rgba(107, 114, 128, 0.10)')),
                                color: isStatusValid
                                  ? '#15803d'
                                  : (isStatusPending
                                    ? '#b45309'
                                    : (isStatusAlready
                                      ? '#b91c1c'
                                      : '#4b5563')),
                                border: `1px solid ${
                                  isStatusValid
                                    ? 'rgba(52, 199, 89, 0.3)'
                                    : (isStatusPending
                                      ? 'rgba(255, 149, 0, 0.3)'
                                      : (isStatusAlready
                                        ? 'rgba(239, 68, 68, 0.25)'
                                        : 'rgba(107, 114, 128, 0.25)'))
                                }`
                              }}>
                                {sub.status || 'Pending Submission'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: '12.5px', color: '#86868b', margin: 0, fontStyle: 'italic' }}>
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
    </div>
  );
}
