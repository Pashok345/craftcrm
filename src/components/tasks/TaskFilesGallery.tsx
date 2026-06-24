import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Download, X, FileText, Image as ImageIcon, Files, Upload, Loader2, Plus } from 'lucide-react';
import { isImageFile } from '@/components/ui/image-lightbox';
import { FileIcon, getFileIcon } from '@/components/ui/file-icon';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TaskAttachment } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';

const extractStoragePath = (url: string, bucket: string): string | null => {
  const markers = [`/storage/v1/object/sign/${bucket}/`, `/storage/v1/object/public/${bucket}/`, `/${bucket}/`];
  for (const m of markers) {
    const i = url.indexOf(m);
    if (i !== -1) return url.substring(i + m.length).split('?')[0];
  }
  if (!/^https?:/i.test(url)) return url;
  return null;
};

const useResolvedUrl = (fileUrl: string, bucket = 'task-attachments') => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    (async () => {
      const path = extractStoragePath(fileUrl, bucket);
      if (!path) { if (!cancelled) setSrc(fileUrl); return; }
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (cancelled) return;
      if (error || !data) {
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (signed?.signedUrl && !cancelled) setSrc(signed.signedUrl);
        return;
      }
      blobUrl = URL.createObjectURL(data);
      if (!cancelled) setSrc(blobUrl);
    })();
    return () => { cancelled = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [fileUrl, bucket]);
  return src;
};

const ResolvedImg = ({ fileUrl, alt, className }: { fileUrl: string; alt: string; className?: string }) => {
  const src = useResolvedUrl(fileUrl);
  if (!src) return <div className={`${className || ''} flex items-center justify-center bg-muted`}><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  return <img src={src} alt={alt} loading="lazy" className={className} />;
};

const ResolvedVideo = ({ fileUrl, className }: { fileUrl: string; className?: string }) => {
  const src = useResolvedUrl(fileUrl);
  if (!src) return <div className={`${className || ''} flex items-center justify-center bg-muted`}><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  return <video src={src} className={className} preload="metadata" muted />;
};

interface TaskFilesGalleryProps {
  attachments: TaskAttachment[];
  onUpload?: (files: FileList) => Promise<void> | void;
  uploading?: boolean;
}

const PREVIEWABLE_DOC_EXT = ['pdf', 'txt', 'md', 'log', 'csv', 'json', 'xml', 'html'];
const VIDEO_EXT = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
const OFFICE_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() || '';

const isVideo = (att: TaskAttachment) =>
  att.file_type?.startsWith('video/') || VIDEO_EXT.includes(getExt(att.file_name));

const isAudio = (att: TaskAttachment) =>
  att.file_type?.startsWith('audio/') || AUDIO_EXT.includes(getExt(att.file_name));

const isOffice = (att: TaskAttachment) => OFFICE_EXT.includes(getExt(att.file_name));

const isPreviewable = (att: TaskAttachment) => {
  if (isImageFile(att.file_type, att.file_name)) return true;
  if (isVideo(att) || isAudio(att)) return true;
  if (isOffice(att)) return true;
  const ext = getExt(att.file_name);
  if (att.file_type?.includes('pdf') || ext === 'pdf') return true;
  return PREVIEWABLE_DOC_EXT.includes(ext);
};

