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
  Award
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

  useEffect(() => {
    loadData();
  }, [session]);

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
    const stats = dbService.getEmployeeDailyStats(empId, new Date().toISOString().split('T')[0], taskId);
    setTaskStats(stats);
  };

  const handleTaskSwitch = (task) => {
    setActiveTask(task);
    setInputVal('');
    setFeedback(null);
    const empId = employee?.id || session?.employeeId;
    updateStats(empId, task.id);
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
