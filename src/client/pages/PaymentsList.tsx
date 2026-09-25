import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, PaymentEntry, Tour } from "../lib/api";

const money = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function emptyForm() {
  return { tourId: "", amount: "", method: "", description: "", receivedDate: "", bankedDate: "" };
}

export default function PaymentsList() {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [tourFilter, setTourFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PaymentEntry | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.payments
      .list(tourFilter ? { tourId: Number(tourFilter) } : undefined)
      .then(setPayments)
      .finally(() => setLoading(false));
  };

  useEffect(load, [tourFilter]);
  useEffect(() => {
    api.tours.list().then(setTours);
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm(), tourId: tourFilter });
    setError(null);
    setShowForm(true);
  };
  const openEdit = (p: PaymentEntry) => {
    setEditing(p);
    setForm({
      tourId: p.tourId != null ? String(p.tourId) : "",
      amount: String(p.amount),
      method: p.method ?? "",
      description: p.description ?? "",
      receivedDate: p.receivedDate ?? "",
      bankedDate: p.bankedDate ?? "",
    });
    setError(null);
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.amount.trim() === "" || Number.isNaN(Number(form.amount))) {
      setError("Enter a valid amount (negative for money out)");
      return;
    }
    const data = {
      tourId: form.tourId ? Number(form.tourId) : null,
      amount: Number(form.amount),
      method: form.method || null,
      description: form.description || null,
      receivedDate: form.receivedDate || null,
      bankedDate: form.bankedDate || null,
    };
    try {
      if (editing) await api.payments.update(editing.id, data);
      else await api.payments.create(data);
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (p: PaymentEntry) => {
    await api.payments.remove(p.id);
    load();
  };

  const latestBalance = payments.length > 0 ? payments[payments.length - 1].runningBalance : undefined;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1>Payments</h1>
          <span className="muted">{payments.length} entries</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select value={tourFilter} onChange={(e) => setTourFilter(e.target.value)}>
            <option value="">All tours</option>
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tourCode || t.tourName}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={openAdd}>
            + Add entry
          </button>
        </div>
      </div>

      <div className="card" style={{ display: "flex", gap: 40, padding: 16, marginBottom: 16 }}>
        <div>
          <div className="label" style={{ fontSize: 12, color: "#8B8D97" }}>
            Bank balance (all entries)
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{latestBalance != null ? money(latestBalance) : "—"}</div>
        </div>
        {tourFilter && (
          <span className="muted" style={{ alignSelf: "center" }}>
            Filtered to one tour, but the running balance shown per row is still the whole bank balance at that
            point.
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: "#FDECEA", color: "#B42318", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading&hellip;</div>
        ) : payments.length === 0 ? (
          <div className="empty-state">No payments recorded yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Received</th>
                <th>Invoice / Tour</th>
                <th>Description</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Banked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.receivedDate || "—"}</td>
                  <td>
                    {p.invoiceId != null ? (
                      <Link to={`/invoices/${p.invoiceId}`}>{p.invoiceNumber}</Link>
                    ) : p.tourId != null ? (
                      <Link to={`/tours/${p.tourId}`}>{p.tourCode}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{p.description || "—"}</td>
                  <td>{p.method || "—"}</td>
                  <td style={{ color: p.amount < 0 ? "#B42318" : "#1C1D21" }}>{money(p.amount)}</td>
                  <td>{p.runningBalance != null ? money(p.runningBalance) : "—"}</td>
                  <td>{p.bankedDate || "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12, marginRight: 6 }} onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => remove(p)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "Edit entry" : "Add entry"}</h2>
            <p className="muted">
              For a customer payment against an invoice, add it from the invoice&rsquo;s receipt page instead &mdash;
              this form is for transfers and other entries not tied to one invoice (e.g. paying the tour operator,
              bank fees).
            </p>
            <form onSubmit={submit}>
              <div className="form-grid">
                <label>
                  Tour (optional)
                  <select value={form.tourId} onChange={(e) => setForm({ ...form, tourId: e.target.value })}>
                    <option value="">— None —</option>
                    {tours.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.tourCode || t.tourName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount ($)
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="negative = money out"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid full">
                <label>
                  Description
                  <input
                    placeholder="e.g. Tour Payment"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Method
                  <input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
                </label>
                <label>
                  Received / paid date
                  <input
                    type="date"
                    value={form.receivedDate}
                    onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Banked date
                  <input
                    type="date"
                    value={form.bankedDate}
                    onChange={(e) => setForm({ ...form, bankedDate: e.target.value })}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? "Save" : "Add entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
