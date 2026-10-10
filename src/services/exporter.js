/**
 * BRK Social - Reports & Exporter Utility
 * Generates downloadable CSV / Excel files for Admin reporting with AP Constituency mapping
 */

export function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportDailyEmployeeReport(employeeProgressList, dateStr) {
  const headers = [
    'Employee Code',
    'Name',
    'Level',
    'Parliament Code',
    'Parliament Name',
    'Assembly Code',
    'Assembly Name',
    'Daily Target',
    'Valid Submissions',
    'Duplicates Caught',
    'Remaining',
    'Status'
  ];
  
  const rows = employeeProgressList.map(emp => [
    `"${emp.id}"`,
    `"${emp.name}"`,
    `"${emp.level || 'Assembly'}"`,
    `"${emp.parliamentCode || ''}"`,
    `"${emp.parliamentName || ''}"`,
    `"${emp.assemblyCode || 'N/A'}"`,
    `"${emp.assemblyName || 'N/A'}"`,
    emp.target,
    emp.valid,
    emp.duplicate,
    emp.remaining,
    `"${emp.status}"`
  ]);

  const csvText = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(`BRK_Social_Daily_Constituency_Report_${dateStr}.csv`, csvText);
}

export function exportSubmissionsReport(submissions, dateStr) {
  const headers = ['Submission ID', 'Employee Code', 'Employee Name', 'Platform', 'Normalized Username', 'Raw Input', 'Status', 'Submitted At', 'Date'];
  
  const rows = submissions.map(sub => [
    `"${sub.id}"`,
    `"${sub.employeeId}"`,
    `"${sub.employeeName}"`,
    `"${sub.platform}"`,
    `"${sub.username}"`,
    `"${(sub.rawInput || '').replace(/"/g, '""')}"`,
    `"${sub.status}"`,
    `"${new Date(sub.submittedAt).toLocaleString()}"`,
    `"${sub.date}"`
  ]);

  const csvText = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(`BRK_Social_Submissions_${dateStr}.csv`, csvText);
}

export function exportDuplicateAuditReport(auditLogs) {
  const headers = ['Audit ID', 'Timestamp', 'Type', 'Target Handle', 'Original Employee', 'Attempted Duplicate Employee', 'Audit Message'];
  
  const rows = auditLogs.map(log => [
    `"${log.id}"`,
    `"${new Date(log.timestamp).toLocaleString()}"`,
    `"${log.type}"`,
    `"${log.username || ''}"`,
    `"${log.originalEmployeeName || log.originalEmployeeId || ''}"`,
    `"${log.attemptedEmployeeName || log.attemptedEmployeeId || ''}"`,
    `"${(log.message || '').replace(/"/g, '""')}"`
  ]);

  const csvText = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadCSV(`BRK_Social_Duplicate_Audit_${new Date().toISOString().split('T')[0]}.csv`, csvText);
}
