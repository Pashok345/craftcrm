import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

export const isImageFile = (fileType: string | null, fileName: string): boolean => {
  if (fileType && IMAGE_TYPES.includes(fileType.toLowerCase())) return true;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
};

interface ImageThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  large?: boolean;
}

export const ImageThumbnail = ({ src, alt, className, large = false }: ImageThumbnailProps) => {
  const [open, setOpen] = useState(false);

  const sizeClasses = large
    ? 'w-full max-h-[600px] object-contain'
    : 'max-w-[200px] max-h-[150px] object-cover';

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${sizeClasses} rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity ${className || ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center bg-black/95 border-none">
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[85vh] object-contain rounded"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
