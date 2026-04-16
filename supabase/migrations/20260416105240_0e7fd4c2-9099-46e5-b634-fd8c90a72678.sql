-- 1. Drop old public avatars SELECT policy
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- 2. Fix chat-attachments: restrict SELECT to file owner (files stored as {user_id}/...)
DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;

CREATE POLICY "Chat attachment owners can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3. Fix process-attachments: restrict SELECT to file owner
DROP POLICY IF EXISTS "Authenticated users can view process attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view process attachments" ON storage.objects;

CREATE POLICY "Process attachment owners can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'process-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4. Fix proposal-files: restrict SELECT to file owner
DROP POLICY IF EXISTS "Authenticated users can view proposal files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view proposal files" ON storage.objects;

CREATE POLICY "Proposal file owners can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proposal-files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);