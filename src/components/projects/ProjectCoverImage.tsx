import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  url?: string | null;
  className?: string;
  alt?: string;
  fallbackColor?: string | null;
  children?: React.ReactNode;
}

/**
 * Renders a project cover image, transparently resolving signed URLs for
 * `sb://bucket/path` sentinels (user-uploaded covers in a private bucket).
 */
export function ProjectCoverImage({ url, className, alt, fallbackColor, children }: Props) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!url) { setResolved(null); return; }
      if (url.startsWith('sb://')) {
        const [, , bucket, ...rest] = url.split('/');
        const path = rest.join('/');
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (!cancelled) setResolved(data?.signedUrl || null);
      } else {
        setResolved(url);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const style: React.CSSProperties = resolved
    ? { backgroundImage: `url(${resolved})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: fallbackColor || 'hsl(var(--muted))' };

  return (
    <div className={className} style={style} aria-label={alt}>
      {children}
    </div>
  );
}
