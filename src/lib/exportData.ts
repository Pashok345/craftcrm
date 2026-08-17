import ExcelJS from 'exceljs';

export interface ExportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const cell = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export const exportRowsToCSV = <T,>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[]
) => {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    columns.map((c) => escape(c.header)).join(';'),
    ...rows.map((r) => columns.map((c) => escape(cell(c.value(r)))).join(';')),
  ];
  // BOM for Excel/Cyrillic
  download(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
};

export const exportRowsToExcel = async <T,>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
  sheetName = 'Data'
) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 30));
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: 24 }));
  rows.forEach((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((c) => (obj[c.key] = cell(c.value(r))));
    ws.addRow(obj);
  });
  ws.getRow(1).font = { bold: true };
  const buffer = await wb.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`
  );
};
