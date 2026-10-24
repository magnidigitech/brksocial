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
import { getTodayISTDateString, getISTDateOffset } from '../services/istUtils.js';

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
  const [serverClicks, setServerClicks] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const list = dbService.getTasks();
    setTasks(list);
  }, []);

  const fetchLiveClicks = async () => {
    setIsRefreshing(true);
    try {
      const clicks = await dbService.syncClicksWithServer();
      if (Array.isArray(clicks)) {
        setServerClicks(clicks);
      }
    } catch (e) {
      console.warn('Failed to fetch live clicks:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Real-time live update & server sync
  useEffect(() => {
    fetchLiveClicks();

    const handleUpdate = () => fetchLiveClicks();
    window.addEventListener('brk_link_click_event', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLiveClicks();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      fetchLiveClicks();
    }, 2500);

    return () => {
      window.removeEventListener('brk_link_click_event', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  const handleRefresh = () => {
    fetchLiveClicks();
  };

  // Compute analytics based on current filters
  const analyticsData = useMemo(() => {
    const today = getTodayISTDateString();
    const yesterdayDate = getISTDateOffset(-1);
    const sevenDaysAgoDate = getISTDateOffset(-7);

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
      startDate: startDate,
      allClicks: serverClicks
    });

    return data;
  }, [selectedTaskId, dateFilter, serverClicks, refreshKey]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Apple-Style Executive Header Card */}
      <div className="dashboard-section-card" style={{
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        borderRadius: '18px',
        padding: '24px 28px'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '980px',
                backgroundColor: 'rgba(0, 113, 227, 0.08)',
                color: '#0071e3',
                border: '1px solid rgba(0, 113, 227, 0.15)',
                letterSpacing: '0.02em'
              }}>
                In-House Attribution Engine
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '980px',
                backgroundColor: 'rgba(52, 199, 89, 0.1)',
                color: '#248a3d',
                border: '1px solid rgba(52, 199, 89, 0.2)'
              }}>
                Sub-50ms Fast Direct
              </span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 6px 0', letterSpacing: '-0.025em' }}>
              Outreach Link & Click Analytics
            </h1>
            <p style={{ fontSize: '13px', color: '#86868b', margin: 0, fontWeight: 400, maxWidth: '640px', lineHeight: 1.45 }}>
              Real-time verified attribution for staff tracking links. Accurately records genuine citizen engagement while automatically filtering WhatsApp & social preview crawlers.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '980px',
                backgroundColor: isRefreshing ? '#f5f5f7' : '#ffffff',
                color: '#1d1d1f',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isRefreshing ? 'default' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <RefreshCw 
                size={13} 
                style={{ 
                  color: isRefreshing ? '#0071e3' : '#86868b',
                  animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none'
                }} 
              />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '980px',
                backgroundColor: '#0071e3',
                color: '#ffffff',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 113, 227, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOP 4 MINIMALIST APPLE KPI CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px'
      }}>
        {/* Total Clicks */}
        <div className="dashboard-metric-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Link Hits
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(255, 149, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9500' }}>
              <MousePointerClick size={15} />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {analyticsData.totalClicks.toLocaleString()}
          </div>
          <div style={{ fontSize: '11.5px', color: '#86868b', marginTop: '6px', fontWeight: 400 }}>
            Raw traffic across all shared staff links
          </div>
        </div>

        {/* Valid Human Clicks */}
        <div className="dashboard-metric-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#248a3d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Verified Human Clicks
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(52, 199, 89, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34c759' }}>
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {analyticsData.validClicks.toLocaleString()}
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '980px',
              backgroundColor: 'rgba(52, 199, 89, 0.12)',
              color: '#248a3d'
            }}>
              {validRate}% Valid
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#248a3d', marginTop: '6px', fontWeight: 500 }}>
            Counted towards staff outreach completion
          </div>
        </div>

        {/* Unique Citizens Reached */}
        <div className="dashboard-metric-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#0071e3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Unique Visitors
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(0, 113, 227, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0071e3' }}>
              <Users size={15} />
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {analyticsData.uniqueVisitors.toLocaleString()}
          </div>
          <div style={{ fontSize: '11.5px', color: '#86868b', marginTop: '6px', fontWeight: 400 }}>
            Distinct citizen IP addresses engaged
          </div>
        </div>

        {/* Filtered Previews & Bots */}
        <div className="dashboard-metric-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Screened Preview Bots
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'rgba(118, 118, 128, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86868b' }}>
              <ShieldCheck size={15} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {analyticsData.botClicks.toLocaleString()}
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '980px',
              backgroundColor: 'rgba(118, 118, 128, 0.1)',
              color: '#86868b'
            }}>
              WhatsApp Crawlers
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#86868b', marginTop: '6px', fontWeight: 400 }}>
            Auto-screened to avoid false reporting
          </div>
        </div>
      </div>

      {/* APPLE-STYLE MINIMAL FILTER CONTROLS BAR */}
      <div className="dashboard-section-card" style={{ padding: '16px 20px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Top Row: Date Range & Task Selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            {/* Apple Segmented Control for Period */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '3px',
              borderRadius: '10px',
              backgroundColor: 'rgba(118, 118, 128, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.04)'
            }}>
              {[
                { id: 'ALL', label: 'All Time' },
                { id: 'TODAY', label: 'Today' },
                { id: 'YESTERDAY', label: 'Yesterday' },
                { id: '7DAYS', label: 'Last 7 Days' }
              ].map(d => {
                const isActive = dateFilter === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDateFilter(d.id)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? '#1d1d1f' : '#86868b',
                      boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            {/* Campaign Task Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#86868b' }}>
                Task:
              </span>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  fontSize: '12px',
                  fontWeight: 500,
                  outline: 'none',
                  backgroundColor: 'rgba(118, 118, 128, 0.06)',
                  color: '#1d1d1f',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Outreach Tasks</option>
                {tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bottom Row: Search & Parliament Selector */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(0, 0, 0, 0.05)'
          }}>
            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(118, 118, 128, 0.06)',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              borderRadius: '10px',
              padding: '6px 12px',
              flex: '1 1 240px',
              gap: '6px'
            }}>
              <Search size={14} style={{ color: '#86868b' }} />
              <input
                type="text"
                placeholder="Search staff name, support code, staff ID, mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  fontWeight: 400,
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: '#1d1d1f'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#86868b' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Single Parliament Dropdown */}
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
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  fontSize: '12px',
                  fontWeight: 500,
                  outline: 'none',
                  backgroundColor: 'rgba(118, 118, 128, 0.06)',
                  color: '#1d1d1f',
                  minWidth: '180px',
                  cursor: 'pointer'
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
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  fontSize: '12px',
                  fontWeight: 500,
                  outline: 'none',
                  backgroundColor: 'rgba(118, 118, 128, 0.06)',
                  color: '#1d1d1f',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Assemblies ({assembliesForSelection.length})</option>
                {assembliesForSelection.map(a => (
                  <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                ))}
              </select>
            )}

            {/* Multi-Select Toggle Button */}
            <button
              onClick={() => {
                setIsMultiParliament(!isMultiParliament);
                setSelectedParliaments([]);
                setSelectedAssembly('ALL');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                border: isMultiParliament ? '1px solid #0071e3' : '1px solid rgba(0, 0, 0, 0.08)',
                backgroundColor: isMultiParliament ? 'rgba(0, 113, 227, 0.08)' : '#ffffff',
                color: isMultiParliament ? '#0071e3' : '#1d1d1f',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span>{isMultiParliament ? 'Multi-Select: ON' : 'Single Select'}</span>
            </button>

            {(selectedParliaments.length > 0 || selectedAssembly !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedParliaments([]);
                  setSelectedAssembly('ALL');
                  setSearchQuery('');
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '980px',
                  backgroundColor: 'rgba(118, 118, 128, 0.1)',
                  color: '#86868b',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Multi-Select Parliaments Grid */}
          {isMultiParliament && (
            <div style={{
              backgroundColor: 'rgba(118, 118, 128, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#1d1d1f' }}>
                  Select Parliaments to Compare ({selectedParliaments.length} selected):
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setSelectedParliaments(AP_CONSTITUENCIES.map(p => p.code))}
                    style={{ fontSize: '11px', fontWeight: 600, color: '#0071e3', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Select All
                  </button>
                  <span style={{ color: '#d2d2d7' }}>|</span>
                  <button
                    onClick={() => setSelectedParliaments([])}
                    style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', background: 'none', border: 'none', cursor: 'pointer' }}
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
                        backgroundColor: isChecked ? 'rgba(0, 113, 227, 0.08)' : '#ffffff',
                        border: `1px solid ${isChecked ? '#0071e3' : 'rgba(0,0,0,0.06)'}`,
                        fontSize: '11px',
                        fontWeight: isChecked ? 600 : 400,
                        color: isChecked ? '#0071e3' : '#1d1d1f',
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
                        style={{ accentColor: '#0071e3' }}
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

      {/* APPLE-STYLE STAFF PERFORMANCE LEADERBOARD */}
      <div className="dashboard-section-card" style={{ padding: '20px 24px', borderRadius: '18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
              Staff Outreach Link Leaderboard ({filteredLeaderboard.length})
            </h2>
            <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0' }}>
              Ranked by verified clicks generated through exclusive staff tracking links.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#86868b' }}>Sort By:</span>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px',
              borderRadius: '8px',
              backgroundColor: 'rgba(118, 118, 128, 0.08)'
            }}>
              <button
                onClick={() => {
                  if (sortField === 'validClicks') setSortAsc(!sortAsc);
                  else { setSortField('validClicks'); setSortAsc(false); }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: sortField === 'validClicks' ? '#ffffff' : 'transparent',
                  color: sortField === 'validClicks' ? '#1d1d1f' : '#86868b',
                  boxShadow: sortField === 'validClicks' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <span>Verified Clicks</span>
                <ArrowUpDown size={11} />
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
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: sortField === 'totalClicks' ? '#ffffff' : 'transparent',
                  color: sortField === 'totalClicks' ? '#1d1d1f' : '#86868b',
                  boxShadow: sortField === 'totalClicks' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <span>Total Hits</span>
                <ArrowUpDown size={11} />
              </button>
            </div>
          </div>
        </div>

        {filteredLeaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#86868b', fontSize: '13px' }}>
            No staff records matching your filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', color: '#86868b' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', width: '50px' }}>Rank</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Staff Member</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Constituency</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Verified Clicks</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Unique Citizens</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Screened Bots</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Staff Tracking Link</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
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
                        borderBottom: '1px solid #f2f2f7',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.015)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Rank */}
                      <td style={{ padding: '12px 14px' }}>
                        {rank === 1 && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255, 149, 0, 0.15)',
                            color: '#b45309',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}>
                            1
                          </span>
                        )}
                        {rank === 2 && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(118, 118, 128, 0.12)',
                            color: '#475569',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}>
                            2
                          </span>
                        )}
                        {rank === 3 && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(234, 88, 12, 0.12)',
                            color: '#c2410c',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}>
                            3
                          </span>
                        )}
                        {rank > 3 && (
                          <span style={{ fontWeight: 500, color: '#86868b', paddingLeft: '6px', fontSize: '12px' }}>
                            {rank}
                          </span>
                        )}
                      </td>

                      {/* Staff Info */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: '#1d1d1f' }}>
                            {emp?.name || 'Staff Member'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#86868b', marginTop: '2px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0071e3' }}>
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
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
                          <span style={{ fontWeight: 600, color: '#1d1d1f' }}>
                            {emp?.parliamentName || 'Parliament'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#86868b' }}>
                            {emp?.assemblyName || 'Parliament Incharge'}
                          </span>
                        </div>
                      </td>

                      {/* Verified Clicks */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: item.validClicks > 0 ? '#248a3d' : '#86868b',
                          backgroundColor: item.validClicks > 0 ? 'rgba(52, 199, 89, 0.1)' : 'rgba(118, 118, 128, 0.06)',
                          padding: '3px 10px',
                          borderRadius: '980px',
                          border: item.validClicks > 0 ? '1px solid rgba(52, 199, 89, 0.2)' : 'none'
                        }}>
                          {item.validClicks}
                        </span>
                      </td>

                      {/* Unique Citizens */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: item.uniqueIps > 0 ? '#0071e3' : '#86868b' }}>
                          {item.uniqueIps}
                        </span>
                      </td>

                      {/* Screened Bots */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 500, color: item.botClicks > 0 ? '#ff9500' : '#86868b' }}>
                          {item.botClicks}
                        </span>
                      </td>

                      {/* Copy Staff Link */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyStaffLink(token)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '980px',
                            backgroundColor: isCopied ? 'rgba(52, 199, 89, 0.12)' : 'rgba(0, 113, 227, 0.08)',
                            color: isCopied ? '#248a3d' : '#0071e3',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            transition: 'all 0.15s ease'
                          }}
                          title={`Copy tracking link for ${emp?.name}`}
                        >
                          {isCopied ? <Check size={11} /> : <Copy size={11} />}
                          <span>{isCopied ? 'Copied' : `/${token.slice(0, 6)}...`}</span>
                        </button>
                      </td>

                      {/* Inspect Action */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          onClick={() => setInspectStaff(item)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '980px',
                            backgroundColor: '#ffffff',
                            color: '#1d1d1f',
                            border: '1px solid rgba(0, 0, 0, 0.12)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
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
