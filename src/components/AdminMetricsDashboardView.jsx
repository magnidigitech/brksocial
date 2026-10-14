import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Users, CheckCircle2, ShieldCheck, Target, Search, RefreshCw, 
  Award, Calendar, MapPin, Building2, Activity, Sparkles, 
  BarChart3, ChevronDown, ChevronUp, Filter, AlertCircle, ArrowUpRight, TrendingUp,
  ArrowUpDown, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp,
  X, CheckSquare, Square, Check, Copy, Link2
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
  
  // Real-Time Live AJAX Refresh Trigger (must be initialized before useMemo dependencies)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Multi-Select vs Normal Dropdown Mode State
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedParliaments, setSelectedParliaments] = useState(['ALL']);
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const [multiSelectSearchQuery, setMultiSelectSearchQuery] = useState('');
  const multiSelectRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('ALL'); // 'ALL', 'Completed', 'In Progress', 'Not Started'
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Close multi-select dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (multiSelectRef.current && !multiSelectRef.current.contains(e.target)) {
        setIsMultiSelectOpen(false);
      }
    };
    if (isMultiSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMultiSelectOpen]);

  // Interactive Map State
  const [hoveredMapParliament, setHoveredMapParliament] = useState(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  // Leaderboard Controls
  const [leaderboardShowMode, setLeaderboardShowMode] = useState('ALL'); // 'ALL', 'TOP_5', 'BOTTOM_5', 'TOP_10', 'BOTTOM_10'
  const [leaderboardSortOrder, setLeaderboardSortOrder] = useState('DESC'); // 'DESC' (Highest first), 'ASC' (Lowest first)

  // Selected Task Campaign Filter State
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [copiedStaffToken, setCopiedStaffToken] = useState(null);

  const staffClickMap = useMemo(() => {
    const analytics = dbService.getLinkAnalytics({ taskId: selectedTaskId || null, date: selectedDate || null });
    const map = {};
    (analytics.staffLeaderboard || []).forEach(item => {
      const id = item.employeeId || item.employee?.id;
      if (id) {
        map[id] = item;
        map[id.toUpperCase()] = item;
      }
    });
    return map;
  }, [selectedTaskId, selectedDate, refreshTrigger]);

  const handleCopyStaffTrackingLink = (empId) => {
    const link = dbService.getTrackingLinkForEmployee(selectedTaskId || 'TASK-INSTA-001', empId);
    if (!link) return;
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://social.bhashyamramakrishna.in';
    const slug = link.slug || link.urlSlug || 'go';
    const url = `${origin}/${slug}/${link.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedStaffToken(link.token);
      setTimeout(() => setCopiedStaffToken(null), 2000);
    });
  };

  // Collapsible Parliaments State for Staff Outreach Tracker
  const [collapsedParliaments, setCollapsedParliaments] = useState(() => {
    const map = {};
    AP_CONSTITUENCIES.forEach(p => {
      map[p.code] = true; // Default: collapsed
    });
    return map;
  });

  useEffect(() => {
    const handleSubmissionEvent = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    const handleStorageEvent = (e) => {
      if (!e.key || e.key.includes('brk_')) {
        setRefreshTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('brk_submission_event', handleSubmissionEvent);
    window.addEventListener('brk_link_click_event', handleSubmissionEvent);
    window.addEventListener('storage', handleStorageEvent);

    // Live sync polling every 2.5 seconds: pulls server clicks & refreshes UI
    const interval = setInterval(() => {
      dbService.syncClicksWithServer().then(() => {
        setRefreshTrigger(prev => prev + 1);
      }).catch(() => {
        setRefreshTrigger(prev => prev + 1);
      });
    }, 2500);

    return () => {
      window.removeEventListener('brk_submission_event', handleSubmissionEvent);
      window.removeEventListener('brk_link_click_event', handleSubmissionEvent);
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(interval);
    };
  }, []);

  // Column Sorting for Staff Table
  const [tableSortField, setTableSortField] = useState('valid'); // 'name', 'id', 'constituency', 'valid', 'target', 'duplicate', 'status'
  const [tableSortDirection, setTableSortDirection] = useState('desc'); // 'asc' or 'desc'

  // Helper: Is all parliaments selected?
  const isAllSelected = useMemo(() => {
    if (!isMultiSelect) {
      return selectedParliaments.length === 0 || selectedParliaments.includes('ALL');
    }
    return selectedParliaments.length === 0 || 
      selectedParliaments.includes('ALL') || 
      selectedParliaments.length === AP_CONSTITUENCIES.length;
  }, [isMultiSelect, selectedParliaments]);

  // Set of actively selected parliament codes when filtered
  const activeParliamentCodes = useMemo(() => {
    if (isAllSelected) return null;
    return new Set(selectedParliaments.filter(c => c !== 'ALL'));
  }, [isAllSelected, selectedParliaments]);

  // Multi-select toggle helpers
  const toggleParliamentInMultiSelect = (code) => {
    setSelectedParliaments(prev => {
      const isCurrentlyAll = prev.length === 0 || prev.includes('ALL') || prev.length === AP_CONSTITUENCIES.length;
      if (isCurrentlyAll) {
        const allCodes = AP_CONSTITUENCIES.map(p => p.code);
        return allCodes.filter(c => c !== code);
      }
      if (prev.includes(code)) {
        const next = prev.filter(c => c !== code);
        return next;
      } else {
        const next = [...prev, code];
        if (next.length === AP_CONSTITUENCIES.length) {
          return ['ALL'];
        }
        return next;
      }
    });
  };

  // Filter constituencies for multi-select dropdown search
  const filteredConstituenciesForMulti = useMemo(() => {
    if (!multiSelectSearchQuery.trim()) return AP_CONSTITUENCIES;
    const q = multiSelectSearchQuery.toLowerCase().trim();
    return AP_CONSTITUENCIES.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.code.toLowerCase().includes(q)
    );
  }, [multiSelectSearchQuery]);

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

  // Fetch Raw Dashboard Stats from dbService across all staff
  const rawStats = useMemo(() => {
    return dbService.getAdminDashboardOverview(selectedDate, effectiveTaskId);
  }, [selectedDate, effectiveTaskId, isRefreshing, refreshTrigger]);

  // Dynamically compute Filtered KPI Stats based on Parliament Selection
  const stats = useMemo(() => {
    const list = rawStats.employeeProgressList || [];

    // If All 25 Parliaments selected, use the global rawStats
    if (isAllSelected || !activeParliamentCodes || activeParliamentCodes.size === 0) {
      return rawStats;
    }

    // Filter staff members belonging ONLY to the selected parliament(s)
    const filteredStaff = list.filter(emp => {
      const code = emp.parliamentCode || (emp.id?.startsWith('APP') ? emp.id.substring(0, 5) : null);
      return code && activeParliamentCodes.has(code);
    });

    const activeEmployees = filteredStaff.length;
    const dailyTarget = rawStats.selectedTask?.dailyTarget || 10;
    const targetSubmissions = filteredStaff.reduce((acc, curr) => acc + (curr.target || dailyTarget), 0);
    const validSubmissions = filteredStaff.reduce((acc, curr) => acc + (curr.valid || 0), 0);
    const duplicates = filteredStaff.reduce((acc, curr) => acc + (curr.duplicate || 0), 0);
    const remaining = Math.max(0, targetSubmissions - validSubmissions);

    const completedEmpCount = filteredStaff.filter(e => e.status === 'Completed').length;
    const inProgressEmpCount = filteredStaff.filter(e => e.status === 'In Progress').length;
    const notStartedEmpCount = filteredStaff.filter(e => e.status === 'Not Started').length;

    return {
      ...rawStats,
      activeEmployees,
      targetSubmissions,
      validSubmissions,
      duplicates,
      remaining,
      completedEmpCount,
      inProgressEmpCount,
      notStartedEmpCount,
      employeeProgressList: rawStats.employeeProgressList
    };
  }, [rawStats, isAllSelected, activeParliamentCodes]);

  // Fetch Active Task
  const activeTask = useMemo(() => {
    return dbService.getTaskById(effectiveTaskId) || dbService.getActiveTask();
  }, [effectiveTaskId, isRefreshing, refreshTrigger]);

  // Calculate Parliament-level Performance Breakdown across ALL 25 Parliaments
  const rawParliamentPerformance = useMemo(() => {
    const list = rawStats.employeeProgressList || [];
    
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
  }, [rawStats]);

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
    let list = rawStats.employeeProgressList || [];

    if (!isAllSelected && activeParliamentCodes && activeParliamentCodes.size > 0) {
      list = list.filter(e => {
        const code = e.parliamentCode || (e.id?.startsWith('APP') ? e.id.substring(0, 5) : null);
        return code && activeParliamentCodes.has(code);
      });
    }

    if (statusTab !== 'ALL') {
      list = list.filter(e => e.status === statusTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(e => 
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.supportCode && e.supportCode.toLowerCase().includes(q)) ||
        (e.staffId && e.staffId.toLowerCase().includes(q)) ||
        (e.mobile && e.mobile.includes(q)) ||
        (e.mobilePersonal && e.mobilePersonal.includes(q)) ||
        (e.parliamentName && e.parliamentName.toLowerCase().includes(q)) ||
        (e.assemblyName && e.assemblyName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [rawStats, isAllSelected, activeParliamentCodes, statusTab, searchQuery]);

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
      if (!isAllSelected || searchQuery.trim() || statusTab !== 'ALL') {
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
  }, [filteredEmployees, isAllSelected, searchQuery, statusTab, tableSortField, tableSortDirection]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* TOP DASHBOARD CONTROL BAR */}
      <div className="dashboard-section-card" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.025em' }}>
              Performance & Outreach Metrics
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '980px',
              backgroundColor: 'rgba(52, 199, 89, 0.1)',
              color: '#34c759',
              border: '1px solid rgba(52, 199, 89, 0.2)'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34c759' }} />
              Live Sync
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#86868b', margin: 0, fontWeight: 400 }}>
            Real-time analytics across 25 AP Parliament & 175 Assembly Constituencies
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '100%', justifyContent: 'flex-start' }}>
          {/* Date Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(118, 118, 128, 0.08)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            borderRadius: '980px',
            padding: '5px 12px',
            flex: '1 1 auto',
            minWidth: '140px'
          }}>
            <Calendar size={14} style={{ color: '#86868b', flexShrink: 0 }} />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1d1d1f',
                outline: 'none',
                cursor: 'pointer',
                width: '100%'
              }}
            />
          </div>

          {/* Task Selector Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(118, 118, 128, 0.08)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            borderRadius: '980px',
            padding: '5px 12px',
            flex: '2 1 200px',
            minWidth: '180px'
          }}>
            <Target size={14} style={{ color: '#86868b', flexShrink: 0 }} />
            <select
              value={effectiveTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1d1d1f',
                outline: 'none',
                cursor: 'pointer',
                width: '100%',
                textOverflow: 'ellipsis'
              }}
            >
              {allTasks.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.platform})</option>
              ))}
            </select>
          </div>

          {/* Parliament Selector Filter with Single/Multi Mode Toggle */}
          <div 
            ref={multiSelectRef}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(118, 118, 128, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              borderRadius: '980px',
              padding: '4px 6px 4px 12px',
              flex: '2 1 240px',
              minWidth: '220px'
            }}
          >
            <Building2 size={14} style={{ color: '#86868b', flexShrink: 0 }} />

            {/* Mode 1: Normal Single Dropdown */}
            {!isMultiSelect ? (
              <select
                value={isAllSelected ? 'ALL' : (selectedParliaments[0] || 'ALL')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL') {
                    setSelectedParliaments(['ALL']);
                  } else {
                    setSelectedParliaments([val]);
                    setCollapsedParliaments(prev => ({ ...prev, [val]: false }));
                    const el = document.getElementById(`parliament-group-${val}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
                }}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1d1d1f',
                  outline: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textOverflow: 'ellipsis'
                }}
              >
                <option value="ALL">All 25 Parliaments</option>
                {AP_CONSTITUENCIES.map(p => (
                  <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                ))}
              </select>
            ) : (
              /* Mode 2: Multi-Select Dropdown Trigger */
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => setIsMultiSelectOpen(prev => !prev)}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#1d1d1f',
                    cursor: 'pointer',
                    padding: '2px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left'
                  }}
                >
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingRight: '4px'
                  }}>
                    {isAllSelected
                      ? 'All 25 Parliaments'
                      : selectedParliaments.length === 0
                        ? 'Select Parliaments...'
                        : selectedParliaments.length === 1
                          ? `${AP_CONSTITUENCIES.find(p => p.code === selectedParliaments[0])?.name || selectedParliaments[0]} (1)`
                          : `${selectedParliaments.length} Parliaments Selected`}
                  </span>
                  <ChevronDown size={13} style={{ color: '#86868b', flexShrink: 0, transform: isMultiSelectOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                </button>
              </div>
            )}

            {/* Apple Segmented Mode Switch: Single | Multi */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'rgba(118, 118, 128, 0.12)',
              borderRadius: '980px',
              padding: '2px',
              flexShrink: 0
            }}>
              <button
                type="button"
                onClick={() => {
                  if (isMultiSelect) {
                    setIsMultiSelect(false);
                    setIsMultiSelectOpen(false);
                    if (selectedParliaments.length === 1 && selectedParliaments[0] !== 'ALL') {
                      setSelectedParliaments([selectedParliaments[0]]);
                    } else {
                      setSelectedParliaments(['ALL']);
                    }
                  }
                }}
                title="Normal Single-Select Dropdown"
                style={{
                  border: 'none',
                  borderRadius: '980px',
                  padding: '3px 9px',
                  fontSize: '10.5px',
                  fontWeight: !isMultiSelect ? 600 : 500,
                  cursor: 'pointer',
                  backgroundColor: !isMultiSelect ? '#ffffff' : 'transparent',
                  color: !isMultiSelect ? '#1d1d1f' : '#86868b',
                  boxShadow: !isMultiSelect ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isMultiSelect) {
                    setIsMultiSelect(true);
                    setIsMultiSelectOpen(true);
                    if (selectedParliaments.length === 1 && selectedParliaments[0] !== 'ALL') {
                      setSelectedParliaments([selectedParliaments[0]]);
                    } else {
                      setSelectedParliaments(['ALL']);
                    }
                  }
                }}
                title="Multi-Select Mode with Checkboxes"
                style={{
                  border: 'none',
                  borderRadius: '980px',
                  padding: '3px 9px',
                  fontSize: '10.5px',
                  fontWeight: isMultiSelect ? 600 : 500,
                  cursor: 'pointer',
                  backgroundColor: isMultiSelect ? '#ffffff' : 'transparent',
                  color: isMultiSelect ? '#1d1d1f' : '#86868b',
                  boxShadow: isMultiSelect ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Multi
              </button>
            </div>

            {/* Multi-Select Floating Dropdown Popover */}
            {isMultiSelect && isMultiSelectOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '320px',
                  maxWidth: '90vw',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
                  zIndex: 100,
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* Search Constituency Input */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(118, 118, 128, 0.08)',
                  borderRadius: '10px',
                  padding: '6px 10px'
                }}>
                  <Search size={13} style={{ color: '#86868b' }} />
                  <input
                    type="text"
                    placeholder="Search parliament..."
                    value={multiSelectSearchQuery}
                    onChange={(e) => setMultiSelectSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#1d1d1f',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                  {multiSelectSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMultiSelectSearchQuery('')}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={12} style={{ color: '#86868b' }} />
                    </button>
                  )}
                </div>

                {/* Quick Selection Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', padding: '0 2px' }}>
                  <span style={{ fontWeight: 600, color: '#86868b' }}>
                    {isAllSelected ? 'All 25 Selected' : `${selectedParliaments.length} of 25 Selected`}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedParliaments(['ALL'])}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#0071e3',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Select All
                    </button>
                    <span style={{ color: '#d1d5db' }}>|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedParliaments([])}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#ff3b30',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Parliaments Checkboxes List */}
                <div 
                  className="no-scrollbar"
                  style={{
                    maxHeight: '230px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  {filteredConstituenciesForMulti.map(p => {
                    const isChecked = isAllSelected || selectedParliaments.includes(p.code);
                    const pStaff = rawStats.employeeProgressList?.filter(e => e.parliamentCode === p.code) || [];

                    return (
                      <div
                        key={p.code}
                        onClick={() => toggleParliamentInMultiSelect(p.code)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          backgroundColor: isChecked ? 'rgba(0, 113, 227, 0.08)' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isChecked) e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isChecked) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            border: isChecked ? 'none' : '1.5px solid rgba(0, 0, 0, 0.2)',
                            backgroundColor: isChecked ? '#0071e3' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isChecked && <Check size={11} color="#ffffff" strokeWidth={3} />}
                          </div>

                          <span style={{
                            fontSize: '12px',
                            fontWeight: isChecked ? 600 : 400,
                            color: isChecked ? '#0071e3' : '#1d1d1f',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {p.name}
                          </span>

                          <span style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            color: '#86868b',
                            backgroundColor: 'rgba(118, 118, 128, 0.08)',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            {p.code}
                          </span>
                        </div>

                        <span style={{ fontSize: '10px', fontWeight: 500, color: '#86868b', flexShrink: 0 }}>
                          {pStaff.length} Staff
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Done Button */}
                <button
                  type="button"
                  onClick={() => setIsMultiSelectOpen(false)}
                  style={{
                    marginTop: '4px',
                    padding: '8px 12px',
                    backgroundColor: '#0071e3',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '980px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'opacity 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Done ({isAllSelected ? 'All 25' : selectedParliaments.length} Selected)
                </button>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Refresh Metrics"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(118, 118, 128, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
              color: '#1d1d1f',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* FILTER ACTIVE STATUS BANNER */}
      {!isAllSelected && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 113, 227, 0.06)',
          border: '1px solid rgba(0, 113, 227, 0.15)',
          borderRadius: '14px',
          padding: '10px 16px',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Filter size={14} style={{ color: '#0071e3', flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0071e3' }}>
              Filtered to {activeParliamentCodes?.size || 0} Parliamentary {activeParliamentCodes?.size === 1 ? 'Constituency' : 'Constituencies'}:
            </span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {Array.from(activeParliamentCodes || []).slice(0, 4).map(code => {
                const name = AP_CONSTITUENCIES.find(p => p.code === code)?.name || code;
                return (
                  <span 
                    key={code}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(0, 113, 227, 0.1)',
                      color: '#0071e3',
                      padding: '2px 8px',
                      borderRadius: '980px',
                      border: 'none'
                    }}
                  >
                    {name} ({code})
                  </span>
                );
              })}
              {(activeParliamentCodes?.size || 0) > 4 && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#0071e3', alignSelf: 'center' }}>
                  +{activeParliamentCodes.size - 4} more
                </span>
              )}
            </div>
            <span style={{ fontSize: '11.5px', fontWeight: 400, color: '#86868b' }}>
              • {stats.activeEmployees} Active Staff • {stats.targetSubmissions.toLocaleString()} Target Submissions
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedParliaments(['ALL'])}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#ffffff',
              border: '1px solid rgba(0, 113, 227, 0.25)',
              color: '#0071e3',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '980px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <X size={12} />
            <span>Show All 25 Parliaments</span>
          </button>
        </div>
      )}

      {/* 4 PRIMARY KPI CARDS GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px'
      }}>
        {/* Card 1: Verified Submissions & Daily Target */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          padding: '18px 20px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#86868b' }}>Verified Submissions</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'rgba(52, 199, 89, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34c759' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em' }}>
              {stats.validSubmissions.toLocaleString()}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#86868b' }}>
              / {stats.targetSubmissions.toLocaleString()} Target
            </span>
          </div>

          {/* Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#34c759', marginBottom: '4px' }}>
              <span>Target Achievement</span>
              <span>{targetCompletionPercentage}%</span>
            </div>
            <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: '980px', overflow: 'hidden' }}>
              <div style={{
                width: `${targetCompletionPercentage}%`,
                height: '100%',
                backgroundColor: '#34c759',
                borderRadius: '980px',
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        </div>

        {/* Card 2: Staff Participation */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          padding: '18px 20px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#86868b' }}>Active Staff Engagement</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'rgba(0, 113, 227, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0071e3' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em' }}>
              {stats.completedEmpCount + stats.inProgressEmpCount}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#86868b' }}>
              / {stats.activeEmployees} Active Staff
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#0071e3', marginBottom: '4px' }}>
              <span>Participation Rate</span>
              <span>{staffParticipationPercentage}%</span>
            </div>
            <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: '980px', overflow: 'hidden' }}>
              <div style={{
                width: `${staffParticipationPercentage}%`,
                height: '100%',
                backgroundColor: '#0071e3',
                borderRadius: '980px',
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        </div>

        {/* Card 3: Duplicates Intercepted */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          padding: '18px 20px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#86868b' }}>Duplicates Intercepted</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'rgba(255, 149, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9500' }}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em' }}>
              {stats.duplicates}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#86868b' }}>
              Attempts Blocked
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#ff9500', marginTop: '10px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ff9500', flexShrink: 0 }} />
            <span>Cross-Staff Filter Active</span>
          </div>
        </div>

        {/* Card 4: Active Campaign Info */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          padding: '18px 20px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#86868b' }}>Active Campaign</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'rgba(175, 82, 222, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#af52de' }}>
              <Target size={16} />
            </div>
          </div>
          <div style={{ marginBottom: '6px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>
              {activeTask?.name || 'Instagram Follower Outreach'}
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '980px',
              backgroundColor: 'rgba(0, 113, 227, 0.08)',
              color: '#0071e3',
              border: '1px solid rgba(0, 113, 227, 0.15)'
            }}>
              {activeTask?.platform || 'Instagram'}
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 400, color: '#86868b' }}>
              Target: {activeTask?.dailyTarget || 10} / Staff
            </span>
          </div>
        </div>
      </div>

      {/* INTERACTIVE ANDHRA PRADESH SVG MAP & HOVER TOOLTIP */}
      <div className="dashboard-section-card" style={{ position: 'relative' }}>
        {/* Map Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <MapPin size={18} style={{ color: '#34c759', flexShrink: 0 }} />
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                Interactive AP Parliament Constituency Map
              </h3>
              <span style={{
                fontSize: '10.5px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '980px',
                backgroundColor: 'rgba(52, 199, 89, 0.1)',
                color: '#34c759',
                border: '1px solid rgba(52, 199, 89, 0.2)'
              }}>
                Live Map
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0', fontWeight: 400 }}>
              Tap or hover any constituency node on the AP map to view live progress.
            </p>
          </div>

          {/* Map Search / Filter & Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%', smWidth: 'auto', justifyContent: 'space-between' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(118, 118, 128, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              borderRadius: '980px',
              padding: '5px 12px',
              flex: '1 1 180px',
              maxWidth: '280px'
            }}>
              <Search size={13} style={{ color: '#86868b' }} />
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
                  fontWeight: 500,
                  color: '#1d1d1f'
                }}
              />
            </div>

            {/* Status Color Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 600, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34c759' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#34c759' }} />
                &ge; 80%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ff9500' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ff9500' }} />
                40 - 79%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ff3b30' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ff3b30' }} />
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
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid #1e293b',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
          padding: '8px',
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
              const isSelected = isAllSelected || Boolean(activeParliamentCodes?.has(p.code));
              const isHighlighted = isHovered || isMatch || (!isAllSelected && isSelected);
              const statusColor = p.completionRate >= 80 ? '#10b981' : p.completionRate >= 40 ? '#f59e0b' : '#ef4444';
              const statusGlow = p.completionRate >= 80 ? 'rgba(16, 185, 129, 0.65)' : p.completionRate >= 40 ? 'rgba(245, 158, 11, 0.65)' : 'rgba(239, 68, 68, 0.65)';

              // Compute opacity based on search and parliament filter selection
              let pinOpacity = 1;
              if (mapSearchQuery) {
                pinOpacity = isMatch ? 1 : 0.25;
              } else if (!isAllSelected) {
                pinOpacity = isSelected ? 1 : 0.3;
              }

              return (
                <div
                  key={p.code}
                  onClick={() => {
                    setHoveredMapParliament(p);
                    if (isMultiSelect) {
                      toggleParliamentInMultiSelect(p.code);
                    } else {
                      setSelectedParliaments([p.code]);
                    }
                    setCollapsedParliaments(prev => ({ ...prev, [p.code]: false }));
                    const el = document.getElementById(`parliament-group-${p.code}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
                    opacity: pinOpacity,
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
                      width: isHighlighted ? '28px' : '20px',
                      height: isHighlighted ? '28px' : '20px',
                      borderRadius: '50%',
                      backgroundColor: statusColor,
                      opacity: 0.35,
                      boxShadow: `0 0 12px ${statusGlow}`
                    }} />

                    {/* Circular Badge Center with Constituency Number */}
                    <div style={{
                      width: isHighlighted ? '22px' : '18px',
                      height: isHighlighted ? '22px' : '18px',
                      borderRadius: '50%',
                      backgroundColor: statusColor,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isHighlighted ? '10px' : '9px',
                      fontWeight: 900,
                      border: '1.5px solid #ffffff',
                      boxShadow: `0 2px 8px ${statusGlow}`,
                      transition: 'all 0.2s ease'
                    }}>
                      {coords.num}
                    </div>
                  </div>

                  {/* Constituency Name Badge (Visible on Hover or Search Match) */}
                  {isHighlighted && (
                    <div style={{
                      marginTop: '4px',
                      backgroundColor: '#1e293b',
                      color: '#ffffff',
                      border: `1.5px solid ${statusColor}`,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
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

          {/* DYNAMIC FLOATING HOVER TOOLTIP CARD (DESKTOP) */}
          {hoveredMapParliament && (
            <div 
              className="hidden sm:block"
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                width: '300px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.05)',
                zIndex: 50,
                pointerEvents: 'none'
              }}
            >
              {/* Tooltip Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#111827', margin: 0 }}>
                      {hoveredMapParliament.name}
                    </h4>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#6b7280', backgroundColor: '#f3f4f6', padding: '1px 5px', borderRadius: '4px' }}>
                      {hoveredMapParliament.code}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af' }}>
                    {PARLIAMENT_MAP_COORDS[hoveredMapParliament.code]?.region || 'Andhra Pradesh'} • {hoveredMapParliament.totalStaff} Staff
                  </span>
                </div>

                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '9999px',
                  backgroundColor: hoveredMapParliament.completionRate >= 80 ? '#ecfdf5' : hoveredMapParliament.completionRate >= 40 ? '#fef3c7' : '#fef2f2',
                  color: hoveredMapParliament.completionRate >= 80 ? '#047857' : hoveredMapParliament.completionRate >= 40 ? '#b45309' : '#b91c1c',
                  border: `1px solid ${hoveredMapParliament.completionRate >= 80 ? '#a7f3d0' : hoveredMapParliament.completionRate >= 40 ? '#fde047' : '#fecdd3'}`
                }}>
                  {hoveredMapParliament.completionRate}%
                </span>
              </div>

              {/* Submissions & Progress Bar */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Verified Submissions</span>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                    {hoveredMapParliament.totalValid} <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>/ {hoveredMapParliament.totalTarget}</span>
                  </span>
                </div>

                <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
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
                gap: '6px',
                marginBottom: '8px'
              }}>
                <div style={{ backgroundColor: '#ecfdf5', padding: '6px', borderRadius: '8px', textAlign: 'center', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#047857' }}>{hoveredMapParliament.completedStaff}</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#059669' }}>Completed</div>
                </div>
                <div style={{ backgroundColor: '#fffbeb', padding: '6px', borderRadius: '8px', textAlign: 'center', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#b45309' }}>{hoveredMapParliament.inProgressStaff}</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#d97706' }}>Active</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '6px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#475569' }}>{hoveredMapParliament.notStartedStaff}</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b' }}>Pending</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE SELECTED CONSTITUENCY CARD (SHOWN BELOW CANVAS ON MOBILE) */}
        {hoveredMapParliament && (
          <div 
            className="block sm:hidden"
            style={{
              marginTop: '12px',
              backgroundColor: '#f8fafc',
              borderRadius: '14px',
              padding: '12px 14px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#111827' }}>
                  {hoveredMapParliament.name} ({hoveredMapParliament.code})
                </span>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                  {hoveredMapParliament.totalValid} / {hoveredMapParliament.totalTarget} Submissions ({hoveredMapParliament.completionRate}%)
                </div>
              </div>
              <button
                onClick={() => setHoveredMapParliament(null)}
                style={{ fontSize: '11px', color: '#64748b', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#e2e8f0' }}
              >
                Close
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '10px', fontWeight: 700 }}>
              <span style={{ backgroundColor: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
                {hoveredMapParliament.completedStaff} Completed
              </span>
              <span style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #fde68a' }}>
                {hoveredMapParliament.inProgressStaff} Active
              </span>
              <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #cbd5e1' }}>
                {hoveredMapParliament.notStartedStaff} Pending
              </span>
            </div>
          </div>
        )}
      </div>

      {/* STAFF COMPLETION STATUS BREAKDOWN & PIPELINE */}
      <div className="dashboard-section-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
              Staff Completion Pipeline Status
            </h3>
            <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0', fontWeight: 400 }}>
              {isAllSelected 
                ? 'Breakdown of staff progress across all 25 assigned constituencies (200 staff)'
                : `Breakdown of staff progress across ${activeParliamentCodes?.size || 0} selected constituencies (${stats.activeEmployees} staff)`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 600, color: '#34c759' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#34c759' }} />
              Completed ({stats.completedEmpCount})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 600, color: '#ff9500' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ff9500' }} />
              Active ({stats.inProgressEmpCount})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: '#86868b' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'rgba(118, 118, 128, 0.3)' }} />
              Pending ({stats.notStartedEmpCount})
            </div>
          </div>
        </div>

        {/* Multi-segmented Visual Progress Bar */}
        <div style={{
          display: 'flex',
          height: '7px',
          width: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          borderRadius: '980px',
          overflow: 'hidden'
        }}>
          <div 
            style={{
              width: `${(stats.completedEmpCount / (stats.activeEmployees || 1)) * 100}%`,
              backgroundColor: '#34c759',
              transition: 'width 0.5s ease'
            }}
            title={`Completed: ${stats.completedEmpCount}`}
          />
          <div 
            style={{
              width: `${(stats.inProgressEmpCount / (stats.activeEmployees || 1)) * 100}%`,
              backgroundColor: '#ff9500',
              transition: 'width 0.5s ease'
            }}
            title={`In Progress: ${stats.inProgressEmpCount}`}
          />
          <div 
            style={{
              width: `${(stats.notStartedEmpCount / (stats.activeEmployees || 1)) * 100}%`,
              backgroundColor: 'rgba(118, 118, 128, 0.2)',
              transition: 'width 0.5s ease'
            }}
            title={`Not Started: ${stats.notStartedEmpCount}`}
          />
        </div>
      </div>

      {/* INDIVIDUAL STAFF OUTREACH PERFORMANCE TRACKER (COLLAPSIBLE BY PARLIAMENT) */}
      <div className="dashboard-section-card">
        {/* Table Controls Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                  Individual Staff Outreach Tracker
                </h3>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '980px',
                  backgroundColor: 'rgba(0, 113, 227, 0.08)',
                  color: '#0071e3',
                  border: '1px solid rgba(0, 113, 227, 0.15)'
                }}>
                  {filteredEmployees.length} Staff Across {groupedParliamentsStaff.length} Parliaments
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0', fontWeight: 400 }}>
                Collapsible directory grouped by Parliamentary Constituency
              </p>
            </div>

            {/* Apple Segmented Status Filter Tabs */}
            <div 
              className="no-scrollbar"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                backgroundColor: 'rgba(118, 118, 128, 0.12)',
                padding: '2px',
                borderRadius: '980px',
                border: 'none',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                maxWidth: '100%'
              }}
            >
              {['ALL', 'Completed', 'In Progress', 'Not Started'].map((tab) => {
                const isActive = statusTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setStatusTab(tab)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '980px',
                      fontSize: '11px',
                      fontWeight: isActive ? 600 : 500,
                      border: 'none',
                      backgroundColor: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? '#1d1d1f' : '#86868b',
                      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1), 0 0.5px 1px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Bar & Global Expand/Collapse Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            {/* Search Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(118, 118, 128, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              borderRadius: '980px',
              padding: '7px 14px',
              flex: '1 1 220px',
              maxWidth: '100%'
            }}>
              <Search size={14} style={{ color: '#86868b', flexShrink: 0 }} />
              <input 
                type="text"
                placeholder="Search staff by name, code (e.g. APP13), or constituency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: '#1d1d1f',
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>

            {/* Expand / Collapse All Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={handleExpandAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '980px',
                  backgroundColor: 'rgba(118, 118, 128, 0.08)',
                  color: '#1d1d1f',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <ChevronsDown size={13} />
                <span>Expand All</span>
              </button>

              <button
                onClick={handleCollapseAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '980px',
                  backgroundColor: 'rgba(118, 118, 128, 0.08)',
                  color: '#1d1d1f',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <ChevronsUp size={13} />
                <span>Collapse All</span>
              </button>
            </div>
          </div>
        </div>

        {/* COLLAPSIBLE PARLIAMENT ACCORDION GROUPS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {groupedParliamentsStaff.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280', fontSize: '13px', backgroundColor: '#fafafa', borderRadius: '14px', border: '1px solid #e5e7eb' }}>
              No staff members match the selected filters or search query.
            </div>
          ) : (
            groupedParliamentsStaff.map(group => {
              const isCollapsed = searchQuery.trim() !== '' ? false : Boolean(collapsedParliaments[group.code]);

              return (
                <div 
                  key={group.code}
                  id={`parliament-group-${group.code}`}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                  }}
                >
                  {/* Parliament Accordion Header (Responsive Column on Mobile, Row on Desktop) */}
                  <div
                    onClick={() => toggleParliamentCollapse(group.code)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '12px 16px',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      borderBottom: isCollapsed ? 'none' : '1px solid rgba(0, 0, 0, 0.06)',
                      userSelect: 'none',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.015)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    {/* Top row / Left Title Section */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(118, 118, 128, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#1d1d1f',
                          flexShrink: 0
                        }}>
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                              {group.name} Parliamentary Constituency
                            </h4>
                            <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '1px 6px', borderRadius: '6px', backgroundColor: 'rgba(118, 118, 128, 0.08)', color: '#1d1d1f', border: 'none' }}>
                              {group.code}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#86868b', fontWeight: 400 }}>
                            {group.staff.length} Staff Assigned
                          </span>
                        </div>
                      </div>

                      {/* Compact Percent for Mobile Header */}
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: group.completionRate >= 80 ? '#34c759' : group.completionRate >= 40 ? '#ff9500' : '#ff3b30',
                        flexShrink: 0
                      }}>
                        {group.completionRate}%
                      </span>
                    </div>

                    {/* Summary Metric Badges (Stacked underneath title on mobile) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid rgba(0, 0, 0, 0.04)' }}>
                      {/* Submissions count */}
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1d1d1f' }}>
                        {group.totalValid} / {group.totalTarget} Submissions
                      </div>

                      {/* Status Breakdown Pills */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {group.completedCount > 0 && (
                          <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '980px', backgroundColor: 'rgba(52, 199, 89, 0.1)', color: '#34c759', border: '1px solid rgba(52, 199, 89, 0.2)' }}>
                            {group.completedCount} Done
                          </span>
                        )}
                        {group.inProgressCount > 0 && (
                          <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '980px', backgroundColor: 'rgba(255, 149, 0, 0.1)', color: '#ff9500', border: '1px solid rgba(255, 149, 0, 0.2)' }}>
                            {group.inProgressCount} Active
                          </span>
                        )}
                        {group.notStartedCount > 0 && (
                          <span style={{ fontSize: '10.5px', fontWeight: 500, padding: '2px 8px', borderRadius: '980px', backgroundColor: 'rgba(118, 118, 128, 0.08)', color: '#86868b', border: '1px solid rgba(118, 118, 128, 0.15)' }}>
                            {group.notStartedCount} Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Table Content (Renders when Expanded) */}
                  {!isCollapsed && (
                    <div>
                      {/* DESKTOP TABLE VIEW (Visible on tablet & desktop >= 640px) */}
                      <div className="hidden sm:block" style={{ overflowX: 'auto', backgroundColor: '#ffffff' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)', backgroundColor: 'rgba(118, 118, 128, 0.04)', color: '#86868b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              <th 
                                onClick={() => handleHeaderSort('name')}
                                style={{ padding: '10px 14px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>Staff Member</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'name' ? '#1d1d1f' : '#86868b' }} />
                                </div>
                              </th>
                              <th 
                                onClick={() => handleHeaderSort('constituency')}
                                style={{ padding: '10px 14px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>Constituency Segment</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'constituency' ? '#1d1d1f' : '#86868b' }} />
                                </div>
                              </th>
                              <th 
                                onClick={() => handleHeaderSort('valid')}
                                style={{ padding: '10px 14px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>Submissions</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'valid' ? '#1d1d1f' : '#86868b' }} />
                                </div>
                              </th>
                              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Target Progress</th>
                              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Outreach Link</th>
                              <th 
                                onClick={() => handleHeaderSort('duplicate')}
                                style={{ padding: '10px 14px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>Duplicates</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'duplicate' ? '#1d1d1f' : '#86868b' }} />
                                </div>
                              </th>
                              <th 
                                onClick={() => handleHeaderSort('status')}
                                style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                  <span>Status</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'status' ? '#1d1d1f' : '#86868b' }} />
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.staff.map((emp) => {
                              const percent = Math.min(100, Math.round(((emp.valid || 0) / (emp.target || 10)) * 100));

                              let statusBg = 'rgba(118, 118, 128, 0.08)';
                              let statusColor = '#86868b';
                              let statusBorder = 'rgba(118, 118, 128, 0.15)';

                              if (emp.status === 'Completed') {
                                statusBg = 'rgba(52, 199, 89, 0.1)';
                                statusColor = '#34c759';
                                statusBorder = 'rgba(52, 199, 89, 0.2)';
                              } else if (emp.status === 'In Progress') {
                                statusBg = 'rgba(255, 149, 0, 0.1)';
                                statusColor = '#ff9500';
                                statusBorder = 'rgba(255, 149, 0, 0.2)';
                              }

                              return (
                                <tr 
                                  key={emp.id}
                                  style={{
                                    borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
                                    transition: 'background-color 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.015)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  {/* Staff info */}
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: '#1d1d1f',
                                        color: '#ffffff',
                                        fontWeight: 600,
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                      }}>
                                        {emp.name.charAt(0)}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 600, color: '#1d1d1f', fontSize: '13px' }}>{emp.name}</div>
                                        <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 500, color: '#86868b' }}>
                                          {emp.supportCode || emp.id} {emp.staffId ? `• ${emp.staffId}` : ''}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Constituency Segment */}
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ fontWeight: 500, color: '#1d1d1f' }}>
                                      {emp.assemblyName ? `${emp.assemblyName} Segment` : `${emp.parliamentName || group.name} Parliament`}
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#86868b', fontWeight: 400 }}>
                                      {emp.level || 'Parliament'} Level
                                    </span>
                                  </td>

                                  {/* Valid Count */}
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f' }}>
                                      {emp.valid || 0}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#86868b', fontWeight: 400 }}> / {emp.target || 10}</span>
                                  </td>

                                  {/* Progress Bar */}
                                  <td style={{ padding: '10px 14px', width: '130px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <div style={{ flex: 1, height: '5px', backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: '980px', overflow: 'hidden' }}>
                                        <div style={{
                                          width: `${percent}%`,
                                          height: '100%',
                                          backgroundColor: percent >= 100 ? '#34c759' : percent > 0 ? '#0071e3' : 'rgba(118, 118, 128, 0.2)',
                                          borderRadius: '980px'
                                        }} />
                                      </div>
                                      <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#86868b', width: '32px' }}>{percent}%</span>
                                    </div>
                                  </td>

                                  {/* Outreach Tracking Link & Clicks */}
                                  <td style={{ padding: '10px 14px' }}>
                                    {(() => {
                                      const link = dbService.getTrackingLinkForEmployee(selectedTaskId || 'TASK-INSTA-001', emp.id);
                                      const token = link?.token || '';
                                      const clickData = staffClickMap[emp.id];
                                      const clickCount = clickData?.validClicks || 0;
                                      const isCopied = copiedStaffToken === token;

                                      return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyStaffTrackingLink(emp.id)}
                                            title={`Copy tracking link for ${emp.name}`}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              padding: '3px 9px',
                                              borderRadius: '980px',
                                              backgroundColor: isCopied ? 'rgba(52, 199, 89, 0.1)' : 'rgba(0, 113, 227, 0.08)',
                                              color: isCopied ? '#34c759' : '#0071e3',
                                              border: `1px solid ${isCopied ? 'rgba(52, 199, 89, 0.25)' : 'rgba(0, 113, 227, 0.18)'}`,
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              fontFamily: 'monospace'
                                            }}
                                          >
                                            {isCopied ? <Check size={11} /> : <Copy size={11} />}
                                            <span>{isCopied ? 'Copied' : `/${token ? token.slice(0, 6) : 'link'}...`}</span>
                                          </button>

                                          {clickCount > 0 && (
                                             <span style={{
                                               fontSize: '10.5px',
                                               fontWeight: 600,
                                               padding: '2px 7px',
                                               borderRadius: '980px',
                                               backgroundColor: 'rgba(52, 199, 89, 0.1)',
                                               color: '#34c759',
                                               border: '1px solid rgba(52, 199, 89, 0.2)'
                                             }} title="Verified citizen clicks">
                                               {clickCount} clicks
                                             </span>
                                           )}
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  {/* Duplicates */}
                                  <td style={{ padding: '10px 14px' }}>
                                    {emp.duplicate > 0 ? (
                                      <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#ff3b30', backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: '2px 7px', borderRadius: '980px', border: '1px solid rgba(255, 59, 48, 0.2)' }}>
                                        {emp.duplicate} Flagged
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: '#86868b', fontWeight: 400 }}>0 Clean</span>
                                    )}
                                  </td>

                                  {/* Status Badge */}
                                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '3px 9px',
                                      borderRadius: '980px',
                                      fontSize: '10.5px',
                                      fontWeight: 600,
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

                      {/* MOBILE CARDS VIEW (Clean stacked cards for screens < 640px) */}
                      <div className="block sm:hidden" style={{ backgroundColor: '#ffffff', padding: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {group.staff.map((emp) => {
                            const percent = Math.min(100, Math.round(((emp.valid || 0) / (emp.target || 10)) * 100));

                            let statusBg = 'rgba(118, 118, 128, 0.08)';
                            let statusColor = '#86868b';
                            let statusBorder = 'rgba(118, 118, 128, 0.15)';

                            if (emp.status === 'Completed') {
                              statusBg = 'rgba(52, 199, 89, 0.1)';
                              statusColor = '#34c759';
                              statusBorder = 'rgba(52, 199, 89, 0.2)';
                            } else if (emp.status === 'In Progress') {
                              statusBg = 'rgba(255, 149, 0, 0.1)';
                              statusColor = '#ff9500';
                              statusBorder = 'rgba(255, 149, 0, 0.2)';
                            }

                            return (
                              <div
                                key={emp.id}
                                style={{
                                  backgroundColor: 'rgba(118, 118, 128, 0.04)',
                                  borderRadius: '14px',
                                  border: '1px solid rgba(0, 0, 0, 0.06)',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px'
                                }}
                              >
                                {/* Top: Avatar + Name + ID + Status */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '50%',
                                      backgroundColor: '#1d1d1f',
                                      color: '#ffffff',
                                      fontWeight: 600,
                                      fontSize: '11px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      {emp.name.charAt(0)}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#1d1d1f' }}>{emp.name}</div>
                                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#86868b', fontWeight: 500 }}>
                                        {emp.supportCode || emp.id} {emp.staffId ? `• ${emp.staffId}` : ''}
                                      </div>
                                    </div>
                                  </div>

                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '980px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    backgroundColor: statusBg,
                                    color: statusColor,
                                    border: `1px solid ${statusBorder}`
                                  }}>
                                    {emp.status}
                                  </span>
                                </div>

                                {/* Middle: Constituency Segment */}
                                <div style={{ fontSize: '11px', color: '#1d1d1f', fontWeight: 500 }}>
                                  {emp.assemblyName ? `${emp.assemblyName} Segment` : `${emp.parliamentName || group.name} Parliament`}
                                  <span style={{ color: '#86868b', fontWeight: 400 }}> • {emp.level || 'Parliament'} Level</span>
                                </div>

                                {/* Bottom: Submissions & Progress */}
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#86868b', marginBottom: '3px' }}>
                                    <span><strong style={{ color: '#1d1d1f', fontWeight: 600 }}>{emp.valid || 0}</strong> / {emp.target || 10} Submissions</span>
                                    <span style={{ fontWeight: 600, color: percent >= 100 ? '#34c759' : '#ff9500' }}>{percent}%</span>
                                  </div>
                                  <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: '980px', overflow: 'hidden' }}>
                                    <div style={{
                                      width: `${percent}%`,
                                      height: '100%',
                                      backgroundColor: percent >= 100 ? '#34c759' : percent > 0 ? '#0071e3' : 'rgba(118, 118, 128, 0.2)',
                                      borderRadius: '980px'
                                    }} />
                                  </div>
                                </div>

                                {/* Outreach Tracking Link in Mobile Card */}
                                  {(() => {
                                    const link = dbService.getTrackingLinkForEmployee(selectedTaskId || 'TASK-INSTA-001', emp.id);
                                    const token = link?.token || '';
                                    const clickData = staffClickMap[emp.id];
                                    const clickCount = clickData?.validClicks || 0;
                                    const isCopied = copiedStaffToken === token;

                                    return (
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backgroundColor: '#ffffff',
                                        padding: '5px 8px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(0, 0, 0, 0.08)',
                                        fontSize: '11px',
                                        gap: '6px'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden' }}>
                                          <Link2 size={12} style={{ color: '#0071e3', flexShrink: 0 }} />
                                          <span style={{ fontFamily: 'monospace', color: '#1d1d1f', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            /{link?.slug || 'instagram'}/{token}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                          {clickCount > 0 && (
                                            <span style={{ fontSize: '10px', fontWeight: 600, color: '#34c759', backgroundColor: 'rgba(52, 199, 89, 0.1)', padding: '1px 6px', borderRadius: '980px' }}>
                                              {clickCount} clicks
                                            </span>
                                          )}
                                          <button
                                            onClick={() => handleCopyStaffTrackingLink(emp.id)}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '3px',
                                              padding: '2px 8px',
                                              borderRadius: '980px',
                                              backgroundColor: isCopied ? 'rgba(52, 199, 89, 0.1)' : 'rgba(0, 113, 227, 0.08)',
                                              color: isCopied ? '#34c759' : '#0071e3',
                                              border: `1px solid ${isCopied ? 'rgba(52, 199, 89, 0.25)' : 'rgba(0, 113, 227, 0.18)'}`,
                                              fontSize: '10px',
                                              fontWeight: 600,
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {isCopied ? <Check size={11} /> : <Copy size={11} />}
                                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Duplicate Flag if any */}
                                  {emp.duplicate > 0 && (
                                  <div style={{ fontSize: '10px', color: '#ff3b30', fontWeight: 600, backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: '2px 8px', borderRadius: '6px', alignSelf: 'flex-start' }}>
                                    {emp.duplicate} Duplicates Flagged
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* DYNAMIC LEADERBOARD & ALL 25 PARLIAMENTS PERFORMANCE */}
      <div className="dashboard-section-card">
        {/* Leaderboard Header & Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <Award size={18} style={{ color: '#ff9500', flexShrink: 0 }} />
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                Parliament Performance Leaderboard
              </h3>
              <span style={{
                fontSize: '10.5px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '980px',
                backgroundColor: 'rgba(255, 149, 0, 0.1)',
                color: '#ff9500',
                border: '1px solid rgba(255, 149, 0, 0.2)'
              }}>
                {sortedParliaments.length} {leaderboardShowMode === 'ALL' ? 'Parliaments' : 'Displayed'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0', fontWeight: 400 }}>
              Dynamic performance ranking across all 25 AP Parliament Constituencies
            </p>
          </div>

          {/* View Filter & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', smWidth: 'auto', justifyContent: 'space-between' }}>
            {/* Apple Segmented View Mode Pills */}
            <div 
              className="no-scrollbar"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                backgroundColor: 'rgba(118, 118, 128, 0.12)',
                padding: '2px',
                borderRadius: '980px',
                border: 'none',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                maxWidth: '100%'
              }}
            >
              {[
                { id: 'ALL', label: 'All 25' },
                { id: 'TOP_5', label: 'Top 5' },
                { id: 'BOTTOM_5', label: 'Bottom 5' },
                { id: 'TOP_10', label: 'Top 10' },
                { id: 'BOTTOM_10', label: 'Bottom 10' }
              ].map(item => {
                const isActive = leaderboardShowMode === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setLeaderboardShowMode(item.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '980px',
                      fontSize: '11px',
                      fontWeight: isActive ? 600 : 500,
                      border: 'none',
                      backgroundColor: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? '#1d1d1f' : '#86868b',
                      boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Sort Toggle Button */}
            <button
              onClick={() => setLeaderboardSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: '980px',
                backgroundColor: 'rgba(118, 118, 128, 0.08)',
                color: '#1d1d1f',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title="Toggle Dynamic Sort Order"
            >
              <ArrowUpDown size={12} style={{ color: '#86868b' }} />
              <span>{leaderboardSortOrder === 'DESC' ? 'Highest First' : 'Lowest First'}</span>
            </button>
          </div>
        </div>

        {/* Parliaments Grid: Responsive (1 col on mobile, 2 on tablet, 3 on desktop, 5 on wide) */}
        <div className="leaderboard-parliaments-grid">
          {sortedParliaments.map((p, index) => {
            const rankNum = leaderboardSortOrder === 'DESC' ? index + 1 : sortedParliaments.length - index;

            const isSelected = !isAllSelected && Boolean(activeParliamentCodes?.has(p.code));

            return (
              <div 
                key={p.code}
                onClick={() => {
                  if (isMultiSelect) {
                    toggleParliamentInMultiSelect(p.code);
                  } else {
                    setSelectedParliaments([p.code]);
                  }
                  setCollapsedParliaments(prev => ({ ...prev, [p.code]: false }));
                  const el = document.getElementById(`parliament-group-${p.code}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                style={{
                  backgroundColor: isSelected ? 'rgba(0, 113, 227, 0.04)' : '#ffffff',
                  borderRadius: '16px',
                  border: isSelected 
                    ? '1.5px solid #0071e3' 
                    : '1px solid rgba(0, 0, 0, 0.08)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  cursor: 'pointer',
                  opacity: !isAllSelected && !isSelected ? 0.6 : 1,
                  boxShadow: isSelected ? '0 4px 16px rgba(0, 113, 227, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.02)'
                }}
                title={`Click to ${isMultiSelect ? 'toggle' : 'filter by'} ${p.name}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(118, 118, 128, 0.1)',
                      color: '#1d1d1f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      #{rankNum}
                    </span>
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </h4>
                        {isSelected && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '980px',
                            backgroundColor: '#0071e3',
                            color: '#ffffff',
                            flexShrink: 0
                          }}>
                            Active
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 400, color: '#86868b' }}>
                        {p.code} • {p.totalStaff} Staff
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: p.completionRate >= 80 ? '#34c759' : p.completionRate >= 40 ? '#ff9500' : '#ff3b30',
                    flexShrink: 0
                  }}>
                    {p.completionRate}%
                  </span>
                </div>

                {/* Progress bar & Submissions */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#86868b', marginBottom: '3px' }}>
                    <span>Submissions: <strong style={{ color: '#1d1d1f', fontWeight: 600 }}>{p.totalValid}</strong></span>
                    <span>Target: <strong style={{ color: '#1d1d1f', fontWeight: 600 }}>{p.totalTarget}</strong></span>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: '980px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${p.completionRate}%`,
                      height: '100%',
                      backgroundColor: p.completionRate >= 80 ? '#34c759' : p.completionRate >= 40 ? '#ff9500' : '#ff3b30',
                      borderRadius: '980px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Breakdown Mini Badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', paddingTop: '4px', borderTop: '1px solid rgba(0, 0, 0, 0.04)' }}>
                  <span style={{ color: '#34c759', fontWeight: 600 }}>{p.completedStaff} Done</span>
                  <span style={{ color: '#ff9500', fontWeight: 600 }}>{p.inProgressStaff} Active</span>
                  <span style={{ color: '#86868b', fontWeight: 400 }}>{p.notStartedStaff} Pending</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
