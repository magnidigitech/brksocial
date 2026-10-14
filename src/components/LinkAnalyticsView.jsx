import React, { useState, useEffect, useMemo } from 'react';
import {
  MousePointerClick,
  CheckCircle2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Download,
  ExternalLink,
  Copy,
  Check,
  ArrowUpDown,
  TrendingUp,
  RefreshCw,
  Building2,
  MapPin,
  Clock,
  Smartphone,
  Globe,
  Share2,
  X,
  Award
} from 'lucide-react';
import { dbService } from '../services/db.js';
import { AP_CONSTITUENCIES } from '../services/constituencyData.js';

export function LinkAnalyticsView() {
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL'); // 'TODAY', 'YESTERDAY', '7DAYS', 'ALL'
  
  // Parliament filter states: multi-select support
  const [isMultiParliament, setIsMultiParliament] = useState(false);
  const [selectedParliaments, setSelectedParliaments] = useState([]);
  const [selectedAssembly, setSelectedAssembly] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('validClicks'); // 'validClicks', 'totalClicks', 'name'
  const [sortAsc, setSortAsc] = useState(false);

  // Modal inspection
  const [inspectStaff, setInspectStaff] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const list = dbService.getTasks();
    setTasks(list);
  }, []);

  // Real-time live update & server sync
  useEffect(() => {
    const handleUpdate = () => setRefreshKey(prev => prev + 1);
    window.addEventListener('brk_link_click_event', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    const interval = setInterval(() => {
      dbService.syncClicksWithServer().then(() => {
        setRefreshKey(prev => prev + 1);
      }).catch(() => {});
    }, 2500);

    return () => {
      window.removeEventListener('brk_link_click_event', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Compute analytics based on current filters
  const analyticsData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const sevenDaysAgoDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    let targetDate = null;
    let startDate = null;

    if (dateFilter === 'TODAY') {
      targetDate = today;
    } else if (dateFilter === 'YESTERDAY') {
      targetDate = yesterdayDate;
    } else if (dateFilter === '7DAYS') {
      startDate = sevenDaysAgoDate;
    }

    const data = dbService.getLinkAnalytics({
      taskId: selectedTaskId !== 'ALL' ? selectedTaskId : null,
      date: targetDate,
      startDate: startDate
    });

    return data;
  }, [selectedTaskId, dateFilter, refreshKey]);

  // Flattened assemblies list
  const assembliesForSelection = useMemo(() => {
    if (selectedParliaments.length === 0) {
      return [];
    }
    const assemblies = [];
    AP_CONSTITUENCIES.forEach(p => {
      if (selectedParliaments.includes(p.code)) {
        assemblies.push(...p.assemblies);
      }
    });
    return assemblies;
  }, [selectedParliaments]);

  // Filter staff leaderboard
  const filteredLeaderboard = useMemo(() => {
    let list = analyticsData.staffLeaderboard || [];

    // Parliament filter
    if (selectedParliaments.length > 0) {
      list = list.filter(item => {
        const emp = item.employee;
        return emp && selectedParliaments.includes(emp.parliamentCode);
      });
    }

    // Assembly filter
    if (selectedAssembly !== 'ALL') {
      list = list.filter(item => {
        const emp = item.employee;
        return emp && emp.assemblyCode === selectedAssembly;
      });
    }

    // Search query (name, support code, staffId, phone)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => {
        const emp = item.employee;
        if (!emp) return false;
        return (
          (emp.name && emp.name.toLowerCase().includes(q)) ||
          (emp.supportCode && emp.supportCode.toLowerCase().includes(q)) ||
          (emp.staffId && emp.staffId.toLowerCase().includes(q)) ||
          (emp.mobilePersonal && emp.mobilePersonal.includes(q)) ||
          (emp.mobileOffice && emp.mobileOffice.includes(q)) ||
          (emp.assemblyName && emp.assemblyName.toLowerCase().includes(q))
        );
      });
    }

    // Sorting
    list = [...list].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'name') {
        valA = a.employee?.name || '';
        valB = b.employee?.name || '';
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [analyticsData, selectedParliaments, selectedAssembly, searchQuery, sortField, sortAsc]);

  // Copy staff tracking link handler
  const handleCopyStaffLink = (token, slug = 'instagram') => {
    const origin = typeof window !== 'undefined' && window.location.origin 
      ? window.location.origin 
      : 'https://social.bhashyamramakrishna.in';
    const url = `${origin}/${slug}/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  // Export CSV handler
  const handleExportCSV = () => {
    const clicks = analyticsData.recentClicks || dbService.getLinkClicks();
    if (clicks.length === 0) {
      alert('No click events found to export.');
      return;
    }

    const employees = dbService.getEmployees();
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });

    const headers = [
      'Click ID',
      'Timestamp',
      'Token',
      'Staff Support Code',
      'Staff Name',
      'Staff ID',
      'Parliament',
      'Assembly',
      'Is Valid Human',
      'Is Bot Preview',
      'Bot Type',
      'Visitor IP',
      'User Agent',
      'Target URL'
    ];

    const rows = clicks.map(c => {
      const emp = empMap[c.employeeId] || {};
      return [
        c.id,
        c.timestamp,
        c.token,
        emp.supportCode || c.employeeId,
        `"${(emp.name || '').replace(/"/g, '""')}"`,
        emp.staffId || '',
        `"${emp.parliamentName || ''}"`,
        `"${emp.assemblyName || ''}"`,
        c.isValid ? 'YES' : 'NO',
        c.isBot ? 'YES' : 'NO',
        c.botType || 'None',
        c.ip || '',
        `"${(c.userAgent || '').replace(/"/g, '""')}"`,
        c.targetUrl || ''
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BRK_Outreach_Link_Clicks_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validRate = analyticsData.totalClicks > 0 
    ? Math.round((analyticsData.validClicks / analyticsData.totalClicks) * 100) 
    : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Overview Card */}
      <div className="dashboard-section-card" style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #fffbf5 100%)',
        border: '1.5px solid #fed7aa',
        boxShadow: '0 10px 30px -10px rgba(255, 77, 0, 0.08)'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: '#fff7ed',
                color: '#ea580c',
                border: '1px solid #ffedd5',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                100% In-House Engine • Zero 3rd Party Fees
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0'
              }}>
                Sub-50ms Fast Redirect
              </span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0', letterSpacing: '-0.03em' }}>
              Outreach Link & Click Analytics
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, fontWeight: 500, maxWidth: '650px' }}>
              Live attribution of staff tracking URLs. Validates genuine human visitors and screens out automated WhatsApp/Facebook link preview crawlers before redirecting.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleRefresh}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '9999px',
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '9999px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)'
              }}
            >
              <Download size={14} />
              <span>Export CSV Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOP 4 EXECUTIVE KPI CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        {/* Total Clicks */}
        <div className="dashboard-metric-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Total Link Hits
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <MousePointerClick size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {analyticsData.totalClicks.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
            Raw traffic across all shared staff links
          </div>
        </div>

        {/* Valid Human Clicks */}
        <div className="dashboard-metric-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
              Verified Human Clicks
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#047857', letterSpacing: '-0.02em' }}>
              {analyticsData.validClicks.toLocaleString()}
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0'
            }}>
              {validRate}% Valid
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: 600 }}>
            Counted towards staff outreach completion
          </div>
        </div>

        {/* Unique Citizens Reached */}
        <div className="dashboard-metric-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
              Unique Visitors
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#0369a1', letterSpacing: '-0.02em' }}>
            {analyticsData.uniqueVisitors.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
            Distinct citizen IP addresses engaged
          </div>
        </div>

        {/* Filtered Previews & Bots */}
        <div className="dashboard-metric-card" style={{ borderLeft: '4px solid #64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Screened Preview Bots
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#334155', letterSpacing: '-0.02em' }}>
              {analyticsData.botClicks.toLocaleString()}
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1'
            }}>
              WhatsApp Crawlers
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
            Auto-screened to avoid false reporting
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="dashboard-section-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Top Row: Date Range & Task Selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            {/* Date Range Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>
                Period:
              </span>
              {[
                { id: 'ALL', label: 'All Time' },
                { id: 'TODAY', label: 'Today' },
                { id: 'YESTERDAY', label: 'Yesterday' },
                { id: '7DAYS', label: 'Last 7 Days' }
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => setDateFilter(d.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: dateFilter === d.id ? '1.5px solid #ff4d00' : '1px solid #e2e8f0',
                    backgroundColor: dateFilter === d.id ? '#fff7ed' : '#ffffff',
                    color: dateFilter === d.id ? '#c2410c' : '#475569',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Campaign Task Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                Task:
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              >
                <option value="ALL">All Outreach Tasks</option>
                {tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bottom Row: Parliament Selection with Toggle & Assembly Dropdown */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9'
          }}>
            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '9999px',
              padding: '6px 14px',
              flex: '1 1 220px',
              gap: '6px'
            }}>
              <Search size={14} style={{ color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search staff name, support code, staff ID, mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  width: '100%',
                  backgroundColor: 'transparent'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Multi-Select Toggle */}
            <button
              onClick={() => {
                setIsMultiParliament(!isMultiParliament);
                setSelectedParliaments([]);
                setSelectedAssembly('ALL');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '9999px',
                border: isMultiParliament ? '1.5px solid #ff4d00' : '1px solid #cbd5e1',
                backgroundColor: isMultiParliament ? '#fff7ed' : '#ffffff',
                color: isMultiParliament ? '#c2410c' : '#475569',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <span>{isMultiParliament ? 'Multi-Select: ON' : 'Single Select'}</span>
            </button>

            {/* Single Parliament Dropdown (When Multi-Select is OFF) */}
            {!isMultiParliament ? (
              <select
                value={selectedParliaments[0] || 'ALL'}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedParliaments(val === 'ALL' ? [] : [val]);
                  setSelectedAssembly('ALL');
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  minWidth: '180px'
                }}
              >
                <option value="ALL">All 25 Parliaments</option>
                {AP_CONSTITUENCIES.map(p => (
                  <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                ))}
              </select>
            ) : null}

            {/* Assembly Filter */}
            {selectedParliaments.length > 0 && assembliesForSelection.length > 0 && (
              <select
                value={selectedAssembly}
                onChange={(e) => setSelectedAssembly(e.target.value)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              >
                <option value="ALL">All Assemblies ({assembliesForSelection.length})</option>
                {assembliesForSelection.map(a => (
                  <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                ))}
              </select>
            )}

            {(selectedParliaments.length > 0 || selectedAssembly !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedParliaments([]);
                  setSelectedAssembly('ALL');
                  setSearchQuery('');
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Multi-Select Parliaments Checkboxes Bar (When Multi-Select is ON) */}
          {isMultiParliament && (
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                  Select Parliaments to Compare ({selectedParliaments.length} selected):
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setSelectedParliaments(AP_CONSTITUENCIES.map(p => p.code))}
                    style={{ fontSize: '10px', fontWeight: 700, color: '#ff4d00', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Select All
                  </button>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <button
                    onClick={() => setSelectedParliaments([])}
                    style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '6px',
                maxHeight: '130px',
                overflowY: 'auto'
              }}>
                {AP_CONSTITUENCIES.map(p => {
                  const isChecked = selectedParliaments.includes(p.code);
                  return (
                    <label
                      key={p.code}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: isChecked ? '#fff7ed' : '#ffffff',
                        border: `1px solid ${isChecked ? '#ff4d00' : '#e2e8f0'}`,
                        fontSize: '11px',
                        fontWeight: isChecked ? 700 : 500,
                        color: isChecked ? '#c2410c' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedParliaments(selectedParliaments.filter(c => c !== p.code));
                          } else {
                            setSelectedParliaments([...selectedParliaments, p.code]);
                          }
                        }}
                        style={{ accentColor: '#ff4d00' }}
                      />
                      <span>{p.code} - {p.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STAFF PERFORMANCE LEADERBOARD */}
      <div className="dashboard-section-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Staff Outreach Link Leaderboard ({filteredLeaderboard.length})
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Ranked by verified clicks generated through exclusive staff tracking links.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Sort By:</span>
            <button
              onClick={() => {
                if (sortField === 'validClicks') setSortAsc(!sortAsc);
                else { setSortField('validClicks'); setSortAsc(false); }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: '9999px',
                backgroundColor: sortField === 'validClicks' ? '#0f172a' : '#f1f5f9',
                color: sortField === 'validClicks' ? '#ffffff' : '#475569',
                fontSize: '11px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <span>Verified Clicks</span>
              <ArrowUpDown size={12} />
            </button>

            <button
              onClick={() => {
                if (sortField === 'totalClicks') setSortAsc(!sortAsc);
                else { setSortField('totalClicks'); setSortAsc(false); }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: '9999px',
                backgroundColor: sortField === 'totalClicks' ? '#0f172a' : '#f1f5f9',
                color: sortField === 'totalClicks' ? '#ffffff' : '#475569',
                fontSize: '11px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <span>Total Hits</span>
              <ArrowUpDown size={12} />
            </button>
          </div>
        </div>

        {filteredLeaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '13px' }}>
            No staff records matching your filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: '50px' }}>Rank</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Staff Member</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Constituency</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Verified Clicks</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Unique Citizens</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Screened Bots</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Staff Tracking Link</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((item, index) => {
                  const emp = item.employee;
                  const rank = index + 1;
                  const token = item.token || 'a8Kx9pQ2mR';
                  const isCopied = copiedToken === token;

                  return (
                    <tr
                      key={item.employeeId}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: rank <= 3 ? '#fffdf7' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Rank */}
                      <td style={{ padding: '12px 12px' }}>
                        {rank === 1 && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            fontWeight: 900,
                            fontSize: '12px',
                            border: '1px solid #fde68a'
                          }}>
                            1
                          </span>
                        )}
                        {rank === 2 && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontWeight: 900,
                            fontSize: '12px',
                            border: '1px solid #cbd5e1'
                          }}>
                            2
                          </span>
                        )}
                        {rank === 3 && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: '#fff7ed',
                            color: '#c2410c',
                            fontWeight: 900,
                            fontSize: '12px',
                            border: '1px solid #fed7aa'
                          }}>
                            3
                          </span>
                        )}
                        {rank > 3 && (
                          <span style={{ fontWeight: 700, color: '#94a3b8', paddingLeft: '8px' }}>
                            {rank}
                          </span>
                        )}
                      </td>

                      {/* Staff Info */}
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            {emp?.name || 'Staff Member'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ea580c' }}>
                              {emp?.supportCode || item.employeeId}
                            </span>
                            {emp?.staffId && (
                              <>
                                <span>•</span>
                                <span style={{ fontFamily: 'monospace' }}>ID: {emp.staffId}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Constituency */}
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
                          <span style={{ fontWeight: 700, color: '#334155' }}>
                            {emp?.parliamentName || 'Parliament'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {emp?.assemblyName || 'Assembly'}
                          </span>
                        </div>
                      </td>

                      {/* Verified Clicks */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '15px',
                          fontWeight: 900,
                          color: item.validClicks > 0 ? '#047857' : '#94a3b8',
                          backgroundColor: item.validClicks > 0 ? '#ecfdf5' : '#f8fafc',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${item.validClicks > 0 ? '#a7f3d0' : '#e2e8f0'}`
                        }}>
                          {item.validClicks}
                        </span>
                      </td>

                      {/* Unique Visitors */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                          {item.uniqueIps}
                        </span>
                      </td>

                      {/* Screened Bots */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: item.botClicks > 0 ? '#f59e0b' : '#94a3b8' }}>
                          {item.botClicks}
                        </span>
                      </td>

                      {/* Copy Staff Link */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyStaffLink(token)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            backgroundColor: isCopied ? '#ecfdf5' : '#f1f5f9',
                            color: isCopied ? '#047857' : '#475569',
                            border: `1px solid ${isCopied ? '#a7f3d0' : '#cbd5e1'}`,
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'monospace'
                          }}
                          title={`Copy tracking link for ${emp?.name}`}
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                          <span>{isCopied ? 'Copied' : `/${token.slice(0, 6)}...`}</span>
                        </button>
                      </td>

                      {/* Inspect Action */}
                      <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => setInspectStaff(item)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '9999px',
                            backgroundColor: '#f8fafc',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECENT REAL-TIME CLICK STREAM (LIVE TICKER) */}
      <div className="dashboard-section-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)'
            }} />
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Live Click Activity Feed (Recent 15 Events)
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            Real-time redirect stream
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(analyticsData.recentClicks || []).slice(0, 15).map((c) => {
            const isBot = c.isBot;
            const timeFormatted = new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: isBot ? '#f8fafc' : '#ffffff',
                  border: `1px solid ${isBot ? '#e2e8f0' : '#dcfce7'}`,
                  fontSize: '12px',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isBot ? '#94a3b8' : '#10b981',
                    flexShrink: 0
                  }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    {timeFormatted}
                  </span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {c.staffName || c.employeeId}
                  </span>
                  {c.assembly && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      ({c.assembly})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: isBot ? '#f1f5f9' : '#ecfdf5',
                    color: isBot ? '#475569' : '#059669',
                    border: `1px solid ${isBot ? '#cbd5e1' : '#a7f3d0'}`
                  }}>
                    {isBot ? `Bot Screened: ${c.botType || 'WhatsApp'}` : 'Verified Citizen'}
                  </span>

                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: '#94a3b8',
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {c.userAgent || 'Visitor'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* INSPECT STAFF CLICKS MODAL */}
      {inspectStaff && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Click Attribution Audit: {inspectStaff.employee?.name}
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Support Code: <strong>{inspectStaff.employee?.supportCode || inspectStaff.employeeId}</strong> • Parliament: {inspectStaff.employee?.parliamentName}
                </p>
              </div>

              <button
                onClick={() => setInspectStaff(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
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

            {/* Quick Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '20px',
              backgroundColor: '#f8fafc',
              padding: '14px',
              borderRadius: '12px'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Verified Clicks</span>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#047857' }}>
                  {inspectStaff.validClicks}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Unique IPs</span>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0284c7' }}>
                  {inspectStaff.uniqueIps}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Screened Bots</span>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#475569' }}>
                  {inspectStaff.botClicks}
                </div>
              </div>
            </div>

            {/* Tracking Link Preview */}
            <div style={{
              backgroundColor: '#fff7ed',
              border: '1px solid #fed7aa',
              padding: '12px 14px',
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase' }}>
                  Active Tracking URL:
                </span>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#0f172a', fontWeight: 700, wordBreak: 'break-all' }}>
                  https://social.bhashyamramakrishna.in/instagram/{inspectStaff.token}
                </div>
              </div>

              <button
                onClick={() => handleCopyStaffLink(inspectStaff.token)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  backgroundColor: '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {copiedToken === inspectStaff.token ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedToken === inspectStaff.token ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setInspectStaff(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '9999px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
