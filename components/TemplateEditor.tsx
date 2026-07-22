"use client";

import { useRef, useState } from "react";

const CSV_HEADERS = ["title", "dayOffset", "startTime", "duration", "location", "body"] as const;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsv(sessions: Session[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const s of sessions) {
    lines.push(
      [
        csvEscape(s.title),
        String(s.dayOffset),
        csvEscape(s.startTime),
        String(s.duration),
        csvEscape(s.location),
        csvEscape(s.body),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

// RFC4180-ish parser: handles quoted fields, escaped quotes (""), and
// newlines inside quotes (e.g. multi-line body).
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Maps parsed CSV rows to sessions. Header row drives column order; accepts a
// few friendly aliases. Returns valid sessions plus the count skipped.
function sessionsFromCsv(text: string): { sessions: Session[]; skipped: number } {
  const rows = parseCsvRows(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return { sessions: [], skipped: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    title: col(["title"]),
    dayOffset: col(["dayoffset", "day", "day offset"]),
    startTime: col(["starttime", "start", "start time"]),
    duration: col(["duration", "minutes", "mins"]),
    location: col(["location"]),
    body: col(["body", "description", "desc"]),
  };
  const sessions: Session[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");
    const title = get(idx.title);
    const startTime = get(idx.startTime);
    const dayOffset = Number(get(idx.dayOffset));
    const duration = Number(get(idx.duration));
    if (!title || !/^\d{1,2}:\d{2}$/.test(startTime) || !Number.isFinite(dayOffset) || !(duration > 0)) {
      skipped++;
      continue;
    }
    sessions.push({
      title,
      dayOffset: Math.max(0, Math.trunc(dayOffset)),
      startTime,
      duration,
      location: get(idx.location),
      body: get(idx.body),
    });
  }
  return { sessions, skipped };
}

function downloadCsv(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface Session {
  title: string;
  dayOffset: number;
  startTime: string; // "HH:MM"
  duration: number; // minutes
  location: string;
  body: string;
}

export interface RoleTemplate {
  id: string;
  name: string;
  sessions: Session[];
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "role"
  );
}

function clone(roles: RoleTemplate[]): RoleTemplate[] {
  return JSON.parse(JSON.stringify(roles));
}

export default function TemplateEditor({
  initialRoles,
  storeMode,
  onClose,
  onSaved,
}: {
  initialRoles: RoleTemplate[];
  storeMode: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roles, setRoles] = useState<RoleTemplate[]>(() =>
    initialRoles.length ? clone(initialRoles) : [{ id: "role", name: "New role", sessions: [] }],
  );
  const [selectedId, setSelectedId] = useState<string>(initialRoles[0]?.id ?? "role");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0];

  function updateRole(id: string, patch: Partial<RoleTemplate>) {
    setRoles((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function updateSession(roleId: string, i: number, patch: Partial<Session>) {
    setRoles((rs) =>
      rs.map((r) =>
        r.id === roleId
          ? { ...r, sessions: r.sessions.map((s, si) => (si === i ? { ...s, ...patch } : s)) }
          : r,
      ),
    );
  }
  function addSession(roleId: string) {
    setRoles((rs) =>
      rs.map((r) =>
        r.id === roleId
          ? {
              ...r,
              sessions: [
                ...r.sessions,
                { title: "New session", dayOffset: 0, startTime: "09:00", duration: 30, location: "", body: "" },
              ],
            }
          : r,
      ),
    );
  }
  function removeSession(roleId: string, i: number) {
    setRoles((rs) =>
      rs.map((r) => (r.id === roleId ? { ...r, sessions: r.sessions.filter((_, si) => si !== i) } : r)),
    );
  }
  function addRole() {
    let base = "new-role";
    let id = base;
    let n = 2;
    while (roles.some((r) => r.id === id)) id = `${base}-${n++}`;
    const role: RoleTemplate = { id, name: "New role", sessions: [] };
    setRoles((rs) => [...rs, role]);
    setSelectedId(id);
  }
  function deleteRole(id: string) {
    if (roles.length <= 1) {
      setError("Keep at least one role.");
      return;
    }
    setRoles((rs) => {
      const next = rs.filter((r) => r.id !== id);
      if (id === selectedId) setSelectedId(next[0].id);
      return next;
    });
  }

  function exportCsv() {
    if (!selected) return;
    downloadCsv(`${selected.id}-sessions.csv`, toCsv(selected.sessions));
  }
  async function importCsv(file: File) {
    setError(null);
    setStatus(null);
    try {
      const text = await file.text();
      const { sessions, skipped } = sessionsFromCsv(text);
      if (sessions.length === 0) {
        setError("No valid rows found. Expected columns: title, dayOffset, startTime (HH:MM), duration, location, body.");
        return;
      }
      updateRole(selected.id, { sessions });
      setStatus(
        `Imported ${sessions.length} session(s) into "${selected.name}"${skipped ? `, skipped ${skipped} invalid row(s)` : ""}. Review, then Save.`,
      );
    } catch {
      setError("Could not read that file.");
    }
  }

  async function save() {
    setError(null);
    setStatus(null);
    // Normalize ids from names where blank, and coerce numbers.
    const cleaned: RoleTemplate[] = roles.map((r) => ({
      id: (r.id || slugify(r.name)).trim(),
      name: r.name.trim() || r.id,
      sessions: r.sessions.map((s) => ({
        title: s.title,
        dayOffset: Number(s.dayOffset) || 0,
        startTime: s.startTime,
        duration: Number(s.duration) || 0,
        location: s.location,
        body: s.body,
      })),
    }));
    const ids = cleaned.map((r) => r.id.toLowerCase());
    if (new Set(ids).size !== ids.length) {
      setError("Role ids must be unique.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed.");
        return;
      }
      setRoles(cleaned);
      setStatus("Saved.");
      onSaved();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor">
      {storeMode === "read-only" && (
        <p className="status editor-warn">
          No writable store is configured, so changes can be edited here but not saved. Add a Vercel
          KV store (see HANDOFF.md) to enable saving.
        </p>
      )}

      <div className="editor-grid">
        <aside className="card editor-roles">
          <h2>Roles</h2>
          <ul className="role-list">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  className={`role-item ${r.id === selectedId ? "active" : ""}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <span className="role-item-name">{r.name || "(unnamed)"}</span>
                  <span className="role-item-count">{r.sessions.length}</span>
                </button>
              </li>
            ))}
          </ul>
          <button className="btn" onClick={addRole}>
            + Add role
          </button>
        </aside>

        <section className="card editor-detail">
          {selected && (
            <>
              <div className="editor-detail-head">
                <label className="field">
                  <span>Role name</span>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => updateRole(selected.id, { name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Role id</span>
                  <input
                    type="text"
                    value={selected.id}
                    onChange={(e) => updateRole(selected.id, { id: slugify(e.target.value) })}
                  />
                  <small>Used internally; lowercase, no spaces.</small>
                </label>
                <button
                  className="btn ghost danger"
                  onClick={() => deleteRole(selected.id)}
                  disabled={roles.length <= 1}
                >
                  Delete role
                </button>
              </div>

              <div className="session-toolbar">
                <button className="btn small" onClick={exportCsv}>
                  Download CSV
                </button>
                <button className="btn small" onClick={() => fileInputRef.current?.click()}>
                  Upload CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importCsv(f);
                    e.target.value = ""; // allow re-uploading the same file
                  }}
                />
                <span className="muted small">
                  Download the current sessions as a CSV to use as a template, edit it, and upload to
                  replace this role&rsquo;s sessions.
                </span>
              </div>

              <div className="session-editors">
                {selected.sessions.length === 0 && (
                  <p className="muted small">No sessions yet — add one below or upload a CSV.</p>
                )}
                {selected.sessions.map((s, i) => (
                  <div className="session-editor" key={i}>
                    <div className="session-editor-grid">
                      <label className="field span2">
                        <span>Title</span>
                        <input
                          type="text"
                          value={s.title}
                          onChange={(e) => updateSession(selected.id, i, { title: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Day (0 = start)</span>
                        <input
                          type="number"
                          min={0}
                          value={s.dayOffset}
                          onChange={(e) => updateSession(selected.id, i, { dayOffset: Number(e.target.value) })}
                        />
                      </label>
                      <label className="field">
                        <span>Start</span>
                        <input
                          type="time"
                          value={s.startTime}
                          onChange={(e) => updateSession(selected.id, i, { startTime: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Duration (min)</span>
                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={s.duration}
                          onChange={(e) => updateSession(selected.id, i, { duration: Number(e.target.value) })}
                        />
                      </label>
                      <label className="field span2">
                        <span>Location</span>
                        <input
                          type="text"
                          value={s.location}
                          onChange={(e) => updateSession(selected.id, i, { location: e.target.value })}
                        />
                      </label>
                      <label className="field span4">
                        <span>Description (HTML allowed)</span>
                        <textarea
                          rows={2}
                          value={s.body}
                          onChange={(e) => updateSession(selected.id, i, { body: e.target.value })}
                        />
                      </label>
                    </div>
                    <button className="btn ghost danger small" onClick={() => removeSession(selected.id, i)}>
                      Remove session
                    </button>
                  </div>
                ))}
                <button className="btn" onClick={() => addSession(selected.id)}>
                  + Add session
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="editor-actions">
        <button className="btn primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save templates"}
        </button>
        <button className="btn" onClick={onClose}>
          Back to scheduler
        </button>
        {status && <span className="ok-text">{status}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </div>
  );
}