export const TaskFilesGallery = ({ attachments, onUpload, uploading }: TaskFilesGalleryProps) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'files'>('all');

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUpload) {
      await onUpload(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const images = useMemo(
    () => attachments.filter(a => isImageFile(a.file_type, a.file_name)),
    [attachments]
  );
  const files = useMemo(
    () => attachments.filter(a => !isImageFile(a.file_type, a.file_name)),
    [attachments]
  );

  const visibleList = useMemo(() => {
    if (activeTab === 'images') return images;
    if (activeTab === 'files') return files;
    return attachments;
  }, [activeTab, attachments, images, files]);

  const openLightbox = (att: TaskAttachment) => {
    const idx = visibleList.findIndex(a => a.id === att.id);
    setCurrentIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const goPrev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + visibleList.length) % visibleList.length);
  }, [visibleList.length]);

  const goNext = useCallback(() => {
    setCurrentIndex(i => (i + 1) % visibleList.length);
  }, [visibleList.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, goPrev, goNext]);

  const downloadFile = async (att: TaskAttachment) => {
    const bucket = 'task-attachments';
    const path = extractStoragePath(att.file_url, bucket);
    try {
      let blob: Blob | null = null;
      if (path) {
        const { data } = await supabase.storage.from(bucket).download(path);
        if (data) blob = data;
      }
      if (!blob) {
        const res = await fetch(att.file_url);
        blob = await res.blob();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.file_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      window.open(att.file_url, '_blank');
    }
  };

  const hiddenInput = onUpload ? (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      className="hidden"
      onChange={handleFilesSelected}
    />
  ) : null;

  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Files className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">
          {t('noAttachments') || 'Нет вложений'}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {t('uploadFirstFile')}
        </p>
        {onUpload && (
          <>
            <Button
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
              {t('addFiles')}
            </Button>
            {hiddenInput}
          </>
        )}
      </div>
    );
  }

  const renderItem = (att: TaskAttachment) => {
    const isImg = isImageFile(att.file_type, att.file_name);
    if (isImg) {
      return (
        <button
          key={att.id}
          onClick={() => openLightbox(att)}
          className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted hover:opacity-90 transition-opacity"
          title={att.file_name}
        >
          <ResolvedImg
            fileUrl={att.file_url}
            alt={att.file_name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[10px] text-white truncate">{att.file_name}</p>
          </div>
        </button>
      );
    }
    if (isVideo(att)) {
      return (
        <button
          key={att.id}
          onClick={() => openLightbox(att)}
          className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-black hover:opacity-90 transition-opacity"
          title={att.file_name}
        >
          <ResolvedVideo
            fileUrl={att.file_url}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
            <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center">
              <div className="w-0 h-0 border-y-[7px] border-y-transparent border-l-[10px] border-l-black ml-1" />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
            <p className="text-[10px] text-white truncate">{att.file_name}</p>
          </div>
        </button>
      );
    }
    const { label } = getFileIcon(att.file_name);
    return (
      <button
        key={att.id}
        onClick={() => (isPreviewable(att) ? openLightbox(att) : downloadFile(att))}
        className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 p-3 hover:bg-muted transition-colors"
        title={att.file_name}
      >
        <FileIcon fileName={att.file_name} className="h-10 w-10" />
        <span className="text-xs text-muted-foreground uppercase">{label}</span>
        <span className="text-[11px] text-foreground line-clamp-2 text-center break-all">
          {att.file_name}
        </span>
      </button>
    );
  };

  const current = visibleList[currentIndex];
  const currentIsImage = current && isImageFile(current.file_type, current.file_name);
  const currentIsPdf = current && (current.file_type?.includes('pdf') || getExt(current.file_name) === 'pdf');
  const currentIsVideo = current && isVideo(current);
  const currentIsAudio = current && isAudio(current);
  const currentIsOffice = current && isOffice(current);

  return (
    <>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <Files className="h-3.5 w-3.5" />
              {t('all') || 'Все'} ({attachments.length})
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              {t('photos') || 'Фото'} ({images.length})
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {t('documents') || 'Документы'} ({files.length})
            </TabsTrigger>
          </TabsList>
          {onUpload && (
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t('addFiles')}
            </Button>
          )}
          {hiddenInput}
        </div>

        <TabsContent value="all" className="mt-0">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {attachments.map(renderItem)}
          </div>
        </TabsContent>
        <TabsContent value="images" className="mt-0">
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('noPhotos') || 'Фото нет'}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {images.map(renderItem)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="files" className="mt-0">
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('noFiles') || 'Файлов нет'}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {files.map(renderItem)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-[95vw] w-[95vw] h-[92vh] p-0 border-none bg-black/95 flex flex-col"
          aria-describedby={undefined}
        >
          {current && (
            <>
              {/* Header */}
              <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
                <div className="text-white text-sm truncate max-w-[60%]">
                  <span className="font-medium">{current.file_name}</span>
                  <span className="text-white/60 ml-2">
                    {currentIndex + 1} / {visibleList.length}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadFile(current)}
                    className="bg-white/10 text-white hover:bg-white/20 border-0"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {t('download') || 'Скачать'}
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setLightboxOpen(false)}
                    className="bg-white/10 text-white hover:bg-white/20 border-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Prev / Next */}
              {visibleList.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={goNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}

              {/* Content */}
              <div className="flex-1 flex items-center justify-center p-4 pt-16 pb-20 overflow-hidden">
                {currentIsImage ? (
                  <img
                    src={current.file_url}
                    alt={current.file_name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : currentIsVideo ? (
                  <video
                    src={current.file_url}
                    controls
                    autoPlay
                    className="max-w-full max-h-full"
                  >
                    {current.file_name}
                  </video>
                ) : currentIsAudio ? (
                  <div className="flex flex-col items-center gap-4 text-white w-full max-w-md">
                    <FileIcon fileName={current.file_name} className="h-24 w-24" />
                    <p className="text-lg text-center break-all">{current.file_name}</p>
                    <audio src={current.file_url} controls autoPlay className="w-full" />
                  </div>
                ) : currentIsPdf ? (
                  <iframe
                    src={current.file_url}
                    title={current.file_name}
                    className="w-full h-full bg-white rounded"
                  />
                ) : currentIsOffice ? (
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(current.file_url)}`}
                    title={current.file_name}
                    className="w-full h-full bg-white rounded"
                  />
                ) : isPreviewable(current) ? (
                  <iframe
                    src={current.file_url}
                    title={current.file_name}
                    className="w-full h-full bg-white rounded"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-white">
                    <FileIcon fileName={current.file_name} className="h-24 w-24" />
                    <p className="text-lg">{current.file_name}</p>
                    <Button onClick={() => downloadFile(current)} variant="secondary">
                      <Download className="h-4 w-4 mr-2" />
                      {t('download') || 'Скачать'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Thumbnails strip */}
              {visibleList.length > 1 && (
                <div className="absolute bottom-0 inset-x-0 z-20 px-4 py-2 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex gap-2 overflow-x-auto justify-center">
                    {visibleList.map((att, i) => {
                      const thumbIsImg = isImageFile(att.file_type, att.file_name);
                      return (
                        <button
                          key={att.id}
                          onClick={() => setCurrentIndex(i)}
                          className={`shrink-0 h-14 w-14 rounded overflow-hidden border-2 transition-all ${
                            i === currentIndex
                              ? 'border-primary scale-110'
                              : 'border-white/20 opacity-60 hover:opacity-100'
                          }`}
                        >
                          {thumbIsImg ? (
                            <img
                              src={att.file_url}
                              alt={att.file_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-muted">
                              <FileIcon fileName={att.file_name} className="h-6 w-6" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
