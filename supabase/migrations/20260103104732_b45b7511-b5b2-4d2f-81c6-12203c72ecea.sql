-- Create chat groups table
CREATE TABLE public.chat_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'group' CHECK (type IN ('group', 'direct', 'task')),
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat members table
CREATE TABLE public.chat_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Chat groups policies
CREATE POLICY "Users can view chats they are members of" 
ON public.chat_groups 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_members.chat_id = chat_groups.id 
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create chats" 
ON public.chat_groups 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Chat admins can update chats" 
ON public.chat_groups 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_members.chat_id = chat_groups.id 
    AND chat_members.user_id = auth.uid()
    AND chat_members.role = 'admin'
  )
);

-- Chat members policies
CREATE POLICY "Users can view members of their chats" 
ON public.chat_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members AS cm 
    WHERE cm.chat_id = chat_members.chat_id 
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Chat admins can add members" 
ON public.chat_members 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_members AS cm 
    WHERE cm.chat_id = chat_members.chat_id 
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.chat_groups 
    WHERE chat_groups.id = chat_members.chat_id 
    AND chat_groups.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update their own membership" 
ON public.chat_members 
FOR UPDATE 
USING (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages in their chats" 
ON public.messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_members.chat_id = messages.chat_id 
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages to their chats" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_members.chat_id = messages.chat_id 
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages" 
ON public.messages 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages" 
ON public.messages 
FOR DELETE 
USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_chat_groups_updated_at
BEFORE UPDATE ON public.chat_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;