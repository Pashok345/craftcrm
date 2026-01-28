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

// Transliteration function for Cyrillic to Latin
const transliterate = (text: string): string => {
  const cyrillicToLatin: Record<string, string> = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
    'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
    'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu',
    'Я': 'Ya',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya',
    // Ukrainian
    'І': 'I', 'і': 'i', 'Ї': 'Yi', 'ї': 'yi', 'Є': 'Ye', 'є': 'ye', 'Ґ': 'G', 'ґ': 'g',
  };

  return text.split('').map(char => cyrillicToLatin[char] || char).join('');
};

// Check if text contains Cyrillic characters
const containsCyrillic = (text: string): boolean => {
  return /[\u0400-\u04FF]/.test(text);
};

// Safely render text in PDF (transliterate if Cyrillic)
const safeText = (text: string | null | undefined): string => {
  if (!text) return '';
  return containsCyrillic(text) ? transliterate(text) : text;
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
