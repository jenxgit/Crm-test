import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import InvoiceDrawer from "../components/InvoiceDrawer";
import { api, CustomerDetail as CustomerDetailType, Tour } from "../lib/api";

// "2026-10-12T03:04:05.000Z" or "2026-10-12 03:04:05" -> "12 Oct 2026"
const fmtDate = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
};

export default function CustomerDetail() {
  const { id } = useParams();
  const customerId = Number(id);
  const [customer, setCustomer] = useState<CustomerDetailType | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [showBook, setShowBook] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [tourId, setTourId] = useState("");
  const [taskText, setTaskText] = useState("");
  const [openInvoice, setOpenInvoice] = useState<number | null>(null);
  // Edit-details dialog: every field is held as text while editing.
  const [showCompleted, setShowCompleted] = useState(false);
  const [editTask, setEditTask] = useState<CustomerDetailType["tasks"][number] | null>(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [editInfo, setEditInfo] = useState<Record<string, string> | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const load = () => {
    api.customers.get(customerId).then(setCustomer);
    api.tours.list().then(setTours);
  };

  useEffect(load, [customerId]);

  if (!customer) return <div className="empty-state">Loading&hellip;</div>;

  const addBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tourId) return;
    await api.bookings.create({ customerId, tourId: Number(tourId) });
    setShowBook(false);
    setTourId("");
    load();
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskText.trim()) return;
    await api.tasks.create({ customerId, task: taskText });
    setShowTask(false);
    setTaskText("");
    load();
  };

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask || !editTaskText.trim()) return;
    await api.tasks.update(editTask.id, { task: editTaskText.trim() });
    setEditTask(null);
    load();
  };

  const setTaskCompleted = async (taskId: number, completed: boolean) => {
    await api.tasks.update(taskId, { completed });
    load();
  };

  const completedTasks = customer.tasks.filter((t) => t.completedAt);
  const visibleTasks = showCompleted ? customer.tasks : customer.tasks.filter((t) => !t.completedAt);

  const INFO_FIELDS = [
    "title",
    "firstName",
    "lastName",
    "dateOfBirth",
    "email",
    "phone",
    "mobile",
    "streetAddress",
    "suburb",
    "state",
    "postcode",
    "dietaries",
  ] as const;

  const openEditInfo = () => {
    setEditError(null);
    setEditInfo(Object.fromEntries(INFO_FIELDS.map((f) => [f, customer[f] ?? ""])));
  };

  const saveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInfo) return;
    if (!editInfo.firstName.trim() || !editInfo.lastName.trim()) {
      setEditError("First and last name are required");
      return;
    }
    const data = Object.fromEntries(INFO_FIELDS.map((f) => [f, editInfo[f].trim() || null]));
    try {
      await api.customers.update(customerId, data as Partial<CustomerDetailType>);
    } catch {
      setEditError("Couldn't save the changes. Check your connection and try again.");
      return;
    }
    setEditInfo(null);
    load();
  };

  const field = (label: string, key: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>
      {label}
      <input {...props} value={editInfo?.[key] ?? ""} onChange={(e) => setEditInfo({ ...editInfo!, [key]: e.target.value })} />
    </label>
  );

  return (
    <div>
      <Link to="/customers" className="back-link">
        ← Customers
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#FDE7D8",
            color: "#B4530B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {customer.firstName[0]}
          {customer.lastName[0]}
        </div>
        <div>
          <h1>
            {customer.title ? `${customer.title} ` : ""}
            {customer.firstName} {customer.lastName}
          </h1>
          <span className="muted">{customer.dietaries ? `Dietaries: ${customer.dietaries}` : "No dietary notes"}</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={openEditInfo}>
            Edit details
          </button>
          <button className="btn btn-secondary" onClick={() => setShowTask(true)}>
            + Task
          </button>
          <button className="btn btn-primary" onClick={() => setShowBook(true)}>
            + Book tour
          </button>
        </div>
      </div>

      <div className="two-col">
        <div className="info-card">
          <span className="section-title">Contact info</span>
          <div>
            <div className="label">Date of birth</div>
            <div className="value">{customer.dateOfBirth || "—"}</div>
          </div>
          <div>
            <div className="label">Email</div>
            <div className="value">{customer.email || "—"}</div>
          </div>
          <div>
            <div className="label">Phone</div>
            <div className="value">{customer.phone || "—"}</div>
          </div>
          <div>
            <div className="label">Mobile</div>
            <div className="value">{customer.mobile || "—"}</div>
          </div>
          <div>
            <div className="label">Street address</div>
            <div className="value">{customer.streetAddress || "—"}</div>
          </div>
          <div>
            <div className="label">Suburb</div>
            <div className="value">{customer.suburb || "—"}</div>
          </div>
          <div>
            <div className="label">State</div>
            <div className="value">{customer.state || "—"}</div>
          </div>
          <div>
            <div className="label">Postcode</div>
            <div className="value">{customer.postcode || "—"}</div>
          </div>
          <div>
            <div className="label">Dietaries</div>
            <div className="value" style={{ whiteSpace: "pre-line" }}>
              {customer.dietaries || "—"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <span className="section-title">Bookings</span>
            <div className="card" style={{ marginTop: 8 }}>
              {customer.bookings.length === 0 ? (
                <div className="empty-state">No tours booked yet.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Tour</th>
                      <th>Departs</th>
                      <th>Returns</th>
                      <th>Days</th>
                      <th>Price</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.bookings.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <Link to={`/tours/${b.tourId}`}>{b.tourName}</Link>
                        </td>
                        <td>{b.departureDate}</td>
                        <td>{b.returnDate}</td>
                        <td>{b.numDays}</td>
                        <td>{b.price != null ? `$${b.price.toLocaleString()}` : "—"}</td>
                        <td>
                          {b.invoiceId != null ? (
                            // Opens in a slide-over; ctrl/cmd/middle-click still opens the full page.
                            <Link
                              to={`/invoices/${b.invoiceId}`}
                              onClick={(e) => {
                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                                e.preventDefault();
                                setOpenInvoice(b.invoiceId!);
                              }}
                            >
                              {b.invoiceNumber}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <span className="section-title">Tasks</span>
            {completedTasks.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ padding: "1px 8px", fontSize: 11, marginLeft: 10 }}
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? "Hide completed" : `Show completed (${completedTasks.length})`}
              </button>
            )}
            <div className="card" style={{ marginTop: 8 }}>
              {visibleTasks.length === 0 ? (
                <div className="empty-state">{customer.tasks.length === 0 ? "No tasks yet." : "No open tasks."}</div>
              ) : (
                <table>
                  <tbody>
                    {visibleTasks.map((t) => (
                      <tr key={t.id} style={t.completedAt ? { color: "#6B7280" } : undefined}>
                        <td style={{ whiteSpace: "pre-line", textDecoration: t.completedAt ? "line-through" : undefined }}>
                          {t.task}
                        </td>
                        <td className="muted" style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                          Created {fmtDate(t.createdAt)}
                          {t.completedAt && (
                            <>
                              <br />
                              Completed {fmtDate(t.completedAt)}
                            </>
                          )}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "2px 10px", fontSize: 12, marginRight: 6 }}
                            onClick={() => setTaskCompleted(t.id, !t.completedAt)}
                          >
                            {t.completedAt ? "Reopen" : "Done"}
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "2px 10px", fontSize: 12 }}
                            onClick={() => {
                              setEditTask(t);
                              setEditTaskText(t.task);
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {editTask && (
        <div className="modal-backdrop" onClick={() => setEditTask(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit task</h2>
            <form onSubmit={saveTask}>
              <div className="form-grid full">
                <label>
                  Task
                  <textarea autoFocus rows={5} value={editTaskText} onChange={(e) => setEditTaskText(e.target.value)} required />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditTask(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editInfo && (
        <div className="modal-backdrop" onClick={() => setEditInfo(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit customer details</h2>
            <form onSubmit={saveInfo}>
              <div className="form-grid">
                {field("Title", "title")}
                {field("Date of birth", "dateOfBirth", { type: "date" })}
              </div>
              <div className="form-grid">
                {field("First name", "firstName", { autoFocus: true })}
                {field("Last name", "lastName")}
              </div>
              <div className="form-grid">
                {field("Email", "email", { type: "email" })}
                {field("Phone", "phone")}
              </div>
              <div className="form-grid">
                {field("Mobile", "mobile")}
              </div>
              <div className="form-grid full">
                <label>
                  Dietaries
                  <textarea
                    rows={2}
                    value={editInfo.dietaries ?? ""}
                    onChange={(e) => setEditInfo({ ...editInfo, dietaries: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid full">{field("Street address", "streetAddress")}</div>
              <div className="form-grid">
                {field("Suburb", "suburb")}
                {field("State", "state")}
              </div>
              <div className="form-grid">{field("Postcode", "postcode")}</div>
              {editError && <div style={{ color: "#B91C1C", marginTop: 8 }}>{editError}</div>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditInfo(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {openInvoice != null && (
        <InvoiceDrawer invoiceId={openInvoice} onClose={() => setOpenInvoice(null)} onChanged={load} />
      )}

      {showBook && (
        <div className="modal-backdrop" onClick={() => setShowBook(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Book a tour</h2>
            <form onSubmit={addBooking}>
              <div className="form-grid full">
                <label>
                  Tour
                  <select value={tourId} onChange={(e) => setTourId(e.target.value)} required>
                    <option value="">Select a tour…</option>
                    {tours.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.tourName} ({t.departureDate})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBook(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTask && (
        <div className="modal-backdrop" onClick={() => setShowTask(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New task</h2>
            <form onSubmit={addTask}>
              <div className="form-grid full">
                <label>
                  Task
                  <textarea value={taskText} onChange={(e) => setTaskText(e.target.value)} required />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTask(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
