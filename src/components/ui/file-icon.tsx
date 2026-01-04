import { FileText, FileSpreadsheet, FileImage, File } from 'lucide-react';

interface FileIconProps {
  fileName: string;
  className?: string;
}

export const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Word documents
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return { icon: FileText, color: 'text-blue-600', label: 'Word' };
  }
  
  // PDF
  if (ext === 'pdf') {
    return { icon: FileText, color: 'text-red-600', label: 'PDF' };
  }
  
  // Excel
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return { icon: FileSpreadsheet, color: 'text-green-600', label: 'Excel' };
  }
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic'].includes(ext)) {
    return { icon: FileImage, color: 'text-purple-600', label: 'Photo' };
  }
  
  // Text files
  if (['txt', 'md', 'log'].includes(ext)) {
    return { icon: FileText, color: 'text-gray-600', label: 'TXT' };
  }
  
  // Default
  return { icon: File, color: 'text-muted-foreground', label: 'File' };
};

export const FileIcon = ({ fileName, className = 'h-5 w-5' }: FileIconProps) => {
  const { icon: Icon, color } = getFileIcon(fileName);
  return <Icon className={`${className} ${color}`} />;
};
