import { CSSProperties } from 'react';
import { Task } from '@/types/database';

export const getTaskCardStyle = (task: Task, fallbackBorderColor?: string): CSSProperties => {
  const style: CSSProperties = {};
  if (task.gradient) {
    style.backgroundImage = task.gradient;
    style.color = '#fff';
  } else if (task.bg_image_url) {
    // Light overlay so text remains readable but photo is clearly visible
    style.backgroundImage = `linear-gradient(rgba(255,255,255,0.45), rgba(255,255,255,0.55)), url(${task.bg_image_url})`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
    style.backgroundRepeat = 'no-repeat';
  } else if (task.bg_color) {
    style.backgroundColor = task.bg_color;
  }
  const accent = task.accent_color || fallbackBorderColor;
  if (accent) {
    style.borderLeft = `4px solid ${accent}`;
  }
  return style;
};

export const getTaskTitleStyle = (task: Task): CSSProperties =>
  task.title_font ? { fontFamily: task.title_font } : {};
