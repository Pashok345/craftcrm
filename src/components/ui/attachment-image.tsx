import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ImageThumbnail } from '@/components/ui/image-lightbox';
import { Loader2 } from 'lucide-react';

const extractPath = (url: string, bucket: string): string | null => {
  // Match both signed and public URLs, plus raw stored path fallbacks
  const markers = [`/storage/v1/object/sign/${bucket}/`, `/storage/v1/object/public/${bucket}/`, `/${bucket}/`];
  for (const m of markers) {
    const i = url.indexOf(m);
    if (i !== -1) return url.substring(i + m.length).split('?')[0];
  }
  // Already a raw path (uuid/timestamp-name)
  if (!/^https?:/i.test(url)) return url;
  return null;
};

interface Props {
  fileUrl: string;
  fileName: string;
  bucket?: string;
}

/**
 * Resilient image loader that bypasses expired signed URLs and ad-blockers
 * by downloading the file via Supabase Storage SDK and rendering a blob URL.
 */
export const AttachmentImage = ({ fileUrl, fileName, bucket = 'task-attachments' }: Props) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked = false;
    let blobUrl: string | null = null;
    (async () => {
      const path = extractPath(fileUrl, bucket);
      if (!path) {
        setSrc(fileUrl);
        return;
      }
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (revoked) return;
      if (error || !data) {
        // Fallback: try regenerating a signed URL
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (signed?.signedUrl) setSrc(signed.signedUrl);
        else setError(true);
        return;
      }
      blobUrl = URL.createObjectURL(data);
      setSrc(blobUrl);
    })();
    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [fileUrl, bucket]);

  if (error) {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
        {fileName}
      </a>
    );
  }
  if (!src) {
    return (
      <div className="w-[120px] h-[90px] rounded-lg border border-border bg-muted flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <ImageThumbnail src={src} alt={fileName} />;
};
