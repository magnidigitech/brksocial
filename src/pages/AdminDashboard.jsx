import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Sliders, ShieldAlert, FileSpreadsheet, LogOut, MousePointerClick, Instagram, Download } from 'lucide-react';
import { StaffDirectoryView } from '../components/StaffDirectoryView.jsx';
import { TaskManagementView } from '../components/TaskManagementView.jsx';
import { AdminMetricsDashboardView } from '../components/AdminMetricsDashboardView.jsx';
import { LinkAnalyticsView } from '../components/LinkAnalyticsView.jsx';
import { InstagramFollowersView } from '../components/InstagramFollowersView.jsx';
import { dbService } from '../services/db.js';
import { exportSubmissionsReport, exportDailyEmployeeReport, exportDuplicateAuditReport } from '../services/exporter.js';
import { getTodayISTDateString } from '../services/istUtils.js';

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'links', label: 'Link Analytics', icon: MousePointerClick },
  { id: 'followers', label: 'Followers DB', icon: Instagram },
  { id: 'rules', label: 'Tasks & Rules', icon: Sliders },
  { id: 'staff', label: 'Staff Directory', icon: Users },
  { id: 'audit', label: 'Audit Trail', icon: ShieldAlert },
  { id: 'reports', label: 'Export Reports', icon: FileSpreadsheet }
];

const VALID_TAB_IDS = ADMIN_TABS.map(t => t.id);

