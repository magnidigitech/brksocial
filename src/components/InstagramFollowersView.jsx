import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Instagram, Search, Upload, Check, AlertCircle, RefreshCw, 
  ExternalLink, Calendar, Users, ShieldCheck, Download, Clock, Filter,
  RotateCcw, History, AlertTriangle, ArrowRight, X, ChevronRight, UserMinus, UserCheck, ShieldAlert,
  CheckCircle2, FileText
} from 'lucide-react';
import { dbService } from '../services/db.js';
import { followerStorage, extractItemsFromParsedJson, formatFollowerTimestamp } from '../services/followerStorage.js';

export function InstagramFollowersView() {
  const validSubtabs = ['ACTIVE', 'UNFOLLOWED', 'HISTORY', 'AUDIT', 'CHECKER'];
  const getInitialSubtab = () => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('subtab')?.toUpperCase();
      if (param && validSubtabs.includes(param)) return param;
      const saved = localStorage.getItem('brk_followers_subtab')?.toUpperCase();
      if (saved && validSubtabs.includes(saved)) return saved;
    }
    return 'ACTIVE';
  };

  // Navigation Tabs: 'ACTIVE' | 'UNFOLLOWED' | 'HISTORY' | 'AUDIT' | 'CHECKER'
  const [activeTab, setActiveTab] = useState(getInitialSubtab);

  useEffect(() => {
    try {
      localStorage.setItem('brk_followers_subtab', activeTab);
      const url = new URL(window.location.href);
      if (activeTab === 'ACTIVE') {
        url.searchParams.delete('subtab');
      } else {
        url.searchParams.set('subtab', activeTab.toLowerCase());
      }
      window.history.replaceState(null, '', url.toString());
    } catch (e) {}
  }, [activeTab]);

  useEffect(() => {
    const handlePop = () => {
      const param = new URLSearchParams(window.location.search).get('subtab')?.toUpperCase();
      if (param && validSubtabs.includes(param)) {
        setActiveTab(param);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Stats from reconciliation engine & followerStorage
  const [stats, setStats] = useState({ total: 0, latestFollower: null, lastUpdated: null });
  const [reconcileStats, setReconcileStats] = useState({
    currentActiveFollowers: 0,
    unfollowedFollowers: 0,
    totalTrackedFollowers: 0,
    activeSubmissionsCount: 0,
    unfollowedSubmissionsCount: 0,
    pendingSubmissionsCount: 0,
    totalSubmissionsCount: 0,
    latestImport: null,
    lastReconciliationTime: null
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Active Followers List & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [followersList, setFollowersList] = useState([]);
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'STAFF_MATCHES'

  // Unfollowed Accounts List
  const [unfollowedList, setUnfollowedList] = useState([]);
  const [totalUnfollowed, setTotalUnfollowed] = useState(0);
  const [unfollowedPage, setUnfollowedPage] = useState(1);
  const [unfollowedSearch, setUnfollowedSearch] = useState('');
  const [isLoadingUnfollowed, setIsLoadingUnfollowed] = useState(false);

  // Import History & Audit Trail
  const [importHistory, setImportHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Single Profile Checker
  const [checkInput, setCheckInput] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  // Visual Progress Import Modal State
  const fileInputRef = useRef(null);
  const [uploadToast, setUploadToast] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importModal, setImportModal] = useState({
    isOpen: false,
    mode: 'BASELINE',
    phase: 'idle',
    progressPercent: 0,
    statusText: '',
    fileName: '',
    fileCount: 1,
    fileSizeStr: '',
    totalRecords: 0,
    metrics: null,
    error: null
  });
  const isUploading = importModal.isOpen && importModal.phase !== 'completed' && importModal.phase !== 'error';

  // Reset Database Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Submissions Map for cross-referencing outreach staff
  const [submissions, setSubmissions] = useState(() => dbService.getSubmissions());

  useEffect(() => {
    const handleUpdate = () => {
      setSubmissions(dbService.getSubmissions());
    };
    dbService.syncSubmissionsWithServer().then(subs => {
      if (Array.isArray(subs)) setSubmissions(subs);
    }).catch(() => {});

    window.addEventListener('brk_submission_event', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('brk_submission_event', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const staffByUsername = useMemo(() => {
    const map = new Map();
    submissions.forEach(s => {
      if (s.username) {
        map.set(s.username.toLowerCase().trim(), s);
      }
    });
    return map;
  }, [submissions]);

  // Load initial stats & first page
  useEffect(() => {
    fetchAllStats();
    fetchFollowers(1, '');
  }, []);

  // Fetch data on tab change
  useEffect(() => {
    if (activeTab === 'UNFOLLOWED') {
      fetchUnfollowed(1, unfollowedSearch);
    } else if (activeTab === 'HISTORY') {
      fetchHistory();
    } else if (activeTab === 'AUDIT') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchAllStats = async () => {
    setLoadingStats(true);
    try {
      await followerStorage.init();
      const [storageStats, recStats] = await Promise.allSettled([
        followerStorage.getStats(),
        followerStorage.getReconciliationStats()
      ]);

      if (storageStats.status === 'fulfilled' && storageStats.value) {
        setStats(storageStats.value);
      }
      if (recStats.status === 'fulfilled' && recStats.value && recStats.value.success) {
        setReconcileStats(recStats.value.stats);
      }
    } catch (err) {
      console.warn('Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchFollowers = async (pageNum, query) => {
    setIsLoadingList(true);
    try {
      const data = await followerStorage.getFollowersList(query, pageNum, limit);
      if (data && data.success) {
        setFollowersList(data.followers || []);
        setTotalFollowers(data.total || 0);
        setPage(pageNum);
      }
    } catch (err) {
      console.warn('Failed to load followers list:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const fetchUnfollowed = async (pageNum, query) => {
    setIsLoadingUnfollowed(true);
    try {
      const data = await followerStorage.getUnfollowedList(query, pageNum, limit);
      if (data && data.success) {
        setUnfollowedList(data.unfollowed || data.unfollowers || []);
        setTotalUnfollowed(data.total || (data.unfollowed ? data.unfollowed.length : 0));
        setUnfollowedPage(pageNum);
      }
    } catch (err) {
      console.warn('Failed to load unfollowed list:', err);
    } finally {
      setIsLoadingUnfollowed(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await followerStorage.getImportHistory();
      if (data && data.success) {
        setImportHistory(data.imports || []);
      }
    } catch (err) {
      console.warn('Failed to load import history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const data = await followerStorage.getAuditLogs();
      if (data && data.success) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchFollowers(1, searchQuery);
  };

  const handleUnfollowedSearchSubmit = (e) => {
    e.preventDefault();
    fetchUnfollowed(1, unfollowedSearch);
  };

  const handleProfileCheck = async (e) => {
    if (e) e.preventDefault();
    if (!checkInput.trim()) return;

    setIsChecking(true);
    setCheckResult(null);

    const clean = checkInput.trim().toLowerCase().replace(/^@+/, '');
    try {
      const result = await followerStorage.checkFollower(clean);
      const matchedSubmission = staffByUsername.get(clean);

      setCheckResult({
        ...result,
        searchedHandle: clean,
        matchedSubmission: matchedSubmission || null
      });
    } catch (err) {
      setCheckResult({
        exists: false,
        isFollower: false,
        searchedHandle: clean,
        error: err.message
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Open file picker (single unified button for all JSON files)
  const triggerImportPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Read files (single or multiple like followers_1.json, followers_2.json) and execute import
  const handleFileSelection = async (e) => {
    const rawFiles = Array.from(e.target.files || (e.dataTransfer && e.dataTransfer.files) || []);
    if (!rawFiles || rawFiles.length === 0) return;

    const jsonFiles = rawFiles.filter(f => f.name.toLowerCase().endsWith('.json'));
    if (jsonFiles.length === 0) {
      alert('Please select valid Instagram follower JSON files (.json).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Automatically determine mode: if current followers is 0 -> BASELINE, else -> RECONCILIATION
    const currentActive = stats.total || stats.activeCount || reconcileStats.currentActiveFollowers || 0;
    const mode = currentActive === 0 ? 'BASELINE' : 'RECONCILIATION';
    const modeLabel = mode === 'BASELINE' ? 'Baseline Setup' : 'Daily Reconciliation';

    const totalFileSizeBytes = jsonFiles.reduce((acc, f) => acc + f.size, 0);
    const combinedSizeStr = totalFileSizeBytes > 1024 * 1024
      ? `${(totalFileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(totalFileSizeBytes / 1024).toLocaleString()} KB`;
    const fileLabel = jsonFiles.length === 1
      ? jsonFiles[0].name
      : `${jsonFiles.length} files (${jsonFiles.map(f => f.name).slice(0, 3).join(', ')}${jsonFiles.length > 3 ? '...' : ''})`;

    // 1. Open Visual Progress Modal immediately
    setImportModal({
      isOpen: true,
      mode,
      phase: 'reading',
      progressPercent: 10,
      statusText: `Preparing to process ${jsonFiles.length} file${jsonFiles.length > 1 ? 's' : ''}...`,
      fileName: fileLabel,
      fileCount: jsonFiles.length,
      fileSizeStr: combinedSizeStr,
      totalRecords: 0,
      metrics: null,
      error: null
    });
    setUploadToast(null);

    try {
      const allRawItems = [];

      // 2. Read and parse each JSON file
      for (let i = 0; i < jsonFiles.length; i++) {
        const file = jsonFiles[i];
        const stepProgress = 12 + Math.round(((i + 0.5) / jsonFiles.length) * 38);
        setImportModal(prev => ({
          ...prev,
          phase: 'reading',
          progressPercent: stepProgress,
          statusText: `Reading file ${i + 1} of ${jsonFiles.length}: ${file.name}...`
        }));

        const text = await file.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (jsonErr) {
          throw new Error(`Invalid JSON format in "${file.name}": ${jsonErr.message}`);
        }

        const items = extractItemsFromParsedJson(json);
        allRawItems.push(...items);
        await new Promise(r => setTimeout(r, 60));
      }

      if (allRawItems.length === 0) {
        throw new Error(`No follower items found in the ${jsonFiles.length} uploaded file(s).`);
      }

      // 3. Extract & Combine items across all files
      setImportModal(prev => ({
        ...prev,
        phase: 'extracting',
        progressPercent: 60,
        statusText: `Combining ${allRawItems.length.toLocaleString()} records across ${jsonFiles.length} file(s)...`,
        totalRecords: allRawItems.length
      }));

      await new Promise(r => setTimeout(r, 180));

      setImportModal(prev => ({
        ...prev,
        phase: 'extracting',
        progressPercent: 75,
        statusText: `Found ${allRawItems.length.toLocaleString()} records across all files. Reconciling database...`
      }));

      await new Promise(r => setTimeout(r, 180));

      // 4. Send combined payload to server for atomic reconciliation / baseline commit
      setImportModal(prev => ({
        ...prev,
        phase: 'syncing',
        progressPercent: 86,
        statusText: mode === 'BASELINE'
          ? `Establishing clean baseline of ${allRawItems.length.toLocaleString()} followers...`
          : `Reconciling ${allRawItems.length.toLocaleString()} followers to detect new follows & unfollowers...`
      }));

      const result = await followerStorage.commitReconciliation(
        allRawItems,
        mode,
        'Admin'
      );

      // 5. Update submissions & local cache
      setImportModal(prev => ({
        ...prev,
        phase: 'syncing',
        progressPercent: 96,
        statusText: 'Updating staff submission credits and cache...'
      }));

      await dbService.syncSubmissionsWithServer();
      await fetchAllStats();
      await fetchFollowers(1, searchQuery);
      if (activeTab === 'UNFOLLOWED') fetchUnfollowed(1, unfollowedSearch);
      if (activeTab === 'HISTORY') fetchHistory();
      if (activeTab === 'AUDIT') fetchAuditLogs();

      // 6. Complete!
      setImportModal(prev => ({
        ...prev,
        phase: 'completed',
        progressPercent: 100,
        statusText: 'Import completed successfully!',
        metrics: result
      }));

      setUploadToast({
        type: 'success',
        message: `${modeLabel} Completed! ${(result.validUnique || allRawItems.length).toLocaleString()} followers processed across ${jsonFiles.length} file(s).`
      });

    } catch (err) {
      console.error('Import failed:', err);
      setImportModal(prev => ({
        ...prev,
        phase: 'error',
        progressPercent: 0,
        statusText: 'Import Failed',
        error: err.message
      }));
      setUploadToast({
        type: 'error',
        message: `Import Error: ${err.message}`
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Execute Database Reset
  const handleExecuteReset = async (e) => {
    e.preventDefault();
    if (resetConfirmation.trim().toUpperCase() !== 'RESET') {
      setResetError('Please type "RESET" in uppercase to confirm.');
      return;
    }
    if (!resetPassword) {
      setResetError('Admin reset password is required.');
      return;
    }

    setIsResetting(true);
    setResetError('');
    try {
      const res = await followerStorage.resetDatabase(resetPassword, resetConfirmation);
      setShowResetModal(false);
      setResetPassword('');
      setResetConfirmation('');

      setUploadToast({
        type: 'success',
        message: `Follower database reset complete! Cleared obsolete baseline. Employee submissions reset to Pending verification. You can now upload a fresh baseline.`
      });

      // Refresh stats & list
      await fetchAllStats();
      await fetchFollowers(1, '');
      if (activeTab === 'UNFOLLOWED') fetchUnfollowed(1, '');
      if (activeTab === 'HISTORY') fetchHistory();
      if (activeTab === 'AUDIT') fetchAuditLogs();
    } catch (err) {
      setResetError(err.message || 'Reset failed. Check password.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportCSV = () => {
    if (followersList.length === 0) return;
    const headers = ['Username', 'Profile Link', 'Status', 'Followed At (dd/mm/yyyy hh:mm)', 'Timestamp'];
    const rows = followersList.map(f => [
      f.username,
      f.href,
      f.status || 'active',
      f.followedAtFormatted || '',
      f.timestamp || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(r => r.map(field => `"${field}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `instagram_followers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const displayedFollowers = useMemo(() => {
    if (filterType === 'STAFF_MATCHES') {
      return followersList.filter(f => {
        const k = (f.key || f.username || '').toLowerCase().trim();
        return staffByUsername.has(k);
      });
    }
    return followersList;
  }, [followersList, filterType, staffByUsername]);

  // Key stats
  const activeFollowerCount = reconcileStats.currentActiveFollowers || stats.total || 0;
  const unfollowedCount = reconcileStats.unfollowedFollowers || 0;
  const latestNewFollowers = reconcileStats.latestImport?.newFollowers ?? 0;
  const latestUnfollowers = reconcileStats.latestImport?.newUnfollowers ?? 0;
  const activeSubmissionsCount = reconcileStats.activeSubmissionsCount || submissions.filter(s => s.status === 'Valid Submission' || s.status === 'Valid').length;
  const unfollowedSubmissionsCount = reconcileStats.unfollowedSubmissionsCount || submissions.filter(s => s.status === 'Unfollowed' || s.status === 'unfollowed').length;
  const pendingSubmissionsCount = reconcileStats.pendingSubmissionsCount || submissions.filter(s => s.status === 'Pending Submission').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Toast Notification Banner */}
      {uploadToast && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '12px',
          backgroundColor: uploadToast.type === 'success' ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)',
          border: `1px solid ${uploadToast.type === 'success' ? 'rgba(52, 199, 89, 0.25)' : 'rgba(255, 59, 48, 0.25)'}`,
          color: uploadToast.type === 'success' ? '#1b5e20' : '#b71c1c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          fontWeight: 600
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {uploadToast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{uploadToast.message}</span>
          </div>
          <button 
            onClick={() => setUploadToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelection}
        multiple
        accept=".json"
        style={{ display: 'none' }}
      />

      {/* TOP CONTROL BAR: Mode Actions & Reset Baseline */}
      <div className="dashboard-section-card" style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
        border: '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'rgba(225, 48, 108, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#e1306c'
          }}>
            <Instagram size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
              Instagram Follower Tracking
            </h2>
            <p style={{ fontSize: '11.5px', color: '#86868b', margin: '2px 0 0 0' }}>
              Upload your Instagram follower JSON export to track active followers, new follows, and unfollowers.
            </p>
          </div>
        </div>

        {/* Action Buttons: Unified Import Followers + Reset Baseline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Single Unified Import Button (Auto Baseline / Reconciliation, Multiple Files) */}
          <button
            type="button"
            onClick={triggerImportPicker}
            disabled={isUploading}
            title="Import Instagram followers JSON export (select one or multiple files: followers_1.json, followers_2.json...)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 20px',
              borderRadius: '980px',
              backgroundColor: '#0071e3',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 10px rgba(0, 113, 227, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            {isUploading ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}
            <span>Import Followers</span>
          </button>

          {/* Protected Reset Baseline Button */}
          <button
            type="button"
            onClick={() => {
              setResetError('');
              setResetPassword('');
              setResetConfirmation('');
              setShowResetModal(true);
            }}
            title="Admin-only: Reset follower database & obsolete snapshots to start fresh baseline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '980px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#dc2626',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw size={13} />
            <span>Reset Baseline</span>
          </button>
        </div>
      </div>

      {/* 8 RECONCILIATION STATS CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px'
      }}>
        {/* 1. Current Active Followers */}
        <div className="dashboard-section-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Current Active Followers
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1d1d1f', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {activeFollowerCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>
            Authoritative Canonical Set
          </div>
        </div>

        {/* 2. Unfollowed Followers */}
        <div className="dashboard-section-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Detected Unfollowers
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {unfollowedCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 500, marginTop: '2px' }}>
            Omitted from latest snapshot
          </div>
        </div>

        {/* 3. Latest Import New Followers */}
        <div className="dashboard-section-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Latest Import New
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0071e3', marginTop: '4px', letterSpacing: '-0.02em' }}>
            +{latestNewFollowers.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 500, marginTop: '2px' }}>
            Newly detected followers
          </div>
        </div>

        {/* 4. Latest Import Newly Unfollowed */}
        <div className="dashboard-section-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Latest Import Unfollowed
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ea580c', marginTop: '4px', letterSpacing: '-0.02em' }}>
            -{latestUnfollowers.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 500, marginTop: '2px' }}>
            Missing from snapshot
          </div>
        </div>

        {/* 5. Total Active Staff Submissions */}
        <div className="dashboard-section-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Staff Submissions
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {activeSubmissionsCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 500, marginTop: '2px' }}>
            Verified & currently following
          </div>
        </div>

        {/* 6. Total Unfollowed Submissions */}
        <div className="dashboard-section-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Unfollowed Submissions
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#64748b', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {unfollowedSubmissionsCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 500, marginTop: '2px' }}>
            Staff credit deducted
          </div>
        </div>

        {/* 7. Pending Staff Submissions */}
        <div className="dashboard-section-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pending Submissions
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ea580c', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {pendingSubmissionsCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 500, marginTop: '2px' }}>
            Awaiting follower match
          </div>
        </div>

        {/* 8. Last Reconciliation Time */}
        <div className="dashboard-section-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Last Reconciliation
          </div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#1d1d1f', marginTop: '8px', fontFamily: 'monospace' }}>
            {reconcileStats.lastReconciliationTime ? formatFollowerTimestamp(new Date(reconcileStats.lastReconciliationTime).getTime()) : (stats.lastUpdated ? formatFollowerTimestamp(new Date(stats.lastUpdated).getTime()) : 'Ready')}
          </div>
          <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 500, marginTop: '4px' }}>
            {reconcileStats.latestImport?.mode ? `Mode: ${reconcileStats.latestImport.mode}` : 'Baseline Ready'}
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS BAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px',
        backgroundColor: '#f1f5f9',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflowX: 'auto'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE')}
          style={{
            padding: '8px 16px',
            borderRadius: '9px',
            fontSize: '12.5px',
            fontWeight: activeTab === 'ACTIVE' ? 700 : 500,
            backgroundColor: activeTab === 'ACTIVE' ? '#ffffff' : 'transparent',
            color: activeTab === 'ACTIVE' ? '#0f172a' : '#64748b',
            border: 'none',
            boxShadow: activeTab === 'ACTIVE' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Users size={14} style={{ color: activeTab === 'ACTIVE' ? '#0071e3' : 'inherit' }} />
          <span>Active Followers ({activeFollowerCount.toLocaleString()})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('UNFOLLOWED')}
          style={{
            padding: '8px 16px',
            borderRadius: '9px',
            fontSize: '12.5px',
            fontWeight: activeTab === 'UNFOLLOWED' ? 700 : 500,
            backgroundColor: activeTab === 'UNFOLLOWED' ? '#ffffff' : 'transparent',
            color: activeTab === 'UNFOLLOWED' ? '#dc2626' : '#64748b',
            border: 'none',
            boxShadow: activeTab === 'UNFOLLOWED' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <UserMinus size={14} style={{ color: activeTab === 'UNFOLLOWED' ? '#dc2626' : 'inherit' }} />
          <span>Unfollowed Accounts ({unfollowedCount.toLocaleString()})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('HISTORY')}
          style={{
            padding: '8px 16px',
            borderRadius: '9px',
            fontSize: '12.5px',
            fontWeight: activeTab === 'HISTORY' ? 700 : 500,
            backgroundColor: activeTab === 'HISTORY' ? '#ffffff' : 'transparent',
            color: activeTab === 'HISTORY' ? '#0f172a' : '#64748b',
            border: 'none',
            boxShadow: activeTab === 'HISTORY' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <History size={14} style={{ color: activeTab === 'HISTORY' ? '#0284c7' : 'inherit' }} />
          <span>Reconciliation History</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AUDIT')}
          style={{
            padding: '8px 16px',
            borderRadius: '9px',
            fontSize: '12.5px',
            fontWeight: activeTab === 'AUDIT' ? 700 : 500,
            backgroundColor: activeTab === 'AUDIT' ? '#ffffff' : 'transparent',
            color: activeTab === 'AUDIT' ? '#0f172a' : '#64748b',
            border: 'none',
            boxShadow: activeTab === 'AUDIT' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <ShieldAlert size={14} style={{ color: activeTab === 'AUDIT' ? '#e11d48' : 'inherit' }} />
          <span>Admin Audit Trail</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CHECKER')}
          style={{
            padding: '8px 16px',
            borderRadius: '9px',
            fontSize: '12.5px',
            fontWeight: activeTab === 'CHECKER' ? 700 : 500,
            backgroundColor: activeTab === 'CHECKER' ? '#ffffff' : 'transparent',
            color: activeTab === 'CHECKER' ? '#0f172a' : '#64748b',
            border: 'none',
            boxShadow: activeTab === 'CHECKER' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Search size={14} style={{ color: activeTab === 'CHECKER' ? '#7c3aed' : 'inherit' }} />
          <span>Profile Inspector</span>
        </button>
      </div>

      {/* TAB CONTENT 1: ACTIVE FOLLOWERS DIRECTORY */}
      {activeTab === 'ACTIVE' && (
        <div className="dashboard-section-card" style={{ padding: '20px' }}>
          {/* Table Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '16px'
          }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                Active Followers Directory ({totalFollowers.toLocaleString()})
              </h3>
              <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0' }}>
                Verified active accounts present in the latest reconciled snapshot.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Filter Toggle Pills */}
              <div style={{
                display: 'inline-flex',
                padding: '2px',
                borderRadius: '980px',
                backgroundColor: 'rgba(118, 118, 128, 0.12)',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '980px',
                    border: 'none',
                    backgroundColor: filterType === 'ALL' ? '#ffffff' : 'transparent',
                    color: filterType === 'ALL' ? '#1d1d1f' : '#64748b',
                    fontSize: '11.5px',
                    fontWeight: filterType === 'ALL' ? 700 : 500,
                    cursor: 'pointer',
                    boxShadow: filterType === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  All Active
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('STAFF_MATCHES')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '980px',
                    border: 'none',
                    backgroundColor: filterType === 'STAFF_MATCHES' ? '#34c759' : 'transparent',
                    color: filterType === 'STAFF_MATCHES' ? '#ffffff' : '#15803d',
                    fontSize: '11.5px',
                    fontWeight: filterType === 'STAFF_MATCHES' ? 700 : 600,
                    cursor: 'pointer',
                    boxShadow: filterType === 'STAFF_MATCHES' ? '0 1px 3px rgba(52, 199, 89, 0.3)' : 'none'
                  }}
                >
                  ✓ Staff Outreach Matches ({activeSubmissionsCount})
                </button>
              </div>

              {/* Search Input */}
              <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#86868b' }} />
                <input
                  type="text"
                  placeholder="Search username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '6px 12px 6px 32px',
                    borderRadius: '980px',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    backgroundColor: 'rgba(118, 118, 128, 0.08)',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#1d1d1f',
                    outline: 'none',
                    width: '180px'
                  }}
                />
              </form>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 14px',
                  borderRadius: '980px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: '#ffffff',
                  color: '#1d1d1f',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <Download size={13} style={{ color: '#0071e3' }} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', color: '#86868b' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Profile Username</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Followed Date & Time</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Staff Attribution</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedFollowers.map((f, idx) => {
                  const sub = staffByUsername.get(f.key || f.username?.toLowerCase());
                  return (
                    <tr key={f.key || idx} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(225, 48, 108, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#e1306c',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            {f.username ? f.username.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span style={{ fontWeight: 600, color: '#1d1d1f', fontFamily: 'monospace' }}>
                            @{f.username}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(22, 163, 74, 0.1)',
                          color: '#16a34a',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          Active
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', color: '#1d1d1f', fontFamily: 'monospace', fontWeight: 500 }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(0, 113, 227, 0.06)',
                          color: '#0071e3',
                          fontSize: '11.5px'
                        }}>
                          {f.followedAtFormatted || 'Recorded'}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        {sub ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '980px',
                              backgroundColor: 'rgba(52, 199, 89, 0.1)',
                              color: '#34c759',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              ✓ {sub.employeeName} ({sub.employeeId})
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#86868b', fontSize: '11px' }}>
                            Organic Follower
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <a
                          href={f.href || `https://www.instagram.com/${f.username}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 10px',
                            borderRadius: '980px',
                            backgroundColor: 'rgba(118, 118, 128, 0.08)',
                            color: '#1d1d1f',
                            fontSize: '11px',
                            fontWeight: 500,
                            textDecoration: 'none'
                          }}
                        >
                          <span>Profile</span>
                          <ExternalLink size={10} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {followersList.length === 0 && !isLoadingList && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#86868b' }}>
                No active followers found matching "{searchQuery}".
              </div>
            )}

            {isLoadingList && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: '#86868b' }}>
                Loading followers from database...
              </div>
            )}
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            fontSize: '12px',
            color: '#86868b'
          }}>
            <span>Showing page {page} of {Math.ceil(totalFollowers / limit) || 1}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => fetchFollowers(page - 1, searchQuery)}
                disabled={page <= 1}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: page <= 1 ? 'rgba(0,0,0,0.02)' : '#ffffff',
                  color: page <= 1 ? '#86868b' : '#1d1d1f',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>
              <button
                onClick={() => fetchFollowers(page + 1, searchQuery)}
                disabled={page >= Math.ceil(totalFollowers / limit)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: page >= Math.ceil(totalFollowers / limit) ? 'rgba(0,0,0,0.02)' : '#ffffff',
                  color: page >= Math.ceil(totalFollowers / limit) ? '#86868b' : '#1d1d1f',
                  cursor: page >= Math.ceil(totalFollowers / limit) ? 'not-allowed' : 'pointer'
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: UNFOLLOWED ACCOUNTS DIRECTORY */}
      {activeTab === 'UNFOLLOWED' && (
        <div className="dashboard-section-card" style={{ padding: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '16px'
          }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserMinus size={18} />
                <span>Detected Unfollowers Directory ({totalUnfollowed.toLocaleString()})</span>
              </h3>
              <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0' }}>
                Accounts previously active that were missing from the latest reconciled complete follower snapshot.
              </p>
            </div>

            <form onSubmit={handleUnfollowedSearchSubmit} style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#86868b' }} />
              <input
                type="text"
                placeholder="Search unfollowed username..."
                value={unfollowedSearch}
                onChange={(e) => setUnfollowedSearch(e.target.value)}
                style={{
                  padding: '6px 12px 6px 32px',
                  borderRadius: '980px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: 'rgba(118, 118, 128, 0.08)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#1d1d1f',
                  outline: 'none',
                  width: '220px'
                }}
              />
            </form>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', color: '#86868b' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Username</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Unfollow Detected</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Associated Staff Submission</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {unfollowedList.map((u, idx) => {
                  const sub = staffByUsername.get(u.key || u.username?.toLowerCase());
                  return (
                    <tr key={u.key || idx} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 600, color: '#dc2626', fontFamily: 'monospace' }}>
                          @{u.username}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: '#dc2626',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          Unfollowed
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b' }}>
                        {(u.lastUnfollowedAt || u.last_unfollowed_at) ? formatFollowerTimestamp(new Date(u.lastUnfollowedAt || u.last_unfollowed_at).getTime()) : 'Recorded'}
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        {sub ? (
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                            Submitted by <strong style={{ color: '#1d1d1f' }}>{sub.employeeName}</strong> ({sub.employeeId}) on {sub.date} • <span style={{ color: '#dc2626', fontWeight: 600 }}>Credit Deducted</span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>Organic / Uncredited</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <a
                          href={u.href || `https://www.instagram.com/${u.username}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 10px',
                            borderRadius: '980px',
                            backgroundColor: 'rgba(118, 118, 128, 0.08)',
                            color: '#1d1d1f',
                            fontSize: '11px',
                            textDecoration: 'none'
                          }}
                        >
                          <span>Profile</span>
                          <ExternalLink size={10} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {unfollowedList.length === 0 && !isLoadingUnfollowed && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#86868b' }}>
                No unfollowed accounts detected in the current reconciliation history.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: RECONCILIATION IMPORT HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="dashboard-section-card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={18} style={{ color: '#0284c7' }} />
              <span>Reconciliation Snapshots & Import Audit Log</span>
            </h3>
            <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0' }}>
              Chronological log of full-list imports, baseline setups, and set-comparison metrics.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', color: '#86868b' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Import ID</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Mode</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Total Input</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Unique</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Retained</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#0071e3' }}>+New</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#dc2626' }}>-Unfollowed</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Net Change</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Operator</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((imp, idx) => {
                  const importId = imp.id || imp.import_id || `IMP_${idx + 1}`;
                  const totalInput = imp.totalSubmitted ?? imp.total_submitted_records ?? 0;
                  const unique = imp.validUnique ?? imp.valid_unique_usernames ?? 0;
                  const retained = imp.retainedFollowers ?? imp.retained_followers ?? 0;
                  const newFollowers = imp.newFollowers ?? imp.new_followers ?? 0;
                  const newUnfollowers = imp.newUnfollowers ?? imp.new_unfollowers ?? 0;
                  const net = imp.netChange ?? ((newFollowers || 0) - (newUnfollowers || 0));
                  return (
                    <tr key={importId || idx} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                        {importId}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#475569' }}>
                        {imp.timestamp ? formatFollowerTimestamp(new Date(imp.timestamp).getTime()) : ''}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '6px',
                          backgroundColor: imp.mode === 'BASELINE' ? '#e0f2fe' : '#f1f5f9',
                          color: imp.mode === 'BASELINE' ? '#0369a1' : '#334155',
                          fontSize: '10.5px',
                          fontWeight: 700
                        }}>
                          {imp.mode}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        {totalInput.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                        {unique.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        {retained.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0071e3' }}>
                        +{newFollowers}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                        -{newUnfollowers}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: net >= 0 ? '#16a34a' : '#dc2626' }}>
                        {net >= 0 ? `+${net}` : net}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>
                        {imp.operator || 'Admin'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          fontSize: '10.5px',
                          fontWeight: 700
                        }}>
                          {imp.status || 'COMPLETED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {importHistory.length === 0 && !isLoadingHistory && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: '#86868b' }}>
                No import history recorded yet. Perform Mode A (Baseline) or Mode B (Reconciliation) above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: ADMIN AUDIT TRAIL */}
      {activeTab === 'AUDIT' && (
        <div className="dashboard-section-card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e11d48', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={18} />
              <span>Administrative Action & Security Audit Trail</span>
            </h3>
            <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0' }}>
              Security-sensitive actions including database resets, password verification attempts, and snapshot operations.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', color: '#86868b' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Log ID</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Action</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Target</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Operator</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, idx) => (
                  <tr key={log.id || idx} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#0f172a' }}>{log.id}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#475569' }}>
                      {log.timestamp ? formatFollowerTimestamp(new Date(log.timestamp).getTime()) : ''}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: log.action?.includes('RESET') ? '#ffe4e6' : '#f1f5f9',
                        color: log.action?.includes('RESET') ? '#e11d48' : '#334155',
                        fontWeight: 700,
                        fontSize: '11px'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#334155' }}>{log.target}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{log.operator || 'Admin'}</td>
                    <td style={{ padding: '8px 10px', color: '#475569', fontSize: '11.5px' }}>
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {auditLogs.length === 0 && !isLoadingAudit && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: '#86868b' }}>
                No security audit records logged.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: PROFILE INSPECTOR */}
      {activeTab === 'CHECKER' && (
        <div className="dashboard-section-card" style={{ padding: '20px', maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Search size={18} style={{ color: '#0071e3' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
              Instant O(1) Follower & Attribution Inspector
            </h3>
          </div>
          <p style={{ fontSize: '12.5px', color: '#86868b', margin: '0 0 14px 0' }}>
            Enter any Instagram handle or profile URL to inspect active status, follow timestamp, and linked employee attribution.
          </p>

          <form onSubmit={handleProfileCheck} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="e.g. @username or instagram.com/username"
              value={checkInput}
              onChange={(e) => setCheckInput(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '980px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                backgroundColor: 'rgba(118, 118, 128, 0.08)',
                fontSize: '13px',
                color: '#1d1d1f',
                outline: 'none',
                fontWeight: 500
              }}
            />
            <button
              type="submit"
              disabled={isChecking || !checkInput.trim()}
              style={{
                padding: '8px 18px',
                borderRadius: '980px',
                backgroundColor: '#1d1d1f',
                color: '#ffffff',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isChecking ? 'Checking...' : 'Inspect Handle'}
            </button>
          </form>

          {checkResult && (
            <div style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: checkResult.isFollower ? 'rgba(52, 199, 89, 0.08)' : (checkResult.status === 'unfollowed' ? '#fee2e2' : '#f8fafc'),
              border: `1px solid ${checkResult.isFollower ? 'rgba(52, 199, 89, 0.25)' : (checkResult.status === 'unfollowed' ? '#fca5a5' : '#e2e8f0')}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#1d1d1f', fontFamily: 'monospace' }}>
                  @{checkResult.searchedHandle}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '980px',
                  backgroundColor: checkResult.isFollower ? '#16a34a' : (checkResult.status === 'unfollowed' ? '#dc2626' : '#64748b'),
                  color: '#ffffff'
                }}>
                  {checkResult.isFollower ? '✓ Verified Active Follower' : (checkResult.status === 'unfollowed' ? '⚠ Unfollowed Account' : 'Not In Database')}
                </span>
              </div>

              {checkResult.followedAtFormatted && (
                <div style={{ fontSize: '12px', color: '#334155' }}>
                  Followed on: <strong style={{ color: '#0071e3', fontFamily: 'monospace' }}>{checkResult.followedAtFormatted}</strong>
                </div>
              )}

              {checkResult.matchedSubmission && (
                <div style={{ fontSize: '11.5px', color: '#475569', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '6px' }}>
                  Linked Employee: <strong style={{ color: '#0f172a' }}>{checkResult.matchedSubmission.employeeName}</strong> ({checkResult.matchedSubmission.employeeId}) • Status: <strong>{checkResult.matchedSubmission.status}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VISUAL PROGRESS & IMPORT MODAL */}
      {importModal.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: importModal.mode === 'BASELINE' ? '#e0f2fe' : '#ede9fe',
                  color: importModal.mode === 'BASELINE' ? '#0369a1' : '#6d28d9',
                  border: `1px solid ${importModal.mode === 'BASELINE' ? '#bae6fd' : '#ddd6fe'}`
                }}>
                  {importModal.mode === 'BASELINE' ? 'Baseline Setup' : 'Daily Reconciliation'}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: importModal.phase === 'completed' ? '#dcfce7' : (importModal.phase === 'error' ? '#fee2e2' : '#f1f5f9'),
                  color: importModal.phase === 'completed' ? '#15803d' : (importModal.phase === 'error' ? '#b91c1c' : '#475569')
                }}>
                  {importModal.phase === 'completed' ? '✓ Completed' : (importModal.phase === 'error' ? '⚠ Error' : 'In Progress')}
                </span>
              </div>

              {(importModal.phase === 'completed' || importModal.phase === 'error') && (
                <button
                  type="button"
                  onClick={() => setImportModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    border: 'none',
                    background: '#f1f5f9',
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
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Title & File Pill */}
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                {importModal.phase === 'completed'
                  ? 'Import Completed Successfully!'
                  : (importModal.phase === 'error' ? 'Import Failed' : 'Importing Followers...')}
              </h3>
              {importModal.fileName && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#475569',
                  backgroundColor: '#f8fafc',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontFamily: 'monospace'
                }}>
                  <FileText size={13} style={{ color: '#0284c7' }} />
                  <span>{importModal.fileName}</span>
                  {importModal.fileSizeStr && (
                    <span style={{ color: '#94a3b8' }}>({importModal.fileSizeStr})</span>
                  )}
                </div>
              )}
            </div>

            {/* VISUAL ANIMATED PROGRESS BAR */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '18px 20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                  {importModal.statusText || 'Processing...'}
                </span>
                <span style={{
                  fontSize: '17px',
                  fontWeight: 900,
                  color: importModal.phase === 'completed' ? '#16a34a' : '#0071e3',
                  fontFamily: 'monospace'
                }}>
                  {importModal.progressPercent}%
                </span>
              </div>

              {/* Progress Track & Fill */}
              <div style={{
                height: '14px',
                borderRadius: '9999px',
                backgroundColor: '#e2e8f0',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
              }}>
                <div style={{
                  width: `${importModal.progressPercent}%`,
                  height: '100%',
                  borderRadius: '9999px',
                  background: importModal.phase === 'completed'
                    ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(90deg, #0071e3 0%, #38bdf8 50%, #6366f1 100%)',
                  transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 6px rgba(0, 113, 227, 0.4)'
                }} />
              </div>

              {/* 3 Step Visual Indicators */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #e2e8f0'
              }}>
                {/* Step 1: Read File */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {importModal.phase === 'reading' ? (
                    <RefreshCw size={13} className="spin" style={{ color: '#0071e3', flexShrink: 0 }} />
                  ) : (importModal.progressPercent > 32 || importModal.phase === 'completed' ? (
                    <CheckCircle2 size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1.5px solid #cbd5e1', flexShrink: 0 }} />
                  ))}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: importModal.progressPercent >= 10 ? '#0f172a' : '#94a3b8' }}>
                    1. Read File{importModal.fileCount > 1 ? `s (${importModal.fileCount})` : ''}
                  </span>
                </div>

                {/* Step 2: Combine & Extract Handles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {importModal.phase === 'extracting' ? (
                    <RefreshCw size={13} className="spin" style={{ color: '#0071e3', flexShrink: 0 }} />
                  ) : (importModal.progressPercent > 68 || importModal.phase === 'completed' ? (
                    <CheckCircle2 size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1.5px solid #cbd5e1', flexShrink: 0 }} />
                  ))}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: importModal.progressPercent >= 50 ? '#0f172a' : '#94a3b8' }}>
                    2. Combine & Extract
                  </span>
                </div>

                {/* Step 3: Sync Database */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {importModal.phase === 'syncing' ? (
                    <RefreshCw size={13} className="spin" style={{ color: '#0071e3', flexShrink: 0 }} />
                  ) : (importModal.phase === 'completed' ? (
                    <CheckCircle2 size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1.5px solid #cbd5e1', flexShrink: 0 }} />
                  ))}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: importModal.progressPercent >= 80 ? '#0f172a' : '#94a3b8' }}>
                    3. Sync Database
                  </span>
                </div>
              </div>
            </div>

            {/* ERROR DISPLAY */}
            {importModal.phase === 'error' && (
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>Import Error</div>
                  <div>{importModal.error}</div>
                </div>
              </div>
            )}

            {/* RESULTS METRICS (WHEN COMPLETED) */}
            {importModal.phase === 'completed' && importModal.metrics && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: importModal.mode === 'BASELINE' ? '#f0fdf4' : '#eff6ff',
                  border: `1px solid ${importModal.mode === 'BASELINE' ? '#bbf7d0' : '#bfdbfe'}`,
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: importModal.mode === 'BASELINE' ? '#166534' : '#1e40af',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} style={{ color: importModal.mode === 'BASELINE' ? '#16a34a' : '#2563eb', flexShrink: 0 }} />
                  <span>
                    {importModal.mode === 'BASELINE'
                      ? `Baseline successfully established! ${importModal.fileCount > 1 ? `Combined ${importModal.fileCount} files with ` : ''}all active followers synchronized into the database.`
                      : `Daily reconciliation finished across ${importModal.fileCount > 1 ? `${importModal.fileCount} files` : 'file'}! New followers and unfollowers have been detected and staff credits updated.`}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px'
                }}>
                  {/* Total Active Followers */}
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Active Followers
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
                      {(importModal.metrics.currentActiveFollowers || importModal.metrics.validUnique || importModal.metrics.activeCount || 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Net Change */}
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      {importModal.mode === 'BASELINE' ? 'Total Unique Valid' : 'Net Follower Change'}
                    </div>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      marginTop: '2px',
                      fontFamily: 'monospace',
                      color: importModal.mode === 'BASELINE'
                        ? '#0071e3'
                        : ((importModal.metrics.netChange || 0) >= 0 ? '#16a34a' : '#dc2626')
                    }}>
                      {importModal.mode === 'BASELINE'
                        ? (importModal.metrics.validUnique || 0).toLocaleString()
                        : ((importModal.metrics.netChange || 0) >= 0 ? `+${importModal.metrics.netChange || 0}` : importModal.metrics.netChange)}
                    </div>
                  </div>

                  {/* New Follows */}
                  {importModal.mode !== 'BASELINE' && (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: '#f0fdf4',
                      border: '1.5px solid #bbf7d0'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                        New Follows
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', marginTop: '2px', fontFamily: 'monospace' }}>
                        +{importModal.metrics.newFollowers || 0}
                      </div>
                    </div>
                  )}

                  {/* Unfollowers */}
                  {importModal.mode !== 'BASELINE' && (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: '#fef2f2',
                      border: '1.5px solid #fecaca'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                        Unfollowed
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', marginTop: '2px', fontFamily: 'monospace' }}>
                        -{importModal.metrics.newUnfollowers || 0}
                      </div>
                    </div>
                  )}

                  {/* Staff Submissions Updated */}
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    gridColumn: 'span 2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                      Employee Outreach Submissions Reconciled:
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#0071e3', fontFamily: 'monospace' }}>
                      {importModal.metrics.submissionsUpdated || 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ACTION BUTTON */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {importModal.phase === 'completed' ? (
                <button
                  type="button"
                  onClick={() => setImportModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: '11px 24px',
                    borderRadius: '9999px',
                    backgroundColor: '#0071e3',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 113, 227, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Check size={16} />
                  <span>Done & View Followers</span>
                </button>
              ) : (importModal.phase === 'error' ? (
                <button
                  type="button"
                  onClick={() => setImportModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '9999px',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={13} className="spin" />
                  <span>Please wait while importing...</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESET FOLLOWER DATABASE MODAL */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.25)',
            border: '1.5px solid #fecaca'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#991b1b', margin: 0 }}>
                  Reset Follower Database / Start Fresh Baseline
                </h3>
                <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Admin-only operation protected by server environment password.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#fff1f2',
              border: '1px solid #ffe4e6',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#9f1239',
              lineHeight: 1.5
            }}>
              <strong>Clear Details:</strong>
              <div style={{ marginTop: '4px' }}>
                • Follower canonical baseline records and import snapshot history will be cleared.<br/>
                • <strong>Preserved:</strong> Employee accounts, staff directories, and submission history are fully preserved.<br/>
                • Submission statuses will be reset to <em>Pending Verification</em> ready to be reconciled against the new baseline.
              </div>
            </div>

            {resetError && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '14px',
                fontWeight: 600
              }}>
                {resetError}
              </div>
            )}

            <form onSubmit={handleExecuteReset} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Server Reset Password (ADMIN_RESET_PASSWORD)
                </label>
                <input
                  type="password"
                  placeholder="Enter Server Reset Password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Confirmation (Type "RESET" to confirm)
                </label>
                <input
                  type="text"
                  placeholder="RESET"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={isResetting}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '9999px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isResetting || !resetPassword || resetConfirmation.trim().toUpperCase() !== 'RESET'}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '9999px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: (isResetting || !resetPassword || resetConfirmation.trim().toUpperCase() !== 'RESET') ? 'not-allowed' : 'pointer',
                    opacity: (isResetting || !resetPassword || resetConfirmation.trim().toUpperCase() !== 'RESET') ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isResetting ? <RefreshCw size={13} className="spin" /> : <RotateCcw size={13} />}
                  <span>{isResetting ? 'Resetting Database...' : 'Execute Baseline Reset'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
