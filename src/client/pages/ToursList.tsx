import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import EditCell from "../components/EditCell";
import { api, Tour } from "../lib/api";

const money = (v: number | null) => (v != null ? `$${v.toLocaleString()}` : "—");
const num = (v: number | null) => (v != null ? v : "—");

type EditField =
  | "tourCode" | "tourName" | "departureDate" | "returnDate" | "price" | "singleSupp"
  | "totalPassengers" | "seats" | "numRooms";

const TEXT_FIELDS: EditField[] = ["tourCode", "tourName", "departureDate", "returnDate"];
const REQUIRED_FIELDS: EditField[] = ["tourName", "departureDate", "returnDate"];

const cellStyle: React.CSSProperties = { whiteSpace: "nowrap" };
const calcStyle: React.CSSProperties = { whiteSpace: "nowrap", color: "#6B6D78", background: "#FAFAF8" };

function emptyForm() {
  return { tourCode: "", tourName: "", departureDate: "", returnDate: "", price: "", singleSupp: "", totalPassengers: "", seats: "", numRooms: "" };
}

export default function ToursList() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api.tours
      .list()
      .then(setTours)
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  // Save one changed cell, then reload so calculated columns (days, total, seats/rooms left) refresh.
  const saveField = async (t: Tour, field: EditField, raw: string) => {
    const v = raw.trim();
    if (REQUIRED_FIELDS.includes(field) && !v) {
      setError("Tour name, departure date and return date can't be empty");
      load(true);
      return;
    }
    let value: string | number | null;
    if (TEXT_FIELDS.includes(field)) value = v === "" ? null : v;
    else if (v === "") value = null;
    else if (Number.isNaN(Number(v))) {
      setError("That field needs a number");
      load(true);
      return;
    } else value = Number(v);
    setError(null);
    try {
      await api.tours.update(t.id, { [field]: value } as Partial<Tour>);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    load(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.tours.create({
        tourCode: form.tourCode || null,
        tourName: form.tourName,
        departureDate: form.departureDate,
        returnDate: form.returnDate,
        price: form.price ? Number(form.price) : null,
        singleSupp: form.singleSupp ? Number(form.singleSupp) : null,
        totalPassengers: form.totalPassengers ? Number(form.totalPassengers) : null,
        seats: form.seats ? Number(form.seats) : null,
        numRooms: form.numRooms ? Number(form.numRooms) : null,
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {edit && <span className="muted">Changes save when you leave a cell. Grey columns are calculated.</span>}
          <button
            className={edit ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setEdit(!edit)}
            title="Edit tour details directly in the table"
          >
            {edit ? "Datasheet view: on" : "Datasheet view"}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New tour
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FDECEA", color: "#B42318", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading&hellip;</div>
        ) : tours.length === 0 ? (
          <div className="empty-state">No tours yet. Add your first one.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Tour</th>
                  <th>Departs</th>
                  <th>Returns</th>
                  <th>Days</th>
                  <th>Price</th>
                  <th>Single supp</th>
                  <th>Total</th>
                  <th>Total pax</th>
                  <th>Seats</th>
                  <th>Booked</th>
                  <th>Seats left</th>
                  <th>Rooms</th>
                  <th>Rooms used</th>
                  <th>Rooms left</th>
                  {edit && <th />}
                </tr>
              </thead>
              <tbody>
                {tours.map((t) => {
                  const hasTotal = t.price != null || t.singleSupp != null;
                  const ed = (field: EditField, value: string | number | null, width: number, type?: string) => (
                    <td style={{ padding: "4px 6px" }}>
                      <EditCell
                        value={value == null ? null : String(value)}
                        width={width}
                        type={type}
                        onSave={(v) => saveField(t, field, v)}
                      />
                    </td>
                  );
                  return edit ? (
                    <tr key={t.id}>
                      {ed("tourCode", t.tourCode, 100)}
                      {ed("tourName", t.tourName, 250)}
                      {ed("departureDate", t.departureDate, 130, "date")}
                      {ed("returnDate", t.returnDate, 130, "date")}
                      <td style={calcStyle}>{t.numDays} days</td>
                      {ed("price", t.price, 80, "number")}
                      {ed("singleSupp", t.singleSupp, 80, "number")}
                      <td style={calcStyle}>{hasTotal ? money(t.total) : "—"}</td>
                      {ed("totalPassengers", t.totalPassengers, 64, "number")}
                      {ed("seats", t.seats, 64, "number")}
                      <td style={calcStyle}>{t.passengerCount}</td>
                      <td style={calcStyle}>{num(t.seatsLeft)}</td>
                      {ed("numRooms", t.numRooms, 64, "number")}
                      <td style={calcStyle}>{t.roomCount}</td>
                      <td style={calcStyle}>{num(t.roomsLeft)}</td>
                      <td style={cellStyle}>
                        <Link to={`/tours/${t.id}`}>Open →</Link>
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id} className="clickable" onClick={() => navigate(`/tours/${t.id}`)}>
                      <td style={cellStyle}>{t.tourCode || "—"}</td>
                      <td>{t.tourName}</td>
                      <td style={cellStyle}>{t.departureDate}</td>
                      <td style={cellStyle}>{t.returnDate}</td>
                      <td>
                        <span className="badge">{t.numDays} days</span>
                      </td>
                      <td>{money(t.price)}</td>
                      <td>{money(t.singleSupp)}</td>
                      <td>{hasTotal ? money(t.total) : "—"}</td>
                      <td>{num(t.totalPassengers)}</td>
                      <td>{num(t.seats)}</td>
                      <td>{t.passengerCount}</td>
                      <td>{num(t.seatsLeft)}</td>
                      <td>{num(t.numRooms)}</td>
                      <td>{t.roomCount}</td>
                      <td>{num(t.roomsLeft)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New tour</h2>
            <form onSubmit={submit}>
              <div className="form-grid">
                <label>
                  Tour code
                  <input value={form.tourCode} onChange={(e) => setForm({ ...form, tourCode: e.target.value })} />
                </label>
              </div>
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
                  Single supp ($)
                  <input
                    type="number"
                    step="0.01"
                    value={form.singleSupp}
                    onChange={(e) => setForm({ ...form, singleSupp: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Total ($)
                  <input
                    readOnly
                    disabled
                    value={form.price || form.singleSupp ? (Number(form.price || 0) + Number(form.singleSupp || 0)).toFixed(2) : ""}
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
              <div className="form-grid">
                <label>
                  Seats
                  <input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
                </label>
                <label>
                  Rooms
                  <input
                    type="number"
                    value={form.numRooms}
                    onChange={(e) => setForm({ ...form, numRooms: e.target.value })}
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
