import React, { useState, useMemo } from 'react';
import { 
  Users, CheckCircle2, ShieldCheck, Target, Search, RefreshCw, 
  Award, Calendar, MapPin, Building2, Activity, Sparkles, 
  BarChart3, ChevronDown, ChevronUp, Filter, AlertCircle, ArrowUpRight, TrendingUp,
  ArrowUpDown, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp
} from 'lucide-react';
import { dbService } from '../services/db.js';
import { AP_CONSTITUENCIES } from '../services/constituencyData.js';

// Coordinates mapping on the AP SVG Map for 25 AP Parliamentary Constituencies (Aligned 1:1 with printed numbers 1 to 25 on map artwork)
const PARLIAMENT_MAP_COORDS = {
  APP01: { top: '19.65%', left: '64.38%', num: '1', region: 'North Coast' },  // Araku (1)
  APP02: { top: '12.69%', left: '76.66%', num: '2', region: 'North Coast' },  // Srikakulam (2)
  APP03: { top: '21.56%', left: '70.31%', num: '3', region: 'North Coast' },  // Vizianagaram (3)
  APP04: { top: '25.22%', left: '66.72%', num: '4', region: 'North Coast' },  // Visakhapatnam (4)
  APP05: { top: '16.67%', left: '72.09%', num: '5', region: 'North Coast' },  // Anakapalle (5)
  APP06: { top: '32.44%', left: '62.22%', num: '6', region: 'Godavari' },     // Kakinada (6)
  APP07: { top: '39.10%', left: '60.43%', num: '7', region: 'Godavari' },     // Amalapuram (7)
  APP08: { top: '34.53%', left: '57.72%', num: '8', region: 'Godavari' },     // Rajahmundry (8)
  APP09: { top: '40.50%', left: '57.24%', num: '9', region: 'Godavari' },     // Narsapuram (9)
  APP10: { top: '33.95%', left: '53.08%', num: '10', region: 'Godavari' },    // Eluru (10)
  APP11: { top: '43.95%', left: '52.39%', num: '11', region: 'Central AP' },  // Machilipatnam (11)
  APP12: { top: '37.32%', left: '46.72%', num: '12', region: 'Central AP' },  // Vijayawada (12)
  APP13: { top: '43.25%', left: '47.80%', num: '13', region: 'Central AP' },  // Guntur (13)
  APP14: { top: '42.55%', left: '42.94%', num: '14', region: 'Central AP' },  // Narasaraopet (14)
  APP15: { top: '50.67%', left: '45.68%', num: '15', region: 'Central AP' },  // Bapatla (15)
  APP16: { top: '52.98%', left: '39.22%', num: '16', region: 'South Coast' }, // Ongole (16)
  APP17: { top: '54.25%', left: '31.04%', num: '17', region: 'Rayalaseema' }, // Nandyal (17)
  APP18: { top: '52.35%', left: '24.52%', num: '18', region: 'Rayalaseema' }, // Kurnool (18)
  APP19: { top: '61.56%', left: '23.91%', num: '19', region: 'Rayalaseema' }, // Anantapur (19)
  APP20: { top: '73.12%', left: '25.34%', num: '20', region: 'Rayalaseema' }, // Hindupur (20)
  APP21: { top: '66.96%', left: '31.81%', num: '21', region: 'Rayalaseema' }, // Kadapa (21)
  APP22: { top: '64.01%', left: '42.58%', num: '22', region: 'South Coast' }, // Nellore (22)
  APP23: { top: '77.08%', left: '42.03%', num: '23', region: 'Rayalaseema' }, // Tirupati (23)
  APP24: { top: '77.64%', left: '34.21%', num: '24', region: 'Rayalaseema' }, // Rajampet (24)
  APP25: { top: '86.34%', left: '35.75%', num: '25', region: 'Rayalaseema' }  // Chittoor (25)
};

