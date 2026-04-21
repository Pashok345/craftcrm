import { useEffect } from 'react';

interface ShortcutActions {
  onCreateTask: () => void;
  onSwitchView: (view: string) => void;
  onToggleTemplates: () => void;
  onToggleHelp?: () => void;
}

export const useTaskShortcuts = ({ onCreateTask, onSwitchView, onToggleTemplates, onToggleHelp }: ShortcutActions) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;

      // ? — toggle help panel
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }

      // N — new task
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onCreateTask();
        return;
      }

      // 1/2/3 — switch views
      if (['1', '2', '3'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const views = ['list', 'kanban', 'gantt'];
        onSwitchView(views[parseInt(e.key) - 1]);
        return;
      }

      // T — templates
      if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onToggleTemplates();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCreateTask, onSwitchView, onToggleTemplates, onToggleHelp]);
};
