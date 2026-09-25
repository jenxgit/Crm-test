import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, DashboardData } from "../lib/api";

const money = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmt = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${Number(day)}/${Number(m)}/${y}`;
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [fy, setFy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = (year?: number) => {
    setLoading(true);
    api.dashboard
      .get(year)
      .then((d) => {
        setData(d);
        setFy(d.fy.startYear);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const stat = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div>
      <div className="label" style={{ fontSize: 12, color: "#8B8D97" }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        {data && (
          <select
            value={fy ?? data.fy.startYear}
            onChange={(e) => load(Number(e.target.value))}
            style={{ padding: "6px 10px", fontSize: 14 }}
          >
            {data.availableYears.map((y) => (
              <option key={y.startYear} value={y.startYear}>
                FY {y.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading || !data ? (
        <div className="empty-state">Loading&hellip;</div>
      ) : (
        <>
          <div className="card" style={{ display: "flex", gap: 40, padding: 20, marginBottom: 16, flexWrap: "wrap" }}>
            {stat("Tours completed", data.toursCompleted)}
            {stat("Tours planned", data.toursPlanned)}
            {stat("Total bookings", data.totalBookings)}
            {stat("Revenue billed", money(data.revenueBilled), <div className="muted" style={{ fontSize: 11 }}>completed tours</div>)}
            {stat("Payments received", money(data.paymentsReceived), <div className="muted" style={{ fontSize: 11 }}>cash in this FY</div>)}
            {stat(
              "Outstanding balance",
              money(data.outstandingBalance),
              data.overdueBalance > 0 ? (
                <div style={{ fontSize: 11, color: "#B42318" }}>{money(data.overdueBalance)} overdue (tour departed)</div>
              ) : undefined,
            )}
          </div>

          <span className="section-title">Upcoming tours with seats left</span>
          <div className="card" style={{ marginTop: 8 }}>
            {data.upcomingTours.length === 0 ? (
              <div className="empty-state">No upcoming tours with seats left in this financial year.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Tour</th>
                    <th>Departs</th>
                    <th>Booked</th>
                    <th>Seats left</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcomingTours.map((t) => (
                    <tr key={t.id} className="clickable" onClick={() => navigate(`/tours/${t.id}`)}>
                      <td>{t.tourCode || "—"}</td>
                      <td>{t.tourName}</td>
                      <td>{fmt(t.departureDate)}</td>
                      <td>
                        {t.passengerCount} / {t.seats ?? "—"}
                      </td>
                      <td style={{ fontWeight: 700 }}>{t.seatsLeft}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
