import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Customer } from "../lib/api";

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

function emptyForm() {
  return {
    title: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    streetAddress: "",
    state: "",
    postcode: "",
    dietaries: "",
  };
}

export default function CustomersList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.customers
      .list()
      .then(setCustomers)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.customers.create(form);
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
          <h1>Customers</h1>
          <span className="muted">{customers.length} people</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + New customer
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading&hellip;</div>
        ) : customers.length === 0 ? (
          <div className="empty-state">No customers yet. Add your first one.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>State</th>
                <th>Postcode</th>
                <th>Dietaries</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td>
                    {c.title ? `${c.title} ` : ""}
                    {c.firstName} {c.lastName}
                  </td>
                  <td>{c.streetAddress || "—"}</td>
                  <td>{c.state || "—"}</td>
                  <td>{c.postcode || "—"}</td>
                  <td>{c.dietaries || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New customer</h2>
            <form onSubmit={submit}>
              <div className="form-grid">
                <label>
                  Title
                  <select value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}>
                    <option value="">—</option>
                    {["Mr", "Mrs", "Ms", "Miss", "Dr"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Date of birth
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  />
                </label>
                <label>
                  First name
                  <input
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid full">
                <label>
                  Street address
                  <input
                    value={form.streetAddress}
                    onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  State
                  <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                    <option value="">—</option>
                    {AU_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Postcode
                  <input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
                </label>
              </div>
              <div className="form-grid full">
                <label>
                  Dietaries
                  <input
                    placeholder="e.g. Vegetarian, gluten-free"
                    value={form.dietaries}
                    onChange={(e) => setForm({ ...form, dietaries: e.target.value })}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
