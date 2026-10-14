import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Sliders, 
  CheckCircle2, 
  PauseCircle, 
  Trash2, 
  Edit3, 
  Building2, 
  Globe, 
  MapPin, 
  Users, 
  Search, 
  X,
  Share2,
  Instagram,
  MessageSquare,
  Twitter,
  Facebook,
  Youtube,
  ClipboardList,
  ShieldCheck,
  Target,
  CheckSquare,
  Square,
  Link2,
  ExternalLink
} from 'lucide-react';
import { dbService } from '../services/db.js';
import { AP_CONSTITUENCIES } from '../services/constituencyData.js';

const PLATFORM_ICONS = {
  'Instagram': Instagram,
  'WhatsApp': MessageSquare,
  'X (Twitter)': Twitter,
  'Facebook': Facebook,
  'YouTube': Youtube,
  'Ground Survey': ClipboardList,
  'Custom': Share2
};

const PLATFORM_COLORS = {
  'Instagram': { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8' },
  'WhatsApp': { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  'X (Twitter)': { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd' },
  'Facebook': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  'YouTube': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  'Ground Survey': { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  'Custom': { bg: '#faf5ff', text: '#9333ea', border: '#e9d5ff' }
};

export function TaskManagementView() {
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'Active', 'Paused'
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState(null);

  // Multi-Select Checkbox States
  const [selectedParliaments, setSelectedParliaments] = useState(['APP13']); // default Guntur
  const [selectedAssemblies, setSelectedAssemblies] = useState(['APP13A07']); // default Guntur East
  const [parliamentSearchText, setParliamentSearchText] = useState('');
  const [assemblySearchText, setAssemblySearchText] = useState('');

  // Task Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    platform: 'Instagram',
    submissionType: 'Instagram Handle',
    targetUrl: 'https://www.instagram.com/ramakrishnabhashyam/',
    urlSlug: 'instagram',
    dailyTarget: 10,
    frequency: 'Daily',
    scopeType: 'ALL_STAFF',
    duplicateScope: 'Entire Campaign',
    allowExtraSubmissions: true,
    requireProof: false
  });

  // Flatten assemblies list once
  const allAssembliesList = [];
  AP_CONSTITUENCIES.forEach(p => {
    p.assemblies.forEach(a => {
      allAssembliesList.push({
        code: a.code,
        name: a.name,
        parliamentCode: p.code,
        parliamentName: p.name
      });
    });
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = () => {
    const list = dbService.getTasks();
    setTasks(list);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setSelectedParliaments(['APP13']);
    setSelectedAssemblies(['APP13A07']);
    setParliamentSearchText('');
    setAssemblySearchText('');
    setFormData({
      name: '',
      description: '',
      platform: 'Instagram',
      submissionType: 'Instagram Handle',
      targetUrl: 'https://www.instagram.com/ramakrishnabhashyam/',
      urlSlug: 'instagram',
      dailyTarget: 10,
      frequency: 'Daily',
      scopeType: 'ALL_STAFF',
      duplicateScope: 'Entire Campaign',
      allowExtraSubmissions: true,
      requireProof: false
    });
    setIsModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    const scope = task.assignmentScope || {};
    const existingCodes = scope.targetCodes || (scope.targetCode ? [scope.targetCode] : []);

    if (scope.scopeType === 'SPECIFIC_PARLIAMENT' || scope.scopeType === 'SELECTED_PARLIAMENTS') {
      setSelectedParliaments(existingCodes.length > 0 ? existingCodes : ['APP13']);
    } else {
      setSelectedParliaments(['APP13']);
    }

    if (scope.scopeType === 'SPECIFIC_ASSEMBLY' || scope.scopeType === 'SELECTED_ASSEMBLIES') {
      setSelectedAssemblies(existingCodes.length > 0 ? existingCodes : ['APP13A07']);
    } else {
      setSelectedAssemblies(['APP13A07']);
    }

    setParliamentSearchText('');
    setAssemblySearchText('');
    setFormData({
      name: task.name || '',
      description: task.description || '',
      platform: task.platform || 'Instagram',
      submissionType: task.submissionType || 'Instagram Handle',
      targetUrl: task.targetUrl || (task.platform === 'Instagram' ? 'https://www.instagram.com/ramakrishnabhashyam/' : ''),
      urlSlug: task.urlSlug || (task.platform === 'Instagram' ? 'instagram' : 'go'),
      dailyTarget: task.dailyTarget || 10,
      frequency: task.frequency || 'Daily',
      scopeType: scope.scopeType || 'ALL_STAFF',
      duplicateScope: task.rules?.duplicateScope || task.duplicateScope || 'Entire Campaign',
      allowExtraSubmissions: task.rules?.allowExtraSubmissions ?? task.allowExtraSubmissions ?? true,
      requireProof: task.rules?.requireProof ?? task.requireProof ?? false
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = (taskId) => {
    dbService.toggleTaskStatus(taskId);
    loadTasks();
  };

  const handlePromptDeleteTask = (task) => {
    setDeleteConfirmTask(task);
  };

  const confirmDeleteTask = () => {
    if (deleteConfirmTask) {
      dbService.deleteTask(deleteConfirmTask.id);
      loadTasks();
      setDeleteConfirmTask(null);
    }
  };

  // Checkbox Toggles & Select All Helpers
  const toggleParliamentSelection = (code) => {
    if (selectedParliaments.includes(code)) {
      setSelectedParliaments(selectedParliaments.filter(c => c !== code));
    } else {
      setSelectedParliaments([...selectedParliaments, code]);
    }
  };

  const selectAllParliaments = () => {
    if (parliamentSearchText.trim()) {
      const filteredCodes = filteredParliamentsList.map(p => p.code);
      setSelectedParliaments(prev => Array.from(new Set([...prev, ...filteredCodes])));
    } else {
      setSelectedParliaments(AP_CONSTITUENCIES.map(p => p.code));
    }
  };

  const deselectAllParliaments = () => {
    if (parliamentSearchText.trim()) {
      const filteredCodes = new Set(filteredParliamentsList.map(p => p.code));
      setSelectedParliaments(prev => prev.filter(code => !filteredCodes.has(code)));
    } else {
      setSelectedParliaments([]);
    }
  };

  const toggleAssemblySelection = (code) => {
    if (selectedAssemblies.includes(code)) {
      setSelectedAssemblies(selectedAssemblies.filter(c => c !== code));
    } else {
      setSelectedAssemblies([...selectedAssemblies, code]);
    }
  };

  const selectAllAssemblies = () => {
    if (assemblySearchText.trim()) {
      const filteredCodes = filteredAssembliesList.map(a => a.code);
      setSelectedAssemblies(prev => Array.from(new Set([...prev, ...filteredCodes])));
    } else {
      setSelectedAssemblies(allAssembliesList.map(a => a.code));
    }
  };

  const deselectAllAssemblies = () => {
    if (assemblySearchText.trim()) {
      const filteredCodes = new Set(filteredAssembliesList.map(a => a.code));
      setSelectedAssemblies(prev => prev.filter(code => !filteredCodes.has(code)));
    } else {
      setSelectedAssemblies([]);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    let targetCodes = [];
    let targetName = 'All Staff & Constituencies';

    if (formData.scopeType === 'ALL_ASSEMBLIES') {
      targetName = 'All 175 Assemblies';
    } else if (formData.scopeType === 'ALL_PARLIAMENTS') {
      targetName = 'All 25 Parliaments';
    } else if (formData.scopeType === 'SPECIFIC_PARLIAMENT' || formData.scopeType === 'SELECTED_PARLIAMENTS') {
      targetCodes = selectedParliaments;
      if (selectedParliaments.length === 0) {
        alert('Please check at least one Parliament constituency.');
        return;
      }
      if (selectedParliaments.length === 1) {
        const pObj = AP_CONSTITUENCIES.find(p => p.code === selectedParliaments[0]);
        targetName = pObj ? `${pObj.code} - ${pObj.name} Parliament` : selectedParliaments[0];
      } else {
        targetName = `${selectedParliaments.length} Parliaments Selected (${selectedParliaments.slice(0, 3).join(', ')}${selectedParliaments.length > 3 ? '...' : ''})`;
      }
    } else if (formData.scopeType === 'SPECIFIC_ASSEMBLY' || formData.scopeType === 'SELECTED_ASSEMBLIES') {
      targetCodes = selectedAssemblies;
      if (selectedAssemblies.length === 0) {
        alert('Please check at least one Assembly constituency.');
        return;
      }
      if (selectedAssemblies.length === 1) {
        const aObj = allAssembliesList.find(a => a.code === selectedAssemblies[0]);
        targetName = aObj ? `${aObj.code} - ${aObj.name} Assembly` : selectedAssemblies[0];
      } else {
        targetName = `${selectedAssemblies.length} Assemblies Selected (${selectedAssemblies.slice(0, 3).join(', ')}${selectedAssemblies.length > 3 ? '...' : ''})`;
      }
    }

    const cleanSlug = (formData.urlSlug || 'go')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '') || 'go';

    const payload = {
      id: editingTask ? editingTask.id : `TASK-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      platform: formData.platform,
      submissionType: formData.submissionType,
      targetUrl: formData.targetUrl || 'https://www.instagram.com/ramakrishnabhashyam/',
      urlSlug: cleanSlug,
      dailyTarget: Number(formData.dailyTarget),
      frequency: formData.frequency,
      assignmentScope: {
        scopeType: normalizedScopeType,
        targetCodes,
        targetCode: targetCodes.length > 0 ? targetCodes[0] : null,
        targetName
      },
      rules: {
        duplicateScope: formData.duplicateScope,
        allowExtraSubmissions: formData.allowExtraSubmissions,
        requireProof: formData.requireProof
      },
      duplicateScope: formData.duplicateScope,
      allowExtraSubmissions: formData.allowExtraSubmissions,
      requireProof: formData.requireProof,
      status: editingTask ? editingTask.status : 'Active',
      createdDate: editingTask ? editingTask.createdDate : new Date().toISOString().split('T')[0]
    };

    if (editingTask) {
      dbService.updateTask(payload);
    } else {
      dbService.addTask(payload);
    }

    setIsModalOpen(false);
    loadTasks();
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Parliaments & Assemblies for Checkbox Modal lists
  const filteredParliamentsList = AP_CONSTITUENCIES.filter(p => 
    p.name.toLowerCase().includes(parliamentSearchText.toLowerCase()) ||
    p.code.toLowerCase().includes(parliamentSearchText.toLowerCase())
  );

  const filteredAssembliesList = allAssembliesList.filter(a => 
    a.name.toLowerCase().includes(assemblySearchText.toLowerCase()) ||
    a.code.toLowerCase().includes(assemblySearchText.toLowerCase()) ||
    a.parliamentName.toLowerCase().includes(assemblySearchText.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Controls & Search Bar */}
      <div className="dashboard-section-card" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        <div style={{ minWidth: '240px', flex: '1 1 280px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
            Task Setup & Assignment Rules
          </h2>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0', fontWeight: 500 }}>
            Configure task targets, validation constraints, and multi-select Assemblies/Parliaments.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
          {/* Search Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '9999px',
            padding: '7px 14px',
            flex: '1 1 180px',
            minWidth: '160px'
          }}>
            <Search size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: '12px',
                width: '100%',
                fontWeight: 500
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 14px',
              borderRadius: '9999px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Paused">Paused Only</option>
          </select>

          {/* Create Task Button */}
          <button
            onClick={openCreateModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '9999px',
              backgroundColor: '#ff4d00',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255, 77, 0, 0.3)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={15} />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Task Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {filteredTasks.map((task) => {
          const IconComp = PLATFORM_ICONS[task.platform] || Share2;
          const pColors = PLATFORM_COLORS[task.platform] || PLATFORM_COLORS['Custom'];
          const scope = task.assignmentScope || {};
          const isTaskActive = task.status === 'Active';

          return (
            <div
              key={task.id}
              className="dashboard-section-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}
            >
              <div>
                {/* Header Row: Platform Icon + Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    backgroundColor: pColors.bg,
                    color: pColors.text,
                    border: `1px solid ${pColors.border}`,
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    <IconComp size={15} />
                    <span>{task.platform}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: isTaskActive ? '#ecfdf5' : '#fef2f2',
                      color: isTaskActive ? '#047857' : '#b91c1c',
                      border: `1px solid ${isTaskActive ? '#a7f3d0' : '#fca5a5'}`
                    }}>
                      {task.status}
                    </span>

                    <button
                      onClick={() => handleToggleStatus(task.id)}
                      title={isTaskActive ? 'Pause Task' : 'Activate Task'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: isTaskActive ? '#10b981' : '#9ca3af'
                      }}
                    >
                      {isTaskActive ? <CheckCircle2 size={20} /> : <PauseCircle size={20} />}
                    </button>
                  </div>
                </div>

                {/* Task Name & Description */}
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                  {task.name}
                </h3>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                  {task.description || 'No description provided.'}
                </p>

                {/* Scope & Target Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
                  {/* Assignment Scope */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#374151',
                    backgroundColor: '#f8fafc',
                    padding: '8px 14px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <MapPin size={15} style={{ color: '#ff4d00' }} />
                    <span>Scope: <strong>{scope.targetName || 'All Staff'}</strong></span>
                  </div>

                  {/* Daily Target */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#475569',
                    backgroundColor: '#fafafa',
                    padding: '8px 14px',
                    borderRadius: '12px',
                    border: '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Target size={15} style={{ color: '#0284c7' }} />
                      <span>Daily Target:</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                      {task.dailyTarget} {task.submissionType || 'entries'} / day
                    </span>
                  </div>

                  {/* Outreach Tracking Target Link */}
                  {task.targetUrl && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#0369a1',
                      backgroundColor: '#f0f9ff',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid #bae6fd',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                        <Link2 size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={task.targetUrl}>
                          Target: <span style={{ fontFamily: 'monospace' }}>{task.targetUrl}</span>
                        </span>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#e0f2fe',
                        color: '#0284c7',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        flexShrink: 0
                      }}>
                        /{task.urlSlug || 'go'}
                      </span>
                    </div>
                  )}

                  {/* Duplicate Rule Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#64748b'
                  }}>
                    <ShieldCheck size={14} style={{ color: '#10b981' }} />
                    <span>Dup Scope: <strong>{task.rules?.duplicateScope || task.duplicateScope || 'Entire Campaign'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9'
              }}>
                <button
                  onClick={() => openEditModal(task)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  <Edit3 size={14} />
                  <span>Edit Rules</span>
                </button>

                <button
                  onClick={() => handlePromptDeleteTask(task)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    backgroundColor: '#fff1f2',
                    color: '#e11d48',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: '1px solid #fecdd3',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '60px 24px',
            textAlign: 'center',
            border: '1px solid #e5e7eb'
          }}>
            <Sliders size={36} style={{ color: '#d1d5db', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#374151', margin: 0 }}>No Tasks Found</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              Create a new task using the button above to assign tasks to AP Assemblies or Parliaments.
            </p>
          </div>
        )}
      </div>

      {/* CREATE / EDIT TASK MODAL */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box'
        }} className="p-3 sm:p-6">
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            border: '1px solid #e2e8f0',
            position: 'relative',
            boxSizing: 'border-box'
          }} className="p-4 sm:p-7">
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  {editingTask ? 'Edit Task Specification' : 'Create New Campaign Task'}
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                  Define target types, daily goals, validation constraints, and target assignment scope.
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Task Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Task Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Instagram Follower Outreach or WhatsApp Connect"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Instructions / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief instructions for field outreach staff..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 500,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Platform & Submission Input Type Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Platform
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) => {
                      const newPlatform = e.target.value;
                      let newUrl = formData.targetUrl;
                      let newSlug = formData.urlSlug;
                      if (newPlatform === 'Instagram') {
                        newUrl = 'https://www.instagram.com/ramakrishnabhashyam/';
                        newSlug = 'instagram';
                      } else if (newPlatform === 'WhatsApp') {
                        newUrl = 'https://chat.whatsapp.com/';
                        newSlug = 'whatsapp';
                      } else if (newPlatform === 'YouTube') {
                        newUrl = 'https://youtube.com/@ramakrishnabhashyam';
                        newSlug = 'youtube';
                      }
                      setFormData({ ...formData, platform: newPlatform, targetUrl: newUrl, urlSlug: newSlug });
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="X (Twitter)">X (Twitter)</option>
                    <option value="Facebook">Facebook</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Ground Survey">Ground Survey</option>
                    <option value="Custom">Custom Platform</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Submission Format
                  </label>
                  <select
                    value={formData.submissionType}
                    onChange={(e) => setFormData({ ...formData, submissionType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Instagram Handle">Instagram Handle (@user)</option>
                    <option value="Mobile Number">Mobile Number (+91)</option>
                    <option value="Profile Link">Profile URL</option>
                    <option value="Post URL">Post / Media Link</option>
                    <option value="Text Input">Lead / Citizen Text Info</option>
                  </select>
                </div>
              </div>

              {/* OUTREACH TRACKING LINK & TARGET REDIRECT URL */}
              <div style={{
                backgroundColor: '#f0f9ff',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid #bae6fd',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link2 size={16} style={{ color: '#0284c7' }} />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0369a1' }}>
                      In-House Staff Outreach Tracking Link Setup
                    </span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7'
                  }}>
                    Zero-Cost In-House
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px' }}>
                      Destination Redirect Target URL *
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="e.g. https://www.instagram.com/ramakrishnabhashyam/"
                      value={formData.targetUrl}
                      onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1px solid #7dd3fc',
                        fontSize: '13px',
                        fontWeight: 600,
                        outline: 'none',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px' }}>
                      URL Route Path
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #7dd3fc', padding: '0 10px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>/</span>
                      <input
                        type="text"
                        placeholder="instagram"
                        value={formData.urlSlug}
                        onChange={(e) => setFormData({ ...formData, urlSlug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                        style={{
                          width: '100%',
                          padding: '10px 4px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 700,
                          outline: 'none',
                          backgroundColor: 'transparent'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #e0f2fe',
                  fontSize: '11px',
                  color: '#475569',
                  lineHeight: 1.4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 700, marginBottom: '2px' }}>
                    <ExternalLink size={12} />
                    <span>Live Tracking Route Preview:</span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#0f172a', wordBreak: 'break-all' }}>
                    https://social.bhashyamramakrishna.in/{formData.urlSlug || 'instagram'}/<span style={{ color: '#ff4d00', fontWeight: 700 }}>[staff_token]</span>
                    <span style={{ color: '#0284c7' }}> ➔ </span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>{formData.targetUrl || 'Target URL'}</span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                    Every staff member receives a unique token link. Clicks are verified (WhatsApp bots filtered out) and redirected in &lt;50ms.
                  </p>
                </div>
              </div>

              {/* Daily Target & Frequency */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Daily Target (per employee)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={formData.dailyTarget}
                    onChange={(e) => setFormData({ ...formData, dailyTarget: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Target Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Daily">Daily Target</option>
                    <option value="Weekly">Weekly Target</option>
                    <option value="Campaign Total">Campaign Total Target</option>
                  </select>
                </div>
              </div>

              {/* GEOGRAPHIC ASSIGNMENT SCOPE WITH MULTI-SELECT CHECKBOXES */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '18px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={18} style={{ color: '#ff4d00' }} />
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Geographic Assignment Scope
                    </h4>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Assign Task To:
                  </label>
                  <select
                    value={formData.scopeType}
                    onChange={(e) => setFormData({ ...formData, scopeType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid #ff4d00',
                      fontSize: '14px',
                      fontWeight: 700,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#0f172a'
                    }}
                  >
                    <option value="ALL_STAFF">All Staff & Constituencies</option>
                    <option value="ALL_ASSEMBLIES">All 175 Assembly Constituencies</option>
                    <option value="SELECTED_ASSEMBLIES">Selected Assembly Constituencies (Multi-Select Checkboxes)</option>
                    <option value="ALL_PARLIAMENTS">All 25 Parliament Constituencies</option>
                    <option value="SELECTED_PARLIAMENTS">Selected Parliament Constituencies (Multi-Select Checkboxes)</option>
                  </select>
                </div>

                {/* MULTI-SELECT CHECKBOX LIST FOR PARLIAMENTS */}
                {(formData.scopeType === 'SPECIFIC_PARLIAMENT' || formData.scopeType === 'SELECTED_PARLIAMENTS') && (
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    border: '1px solid #cbd5e1',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Check Parliaments to Assign:
                      </label>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        backgroundColor: '#fff7ed',
                        color: '#ea580c',
                        border: '1px solid #ffedd5'
                      }}>
                        Selected: {selectedParliaments.length} / 25 Parliaments
                      </span>
                    </div>

                    {/* Filter & Select All Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Filter 25 Parliaments..."
                        value={parliamentSearchText}
                        onChange={(e) => setParliamentSearchText(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={selectAllParliaments}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer'
                          }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllParliaments}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Checkbox Items Container */}
                    <div style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: '8px',
                      paddingRight: '4px'
                    }}>
                      {filteredParliamentsList.map((p) => {
                        const isChecked = selectedParliaments.includes(p.code);
                        return (
                          <label
                            key={p.code}
                            onClick={() => toggleParliamentSelection(p.code)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: isChecked ? '#fff7ed' : '#f8fafc',
                              border: `1px solid ${isChecked ? '#ff4d00' : '#e2e8f0'}`,
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: isChecked ? 700 : 500,
                              color: isChecked ? '#c2410c' : '#334155',
                              userSelect: 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              style={{ accentColor: '#ff4d00', width: '16px', height: '16px' }}
                            />
                            <span>{p.code} - {p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MULTI-SELECT CHECKBOX LIST FOR ASSEMBLIES */}
                {(formData.scopeType === 'SPECIFIC_ASSEMBLY' || formData.scopeType === 'SELECTED_ASSEMBLIES') && (
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    border: '1px solid #cbd5e1',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Check Assemblies to Assign:
                      </label>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        backgroundColor: '#fff7ed',
                        color: '#ea580c',
                        border: '1px solid #ffedd5'
                      }}>
                        Selected: {selectedAssemblies.length} / 175 Assemblies
                      </span>
                    </div>

                    {/* Filter & Select All Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Filter 175 Assemblies by name/parliament..."
                        value={assemblySearchText}
                        onChange={(e) => setAssemblySearchText(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={selectAllAssemblies}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer'
                          }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllAssemblies}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Checkbox Items Container */}
                    <div style={{
                      maxHeight: '260px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '8px',
                      paddingRight: '4px'
                    }}>
                      {filteredAssembliesList.map((a) => {
                        const isChecked = selectedAssemblies.includes(a.code);
                        return (
                          <label
                            key={a.code}
                            onClick={() => toggleAssemblySelection(a.code)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: isChecked ? '#fff7ed' : '#f8fafc',
                              border: `1px solid ${isChecked ? '#ff4d00' : '#e2e8f0'}`,
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: isChecked ? 700 : 500,
                              color: isChecked ? '#c2410c' : '#334155',
                              userSelect: 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              style={{ accentColor: '#ff4d00', width: '16px', height: '16px' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                              <span>{a.code} - {a.name}</span>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>({a.parliamentName} Parliament)</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* RULES & VALIDATION CONSTRAINTS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Validation Rules & Duplicate Controls
                </h4>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Duplicate Check Scope
                  </label>
                  <select
                    value={formData.duplicateScope}
                    onChange={(e) => setFormData({ ...formData, duplicateScope: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Entire Campaign">Entire Campaign (Global cross-staff duplicate check)</option>
                    <option value="Same Day Only">Same Day Only (Allow re-submission on subsequent days)</option>
                    <option value="Same Constituency">Same Constituency Only (Flag duplicates within constituency)</option>
                    <option value="None">Disabled (Allow unlimited duplicate entries)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.allowExtraSubmissions}
                      onChange={(e) => setFormData({ ...formData, allowExtraSubmissions: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#ff4d00' }}
                    />
                    <span>Allow Extra Submissions beyond daily target</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.requireProof}
                      onChange={(e) => setFormData({ ...formData, requireProof: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#ff4d00' }}
                    />
                    <span>Require Proof (URL / Note)</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '9999px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '14px',
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'linear-gradient(90deg, #ff4d00 0%, #ff1a40 100%)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(255, 77, 0, 0.4)'
                  }}
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL DIALOG */}
      {deleteConfirmTask && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '440px',
            padding: '28px',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#ffe4e6',
                border: '1px solid #fecdd3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e11d48',
                flexShrink: 0
              }}>
                <Trash2 size={24} />
              </div>

              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
                  Delete Task Campaign?
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                  Are you sure you want to delete <strong style={{ color: '#0f172a' }}>"{deleteConfirmTask.name}"</strong>? Existing staff submissions for this task will remain archived.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmTask(null)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteTask}
                style={{
                  padding: '10px 22px',
                  borderRadius: '9999px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
