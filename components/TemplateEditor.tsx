"use client";

import { useState } from "react";

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

              <div className="session-editors">
                {selected.sessions.length === 0 && (
                  <p className="muted small">No sessions yet — add one below.</p>
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
