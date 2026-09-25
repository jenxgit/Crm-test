import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, InvoiceSummary } from "../lib/api";

const money = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoicesList() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.invoices
      .list()
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const haystack = [
        inv.invoiceNumber,
        inv.tourCode,
        inv.tourName,
        ...inv.bookings.map((b) => `${b.firstName} ${b.lastName}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, query]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1>Invoices</h1>
          <span className="muted">
            {query.trim() ? `${filtered.length} of ${invoices.length}` : `${invoices.length} invoices`}
          </span>
        </div>
        <input
          type="search"
          placeholder="Search invoice #, tour, passenger…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 280, padding: "7px 10px", border: "1px solid #E1E1DC", borderRadius: 8, font: "inherit", fontSize: 14 }}
        />
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading&hellip;</div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            No invoices yet. Create one from a passenger row on a tour&rsquo;s page.
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No invoices match &ldquo;{query}&rdquo;.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Tour</th>
                <th>Passengers</th>
                <th>Charged</th>
                <th>Paid</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="clickable" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <td>{inv.invoiceNumber}</td>
                  <td>
                    {inv.tourCode ? `${inv.tourCode} · ` : ""}
                    {inv.tourName || "—"}
                  </td>
                  <td>{inv.bookings.map((b) => `${b.firstName} ${b.lastName}`).join(", ")}</td>
                  <td>{money(inv.totalCharged)}</td>
                  <td>{money(inv.totalPaid)}</td>
                  <td style={{ fontWeight: 700, color: inv.balance > 0 ? "#B4530B" : "#1C1D21" }}>
                    {money(inv.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
