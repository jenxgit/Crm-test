import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { api, Tour } from "../lib/api";
import { localDate, localDateOffset } from "../lib/dates";

// Quick navigation between the tours that are running or still to come, like the tabs along the
// bottom of the booking spreadsheet. A tour stays for one day after it returns.
export default function TourTabs() {
  const [tours, setTours] = useState<Tour[]>([]);
  const { pathname } = useLocation();

  // Refetch as you move around so seats left stay current after adding or removing passengers.
  useEffect(() => {
    let cancelled = false;
    api.tours
      .list()
      .then((t) => !cancelled && setTours(t))
      .catch(() => {
        // The strip is a convenience; if the list can't load, just don't show it.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const today = localDate();
  const cutoff = localDateOffset(-1);
  const shown = tours
    .filter((t) => t.returnDate >= cutoff)
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate) || a.id - b.id);

  return (
    <nav className="tour-tabs" aria-label="Upcoming tours">
      {shown.length === 0 && <span className="tour-tabs-empty">No current or upcoming tours</span>}
      {shown.map((t) => {
        const running = t.departureDate <= today && today <= t.returnDate;
        return (
          <NavLink
            key={t.id}
            to={`/tours/${t.id}`}
            className={({ isActive }) => `tour-tab${isActive ? " active" : ""}`}
            title={`${t.tourName} · ${t.departureDate} to ${t.returnDate}${running ? " · running now" : ""}`}
          >
            {running && <span className="tour-tab-dot" aria-label="Running now" />}
            <span className="tour-tab-code">{t.tourCode || t.tourName}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
