import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ONBOARDING_TEMPLATE, TIME_ZONE } from "@/lib/template";
import { computeSchedule } from "@/lib/dates";
import { resolveCalendarId, createEvent, GraphError } from "@/lib/graph";

const DEDICATED_CALENDAR_NAME = "US Onboarding Schedule";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { startDate, useDedicatedCalendar, addTeamsLink, attendees, dryRun, excludedIndexes } =
    await request.json();

  if (!startDate) {
    return NextResponse.json({ error: "A cohort start date is required." }, { status: 400 });
  }

  const attendeeList: string[] = Array.isArray(attendees) ? attendees : [];
  const schedule = computeSchedule(ONBOARDING_TEMPLATE, startDate);

  // Dry run: return the full computed schedule without touching the calendar.
  // Exclusions are applied client-side for preview; only the create step
  // below needs to actually drop excluded sessions.
  if (dryRun) {
    return NextResponse.json({ dryRun: true, events: schedule });
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
