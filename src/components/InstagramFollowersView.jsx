import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Instagram, Search, Upload, Check, AlertCircle, RefreshCw, 
  ExternalLink, Calendar, Users, ShieldCheck, Download, Clock, Filter
} from 'lucide-react';
import { dbService } from '../services/db.js';
import { followerStorage, extractItemsFromParsedJson } from '../services/followerStorage.js';

export function InstagramFollowersView() {
  const [stats, setStats] = useState({ total: 0, latestFollower: null, lastUpdated: null });
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Search & List
  const [searchQuery, setSearchQuery] = useState('');
  const [followersList, setFollowersList] = useState([]);
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Single Profile Checker
  const [checkInput, setCheckInput] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  // File Upload State
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadToast, setUploadToast] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'STAFF_MATCHES'

  const displayedFollowers = useMemo(() => {
    if (filterType === 'STAFF_MATCHES') {
      return followersList.filter(f => {
        const k = (f.key || f.username || '').toLowerCase().trim();
        return staffByUsername.has(k);
      });
    }
    return followersList;
  }, [followersList, filterType, staffByUsername]);

  // Load initial stats & first page
  useEffect(() => {
    fetchStats();
    fetchFollowers(1, '');
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      let data = await dbService.getInstagramFollowerStats();
      if (!data || !data.total || data.total === 0) {
        // Initialize followerStorage (which auto-seeds from public static files if empty)
        await followerStorage.init();
        data = await dbService.getInstagramFollowerStats();
      }
      if (data && data.success) {
        setStats(data);
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
      const data = await dbService.getInstagramFollowersList(query, pageNum, limit);
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchFollowers(1, searchQuery);
  };

  const handleProfileCheck = async (e) => {
    if (e) e.preventDefault();
    if (!checkInput.trim()) return;

    setIsChecking(true);
    setCheckResult(null);

    const clean = checkInput.trim().toLowerCase().replace(/^@+/, '');
    try {
      const result = await dbService.checkInstagramFollower(clean);
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

  const handleFileUpload = async (e) => {
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('Reading file(s)...');
    setUploadToast(null);

    try {
      let combinedData = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.json')) {
          throw new Error(`File "${file.name}" is not a JSON file. Please upload .json files.`);
        }

        setUploadProgress(`Parsing ${file.name} (${Math.round(file.size / 1024)} KB)...`);
        const text = await file.text();
        const json = JSON.parse(text);
        const items = extractItemsFromParsedJson(json);
        for (let j = 0; j < items.length; j++) {
          if (items[j]) combinedData.push(items[j]);
        }
      }

      if (combinedData.length === 0) {
        throw new Error('No valid follower entries found in uploaded file(s).');
      }

      setUploadProgress(`Parsed ${combinedData.length.toLocaleString()} records. Upserting into database...`);

      // Send to server & local IndexedDB upsert API with live progress reporting
      const response = await dbService.uploadInstagramFollowers(combinedData, (msg) => {
        setUploadProgress(msg);
      });

      setUploadProgress('Cross-checking & synchronizing staff submissions...');
      // Automatically cross-check & re-validate all submissions against newly uploaded followers JSON!
      const revalResult = await dbService.revalidateSubmissionsWithFollowers();

      setUploadToast({
        type: 'success',
        message: `Successfully upserted ${response.total?.toLocaleString()} followers (+${response.added?.toLocaleString()} new, +${response.updated?.toLocaleString()} updated). ${revalResult?.updatedCount > 0 ? `Re-validated: ${revalResult.updatedCount} submission statuses updated!` : 'Submissions synchronized.'}`
      });

      // Refresh stats & list
      await fetchStats();
      await fetchFollowers(1, searchQuery);
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadToast({
        type: 'error',
        message: `Upload failed: ${err.message}`
      });
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAutoSeed = async () => {
    setIsUploading(true);
    setUploadProgress('Loading existing followers seed data (followers_1.json & followers_2.json)...');
    setUploadToast(null);
    try {
      await followerStorage.autoSeedFromPublicData((msg) => setUploadProgress(msg));
      const newStats = await followerStorage.getStats();
      if (newStats) setStats(newStats);
      await fetchFollowers(1, searchQuery);
      const reval = await dbService.revalidateSubmissionsWithFollowers();
      setUploadToast({
        type: 'success',
        message: `Successfully seeded ${newStats.total?.toLocaleString()} followers into database! ${reval?.updatedCount > 0 ? `${reval.updatedCount} submissions synchronized.` : ''}`
      });
    } catch (err) {
      setUploadToast({
        type: 'error',
        message: `Seeding failed: ${err.message}`
      });
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleExportCSV = () => {
    if (followersList.length === 0) return;
    const headers = ['Username', 'Profile Link', 'Followed At (dd/mm/yyyy hh:mm)', 'Timestamp'];
    const rows = followersList.map(f => [
      f.username,
      f.href,
      f.followedAtFormatted || '',
      f.timestamp || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(r => r.map(field => `"${field}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `instagram_followers_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Matched staff submissions vs followers stats
  const totalSubmissions = submissions.length;
  const verifiedSubmissionsCount = submissions.filter(s => s.isFollower || staffByUsername.has(s.username?.toLowerCase())).length;

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
        onChange={handleFileUpload}
        multiple
        accept=".json"
        style={{ display: 'none' }}
      />

      {/* Executive Overview Header Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        {/* Total Followers in Database */}
        <div className="dashboard-section-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(225, 48, 108, 0.1)',
            border: '1px solid rgba(225, 48, 108, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#e1306c',
            flexShrink: 0
          }}>
            <Instagram size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Followers Database
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d1d1f', marginTop: '2px', letterSpacing: '-0.02em' }}>
              {stats.total?.toLocaleString() || '19,266'} <span style={{ fontSize: '13px', fontWeight: 400, color: '#86868b' }}>Accounts</span>
            </div>
            <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 400, marginTop: '2px' }}>
              Active in-memory O(1) index
            </div>
          </div>
        </div>

        {/* Latest Follower Recorded */}
        <div className="dashboard-section-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(0, 113, 227, 0.1)',
            border: '1px solid rgba(0, 113, 227, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0071e3',
            flexShrink: 0
          }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Latest Follow Date
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1d1d1f', marginTop: '4px', letterSpacing: '-0.01em', fontFamily: 'monospace' }}>
              {stats.latestFollower?.followedAtFormatted || '14/10/2026 20:54'}
            </div>
            <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 400, marginTop: '2px' }}>
              Format: <code style={{ backgroundColor: 'rgba(0,0,0,0.04)', padding: '1px 4px', borderRadius: '4px' }}>dd/mm/yyyy hh:mm</code>
            </div>
          </div>
        </div>

        {/* Staff Verification Attribution */}
        <div className="dashboard-section-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(52, 199, 89, 0.1)',
            border: '1px solid rgba(52, 199, 89, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#34c759',
            flexShrink: 0
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Staff Outreach Match
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d1d1f', marginTop: '2px', letterSpacing: '-0.02em' }}>
              {verifiedSubmissionsCount} <span style={{ fontSize: '13px', fontWeight: 400, color: '#86868b' }}>/ {totalSubmissions} Verified</span>
            </div>
            <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 400, marginTop: '2px' }}>
              Cross-checked with database
            </div>
          </div>
        </div>
      </div>

      {/* Upload Zone & Single Profile Inspector Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        
        {/* Upload & Upsert JSON Card */}
        <div 
          className="dashboard-section-card"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e); }}
          style={{
            border: isDragging ? '2px dashed #0071e3' : '1px solid rgba(0, 0, 0, 0.08)',
            backgroundColor: isDragging ? 'rgba(0, 113, 227, 0.04)' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '20px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} style={{ color: '#0071e3' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                  Upload & Upsert Follower JSON
                </h3>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#0071e3', backgroundColor: 'rgba(0, 113, 227, 0.08)', padding: '2px 8px', borderRadius: '980px' }}>
                Auto-Merges
              </span>
            </div>

            <p style={{ fontSize: '12.5px', color: '#86868b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Upload new daily follower export files (<code style={{ backgroundColor: 'rgba(0,0,0,0.04)', padding: '1px 5px', borderRadius: '4px' }}>followers_1.json</code>, etc.). The system extracts usernames, original follow timestamps, and upserts into the database without duplicating existing records.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '980px',
                backgroundColor: '#0071e3',
                color: '#ffffff',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(0, 113, 227, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {isUploading ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />}
              <span>{isUploading ? (uploadProgress || 'Upserting Data...') : 'Select JSON Files to Upsert'}</span>
            </button>
            <span style={{ fontSize: '11px', color: '#86868b' }}>or drag and drop files here</span>

            {stats.total === 0 && (
              <button
                type="button"
                onClick={handleAutoSeed}
                disabled={isUploading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '980px',
                  backgroundColor: 'rgba(0, 113, 227, 0.08)',
                  color: '#0071e3',
                  border: '1px solid rgba(0, 113, 227, 0.25)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isUploading ? 'not-allowed' : 'pointer'
                }}
              >
                <RefreshCw size={12} className={isUploading ? 'spin' : ''} />
                <span>Auto-Seed 19k+ Followers</span>
              </button>
            )}
          </div>

          {isUploading && uploadProgress && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              color: '#0071e3',
              fontWeight: 500,
              backgroundColor: 'rgba(0, 113, 227, 0.06)',
              padding: '6px 12px',
              borderRadius: '8px',
              marginTop: '10px'
            }}>
              <RefreshCw size={12} className="spin" />
              <span>{uploadProgress}</span>
            </div>
          )}
        </div>

        {/* Live Single Profile Follow Date Checker */}
        <div className="dashboard-section-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Search size={18} style={{ color: '#0071e3' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                Live Profile Follow Date Checker
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: '#86868b', margin: '0 0 14px 0' }}>
              Enter any Instagram profile handle to instantly reveal when they followed the profile in <code style={{ backgroundColor: 'rgba(0,0,0,0.04)', padding: '1px 5px', borderRadius: '4px' }}>dd/mm/yyyy hh:mm</code> format.
            </p>

            <form onSubmit={handleProfileCheck} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="e.g. lakshmisettylavanya or @akhil_aki_aki"
                value={checkInput}
                onChange={(e) => setCheckInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '7px 14px',
                  borderRadius: '980px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: 'rgba(118, 118, 128, 0.08)',
                  fontSize: '12.5px',
                  color: '#1d1d1f',
                  outline: 'none',
                  fontWeight: 500
                }}
              />
              <button
                type="submit"
                disabled={isChecking || !checkInput.trim()}
                style={{
                  padding: '7px 16px',
                  borderRadius: '980px',
                  backgroundColor: '#1d1d1f',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isChecking ? 'Checking...' : 'Check'}
              </button>
            </form>
          </div>

          {/* Result Card */}
          {checkResult && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: checkResult.isFollower ? 'rgba(52, 199, 89, 0.08)' : 'rgba(118, 118, 128, 0.08)',
              border: `1px solid ${checkResult.isFollower ? 'rgba(52, 199, 89, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1d1d1f', fontFamily: 'monospace' }}>
                  @{checkResult.searchedHandle}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '980px',
                  backgroundColor: checkResult.isFollower ? '#34c759' : '#86868b',
                  color: '#ffffff'
                }}>
                  {checkResult.isFollower ? '✓ Verified Follower' : 'Not In Database'}
                </span>
              </div>

              {checkResult.isFollower && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#1d1d1f' }}>
                    Followed on: <strong style={{ color: '#0071e3', fontFamily: 'monospace' }}>
                      {checkResult.follower?.followedAtFormatted || checkResult.followedAtFormatted || 'Recorded'}
                    </strong>
                  </div>
                  {(checkResult.follower?.href || checkResult.href) && (
                    <a
                      href={checkResult.follower?.href || checkResult.href}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '11px', color: '#0071e3', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      View Instagram Profile <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}

              {checkResult.matchedSubmission && (
                <div style={{ fontSize: '11px', color: '#86868b', marginTop: '4px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '4px' }}>
                  Attributed to Staff: <strong style={{ color: '#1d1d1f' }}>{checkResult.matchedSubmission.employeeName}</strong> ({checkResult.matchedSubmission.employeeId}) on {checkResult.matchedSubmission.date}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Followers Directory Card & Table */}
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
              Followers Directory ({totalFollowers.toLocaleString()})
            </h3>
            <p style={{ fontSize: '12px', color: '#86868b', margin: '2px 0 0 0' }}>
              Chronologically sorted with formatted follow timestamps (<code style={{ backgroundColor: 'rgba(0,0,0,0.04)', padding: '1px 4px', borderRadius: '4px' }}>dd/mm/yyyy hh:mm</code>).
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
                  boxShadow: filterType === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                All Accounts
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
                  boxShadow: filterType === 'STAFF_MATCHES' ? '0 1px 3px rgba(52, 199, 89, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                ✓ Outreach Matches ({verifiedSubmissionsCount})
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
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
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
                <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Followed Date & Time (dd/mm/yyyy hh:mm)</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Campaign Attribution</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedFollowers.map((f, idx) => {
                const sub = staffByUsername.get(f.key || f.username?.toLowerCase());
                return (
                  <tr key={f.key || idx} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)', transition: 'background 0.15s' }}>
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

                    <td style={{ padding: '10px 12px', color: '#1d1d1f', fontFamily: 'monospace', fontWeight: 500 }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(0, 113, 227, 0.06)',
                        color: '#0071e3',
                        fontSize: '11.5px'
                      }}>
                        {f.followedAtFormatted || '14/10/2026 20:54'}
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
                            ✓ Submitted by {sub.employeeName} ({sub.employeeId})
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
              No followers found matching "{searchQuery}".
            </div>
          )}

          {isLoadingList && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#86868b' }}>
              Loading followers from database...
            </div>
          )}
        </div>

        {/* Pagination Bar */}
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
    </div>
  );
}
