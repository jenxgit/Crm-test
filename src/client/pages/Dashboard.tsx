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
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value num">{value}</div>
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
            style={{ padding: "8px 14px", fontSize: 14, fontWeight: 600, borderRadius: 10 }}
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
          <div className="kpi-grid">
            {stat("Revenue billed", money(data.revenueBilled), <div className="kpi-sub">from completed tours</div>)}
            {stat("Payments received", money(data.paymentsReceived), <div className="kpi-sub">cash in this financial year</div>)}
            {stat(
              "Outstanding balance",
              money(data.outstandingBalance),
              data.overdueBalance > 0 ? (
                <div className="kpi-sub warn">{money(data.overdueBalance)} overdue, tour departed</div>
              ) : undefined,
            )}
            {stat(
              "Total bookings",
              data.totalBookings,
              <div className="kpi-sub">
                {data.toursCompleted} tours completed · {data.toursPlanned} planned
              </div>,
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
                  {data.upcomingTours.map((t) => {
                    const pct = t.seats ? Math.min(100, Math.round((t.passengerCount / t.seats) * 100)) : 0;
                    const nearlyFull = t.seatsLeft != null && t.seatsLeft <= 2;
                    return (
                      <tr key={t.id} className="clickable" onClick={() => navigate(`/tours/${t.id}`)}>
                        <td className="num">{t.tourCode || "—"}</td>
                        <td style={{ fontWeight: 600 }}>{t.tourName}</td>
                        <td>{fmt(t.departureDate)}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
                            <div className={"meter" + (nearlyFull ? " full" : "")} style={{ flex: 1 }}>
                              <span style={{ width: `${pct}%` }} />
                            </div>
                            <span className="num" style={{ fontSize: 13 }}>
                              {t.passengerCount} / {t.seats ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={"badge" + (nearlyFull ? " badge-warn" : "")} style={{ fontWeight: 700 }}>
                            {t.seatsLeft}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
