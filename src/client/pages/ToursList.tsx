import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Tour } from "../lib/api";

function emptyForm() {
  return { tourName: "", departureDate: "", returnDate: "", price: "", totalPassengers: "" };
}

export default function ToursList() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.tours
      .list()
      .then(setTours)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.tours.create({
        tourName: form.tourName,
        departureDate: form.departureDate,
        returnDate: form.returnDate,
        price: form.price ? Number(form.price) : null,
        totalPassengers: form.totalPassengers ? Number(form.totalPassengers) : null,
      });
      setShowForm(false);
      setForm(emptyForm());
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1>Tours</h1>
          <span className="muted">{tours.length} tours</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + New tour
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading&hellip;</div>
        ) : tours.length === 0 ? (
          <div className="empty-state">No tours yet. Add your first one.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tour</th>
                <th>Departs</th>
                <th>Returns</th>
                <th>Days</th>
                <th>Price</th>
                <th>Passengers</th>
              </tr>
            </thead>
            <tbody>
              {tours.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => navigate(`/tours/${t.id}`)}>
                  <td>{t.tourName}</td>
                  <td>{t.departureDate}</td>
                  <td>{t.returnDate}</td>
                  <td>
                    <span className="badge">{t.numDays} days</span>
                  </td>
                  <td>{t.price != null ? `$${t.price.toLocaleString()}` : "—"}</td>
                  <td>{t.totalPassengers ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New tour</h2>
            <form onSubmit={submit}>
              <div className="form-grid full">
                <label>
                  Tour name
                  <input
                    required
                    value={form.tourName}
                    onChange={(e) => setForm({ ...form, tourName: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Departure date
                  <input
                    type="date"
                    required
                    value={form.departureDate}
                    onChange={(e) => setForm({ ...form, departureDate: e.target.value })}
                  />
                </label>
                <label>
                  Return date
                  <input
                    type="date"
                    required
                    value={form.returnDate}
                    onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Price ($)
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </label>
                <label>
                  Total passengers
                  <input
                    type="number"
                    value={form.totalPassengers}
                    onChange={(e) => setForm({ ...form, totalPassengers: e.target.value })}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save tour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
