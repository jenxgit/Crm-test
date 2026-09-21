import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, CustomerDetail as CustomerDetailType, Tour } from "../lib/api";

export default function CustomerDetail() {
  const { id } = useParams();
  const customerId = Number(id);
  const [customer, setCustomer] = useState<CustomerDetailType | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [showBook, setShowBook] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [tourId, setTourId] = useState("");
  const [taskText, setTaskText] = useState("");

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
            <div className="label">Street address</div>
            <div className="value">{customer.streetAddress || "—"}</div>
          </div>
          <div>
            <div className="label">State</div>
            <div className="value">{customer.state || "—"}</div>
          </div>
          <div>
            <div className="label">Postcode</div>
            <div className="value">{customer.postcode || "—"}</div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {customer.bookings.map((b) => (
                      <tr key={b.id}>
                        <td>{b.tourName}</td>
                        <td>{b.departureDate}</td>
                        <td>{b.returnDate}</td>
                        <td>{b.numDays}</td>
                        <td>{b.price != null ? `$${b.price.toLocaleString()}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <span className="section-title">Tasks</span>
            <div className="card" style={{ marginTop: 8 }}>
              {customer.tasks.length === 0 ? (
                <div className="empty-state">No tasks yet.</div>
              ) : (
                <table>
                  <tbody>
                    {customer.tasks.map((t) => (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: "pre-line" }}>{t.task}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

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
