-- Complete Fix 3: The task-attachments policy already exists, just need avatars and chat-attachments

-- Fix storage policies - require authentication for avatars (drop and recreate)
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Fix storage policies - require authentication for chat-attachments (drop and recreate)
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can view chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');