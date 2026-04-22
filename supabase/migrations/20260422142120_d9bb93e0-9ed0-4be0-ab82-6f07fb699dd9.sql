
-- Create private bucket for AI assistant chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-attachments', 'ai-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
CREATE POLICY "Users upload own ai-attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own files
CREATE POLICY "Users view own ai-attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
CREATE POLICY "Users delete own ai-attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
