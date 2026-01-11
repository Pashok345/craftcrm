import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { POSITION_LABELS, UserPosition } from '@/types/database';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  position: UserPosition | null;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface EmployeesListProps {
  onStartChat: (profile: Profile) => void;
}

// Default avatar colors based on user id hash
const AVATAR_COLORS = [
  'hsl(210, 70%, 50%)',
  'hsl(150, 60%, 45%)',
  'hsl(280, 65%, 55%)',
  'hsl(340, 70%, 50%)',
  'hsl(25, 80%, 55%)',
  'hsl(180, 60%, 45%)',
  'hsl(60, 70%, 45%)',
  'hsl(0, 70%, 55%)',
];

export const getAvatarColor = (userId: string, customColor?: string | null) => {
  if (customColor) return customColor;
  // Generate consistent color based on user id
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const EmployeesList = ({ onStartChat }: EmployeesListProps) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, [user]);

  const fetchEmployees = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch all profiles except current user (no self-DM)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, name, email, position, avatar_url, avatar_color')
      .neq('user_id', user.id)
      .order('name');

    if (!error && data) {
      setEmployees(data as Profile[]);
    }
    setLoading(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPositionLabel = (position: UserPosition | null) => {
    if (!position) return '';
    return POSITION_LABELS[position] || position;
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        {t('loading')}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{t('noEmployees')}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase px-2 py-2">
          {t('employees')}
        </h3>
        {employees.map((employee) => (
          <div
            key={employee.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={employee.avatar_url || undefined} />
              <AvatarFallback 
                className="text-white font-medium"
                style={{ backgroundColor: getAvatarColor(employee.user_id, employee.avatar_color) }}
              >
                {getInitials(employee.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{employee.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {getPositionLabel(employee.position)}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onStartChat(employee)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
