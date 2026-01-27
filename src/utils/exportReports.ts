import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Task, Project, Profile, TimeEntry } from '@/types/database';
import { format, parseISO } from 'date-fns';

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

export const exportToPDF = (data: ExportData) => {
  const doc = new jsPDF();
  const { translations: t } = data;
  
  // Title
  doc.setFontSize(20);
  doc.text(t.reportTitle, 14, 22);
  
  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${t.generatedAt}: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 32);
  doc.text(`${t.period}: ${data.period}`, 14, 38);
  doc.text(`${t.user}: ${data.selectedUser || t.allEmployees}`, 14, 44);
  
  let yPos = 55;
  
  // Summary section
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(t.summary, 14, yPos);
  yPos += 10;
  
  const completedTasks = data.tasks.filter(task => task.status === 'done').length;
  const summaryData = [
    [t.totalTasks, data.tasks.length.toString()],
    [t.completedTasks, completedTasks.toString()],
    [t.totalProjects, data.projects.length.toString()],
    [t.timeTracked, `${Math.round(data.totalTimeMinutes / 60)} ${t.hours}`],
    [t.avgCompletionDays, `${data.avgCompletionDays} ${t.days}`],
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
    doc.text(t.tasksByStatus, 14, yPos);
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [[t.status, t.totalTasks]],
      body: data.taskStatusData.map(item => [item.name, item.value.toString()]),
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
    doc.text(t.projectsByStatus, 14, yPos);
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [[t.status, t.totalProjects]],
      body: data.projectStatusData.map(item => [item.name, item.value.toString()]),
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
    doc.text(t.popularTags, 14, yPos);
    yPos += 8;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Tag', 'Usage']],
      body: data.tagUsageData.map(item => [item.name, item.value.toString()]),
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
    doc.text(t.tasksList, 14, yPos);
    yPos += 8;
    
    const taskRows = data.tasks.slice(0, 50).map(task => [
      task.title.substring(0, 40) + (task.title.length > 40 ? '...' : ''),
      getStatusLabel(task.status, t),
      task.deadline ? format(parseISO(task.deadline), 'dd.MM.yyyy') : t.noDeadline,
      format(parseISO(task.created_at), 'dd.MM.yyyy'),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [[t.taskTitle, t.status, t.deadline, t.createdAt]],
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
    doc.text(t.projectsList, 14, yPos);
    yPos += 8;
    
    const projectRows = data.projects.slice(0, 50).map(project => [
      project.title.substring(0, 35) + (project.title.length > 35 ? '...' : ''),
      getProjectStatusLabel(project.status, t),
      project.budget ? `$${project.budget.toLocaleString()}` : t.noBudget,
      project.start_date ? format(parseISO(project.start_date), 'dd.MM.yyyy') : '-',
      project.end_date ? format(parseISO(project.end_date), 'dd.MM.yyyy') : '-',
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [[t.projectTitle, t.status, t.budget, t.startDate, t.endDate]],
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
    doc.text(t.timeEntriesList, 14, yPos);
    yPos += 8;
    
    const timeRows = data.timeEntries.slice(0, 50).map(entry => [
      format(parseISO(entry.start_time), 'dd.MM.yyyy HH:mm'),
      `${entry.duration_minutes || 0} ${t.minutes}`,
      entry.description?.substring(0, 40) || t.noDescription,
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [[t.date, t.duration, t.description]],
      body: timeRows,
      theme: 'striped',
      styles: { fontSize: 9 },
    });
  }
  
  doc.save(`analytics-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

export const exportToExcel = (data: ExportData) => {
  const { translations: t } = data;
  const workbook = XLSX.utils.book_new();
  
  // Summary sheet
  const summaryData = [
    [t.reportTitle],
    [],
    [t.generatedAt, format(new Date(), 'dd.MM.yyyy HH:mm')],
    [t.period, data.period],
    [t.user, data.selectedUser || t.allEmployees],
    [],
    [t.summary],
    [t.totalTasks, data.tasks.length],
    [t.completedTasks, data.tasks.filter(task => task.status === 'done').length],
    [t.totalProjects, data.projects.length],
    [t.timeTracked, `${Math.round(data.totalTimeMinutes / 60)} ${t.hours}`],
    [t.avgCompletionDays, `${data.avgCompletionDays} ${t.days}`],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Task status sheet
  if (data.taskStatusData.length > 0) {
    const taskStatusSheet = XLSX.utils.json_to_sheet(
      data.taskStatusData.map(item => ({
        [t.status]: item.name,
        [t.totalTasks]: item.value,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, taskStatusSheet, 'Task Status');
  }
  
  // Project status sheet
  if (data.projectStatusData.length > 0) {
    const projectStatusSheet = XLSX.utils.json_to_sheet(
      data.projectStatusData.map(item => ({
        [t.status]: item.name,
        [t.totalProjects]: item.value,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, projectStatusSheet, 'Project Status');
  }
  
  // Tags sheet
  if (data.tagUsageData.length > 0) {
    const tagsSheet = XLSX.utils.json_to_sheet(
      data.tagUsageData.map(item => ({
        Tag: item.name,
        Usage: item.value,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, tagsSheet, 'Tags');
  }
  
  // Tasks sheet
  if (data.tasks.length > 0) {
    const tasksSheet = XLSX.utils.json_to_sheet(
      data.tasks.map(task => ({
        [t.taskTitle]: task.title,
        [t.status]: getStatusLabel(task.status, t),
        [t.deadline]: task.deadline ? format(parseISO(task.deadline), 'dd.MM.yyyy') : '',
        [t.createdAt]: format(parseISO(task.created_at), 'dd.MM.yyyy'),
        [t.description]: task.description || '',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, tasksSheet, 'Tasks');
  }
  
  // Projects sheet
  if (data.projects.length > 0) {
    const projectsSheet = XLSX.utils.json_to_sheet(
      data.projects.map(project => ({
        [t.projectTitle]: project.title,
        [t.status]: getProjectStatusLabel(project.status, t),
        [t.budget]: project.budget || '',
        [t.startDate]: project.start_date ? format(parseISO(project.start_date), 'dd.MM.yyyy') : '',
        [t.endDate]: project.end_date ? format(parseISO(project.end_date), 'dd.MM.yyyy') : '',
        [t.description]: project.description || '',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, projectsSheet, 'Projects');
  }
  
  // Time entries sheet
  if (data.timeEntries.length > 0) {
    const timeSheet = XLSX.utils.json_to_sheet(
      data.timeEntries.map(entry => ({
        [t.date]: format(parseISO(entry.start_time), 'dd.MM.yyyy HH:mm'),
        [t.duration]: entry.duration_minutes || 0,
        [t.description]: entry.description || '',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, timeSheet, 'Time Entries');
  }
  
  XLSX.writeFile(workbook, `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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
