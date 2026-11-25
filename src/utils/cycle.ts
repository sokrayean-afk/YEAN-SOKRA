import type { CycleMode, CycleRange, HouseholdSettings } from '../types/finance';

export const KHMER_MONTHS = [
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
  'សីហា',
  'កញ្ញា',
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
];

export const KHMER_DAYS_SHORT = ['អា', 'ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស'];

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function getTodayIso(): string {
  return toIsoDate(new Date());
}

export function addDaysIso(iso: string, deltaDays: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + deltaDays);
  return toIsoDate(d);
}

export function addMonthsMinusOneDayIso(iso: string, months = 1): string {
  const d = parseIsoDate(iso);
  const next = new Date(d.getFullYear(), d.getMonth() + months, d.getDate() - 1);
  return toIsoDate(next);
}

export function formatKhmerDate(iso: string, includeYear = true): string {
  const d = parseIsoDate(iso);
  const day = d.getDate();
  const month = KHMER_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return includeYear ? `${day} ${month} ${year}` : `${day} ${month}`;
}

export function formatKhmerShortDate(iso: string): string {
  const d = parseIsoDate(iso);
  return `${d.getDate()} ${KHMER_MONTHS[d.getMonth()]}`;
}

function buildCycleRangeFromBounds(
  startIso: string,
  endIso: string,
  mode: CycleMode,
  shortLabelOverride?: string
): CycleRange {
  const safeEnd = endIso >= startIso ? endIso : startIso;
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(safeEnd);

  const dates: string[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 366) {
    dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  const totalDays = Math.max(1, dates.length);
  const todayIso = getTodayIso();
  const isCurrent = todayIso >= startIso && todayIso <= safeEnd;
  const isFuture = todayIso < startIso;

  let daysElapsed = 0;
  let daysRemaining = 0;

  if (isCurrent) {
    const todayIndex = dates.indexOf(todayIso);
    daysElapsed = todayIndex >= 0 ? todayIndex + 1 : 1;
    daysRemaining = Math.max(0, totalDays - daysElapsed);
  } else if (isFuture) {
    daysElapsed = 0;
    daysRemaining = totalDays;
  } else {
    daysElapsed = totalDays;
    daysRemaining = 0;
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const label = sameYear
    ? `${formatKhmerDate(startIso, false)} – ${formatKhmerDate(safeEnd, true)}`
    : `${formatKhmerDate(startIso, true)} – ${formatKhmerDate(safeEnd, true)}`;

  const shortLabel =
    shortLabelOverride ||
    `${start.getDate()} ${KHMER_MONTHS[start.getMonth()]}–${end.getDate()} ${KHMER_MONTHS[end.getMonth()]}`;

  return {
    key: startIso,
    startDate: startIso,
    endDate: safeEnd,
    label,
    shortLabel,
    totalDays,
    daysElapsed,
    daysRemaining,
    isCurrent,
    isFuture,
    dates,
    mode,
  };
}

/**
 * Calculates a recurring monthly cycle range based on cycleStartDay (1..28)
 * and cycleOffset (0 = cycle containing referenceDate, -1 = previous, +1 = next).
 */
export function getCycleRange(
  cycleStartDay: number,
  cycleOffset = 0,
  referenceIso = getTodayIso()
): CycleRange {
  const clampedDay = Math.max(1, Math.min(28, Math.floor(cycleStartDay)));
  const ref = parseIsoDate(referenceIso);
  const refYear = ref.getFullYear();
  const refMonth = ref.getMonth();
  const refDay = ref.getDate();

  let baseStartYear = refYear;
  let baseStartMonth = refMonth;
  if (refDay < clampedDay) {
    baseStartMonth -= 1;
  }

  const start = new Date(baseStartYear, baseStartMonth + cycleOffset, clampedDay);
  const nextCycleStart = new Date(start.getFullYear(), start.getMonth() + 1, clampedDay);
  const end = new Date(
    nextCycleStart.getFullYear(),
    nextCycleStart.getMonth(),
    nextCycleStart.getDate() - 1
  );

  const labelDate = clampedDay === 1 ? start : end;
  const shortLabel = `${KHMER_MONTHS[labelDate.getMonth()]} ${labelDate.getFullYear()}`;

  return buildCycleRangeFromBounds(
    toIsoDate(start),
    toIsoDate(end),
    'monthly_day',
    shortLabel
  );
}

/**
 * Calculates a custom user-defined period (start..end) and allows stepping backward/forward
 * by the exact period length via cycleOffset.
 */
export function getCustomCycleRange(
  customStartIso: string,
  customEndIso: string,
  cycleOffset = 0
): CycleRange {
  const safeEnd = customEndIso >= customStartIso ? customEndIso : customStartIso;
  const spanDays = daysBetweenIso(customStartIso, safeEnd) + 1;
  const shiftedStart = addDaysIso(customStartIso, cycleOffset * spanDays);
  const shiftedEnd = addDaysIso(safeEnd, cycleOffset * spanDays);
  return buildCycleRangeFromBounds(shiftedStart, shiftedEnd, 'custom_range');
}

export function getCycleRangeFromSettings(
  settings: Pick<
    HouseholdSettings,
    'cycleMode' | 'cycleStartDay' | 'customStartDate' | 'customEndDate'
  >,
  cycleOffset = 0
): CycleRange {
  if (settings.cycleMode === 'custom_range' && settings.customStartDate && settings.customEndDate) {
    return getCustomCycleRange(
      settings.customStartDate,
      settings.customEndDate,
      cycleOffset
    );
  }
  return getCycleRange(settings.cycleStartDay, cycleOffset);
}

export function isDateInCycle(dateIso: string, cycle: CycleRange): boolean {
  return dateIso >= cycle.startDate && dateIso <= cycle.endDate;
}

export function getBillDueDateInCycle(dueDay: number, cycle: CycleRange): string {
  const clamped = Math.max(1, Math.min(28, Math.floor(dueDay)));
  const match = cycle.dates.find((iso) => parseIsoDate(iso).getDate() === clamped);
  return match || cycle.endDate;
}

export function daysBetweenIso(fromIso: string, toIso: string): number {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}
