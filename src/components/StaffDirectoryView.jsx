import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, ChevronDown, ChevronRight, Copy, Check, Eye, EyeOff, 
  Building2, MapPin, Key, UserCheck, Edit3, X, RotateCcw, Save, Shield,
  Download, Upload, FileSpreadsheet, ArrowRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AP_CONSTITUENCIES } from '../services/constituencyData.js';
import { dbService } from '../services/db.js';

export function StaffDirectoryView() {
  const [employees, setEmployees] = useState(() => dbService.getEmployees());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL'); // 'ALL', 'PARLIAMENT', 'ASSEMBLY'
  const [activeParliamentCode, setActiveParliamentCode] = useState(null); // Collapsed by default
  const [showPasswords, setShowPasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Edit Modal State
  const [editingStaff, setEditingStaff] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', mobile: '', password: '' });
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Excel Import & Detailed Diff Preview Modal State
  const fileInputRef = useRef(null);
  const [importDiffModal, setImportDiffModal] = useState(null); 
  const [diffFilter, setDiffFilter] = useState('ALL'); // 'ALL', 'Name', 'Mobile', 'Password'

  // Group employees by Parliament Code
  const groupedData = useMemo(() => {
    const map = {};
    
    AP_CONSTITUENCIES.forEach(p => {
      map[p.code] = {
        parliament: p,
        parliamentStaff: null,
        assemblyStaff: []
      };
    });

    employees.forEach(emp => {
      const pCode = emp.parliamentCode || (emp.id.startsWith('APP') ? emp.id.substring(0, 5) : null);
      if (pCode && map[pCode]) {
        if (emp.level === 'Parliament' || emp.id === pCode) {
          map[pCode].parliamentStaff = emp;
        } else {
          map[pCode].assemblyStaff.push(emp);
        }
      }
    });

    return map;
  }, [employees]);

  // Filter Parliaments based on Search Query and Level Filter
  const filteredParliaments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    return AP_CONSTITUENCIES.filter(p => {
      const pData = groupedData[p.code];
      if (!pData) return false;

      // Filter level check
      if (filterLevel === 'PARLIAMENT' && !pData.parliamentStaff) return false;

      if (!query) return true;

      // Search match in Parliament details
      const pStaff = pData.parliamentStaff;
      const matchPCode = p.code.toLowerCase().includes(query) || (pStaff?.supportCode && pStaff.supportCode.toLowerCase().includes(query));
      const matchPName = p.name.toLowerCase().includes(query);
      const matchPStaffName = pStaff?.name?.toLowerCase().includes(query);
      const matchPStaffPersonalMob = pStaff?.mobilePersonal && pStaff.mobilePersonal.includes(query);
      const matchPStaffOfficeMob = pStaff?.mobileOffice && pStaff.mobileOffice.includes(query);
      const matchPStaffMobile = pStaff?.mobile && pStaff.mobile.includes(query);
      const matchPStaffId = pStaff?.staffId && pStaff.staffId.toLowerCase().includes(query);

      // Search match in Assembly details
      const matchAssembly = p.assemblies.some(asm => 
        asm.code.toLowerCase().includes(query) || 
        asm.name.toLowerCase().includes(query)
      );

      const matchAssemblyStaff = pData.assemblyStaff.some(st => 
        st.name?.toLowerCase().includes(query) || 
        st.id?.toLowerCase().includes(query) ||
        (st.supportCode && st.supportCode.toLowerCase().includes(query)) ||
        (st.staffId && st.staffId.toLowerCase().includes(query)) ||
        (st.mobilePersonal && st.mobilePersonal.includes(query)) ||
        (st.mobileOffice && st.mobileOffice.includes(query)) ||
        (st.mobile && st.mobile.includes(query))
      );

      return matchPCode || matchPName || matchPStaffName || matchPStaffPersonalMob || matchPStaffOfficeMob || matchPStaffMobile || matchPStaffId || matchAssembly || matchAssemblyStaff;
    });
  }, [searchQuery, filterLevel, groupedData]);

  const toggleExpand = (pCode) => {
    setActiveParliamentCode(prev => prev === pCode ? null : pCode);
  };

  const toggleShowPassword = (empId) => {
    setShowPasswords(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  const copyCredentials = (emp) => {
    const parts = [
      `Support Code: ${emp.supportCode || emp.id}`,
      emp.staffId ? `Staff ID: ${emp.staffId}` : null,
      `Name: ${emp.name}`,
      emp.mobilePersonal ? `Personal Mob: ${emp.mobilePersonal}` : null,
      emp.mobileOffice ? `Office Mob: ${emp.mobileOffice}` : null,
      `Password: ${emp.password || 'password123'}`
    ].filter(Boolean);

    navigator.clipboard.writeText(parts.join(' | '));
    setCopiedId(emp.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Edit Modal for a Staff Member
  const openEditModal = (staffObj, fallbackName = '') => {
    setEditingStaff(staffObj);
    setEditForm({
      name: staffObj?.name || fallbackName,
      staffId: staffObj?.staffId || '',
      mobilePersonal: staffObj?.mobilePersonal || staffObj?.mobile || '',
      mobileOffice: staffObj?.mobileOffice || '',
      password: staffObj?.password || 'password123'
    });
    setShowModalPassword(false);
  };

  // Handle Save Staff Edits
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingStaff) return;

    const personal = editForm.mobilePersonal.trim();
    const office = editForm.mobileOffice.trim();

    const updatedData = {
      ...editingStaff,
      name: editForm.name.trim(),
      staffId: editForm.staffId.trim(),
      mobilePersonal: personal,
      mobileOffice: office,
      mobile: personal || office || editingStaff.mobile,
      password: editForm.password.trim() || 'password123'
    };

    dbService.updateEmployee(updatedData);
    
    // Refresh local directory state
    setEmployees(dbService.getEmployees());
    setEditingStaff(null);

    // Trigger Toast feedback
    setToastMessage(`Updated staff credentials for ${updatedData.supportCode || updatedData.id}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Quick Password Reset Handler
  const handleQuickResetPassword = () => {
    setEditForm(prev => ({ ...prev, password: 'password123' }));
  };

  // 1. Download Excel / CSV Template in PAT Staff Details October 2026 Format
  const handleDownloadTemplate = () => {
    const templateData = employees.map(emp => ({
      'Code': emp.supportCode || emp.id,
      'Constituency Name': emp.assemblyName || emp.parliamentName,
      'Level': emp.level,
      'Staff Name': emp.name,
      'Staff ID': emp.staffId || '',
      'Mobile Personal': emp.mobilePersonal || emp.mobile || '',
      'Mobile Office': emp.mobileOffice || '',
      'Password': emp.password || 'password123'
    }));

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, "PAT_Staff_Details_October_2026.xlsx");

    setToastMessage("PAT Staff Details October 2026 template downloaded successfully!");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 2. Handle Upload & Calculate Detailed Diff / Overrides (Matching PAT Staff Details October 2026)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target.result;
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const currentEmps = dbService.getEmployees();
        const currentMap = new Map();
        currentEmps.forEach(emp => {
          if (emp.id) currentMap.set(emp.id.toUpperCase(), emp);
          if (emp.supportCode) currentMap.set(emp.supportCode.toUpperCase(), emp);
        });

        const changesList = [];
        const itemsToOverride = [];
        let unchangedCount = 0;

        rows.forEach(row => {
          const rawCode = row['Code'] || row['code'] || row['Support Code'] || row['ID'] || row['id'] || row['Staff Code'];
          if (!rawCode) return;

          const empId = String(rawCode).trim().toUpperCase();
          const existing = currentMap.get(empId);

          const newName = String(row['Staff Name'] || row['Name'] || row['name'] || row['Staff Member'] || (existing ? existing.name : '')).trim();
          const newStaffId = String(row['Staff ID'] || row['staffId'] || row['Staff Id'] || row['STAFF ID'] || (existing ? (existing.staffId || '') : '')).trim();
          const newPersonalMob = String(row['Mobile Personal'] || row['Personal Mobile'] || row['Mobile'] || row['Contact'] || (existing ? (existing.mobilePersonal || existing.mobile || '') : '')).trim();
          const newOfficeMob = String(row['Mobile Office'] || row['Office Mobile'] || (existing ? (existing.mobileOffice || '') : '')).trim();
          const newPassword = String(row['Password'] || row['pass'] || row['password'] || (existing ? existing.password : 'password123')).trim();

          if (existing) {
            const diffs = [];
            if (newName && newName !== existing.name) {
              diffs.push({ field: 'Staff Name', oldVal: existing.name, newVal: newName });
            }
            if (newStaffId !== (existing.staffId || '')) {
              diffs.push({ field: 'Staff ID', oldVal: existing.staffId || 'None', newVal: newStaffId || 'None' });
            }
            if (newPersonalMob && newPersonalMob !== (existing.mobilePersonal || existing.mobile || '')) {
              diffs.push({ field: 'Mobile Personal', oldVal: existing.mobilePersonal || existing.mobile || 'None', newVal: newPersonalMob });
            }
            if (newOfficeMob !== (existing.mobileOffice || '')) {
              diffs.push({ field: 'Mobile Office', oldVal: existing.mobileOffice || 'None', newVal: newOfficeMob || 'None' });
            }
            if (newPassword && newPassword !== existing.password) {
              diffs.push({ field: 'Password', oldVal: existing.password, newVal: newPassword });
            }

            if (diffs.length > 0) {
              const updatedObj = {
                ...existing,
                name: newName || existing.name,
                staffId: newStaffId,
                mobilePersonal: newPersonalMob || existing.mobilePersonal || existing.mobile,
                mobileOffice: newOfficeMob,
                mobile: newPersonalMob || newOfficeMob || existing.mobile,
                password: newPassword || existing.password
              };
              changesList.push({
                id: existing.id,
                constituencyName: existing.assemblyName || existing.parliamentName || '',
                level: existing.level,
                diffs,
                updatedObj
              });
              itemsToOverride.push(updatedObj);
            } else {
              unchangedCount++;
            }
          }
        });

        setImportDiffModal({
          fileName: file.name,
          totalParsed: rows.length,
          changesList,
          unchangedCount,
          itemsToOverride
        });

        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        alert('Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv template.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 3. Confirm & Override Batch Directory Changes
  const handleConfirmImport = () => {
    if (!importDiffModal || !importDiffModal.itemsToOverride) return;

    const count = dbService.batchUpdateEmployees(importDiffModal.itemsToOverride);
    
    // Refresh directory view
    setEmployees(dbService.getEmployees());
    setImportDiffModal(null);

    setToastMessage(`Overrode & updated ${count} staff accounts successfully!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const totalAssemblies = 175;
  const totalParliaments = 25;
  const totalStaffCount = employees.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#18181b',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '9999px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 700
        }}>
          <Check size={16} style={{ color: '#facc15' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Input for Excel/CSV */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls, .csv"
        style={{ display: 'none' }}
      />

      {/* Overview Stat Cards Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        {/* Total Parliament Incharges Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '18px 20px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 149, 0, 0.1)',
            border: '1px solid rgba(255, 149, 0, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            flexShrink: 0
          }}>
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Parliament Staff
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d1d1f', marginTop: '2px', letterSpacing: '-0.02em' }}>
              {totalParliaments} <span style={{ fontSize: '13px', fontWeight: 400, color: '#86868b' }}>Logins</span>
            </div>
            <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 400, marginTop: '2px' }}>
              APP01 to APP25
            </div>
          </div>
        </div>

        {/* Total Assembly Outreach Staff Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '18px 20px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
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
            <MapPin size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Assembly Segment Staff
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d1d1f', marginTop: '2px', letterSpacing: '-0.02em' }}>
              {totalAssemblies} <span style={{ fontSize: '13px', fontWeight: 400, color: '#86868b' }}>Logins</span>
            </div>
            <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 400, marginTop: '2px' }}>
              7 Segments per Parliament
            </div>
          </div>
        </div>

        {/* Combined Active Staff Directory */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '18px 20px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
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
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Active Directory
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d1d1f', marginTop: '2px', letterSpacing: '-0.02em' }}>
              {totalStaffCount} <span style={{ fontSize: '13px', fontWeight: 400, color: '#86868b' }}>Accounts</span>
            </div>
            <div style={{ fontSize: '11px', color: '#86868b', fontWeight: 400, marginTop: '2px' }}>
              Default: <code style={{ backgroundColor: 'rgba(0, 0, 0, 0.04)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '10.5px' }}>password123</code>
            </div>
          </div>
        </div>
      </div>

      {/* Control Toolbar: Search, Filters & Excel Actions */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '14px 18px',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        flexWrap: 'wrap'
      }}>
        {/* Search Bar */}
        <div style={{
          position: 'relative',
          flex: '1',
          minWidth: '260px'
        }}>
          <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#86868b' }} />
          <input
            type="text"
            placeholder="Search by Support Code, Staff ID, Mobile, or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 16px 8px 38px',
              borderRadius: '980px',
              backgroundColor: 'rgba(118, 118, 128, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              fontSize: '12.5px',
              fontWeight: 500,
              color: '#1d1d1f',
              outline: 'none',
              transition: 'border-color 0.15s',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#86868b',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Level Filter Pills - Apple Segmented Control */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          padding: '3px',
          borderRadius: '10px',
          backgroundColor: 'rgba(118, 118, 128, 0.08)',
          border: '1px solid rgba(0, 0, 0, 0.04)'
        }}>
          <button
            onClick={() => setFilterLevel('ALL')}
            style={{
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: filterLevel === 'ALL' ? 600 : 500,
              border: 'none',
              backgroundColor: filterLevel === 'ALL' ? '#ffffff' : 'transparent',
              color: filterLevel === 'ALL' ? '#1d1d1f' : '#86868b',
              boxShadow: filterLevel === 'ALL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            All (200)
          </button>
          <button
            onClick={() => setFilterLevel('PARLIAMENT')}
            style={{
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: filterLevel === 'PARLIAMENT' ? 600 : 500,
              border: 'none',
              backgroundColor: filterLevel === 'PARLIAMENT' ? '#ffffff' : 'transparent',
              color: filterLevel === 'PARLIAMENT' ? '#1d1d1f' : '#86868b',
              boxShadow: filterLevel === 'PARLIAMENT' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Parliament (25)
          </button>
        </div>

        {/* Excel Actions: Template & Import */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleDownloadTemplate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '980px',
              fontSize: '12px',
              fontWeight: 500,
              border: '1px solid rgba(0, 0, 0, 0.08)',
              backgroundColor: '#ffffff',
              color: '#1d1d1f',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
              transition: 'all 0.15s'
            }}
          >
            <Download size={13} style={{ color: '#0071e3' }} />
            <span>Template</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '980px',
              fontSize: '12px',
              fontWeight: 500,
              border: '1px solid rgba(0, 113, 227, 0.2)',
              backgroundColor: 'rgba(0, 113, 227, 0.08)',
              color: '#0071e3',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <Upload size={13} />
            <span>Import Excel</span>
          </button>

          {activeParliamentCode && (
            <button
              onClick={() => setActiveParliamentCode(null)}
              style={{
                padding: '7px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                color: '#374151',
                cursor: 'pointer'
              }}
            >
              Collapse All
            </button>
          )}
        </div>
      </div>

      {/* Main Grouped Directory Accordion List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredParliaments.length === 0 ? (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px solid #e5e7eb',
            color: '#6b7280'
          }}>
            <p style={{ fontSize: '15px', fontWeight: 600 }}>No constituency matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              style={{
                marginTop: '12px',
                padding: '8px 18px',
                borderRadius: '9999px',
                backgroundColor: '#18181b',
                color: '#ffffff',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Reset Search
            </button>
          </div>
        ) : (
          filteredParliaments.map((p) => {
            const pData = groupedData[p.code];
            const pStaff = pData?.parliamentStaff;
            const aStaffList = pData?.assemblyStaff || [];

            const isSearchActive = searchQuery.trim().length > 0;
            const isExpanded = isSearchActive ? true : (activeParliamentCode === p.code);

            const queryClean = searchQuery.trim().toLowerCase();
            const matchesParliamentDirectly = !isSearchActive || (
              p.code.toLowerCase().includes(queryClean) || 
              p.name.toLowerCase().includes(queryClean) ||
              pStaff?.name?.toLowerCase().includes(queryClean) ||
              pStaff?.mobile?.includes(queryClean)
            );

            const showParliamentInchargeCard = !!pStaff && matchesParliamentDirectly;

            const displayAssemblies = (isSearchActive && !matchesParliamentDirectly)
              ? p.assemblies.filter(asm => {
                  const asmStaff = aStaffList.find(st => st.assemblyCode === asm.code || st.id === asm.code);
                  return (
                    asm.code.toLowerCase().includes(queryClean) ||
                    asm.name.toLowerCase().includes(queryClean) ||
                    asmStaff?.name?.toLowerCase().includes(queryClean) ||
                    asmStaff?.mobile?.includes(queryClean)
                  );
                })
              : p.assemblies;

            return (
              <div
                key={p.code}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Accordion Parliament Header */}
                <div
                  onClick={() => toggleExpand(p.code)}
                  style={{
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: isExpanded ? 'rgba(0, 0, 0, 0.015)' : '#ffffff',
                    borderBottom: isExpanded ? '1px solid rgba(0, 0, 0, 0.06)' : 'none',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Parliament Code Pill Badge */}
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0, 0, 0, 0.06)',
                      color: '#1d1d1f',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      fontSize: '11px',
                      letterSpacing: '0.04em'
                    }}>
                      {p.code}
                    </span>

                    {/* Parliament Title */}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                        {p.name} <span style={{ fontSize: '11.5px', fontWeight: 400, color: '#86868b' }}>Parliament Constituency</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#86868b', fontWeight: 400, marginTop: '1px' }}>
                        Incharge: <span style={{ color: '#1d1d1f', fontWeight: 500 }}>{pStaff?.name || 'Assigned'}</span> ({pStaff?.mobile})
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Total Logins Badge */}
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '980px',
                      backgroundColor: 'rgba(0, 113, 227, 0.08)',
                      color: '#0071e3',
                      border: '1px solid rgba(0, 113, 227, 0.15)',
                      fontSize: '11px',
                      fontWeight: 500
                    }}>
                      8 Logins (1 Parliament + 7 Assembly)
                    </span>

                    {/* Accordion Chevron Icon */}
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#86868b'
                    }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Accordion Body */}
                {isExpanded && (
                  <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    
                    {/* 1. Parliament Incharge Credentials Card */}
                    {showParliamentInchargeCard && (
                      <div style={{
                        backgroundColor: 'rgba(0, 113, 227, 0.03)',
                        borderRadius: '12px',
                        border: '1px solid rgba(0, 113, 227, 0.12)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(0, 113, 227, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0071e3',
                            flexShrink: 0
                          }}>
                            <Building2 size={18} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: '980px',
                                backgroundColor: 'rgba(0, 113, 227, 0.1)',
                                color: '#0071e3',
                                fontSize: '10px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                              }}>
                                Parliament Incharge
                              </span>
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 600, color: '#1d1d1f' }}>
                                Support Code: <strong>{pStaff.supportCode || pStaff.id}</strong>
                              </span>
                            </div>
                            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1d1d1f', marginTop: '2px' }}>
                              {pStaff.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#86868b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>Personal Mobile: <strong style={{ fontFamily: 'monospace', color: '#1d1d1f', fontWeight: 500 }}>{pStaff.mobilePersonal || pStaff.mobile}</strong></span>
                              <span style={{ backgroundColor: 'rgba(0, 0, 0, 0.04)', color: '#86868b', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 500 }}>
                                Parliament Login: Support Code or Personal Mobile
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Password, Copy & Edit Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{
                            backgroundColor: '#ffffff',
                            padding: '4px 10px',
                            borderRadius: '980px',
                            border: '1px solid rgba(0, 0, 0, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <Key size={12} style={{ color: '#86868b' }} />
                            <span style={{ fontSize: '11px', color: '#86868b', fontWeight: 500 }}>Pass:</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px', color: '#1d1d1f' }}>
                              {showPasswords[pStaff.id] ? pStaff.password || 'password123' : '••••••••'}
                            </span>
                            <button
                              onClick={() => toggleShowPassword(pStaff.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b', padding: 0 }}
                            >
                              {showPasswords[pStaff.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>

                          <button
                            onClick={() => copyCredentials(pStaff)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 12px',
                              borderRadius: '980px',
                              backgroundColor: copiedId === pStaff.id ? '#34c759' : '#0071e3',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {copiedId === pStaff.id ? <Check size={12} /> : <Copy size={12} />}
                            <span>{copiedId === pStaff.id ? 'Copied' : 'Copy Login'}</span>
                          </button>

                          <button
                            onClick={() => openEditModal(pStaff, `${p.name} Parliament Incharge`)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 12px',
                              borderRadius: '980px',
                              backgroundColor: 'rgba(0, 0, 0, 0.04)',
                              color: '#1d1d1f',
                              border: 'none',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Edit3 size={12} />
                            <span>Edit Staff</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2. Assembly Staff Directory Logins (7 Assembly Segments) */}
                    {displayAssemblies.length > 0 && (
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#1d1d1f',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span>Assembly Segment Outreach Staff ({displayAssemblies.length} Segments)</span>
                          <span style={{ fontSize: '11px', fontWeight: 400, color: '#86868b' }}>All Passwords: password123</span>
                        </div>

                        <div style={{
                          border: '1px solid rgba(0, 0, 0, 0.08)',
                          borderRadius: '12px',
                          overflowX: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          backgroundColor: '#ffffff'
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#86868b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Support Code</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#86868b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Constituency</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#86868b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Staff ID</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#86868b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned Staff</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#86868b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Personal Mobile</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#86868b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Office Mobile</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#86868b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#86868b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayAssemblies.map((asm, idx) => {
                                const asmStaff = aStaffList.find(st => st.assemblyCode === asm.code || st.id === asm.code) || {
                                  id: asm.code,
                                  supportCode: asm.code,
                                  staffId: '',
                                  name: `${asm.name} Staff`,
                                  mobilePersonal: '',
                                  mobileOffice: '',
                                  mobile: '9800000000',
                                  password: 'password123',
                                  level: 'Assembly',
                                  parliamentCode: p.code,
                                  parliamentName: p.name,
                                  assemblyCode: asm.code,
                                  assemblyName: asm.name
                                };
                                const isEven = idx % 2 === 0;

                                return (
                                  <tr
                                    key={asm.code}
                                    style={{
                                      backgroundColor: isEven ? '#ffffff' : 'rgba(0, 0, 0, 0.01)',
                                      borderBottom: idx < displayAssemblies.length - 1 ? '1px solid rgba(0, 0, 0, 0.04)' : 'none'
                                    }}
                                  >
                                    {/* Support Code */}
                                    <td style={{ padding: '7px 12px' }}>
                                      <span style={{
                                        fontFamily: 'monospace',
                                        fontWeight: 600,
                                        fontSize: '10.5px',
                                        padding: '2px 6px',
                                        borderRadius: '5px',
                                        backgroundColor: 'rgba(0, 113, 227, 0.08)',
                                        color: '#0071e3',
                                        border: '1px solid rgba(0, 113, 227, 0.15)'
                                      }}>
                                        {asmStaff.supportCode || asm.code}
                                      </span>
                                    </td>

                                    {/* Constituency */}
                                    <td style={{ padding: '7px 12px', fontWeight: 500, color: '#1d1d1f' }}>
                                      {asm.name}
                                    </td>

                                    {/* Staff ID */}
                                    <td style={{ padding: '7px 12px' }}>
                                      {asmStaff.staffId ? (
                                        <span style={{
                                          fontFamily: 'monospace',
                                          fontWeight: 600,
                                          fontSize: '10.5px',
                                          padding: '2px 6px',
                                          borderRadius: '5px',
                                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                          color: '#1d1d1f'
                                        }}>
                                          {asmStaff.staffId}
                                        </span>
                                      ) : (
                                        <span style={{ color: '#86868b', fontSize: '11px' }}>—</span>
                                      )}
                                    </td>

                                    {/* Staff Name */}
                                    <td style={{ padding: '7px 12px', fontWeight: 500, color: '#1d1d1f' }}>
                                      {asmStaff?.name || `${asm.name} Staff`}
                                    </td>

                                    {/* Personal Mobile */}
                                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#1d1d1f', fontWeight: 500, fontSize: '11.5px' }}>
                                      {asmStaff?.mobilePersonal || asmStaff?.mobile || '—'}
                                    </td>

                                    {/* Office Mobile */}
                                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#86868b', fontSize: '11.5px' }}>
                                      {asmStaff?.mobileOffice || '—'}
                                    </td>

                                    {/* Password */}
                                    <td style={{ padding: '7px 12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 500, fontSize: '11.5px', color: '#1d1d1f' }}>
                                          {showPasswords[asm.code] ? asmStaff?.password || 'password123' : '••••••••'}
                                        </span>
                                        <button
                                          onClick={() => toggleShowPassword(asm.code)}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b', padding: 0 }}
                                        >
                                          {showPasswords[asm.code] ? <EyeOff size={12} /> : <Eye size={12} />}
                                        </button>
                                      </div>
                                    </td>

                                    {/* Actions: Copy & Edit */}
                                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <button
                                          onClick={() => copyCredentials(asmStaff)}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            padding: '3px 8px',
                                            borderRadius: '980px',
                                            backgroundColor: copiedId === asm.code ? 'rgba(52, 199, 89, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                                            color: copiedId === asm.code ? '#34c759' : '#1d1d1f',
                                            border: 'none',
                                            fontSize: '10.5px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                          }}
                                        >
                                          {copiedId === asm.code ? <Check size={11} /> : <Copy size={11} />}
                                          <span>{copiedId === asm.code ? 'Copied' : 'Copy'}</span>
                                        </button>

                                        <button
                                          onClick={() => openEditModal(asmStaff, `${asm.name} Staff`)}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            padding: '3px 8px',
                                            borderRadius: '980px',
                                            backgroundColor: 'rgba(0, 113, 227, 0.08)',
                                            color: '#0071e3',
                                            border: 'none',
                                            fontSize: '10.5px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                          }}
                                        >
                                          <Edit3 size={11} />
                                          <span>Edit</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Staff Credentials Modal */}
      {editingStaff && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.16)',
            width: '100%',
            maxWidth: '440px',
            padding: '22px 24px',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0, 113, 227, 0.08)',
                    color: '#0071e3',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {editingStaff.id}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#86868b' }}>
                    {editingStaff.level || 'Staff'} Account
                  </span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1d1d1f', margin: '4px 0 0 0', letterSpacing: '-0.01em' }}>
                  Edit Staff Details
                </h3>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#86868b',
                  cursor: 'pointer'
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Field 1: Staff Name */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  Assigned Staff Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter staff full name..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#1d1d1f',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 2: Staff ID (Assembly Segment Staff) */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  Staff ID {editingStaff.level === 'Parliament' ? '(Optional)' : '(e.g. Palakonda_010)'}
                </label>
                <input
                  type="text"
                  value={editForm.staffId}
                  onChange={(e) => setEditForm(prev => ({ ...prev, staffId: e.target.value }))}
                  placeholder={editingStaff.level === 'Parliament' ? 'Optional for Parliament Incharge' : 'e.g. Palakonda_010'}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    fontWeight: 500,
                    color: '#1d1d1f',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 3: Personal Mobile */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  Personal Mobile Number (Login ID)
                </label>
                <input
                  type="text"
                  required
                  value={editForm.mobilePersonal}
                  onChange={(e) => setEditForm(prev => ({ ...prev, mobilePersonal: e.target.value }))}
                  placeholder="e.g. 9030738656"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    fontWeight: 500,
                    color: '#1d1d1f',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 4: Office Mobile */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  Office Mobile Number {editingStaff.level === 'Parliament' ? '(Optional)' : '(CUG / Official)'}
                </label>
                <input
                  type="text"
                  value={editForm.mobileOffice}
                  onChange={(e) => setEditForm(prev => ({ ...prev, mobileOffice: e.target.value }))}
                  placeholder={editingStaff.level === 'Parliament' ? 'Optional office number' : 'e.g. 7997955186'}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    fontWeight: 500,
                    color: '#1d1d1f',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 5: Password */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleQuickResetPassword}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      background: 'none',
                      border: 'none',
                      color: '#0071e3',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={11} />
                    <span>Reset to password123</span>
                  </button>
                </div>
                
                <div style={{ position: 'relative' }}>
                  <input
                    type={showModalPassword ? 'text' : 'password'}
                    required
                    value={editForm.password}
                    onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password..."
                    style={{
                      width: '100%',
                      padding: '8px 36px 8px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      fontWeight: 500,
                      color: '#1d1d1f',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(prev => !prev)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#86868b',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showModalPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    borderRadius: '980px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    backgroundColor: '#ffffff',
                    color: '#1d1d1f',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: '980px',
                    border: 'none',
                    backgroundColor: '#0071e3',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    boxShadow: '0 2px 8px rgba(0, 113, 227, 0.25)'
                  }}
                >
                  <Save size={13} />
                  <span>Save Changes</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Excel Import & Detailed Diff Review Modal */}
      {importDiffModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(17, 24, 39, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '28px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 30px 70px -15px rgba(0,0,0,0.3)',
            width: '100%',
            maxWidth: '920px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 28px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fafafa'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #6ee7b7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#047857'
                }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
                    Excel Directory Import Review
                  </h3>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', fontWeight: 500 }}>
                    File: <strong style={{ color: '#111827' }}>{importDiffModal.fileName}</strong> — Inspect changes before overriding database
                  </div>
                </div>
              </div>

              <button
                onClick={() => setImportDiffModal(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Summary Stats Chips */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Total Parsed Rows</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#111827', marginTop: '2px' }}>
                    {importDiffModal.totalParsed} Logins
                  </div>
                </div>

                <div style={{
                  padding: '14px 18px',
                  borderRadius: '16px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde047'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>Overriding Changes</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#b45309', marginTop: '2px' }}>
                    {importDiffModal.changesList.length} Records Changed
                  </div>
                </div>

                <div style={{
                  padding: '14px 18px',
                  borderRadius: '16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>Unchanged Logins</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#374151', marginTop: '2px' }}>
                    {importDiffModal.unchangedCount} Intact
                  </div>
                </div>
              </div>

              {/* Import Change Notice */}
              {importDiffModal.changesList.length === 0 ? (
                <div style={{
                  padding: '32px',
                  textAlign: 'center',
                  backgroundColor: '#f9fafb',
                  borderRadius: '20px',
                  border: '1px solid #e5e7eb'
                }}>
                  <CheckCircle2 size={36} style={{ color: '#10b981', margin: '0 auto 12px auto' }} />
                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Directory Up To Date
                  </h4>
                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    All staff names, mobile numbers, and passwords in the uploaded file match the active system records perfectly.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#111827',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>Detected Record Differences ({importDiffModal.changesList.length} Logins to Override)</span>
                    <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700, backgroundColor: '#fef3c7', padding: '3px 10px', borderRadius: '9999px' }}>
                      Review changes below
                    </span>
                  </div>

                  {/* Detailed Diff Table Container */}
                  <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    backgroundColor: '#ffffff'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
                          <th style={{ padding: '12px 16px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Staff Code</th>
                          <th style={{ padding: '12px 16px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Constituency & Level</th>
                          <th style={{ padding: '12px 16px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Changed Field</th>
                          <th style={{ padding: '12px 16px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Current Value in System</th>
                          <th style={{ padding: '12px 16px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Imported New Value (Override)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importDiffModal.changesList.map((item, itemIdx) => {
                          return item.diffs.map((d, diffIdx) => {
                            const isEven = (itemIdx + diffIdx) % 2 === 0;

                            return (
                              <tr
                                key={`${item.id}-${d.field}-${diffIdx}`}
                                style={{
                                  backgroundColor: isEven ? '#ffffff' : '#fcfcfd',
                                  borderBottom: '1px solid #f3f4f6'
                                }}
                              >
                                {/* Code */}
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{
                                    fontFamily: 'monospace',
                                    fontWeight: 800,
                                    fontSize: '12px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: '#18181b',
                                    color: '#facc15'
                                  }}>
                                    {item.id}
                                  </span>
                                </td>

                                {/* Constituency */}
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111827' }}>
                                  {item.constituencyName} <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>({item.level})</span>
                                </td>

                                {/* Field */}
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: d.field === 'Password' ? '#fef3c7' : '#e0f2fe',
                                    color: d.field === 'Password' ? '#92400e' : '#0369a1'
                                  }}>
                                    {d.field}
                                  </span>
                                </td>

                                {/* Current Value */}
                                <td style={{ padding: '12px 16px', color: '#ef4444', textDecoration: 'line-through', fontWeight: 600, fontFamily: d.field === 'Password' ? 'monospace' : 'inherit' }}>
                                  {d.oldVal || 'None'}
                                </td>

                                {/* New Value */}
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ArrowRight size={14} style={{ color: '#10b981' }} />
                                    <span style={{
                                      fontFamily: d.field === 'Password' ? 'monospace' : 'inherit',
                                      fontWeight: 800,
                                      color: '#047857',
                                      backgroundColor: '#ecfdf5',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid #6ee7b7'
                                    }}>
                                      {d.newVal}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Bar */}
            <div style={{
              padding: '20px 28px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#fafafa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                {importDiffModal.changesList.length > 0 
                  ? `Overriding will instantly update ${importDiffModal.changesList.length} staff login records in the system.`
                  : 'No changes detected. Click cancel to exit review.'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setImportDiffModal(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '9999px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                {importDiffModal.changesList.length > 0 && (
                  <button
                    onClick={handleConfirmImport}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '9999px',
                      border: 'none',
                      backgroundColor: '#047857',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(4,120,87,0.25)'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Confirm & Override Directory</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
