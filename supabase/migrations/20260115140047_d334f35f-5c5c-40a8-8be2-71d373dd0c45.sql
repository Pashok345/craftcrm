-- Make chat-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

-- Drop the overly permissive public access policy
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;

-- Create policy requiring authentication for viewing chat attachments
CREATE POLICY "Authenticated users can view chat attachments" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'chat-attachments' 
  AND auth.role() = 'authenticated'
);

-- Ensure authenticated users can upload to chat-attachments (may already exist)
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'chat-attachments' 
  AND auth.role() = 'authenticated'
);

-- Allow users to delete their own chat attachments
DROP POLICY IF EXISTS "Users can delete their own chat attachments" ON storage.objects;
CREATE POLICY "Users can delete their own chat attachments" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'chat-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);