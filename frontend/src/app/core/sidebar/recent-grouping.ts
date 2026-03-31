import { RecentItem } from './recent.service';

export interface RecentGroups {
  today: RecentItem[];
  lastWeek: RecentItem[];
  lastMonth: RecentItem[];
  older: RecentItem[];
}

export function groupRecentByDate(items: RecentItem[]): RecentGroups {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const lastWeekMs = todayMs - 7 * 24 * 60 * 60 * 1000;
  const lastMonthMs = todayMs - 30 * 24 * 60 * 60 * 1000;

  const groups: RecentGroups = {
    today: [],
    lastWeek: [],
    lastMonth: [],
    older: [],
  };

  for (const item of items) {
    if (item.openedAt >= todayMs) groups.today.push(item);
    else if (item.openedAt >= lastWeekMs) groups.lastWeek.push(item);
    else if (item.openedAt >= lastMonthMs) groups.lastMonth.push(item);
    else groups.older.push(item);
  }

  return groups;
}
