// Helpers to expand recurring meetings into virtual instances within a date range.
// recurrence_rule shape: { freq: 'daily'|'weekly'|'monthly', interval: number, until: 'YYYY-MM-DD'|null }

export interface RecurrenceRule {
  freq: 'daily' | 'weekly' | 'monthly';
  interval: number;
  until?: string | null;
}

const parseDate = (s: string): Date => {
  // s = 'YYYY-MM-DD'
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const fmt = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addByFreq = (d: Date, rule: RecurrenceRule): Date => {
  const next = new Date(d);
  const step = Math.max(1, rule.interval || 1);
  if (rule.freq === 'daily') next.setDate(next.getDate() + step);
  else if (rule.freq === 'weekly') next.setDate(next.getDate() + 7 * step);
  else if (rule.freq === 'monthly') next.setMonth(next.getMonth() + step);
  return next;
};

/**
 * Given an array of meeting rows (some may have recurrence_rule set), returns
 * the same rows expanded with virtual occurrences whose meeting_date lies within [rangeStart, rangeEnd].
 * Virtual occurrences keep all fields but override `meeting_date` and prepend `is_recurring_instance` flag,
 * and id is suffixed with the date so React keys stay unique.
 */
export function expandRecurringMeetings<T extends { id: string; meeting_date: string; recurrence_rule?: any; exception_dates?: string[] | null }>(
  meetings: T[],
  rangeStart: Date,
  rangeEnd: Date
): (T & { is_recurring_instance?: boolean; original_id?: string })[] {
  const out: (T & { is_recurring_instance?: boolean; original_id?: string })[] = [];
  const HARD_LIMIT_DAYS = 365 * 2;

  for (const m of meetings) {
    // Always include the original row if it falls in range
    const baseDate = parseDate(m.meeting_date);
    if (baseDate >= rangeStart && baseDate <= rangeEnd) {
      out.push(m);
    }

    const rule = m.recurrence_rule as RecurrenceRule | null | undefined;
    if (!rule || !rule.freq) continue;

    const until = rule.until ? parseDate(rule.until) : null;
    const exceptions = new Set((m.exception_dates || []).map((s) => s));

    let cursor = addByFreq(baseDate, rule);
    let safety = 0;
    while (safety < HARD_LIMIT_DAYS) {
      safety++;
      if (cursor > rangeEnd) break;
      if (until && cursor > until) break;
      const cursorStr = fmt(cursor);
      if (cursor >= rangeStart && !exceptions.has(cursorStr)) {
        out.push({
          ...m,
          meeting_date: cursorStr,
          id: `${m.id}__${cursorStr}`,
          original_id: m.id,
          is_recurring_instance: true,
        });
      }
      cursor = addByFreq(cursor, rule);
    }
  }

  return out;
}

/** Filter expanded set to a specific day */
export function expandRecurringForDay<T extends { id: string; meeting_date: string; recurrence_rule?: any; exception_dates?: string[] | null }>(
  meetings: T[],
  day: Date
): (T & { is_recurring_instance?: boolean; original_id?: string })[] {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return expandRecurringMeetings(meetings, start, end);
}
