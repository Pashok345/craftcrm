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

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // ? — toggle help panel (Shift+/ on most layouts)
      if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }

      if (e.shiftKey) return;

      // N — new task (use e.code so it works on any keyboard layout)
      if (e.code === 'KeyN') {
        e.preventDefault();
        onCreateTask();
        return;
      }

      // 1/2/3 — switch views
      if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        e.preventDefault();
        const views = ['list', 'kanban', 'gantt'];
        const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
        onSwitchView(views[idx]);
        return;
      }

      // T — templates
      if (e.code === 'KeyT') {
        e.preventDefault();
        onToggleTemplates();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCreateTask, onSwitchView, onToggleTemplates, onToggleHelp]);
};
