import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExportColumn, exportRowsToCSV, exportRowsToExcel } from '@/lib/exportData';
import { toast } from 'sonner';

interface ExportMenuProps<T> {
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
  sheetName?: string;
  disabled?: boolean;
  size?: 'default' | 'sm';
}

export function ExportMenu<T>({
  filename,
  columns,
  rows,
  sheetName,
  disabled,
  size = 'default',
}: ExportMenuProps<T>) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  const guard = () => {
    if (!rows.length) {
      toast.error(t('exportNothingToExport'));
      return false;
    }
    return true;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-2" disabled={disabled || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t('exportAction')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            if (!guard()) return;
            exportRowsToCSV(filename, columns, rows);
          }}
        >
          <FileText className="h-4 w-4 mr-2" />
          {t('exportCsv')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            if (!guard()) return;
            setBusy(true);
            try {
              await exportRowsToExcel(filename, columns, rows, sheetName || filename);
            } catch (e) {
              toast.error(String((e as Error).message || e));
            }
            setBusy(false);
          }}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          {t('exportExcel')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
