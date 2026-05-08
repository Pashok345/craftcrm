import { CSSProperties } from 'react';
import { Task } from '@/types/database';

/**
 * Style for task mini-card in lists/Kanban.
 * Per design: gradient is used for thumbnails. bg_image_url is reserved for the
 * task page header and is NOT applied here. bg_color is reserved for the task
 * page background and is also NOT applied to the card thumbnail.
 */
export const getTaskCardStyle = (task: Task, fallbackBorderColor?: string): CSSProperties => {
  const style: CSSProperties = {};
  if (task.gradient) {
    style.backgroundImage = task.gradient;
    style.color = '#fff';
  }
  const accent = task.accent_color || fallbackBorderColor;
  if (accent) {
    style.borderLeft = `4px solid ${accent}`;
  }
  return style;
};

export const getTaskTitleStyle = (task: Task): CSSProperties =>
  task.title_font ? { fontFamily: task.title_font } : {};
