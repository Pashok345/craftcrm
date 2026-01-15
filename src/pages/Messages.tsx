import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Plus, 
  Send, 
  Users, 
  MessageSquare, 
  Search,
  MoreVertical,
  Hash,
  User,
  Paperclip,
  Loader2,
  X,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { CreateChatDialog } from '@/components/messages/CreateChatDialog';
import { EmployeesList } from '@/components/messages/EmployeesList';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { POSITION_LABELS, UserPosition } from '@/types/database';
import { Badge } from '@/components/ui/badge';

interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  type: 'group' | 'direct' | 'task';
  task_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message?: Message;
  unread_count?: number;
}

interface Message {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    name: string;
  };
}

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  position: UserPosition | null;
  avatar_url?: string | null;
  avatar_color?: string | null;
}

const Messages = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatGroup[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'employees'>('chats');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    if (user) {
      fetchChats();
      fetchProfiles();
    }
  }, [user]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      markMessagesAsRead(selectedChat.id);

      const channel = supabase
        .channel(`chat-${selectedChat.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `chat_id=eq.${selectedChat.id}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();
            // Mark as read immediately if we're viewing this chat
            markMessagesAsRead(selectedChat.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedChat]);

  const markMessagesAsRead = async (chatId: string) => {
    if (!user) return;
    
    await supabase
      .from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', user.id);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, user_id, name, email, position, avatar_url, avatar_color');
    if (data) {
      const profileMap: Record<string, Profile> = {};
      data.forEach((p) => {
        profileMap[p.user_id] = p as Profile;
      });
      setProfiles(profileMap);
    }
  };

  const startDirectChat = async (profile: Profile) => {
    if (!user) return;

    // Check if direct chat already exists
    const existingChat = chats.find(
      (chat) => chat.type === 'direct' && chat.name.includes(profile.name)
    );

    if (existingChat) {
      setSelectedChat(existingChat);
      setSidebarTab('chats');
      return;
    }

    // Create new direct chat
    try {
      const { data: chatData, error: chatError } = await supabase
        .from('chat_groups')
        .insert({
          name: profile.name,
          type: 'direct',
          created_by: user.id,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add both users as members
      const { error: membersError } = await supabase.from('chat_members').insert([
        { chat_id: chatData.id, user_id: user.id, role: 'admin' },
        { chat_id: chatData.id, user_id: profile.user_id, role: 'member' },
      ]);

      if (membersError) throw membersError;

      const newChat = chatData as ChatGroup;
      setChats((prev) => [newChat, ...prev]);
      setSelectedChat(newChat);
      setSidebarTab('chats');

      toast({
        title: t('chatCreated') || 'Чат создан',
        description: `${t('chatWith') || 'Чат с'} ${profile.name}`,
      });
    } catch (error) {
      console.error('Error creating direct chat:', error);
      toast({
        title: t('error') || 'Ошибка',
        description: t('failedToCreateChat') || 'Не удалось создать чат',
        variant: 'destructive',
      });
    }
  };

  const fetchChats = async () => {
    if (!user) return;
    setLoading(true);

    const { data: memberData } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', user.id);

    if (!memberData || memberData.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    const chatIds = memberData.map((m) => m.chat_id);

    const { data: chatData } = await supabase
      .from('chat_groups')
      .select('*')
      .in('id', chatIds)
      .order('updated_at', { ascending: false });

    if (chatData) {
      setChats(chatData as ChatGroup[]);
    }
    setLoading(false);
  };

  const fetchMessages = async (chatId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) {
      setMessages(data as Message[]);
      scrollToBottom();
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && files.length === 0) || !selectedChat || !user) return;

    setUploadingFiles(true);
    try {
      let messageContent = newMessage.trim();
      
      // Upload files first if any
      const uploadedFiles: { name: string; url: string; type: string }[] = [];
      for (const file of files) {
        const sanitizedName = file.name
          .replace(/[^\w.-]/g, '_')
          .replace(/__+/g, '_');
        const fileName = `${selectedChat.id}/${Date.now()}-${sanitizedName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Use signed URL with 7-day expiry for private bucket access
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days expiry

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error('Signed URL error:', signedUrlError);
          continue;
        }

        uploadedFiles.push({
          name: file.name,
          url: signedUrlData.signedUrl,
          type: file.type,
        });
      }

      // Add file info to message content if files were uploaded
      if (uploadedFiles.length > 0) {
        const filesInfo = uploadedFiles.map(f => `[📎 ${f.name}](${f.url})`).join('\n');
        messageContent = messageContent ? `${messageContent}\n\n${filesInfo}` : filesInfo;
      }

      if (!messageContent) {
        setUploadingFiles(false);
        return;
      }

      const { error } = await supabase.from('messages').insert({
        chat_id: selectedChat.id,
        user_id: user.id,
        content: messageContent,
      });

      if (!error) {
        setNewMessage('');
        setFiles([]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: t('error') || 'Ошибка',
        description: t('failedToSendMessage') || 'Не удалось отправить сообщение',
        variant: 'destructive',
      });
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate a consistent color based on user id or use custom color
  const getUserAccentColor = (userId: string) => {
    const profile = profiles[userId];
    if (profile?.avatar_color) return profile.avatar_color;
    
    const colors = [
      'hsl(210, 80%, 55%)', // Blue
      'hsl(142, 70%, 45%)', // Green
      'hsl(270, 70%, 60%)', // Purple
      'hsl(340, 75%, 55%)', // Pink
      'hsl(25, 90%, 55%)',  // Orange
      'hsl(175, 70%, 40%)', // Teal
      'hsl(45, 90%, 50%)',  // Yellow
      'hsl(0, 70%, 55%)',   // Red
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };
  const getChatAccentColor = (chatId: string) => {
    const colors = [
      'hsl(210, 80%, 55%)', // Blue
      'hsl(142, 70%, 45%)', // Green
      'hsl(270, 70%, 60%)', // Purple
      'hsl(340, 75%, 55%)', // Pink
      'hsl(25, 90%, 55%)',  // Orange
      'hsl(175, 70%, 40%)', // Teal
      'hsl(45, 90%, 50%)',  // Yellow
      'hsl(0, 70%, 55%)',   // Red
    ];
    let hash = 0;
    for (let i = 0; i < chatId.length; i++) {
      hash = chatId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Get chat members for displaying avatars
  const [chatMembers, setChatMembers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (chats.length > 0) {
      fetchChatMembers();
    }
  }, [chats]);

  const fetchChatMembers = async () => {
    const memberMap: Record<string, string[]> = {};
    for (const chat of chats) {
      const { data } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chat.id)
        .limit(3);
      if (data) {
        memberMap[chat.id] = data.map(m => m.user_id);
      }
    }
    setChatMembers(memberMap);
  };

  const renderChatAvatar = (chat: ChatGroup) => {
    const members = chatMembers[chat.id] || [];
    
    if (chat.type === 'direct') {
      // For direct chats, show the other person's avatar
      const otherUserId = members.find(id => id !== user?.id) || members[0];
      const profile = otherUserId ? profiles[otherUserId] : null;
      const color = otherUserId ? getUserAccentColor(otherUserId) : getChatAccentColor(chat.id);
      
      return (
        <Avatar className="h-10 w-10">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback style={{ backgroundColor: color, color: 'white' }}>
            {profile ? getInitials(profile.name) : chat.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      );
    }

    // For group chats, show stacked avatars
    if (members.length >= 2) {
      const visibleMembers = members.slice(0, 2);
      return (
        <div className="relative w-10 h-10">
          {visibleMembers.map((memberId, index) => {
            const profile = profiles[memberId];
            const color = getUserAccentColor(memberId);
            return (
              <Avatar 
                key={memberId} 
                className="absolute h-7 w-7 border-2 border-card"
                style={{ 
                  top: index === 0 ? 0 : 12,
                  left: index === 0 ? 0 : 12,
                  zIndex: 2 - index
                }}
              >
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback style={{ backgroundColor: color, color: 'white', fontSize: '10px' }}>
                  {profile ? getInitials(profile.name) : '?'}
                </AvatarFallback>
              </Avatar>
            );
          })}
        </div>
      );
    }

    // Fallback to single avatar
    return (
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${getChatAccentColor(chat.id)}20` }}
      >
        {getChatIcon(chat.type, chat.id)}
      </div>
    );
  };

  const getChatIcon = (type: string, chatId?: string) => {
    const color = chatId ? getChatAccentColor(chatId) : undefined;
    const style = color ? { color } : {};
    switch (type) {
      case 'group':
        return <Users className="h-4 w-4" style={style} />;
      case 'direct':
        return <User className="h-4 w-4" style={style} />;
      case 'task':
        return <Hash className="h-4 w-4" style={style} />;
      default:
        return <MessageSquare className="h-4 w-4" style={style} />;
    }
  };

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    msgs.forEach((msg) => {
      const msgDate = format(new Date(msg.created_at), 'dd MMMM yyyy', { locale: dateLocale });
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{t('messagesTitle')}</h2>
            <Button size="icon" variant="ghost" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as 'chats' | 'employees')}>
            <TabsList className="w-full">
              <TabsTrigger value="chats" className="flex-1">
                <MessageSquare className="h-4 w-4 mr-2" />
                {t('chats')}
              </TabsTrigger>
              <TabsTrigger value="employees" className="flex-1">
                <Users className="h-4 w-4 mr-2" />
                {t('employees')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {sidebarTab === 'chats' ? (
          <>
            <div className="px-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchChats')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">{t('loading')}</div>
              ) : filteredChats.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t('noChats')}</p>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    {t('createFirstChat')}
                  </Button>
                </div>
              ) : (
                filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      'p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50',
                      selectedChat?.id === chat.id && 'bg-muted'
                    )}
                    onClick={() => setSelectedChat(chat)}
                  >
                    <div className="flex items-center gap-3">
                      {renderChatAvatar(chat)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{chat.name}</p>
                        {chat.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {chat.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </>
        ) : (
          <EmployeesList onStartChat={startDirectChat} />
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-border px-4 flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${getChatAccentColor(selectedChat.id)}20` }}
                >
                  {getChatIcon(selectedChat.type, selectedChat.id)}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedChat.name}</h3>
                  {selectedChat.description && (
                    <p className="text-xs text-muted-foreground">{selectedChat.description}</p>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>{t('participantsMenu')}</DropdownMenuItem>
                  <DropdownMenuItem>{t('settingsMenu')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {groupMessagesByDate(messages).map((group) => (
                <div key={group.date}>
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      {group.date}
                    </span>
                  </div>
                  {group.messages.map((msg) => {
                    const isOwn = msg.user_id === user?.id;
                    const profile = profiles[msg.user_id];

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex gap-2 mb-3',
                          isOwn ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {!isOwn && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {profile ? getInitials(profile.name) : 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            'max-w-[70%] rounded-2xl px-4 py-2 shadow-sm',
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-card border border-border rounded-bl-md'
                          )}
                        >
                          {!isOwn && profile && (
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {profile.name}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p
                            className={cn(
                              'text-[10px] mt-1',
                              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}
                          >
                            {format(new Date(msg.created_at), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card">
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {files.map((file, index) => (
                    <Badge key={index} variant="secondary" className="text-xs flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFiles}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  placeholder={t('typeMessage')}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                  disabled={uploadingFiles}
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={(!newMessage.trim() && files.length === 0) || uploadingFiles}
                >
                  {uploadingFiles ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p>{t('selectChatToStart')}</p>
            </div>
          </div>
        )}
      </div>

      <CreateChatDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onChatCreated={(chat) => {
          setChats((prev) => [chat, ...prev]);
          setSelectedChat(chat);
          setCreateDialogOpen(false);
        }}
      />
    </div>
  );
};

export default Messages;
