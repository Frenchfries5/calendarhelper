"use client";

import { useMemo, useState } from "react";

interface ComputedEvent {
  title: string;
  location: string;
  body: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Greedy interval partitioning: reuse a lane as soon as it frees up, so
// side-by-side width only narrows for events that actually overlap in time.
function assignLanes(events: { startTime: string; endTime: string }[]): {
  lane: number;
  laneCount: number;
}[] {
  const order = events
    .map((e, i) => ({ i, start: toMinutes(e.startTime), end: toMinutes(e.endTime) }))
    .sort((a, b) => a.start - b.start);

  const laneEnds: number[] = [];
  const laneOf = new Array(events.length).fill(0);
  for (const e of order) {
    let lane = laneEnds.findIndex((end) => end <= e.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e.end);
    } else {
      laneEnds[lane] = e.end;
    }
    laneOf[e.i] = lane;
  }
  const laneCount = Math.max(1, laneEnds.length);
  return events.map((_, i) => ({ lane: laneOf[i], laneCount }));
}

export default function OnboardingForm({
  signedIn,
  account,
  sessionCount,
}: {
  signedIn: boolean;
  account: string | null;
  sessionCount: number;
}) {
  const [startDate, setStartDate] = useState("");
  const [useDedicatedCalendar, setDedicated] = useState(true);
  const [addTeamsLink, setTeams] = useState(true);
  const [attendeesRaw, setAttendeesRaw] = useState("");
  const [preview, setPreview] = useState<ComputedEvent[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [created, setCreated] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attendees = attendeesRaw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  function toggleExcluded(index: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function run(dryRun: boolean) {
    setError(null);
    if (!startDate) {
      setError("Pick a cohort start date first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          useDedicatedCalendar,
          addTeamsLink,
          attendees,
          dryRun,
          excludedIndexes: dryRun ? undefined : Array.from(excluded),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (dryRun) {
        setPreview(data.events);
        setExcluded(new Set());
        setCreated(null);
      } else {
        setCreated(data.created);
        setPreview(null);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const dayColumns = useMemo(() => {
    if (!preview || preview.length === 0) {
      return { columns: [], dayStart: 0, span: 60, hours: [] as number[] };
    }
    const byDay = new Map<string, { ev: ComputedEvent; index: number }[]>();
    preview.forEach((ev, index) => {
      const list = byDay.get(ev.dateLabel) ?? [];
      list.push({ ev, index });
      byDay.set(ev.dateLabel, list);
    });

    const allMinutes = preview.flatMap((ev) => [toMinutes(ev.startTime), toMinutes(ev.endTime)]);
    const dayStart = Math.floor(Math.min(...allMinutes) / 60) * 60;
    const dayEnd = Math.ceil(Math.max(...allMinutes) / 60) * 60;
    const span = Math.max(60, dayEnd - dayStart);
    const hours: number[] = [];
    for (let h = dayStart; h <= dayEnd; h += 60) hours.push(h);

    const columns = Array.from(byDay.entries()).map(([day, items]) => {
      const lanes = assignLanes(items.map((it) => it.ev));
      return {
        day,
        items: items.map((it, i) => ({
          ...it,
          lane: lanes[i].lane,
          laneCount: lanes[i].laneCount,
        })),
      };
    });

    return { columns, dayStart, span, hours };
  }, [preview]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  if (!signedIn) {
    return (
      <div className="card signin">
        <p className="eyebrow">People Ops</p>
        <h1>Onboarding Scheduler</h1>
        <p className="lede">
          Build a full new-hire onboarding week in your Outlook calendar from a set
          template. Sign in with your Microsoft work account to begin.
        </p>
        <a className="btn primary" href="/api/auth/login">
          Sign in with Microsoft
        </a>
      </div>
    );
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <p className="eyebrow">People Ops</p>
          <h1>Onboarding Scheduler</h1>
        </div>
        <div className="account">
          <span>{account}</span>
          <button className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="grid">
        <section className="card controls">
          <label className="field">
            <span>Cohort start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <small>Day 0. A weekend start rolls forward to Monday.</small>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={useDedicatedCalendar}
              onChange={(e) => setDedicated(e.target.checked)}
            />
            <span>Use a dedicated "US Onboarding Schedule" calendar</span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={addTeamsLink}
              onChange={(e) => setTeams(e.target.checked)}
            />
            <span>Add a Teams link to each session</span>
          </label>

          <label className="field">
            <span>Invite attendees (optional)</span>
            <textarea
              rows={3}
              placeholder="jdoe@coverdash.com, asmith@coverdash.com"
              value={attendeesRaw}
              onChange={(e) => setAttendeesRaw(e.target.value)}
            />
            <small>Comma, space, or newline separated. Added to every session.</small>
          </label>

          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => run(true)}>
              {busy ? "Working…" : "Preview schedule"}
            </button>
            <button
              className="btn primary"
              disabled={busy || !preview}
              onClick={() => run(false)}
              title={!preview ? "Preview first" : undefined}
            >
              Create {preview ? preview.length - excluded.size : sessionCount} events
            </button>
          </div>

          {error && <p className="error">{error}</p>}
        </section>

        <section className="card output">
          {!preview && !created && (
            <div className="empty">
              <p>Pick a start date and preview the week.</p>
              <p className="muted">
                Nothing is written to your calendar until you press create.
              </p>
            </div>
          )}

          {created && (
            <div className="result">
              <h2>Created {created.length} events</h2>
              <ul className="done">
                {created.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {preview && (
            <div className="agenda">
              <div className="agenda-header">
                <h2>
                  Preview — {preview.length} sessions
                  {excluded.size > 0 && (
                    <span className="muted"> ({excluded.size} excluded)</span>
                  )}
                </h2>
                <div className="view-toggle">
                  <button
                    className={`btn ghost small ${viewMode === "list" ? "active" : ""}`}
                    onClick={() => setViewMode("list")}
                  >
                    List
                  </button>
                  <button
                    className={`btn ghost small ${viewMode === "calendar" ? "active" : ""}`}
                    onClick={() => setViewMode("calendar")}
                  >
                    Calendar
                  </button>
                </div>
              </div>
              <p className="muted hint">Click a session to leave it off the calendar.</p>

              {viewMode === "list" && (
                <ol className="timeline">
                  {preview.map((ev, i) => (
                    <li
                      key={i}
                      className={excluded.has(i) ? "excluded" : ""}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExcluded(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExcluded(i);
                        }
                      }}
                    >
                      <div className="when">
                        <span className="day">{ev.dateLabel}</span>
                        <span className="time">
                          {ev.startTime}–{ev.endTime}
                        </span>
                      </div>
                      <div className="what">
                        <span className="title">{ev.title}</span>
                        <span className="loc">{ev.location}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {viewMode === "calendar" && (
                <div className="calendar">
                  {dayColumns.columns.map((col) => (
                    <div className="cal-day" key={col.day}>
                      <div className="cal-day-header">{col.day}</div>
                      <div
                        className="cal-day-body"
                        style={{ height: `${dayColumns.span}px` }}
                      >
                        {dayColumns.hours.map((h) => (
                          <div
                            key={h}
                            className="cal-hour-line"
                            style={{ top: `${h - dayColumns.dayStart}px` }}
                          >
                            <span>
                              {String(Math.floor(h / 60) % 24).padStart(2, "0")}:
                              {String(h % 60).padStart(2, "0")}
                            </span>
                          </div>
                        ))}
                        {col.items.map(({ ev, index, lane, laneCount }) => {
                          const top = toMinutes(ev.startTime) - dayColumns.dayStart;
                          const height = Math.max(
                            18,
                            toMinutes(ev.endTime) - toMinutes(ev.startTime),
                          );
                          const width = 100 / laneCount;
                          return (
                            <button
                              key={index}
                              className={`cal-event ${excluded.has(index) ? "excluded" : ""}`}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                left: `${lane * width}%`,
                                width: `calc(${width}% - 4px)`,
                              }}
                              onClick={() => toggleExcluded(index)}
                              title={`${ev.title} — ${ev.startTime}–${ev.endTime}`}
                            >
                              <span className="cal-event-title">{ev.title}</span>
                              <span className="cal-event-time">
                                {ev.startTime}–{ev.endTime}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
