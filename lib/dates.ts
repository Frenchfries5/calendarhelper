import { OnboardingSession } from "./template";

const pad = (n: number) => String(n).padStart(2, "0");
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Parse "YYYY-MM-DD" as a LOCAL date (avoids the UTC-midnight off-by-one). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Cohort start normalized to a weekday, then advanced N business days. */
export function getSessionDate(cohortStart: Date, businessDayOffset: number): Date {
  const d = new Date(cohortStart);
  d.setHours(0, 0, 0, 0);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  for (let i = 0; i < businessDayOffset; i++) {
    do {
      d.setDate(d.getDate() + 1);
    } while (isWeekend(d));
  }
  return d;
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export interface ComputedEvent {
  title: string;
  location: string;
  body: string;
  dateLabel: string; // e.g. "Mon, Aug 4"
  startTime: string;
  endTime: string;
  startDateTime: string; // "YYYY-MM-DDTHH:mm:ss" — wall-clock for Graph
  endDateTime: string;
}

/** Turn the template + a cohort start date into concrete, dated events. */
export function computeSchedule(
  sessions: OnboardingSession[],
  cohortStartIso: string,
): ComputedEvent[] {
  const start = parseLocalDate(cohortStartIso);
  return sessions.map((s) => {
    const date = getSessionDate(start, s.dayOffset);
    const endTime = addMinutes(s.startTime, s.duration);
    return {
      title: s.title,
      location: s.location,
      body: s.body,
      dateLabel: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      startTime: s.startTime,
      endTime,
      startDateTime: `${fmtDate(date)}T${s.startTime}:00`,
      endDateTime: `${fmtDate(date)}T${endTime}:00`,
    };
  });
}
