import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EditCell from "../components/EditCell";
import { api, Customer } from "../lib/api";

type Field =
  | "title" | "lastName" | "firstName" | "dateOfBirth" | "email" | "phone" | "mobile"
  | "streetAddress" | "suburb" | "state" | "postcode" | "dietaries";

// Column order for the datasheet view.
const SHEET_COLS: { key: Field; label: string; width: number; type?: string }[] = [
  { key: "title", label: "Title", width: 56 },
  { key: "lastName", label: "Surname", width: 120 },
  { key: "firstName", label: "Name", width: 130 },
  { key: "dateOfBirth", label: "DOB", width: 130, type: "date" },
  { key: "email", label: "Email", width: 210, type: "email" },
  { key: "phone", label: "Phone", width: 110 },
  { key: "mobile", label: "Mobile", width: 110 },
  { key: "streetAddress", label: "Address", width: 180 },
  { key: "suburb", label: "Suburb", width: 130 },
  { key: "state", label: "State", width: 56 },
  { key: "postcode", label: "PC", width: 64 },
  { key: "dietaries", label: "Dietaries", width: 190 },
];

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

function emptyForm() {
  return {
    title: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    mobile: "",
    streetAddress: "",
    suburb: "",
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
  const [edit, setEdit] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.customers
      .list()
      .then(setCustomers)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Every word typed must appear somewhere in the customer's details (any order, any field).
  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return customers;
    return customers.filter((c) => {
      const haystack = [
        c.title, c.firstName, c.lastName, c.email, c.phone, c.mobile,
        c.streetAddress, c.suburb, c.state, c.postcode, c.dietaries, c.dateOfBirth,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [customers, query]);

  const saveField = async (c: Customer, field: Field, value: string) => {
    const v = value.trim();
    if ((field === "firstName" || field === "lastName") && !v) {
      setError("First and last name can't be empty");
      load();
      return;
    }
    setError(null);
    try {
      const updated = await api.customers.update(c.id, { [field]: v === "" ? null : v } as Partial<Customer>);
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      load();
    }
  };

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
          <span className="muted">
            {query.trim() ? `${filtered.length} of ${customers.length} people` : `${customers.length} people`}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="search"
            placeholder="Search name, email, phone, suburb…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 280, padding: "7px 10px", border: "1px solid #E1E1DC", borderRadius: 8, font: "inherit", fontSize: 14 }}
          />
          {edit && <span className="muted">Changes save when you leave a cell.</span>}
          <button
            className={edit ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setEdit(!edit)}
            title="Edit customer details directly in the table"
          >
            {edit ? "Datasheet view: on" : "Datasheet view"}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New customer
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
        ) : customers.length === 0 ? (
          <div className="empty-state">No customers yet. Add your first one.</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No customers match &ldquo;{query}&rdquo;.</div>
        ) : edit ? (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  {SHEET_COLS.map((col) => (
                    <th key={col.key} style={{ whiteSpace: "nowrap" }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    {SHEET_COLS.map((col) => (
                      <td key={col.key} style={{ padding: "4px 6px" }}>
                        <EditCell
                          value={(c[col.key] as string | null) ?? null}
                          width={col.width}
                          type={col.type}
                          onSave={(v) => saveField(c, col.key, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Mobile</th>
                <th>Address</th>
                <th>Suburb</th>
                <th>State</th>
                <th>Postcode</th>
                <th>Dietaries</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td>
                    {c.title ? `${c.title} ` : ""}
                    {c.firstName} {c.lastName}
                  </td>
                  <td>{c.phone || "—"}</td>
                  <td>{c.mobile || "—"}</td>
                  <td>{c.streetAddress || "—"}</td>
                  <td>{c.suburb || "—"}</td>
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
                  Email
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Phone
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
                <label>
                  Mobile
                  <input type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
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
              <div className="form-grid full">
                <label>
                  Suburb
                  <input value={form.suburb} onChange={(e) => setForm({ ...form, suburb: e.target.value })} />
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
