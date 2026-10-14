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
        gap: '16px'
      }}>
        {/* Total Parliament Incharges Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '20px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fde047',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#b45309'
          }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Parliament Staff
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#111827', marginTop: '2px' }}>
              {totalParliaments} Logins
            </div>
            <div style={{ fontSize: '11px', color: '#854d0e', fontWeight: 600, marginTop: '2px' }}>
              Code format: APP01 to APP25
            </div>
          </div>
        </div>

        {/* Total Assembly Outreach Staff Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '20px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            backgroundColor: '#dbeafe',
            border: '1px solid #93c5fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1d4ed8'
          }}>
            <MapPin size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Assembly Segment Staff
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#111827', marginTop: '2px' }}>
              {totalAssemblies} Logins
            </div>
            <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, marginTop: '2px' }}>
              7 Segments per Parliament
            </div>
          </div>
        </div>

        {/* Combined Active Staff Directory */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '20px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            backgroundColor: '#d1fae5',
            border: '1px solid #6ee7b7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#047857'
          }}>
            <UserCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Active Directory
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#111827', marginTop: '2px' }}>
              {totalStaffCount} Accounts
            </div>
            <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 600, marginTop: '2px' }}>
              Default Pass: <code style={{ backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>password123</code>
            </div>
          </div>
        </div>
      </div>

      {/* Control Toolbar: Search, Filters & Excel Actions */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '16px 20px',
        border: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Search Bar */}
        <div style={{
          position: 'relative',
          flex: '1',
          minWidth: '260px'
        }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search by Support Code (APP01), Staff ID (Palakonda_010), Mobile, or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px 10px 42px',
              borderRadius: '9999px',
              backgroundColor: '#f9fafb',
              border: '1px solid #d1d5db',
              fontSize: '13px',
              fontWeight: 500,
              color: '#111827',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Level Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setFilterLevel('ALL')}
            style={{
              padding: '7px 14px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              border: filterLevel === 'ALL' ? '1px solid #18181b' : '1px solid #e5e7eb',
              backgroundColor: filterLevel === 'ALL' ? '#18181b' : '#f9fafb',
              color: filterLevel === 'ALL' ? '#ffffff' : '#4b5563',
              cursor: 'pointer'
            }}
          >
            All (200)
          </button>
          <button
            onClick={() => setFilterLevel('PARLIAMENT')}
            style={{
              padding: '7px 14px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              border: filterLevel === 'PARLIAMENT' ? '1px solid #d97706' : '1px solid #e5e7eb',
              backgroundColor: filterLevel === 'PARLIAMENT' ? '#fef3c7' : '#f9fafb',
              color: filterLevel === 'PARLIAMENT' ? '#92400e' : '#4b5563',
              cursor: 'pointer'
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
              padding: '7px 14px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Download size={14} style={{ color: '#059669' }} />
            <span>Download Template</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 800,
              border: '1px solid #059669',
              backgroundColor: '#ecfdf5',
              color: '#047857',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(16,185,129,0.12)',
              transition: 'all 0.2s'
            }}
          >
            <Upload size={14} />
            <span>Import Excel / CSV</span>
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
                  borderRadius: '24px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Accordion Parliament Header */}
                <div
                  onClick={() => toggleExpand(p.code)}
                  className="p-3 sm:p-5"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: isExpanded ? '#fafafa' : '#ffffff',
                    borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    {/* Parliament Code Pill Badge */}
                    <span style={{
                      padding: '6px 14px',
                      borderRadius: '12px',
                      backgroundColor: '#18181b',
                      color: '#facc15',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '14px',
                      letterSpacing: '0.05em'
                    }}>
                      {p.code}
                    </span>

                    {/* Parliament Title */}
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>
                        {p.name} <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>Parliament Constituency</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500, marginTop: '2px' }}>
                        Incharge: <strong style={{ color: '#111827' }}>{pStaff?.name || 'Assigned'}</strong> ({pStaff?.mobile})
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Total Logins Badge */}
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      border: '1px solid #fde047',
                      fontSize: '12px',
                      fontWeight: 700
                    }}>
                      8 Logins (1 Parliament + 7 Assembly)
                    </span>

                    {/* Accordion Chevron Icon */}
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4b5563'
                    }}>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Accordion Body */}
                {isExpanded && (
                  <div className="p-3 sm:p-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* 1. Parliament Incharge Credentials Card */}
                    {showParliamentInchargeCard && (
                      <div style={{
                        backgroundColor: '#fffbeb',
                        borderRadius: '18px',
                        border: '1px solid #fde047',
                        padding: '18px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            backgroundColor: '#fef08a',
                            border: '1px solid #facc15',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#854d0e'
                          }}>
                            <Building2 size={22} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: '#78350f',
                                color: '#fef08a',
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase'
                              }}>
                                Parliament Incharge
                              </span>
                              <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#92400e' }}>
                                Support Code: <strong>{pStaff.supportCode || pStaff.id}</strong>
                              </span>
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>
                              {pStaff.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>Personal Mobile: <strong style={{ fontFamily: 'monospace', color: '#111827' }}>{pStaff.mobilePersonal || pStaff.mobile}</strong></span>
                              <span style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde047', padding: '1px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                                Parliament Login: Support Code or Personal Mobile
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Password, Copy & Edit Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <div style={{
                            backgroundColor: '#ffffff',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            border: '1px solid #fcd34d',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <Key size={14} style={{ color: '#d97706' }} />
                            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Pass:</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: '#111827' }}>
                              {showPasswords[pStaff.id] ? pStaff.password || 'password123' : '••••••••'}
                            </span>
                            <button
                              onClick={() => toggleShowPassword(pStaff.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0 }}
                            >
                              {showPasswords[pStaff.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>

                          <button
                            onClick={() => copyCredentials(pStaff)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              backgroundColor: copiedId === pStaff.id ? '#10b981' : '#18181b',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {copiedId === pStaff.id ? <Check size={14} /> : <Copy size={14} />}
                            <span>{copiedId === pStaff.id ? 'Copied' : 'Copy Login'}</span>
                          </button>

                          <button
                            onClick={() => openEditModal(pStaff, `${p.name} Parliament Incharge`)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              backgroundColor: '#ffffff',
                              color: '#b45309',
                              border: '1px solid #fde047',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <Edit3 size={14} />
                            <span>Edit Staff</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2. Assembly Staff Directory Logins (7 Assembly Segments) */}
                    {displayAssemblies.length > 0 && (
                      <div>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: '#374151',
                          marginBottom: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span>Assembly Segment Outreach Staff ({displayAssemblies.length} Segments)</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>All Passwords: password123</span>
                        </div>

                        <div style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '16px',
                          overflowX: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          backgroundColor: '#ffffff'
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Support Code</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Constituency</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Staff ID</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Assigned Staff</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Personal Mobile</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Office Mobile</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase' }}>Password</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
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
                                      backgroundColor: isEven ? '#ffffff' : '#fcfcfd',
                                      borderBottom: idx < displayAssemblies.length - 1 ? '1px solid #f3f4f6' : 'none'
                                    }}
                                  >
                                    {/* Support Code */}
                                    <td style={{ padding: '12px 14px' }}>
                                      <span style={{
                                        fontFamily: 'monospace',
                                        fontWeight: 800,
                                        fontSize: '11px',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: '#eff6ff',
                                        color: '#1d4ed8',
                                        border: '1px solid #bfdbfe'
                                      }}>
                                        {asmStaff.supportCode || asm.code}
                                      </span>
                                    </td>

                                    {/* Constituency */}
                                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                                      {asm.name}
                                    </td>

                                    {/* Staff ID */}
                                    <td style={{ padding: '12px 14px' }}>
                                      {asmStaff.staffId ? (
                                        <span style={{
                                          fontFamily: 'monospace',
                                          fontWeight: 800,
                                          fontSize: '11px',
                                          padding: '2px 7px',
                                          borderRadius: '6px',
                                          backgroundColor: '#f1f5f9',
                                          color: '#0f172a',
                                          border: '1px solid #cbd5e1'
                                        }}>
                                          {asmStaff.staffId}
                                        </span>
                                      ) : (
                                        <span style={{ color: '#9ca3af', fontSize: '11px' }}>—</span>
                                      )}
                                    </td>

                                    {/* Staff Name */}
                                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1f2937' }}>
                                      {asmStaff?.name || `${asm.name} Staff`}
                                    </td>

                                    {/* Personal Mobile */}
                                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#111827', fontWeight: 600, fontSize: '12px' }}>
                                      {asmStaff?.mobilePersonal || asmStaff?.mobile || '—'}
                                    </td>

                                    {/* Office Mobile */}
                                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#4b5563', fontSize: '12px' }}>
                                      {asmStaff?.mobileOffice || '—'}
                                    </td>

                                    {/* Password */}
                                    <td style={{ padding: '12px 14px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', color: '#111827' }}>
                                          {showPasswords[asm.code] ? asmStaff?.password || 'password123' : '••••••••'}
                                        </span>
                                        <button
                                          onClick={() => toggleShowPassword(asm.code)}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
                                        >
                                          {showPasswords[asm.code] ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                      </div>
                                    </td>

                                    {/* Actions: Copy & Edit */}
                                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        <button
                                          onClick={() => copyCredentials(asmStaff)}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '5px 10px',
                                            borderRadius: '8px',
                                            backgroundColor: copiedId === asm.code ? '#ecfdf5' : '#f3f4f6',
                                            color: copiedId === asm.code ? '#047857' : '#374151',
                                            border: copiedId === asm.code ? '1px solid #6ee7b7' : '1px solid #e5e7eb',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                          }}
                                        >
                                          {copiedId === asm.code ? <Check size={12} /> : <Copy size={12} />}
                                          <span>{copiedId === asm.code ? 'Copied' : 'Copy'}</span>
                                        </button>

                                        <button
                                          onClick={() => openEditModal(asmStaff, `${asm.name} Staff`)}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '5px 10px',
                                            borderRadius: '8px',
                                            backgroundColor: '#ffffff',
                                            color: '#1d4ed8',
                                            border: '1px solid #bfdbfe',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s'
                                          }}
                                        >
                                          <Edit3 size={12} />
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
          backgroundColor: 'rgba(17, 24, 39, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '28px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.25)',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#18181b',
                    color: '#facc15',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontWeight: 800
                  }}>
                    {editingStaff.id}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                    {editingStaff.level || 'Staff'} Member
                  </span>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#111827', margin: '6px 0 0 0', letterSpacing: '-0.02em' }}>
                  Edit Staff Logins
                </h3>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
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

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Field 1: Staff Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Assigned Staff Member Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name of assigned staff..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 2: Staff ID (Assembly Segment Staff) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Staff ID {editingStaff.level === 'Parliament' ? '(Optional for Parliament)' : '(e.g. Palakonda_010)'}
                </label>
                <input
                  type="text"
                  value={editForm.staffId}
                  onChange={(e) => setEditForm(prev => ({ ...prev, staffId: e.target.value }))}
                  placeholder={editingStaff.level === 'Parliament' ? 'Optional for Parliament Incharge' : 'e.g. Palakonda_010'}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 3: Personal Mobile */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Personal Mobile Number (Direct Login Identifier)
                </label>
                <input
                  type="text"
                  required
                  value={editForm.mobilePersonal}
                  onChange={(e) => setEditForm(prev => ({ ...prev, mobilePersonal: e.target.value }))}
                  placeholder="e.g. 9030738656"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 4: Office Mobile */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Office Mobile Number {editingStaff.level === 'Parliament' ? '(Optional)' : '(CUG / Official)'}
                </label>
                <input
                  type="text"
                  value={editForm.mobileOffice}
                  onChange={(e) => setEditForm(prev => ({ ...prev, mobileOffice: e.target.value }))}
                  placeholder={editingStaff.level === 'Parliament' ? 'Optional office number' : 'e.g. 7997955186'}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Field 3: Password / Reset Password */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                    Login Password
                  </label>
                  <button
                    type="button"
                    onClick={handleQuickResetPassword}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      color: '#d97706',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Reset to password123</span>
                  </button>
                </div>
                
                <div style={{ position: 'relative' }}>
                  <input
                    type={showModalPassword ? 'text' : 'password'}
                    required
                    value={editForm.password}
                    onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter login password..."
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 14px',
                      borderRadius: '12px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#111827',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(prev => !prev)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showModalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  style={{
                    flex: 1,
                    padding: '12px',
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
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: '#18181b',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  <Save size={15} style={{ color: '#facc15' }} />
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
