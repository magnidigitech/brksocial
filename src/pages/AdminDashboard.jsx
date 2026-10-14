import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Sliders, ShieldAlert, FileSpreadsheet, LogOut, MousePointerClick } from 'lucide-react';
import { StaffDirectoryView } from '../components/StaffDirectoryView.jsx';
import { TaskManagementView } from '../components/TaskManagementView.jsx';
import { AdminMetricsDashboardView } from '../components/AdminMetricsDashboardView.jsx';
import { LinkAnalyticsView } from '../components/LinkAnalyticsView.jsx';

export function AdminDashboard({ session, onLogout, initialTab = 'dashboard' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'links', label: 'Link Analytics', icon: MousePointerClick },
    { id: 'rules', label: 'Tasks & Rules', icon: Sliders },
    { id: 'staff', label: 'Staff Directory', icon: Users },
    { id: 'audit', label: 'Audit Trail', icon: ShieldAlert },
    { id: 'reports', label: 'Export Reports', icon: FileSpreadsheet }
  ];

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
                  onClick={() => setActiveTab(tab.id)}
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

          {activeTab === 'reports' && (
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
                backgroundColor: 'rgba(52, 199, 89, 0.08)',
                border: '1px solid rgba(52, 199, 89, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34c759',
                marginBottom: '16px'
              }}>
                <FileSpreadsheet size={28} />
              </div>
              <span style={{
                padding: '3px 12px',
                borderRadius: '980px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                backgroundColor: 'rgba(52, 199, 89, 0.08)',
                color: '#34c759',
                border: '1px solid rgba(52, 199, 89, 0.15)',
                marginBottom: '12px',
                display: 'inline-block'
              }}>
                Export Reports
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.02em', margin: 0 }}>
                Data Exports & CSV Reports
              </h2>
              <p style={{ fontSize: '13px', color: '#86868b', fontWeight: 400, marginTop: '8px', maxWidth: '420px', lineHeight: 1.6 }}>
                Download comprehensive constituency breakdowns, daily staff outreach records, and click analytics feeds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




