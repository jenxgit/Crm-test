import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

type Passenger = {
  bookingId: number;
  customerId: number;
  firstName: string;
  lastName: string;
  dietaries: string | null;
};

type TourWithPassengers = {
  id: number;
  tourName: string;
  departureDate: string;
  returnDate: string;
  numDays: number;
  price: number | null;
  totalPassengers: number | null;
  passengers: Passenger[];
};

export default function TourDetail() {
  const { id } = useParams();
  const [tour, setTour] = useState<TourWithPassengers | null>(null);

  useEffect(() => {
    fetch(`/api/tours/${id}`)
      .then((r) => r.json())
      .then(setTour);
  }, [id]);

  if (!tour) return <div className="empty-state">Loading&hellip;</div>;

  return (
    <div>
      <Link to="/tours" className="back-link">
        ← Tours
      </Link>

      <div className="page-header">
        <div>
          <h1>{tour.tourName}</h1>
          <span className="muted">
            {tour.departureDate} → {tour.returnDate} · {tour.numDays} days
            {tour.price != null ? ` · $${tour.price.toLocaleString()} pp` : ""}
          </span>
        </div>
      </div>

      <div>
        <span className="section-title">Passengers ({tour.passengers.length}{tour.totalPassengers ? ` / ${tour.totalPassengers}` : ""})</span>
        <div className="card" style={{ marginTop: 8 }}>
          {tour.passengers.length === 0 ? (
            <div className="empty-state">No one booked on this tour yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Dietaries</th>
                </tr>
              </thead>
              <tbody>
                {tour.passengers.map((p) => (
                  <tr key={p.bookingId}>
                    <td>
                      <Link to={`/customers/${p.customerId}`}>
                        {p.firstName} {p.lastName}
                      </Link>
                    </td>
                    <td>{p.dietaries || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
