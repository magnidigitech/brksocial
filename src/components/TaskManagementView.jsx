import React, { useState, useEffect } from 'react';
import { 
  Minus,
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
import { getDefaultSamplePatterns, patternsToString, stringToPatterns } from '../services/normalization.js';
import { getMondayOfCurrentWeekIST, getTodayISTDateString, getTaskCycleInfo, addDaysToDateStr } from '../services/istUtils.js';

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
    startDate: getTodayISTDateString(),
    weekStartDate: getMondayOfCurrentWeekIST(),
    endDate: '',
    cycleDays: 10,
    scopeType: 'ALL_STAFF',
    duplicateScope: 'Entire Campaign',
    allowExtraSubmissions: true,
    requireProof: false,
    samplePatternsText: patternsToString(getDefaultSamplePatterns('Instagram', 'Instagram Handle'))
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
      startDate: getTodayISTDateString(),
      weekStartDate: getMondayOfCurrentWeekIST(),
      endDate: '',
      cycleDays: 10,
      scopeType: 'ALL_STAFF',
      duplicateScope: 'Entire Campaign',
      allowExtraSubmissions: true,
      requireProof: false,
      samplePatternsText: patternsToString(getDefaultSamplePatterns('Instagram', 'Instagram Handle'))
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
    const initialPatterns = (task.samplePatterns && task.samplePatterns.length > 0)
      ? task.samplePatterns
      : getDefaultSamplePatterns(task.platform || 'Instagram', task.submissionType || 'Instagram Handle');

    setFormData({
      name: task.name || '',
      description: task.description || '',
      platform: task.platform || 'Instagram',
      submissionType: task.submissionType || 'Instagram Handle',
      targetUrl: task.targetUrl || (task.platform === 'Instagram' ? 'https://www.instagram.com/ramakrishnabhashyam/' : ''),
      urlSlug: task.urlSlug || (task.platform === 'Instagram' ? 'instagram' : 'go'),
      dailyTarget: task.dailyTarget || task.weeklyTarget || task.cycleTarget || task.campaignTarget || 10,
      frequency: task.frequency || 'Daily',
      startDate: task.startDate || task.weekStartDate || getTodayISTDateString(),
      weekStartDate: task.startDate || task.weekStartDate || getMondayOfCurrentWeekIST(),
      endDate: task.endDate || '',
      cycleDays: task.cycleDays || 10,
      scopeType: scope.scopeType || 'ALL_STAFF',
      duplicateScope: task.rules?.duplicateScope || task.duplicateScope || 'Entire Campaign',
      allowExtraSubmissions: task.rules?.allowExtraSubmissions ?? task.allowExtraSubmissions ?? true,
      requireProof: task.rules?.requireProof ?? task.requireProof ?? false,
      samplePatternsText: patternsToString(initialPatterns)
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
    if (!formData.name.trim()) {
      alert('Please enter a Task Name.');
      return;
    }

    try {
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

      const normalizedScopeType = formData.scopeType === 'SPECIFIC_PARLIAMENT' ? 'SELECTED_PARLIAMENTS' : 
                                 (formData.scopeType === 'SPECIFIC_ASSEMBLY' ? 'SELECTED_ASSEMBLIES' : (formData.scopeType || 'ALL_STAFF'));

      const payload = {
        id: editingTask ? editingTask.id : `TASK-${Date.now()}`,
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        platform: formData.platform || 'Instagram',
        submissionType: formData.submissionType || 'Instagram Handle',
        targetUrl: formData.targetUrl?.trim() || 'https://www.instagram.com/ramakrishnabhashyam/',
        urlSlug: cleanSlug,
        dailyTarget: Number(formData.dailyTarget) || 10,
        frequency: formData.frequency || 'Daily',
        startDate: formData.startDate || formData.weekStartDate || getTodayISTDateString(),
        weekStartDate: formData.startDate || formData.weekStartDate || getMondayOfCurrentWeekIST(),
        endDate: formData.endDate ? formData.endDate : null,
        cycleDays: formData.frequency === 'Weekly' ? 7 : (formData.frequency === 'Custom' ? Math.max(1, Number(formData.cycleDays) || 10) : 1),
        weeklyTarget: formData.frequency === 'Weekly' ? (Number(formData.dailyTarget) || 10) : (editingTask?.weeklyTarget || null),
        cycleTarget: formData.frequency === 'Custom' ? (Number(formData.dailyTarget) || 10) : (editingTask?.cycleTarget || null),
        campaignTarget: formData.frequency === 'Campaign Total' ? (Number(formData.dailyTarget) || 100) : (editingTask?.campaignTarget || null),
        assignmentScope: {
          scopeType: normalizedScopeType,
          targetCodes,
          targetCode: targetCodes.length > 0 ? targetCodes[0] : null,
          targetName
        },
        rules: {
          duplicateScope: formData.duplicateScope || 'Entire Campaign',
          allowExtraSubmissions: formData.allowExtraSubmissions ?? true,
          requireProof: formData.requireProof ?? false
        },
        duplicateScope: formData.duplicateScope || 'Entire Campaign',
        allowExtraSubmissions: formData.allowExtraSubmissions ?? true,
        requireProof: formData.requireProof ?? false,
        samplePatterns: stringToPatterns(formData.samplePatternsText),
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
    } catch (err) {
      console.error('Failed to save task:', err);
      alert('Failed to save task: ' + err.message);
    }
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
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
            Task Setup & Assignment Rules
          </h2>
          <p style={{ fontSize: '12px', color: '#86868b', margin: '3px 0 0 0', fontWeight: 400 }}>
            Configure task targets, validation constraints, and multi-select Assemblies/Parliaments.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
          {/* Search Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(118, 118, 128, 0.08)',
            border: '1px solid rgba(0, 0, 0, 0.06)',
            borderRadius: '980px',
            padding: '6px 14px',
            flex: '1 1 180px',
            minWidth: '160px'
          }}>
            <Search size={14} style={{ color: '#86868b', flexShrink: 0 }} />
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
                fontWeight: 500,
                color: '#1d1d1f'
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 14px',
              borderRadius: '980px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              backgroundColor: '#ffffff',
              fontSize: '12px',
              fontWeight: 500,
              color: '#1d1d1f',
              outline: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
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
              padding: '7px 16px',
              borderRadius: '980px',
              backgroundColor: '#0071e3',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 113, 227, 0.25)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={14} />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Task Cards Grid - 3 per row on Desktop */}
      <div className="tasks-grid-layout">
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
                position: 'relative',
                padding: '16px 18px',
                borderRadius: '16px'
              }}
            >
              <div>
                {/* Header Row: Platform Icon + Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '980px',
                    backgroundColor: 'rgba(0, 113, 227, 0.08)',
                    color: '#0071e3',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    <IconComp size={12} />
                    <span>{task.platform}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '980px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      backgroundColor: isTaskActive ? 'rgba(52, 199, 89, 0.1)' : 'rgba(118, 118, 128, 0.1)',
                      color: isTaskActive ? '#34c759' : '#86868b'
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
                        color: isTaskActive ? '#34c759' : '#86868b',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0
                      }}
                    >
                      {isTaskActive ? <CheckCircle2 size={16} /> : <PauseCircle size={16} />}
                    </button>
                  </div>
                </div>

                {/* Task Name & Description */}
                <h3 style={{ fontSize: '14.5px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 3px 0', letterSpacing: '-0.01em' }}>
                  {task.name}
                </h3>
                <p style={{ fontSize: '11.5px', color: '#86868b', margin: '0 0 12px 0', lineHeight: 1.4, fontWeight: 400 }}>
                  {task.description || 'No description provided.'}
                </p>

                {/* Scope & Target Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Assignment Scope */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#1d1d1f',
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    padding: '5px 8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.04)'
                  }}>
                    <MapPin size={12} style={{ color: '#0071e3', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Scope: <strong style={{ fontWeight: 600 }}>{scope.targetName || 'All Staff'}</strong>
                    </span>
                  </div>

                  {/* Target & Cycle details */}
                  {(() => {
                    const cycle = getTaskCycleInfo(task);
                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: '#1d1d1f',
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        padding: '5px 8px',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 0, 0, 0.04)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Target size={12} style={{ color: '#0071e3' }} />
                          <span>
                            {task.frequency === 'Weekly' ? 'Weekly Target:' : 
                             task.frequency === 'Custom' ? `Cycle (${task.cycleDays || 10}d) Target:` :
                             task.frequency === 'Campaign Total' ? 'Campaign Total:' : 'Daily Target:'}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '11.5px', color: '#1d1d1f' }}>
                          {task.dailyTarget || cycle.target} {task.submissionType || 'entries'}
                          {task.frequency === 'Weekly' ? ` / week (${cycle.shortLabel})` :
                           task.frequency === 'Custom' ? ` / ${task.cycleDays || 10} days (${cycle.shortLabel})` :
                           task.frequency === 'Campaign Total' ? ' (Entire Duration)' : ' / day'}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Outreach Tracking Target Link */}
                  {task.targetUrl && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '10.5px',
                      fontWeight: 500,
                      color: '#0071e3',
                      backgroundColor: 'rgba(0, 113, 227, 0.04)',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0, 113, 227, 0.1)',
                      gap: '6px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
                        <Link2 size={11} style={{ color: '#0071e3', flexShrink: 0 }} />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={task.targetUrl}>
                          Target: <span style={{ fontFamily: 'monospace' }}>{task.targetUrl}</span>
                        </span>
                      </div>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: '980px',
                        backgroundColor: '#ffffff',
                        color: '#0071e3',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        border: '1px solid rgba(0, 113, 227, 0.15)',
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
                    gap: '4px',
                    fontSize: '10.5px',
                    fontWeight: 400,
                    color: '#86868b'
                  }}>
                    <ShieldCheck size={11} style={{ color: '#34c759' }} />
                    <span>Dup Scope: <strong style={{ color: '#1d1d1f', fontWeight: 500 }}>{task.rules?.duplicateScope || task.duplicateScope || 'Entire Campaign'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '14px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(0, 0, 0, 0.05)'
              }}>
                <button
                  onClick={() => openEditModal(task)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '980px',
                    backgroundColor: 'rgba(0, 113, 227, 0.08)',
                    color: '#0071e3',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: '1px solid rgba(0, 113, 227, 0.15)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Edit3 size={11} />
                  <span>Edit Rules</span>
                </button>

                <button
                  onClick={() => handlePromptDeleteTask(task)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    borderRadius: '980px',
                    backgroundColor: 'rgba(255, 59, 48, 0.08)',
                    color: '#ff3b30',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: '1px solid rgba(255, 59, 48, 0.15)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Trash2 size={11} />
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
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '88vh',
            overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.16)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            position: 'relative',
            boxSizing: 'border-box',
            padding: '22px 24px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '16.5px', fontWeight: 600, color: '#1d1d1f', margin: 0, letterSpacing: '-0.01em' }}>
                  {editingTask ? 'Edit Task Specification' : 'Create New Campaign Task'}
                </h3>
                <p style={{ fontSize: '12px', color: '#86868b', margin: '3px 0 0 0' }}>
                  Define target types, daily goals, validation constraints, and target assignment scope.
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#86868b',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Task Name */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
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
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    fontSize: '13px',
                    fontWeight: 500,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                  Instructions / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief instructions for field outreach staff..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    fontSize: '12.5px',
                    fontWeight: 400,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Platform & Submission Input Type Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                    Platform
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) => {
                      const newPlatform = e.target.value;
                      let newUrl = formData.targetUrl;
                      let newSlug = formData.urlSlug;
                      let newSub = formData.submissionType;
                      if (newPlatform === 'Instagram') {
                        newUrl = 'https://www.instagram.com/ramakrishnabhashyam/';
                        newSlug = 'instagram';
                        newSub = 'Instagram Handle';
                      } else if (newPlatform === 'WhatsApp') {
                        newUrl = 'https://chat.whatsapp.com/';
                        newSlug = 'whatsapp';
                        newSub = 'Mobile Number';
                      } else if (newPlatform === 'YouTube') {
                        newUrl = 'https://youtube.com/@ramakrishnabhashyam';
                        newSlug = 'youtube';
                        newSub = 'Profile Link';
                      }
                      const defPatterns = getDefaultSamplePatterns(newPlatform, newSub);
                      setFormData({ 
                        ...formData, 
                        platform: newPlatform, 
                        targetUrl: newUrl, 
                        urlSlug: newSlug,
                        submissionType: newSub,
                        samplePatternsText: patternsToString(defPatterns)
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      fontSize: '13px',
                      fontWeight: 500,
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
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                    Submission Format
                  </label>
                  <select
                    value={formData.submissionType}
                    onChange={(e) => {
                      const newSub = e.target.value;
                      const defPatterns = getDefaultSamplePatterns(formData.platform, newSub);
                      setFormData({ 
                        ...formData, 
                        submissionType: newSub,
                        samplePatternsText: patternsToString(defPatterns)
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      fontSize: '13px',
                      fontWeight: 500,
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

              {/* ACCEPTED SAMPLE PATTERNS & STAFF TOOLTIP GUIDANCE */}
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                borderRadius: '12px',
                padding: '12px 14px',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#1d1d1f', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                    Accepted Submission Patterns (Staff Tooltip Guidance)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const def = getDefaultSamplePatterns(formData.platform, formData.submissionType);
                      setFormData({ ...formData, samplePatternsText: patternsToString(def) });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0071e3',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Reset Defaults ({formData.platform})
                  </button>
                </div>

                <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                  Enter one format per line: <strong>Format | Description</strong>. These will be dynamically fetched and displayed to staff in the tooltip:
                </p>

                <textarea
                  rows={3}
                  value={formData.samplePatternsText}
                  onChange={(e) => setFormData({ ...formData, samplePatternsText: e.target.value })}
                  placeholder="9876543210 | 10-digit mobile number&#10;+91 9876543210 | With country code"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    fontWeight: 500,
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* OUTREACH TRACKING LINK & TARGET REDIRECT URL */}
              <div style={{
                backgroundColor: 'rgba(0, 113, 227, 0.03)',
                borderRadius: '12px',
                padding: '12px 14px',
                border: '1px solid rgba(0, 113, 227, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Link2 size={13} style={{ color: '#0071e3' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0071e3' }}>
                    Staff Outreach Tracking Link Setup
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
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
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        outline: 'none',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                      URL Route Path
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid rgba(0, 0, 0, 0.12)', padding: '0 8px' }}>
                      <span style={{ fontSize: '12px', color: '#86868b', fontWeight: 600 }}>/</span>
                      <input
                        type="text"
                        placeholder="instagram"
                        value={formData.urlSlug}
                        onChange={(e) => setFormData({ ...formData, urlSlug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                        style={{
                          width: '100%',
                          padding: '8px 4px',
                          border: 'none',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          outline: 'none',
                          backgroundColor: 'transparent'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Target & Frequency */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                    {formData.frequency === 'Weekly' ? 'Weekly Target (per employee)' :
                     formData.frequency === 'Custom' ? `Cycle Target (per ${formData.cycleDays || 10} days)` :
                     formData.frequency === 'Campaign Total' ? 'Campaign Total Target (per employee)' :
                     'Daily Target (per employee)'}
                  </label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    overflow: 'hidden',
                    height: '37px',
                    boxSizing: 'border-box'
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        const step = formData.frequency === 'Daily' ? 1 : 5;
                        const curr = Number(formData.dailyTarget) || 10;
                        setFormData({ ...formData, dailyTarget: Math.max(1, curr - step) });
                      }}
                      title="Decrease Target"
                      style={{
                        width: '34px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        color: '#1d1d1f',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
                    >
                      <Minus size={13} strokeWidth={2.5} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      required
                      value={formData.dailyTarget}
                      onChange={(e) => setFormData({ ...formData, dailyTarget: e.target.value })}
                      style={{
                        flex: 1,
                        width: '100%',
                        textAlign: 'center',
                        border: 'none',
                        padding: '0 4px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#1d1d1f',
                        outline: 'none',
                        backgroundColor: 'transparent'
                      }}
                      className="no-spinners"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const step = formData.frequency === 'Daily' ? 1 : 5;
                        const curr = Number(formData.dailyTarget) || 10;
                        setFormData({ ...formData, dailyTarget: Math.min(10000, curr + step) });
                      }}
                      title="Increase Target"
                      style={{
                        width: '34px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        color: '#1d1d1f',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
                    >
                      <Plus size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                    Target Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => {
                      const newFreq = e.target.value;
                      setFormData({
                        ...formData,
                        frequency: newFreq,
                        startDate: formData.startDate || (newFreq === 'Weekly' ? getMondayOfCurrentWeekIST() : getTodayISTDateString()),
                        weekStartDate: formData.weekStartDate || (newFreq === 'Weekly' ? getMondayOfCurrentWeekIST() : getTodayISTDateString()),
                        cycleDays: newFreq === 'Weekly' ? 7 : (formData.cycleDays || 10)
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      fontSize: '13px',
                      fontWeight: 500,
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Daily">Daily Target (Resets Every Day)</option>
                    <option value="Weekly">Weekly Target (7-Day Recurring Cycles: Week 1, Week 2...)</option>
                    <option value="Custom">Custom Days Cycle (Repeat Every N Days: 1st, 11th, 21st...)</option>
                    <option value="Campaign Total">Campaign Duration (Start Date to Today - Entire Duration)</option>
                  </select>
                </div>
              </div>

              {/* Conditional Configuration for Weekly */}
              {formData.frequency === 'Weekly' && (() => {
                const start = formData.startDate || formData.weekStartDate || getMondayOfCurrentWeekIST();
                const week1End = addDaysToDateStr(start, 6);
                const week2Start = addDaysToDateStr(start, 7);
                const week2End = addDaysToDateStr(start, 13);
                const week3Start = addDaysToDateStr(start, 14);
                return (
                  <div style={{
                    backgroundColor: 'rgba(0, 113, 227, 0.05)',
                    border: '1px solid rgba(0, 113, 227, 0.2)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0071e3', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          📅 Week 1 Start Date
                        </label>
                        <input
                          type="date"
                          required
                          value={start}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value, weekStartDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 113, 227, 0.3)',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: '#1d1d1f',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          🏁 Campaign End Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={formData.endDate || ''}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 0, 0, 0.12)',
                            fontSize: '12.5px',
                            fontWeight: 500,
                            color: '#1d1d1f',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      border: '1px solid rgba(0, 113, 227, 0.15)',
                      fontSize: '11.5px',
                      color: '#334155',
                      lineHeight: 1.5
                    }}>
                      <div style={{ fontWeight: 700, color: '#0071e3', marginBottom: '3px' }}>
                        ⚡ Automatic 7-Day Cycle Sequence:
                      </div>
                      <div>• <strong>Week 1:</strong> {start} → {week1End}</div>
                      <div>• <strong>Week 2:</strong> {week2Start} → {week2End} (auto-starts after Week 1 ends)</div>
                      <div>• <strong>Week 3:</strong> {week3Start} → ...</div>
                      <div style={{ marginTop: '4px', color: '#64748b', fontSize: '11px' }}>
                        When Week 1 reaches its end date, the system seamlessly transitions to Week 2 and tracks new progress!
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Conditional Configuration for Custom Cycle Days */}
              {formData.frequency === 'Custom' && (() => {
                const start = formData.startDate || getTodayISTDateString();
                const cycleDays = Math.max(1, Number(formData.cycleDays) || 10);
                const c1End = addDaysToDateStr(start, cycleDays - 1);
                const c2Start = addDaysToDateStr(start, cycleDays);
                const c2End = addDaysToDateStr(c2Start, cycleDays - 1);
                const c3Start = addDaysToDateStr(start, cycleDays * 2);
                return (
                  <div style={{
                    backgroundColor: 'rgba(147, 51, 234, 0.05)',
                    border: '1px solid rgba(147, 51, 234, 0.2)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          📅 Start Date
                        </label>
                        <input
                          type="date"
                          required
                          value={start}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value, weekStartDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(147, 51, 234, 0.3)',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: '#1d1d1f',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          🔄 Repeat For (N Days)
                        </label>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1.5px solid rgba(147, 51, 234, 0.4)',
                          overflow: 'hidden',
                          height: '35px',
                          boxSizing: 'border-box',
                          boxShadow: '0 1px 2px rgba(147, 51, 234, 0.05)'
                        }}>
                          <button
                            type="button"
                            onClick={() => {
                              const curr = Number(formData.cycleDays) || 10;
                              setFormData({ ...formData, cycleDays: Math.max(1, curr - 1) });
                            }}
                            title="Decrease days (-1)"
                            style={{
                              width: '34px',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: 'none',
                              backgroundColor: 'rgba(147, 51, 234, 0.08)',
                              color: '#9333ea',
                              cursor: 'pointer',
                              padding: 0,
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.08)'}
                          >
                            <Minus size={14} strokeWidth={2.5} />
                          </button>

                          <input
                            type="number"
                            min="1"
                            max="365"
                            required
                            value={formData.cycleDays || 10}
                            onChange={(e) => setFormData({ ...formData, cycleDays: e.target.value })}
                            style={{
                              flex: 1,
                              width: '100%',
                              textAlign: 'center',
                              border: 'none',
                              padding: '0 4px',
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#1d1d1f',
                              backgroundColor: 'transparent',
                              outline: 'none'
                            }}
                            className="no-spinners"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              const curr = Number(formData.cycleDays) || 10;
                              setFormData({ ...formData, cycleDays: Math.min(365, curr + 1) });
                            }}
                            title="Increase days (+1)"
                            style={{
                              width: '34px',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: 'none',
                              backgroundColor: 'rgba(147, 51, 234, 0.08)',
                              color: '#9333ea',
                              cursor: 'pointer',
                              padding: 0,
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.08)'}
                          >
                            <Plus size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          🏁 End Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={formData.endDate || ''}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 0, 0, 0.12)',
                            fontSize: '12.5px',
                            fontWeight: 500,
                            color: '#1d1d1f',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      border: '1px solid rgba(147, 51, 234, 0.15)',
                      fontSize: '11.5px',
                      color: '#334155',
                      lineHeight: 1.5
                    }}>
                      <div style={{ fontWeight: 700, color: '#9333ea', marginBottom: '3px' }}>
                        ⚡ Recurring {cycleDays}-Day Cycles Preview:
                      </div>
                      <div>• <strong>Cycle 1:</strong> {start} → {c1End}</div>
                      <div>• <strong>Cycle 2:</strong> {c2Start} → {c2End} (repeats automatically)</div>
                      <div>• <strong>Cycle 3:</strong> {c3Start} → ...</div>
                      <div style={{ marginTop: '4px', color: '#64748b', fontSize: '11px' }}>
                        Cycles repeat on 1st, {c2Start.split('-')[2] || '11'}th, {c3Start.split('-')[2] || '21'}st! Once a cycle ends, the next cycle automatically begins.
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Conditional Configuration for Campaign Duration */}
              {formData.frequency === 'Campaign Total' && (() => {
                const start = formData.startDate || getTodayISTDateString();
                return (
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          📅 Campaign Start Date
                        </label>
                        <input
                          type="date"
                          required
                          value={start}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value, weekStartDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: '#1d1d1f',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          🏁 Campaign End Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={formData.endDate || ''}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 0, 0, 0.12)',
                            fontSize: '12.5px',
                            fontWeight: 500,
                            color: '#1d1d1f',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      fontSize: '11.5px',
                      color: '#047857'
                    }}>
                      ⚡ <strong>Entire Duration Mode:</strong> Progress counts continuously from <strong>{start}</strong> to today without any weekly limits across the entire duration.
                    </div>
                  </div>
                );
              })()}

              {/* GEOGRAPHIC ASSIGNMENT SCOPE WITH MULTI-SELECT CHECKBOXES */}
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                borderRadius: '12px',
                padding: '14px',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} style={{ color: '#0071e3' }} />
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                      Geographic Assignment Scope
                    </h4>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                    Assign Task To:
                  </label>
                  <select
                    value={formData.scopeType}
                    onChange={(e) => setFormData({ ...formData, scopeType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(0, 113, 227, 0.3)',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#1d1d1f'
                    }}
                  >
                    <option value="ALL_STAFF">All Staff & Constituencies</option>
                    <option value="ALL_ASSEMBLIES">All 175 Assembly Constituencies</option>
                    <option value="SELECTED_ASSEMBLIES">Selected Assembly Constituencies (Multi-Select)</option>
                    <option value="ALL_PARLIAMENTS">All 25 Parliament Constituencies</option>
                    <option value="SELECTED_PARLIAMENTS">Selected Parliament Constituencies (Multi-Select)</option>
                  </select>
                </div>

                {/* MULTI-SELECT CHECKBOX LIST FOR PARLIAMENTS */}
                {(formData.scopeType === 'SPECIFIC_PARLIAMENT' || formData.scopeType === 'SELECTED_PARLIAMENTS') && (
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                        Select Parliaments:
                      </label>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '980px',
                        backgroundColor: 'rgba(0, 113, 227, 0.08)',
                        color: '#0071e3'
                      }}>
                        Selected: {selectedParliaments.length} / 25
                      </span>
                    </div>

                    {/* Filter & Select All Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="Filter parliaments..."
                        value={parliamentSearchText}
                        onChange={(e) => setParliamentSearchText(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: '11.5px',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={selectAllParliaments}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            color: '#1d1d1f',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllParliaments}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            color: '#86868b',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Checkbox Items Container */}
                    <div style={{
                      maxHeight: '180px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '6px',
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
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              backgroundColor: isChecked ? 'rgba(0, 113, 227, 0.08)' : 'rgba(0, 0, 0, 0.02)',
                              border: `1px solid ${isChecked ? 'rgba(0, 113, 227, 0.3)' : 'rgba(0, 0, 0, 0.04)'}`,
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              fontWeight: isChecked ? 600 : 400,
                              color: isChecked ? '#0071e3' : '#1d1d1f',
                              userSelect: 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              style={{ accentColor: '#0071e3', width: '14px', height: '14px' }}
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
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                        Select Assemblies:
                      </label>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '980px',
                        backgroundColor: 'rgba(0, 113, 227, 0.08)',
                        color: '#0071e3'
                      }}>
                        Selected: {selectedAssemblies.length} / 175
                      </span>
                    </div>

                    {/* Filter & Select All Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="Filter 175 assemblies..."
                        value={assemblySearchText}
                        onChange={(e) => setAssemblySearchText(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: '11.5px',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={selectAllAssemblies}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            color: '#1d1d1f',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllAssemblies}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            color: '#86868b',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Checkbox Items Container */}
                    <div style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: '6px',
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
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              backgroundColor: isChecked ? 'rgba(0, 113, 227, 0.08)' : 'rgba(0, 0, 0, 0.02)',
                              border: `1px solid ${isChecked ? 'rgba(0, 113, 227, 0.3)' : 'rgba(0, 0, 0, 0.04)'}`,
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              fontWeight: isChecked ? 600 : 400,
                              color: isChecked ? '#0071e3' : '#1d1d1f',
                              userSelect: 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              style={{ accentColor: '#0071e3', width: '14px', height: '14px' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                              <span>{a.code} - {a.name}</span>
                              <span style={{ fontSize: '9.5px', color: '#86868b' }}>({a.parliamentName} Parliament)</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* RULES & VALIDATION CONSTRAINTS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
                  Validation Rules & Duplicate Controls
                </h4>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                    Duplicate Check Scope
                  </label>
                  <select
                    value={formData.duplicateScope}
                    onChange={(e) => setFormData({ ...formData, duplicateScope: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      fontSize: '13px',
                      fontWeight: 500,
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Entire Campaign">Entire Campaign (Global cross-staff duplicate check)</option>
                    <option value="Same Day Only">Same Day Only (Allow re-submission on subsequent days)</option>
                    <option value="Same Constituency">Same Constituency Only (Flag duplicates within constituency)</option>
                    <option value="None">Disabled (Allow duplicate entries)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: '#1d1d1f', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.allowExtraSubmissions}
                      onChange={(e) => setFormData({ ...formData, allowExtraSubmissions: e.target.checked })}
                      style={{ width: '15px', height: '15px', accentColor: '#0071e3' }}
                    />
                    <span>Allow extra submissions beyond daily target</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: '#1d1d1f', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.requireProof}
                      onChange={(e) => setFormData({ ...formData, requireProof: e.target.checked })}
                      style={{ width: '15px', height: '15px', accentColor: '#0071e3' }}
                    />
                    <span>Require Proof (URL / Note)</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: '980px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    backgroundColor: '#ffffff',
                    color: '#1d1d1f',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    flex: 1.5,
                    padding: '8px 20px',
                    borderRadius: '980px',
                    border: 'none',
                    backgroundColor: '#0071e3',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 113, 227, 0.25)',
                    transition: 'all 0.15s ease'
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
