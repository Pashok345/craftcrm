import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X, CalendarDays } from 'lucide-react';
import { Project, Tag } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ru, enUS, uk } from 'date-fns/locale';

export interface TaskFiltersState {
  projectIds: string[];
  tagIds: string[];
  deadlineFrom: Date | undefined;
  deadlineTo: Date | undefined;
  statuses: string[];
}

interface TaskFiltersProps {
  filters: TaskFiltersState;
  onFiltersChange: (filters: TaskFiltersState) => void;
  projects: Record<string, Project>;
  allTags: Tag[];
}

export const emptyFilters: TaskFiltersState = {
  projectIds: [],
  tagIds: [],
  deadlineFrom: undefined,
  deadlineTo: undefined,
  statuses: [],
};

export const hasActiveFilters = (f: TaskFiltersState) =>
  f.projectIds.length > 0 || f.tagIds.length > 0 || f.statuses.length > 0 || !!f.deadlineFrom || !!f.deadlineTo;

export const TaskFilters = ({ filters, onFiltersChange, projects, allTags }: TaskFiltersProps) => {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? enUS : language === 'uk' ? uk : ru;
  const activeCount =
    filters.projectIds.length + filters.tagIds.length + filters.statuses.length + (filters.deadlineFrom ? 1 : 0) + (filters.deadlineTo ? 1 : 0);

  const statusOptions = [
    { value: 'todo', label: t('statusTodo') },
    { value: 'in_progress', label: t('statusInProgress') },
    { value: 'review', label: t('statusReview') },
    { value: 'done', label: t('statusDone') },
  ];

  const projectList = Object.values(projects);

  const toggle = <T extends string>(arr: T[], val: T) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          {t('filters') || 'Фильтры'}
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Status */}
          <div>
            <p className="text-sm font-medium mb-2">{t('status')}</p>
            <div className="space-y-1">
              {statusOptions.map((s) => (
                <label key={s.value} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer">
                  <Checkbox
                    checked={filters.statuses.includes(s.value)}
                    onCheckedChange={() => onFiltersChange({ ...filters, statuses: toggle(filters.statuses, s.value) })}
                  />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Project */}
          {projectList.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{t('project')}</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {projectList.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer">
                    <Checkbox
                      checked={filters.projectIds.includes(p.id)}
                      onCheckedChange={() => onFiltersChange({ ...filters, projectIds: toggle(filters.projectIds, p.id) })}
                    />
                    <span className="text-sm truncate">{p.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {allTags.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{t('tags') || 'Теги'}</p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={filters.tagIds.includes(tag.id) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    style={
                      filters.tagIds.includes(tag.id)
                        ? { backgroundColor: tag.color, color: '#fff', borderColor: tag.color }
                        : { borderColor: tag.color, color: tag.color }
                    }
                    onClick={() => onFiltersChange({ ...filters, tagIds: toggle(filters.tagIds, tag.id) })}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Deadline range */}
          <div>
            <p className="text-sm font-medium mb-2">{t('deadline') || 'Дедлайн'}</p>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {filters.deadlineFrom ? format(filters.deadlineFrom, 'dd.MM.yy', { locale: dateLocale }) : (t('from') || 'От')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.deadlineFrom}
                    onSelect={(d) => onFiltersChange({ ...filters, deadlineFrom: d || undefined })}
                    locale={dateLocale}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {filters.deadlineTo ? format(filters.deadlineTo, 'dd.MM.yy', { locale: dateLocale }) : (t('to') || 'До')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.deadlineTo}
                    onSelect={(d) => onFiltersChange({ ...filters, deadlineTo: d || undefined })}
                    locale={dateLocale}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-3 gap-1" onClick={() => onFiltersChange(emptyFilters)}>
            <X className="h-3 w-3" />
            {t('clearFilter')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};
