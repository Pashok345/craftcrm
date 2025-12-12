import { useMemo } from 'react';
import { Task, STATUS_COLORS, STATUS_LABELS } from '@/types/database';
import { format, differenceInDays, startOfDay, addDays, parseISO, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GanttChartProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export const GanttChart = ({ tasks, onTaskClick }: GanttChartProps) => {
  const { tasksWithDeadlines, dateRange, dayWidth, totalDays } = useMemo(() => {
    const tasksWithDeadlines = tasks.filter((t) => t.deadline);
    
    if (tasksWithDeadlines.length === 0) {
      return { tasksWithDeadlines: [], dateRange: { start: new Date(), end: new Date() }, dayWidth: 40, totalDays: 30 };
    }

    const dates = tasksWithDeadlines.map((t) => parseISO(t.deadline!));
    const createdDates = tasksWithDeadlines.map((t) => parseISO(t.created_at));
    const allDates = [...dates, ...createdDates];
    
    const minDate = startOfDay(new Date(Math.min(...allDates.map((d) => d.getTime()))));
    const maxDate = startOfDay(new Date(Math.max(...dates.map((d) => d.getTime()))));
    
    const start = addDays(minDate, -2);
    const end = addDays(maxDate, 5);
    const totalDays = Math.max(differenceInDays(end, start), 14);
    
    return {
      tasksWithDeadlines,
      dateRange: { start, end },
      dayWidth: 40,
      totalDays,
    };
  }, [tasks]);

  if (tasksWithDeadlines.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Нет задач с установленными сроками
      </div>
    );
  }

  const generateDays = () => {
    const days = [];
    for (let i = 0; i < totalDays; i++) {
      days.push(addDays(dateRange.start, i));
    }
    return days;
  };

  const days = generateDays();

  const getTaskPosition = (task: Task) => {
    const taskStart = startOfDay(parseISO(task.created_at));
    const taskEnd = startOfDay(parseISO(task.deadline!));
    
    const startOffset = Math.max(0, differenceInDays(taskStart, dateRange.start));
    const duration = Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
    
    return {
      left: startOffset * dayWidth,
      width: duration * dayWidth - 4,
    };
  };

  const isToday = (date: Date) => {
    const today = startOfDay(new Date());
    return date.getTime() === today.getTime();
  };

  return (
    <TooltipProvider>
      <ScrollArea className="w-full">
        <div className="min-w-max">
          {/* Header with dates */}
          <div className="flex border-b border-border sticky top-0 bg-background z-10">
            <div className="w-64 shrink-0 p-3 border-r border-border font-medium text-sm">
              Задача
            </div>
            <div className="flex">
              {days.map((day, i) => (
                <div
                  key={i}
                  className={`text-center text-xs p-2 border-r border-border ${
                    isToday(day) ? 'bg-primary/10 text-primary font-medium' : ''
                  }`}
                  style={{ width: dayWidth }}
                >
                  <div>{format(day, 'd', { locale: ru })}</div>
                  <div className="text-muted-foreground">{format(day, 'EEE', { locale: ru })}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Task rows */}
          <div>
            {tasksWithDeadlines.map((task) => {
              const position = getTaskPosition(task);
              
              return (
                <div key={task.id} className="flex border-b border-border hover:bg-muted/50">
                  <div
                    className="w-64 shrink-0 p-3 border-r border-border cursor-pointer"
                    onClick={() => onTaskClick(task)}
                  >
                    <div className="font-medium text-sm truncate">{task.title}</div>
                    <Badge className={`${STATUS_COLORS[task.status]} mt-1 text-xs`}>
                      {STATUS_LABELS[task.status]}
                    </Badge>
                  </div>
                  <div className="relative h-16 flex items-center" style={{ width: totalDays * dayWidth }}>
                    {/* Grid lines */}
                    {days.map((day, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 border-r border-border ${
                          isToday(day) ? 'bg-primary/5' : ''
                        }`}
                        style={{ left: i * dayWidth, width: dayWidth }}
                      />
                    ))}
                    
                    {/* Task bar */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute h-8 rounded-md cursor-pointer transition-all hover:opacity-80"
                          style={{
                            left: position.left + 2,
                            width: position.width,
                            background: task.status === 'done'
                              ? 'hsl(var(--crm-success))'
                              : task.status === 'in_progress'
                              ? 'hsl(var(--crm-warning))'
                              : 'hsl(var(--primary))',
                          }}
                          onClick={() => onTaskClick(task)}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <div className="font-medium">{task.title}</div>
                          <div className="text-muted-foreground">
                            Срок: {format(parseISO(task.deadline!), 'd MMMM yyyy', { locale: ru })}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </TooltipProvider>
  );
};
