// Lazy loaders for heavy export libraries (jsPDF, jspdf-autotable, ExcelJS).
// Keeps them out of the main bundle — they are only fetched when a user exports.

export const loadPdfLib = async () => {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable: autoTableMod.default };
};

export const loadExcelLib = async () => (await import('exceljs')).default;
