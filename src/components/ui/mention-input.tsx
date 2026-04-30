import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface MentionUser {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  avatar_color?: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Returns list of mentioned user_ids from the current value */
  onMentionsChange?: (mentionedUserIds: string[]) => void;
  variant?: 'input' | 'textarea';
  /** Called when user pastes an image from clipboard */
  onPasteImage?: (file: File) => void;
}

export const MentionInput = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  className,
  disabled,
  onMentionsChange,
  variant = 'input',
  onPasteImage,
}: MentionInputProps) => {
  const { user } = useAuth();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [allUsers, setAllUsers] = useState<MentionUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch all users once + add virtual AI assistant
  useEffect(() => {
    const fetchUsers = async () => {
      const aiUser: MentionUser = {
        user_id: 'AI',
        name: 'AI',
        avatar_color: '#8B5CF6',
        avatar_url: null,
      };
      const { data } = await supabase
        .from('public_profiles')
        .select('user_id, name, avatar_url, avatar_color');
      const real = data ? (data.filter(u => u.user_id !== user?.id) as MentionUser[]) : [];
      setAllUsers([aiUser, ...real]);
    };
    fetchUsers();
  }, [user?.id]);

  // Filter suggestions based on search query
  useEffect(() => {
    if (!searchQuery && showSuggestions) {
      setSuggestions(allUsers.slice(0, 8));
    } else if (searchQuery) {
      const q = searchQuery.toLowerCase();
      setSuggestions(allUsers.filter(u => u.name?.toLowerCase().includes(q)).slice(0, 8));
    }
    setSelectedIndex(0);
  }, [searchQuery, allUsers, showSuggestions]);

  // Extract mentioned user IDs
  useEffect(() => {
    if (!onMentionsChange) return;
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const ids: string[] = [];
    let match;
    while ((match = mentionRegex.exec(value)) !== null) {
      ids.push(match[2]);
    }
    onMentionsChange(ids);
  }, [value, onMentionsChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(newValue);

    // Check if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show if @ is at start or preceded by whitespace, and no space-break in query
      const charBeforeAt = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : ' ';
      if (/\s/.test(charBeforeAt) || lastAtIndex === 0) {
        // Allow spaces in search but stop at double space or newline
        if (!/\n/.test(textAfterAt) && textAfterAt.length <= 30) {
          setMentionStart(lastAtIndex);
          setSearchQuery(textAfterAt);
          setShowSuggestions(true);
          return;
        }
      }
    }

    setShowSuggestions(false);
    setMentionStart(null);
  }, [onChange]);

  const insertMention = useCallback((selectedUser: MentionUser) => {
    if (mentionStart === null) return;
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursorPos);
    const mentionText = `@${selectedUser.name} `;
    const newValue = before + mentionText + after;
    
    onChange(newValue);
    setShowSuggestions(false);
    setMentionStart(null);
    setSearchQuery('');

    // Focus back and set cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = before.length + mentionText.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [mentionStart, value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !showSuggestions && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }, [showSuggestions, suggestions, selectedIndex, insertMention, onSubmit]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!onPasteImage) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          onPasteImage(file);
        }
        return;
      }
    }
  }, [onPasteImage]);

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // Display value: replace @[Name](id) format with @Name for display
  const displayValue = value.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');

  const inputClassName = cn(
    "flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
    variant === 'input' ? 'h-10' : 'min-h-[60px] resize-none',
    className,
  );

  const commonProps = {
    ref: inputRef as any,
    value: displayValue,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    placeholder,
    disabled,
    className: inputClassName,
  };

  return (
    <div className="relative flex-1">
      {variant === 'textarea' ? (
        <textarea {...commonProps} ref={inputRef as React.RefObject<HTMLTextAreaElement>} />
      ) : (
        <input type="text" {...commonProps} ref={inputRef as React.RefObject<HTMLInputElement>} />
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full mb-1 left-0 w-64 max-h-52 overflow-y-auto rounded-md border bg-popover p-1 shadow-md z-50"
        >
          {suggestions.map((u, idx) => (
            <button
              key={u.user_id}
              type="button"
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm text-left transition-colors",
                idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={u.avatar_url || undefined} />
                <AvatarFallback
                  style={{ backgroundColor: u.avatar_color || '#6366f1' }}
                  className="text-[10px] text-white"
                >
                  {getInitials(u.name || '?')}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{u.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Parse @Name mentions from text and return matched user_ids from profiles list */
export const parseMentionedUserIds = (
  text: string,
  profiles: { user_id: string; name: string }[],
  excludeUserId?: string
): string[] => {
  const mentionRegex = /@(\S+(?:\s+\S+)?)/g;
  const mentionedIds = new Set<string>();
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionName = match[1].toLowerCase();
    profiles.forEach(p => {
      if (p.name?.toLowerCase().includes(mentionName) && p.user_id !== excludeUserId) {
        mentionedIds.add(p.user_id);
      }
    });
  }
  return Array.from(mentionedIds);
};
