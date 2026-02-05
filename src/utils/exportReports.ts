import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { Task, Project, Profile, TimeEntry } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { loadRobotoFontBase64 } from './fontBase64';

interface ExportData {
  tasks: Task[];
  projects: Project[];
  profiles: Profile[];
  timeEntries: TimeEntry[];
  taskStatusData: { name: string; value: number }[];
  projectStatusData: { name: string; value: number }[];
  tagUsageData: { name: string; value: number }[];
  totalTimeMinutes: number;
  avgCompletionDays: number;
  period: string;
  selectedUser: string;
  translations: {
    reportTitle: string;
    generatedAt: string;
    period: string;
    user: string;
    allEmployees: string;
    summary: string;
    totalTasks: string;
    completedTasks: string;
    totalProjects: string;
    timeTracked: string;
    avgCompletionDays: string;
    days: string;
    hours: string;
    tasksByStatus: string;
    projectsByStatus: string;
    popularTags: string;
    tasksList: string;
    taskTitle: string;
    status: string;
    deadline: string;
    createdAt: string;
    projectsList: string;
    projectTitle: string;
    budget: string;
    startDate: string;
    endDate: string;
    timeEntriesList: string;
    date: string;
    duration: string;
    description: string;
    noDeadline: string;
    noBudget: string;
    noDescription: string;
    minutes: string;
  };
}

// Setup PDF with Cyrillic font support
const setupPdfWithFont = async (doc: jsPDF): Promise<void> => {
  try {
    const fontBase64 = await loadRobotoFontBase64();
    doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
  } catch (error) {
    console.error('Failed to load font, using default:', error);
  }
};

