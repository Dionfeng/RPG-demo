const APP_DAY_START_HOUR = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

export function now() {
  return new Date();
}

function shiftedDate(date = now()) {
  return new Date(date.getTime() - APP_DAY_START_HOUR * 60 * 60 * 1000);
}

export function appDayKey(date = now()) {
  const d = shiftedDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function appYesterdayKey(date = now()) {
  return appDayKey(new Date(date.getTime() - DAY_MS));
}

export function appWeekKey(date = now()) {
  const d = shiftedDate(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function nextAppRefreshTime(date = now()) {
  const refresh = new Date(date);
  refresh.setHours(APP_DAY_START_HOUR, 0, 0, 0);
  if (date >= refresh) refresh.setDate(refresh.getDate() + 1);
  return refresh;
}

export function msUntilNextAppRefresh(date = now()) {
  return nextAppRefreshTime(date).getTime() - date.getTime();
}

export function formatAppClock(date = now()) {
  const remaining = msUntilNextAppRefresh(date);
  const totalMinutes = Math.max(0, Math.ceil(remaining / (60 * 1000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    dayKey: appDayKey(date),
    weekKey: appWeekKey(date),
    refreshAt: nextAppRefreshTime(date),
    remainingLabel: `${hours}小时${String(minutes).padStart(2, "0")}分钟`,
  };
}
