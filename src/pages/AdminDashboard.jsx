import React, { useState } from 'react';
import { LayoutDashboard, Users, Sliders, ShieldAlert, FileSpreadsheet, LogOut } from 'lucide-react';
import { StaffDirectoryView } from '../components/StaffDirectoryView.jsx';
import { TaskManagementView } from '../components/TaskManagementView.jsx';
import { AdminMetricsDashboardView } from '../components/AdminMetricsDashboardView.jsx';

export function AdminDashboard({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // Default to 'dashboard' tab

  const tabs = [
    { id: 'rules', label: 'Tasks & Rules', icon: Sliders },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'staff', label: 'Staff Directory', icon: Users },
    { id: 'audit', label: 'Audit Trail', icon: ShieldAlert },
    { id: 'reports', label: 'Export Reports', icon: FileSpreadsheet }
  ];

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      color: '#1c1917',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: '16px 20px',
      position: 'relative',
      boxSizing: 'border-box'
    }}>
      {/* Soft Ambient Gold Glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '500px',
        height: '500px',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.6,
        filter: 'blur(80px)',
        background: 'radial-gradient(circle, rgba(253, 224, 71, 0.45) 0%, rgba(250, 204, 21, 0.2) 50%, transparent 75%)'
      }} />

      {/* Full Width Container */}
      <div style={{
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        backgroundColor: '#fafafa',
        borderRadius: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        padding: '24px',
        position: 'relative',
        zIndex: 10,
        boxSizing: 'border-box'
      }}>
        {/* Top Header Bar */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          paddingBottom: '20px',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '28px'
        }}>
          {/* Brand Logo & Portal Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 18px',
              borderRadius: '9999px',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}>
              <img src="/images/KutamiLOGO.jpg" alt="Kutami Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }} />
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#111827', letterSpacing: '-0.02em' }}>
                BRK <span style={{ color: '#f59e0b' }}>TaskHub</span>
              </span>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '9999px',
              backgroundColor: '#f3f4f6',
              color: '#4b5563',
              border: '1px solid #e5e7eb'
            }}>
              Admin Portal
            </span>
          </div>

          {/* Navigation Tabs Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            padding: '4px',
            borderRadius: '9999px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #e5e7eb'
          }}>
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
                    gap: '8px',
                    padding: '8px 18px',
                    borderRadius: '9999px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    border: 'none',
                    backgroundColor: isActive ? '#18181b' : 'transparent',
                    color: isActive ? '#ffffff' : '#4b5563',
                    boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.12)' : 'none'
                  }}
                >
                  <Icon size={15} style={{ color: isActive ? '#facc15' : '#6b7280' }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* User Session & Sign Out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#111827' }}>
                {session?.name || session?.username || 'Admin'}
              </span>
            </div>

            <button
              onClick={onLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '9999px',
                backgroundColor: '#fff1f2',
                color: '#e11d48',
                border: '1px solid #fecdd3',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Content Display Card */}
        <div style={{ marginTop: '12px' }}>
          {activeTab === 'dashboard' && (
            <AdminMetricsDashboardView />
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
              borderRadius: '24px',
              border: '1px solid #e5e7eb',
              padding: '60px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '380px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#ffe4e6',
                border: '1px solid #fca5a5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#be123c',
                marginBottom: '20px'
              }}>
                <ShieldAlert size={32} />
              </div>
              <span style={{
                padding: '4px 14px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                backgroundColor: '#ffe4e6',
                color: '#9f1239',
                border: '1px solid #fca5a5',
                marginBottom: '12px',
                display: 'inline-block'
              }}>
                Audit Trail
              </span>
              <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#111827', letterSpacing: '-0.03em', margin: 0 }}>
                System Integrity & Flagged Logs
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500, marginTop: '8px', maxWidth: '420px', lineHeight: 1.6 }}>
                Clean organized space for inspecting cross-employee duplicate handle attempts.
              </p>
            </div>
          )}

          {activeTab === 'reports' && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #e5e7eb',
              padding: '60px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '380px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#d1fae5',
                border: '1px solid #6ee7b7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#047857',
                marginBottom: '20px'
              }}>
                <FileSpreadsheet size={32} />
              </div>
              <span style={{
                padding: '4px 14px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                backgroundColor: '#d1fae5',
                color: '#065f46',
                border: '1px solid #6ee7b7',
                marginBottom: '12px',
                display: 'inline-block'
              }}>
                Export Reports
              </span>
              <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#111827', letterSpacing: '-0.03em', margin: 0 }}>
                Data Exports & CSV Reports
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500, marginTop: '8px', maxWidth: '420px', lineHeight: 1.6 }}>
                Clean organized space for downloading daily performance summaries and submission feeds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




