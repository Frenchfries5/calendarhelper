import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { TIME_ZONE } from "@/lib/template";
import { computeSchedule } from "@/lib/dates";
import { resolveCalendarId, createEvent, GraphError } from "@/lib/graph";
import { findRole } from "@/lib/roles";
import { getRolesConfig } from "@/lib/store";

const DEDICATED_CALENDAR_NAME = "US Onboarding Schedule";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { startDate, roleId, useDedicatedCalendar, addTeamsLink, attendees, dryRun, excludedIndexes, overrides } =
    await request.json();

  if (!startDate) {
    return NextResponse.json({ error: "A cohort start date is required." }, { status: 400 });
  }

  // Pick the role's session set from the store (falls back to the first role).
  const config = await getRolesConfig();
  const role = findRole(config, typeof roleId === "string" ? roleId : undefined);
  if (!role) {
    return NextResponse.json({ error: "No role template is configured." }, { status: 400 });
  }

  const attendeeList: string[] = Array.isArray(attendees) ? attendees : [];
  const schedule = computeSchedule(role.sessions, startDate);

  // Dry run: return the full computed schedule without touching the calendar.
  // Exclusions are applied client-side for preview; only the create step
  // below needs to actually drop excluded sessions.
  if (dryRun) {
    return NextResponse.json({ dryRun: true, events: schedule });
  }

  // Apply per-event timing overrides (from drag-to-reschedule in the preview)
  // so what gets created matches exactly what the operator arranged. Title,
  // body, and location always come from the template — only timing moves.
  if (Array.isArray(overrides)) {
    for (const o of overrides) {
      const i = o?.index;
      if (typeof i === "number" && schedule[i] && o.startDateTime && o.endDateTime) {
        schedule[i] = {
          ...schedule[i],
          startDateTime: o.startDateTime,
          endDateTime: o.endDateTime,
          startTime: typeof o.startTime === "string" ? o.startTime : schedule[i].startTime,
          dateLabel: typeof o.dateLabel === "string" ? o.dateLabel : schedule[i].dateLabel,
        };
      }
    }
  }

  const excluded = new Set<number>(Array.isArray(excludedIndexes) ? excludedIndexes : []);
  const toCreate = schedule.filter((_, i) => !excluded.has(i));

  try {
    let calendarId: string | null = null;
    if (useDedicatedCalendar) {
      calendarId = await resolveCalendarId(session.accessToken, DEDICATED_CALENDAR_NAME);
    }

    const created: string[] = [];
    for (const ev of toCreate) {
      await createEvent(session.accessToken, calendarId, {
        title: ev.title,
        body: ev.body,
        location: ev.location,
        startDateTime: ev.startDateTime,
        endDateTime: ev.endDateTime,
        timeZone: TIME_ZONE,
        attendees: attendeeList,
        addTeamsLink: Boolean(addTeamsLink),
      });
      created.push(`${ev.title} — ${ev.dateLabel} ${ev.startTime}`);
    }

    return NextResponse.json({ dryRun: false, created });
  } catch (e) {
    if (e instanceof GraphError && e.status === 401) {
      return NextResponse.json(
        { error: "Your Microsoft session expired. Sign in again." },
        { status: 401 },
      );
    }
    const message = e instanceof Error ? e.message : "Unknown error creating events.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
