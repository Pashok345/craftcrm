import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { PROJECT_STATUS_LABELS, ProjectStatus, Profile } from '@/types/database';
import { Loader2, CalendarIcon, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const CreateProject = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [managerId, setManagerId] = useState<string>('');
  const [reviewerId, setReviewerId] = useState<string>('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [noBudget, setNoBudget] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>();
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');
    
    if (!error && data) {
      setUsers(data as Profile[]);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: t('error'),
        description: t('enterProjectName'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Не авторизован');

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          status,
          manager_id: managerId || null,
          reviewer_id: reviewerId || null,
          budget: noBudget ? null : (budget ? parseFloat(budget) : null),
          currency,
          start_date: startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Add project members (always include creator)
      if (projectData) {
        const allMembers = new Set(selectedMembers);
        allMembers.add(user.id); // Always add creator as participant
        
        const membersToInsert = Array.from(allMembers).map(userId => ({
          project_id: projectData.id,
          user_id: userId,
          role: 'member',
        }));

        await supabase.from('project_members').insert(membersToInsert);
      }

      toast({
        title: t('projectCreated') || 'Проект создан',
        description: t('projectCreatedDescription') || 'Новый проект успешно добавлен',
      });

      navigate('/projects');
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast({
        title: t('error'),
        description: t('errorCreating') || 'Не удалось создать проект',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('newProject')}</h1>
          <p className="text-muted-foreground">{t('fillProjectDetails') || 'Заполните данные проекта'}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">{t('projectName')} *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('enterProjectName')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('projectDescriptionPlaceholder')}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('status')}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('projectManager')}</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectManager')} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('reviewer') || 'Проверяющий'}</Label>
              <Select value={reviewerId} onValueChange={setReviewerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectReviewer') || 'Выберите проверяющего'} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="budget">{t('budget')}</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="noBudget"
                    checked={noBudget}
                    onCheckedChange={(checked) => {
                      setNoBudget(!!checked);
                      if (checked) setBudget('');
                    }}
                  />
                  <label htmlFor="noBudget" className="text-sm cursor-pointer">
                    {t('noBudget')}
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="budget"
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    disabled={noBudget}
                  />
                </div>
                <Select value={currency} onValueChange={setCurrency} disabled={noBudget}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="UAH">UAH</SelectItem>
                    <SelectItem value="RUB">RUB</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="PLN">PLN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('startDate')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !startDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'd MMM yyyy', { locale: dateLocale }) : t('select') || 'Выберите'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      locale={dateLocale}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{t('endDate')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'd MMM yyyy', { locale: dateLocale }) : t('select') || 'Выберите'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      locale={dateLocale}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('participants')}</Label>
              <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto bg-muted/30">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noAvailableUsers')}</p>
                ) : (
                  users.map((user) => (
                    <div key={user.user_id} className="flex items-center gap-2">
                      <Checkbox
                        id={`member-${user.user_id}`}
                        checked={selectedMembers.includes(user.user_id)}
                        onCheckedChange={() => toggleMember(user.user_id)}
                      />
                      <label
                        htmlFor={`member-${user.user_id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {user.name || user.email}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/projects')}
                disabled={loading}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateProject;
