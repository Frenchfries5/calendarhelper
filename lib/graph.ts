const GRAPH = "https://graph.microsoft.com/v1.0";

export class GraphError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GraphError";
  }
}

async function graph(
  token: string,
  path: string,
  method = "GET",
  body?: unknown,
) {
  const res = await fetch(`${GRAPH}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GraphError(res.status, `Graph ${method} ${path} -> ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

/** Find a calendar by name, creating it if it doesn't exist. */
export async function resolveCalendarId(token: string, name: string): Promise<string> {
  const data = await graph(token, "/me/calendars?$select=id,name");
  const found = (data.value as Array<{ id: string; name: string }>).find(
    (c) => c.name === name,
  );
  if (found) return found.id;
  const created = await graph(token, "/me/calendars", "POST", { name });
  return created.id;
}

export interface CreateEventInput {
  title: string;
  body: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  attendees?: string[];
  addTeamsLink?: boolean;
}

export async function createEvent(
  token: string,
  calendarId: string | null,
  e: CreateEventInput,
) {
  const event: Record<string, unknown> = {
    subject: e.title,
    body: { contentType: "HTML", content: e.body },
    start: { dateTime: e.startDateTime, timeZone: e.timeZone },
    end: { dateTime: e.endDateTime, timeZone: e.timeZone },
    location: { displayName: e.location },
  };
  if (e.attendees?.length) {
    event.attendees = e.attendees.map((a) => ({
      emailAddress: { address: a },
      type: "required",
    }));
  }
  if (e.addTeamsLink) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = "teamsForBusiness";
  }
  const path = calendarId ? `/me/calendars/${calendarId}/events` : "/me/events";
  return graph(token, path, "POST", event);
}