export function AdminDashboard({ session, onLogout, initialTab = 'dashboard' }) {
  const getResolvedTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get('tab');
      if (queryTab && VALID_TAB_IDS.includes(queryTab)) return queryTab;

      const path = window.location.pathname;
      if (path === '/admin/link-analytics' || path === '/admin/links') return 'links';
      if (path === '/admin/followers' || path === '/admin/instagram') return 'followers';
      if (path === '/admin/staff' || path === '/admin/employees') return 'staff';
      if (path === '/admin/rules' || path === '/admin/tasks') return 'rules';
      if (path === '/admin/audit') return 'audit';
      if (path === '/admin/reports') return 'reports';

      const savedTab = localStorage.getItem('brk_active_admin_tab');
      if (savedTab && VALID_TAB_IDS.includes(savedTab)) return savedTab;
    }
    return initialTab && VALID_TAB_IDS.includes(initialTab) ? initialTab : 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getResolvedTab);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    try {
      localStorage.setItem('brk_active_admin_tab', tabId);
      const url = new URL(window.location.href);
      if (tabId === 'dashboard') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tabId);
      }
      if (tabId !== 'followers') {
        url.searchParams.delete('subtab');
      }
      window.history.replaceState({ tab: tabId }, '', url.toString());
    } catch (e) {}
  };

  // Sync tab change to URL and localStorage
  useEffect(() => {
    try {
      localStorage.setItem('brk_active_admin_tab', activeTab);
      const url = new URL(window.location.href);
      if (activeTab === 'dashboard') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', activeTab);
      }
      if (activeTab !== 'followers') {
        url.searchParams.delete('subtab');
      }
      window.history.replaceState({ tab: activeTab }, '', url.toString());
    } catch (e) {}
  }, [activeTab]);

  // Handle browser back and forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const resolved = getResolvedTab();
      setActiveTab(resolved);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const tabs = ADMIN_TABS;

  return (
    <div className="dashboard-page-wrapper">
      {/* Main Container Frame */}
      <div className="dashboard-main-frame">
        {/* Apple-Style Executive Header Bar */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          marginBottom: '20px'
        }}>
          {/* Top Row: Brand & Profile/Logout */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {/* Brand Logo & Portal Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '980px',
                backgroundColor: '#ffffff',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
              }}>
                <img src="/images/KutamiLOGO.jpg" alt="Kutami Logo" style={{ height: '24px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }} />
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#1d1d1f', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                  BRK <span style={{ color: '#0071e3' }}>Social</span>
                </span>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '980px',
                backgroundColor: 'rgba(0, 113, 227, 0.08)',
                color: '#0071e3',
                border: '1px solid rgba(0, 113, 227, 0.15)',
                whiteSpace: 'nowrap'
              }}>
                Executive Portal
              </span>
            </div>

            {/* User Session & Sign Out */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '980px',
                backgroundColor: '#ffffff',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                fontSize: '11px',
                fontWeight: 500,
                color: '#1d1d1f'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34c759', display: 'inline-block' }} />
                <span style={{ fontWeight: 600, color: '#1d1d1f' }}>
                  {session?.name || session?.username || 'Admin'}
                </span>
              </div>

              <button
                onClick={onLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 14px',
                  borderRadius: '980px',
                  backgroundColor: 'rgba(255, 59, 48, 0.08)',
                  color: '#ff3b30',
                  border: '1px solid rgba(255, 59, 48, 0.15)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <LogOut size={12} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Apple macOS-Style Segmented Navigation Bar */}
          <div 
            className="no-scrollbar"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              overflowX: 'auto',
              padding: '3px',
              borderRadius: '12px',
              backgroundColor: 'rgba(118, 118, 128, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.04)',
              WebkitOverflowScrolling: 'touch',
              maxWidth: '100%'
            }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '9px',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                    border: 'none',
                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#1d1d1f' : '#86868b',
                    boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.08)' : 'none',
                    flexShrink: 0
                  }}
                >
                  <Icon size={13} style={{ color: isActive ? '#0071e3' : '#86868b' }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Display Card */}
        <div style={{ marginTop: '12px' }}>
          {activeTab === 'dashboard' && (
            <AdminMetricsDashboardView />
          )}

          {activeTab === 'links' && (
            <LinkAnalyticsView />
          )}

          {activeTab === 'followers' && (
            <InstagramFollowersView />
          )}

          {activeTab === 'staff' && (
            <StaffDirectoryView />
          )}

          {activeTab === 'rules' && (
            <TaskManagementView />
          )}

          {activeTab === 'audit' && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              padding: '64px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '380px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: 'rgba(255, 59, 48, 0.08)',
                border: '1px solid rgba(255, 59, 48, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff3b30',
                marginBottom: '16px'
              }}>
                <ShieldAlert size={28} />
              </div>
              <span style={{
                padding: '3px 12px',
                borderRadius: '980px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                backgroundColor: 'rgba(255, 59, 48, 0.08)',
                color: '#ff3b30',
                border: '1px solid rgba(255, 59, 48, 0.15)',
                marginBottom: '12px',
                display: 'inline-block'
              }}>
                Audit Trail
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.02em', margin: 0 }}>
                System Integrity & Flagged Logs
              </h2>
              <p style={{ fontSize: '13px', color: '#86868b', fontWeight: 400, marginTop: '8px', maxWidth: '420px', lineHeight: 1.6 }}>
                Secure verification space for inspecting cross-employee duplicate handle submissions and anomaly detection.
              </p>
            </div>
          )}

          {activeTab === 'audit' && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              padding: '32px 24px',
              minHeight: '380px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 59, 48, 0.08)',
                    border: '1px solid rgba(255, 59, 48, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ff3b30'
                  }}>
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1d1d1f', margin: 0 }}>
                      Audit Trail & Duplicate Attempt Logs
                    </h2>
                    <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0' }}>
                      Records of duplicate handle submissions or existing follower attempts flagged by system rules.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const logs = dbService.getAuditLogs();
                    exportDuplicateAuditReport(logs);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '980px',
                    backgroundColor: '#1d1d1f',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={13} />
                  <span>Export Audit CSV</span>
                </button>
              </div>

              {dbService.getAuditLogs().length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px', color: '#86868b' }}>
                  <p style={{ fontSize: '14px', margin: 0 }}>No flagged anomalies or duplicate attempts recorded yet.</p>
                  <p style={{ fontSize: '12px', marginTop: '4px', color: '#a1a1a6' }}>All submissions are currently clean and passing integrity checks.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', textAlign: 'left', color: '#86868b' }}>
                        <th style={{ padding: '10px 12px' }}>Time (IST)</th>
                        <th style={{ padding: '10px 12px' }}>Handle</th>
                        <th style={{ padding: '10px 12px' }}>Staff Attempt</th>
                        <th style={{ padding: '10px 12px' }}>Reason / Badge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbService.getAuditLogs().map((log, idx) => (
                        <tr key={log.id || idx} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleTimeString('en-IN')}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1d1d1f' }}>@{log.username}</td>
                          <td style={{ padding: '10px 12px' }}>{log.attemptedEmployeeName || log.attemptedEmployeeId}</td>
                          <td style={{ padding: '10px 12px', color: '#ff3b30' }}>{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              padding: '36px 24px',
              minHeight: '380px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(52, 199, 89, 0.08)',
                  border: '1px solid rgba(52, 199, 89, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34c759'
                }}>
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', margin: 0 }}>
                    Data Exports & CSV Reports
                  </h2>
                  <p style={{ fontSize: '13px', color: '#86868b', margin: '4px 0 0 0' }}>
                    Download verified staff outreach submissions, daily target completions, and audit logs.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Card 1: All Submissions */}
                <div style={{
                  padding: '20px',
                  borderRadius: '16px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: '#fbfbfd',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 6px 0' }}>
                      All Submissions Master Report
                    </h3>
                    <p style={{ fontSize: '12px', color: '#86868b', margin: 0, lineHeight: 1.5 }}>
                      Complete raw database export of all outreach entries across all 25 Parliaments and 175 Assemblies.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const all = dbService.getSubmissions();
                      exportSubmissionsReport(all, 'ALL');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: '980px',
                      backgroundColor: '#0071e3',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={14} />
                    <span>Download All Submissions CSV</span>
                  </button>
                </div>

                {/* Card 2: Today's Submissions */}
                <div style={{
                  padding: '20px',
                  borderRadius: '16px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: '#fbfbfd',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 6px 0' }}>
                      Today's Submissions Report
                    </h3>
                    <p style={{ fontSize: '12px', color: '#86868b', margin: 0, lineHeight: 1.5 }}>
                      Export all submissions recorded for today ({getTodayISTDateString()}) with live verification statuses.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const today = getTodayISTDateString();
                      const subs = dbService.getSubmissions(today);
                      exportSubmissionsReport(subs, today);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: '980px',
                      backgroundColor: '#34c759',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={14} />
                    <span>Download Today's CSV ({getTodayISTDateString()})</span>
                  </button>
                </div>

                {/* Card 3: Staff Daily Constituency Progress */}
                <div style={{
                  padding: '20px',
                  borderRadius: '16px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: '#fbfbfd',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 6px 0' }}>
                      Staff Constituency Progress Summary
                    </h3>
                    <p style={{ fontSize: '12px', color: '#86868b', margin: 0, lineHeight: 1.5 }}>
                      200-employee rollup matrix showing target completion, valid counts, and remaining numbers.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const today = getTodayISTDateString();
                      const overview = dbService.getAdminDashboardOverview(today);
                      exportDailyEmployeeReport(overview.employeeProgressList || [], today);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: '980px',
                      backgroundColor: '#1d1d1f',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={14} />
                    <span>Download Staff Rollup CSV</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