export const exportToPDF = (data: ExportData) => {
  const doc = new jsPDF();
  const { translations: t } = data;
  
  // Title
  doc.setFontSize(20);
  doc.text(safeText(t.reportTitle), 14, 22);
  
  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${safeText(t.generatedAt)}: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 32);
  doc.text(`${safeText(t.period)}: ${safeText(data.period)}`, 14, 38);
  doc.text(`${safeText(t.user)}: ${safeText(data.selectedUser) || safeText(t.allEmployees)}`, 14, 44);
  
  let yPos = 55;
  
  // Summary section
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(safeText(t.summary), 14, yPos);
  yPos += 10;
  
  const completedTasks = data.tasks.filter(task => task.status === 'done').length;
  const summaryData = [
    [safeText(t.totalTasks), data.tasks.length.toString()],
    [safeText(t.completedTasks), completedTasks.toString()],
    [safeText(t.totalProjects), data.projects.length.toString()],
    [safeText(t.timeTracked), `${Math.round(data.totalTimeMinutes / 60)} ${safeText(t.hours)}`],
    [safeText(t.avgCompletionDays), `${data.avgCompletionDays} ${safeText(t.days)}`],
  ];
  
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 40 },
    },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Tasks by status
  if (data.taskStatusData.length > 0) {
    doc.setFontSize(14);
    doc.text(safeText(t.tasksByStatus), 14, yPos);
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [[safeText(t.status), safeText(t.totalTasks)]],
      body: data.taskStatusData.map(item => [safeText(item.name), item.value.toString()]),
      theme: 'striped',
      styles: { fontSize: 10 },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Projects by status
  if (data.projectStatusData.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.text(safeText(t.projectsByStatus), 14, yPos);
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [[safeText(t.status), safeText(t.totalProjects)]],
      body: data.projectStatusData.map(item => [safeText(item.name), item.value.toString()]),
      theme: 'striped',
      styles: { fontSize: 10 },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Popular tags
  if (data.tagUsageData.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.text(safeText(t.popularTags), 14, yPos);
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Tag', 'Usage']],
      body: data.tagUsageData.map(item => [safeText(item.name), item.value.toString()]),
      theme: 'striped',
      styles: { fontSize: 10 },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Tasks list
  if (data.tasks.length > 0) {
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(14);
    doc.text(safeText(t.tasksList), 14, yPos);
    yPos += 8;
    
    const taskRows = data.tasks.slice(0, 50).map(task => [
      safeText(task.title.substring(0, 40) + (task.title.length > 40 ? '...' : '')),
      safeText(getStatusLabel(task.status, t)),
      task.deadline ? format(parseISO(task.deadline), 'dd.MM.yyyy') : safeText(t.noDeadline),
      format(parseISO(task.created_at), 'dd.MM.yyyy'),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [[safeText(t.taskTitle), safeText(t.status), safeText(t.deadline), safeText(t.createdAt)]],
      body: taskRows,
      theme: 'striped',
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
      },
    });
  }
  
  // Projects list
  if (data.projects.length > 0) {
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(14);
    doc.text(safeText(t.projectsList), 14, yPos);
    yPos += 8;
    
    const projectRows = data.projects.slice(0, 50).map(project => [
      safeText(project.title.substring(0, 35) + (project.title.length > 35 ? '...' : '')),
      safeText(getProjectStatusLabel(project.status, t)),
      project.budget ? `$${project.budget.toLocaleString()}` : safeText(t.noBudget),
      project.start_date ? format(parseISO(project.start_date), 'dd.MM.yyyy') : '-',
      project.end_date ? format(parseISO(project.end_date), 'dd.MM.yyyy') : '-',
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [[safeText(t.projectTitle), safeText(t.status), safeText(t.budget), safeText(t.startDate), safeText(t.endDate)]],
      body: projectRows,
      theme: 'striped',
      styles: { fontSize: 9 },
    });
  }
  
  // Time entries
  if (data.timeEntries.length > 0) {
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(14);
    doc.text(safeText(t.timeEntriesList), 14, yPos);
    yPos += 8;
    
    const timeRows = data.timeEntries.slice(0, 50).map(entry => [
      format(parseISO(entry.start_time), 'dd.MM.yyyy HH:mm'),
      `${entry.duration_minutes || 0} ${safeText(t.minutes)}`,
      safeText(entry.description?.substring(0, 40) || t.noDescription),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [[safeText(t.date), safeText(t.duration), safeText(t.description)]],
      body: timeRows,
      theme: 'striped',
      styles: { fontSize: 9 },
    });
  }
  
  doc.save(`analytics-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

export const exportToExcel = async (data: ExportData) => {
  const { translations: t } = data;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CRM Pro';
  workbook.created = new Date();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow([t.reportTitle]);
  summarySheet.addRow([]);
  summarySheet.addRow([t.generatedAt, format(new Date(), 'dd.MM.yyyy HH:mm')]);
  summarySheet.addRow([t.period, data.period]);
  summarySheet.addRow([t.user, data.selectedUser || t.allEmployees]);
  summarySheet.addRow([]);
  summarySheet.addRow([t.summary]);
  summarySheet.addRow([t.totalTasks, data.tasks.length]);
  summarySheet.addRow([t.completedTasks, data.tasks.filter(task => task.status === 'done').length]);
  summarySheet.addRow([t.totalProjects, data.projects.length]);
  summarySheet.addRow([t.timeTracked, `${Math.round(data.totalTimeMinutes / 60)} ${t.hours}`]);
  summarySheet.addRow([t.avgCompletionDays, `${data.avgCompletionDays} ${t.days}`]);
  
  // Style the title
  summarySheet.getRow(1).font = { bold: true, size: 14 };
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 30;
  
  // Task status sheet
  if (data.taskStatusData.length > 0) {
    const taskStatusSheet = workbook.addWorksheet('Task Status');
    taskStatusSheet.addRow([t.status, t.totalTasks]);
    taskStatusSheet.getRow(1).font = { bold: true };
    data.taskStatusData.forEach(item => {
      taskStatusSheet.addRow([item.name, item.value]);
    });
    taskStatusSheet.getColumn(1).width = 20;
    taskStatusSheet.getColumn(2).width = 15;
  }
  
  // Project status sheet
  if (data.projectStatusData.length > 0) {
    const projectStatusSheet = workbook.addWorksheet('Project Status');
    projectStatusSheet.addRow([t.status, t.totalProjects]);
    projectStatusSheet.getRow(1).font = { bold: true };
    data.projectStatusData.forEach(item => {
      projectStatusSheet.addRow([item.name, item.value]);
    });
    projectStatusSheet.getColumn(1).width = 20;
    projectStatusSheet.getColumn(2).width = 15;
  }
  
  // Tags sheet
  if (data.tagUsageData.length > 0) {
    const tagsSheet = workbook.addWorksheet('Tags');
    tagsSheet.addRow(['Tag', 'Usage']);
    tagsSheet.getRow(1).font = { bold: true };
    data.tagUsageData.forEach(item => {
      tagsSheet.addRow([item.name, item.value]);
    });
    tagsSheet.getColumn(1).width = 20;
    tagsSheet.getColumn(2).width = 10;
  }
  
  // Tasks sheet
  if (data.tasks.length > 0) {
    const tasksSheet = workbook.addWorksheet('Tasks');
    tasksSheet.addRow([t.taskTitle, t.status, t.deadline, t.createdAt, t.description]);
    tasksSheet.getRow(1).font = { bold: true };
    data.tasks.forEach(task => {
      tasksSheet.addRow([
        task.title,
        getStatusLabel(task.status, t),
        task.deadline ? format(parseISO(task.deadline), 'dd.MM.yyyy') : '',
        format(parseISO(task.created_at), 'dd.MM.yyyy'),
        task.description || ''
      ]);
    });
    tasksSheet.getColumn(1).width = 40;
    tasksSheet.getColumn(2).width = 15;
    tasksSheet.getColumn(3).width = 15;
    tasksSheet.getColumn(4).width = 15;
    tasksSheet.getColumn(5).width = 50;
  }
  
  // Projects sheet
  if (data.projects.length > 0) {
    const projectsSheet = workbook.addWorksheet('Projects');
    projectsSheet.addRow([t.projectTitle, t.status, t.budget, t.startDate, t.endDate, t.description]);
    projectsSheet.getRow(1).font = { bold: true };
    data.projects.forEach(project => {
      projectsSheet.addRow([
        project.title,
        getProjectStatusLabel(project.status, t),
        project.budget || '',
        project.start_date ? format(parseISO(project.start_date), 'dd.MM.yyyy') : '',
        project.end_date ? format(parseISO(project.end_date), 'dd.MM.yyyy') : '',
        project.description || ''
      ]);
    });
    projectsSheet.getColumn(1).width = 35;
    projectsSheet.getColumn(2).width = 15;
    projectsSheet.getColumn(3).width = 15;
    projectsSheet.getColumn(4).width = 15;
    projectsSheet.getColumn(5).width = 15;
    projectsSheet.getColumn(6).width = 50;
  }
  
  // Time entries sheet
  if (data.timeEntries.length > 0) {
    const timeSheet = workbook.addWorksheet('Time Entries');
    timeSheet.addRow([t.date, t.duration, t.description]);
    timeSheet.getRow(1).font = { bold: true };
    data.timeEntries.forEach(entry => {
      timeSheet.addRow([
        format(parseISO(entry.start_time), 'dd.MM.yyyy HH:mm'),
        entry.duration_minutes || 0,
        entry.description || ''
      ]);
    });
    timeSheet.getColumn(1).width = 20;
    timeSheet.getColumn(2).width = 15;
    timeSheet.getColumn(3).width = 50;
  }
  
  // Generate and download the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};

function getStatusLabel(status: string, t: ExportData['translations']): string {
  const statusMap: Record<string, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'In Review',
    done: 'Done',
  };
  return statusMap[status] || status;
}

function getProjectStatusLabel(status: string, t: ExportData['translations']): string {
  const statusMap: Record<string, string> = {
    planning: 'Planning',
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return statusMap[status] || status;
}
