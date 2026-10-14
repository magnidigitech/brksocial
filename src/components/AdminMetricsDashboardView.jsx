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

  // Real-Time Live AJAX Refresh Trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
              Performance & Outreach Metrics
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              Live Sync
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, fontWeight: 500 }}>
            Real-time analytics across 25 AP Parliament & 175 Assembly Constituencies
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '100%', justifyContent: 'flex-start' }}>
          {/* Date Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '9999px',
            padding: '5px 12px',
            flex: '1 1 auto',
            minWidth: '140px'
          }}>
            <Calendar size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '12px',
                fontWeight: 700,
                color: '#111827',
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
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '9999px',
            padding: '5px 12px',
            flex: '2 1 200px',
            minWidth: '180px'
          }}>
            <Target size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
            <select
              value={effectiveTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '12px',
                fontWeight: 700,
                color: '#111827',
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
              backgroundColor: '#f9fafb',
              border: '1px solid #d1d5db',
              borderRadius: '9999px',
              padding: '4px 6px 4px 12px',
              flex: '2 1 240px',
              minWidth: '220px'
            }}
          >
            <Building2 size={14} style={{ color: '#6b7280', flexShrink: 0 }} />

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
                  fontWeight: 700,
                  color: '#111827',
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
                    fontWeight: 700,
                    color: '#111827',
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
                  <ChevronDown size={13} style={{ color: '#6b7280', flexShrink: 0, transform: isMultiSelectOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                </button>
              </div>
            )}

            {/* Segmented Mode Switch: Single | Multi */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#e5e7eb',
              borderRadius: '9999px',
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
                  borderRadius: '9999px',
                  padding: '3px 7px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: !isMultiSelect ? '#18181b' : 'transparent',
                  color: !isMultiSelect ? '#ffffff' : '#4b5563',
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
                  borderRadius: '9999px',
                  padding: '3px 7px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: isMultiSelect ? '#18181b' : 'transparent',
                  color: isMultiSelect ? '#ffffff' : '#4b5563',
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
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 20px 35px -5px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
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
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  padding: '6px 10px'
                }}>
                  <Search size={13} style={{ color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Search parliament..."
                    value={multiSelectSearchQuery}
                    onChange={(e) => setMultiSelectSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#111827',
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
                      <X size={12} style={{ color: '#6b7280' }} />
                    </button>
                  )}
                </div>

                {/* Quick Selection Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', padding: '0 2px' }}>
                  <span style={{ fontWeight: 700, color: '#4b5563' }}>
                    {isAllSelected ? 'All 25 Selected' : `${selectedParliaments.length} of 25 Selected`}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedParliaments(['ALL'])}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#2563eb',
                        fontWeight: 800,
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
                        color: '#dc2626',
                        fontWeight: 800,
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
                    gap: '3px'
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
                          backgroundColor: isChecked ? '#eff6ff' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isChecked) e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          if (!isChecked) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          {isChecked ? (
                            <CheckSquare size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                          ) : (
                            <Square size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
                          )}
                          <span style={{
                            fontSize: '12px',
                            fontWeight: isChecked ? 800 : 600,
                            color: isChecked ? '#1e40af' : '#1f2937',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {p.name}
                          </span>
                          <span style={{
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#6b7280',
                            backgroundColor: '#f3f4f6',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            {p.code}
                          </span>
                        </div>

                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', flexShrink: 0 }}>
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
                    marginTop: '2px',
                    padding: '8px 12px',
                    backgroundColor: '#18181b',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
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
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
              color: '#374151',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* FILTER ACTIVE STATUS BANNER */}
      {!isAllSelected && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '14px',
          padding: '10px 16px',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Filter size={15} style={{ color: '#2563eb', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e40af' }}>
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
                      fontWeight: 700,
                      backgroundColor: '#dbeafe',
                      color: '#1d4ed8',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      border: '1px solid #93c5fd'
                    }}
                  >
                    {name} ({code})
                  </span>
                );
              })}
              {(activeParliamentCodes?.size || 0) > 4 && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', alignSelf: 'center' }}>
                  +{activeParliamentCodes.size - 4} more
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
              • {stats.activeEmployees} Active Staff • {stats.targetSubmissions.toLocaleString()} Target Submissions
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedParliaments(['ALL'])}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#ffffff',
              border: '1px solid #93c5fd',
              color: '#1d4ed8',
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '9999px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
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
          borderRadius: '16px',
          padding: '16px 18px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>Verified Submissions</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#065f46', letterSpacing: '-0.03em' }}>
              {stats.validSubmissions.toLocaleString()}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>
              / {stats.targetSubmissions.toLocaleString()} Target
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#047857', marginBottom: '4px' }}>
              <span>Target Achievement</span>
              <span>{targetCompletionPercentage}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
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
          borderRadius: '16px',
          padding: '16px 18px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>Active Staff Engagement</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#1e40af', letterSpacing: '-0.03em' }}>
              {stats.completedEmpCount + stats.inProgressEmpCount}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>
              / {stats.activeEmployees} Active Staff
            </span>
          </div>

          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#1d4ed8', marginBottom: '4px' }}>
              <span>Participation Rate</span>
              <span>{staffParticipationPercentage}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
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
          borderRadius: '16px',
          padding: '16px 18px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>Duplicates Intercepted</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#c2410c', letterSpacing: '-0.03em' }}>
              {stats.duplicates}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>
              Attempts Blocked
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#d97706', marginTop: '10px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }} />
            <span>Cross-Staff Filter Active</span>
          </div>
        </div>

        {/* Card 4: Active Campaign Info */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '16px 18px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>Active Campaign</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
              <Target size={18} />
            </div>
          </div>
          <div style={{ marginBottom: '4px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeTask?.name || 'Instagram Follower Outreach'}
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fde047'
            }}>
              {activeTask?.platform || 'Instagram'}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>
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
              <MapPin size={20} style={{ color: '#059669', flexShrink: 0 }} />
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: 0 }}>
                Interactive AP Parliament Constituency Map
              </h3>
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0'
              }}>
                Live Map
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0', fontWeight: 500 }}>
              Tap or hover any constituency node on the AP map to view live progress.
            </p>
          </div>

          {/* Map Search / Filter & Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%', smWidth: 'auto', justifyContent: 'space-between' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f9fafb',
              border: '1px solid #d1d5db',
              borderRadius: '9999px',
              padding: '5px 12px',
              flex: '1 1 180px',
              maxWidth: '280px'
            }}>
              <Search size={13} style={{ color: '#9ca3af' }} />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 700, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#047857' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                &ge; 80%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                40 - 79%
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b91c1c' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
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
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>
              Staff Completion Pipeline Status
            </h3>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0 0', fontWeight: 500 }}>
              {isAllSelected 
                ? 'Breakdown of staff progress across all 25 assigned constituencies (200 staff)'
                : `Breakdown of staff progress across ${activeParliamentCodes?.size || 0} selected constituencies (${stats.activeEmployees} staff)`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#047857' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#10b981' }} />
              Completed ({stats.completedEmpCount})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#b45309' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
              Active ({stats.inProgressEmpCount})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#4b5563' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#9ca3af' }} />
              Pending ({stats.notStartedEmpCount})
            </div>
          </div>
        </div>

        {/* Multi-segmented Visual Progress Bar */}
        <div style={{
          display: 'flex',
          height: '12px',
          width: '100%',
          backgroundColor: '#f3f4f6',
          borderRadius: '9999px',
          overflow: 'hidden'
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

      {/* INDIVIDUAL STAFF OUTREACH PERFORMANCE TRACKER (COLLAPSIBLE BY PARLIAMENT) */}
      <div className="dashboard-section-card">
        {/* Table Controls Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: 0 }}>
                  Individual Staff Outreach Tracker
                </h3>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #e5e7eb'
                }}>
                  {filteredEmployees.length} Staff Across {groupedParliamentsStaff.length} Parliaments
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0 0', fontWeight: 500 }}>
                Collapsible directory grouped by Parliamentary Constituency
              </p>
            </div>

            {/* Status Filter Tabs (Scrollable on mobile) */}
            <div 
              className="no-scrollbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#f3f4f6',
                padding: '3px',
                borderRadius: '9999px',
                border: '1px solid #e5e7eb',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                maxWidth: '100%'
              }}
            >
              {['ALL', 'Completed', 'In Progress', 'Not Started'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusTab(tab)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    border: 'none',
                    backgroundColor: statusTab === tab ? '#ffffff' : 'transparent',
                    color: statusTab === tab ? '#111827' : '#6b7280',
                    boxShadow: statusTab === tab ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar & Global Expand/Collapse Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            {/* Search Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#f9fafb',
              border: '1px solid #d1d5db',
              borderRadius: '9999px',
              padding: '8px 14px',
              flex: '1 1 220px',
              maxWidth: '100%'
            }}>
              <Search size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
              <input 
                type="text"
                placeholder="Search staff by name, code (e.g. APP13), or constituency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#111827',
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
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  fontSize: '11px',
                  fontWeight: 700,
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
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  fontSize: '11px',
                  fontWeight: 700,
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
                    backgroundColor: '#fafafa',
                    borderRadius: '14px',
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
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
                      borderBottom: isCollapsed ? 'none' : '1px solid #e5e7eb',
                      userSelect: 'none',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    {/* Top row / Left Title Section */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#4b5563',
                          flexShrink: 0
                        }}>
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0 }}>
                              {group.name} Parliamentary Constituency
                            </h4>
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
                              {group.code}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
                            {group.staff.length} Staff Assigned
                          </span>
                        </div>
                      </div>

                      {/* Compact Percent for Mobile Header */}
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 900,
                        color: group.completionRate >= 80 ? '#059669' : group.completionRate >= 40 ? '#d97706' : '#dc2626',
                        flexShrink: 0
                      }}>
                        {group.completionRate}%
                      </span>
                    </div>

                    {/* Summary Metric Badges (Stacked underneath title on mobile) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px dashed #f1f5f9' }}>
                      {/* Submissions count */}
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>
                        {group.totalValid} / {group.totalTarget} Submissions
                      </div>

                      {/* Status Breakdown Pills */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {group.completedCount > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                            {group.completedCount} Done
                          </span>
                        )}
                        {group.inProgressCount > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                            {group.inProgressCount} Active
                          </span>
                        )}
                        {group.notStartedCount > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}>
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
                            <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', color: '#4b5563', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              <th 
                                onClick={() => handleHeaderSort('name')}
                                style={{ padding: '10px 14px', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>Staff Member</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'name' ? '#111827' : '#9ca3af' }} />
                                </div>
                              </th>
                              <th 
                                onClick={() => handleHeaderSort('constituency')}
                                style={{ padding: '10px 14px', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>Constituency Segment</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'constituency' ? '#111827' : '#9ca3af' }} />
                                </div>
                              </th>
                              <th 
                                onClick={() => handleHeaderSort('valid')}
                                style={{ padding: '10px 14px', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>Submissions</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'valid' ? '#111827' : '#9ca3af' }} />
                                </div>
                              </th>
                              <th style={{ padding: '10px 14px', fontWeight: 800 }}>Target Progress</th>
                              <th style={{ padding: '10px 14px', fontWeight: 800 }}>Outreach Link</th>
                              <th 
                                onClick={() => handleHeaderSort('duplicate')}
                                style={{ padding: '10px 14px', fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>Duplicates</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'duplicate' ? '#111827' : '#9ca3af' }} />
                                </div>
                              </th>
                              <th 
                                onClick={() => handleHeaderSort('status')}
                                style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                  <span>Status</span>
                                  <ArrowUpDown size={11} style={{ color: tableSortField === 'status' ? '#111827' : '#9ca3af' }} />
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
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: '#18181b',
                                        color: '#facc15',
                                        fontWeight: 800,
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                      }}>
                                        {emp.name.charAt(0)}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 800, color: '#111827' }}>{emp.name}</div>
                                        <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#6b7280' }}>
                                          {emp.supportCode || emp.id} {emp.staffId ? `• ${emp.staffId}` : ''}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Constituency Segment */}
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ fontWeight: 600, color: '#374151' }}>
                                      {emp.assemblyName ? `${emp.assemblyName} Segment` : `${emp.parliamentName || group.name} Parliament`}
                                    </div>
                                    <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 500 }}>
                                      {emp.level || 'Parliament'} Level
                                    </span>
                                  </td>

                                  {/* Valid Count */}
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>
                                      {emp.valid || 0}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}> / {emp.target || 10}</span>
                                  </td>

                                  {/* Progress Bar */}
                                  <td style={{ padding: '10px 14px', width: '130px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <div style={{ flex: 1, height: '5px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                                        <div style={{
                                          width: `${percent}%`,
                                          height: '100%',
                                          backgroundColor: percent >= 100 ? '#10b981' : percent > 0 ? '#f59e0b' : '#9ca3af',
                                          borderRadius: '9999px'
                                        }} />
                                      </div>
                                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#4b5563', width: '30px' }}>{percent}%</span>
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
                                              padding: '3px 8px',
                                              borderRadius: '9999px',
                                              backgroundColor: isCopied ? '#ecfdf5' : '#f1f5f9',
                                              color: isCopied ? '#047857' : '#334155',
                                              border: `1px solid ${isCopied ? '#a7f3d0' : '#cbd5e1'}`,
                                              fontSize: '11px',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              fontFamily: 'monospace'
                                            }}
                                          >
                                            {isCopied ? <Check size={11} /> : <Copy size={11} />}
                                            <span>{isCopied ? 'Copied' : `/${token ? token.slice(0, 6) : 'link'}...`}</span>
                                          </button>

                                          {clickCount > 0 && (
                                             <span style={{
                                               fontSize: '10px',
                                               fontWeight: 800,
                                               padding: '1px 6px',
                                               borderRadius: '9999px',
                                               backgroundColor: '#ecfdf5',
                                               color: '#059669',
                                               border: '1px solid #a7f3d0'
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
                                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '9999px', border: '1px solid #fca5a5' }}>
                                        {emp.duplicate} Flagged
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>0 Clean</span>
                                    )}
                                  </td>

                                  {/* Status Badge */}
                                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: '9999px',
                                      fontSize: '10px',
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

                      {/* MOBILE CARDS VIEW (Clean stacked cards for screens < 640px) */}
                      <div className="block sm:hidden" style={{ backgroundColor: '#ffffff', padding: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                              <div
                                key={emp.id}
                                style={{
                                  backgroundColor: '#fafafa',
                                  borderRadius: '12px',
                                  border: '1px solid #e5e7eb',
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
                                      backgroundColor: '#18181b',
                                      color: '#facc15',
                                      fontWeight: 800,
                                      fontSize: '11px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      {emp.name.charAt(0)}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 800, fontSize: '13px', color: '#111827' }}>{emp.name}</div>
                                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#6b7280', fontWeight: 600 }}>
                                        {emp.supportCode || emp.id} {emp.staffId ? `• ${emp.staffId}` : ''}
                                      </div>
                                    </div>
                                  </div>

                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    backgroundColor: statusBg,
                                    color: statusColor,
                                    border: `1px solid ${statusBorder}`
                                  }}>
                                    {emp.status}
                                  </span>
                                </div>

                                {/* Middle: Constituency Segment */}
                                <div style={{ fontSize: '11px', color: '#4b5563', fontWeight: 600 }}>
                                  {emp.assemblyName ? `${emp.assemblyName} Segment` : `${emp.parliamentName || group.name} Parliament`}
                                  <span style={{ color: '#9ca3af', fontWeight: 500 }}> • {emp.level || 'Parliament'} Level</span>
                                </div>

                                {/* Bottom: Submissions & Progress */}
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#374151', marginBottom: '3px' }}>
                                    <span><strong>{emp.valid || 0}</strong> / {emp.target || 10} Submissions</span>
                                    <span style={{ fontWeight: 800, color: percent >= 100 ? '#059669' : '#d97706' }}>{percent}%</span>
                                  </div>
                                  <div style={{ width: '100%', height: '5px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                                    <div style={{
                                      width: `${percent}%`,
                                      height: '100%',
                                      backgroundColor: percent >= 100 ? '#10b981' : percent > 0 ? '#f59e0b' : '#9ca3af',
                                      borderRadius: '9999px'
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
                                        border: '1px solid #e2e8f0',
                                        fontSize: '11px',
                                        gap: '6px'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden' }}>
                                          <Link2 size={12} style={{ color: '#0284c7', flexShrink: 0 }} />
                                          <span style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            /{link?.slug || 'instagram'}/{token}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                          {clickCount > 0 && (
                                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '9999px' }}>
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
                                              borderRadius: '6px',
                                              backgroundColor: isCopied ? '#ecfdf5' : '#f1f5f9',
                                              color: isCopied ? '#047857' : '#334155',
                                              border: '1px solid #cbd5e1',
                                              fontSize: '10px',
                                              fontWeight: 700,
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
                                  <div style={{ fontSize: '10px', color: '#b91c1c', fontWeight: 700, backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '6px', alignSelf: 'flex-start' }}>
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
              <Award size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: 0 }}>
                Parliament Performance Leaderboard
              </h3>
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde047'
              }}>
                {sortedParliaments.length} {leaderboardShowMode === 'ALL' ? 'Parliaments' : 'Displayed'}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0 0', fontWeight: 500 }}>
              Dynamic performance ranking across all 25 AP Parliament Constituencies
            </p>
          </div>

          {/* View Filter & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', smWidth: 'auto', justifyContent: 'space-between' }}>
            {/* View Mode Pills (Scrollable on mobile) */}
            <div 
              className="no-scrollbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#f3f4f6',
                padding: '3px',
                borderRadius: '9999px',
                border: '1px solid #e5e7eb',
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
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setLeaderboardShowMode(item.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    border: 'none',
                    backgroundColor: leaderboardShowMode === item.id ? '#18181b' : 'transparent',
                    color: leaderboardShowMode === item.id ? '#ffffff' : '#4b5563',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
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
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '9999px',
                backgroundColor: leaderboardSortOrder === 'DESC' ? '#ecfdf5' : '#fff1f2',
                color: leaderboardSortOrder === 'DESC' ? '#047857' : '#be123c',
                border: `1px solid ${leaderboardSortOrder === 'DESC' ? '#a7f3d0' : '#fecdd3'}`,
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title="Toggle Dynamic Sort Order"
            >
              <ArrowUpDown size={12} />
              <span>{leaderboardSortOrder === 'DESC' ? 'Highest First' : 'Lowest First'}</span>
            </button>
          </div>
        </div>

        {/* Parliaments Grid: Responsive (1 col on mobile, 2 on tablet, 3 on desktop, 5 on wide) */}
        <div className="leaderboard-parliaments-grid">
          {sortedParliaments.map((p, index) => {
            const rankNum = leaderboardSortOrder === 'DESC' ? index + 1 : sortedParliaments.length - index;

            const badgeBg = index === 0 && leaderboardSortOrder === 'DESC' ? '#fef3c7' : index === 1 && leaderboardSortOrder === 'DESC' ? '#f3f4f6' : index === 2 && leaderboardSortOrder === 'DESC' ? '#ffedd5' : '#f9fafb';
            const badgeColor = index === 0 && leaderboardSortOrder === 'DESC' ? '#92400e' : index === 1 && leaderboardSortOrder === 'DESC' ? '#374151' : index === 2 && leaderboardSortOrder === 'DESC' ? '#9a3412' : '#6b7280';

            const isSelected = isAllSelected || Boolean(activeParliamentCodes?.has(p.code));

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
                  backgroundColor: !isAllSelected && isSelected ? '#eff6ff' : '#fafafa',
                  borderRadius: '14px',
                  border: !isAllSelected && isSelected 
                    ? '2px solid #2563eb' 
                    : p.completionRate >= 80 ? '1.5px solid #a7f3d0' : '1px solid #e5e7eb',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  cursor: 'pointer',
                  opacity: !isAllSelected && !isSelected ? 0.55 : 1,
                  boxShadow: !isAllSelected && isSelected ? '0 4px 12px rgba(37, 99, 235, 0.12)' : 'none'
                }}
                title={`Click to ${isMultiSelect ? 'toggle' : 'filter by'} ${p.name}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
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
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </h4>
                        {!isAllSelected && isSelected && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '9999px',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            flexShrink: 0
                          }}>
                            Active
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>
                        {p.code} • {p.totalStaff} Staff
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '13px',
                    fontWeight: 900,
                    color: p.completionRate >= 80 ? '#059669' : p.completionRate >= 40 ? '#d97706' : '#dc2626',
                    flexShrink: 0
                  }}>
                    {p.completionRate}%
                  </span>
                </div>

                {/* Progress bar & Submissions */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#4b5563', marginBottom: '3px' }}>
                    <span>Submissions: <strong style={{ color: '#111827' }}>{p.totalValid}</strong></span>
                    <span>Target: <strong>{p.totalTarget}</strong></span>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${p.completionRate}%`,
                      height: '100%',
                      backgroundColor: p.completionRate >= 80 ? '#10b981' : p.completionRate >= 40 ? '#f59e0b' : '#ef4444',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Breakdown Mini Badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', paddingTop: '4px', borderTop: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#059669', fontWeight: 700 }}>{p.completedStaff} Done</span>
                  <span style={{ color: '#b45309', fontWeight: 700 }}>{p.inProgressStaff} Active</span>
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>{p.notStartedStaff} Pending</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
