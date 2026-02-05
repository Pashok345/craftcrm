import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { FileIcon } from '@/components/ui/file-icon';
import { Upload, Trash2, Download, FileText } from 'lucide-react';

interface ProposalAttachmentsSectionProps {
  proposalId: string;
}

interface ProposalAttachment {
  id: string;
  proposal_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  uploaded_by: string;
  created_at: string;
}

export const ProposalAttachmentsSection = ({ proposalId }: ProposalAttachmentsSectionProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ['proposal-attachments', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_attachments')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProposalAttachment[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachment: ProposalAttachment) => {
      // Delete from storage
      const filePath = attachment.file_url.split('/').slice(-2).join('/');
      await supabase.storage.from('proposal-files').remove([filePath]);
      
      // Delete from database
      const { error } = await supabase
        .from('proposal_attachments')
        .delete()
        .eq('id', attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-attachments', proposalId] });
      toast({ title: t('attachmentDeleted') });
    },
    onError: () => {
      toast({ title: t('error'), variant: 'destructive' });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${proposalId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('proposal-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('proposal-files')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase.from('proposal_attachments').insert({
        proposal_id: proposalId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        uploaded_by: user.id,
      });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ['proposal-attachments', proposalId] });
      toast({ title: t('attachmentUploaded') });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: t('error'), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{t('attachments')}</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? t('uploading') : t('uploadFile')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {attachments.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('noAttachments')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon fileName={attachment.file_name} className="h-8 w-8 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                >
                  <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                {attachment.uploaded_by === user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(attachment)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
