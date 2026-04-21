import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Task, Project } from '@/types/database';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { format, parseISO } from 'date-fns';
import { loadRobotoFontBase64 } from '@/utils/fontBase64';

interface Props {
  tasks: Task[];
  projects: Record<string, Project>;
}

const STATUS_LABELS_RU: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Выполнено',
};

const STATUS_LABELS_EN: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
};

const STATUS_LABELS_UK: Record<string, string> = {
  todo: 'До виконання',
  in_progress: 'В роботі',
  review: 'На перевірці',
  done: 'Виконано',
};

export const TasksExport = ({ tasks, projects }: Props) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const getStatusLabel = (status: string) => {
    const maps = { ru: STATUS_LABELS_RU, en: STATUS_LABELS_EN, uk: STATUS_LABELS_UK };
    return (maps[language] || STATUS_LABELS_RU)[status] || status;
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      
      // Load font
      try {
        const fontBase64 = await loadRobotoFontBase64();
        doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
      } catch {}

      doc.setFontSize(18);
      doc.text(t('tasksTitle'), 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`${t('date')}: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 28);
      doc.text(`${t('totalCount')}: ${tasks.length}`, 14, 34);

      const rows = tasks.map(task => [
        task.title.substring(0, 60) + (task.title.length > 60 ? '…' : ''),
        getStatusLabel(task.status),
        task.project_id && projects[task.project_id] ? projects[task.project_id].title : '—',
        task.deadline ? format(parseISO(task.deadline), 'dd.MM.yyyy') : '—',
        format(parseISO(task.created_at), 'dd.MM.yyyy'),
      ]);

      autoTable(doc, {
        startY: 42,
        head: [[t('taskTitle'), t('status'), t('project'), t('deadline'), t('createdAt')]],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 9, font: 'Roboto' },
        headStyles: { font: 'Roboto', fontStyle: 'normal', fillColor: [59, 130, 246], textColor: 255 },
        columnStyles: { 0: { cellWidth: 70 } },
      });

      doc.save(`tasks-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: t('reportGenerated') });
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(t('tasksTitle'));

      sheet.addRow([t('taskTitle'), t('status'), t('project'), t('deadline'), t('createdAt'), t('description')]);
      sheet.getRow(1).font = { bold: true };

      tasks.forEach(task => {
        sheet.addRow([
          task.title,
          getStatusLabel(task.status),
          task.project_id && projects[task.project_id] ? projects[task.project_id].title : '',
          task.deadline ? format(parseISO(task.deadline), 'dd.MM.yyyy') : '',
          format(parseISO(task.created_at), 'dd.MM.yyyy'),
          task.description || '',
        ]);
      });

      sheet.getColumn(1).width = 40;
      sheet.getColumn(2).width = 15;
      sheet.getColumn(3).width = 20;
      sheet.getColumn(4).width = 15;
      sheet.getColumn(5).width = 15;
      sheet.getColumn(6).width = 50;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tasks-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: t('reportGenerated') });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={exporting}>
          <Download className="h-4 w-4" />
          {t('exportReport')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportPDF} className="gap-2">
          <FileText className="h-4 w-4" />
          {t('exportPDF')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {t('exportExcel')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
