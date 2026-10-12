import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Task } from "../lib/api";

type View = "open" | "completed" | "all";

// "2026-10-12T03:04:05.000Z" or "2026-10-12 03:04:05" -> "12 Oct 2026"
const fmtDate = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
};

export default function TasksList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("open");
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editText, setEditText] = useState("");

  const load = () => {
    setLoading(true);
    api.tasks
      .list()
      .then(setTasks)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch {
      setError("Couldn't update the task. Check your connection and try again.");
    }
    load();
  };

  const setCompleted = (t: Task, completed: boolean) => run(() => api.tasks.update(t.id, { completed }));
  const remove = (t: Task) => {
    setConfirmDelete(null);
    return run(() => api.tasks.remove(t.id));
  };

  const saveEdit = () => {
    if (!editing) return;
    const text = editText.trim();
    if (!text) return;
    const { id } = editing;
    setEditing(null);
    return run(() => api.tasks.update(id, { task: text }));
  };

  const openCount =tasks.filter((t) => !t.completedAt).length;
  const completedCount = tasks.length - openCount;

  // Match the customer's name (either order) or the task text.
  const q = query.trim().toLowerCase();
  const inView = tasks.filter((t) => (view === "all" ? true : view === "open" ? !t.completedAt : !!t.completedAt));
  const matches = (t: Task) =>
    [`${t.firstName} ${t.lastName}`, `${t.lastName} ${t.firstName}`, `${t.lastName}, ${t.firstName}`, t.task].some((s) =>
      s.toLowerCase().includes(q),
    );
  const filtered = q ? inView.filter(matches) : inView;
  // Open tasks: newest first. Completed: most recently completed first.
  const shown = [...filtered].sort((a, b) =>
    view === "completed"
      ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
      : (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );

  const tab = (v: View, label: string, count: number) => (
    <button
      key={v}
      className={view === v ? "btn btn-primary" : "btn btn-secondary"}
      style={{ padding: "6px 14px" }}
      onClick={() => setView(v)}
    >
      {label} <span style={{ opacity: 0.75 }}>({count})</span>
    </button>
  );

  const emptyText =
    q !== ""
      ? `No tasks match “${query.trim()}”.`
      : view === "open"
        ? tasks.length === 0
          ? "No tasks yet. Add one from a customer's page."
          : "No open tasks. 🎉"
        : view === "completed"
          ? "No completed tasks yet."
          : "No tasks yet.";

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1>Tasks</h1>
          <span className="muted">
            {openCount} open · {completedCount} completed
          </span>
        </div>
        <input
          type="search"
          placeholder="Search customer or task…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 300, padding: "10px 14px", borderRadius: 10, font: "inherit", fontSize: 14 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {tab("open", "Open", openCount)}
        {tab("completed", "Completed", completedCount)}
        {tab("all", "All", tasks.length)}
      </div>

      {error && <div style={{ color: "#B91C1C", marginBottom: 8 }}>{error}</div>}

      <div className="card">
        {loading && tasks.length === 0 ? (
          <div className="empty-state">Loading&hellip;</div>
        ) : shown.length === 0 ? (
          <div className="empty-state">{emptyText}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Task</th>
                <th>Created</th>
                {view !== "open" && <th>Completed</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const done = !!t.completedAt;
                return (
                  <tr key={t.id} style={done ? { color: "#6B7280" } : undefined}>
                    <td>
                      <Link to={`/customers/${t.customerId}`}>
                        {t.firstName} {t.lastName}
                      </Link>
                    </td>
                    <td style={{ whiteSpace: "pre-line", textDecoration: done ? "line-through" : undefined }}>{t.task}</td>
                    <td>{fmtDate(t.createdAt)}</td>
                    {view !== "open" && <td>{fmtDate(t.completedAt)}</td>}
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      {done ? (
                        <button className="btn btn-secondary" onClick={() => setCompleted(t, false)}>
                          Reopen
                        </button>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => setCompleted(t, true)}>
                          Done
                        </button>
                      )}{" "}
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditing(t);
                          setEditText(t.task);
                        }}
                      >
                        Edit
                      </button>{" "}
                      <button
                        className="btn btn-secondary"
                        title="Delete this task permanently"
                        onClick={() => setConfirmDelete(t)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit task</h2>
            <p className="muted">
              {editing.firstName} {editing.lastName}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit();
              }}
            >
              <div className="form-grid full">
                <label>
                  Task
                  <textarea autoFocus rows={5} value={editText} onChange={(e) => setEditText(e.target.value)} required />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!editText.trim()}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete this task?</h2>
            <p style={{ whiteSpace: "pre-line" }}>
              {confirmDelete.firstName} {confirmDelete.lastName}: {confirmDelete.task}
            </p>
            <p className="muted">This permanently removes it. Use Done instead to keep it in the completed list.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => remove(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
