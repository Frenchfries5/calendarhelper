"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TemplateEditor, { RoleTemplate } from "./TemplateEditor";

interface ComputedEvent {
  title: string;
  location: string;
  body: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  startDateTime: string; // "YYYY-MM-DDTHH:mm:ss" — Eastern wall-clock
  endDateTime: string;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Re-label a date (from a "YYYY-MM-DD" string) the same way the server does.
function labelForDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// All template times are Eastern wall-clock (see lib/template.ts). Display
// them as 12-hour AM/PM.
function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh} ${period}` : `${hh}:${String(m).padStart(2, "0")} ${period}`;
}

// Vertical scale for the calendar grid — pixels per minute. Higher = roomier.
const CAL_PX_PER_MIN = 1.5;

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
  const [attendeesRaw, setAttendeesRaw] = useState("");
  const [preview, setPreview] = useState<ComputedEvent[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [created, setCreated] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Role templates (loaded from the store) + which one is selected.
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [roleId, setRoleId] = useState<string>("");
  const [storeMode, setStoreMode] = useState<string>("");
  const [managing, setManaging] = useState(false);

  async function loadRoles() {
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) return;
      const data = await res.json();
      const loaded: RoleTemplate[] = data.roles ?? [];
      setRoles(loaded);
      setStoreMode(data.storeMode ?? "");
      setRoleId((cur) => (cur && loaded.some((r) => r.id === cur) ? cur : loaded[0]?.id ?? ""));
    } catch {
      // Non-fatal — scheduling still works off the server's default role.
    }
  }
  useEffect(() => {
    loadRoles();
  }, []);

  const selectedRole = roles.find((r) => r.id === roleId);
  const roleSessionCount = selectedRole ? selectedRole.sessions.length : sessionCount;

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

  // --- Calendar drag-to-reschedule -----------------------------------------
  // Pointer-based: a small move is treated as a click (toggle exclude); a
  // larger move drags the event to a new time (snapped to 15 min) and/or day
  // column. Nothing is written until "Create" — this only edits the preview.
  const dragRef = useRef<{ index: number; startX: number; startY: number; moved: boolean } | null>(
    null,
  );
  const [dragVisual, setDragVisual] = useState<{ index: number; dx: number; dy: number } | null>(
    null,
  );
  const dayBodyRefs = useRef<(HTMLDivElement | null)[]>([]);

  function commitDrag(index: number, clientX: number, dy: number) {
    setPreview((prev) => {
      if (!prev) return prev;
      const ev = prev[index];
      const duration = toMinutes(ev.endTime) - toMinutes(ev.startTime);
      const deltaMin = Math.round(dy / CAL_PX_PER_MIN / 15) * 15;
      let startMin = toMinutes(ev.startTime) + deltaMin;
      startMin = Math.round(startMin / 15) * 15;
      startMin = Math.max(dayColumns.dayStart, Math.min(startMin, dayColumns.dayEnd - duration));

      // Which day column is the pointer over? Clamp to the nearest.
      let date = ev.startDateTime.slice(0, 10);
      const rects = dayBodyRefs.current
        .map((el, ci) => (el ? { ci, rect: el.getBoundingClientRect() } : null))
        .filter((r): r is { ci: number; rect: DOMRect } => r !== null);
      if (rects.length) {
        let chosen = rects[0];
        for (const r of rects) {
          if (clientX >= r.rect.left && clientX <= r.rect.right) {
            chosen = r;
            break;
          }
          if (clientX > r.rect.right) chosen = r;
        }
        date = dayColumns.columns[chosen.ci]?.date ?? date;
      }

      const startT = minutesToTime(startMin);
      const endT = minutesToTime(startMin + duration);
      const next = [...prev];
      next[index] = {
        ...ev,
        startTime: startT,
        endTime: endT,
        dateLabel: labelForDate(date),
        startDateTime: `${date}T${startT}:00`,
        endDateTime: `${date}T${endT}:00`,
      };
      return next;
    });
  }

  function onEventPointerDown(e: React.PointerEvent, index: number) {
    if (e.button !== 0) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture can throw for an inactive pointer id; drag still works.
    }
    dragRef.current = { index, startX: e.clientX, startY: e.clientY, moved: false };
  }
  function onEventPointerMove(e: React.PointerEvent, index: number) {
    const d = dragRef.current;
    if (!d || d.index !== index) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true;
    if (d.moved) setDragVisual({ index, dx, dy });
  }
  function onEventPointerUp(e: React.PointerEvent, index: number) {
    const d = dragRef.current;
    dragRef.current = null;
    setDragVisual(null);
    if (!d || d.index !== index) return;
    if (!d.moved) {
      toggleExcluded(index);
      return;
    }
    commitDrag(index, e.clientX, e.clientY - d.startY);
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
          roleId,
          useDedicatedCalendar,
          attendees,
          dryRun,
          excludedIndexes: dryRun ? undefined : Array.from(excluded),
          // Send the current (possibly drag-adjusted) timing so what gets
          // created matches exactly what's shown in the preview.
          overrides:
            dryRun || !preview
              ? undefined
              : preview.map((ev, index) => ({
                  index,
                  startDateTime: ev.startDateTime,
                  endDateTime: ev.endDateTime,
                  startTime: ev.startTime,
                  dateLabel: ev.dateLabel,
                })),
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
      return { columns: [], dayStart: 0, dayEnd: 60, span: 60, hours: [] as number[] };
    }
    // Group by calendar date (YYYY-MM-DD from startDateTime) so a dragged
    // event lands in the right day column and we can recover the date.
    const byDate = new Map<string, { ev: ComputedEvent; index: number }[]>();
    preview.forEach((ev, index) => {
      const date = ev.startDateTime.slice(0, 10);
      const list = byDate.get(date) ?? [];
      list.push({ ev, index });
      byDate.set(date, list);
    });

    const allMinutes = preview.flatMap((ev) => [toMinutes(ev.startTime), toMinutes(ev.endTime)]);
    const dayStart = Math.floor(Math.min(...allMinutes) / 60) * 60;
    const dayEnd = Math.ceil(Math.max(...allMinutes) / 60) * 60;
    const span = Math.max(60, dayEnd - dayStart);
    const hours: number[] = [];
    for (let h = dayStart; h <= dayEnd; h += 60) hours.push(h);

    const columns = Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, items]) => {
        const lanes = assignLanes(items.map((it) => it.ev));
        return {
          date,
          day: labelForDate(date),
          items: items.map((it, i) => ({
            ...it,
            lane: lanes[i].lane,
            laneCount: lanes[i].laneCount,
          })),
        };
      });

    return { columns, dayStart, dayEnd, span, hours };
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

  if (managing) {
    return (
      <div className="layout">
        <header className="topbar">
          <div>
            <p className="eyebrow">People Ops</p>
            <h1>Role templates</h1>
          </div>
          <div className="account">
            <span>{account}</span>
            <button className="btn ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <TemplateEditor
          initialRoles={roles}
          storeMode={storeMode}
          onClose={() => setManaging(false)}
          onSaved={loadRoles}
        />
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

      <div className={`grid ${preview && viewMode === "calendar" ? "grid--wide" : ""}`}>
        <section className="card controls">
          <label className="field">
            <span>Role</span>
            <select
              value={roleId}
              onChange={(e) => {
                setRoleId(e.target.value);
                setPreview(null);
                setCreated(null);
                setExcluded(new Set());
              }}
            >
              {roles.length === 0 && <option value="">(loading…)</option>}
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.sessions.length})
                </option>
              ))}
            </select>
            <small>
              Each role has its own session set.{" "}
              <button type="button" className="linkbtn" onClick={() => setManaging(true)}>
                Manage templates
              </button>
            </small>
          </label>

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
              Create {preview ? preview.length - excluded.size : roleSessionCount} events
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
              <p className="muted hint">
                {viewMode === "calendar"
                  ? "Click a session to exclude it, or drag it to a new time or day. Nothing is saved until you create."
                  : "Click a session to leave it off the calendar."}
              </p>

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
                          {formatClock(ev.startTime)}–{formatClock(ev.endTime)}
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
                  <div className="cal-gutter">
                    <div className="cal-day-header" />
                    <div
                      className="cal-gutter-body"
                      style={{ height: `${dayColumns.span * CAL_PX_PER_MIN}px` }}
                    >
                      {dayColumns.hours.map((h) => (
                        <span
                          key={h}
                          className="cal-gutter-label"
                          style={{ top: `${(h - dayColumns.dayStart) * CAL_PX_PER_MIN}px` }}
                        >
                          {formatClock(`${String(Math.floor(h / 60)).padStart(2, "0")}:00`)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="cal-days">
                    {dayColumns.columns.map((col, ci) => (
                      <div className="cal-day" key={col.date}>
                        <div className="cal-day-header">{col.day}</div>
                        <div
                          className="cal-day-body"
                          ref={(el) => {
                            dayBodyRefs.current[ci] = el;
                          }}
                          style={{ height: `${dayColumns.span * CAL_PX_PER_MIN}px` }}
                        >
                          {dayColumns.hours.map((h) => (
                            <div
                              key={h}
                              className="cal-hour-line"
                              style={{ top: `${(h - dayColumns.dayStart) * CAL_PX_PER_MIN}px` }}
                            />
                          ))}
                          {col.items.map(({ ev, index, lane, laneCount }) => {
                            const top = (toMinutes(ev.startTime) - dayColumns.dayStart) * CAL_PX_PER_MIN;
                            const height = Math.max(
                              28,
                              (toMinutes(ev.endTime) - toMinutes(ev.startTime)) * CAL_PX_PER_MIN - 2,
                            );
                            const width = 100 / laneCount;
                            const dragging = dragVisual?.index === index;
                            return (
                              <button
                                key={index}
                                className={`cal-event ${excluded.has(index) ? "excluded" : ""} ${dragging ? "dragging" : ""}`}
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  left: `${lane * width}%`,
                                  width: `calc(${width}% - 4px)`,
                                  transform: dragging
                                    ? `translate(${dragVisual!.dx}px, ${dragVisual!.dy}px)`
                                    : undefined,
                                }}
                                onPointerDown={(e) => onEventPointerDown(e, index)}
                                onPointerMove={(e) => onEventPointerMove(e, index)}
                                onPointerUp={(e) => onEventPointerUp(e, index)}
                                title={`${ev.title} — ${formatClock(ev.startTime)}–${formatClock(ev.endTime)} · drag to move, click to exclude`}
                              >
                                <span className="cal-event-title">{ev.title}</span>
                                <span className="cal-event-time">
                                  {formatClock(ev.startTime)}–{formatClock(ev.endTime)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