export function AdminMetricsDashboardView() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [parliamentFilter, setParliamentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('ALL'); // 'ALL', 'Completed', 'In Progress', 'Not Started'
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Interactive Map State
  const [hoveredMapParliament, setHoveredMapParliament] = useState(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  // Leaderboard Controls
  const [leaderboardShowMode, setLeaderboardShowMode] = useState('ALL'); // 'ALL', 'TOP_5', 'BOTTOM_5', 'TOP_10', 'BOTTOM_10'
  const [leaderboardSortOrder, setLeaderboardSortOrder] = useState('DESC'); // 'DESC' (Highest first), 'ASC' (Lowest first)

  // Selected Task Campaign Filter State
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // Collapsible Parliaments State for Staff Outreach Tracker
  // Default: All Parliaments collapsed by default
  const [collapsedParliaments, setCollapsedParliaments] = useState(() => {
    const map = {};
    AP_CONSTITUENCIES.forEach(p => {
      map[p.code] = true; // Default: collapsed
    });
    return map;
  });

  // Real-Time Live AJAX Refresh Trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  React.useEffect(() => {
    const handleSubmissionEvent = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    const handleStorageEvent = (e) => {
      if (!e.key || e.key.includes('brk_')) {
        setRefreshTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('brk_submission_event', handleSubmissionEvent);
    window.addEventListener('storage', handleStorageEvent);

    // Live sync polling every 2 seconds for instant reflection without page reload
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 2000);

    return () => {
      window.removeEventListener('brk_submission_event', handleSubmissionEvent);
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(interval);
    };
  }, []);

  // Column Sorting for Staff Table
  const [tableSortField, setTableSortField] = useState('valid'); // 'name', 'id', 'constituency', 'valid', 'target', 'duplicate', 'status'
  const [tableSortDirection, setTableSortDirection] = useState('desc'); // 'asc' or 'desc'

  // Fetch All Tasks for Selector
  const allTasks = useMemo(() => {
    return dbService.getTasks();
  }, [isRefreshing, refreshTrigger]);

  // Effective selected task ID (defaults to active task or first task if unselected)
  const effectiveTaskId = useMemo(() => {
    if (selectedTaskId && allTasks.some(t => t.id === selectedTaskId)) {
      return selectedTaskId;
    }
    const active = dbService.getActiveTask();
    return active?.id || allTasks[0]?.id || '';
  }, [selectedTaskId, allTasks]);

  // Fetch Dashboard Stats from dbService
  const stats = useMemo(() => {
    return dbService.getAdminDashboardOverview(selectedDate, effectiveTaskId);
  }, [selectedDate, effectiveTaskId, isRefreshing, refreshTrigger]);

  // Fetch Active Task
  const activeTask = useMemo(() => {
    return dbService.getTaskById(effectiveTaskId) || dbService.getActiveTask();
  }, [effectiveTaskId, isRefreshing, refreshTrigger]);

  // Calculate Parliament-level Performance Breakdown across ALL 25 Parliaments
  const rawParliamentPerformance = useMemo(() => {
    const list = stats.employeeProgressList || [];
    
    return AP_CONSTITUENCIES.map(p => {
      const pStaff = list.filter(e => e.parliamentCode === p.code);
      const totalStaff = pStaff.length;
      const completedStaff = pStaff.filter(e => e.status === 'Completed').length;
      const inProgressStaff = pStaff.filter(e => e.status === 'In Progress').length;
      const notStartedStaff = pStaff.filter(e => e.status === 'Not Started').length;
      const totalValid = pStaff.reduce((acc, curr) => acc + (curr.valid || 0), 0);
      const totalDuplicates = pStaff.reduce((acc, curr) => acc + (curr.duplicate || 0), 0);
      const totalTarget = pStaff.reduce((acc, curr) => acc + (curr.target || 10), 0);
      const completionRate = totalTarget > 0 ? Math.min(100, Math.round((totalValid / totalTarget) * 100)) : 0;

      return {
        code: p.code,
        name: p.name,
        totalStaff,
        completedStaff,
        inProgressStaff,
        notStartedStaff,
        totalValid,
        totalDuplicates,
        totalTarget,
        completionRate
      };
    });
  }, [stats]);

  // Dynamically sorted & sliced Parliament Leaderboard
  const sortedParliaments = useMemo(() => {
    let list = [...rawParliamentPerformance];

    // Dynamic Sort
    list.sort((a, b) => {
      if (leaderboardSortOrder === 'DESC') {
        if (b.totalValid !== a.totalValid) return b.totalValid - a.totalValid;
        if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
        return a.name.localeCompare(b.name);
      } else {
        if (a.totalValid !== b.totalValid) return a.totalValid - b.totalValid;
        if (a.completionRate !== b.completionRate) return a.completionRate - b.completionRate;
        return a.name.localeCompare(b.name);
      }
    });

    if (leaderboardShowMode === 'TOP_5') {
      return list.slice(0, 5);
    } else if (leaderboardShowMode === 'BOTTOM_5') {
      return list.slice(-5).reverse();
    } else if (leaderboardShowMode === 'TOP_10') {
      return list.slice(0, 10);
    } else if (leaderboardShowMode === 'BOTTOM_10') {
      return list.slice(-10).reverse();
    }

    return list; // ALL 25 Parliaments
  }, [rawParliamentPerformance, leaderboardSortOrder, leaderboardShowMode]);

  // Filter & Sort Employee Progress List
  const filteredEmployees = useMemo(() => {
    let list = stats.employeeProgressList || [];

    if (parliamentFilter !== 'ALL') {
      list = list.filter(e => e.parliamentCode === parliamentFilter);
    }

    if (statusTab !== 'ALL') {
      list = list.filter(e => e.status === statusTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(e => 
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.parliamentName && e.parliamentName.toLowerCase().includes(q)) ||
        (e.assemblyName && e.assemblyName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [stats, parliamentFilter, statusTab, searchQuery]);

  // Group Employees by Parliamentary Constituency for Accordion View
  const groupedParliamentsStaff = useMemo(() => {
    const map = {};

    AP_CONSTITUENCIES.forEach(p => {
      map[p.code] = {
        code: p.code,
        name: p.name,
        staff: []
      };
    });

    filteredEmployees.forEach(emp => {
      const pCode = emp.parliamentCode || (emp.id.startsWith('APP') ? emp.id.substring(0, 5) : null);
      if (pCode && map[pCode]) {
        map[pCode].staff.push(emp);
      }
    });

    // Convert map to array of active parliamentary groups
    return Object.values(map).filter(group => {
      // If filtering by parliament or search/status, only show groups with staff
      if (parliamentFilter !== 'ALL' || searchQuery.trim() || statusTab !== 'ALL') {
        return group.staff.length > 0;
      }
      return true; // Show all 25 Parliaments by default
    }).map(group => {
      // Sort staff inside each parliament group
      const sortedStaff = [...group.staff].sort((a, b) => {
        let aVal = a[tableSortField];
        let bVal = b[tableSortField];

        if (tableSortField === 'constituency') {
          aVal = `${a.parliamentName || ''} ${a.assemblyName || ''}`;
          bVal = `${b.parliamentName || ''} ${b.assemblyName || ''}`;
        }

        if (typeof aVal === 'string') {
          const cmp = aVal.localeCompare(bVal || '');
          return tableSortDirection === 'asc' ? cmp : -cmp;
        }

        aVal = aVal || 0;
        bVal = bVal || 0;
        return tableSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      });

      const totalValid = group.staff.reduce((acc, curr) => acc + (curr.valid || 0), 0);
      const totalTarget = group.staff.reduce((acc, curr) => acc + (curr.target || 10), 0);
      const completedCount = group.staff.filter(e => e.status === 'Completed').length;
      const inProgressCount = group.staff.filter(e => e.status === 'In Progress').length;
      const notStartedCount = group.staff.filter(e => e.status === 'Not Started').length;
      const completionRate = totalTarget > 0 ? Math.min(100, Math.round((totalValid / totalTarget) * 100)) : 0;

      return {
        ...group,
        staff: sortedStaff,
        totalValid,
        totalTarget,
        completedCount,
        inProgressCount,
        notStartedCount,
        completionRate
      };
    });
  }, [filteredEmployees, parliamentFilter, searchQuery, statusTab, tableSortField, tableSortDirection]);

  // Toggle Collapse State for a single Parliament
  const toggleParliamentCollapse = (pCode) => {
    setCollapsedParliaments(prev => ({
      ...prev,
      [pCode]: !prev[pCode]
    }));
  };

  // Expand All / Collapse All
  const handleCollapseAll = () => {
    const map = {};
    AP_CONSTITUENCIES.forEach(p => { map[p.code] = true; });
    setCollapsedParliaments(map);
  };

  const handleExpandAll = () => {
    setCollapsedParliaments({});
  };

  const handleHeaderSort = (field) => {
    if (tableSortField === field) {
      setTableSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortField(field);
      setTableSortDirection('desc');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  const targetCompletionPercentage = stats.targetSubmissions > 0 
    ? Math.min(100, Math.round((stats.validSubmissions / stats.targetSubmissions) * 100)) 
    : 0;

  const staffParticipationPercentage = stats.activeEmployees > 0
    ? Math.round(((stats.completedEmpCount + stats.inProgressEmpCount) / stats.activeEmployees) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* TOP DASHBOARD CONTROL BAR */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '20px 24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
              Performance & Outreach Metrics
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '9999px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              Live Sync
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, fontWeight: 500 }}>
            Real-time analytics across 25 AP Parliament & 175 Assembly Constituencies
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Date Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '9999px',
            padding: '6px 14px'
          }}>
            <Calendar size={15} style={{ color: '#6b7280' }} />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '13px',
                fontWeight: 700,
                color: '#111827',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Task Selector Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '9999px',
            padding: '6px 14px'
          }}>
            <Target size={15} style={{ color: '#6b7280' }} />
            <select
              value={effectiveTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '13px',
                fontWeight: 700,
                color: '#111827',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {allTasks.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.platform})</option>
              ))}
            </select>
          </div>

          {/* Parliament Selector Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '9999px',
            padding: '6px 14px'
          }}>
            <Building2 size={15} style={{ color: '#6b7280' }} />
            <select
              value={parliamentFilter}
              onChange={(e) => setParliamentFilter(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '13px',
                fontWeight: 700,
                color: '#111827',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All 25 Parliaments</option>
              {AP_CONSTITUENCIES.map(p => (
                <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Refresh Metrics"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
              color: '#374151',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 4 PRIMARY KPI CARDS GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px'
      }}>
        {/* Card 1: Verified Submissions & Daily Target */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '22px 24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>Verified Submissions</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <CheckCircle2 size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#065f46', letterSpacing: '-0.03em' }}>
              {stats.validSubmissions.toLocaleString()}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af' }}>
              / {stats.targetSubmissions.toLocaleString()} Target
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#047857', marginBottom: '4px' }}>
              <span>Target Achievement</span>
              <span>{targetCompletionPercentage}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{
                width: `${targetCompletionPercentage}%`,
                height: '100%',
                backgroundColor: '#10b981',
                borderRadius: '9999px',
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        </div>

        {/* Card 2: Staff Participation */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '22px 24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>Active Staff Engagement</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Users size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#1e40af', letterSpacing: '-0.03em' }}>
              {stats.completedEmpCount + stats.inProgressEmpCount}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af' }}>
              / {stats.activeEmployees} Active Staff
            </span>
          </div>

          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#1d4ed8', marginBottom: '4px' }}>
              <span>Participation Rate</span>
              <span>{staffParticipationPercentage}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{
                width: `${staffParticipationPercentage}%`,
                height: '100%',
                backgroundColor: '#3b82f6',
                borderRadius: '9999px',
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        </div>

        {/* Card 3: Duplicates Intercepted */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '22px 24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>Duplicates Intercepted</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <ShieldCheck size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: '#c2410c', letterSpacing: '-0.03em' }}>
              {stats.duplicates}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af' }}>
              Attempts Blocked
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#d97706', marginTop: '12px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            Cross-Staff & Repeat Filter Active
          </div>
        </div>

        {/* Card 4: Active Campaign Info */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '22px 24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>Active Campaign</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
              <Target size={22} />
            </div>
          </div>
          <div style={{ marginBottom: '6px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeTask?.name || 'Instagram Follower Outreach'}
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '9999px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fde047'
            }}>
              {activeTask?.platform || 'Instagram'}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
              Target: {activeTask?.dailyTarget || 10} / Staff
            </span>
          </div>
        </div>
      </div>

      {/* INTERACTIVE ANDHRA PRADESH SVG MAP & HOVER TOOLTIP */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        position: 'relative'
      }}>
        {/* Map Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={22} style={{ color: '#059669' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
                Interactive AP Parliament Constituency Map
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 10px',
                borderRadius: '9999px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0'
              }}>
                Hover for Live Status
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0', fontWeight: 500 }}>
              Hover over any constituency node on the AP map to view real-time task progress, target achievement, and staff engagement. Click to jump to directory.
            </p>
          </div>

          {/* Map Search / Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#f9fafb',
              border: '1px solid #d1d5db',
              borderRadius: '9999px',
              padding: '6px 14px',
              width: '220px'
            }}>
              <Search size={14} style={{ color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Highlight constituency..."
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '12px',
                  outline: 'none',
                  width: '100%',
                  fontWeight: 600,
                  color: '#111827'
                }}
              />
            </div>

            {/* Status Color Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#047857' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                &ge; 80% Done
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                40 - 79%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b91c1c' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                &lt; 40%
              </span>
            </div>
          </div>
        </div>

        {/* SVG Map Display Canvas */}
        <div style={{
          position: 'relative',
          width: '100%',
          backgroundColor: '#0f172a',
          borderRadius: '20px',
          overflow: 'hidden',
          border: '1px solid #1e293b',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
          padding: '12px',
          boxSizing: 'border-box'
        }}>
          {/* Inner Aspect Ratio Container locked to AP SVG map aspect ratio (7161 / 3745) */}
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '7161 / 3745',
            margin: '0 auto'
          }}>
            {/* SVG Map Image */}
            <img 
              src="/images/ap.svg" 
              alt="Andhra Pradesh Interactive Map" 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                opacity: 0.9,
                filter: 'brightness(1.1) contrast(1.15) drop-shadow(0 0 15px rgba(59, 130, 246, 0.25))',
                pointerEvents: 'none',
                userSelect: 'none'
              }}
            />

            {/* Interactive Pins Overlay across 25 AP Parliaments */}
            {rawParliamentPerformance.map(p => {
              const coords = PARLIAMENT_MAP_COORDS[p.code] || { top: '50%', left: '50%', num: '', region: 'AP' };
              const isMatch = mapSearchQuery && (p.name.toLowerCase().includes(mapSearchQuery.toLowerCase()) || p.code.toLowerCase().includes(mapSearchQuery.toLowerCase()));
              const isHovered = hoveredMapParliament?.code === p.code;
              const isHighlighted = isHovered || isMatch;
              const statusColor = p.completionRate >= 80 ? '#10b981' : p.completionRate >= 40 ? '#f59e0b' : '#ef4444';
              const statusGlow = p.completionRate >= 80 ? 'rgba(16, 185, 129, 0.65)' : p.completionRate >= 40 ? 'rgba(245, 158, 11, 0.65)' : 'rgba(239, 68, 68, 0.65)';

              return (
                <div
                  key={p.code}
                  onClick={() => {
                    setParliamentFilter(p.code);
                    setCollapsedParliaments(prev => ({ ...prev, [p.code]: false }));
                    const el = document.getElementById(`parliament-group-${p.code}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  onMouseEnter={() => setHoveredMapParliament(p)}
                  onMouseLeave={() => setHoveredMapParliament(null)}
                  style={{
                    position: 'absolute',
                    top: coords.top,
                    left: coords.left,
                    transform: isHighlighted ? 'translate(-50%, -50%) scale(1.35)' : 'translate(-50%, -50%) scale(1)',
                    zIndex: isHighlighted ? 40 : 20,
                    cursor: 'pointer',
                    opacity: !mapSearchQuery || isMatch ? 1 : 0.25,
                    transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  {/* Glowing Pulse Ring & Pin Center */}
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{
                      position: 'absolute',
                      width: isHighlighted ? '32px' : '24px',
                      height: isHighlighted ? '32px' : '24px',
                      borderRadius: '50%',
                      backgroundColor: statusColor,
                      opacity: 0.35,
                      boxShadow: `0 0 14px ${statusGlow}`
                    }} />

                    {/* Circular Badge Center with Constituency Number */}
                    <div style={{
                      width: isHighlighted ? '24px' : '20px',
                      height: isHighlighted ? '24px' : '20px',
                      borderRadius: '50%',
                      backgroundColor: statusColor,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isHighlighted ? '11px' : '10px',
                      fontWeight: 900,
                      border: '2px solid #ffffff',
                      boxShadow: `0 2px 10px ${statusGlow}`,
                      transition: 'all 0.2s ease'
                    }}>
                      {coords.num}
                    </div>
                  </div>

                  {/* Constituency Name Badge (Visible on Hover or Search Match) */}
                  {isHighlighted && (
                    <div style={{
                      marginTop: '5px',
                      backgroundColor: '#1e293b',
                      color: '#ffffff',
                      border: `1.5px solid ${statusColor}`,
                      padding: '3px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(6px)',
                      letterSpacing: '0.01em',
                      animation: 'fadeIn 0.15s ease-out'
                    }}>
                      {p.name} (#{coords.num})
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DYNAMIC FLOATING HOVER TOOLTIP CARD */}
          {hoveredMapParliament && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              width: '320px',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '18px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.05)',
              zIndex: 50,
              pointerEvents: 'none'
            }}>
              {/* Tooltip Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 900, color: '#111827', margin: 0 }}>
                      {hoveredMapParliament.name}
                    </h4>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '4px' }}>
                      {hoveredMapParliament.code}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>
                    {PARLIAMENT_MAP_COORDS[hoveredMapParliament.code]?.region || 'Andhra Pradesh'} • {hoveredMapParliament.totalStaff} Staff Members
                  </span>
                </div>

                <span style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: hoveredMapParliament.completionRate >= 80 ? '#ecfdf5' : hoveredMapParliament.completionRate >= 40 ? '#fef3c7' : '#fef2f2',
                  color: hoveredMapParliament.completionRate >= 80 ? '#047857' : hoveredMapParliament.completionRate >= 40 ? '#b45309' : '#b91c1c',
                  border: `1px solid ${hoveredMapParliament.completionRate >= 80 ? '#a7f3d0' : hoveredMapParliament.completionRate >= 40 ? '#fde047' : '#fecdd3'}`
                }}>
                  {hoveredMapParliament.completionRate >= 80 ? 'High Performing' : hoveredMapParliament.completionRate >= 40 ? 'Moderate' : 'Needs Focus'}
                </span>
              </div>

              {/* Task Title Banner */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: '10px 12px',
                marginBottom: '14px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Campaign Task:</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeTask?.name || 'Instagram Outreach'}
                </span>
              </div>

              {/* Submissions & Progress Bar */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Verified Submissions</span>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                    {hoveredMapParliament.totalValid} <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>/ {hoveredMapParliament.totalTarget} Target</span>
                  </span>
                </div>

                <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${hoveredMapParliament.completionRate}%`,
                    height: '100%',
                    backgroundColor: hoveredMapParliament.completionRate >= 80 ? '#10b981' : hoveredMapParliament.completionRate >= 40 ? '#f59e0b' : '#ef4444',
                    borderRadius: '9999px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Staff Status Breakdown Pills */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <div style={{ backgroundColor: '#ecfdf5', padding: '8px', borderRadius: '10px', textAlign: 'center', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#047857' }}>{hoveredMapParliament.completedStaff}</div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#059669' }}>Completed</div>
                </div>
                <div style={{ backgroundColor: '#fffbeb', padding: '8px', borderRadius: '10px', textAlign: 'center', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#b45309' }}>{hoveredMapParliament.inProgressStaff}</div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#d97706' }}>Active</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#475569' }}>{hoveredMapParliament.notStartedStaff}</div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>Pending</div>
                </div>
              </div>

              {/* Duplicates Intercepted */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: 700,
                color: '#c2410c',
                backgroundColor: '#fff7ed',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid #ffedd5'
              }}>
                <span>Blocked Duplicates:</span>
                <span>{hoveredMapParliament.totalDuplicates} Attempts Flagged</span>
              </div>

              {/* Click prompt footer */}
              <div style={{
                marginTop: '12px',
                paddingTop: '8px',
                borderTop: '1px dashed #e2e8f0',
                textAlign: 'center',
                fontSize: '10px',
                fontWeight: 700,
                color: '#2563eb'
              }}>
                Click pin to filter staff directory for {hoveredMapParliament.name}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STAFF COMPLETION STATUS BREAKDOWN & PIPELINE */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>
              Staff Completion Pipeline Status
            </h3>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0', fontWeight: 500 }}>
              Breakdown of staff progress across all assigned constituencies
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#047857' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#10b981' }} />
              Completed ({stats.completedEmpCount})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#b45309' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#f59e0b' }} />
              In Progress ({stats.inProgressEmpCount})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#4b5563' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#9ca3af' }} />
              Not Started ({stats.notStartedEmpCount})
            </div>
          </div>
        </div>

        {/* Multi-segmented Visual Progress Bar */}
        <div style={{
          display: 'flex',
          height: '16px',
          width: '100%',
          backgroundColor: '#f3f4f6',
          borderRadius: '9999px',
          overflow: 'hidden',
          marginBottom: '8px'
        }}>
          <div 
            style={{
              width: `${(stats.completedEmpCount / (stats.activeEmployees || 1)) * 100}%`,
              backgroundColor: '#10b981',
              transition: 'width 0.5s ease'
            }}
            title={`Completed: ${stats.completedEmpCount}`}
          />
          <div 
            style={{
              width: `${(stats.inProgressEmpCount / (stats.activeEmployees || 1)) * 100}%`,
              backgroundColor: '#f59e0b',
              transition: 'width 0.5s ease'
            }}
            title={`In Progress: ${stats.inProgressEmpCount}`}
          />
          <div 
            style={{
              width: `${(stats.notStartedEmpCount / (stats.activeEmployees || 1)) * 100}%`,
              backgroundColor: '#d1d5db',
              transition: 'width 0.5s ease'
            }}
            title={`Not Started: ${stats.notStartedEmpCount}`}
          />
        </div>
      </div>

      {/* DYNAMIC LEADERBOARD & ALL 25 PARLIAMENTS PERFORMANCE */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        {/* Leaderboard Header & Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={22} style={{ color: '#f59e0b' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
                Parliament Performance Leaderboard
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 10px',
                borderRadius: '9999px',
                backgroundColor: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde047'
              }}>
                {sortedParliaments.length} {leaderboardShowMode === 'ALL' ? 'AP Parliaments Total' : 'Parliaments Displayed'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0', fontWeight: 500 }}>
              Dynamic performance ranking across all 25 AP Parliament Constituencies
            </p>
          </div>

          {/* View Filter & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* View Mode Pills */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#f3f4f6',
              padding: '4px',
              borderRadius: '9999px',
              border: '1px solid #e5e7eb'
            }}>
              {[
                { id: 'ALL', label: 'All 25 Parliaments' },
                { id: 'TOP_5', label: 'Top 5' },
                { id: 'BOTTOM_5', label: 'Bottom 5' },
                { id: 'TOP_10', label: 'Top 10' },
                { id: 'BOTTOM_10', label: 'Bottom 10' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setLeaderboardShowMode(item.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: 'none',
                    backgroundColor: leaderboardShowMode === item.id ? '#18181b' : 'transparent',
                    color: leaderboardShowMode === item.id ? '#ffffff' : '#4b5563',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Sort Toggle Button */}
            <button
              onClick={() => setLeaderboardSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '9999px',
                backgroundColor: leaderboardSortOrder === 'DESC' ? '#ecfdf5' : '#fff1f2',
                color: leaderboardSortOrder === 'DESC' ? '#047857' : '#be123c',
                border: `1px solid ${leaderboardSortOrder === 'DESC' ? '#a7f3d0' : '#fecdd3'}`,
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Toggle Dynamic Sort Order"
            >
              <ArrowUpDown size={14} />
              <span>{leaderboardSortOrder === 'DESC' ? 'Highest Submissions First' : 'Lowest Submissions First'}</span>
            </button>
          </div>
        </div>

        {/* Parliaments Grid (5 Cards Per Row) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: '12px'
        }}>
          {sortedParliaments.map((p, index) => {
            const isTop3 = leaderboardSortOrder === 'DESC' ? index < 3 : index >= sortedParliaments.length - 3;
            const rankNum = leaderboardSortOrder === 'DESC' ? index + 1 : sortedParliaments.length - index;

            const badgeBg = index === 0 && leaderboardSortOrder === 'DESC' ? '#fef3c7' : index === 1 && leaderboardSortOrder === 'DESC' ? '#f3f4f6' : index === 2 && leaderboardSortOrder === 'DESC' ? '#ffedd5' : '#f9fafb';
            const badgeColor = index === 0 && leaderboardSortOrder === 'DESC' ? '#92400e' : index === 1 && leaderboardSortOrder === 'DESC' ? '#374151' : index === 2 && leaderboardSortOrder === 'DESC' ? '#9a3412' : '#6b7280';

            return (
              <div 
                key={p.code}
                style={{
                  backgroundColor: '#fafafa',
                  borderRadius: '16px',
                  border: p.completionRate >= 80 ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: badgeBg,
                      color: badgeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 800,
                      border: '1px solid #e5e7eb',
                      flexShrink: 0
                    }}>
                      #{rankNum}
                    </span>
                    <div style={{ overflow: 'hidden' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </h4>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>
                        {p.code} • {p.totalStaff} Staff
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '14px',
                    fontWeight: 900,
                    color: p.completionRate >= 80 ? '#059669' : p.completionRate >= 40 ? '#d97706' : '#dc2626',
                    flexShrink: 0
                  }}>
                    {p.completionRate}%
                  </span>
                </div>

                {/* Progress bar & Submissions */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4b5563', marginBottom: '4px' }}>
                    <span>Submissions: <strong style={{ color: '#111827' }}>{p.totalValid}</strong></span>
                    <span>Target: <strong>{p.totalTarget}</strong></span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${p.completionRate}%`,
                      height: '100%',
                      backgroundColor: p.completionRate >= 80 ? '#10b981' : p.completionRate >= 40 ? '#f59e0b' : '#ef4444',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Breakdown Mini Badges Without Emojis */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', paddingTop: '4px', borderTop: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#059669', fontWeight: 700 }}>{p.completedStaff} Done</span>
                  <span style={{ color: '#b45309', fontWeight: 700 }}>{p.inProgressStaff} Active</span>
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>{p.notStartedStaff} Pending</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* INDIVIDUAL STAFF OUTREACH PERFORMANCE TRACKER (COLLAPSIBLE BY PARLIAMENT) */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        {/* Table Controls Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
                  Individual Staff Outreach Tracker
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #e5e7eb'
                }}>
                  {filteredEmployees.length} Staff Members Across {groupedParliamentsStaff.length} Parliaments
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0', fontWeight: 500 }}>
                Collapsible directory grouped by Parliamentary Constituency
              </p>
            </div>

            {/* Status Filter Tabs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#f3f4f6',
              padding: '4px',
              borderRadius: '9999px',
              border: '1px solid #e5e7eb'
            }}>
              {['ALL', 'Completed', 'In Progress', 'Not Started'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusTab(tab)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: 'none',
                    backgroundColor: statusTab === tab ? '#ffffff' : 'transparent',
                    color: statusTab === tab ? '#111827' : '#6b7280',
                    boxShadow: statusTab === tab ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar & Global Expand/Collapse Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            {/* Search Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#f9fafb',
              border: '1px solid #d1d5db',
              borderRadius: '9999px',
              padding: '10px 18px',
              width: '100%',
              maxWidth: '480px'
            }}>
              <Search size={16} style={{ color: '#9ca3af' }} />
              <input 
                type="text"
                placeholder="Search staff by name, code (e.g. APP13), or constituency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#111827',
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>

            {/* Expand / Collapse All Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleExpandAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '9999px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <ChevronsDown size={14} />
                <span>Expand All</span>
              </button>

              <button
                onClick={handleCollapseAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '9999px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <ChevronsUp size={14} />
                <span>Collapse All</span>
              </button>
            </div>
          </div>
        </div>

        {/* COLLAPSIBLE PARLIAMENT ACCORDION GROUPS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedParliamentsStaff.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280', fontSize: '14px', backgroundColor: '#fafafa', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
              No staff members match the selected filters or search query.
            </div>
          ) : (
            groupedParliamentsStaff.map(group => {
              const isCollapsed = searchQuery.trim() !== '' ? false : Boolean(collapsedParliaments[group.code]);

              return (
                <div 
                  key={group.code}
                  style={{
                    backgroundColor: '#fafafa',
                    borderRadius: '16px',
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Parliament Accordion Header */}
                  <div
                    onClick={() => toggleParliamentCollapse(group.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      borderBottom: isCollapsed ? 'none' : '1px solid #e5e7eb',
                      userSelect: 'none',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4b5563'
                      }}>
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>
                            {group.name} Parliamentary Constituency
                          </h4>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
                            {group.code}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                          {group.staff.length} Staff Members Assigned
                        </span>
                      </div>
                    </div>

                    {/* Summary Metric Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      {/* Submissions & Target */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>
                          {group.totalValid} / {group.totalTarget} Submissions
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: group.completionRate >= 80 ? '#059669' : group.completionRate >= 40 ? '#d97706' : '#dc2626' }}>
                          {group.completionRate}% Target Completion
                        </div>
                      </div>

                      {/* Status Breakdown Pills */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {group.completedCount > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '9999px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                            {group.completedCount} Done
                          </span>
                        )}
                        {group.inProgressCount > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '9999px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                            {group.inProgressCount} Active
                          </span>
                        )}
                        {group.notStartedCount > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px', backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}>
                            {group.notStartedCount} Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Table Content (Renders when Expanded) */}
                  {!isCollapsed && (
                    <div style={{ overflowX: 'auto', backgroundColor: '#ffffff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', color: '#4b5563', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <th 
                              onClick={() => handleHeaderSort('name')}
                              style={{ padding: '12px 16px', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>Staff Member</span>
                                <ArrowUpDown size={12} style={{ color: tableSortField === 'name' ? '#111827' : '#9ca3af' }} />
                              </div>
                            </th>
                            <th 
                              onClick={() => handleHeaderSort('constituency')}
                              style={{ padding: '12px 16px', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>Constituency Segment</span>
                                <ArrowUpDown size={12} style={{ color: tableSortField === 'constituency' ? '#111827' : '#9ca3af' }} />
                              </div>
                            </th>
                            <th 
                              onClick={() => handleHeaderSort('valid')}
                              style={{ padding: '12px 16px', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>Submissions</span>
                                <ArrowUpDown size={12} style={{ color: tableSortField === 'valid' ? '#111827' : '#9ca3af' }} />
                              </div>
                            </th>
                            <th style={{ padding: '12px 16px', fontWeight: 800 }}>Target Progress</th>
                            <th 
                              onClick={() => handleHeaderSort('duplicate')}
                              style={{ padding: '12px 16px', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>Duplicates Flagged</span>
                                <ArrowUpDown size={12} style={{ color: tableSortField === 'duplicate' ? '#111827' : '#9ca3af' }} />
                              </div>
                            </th>
                            <th 
                              onClick={() => handleHeaderSort('status')}
                              style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                <span>Status</span>
                                <ArrowUpDown size={12} style={{ color: tableSortField === 'status' ? '#111827' : '#9ca3af' }} />
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.staff.map((emp) => {
                            const percent = Math.min(100, Math.round(((emp.valid || 0) / (emp.target || 10)) * 100));

                            let statusBg = '#f3f4f6';
                            let statusColor = '#4b5563';
                            let statusBorder = '#e5e7eb';

                            if (emp.status === 'Completed') {
                              statusBg = '#ecfdf5';
                              statusColor = '#047857';
                              statusBorder = '#a7f3d0';
                            } else if (emp.status === 'In Progress') {
                              statusBg = '#fffbeb';
                              statusColor = '#b45309';
                              statusBorder = '#fde68a';
                            }

                            return (
                              <tr 
                                key={emp.id}
                                style={{
                                  borderBottom: '1px solid #f3f4f6',
                                  transition: 'background-color 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {/* Staff info */}
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      backgroundColor: '#18181b',
                                      color: '#facc15',
                                      fontWeight: 800,
                                      fontSize: '12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      {emp.name.charAt(0)}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 800, color: '#111827' }}>{emp.name}</div>
                                      <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#6b7280' }}>{emp.id}</div>
                                    </div>
                                  </div>
                                </td>

                                {/* Constituency Segment */}
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ fontWeight: 600, color: '#374151' }}>
                                    {emp.assemblyName ? `${emp.assemblyName} Segment` : `${emp.parliamentName || group.name} Parliament`}
                                  </div>
                                  <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
                                    {emp.level || 'Parliament'} Level
                                  </span>
                                </td>

                                {/* Valid Count */}
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>
                                    {emp.valid || 0}
                                  </span>
                                  <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}> / {emp.target || 10}</span>
                                </td>

                                {/* Progress Bar */}
                                <td style={{ padding: '12px 16px', width: '160px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ flex: 1, height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${percent}%`,
                                        height: '100%',
                                        backgroundColor: percent >= 100 ? '#10b981' : percent > 0 ? '#f59e0b' : '#9ca3af',
                                        borderRadius: '9999px'
                                      }} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#4b5563', width: '32px' }}>{percent}%</span>
                                  </div>
                                </td>

                                {/* Duplicates */}
                                <td style={{ padding: '12px 16px' }}>
                                  {emp.duplicate > 0 ? (
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #fca5a5' }}>
                                      {emp.duplicate} Flagged
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>0 Clean</span>
                                  )}
                                </td>

                                {/* Status Badge */}
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '3px 10px',
                                    borderRadius: '9999px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    backgroundColor: statusBg,
                                    color: statusColor,
                                    border: `1px solid ${statusBorder}`
                                  }}>
                                    {emp.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
