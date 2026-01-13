-- Create chat-attachments storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for chat attachments
CREATE POLICY "Authenticated users can upload chat attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view chat attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete their own chat attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);