import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Upload, Download, Loader2 } from 'lucide-react';
import type { Client } from '@/types/sales';

interface ClientImportExportProps {
  clients: Client[];
}

export const ClientImportExport = ({ clients }: ClientImportExportProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const exportCSV = () => {
    const headers = [t('clientName'), t('email'), t('phone'), t('company'), t('position'), t('notes')];
    const rows = clients.map(c => [
      c.name,
      c.email || '',
      c.phone || '',
      c.company || '',
      c.position || '',
      (c.notes || '').replace(/"/g, '""'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(',')),
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: t('exportSuccess') });
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('Empty file');

      // Skip header row
      const dataLines = lines.slice(1);
      const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#6366F1'];

      const clientsToInsert = dataLines.map((line) => {
        // Parse CSV with quoted fields
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        fields.push(current.trim());

        return {
          name: fields[0] || 'Unknown',
          email: fields[1] || null,
          phone: fields[2] || null,
          company: fields[3] || null,
          position: fields[4] || null,
          notes: fields[5] || null,
          avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          created_by: user?.id,
        };
      }).filter(c => c.name && c.name !== 'Unknown');

      if (clientsToInsert.length === 0) throw new Error('No valid clients found');

      const { error } = await supabase.from('clients').insert(clientsToInsert);
      if (error) throw error;

      return clientsToInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: `${t('importSuccess')}: ${count} ${t('clients').toLowerCase()}` });
    },
    onError: (error) => {
      console.error('Import error:', error);
      toast({ title: t('importError'), variant: 'destructive' });
    },
    onSettled: () => {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    importMutation.mutate(file);
  };

  return (
    <div className="flex gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImport}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
      >
        {importing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {t('importCSV')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportCSV}
        disabled={clients.length === 0}
      >
        <Download className="h-4 w-4 mr-2" />
        {t('exportCSV')}
      </Button>
    </div>
  );
};
