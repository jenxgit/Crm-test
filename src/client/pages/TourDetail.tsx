import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EditCell from "../components/EditCell";
import NotesGrid, { emptyGrid, parseGrid, NotesGridValue } from "../components/NotesGrid";
import { api, Customer, Passenger, Room, RoomType, ROOM_TYPES, TourDetail as TourDetailType } from "../lib/api";

const dash = (v: string | null) => v || "—";
const money = (v: number | null) => (v != null ? `$${v.toLocaleString()}` : "—");

const formatDob = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${Number(day)}/${Number(m)}/${y}`;
};

const cell: React.CSSProperties = { padding: "6px 8px", whiteSpace: "nowrap", fontSize: 13 };
const headCell: React.CSSProperties = { ...cell, textAlign: "left", color: "#8B8D97", fontWeight: 600 };
const calcCell: React.CSSProperties = { ...cell, background: "#FAFAF8", color: "#6B6D78" };

// R.Type, Rm, 12 customer fields, Cost, Actions, room-delete.
const COLS = 17;
const roomBorder = "2px solid #B9BBC6";
const rowBorder = "1px solid #EEEEE9";

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

type CustomerField =
  | "title" | "lastName" | "firstName" | "dietaries" | "email" | "phone" | "mobile"
  | "streetAddress" | "suburb" | "state" | "postcode" | "dateOfBirth";

const FIELDS: { key: CustomerField; width: number; type?: string; render: (p: Passenger) => React.ReactNode }[] = [
  { key: "title", width: 56, render: (p) => dash(p.title) },
  {
    key: "lastName",
    width: 120,
    render: (p) => <Link to={`/customers/${p.customerId}`}>{p.lastName}</Link>,
  },
  { key: "firstName", width: 130, render: (p) => p.firstName },
  { key: "dietaries", width: 170, render: (p) => dash(p.dietaries) },
  { key: "email", width: 210, type: "email", render: (p) => dash(p.email) },
  { key: "phone", width: 110, render: (p) => dash(p.phone) },
  { key: "mobile", width: 110, render: (p) => dash(p.mobile) },
  { key: "streetAddress", width: 180, render: (p) => dash(p.streetAddress) },
  { key: "suburb", width: 130, render: (p) => dash(p.suburb) },
  { key: "state", width: 56, render: (p) => dash(p.state) },
  { key: "postcode", width: 64, render: (p) => dash(p.postcode) },
  { key: "dateOfBirth", width: 130, type: "date", render: (p) => formatDob(p.dateOfBirth) },
];

function PassengerCells({
  p,
  cost,
  onRemove,
  onMove,
  moveTargets,
  canUnassign,
  edit,
  onSave,
}: {
  p: Passenger;
  cost: number | null;
  edit: boolean;
  onSave: (customerId: number, field: CustomerField, value: string) => void;
  onRemove: () => void;
  onMove: (roomId: number | null) => void;
  moveTargets: { id: number; label: string }[];
  canUnassign: boolean;
}) {
  return (
    <>
      {FIELDS.map((f) => (
        <td key={f.key} style={cell}>
          {edit ? (
            <EditCell
              value={(p[f.key] as string | null) ?? null}
              width={f.width}
              type={f.type}
              onSave={(v) => onSave(p.customerId, f.key, v)}
            />
          ) : (
            f.render(p)
          )}
        </td>
      ))}
      <td style={calcCell}>{money(cost)}</td>
      <td style={{ ...cell, textAlign: "right" }}>
        {moveTargets.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && onMove(Number(e.target.value))}
            style={{ fontSize: 12, marginRight: 6 }}
          >
            <option value="">Move to room…</option>
            {moveTargets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        {canUnassign && (
          <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12, marginRight: 6 }} onClick={() => onMove(null)}>
            Unassign
          </button>
        )}
        <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={onRemove}>
          Remove
        </button>
      </td>
    </>
  );
}

export default function TourDetail() {
  const { id } = useParams();
  const tourId = Number(id);
  const [tour, setTour] = useState<TourDetailType | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newRoomType, setNewRoomType] = useState<RoomType>("Twin");
  const [adding, setAdding] = useState<number | "unassigned" | null>(null);
  const [pick, setPick] = useState("");
  const [edit, setEdit] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<number | null>(null);
  const [notes, setNotes] = useState<NotesGridValue>(emptyGrid());

  const load = () => {
    api.tours.get(tourId).then(setTour);
  };

  useEffect(() => {
    load();
    api.customers.list().then(setCustomers);
  }, [tourId]);

  // Re-sync from the server only when the saved notes actually change, so an unrelated
  // reload (e.g. adding a passenger) doesn't clobber notes being typed right now.
  useEffect(() => {
    if (tour) setNotes(parseGrid(tour.notes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.notes]);

  if (!tour) return <div className="empty-state">Loading&hellip;</div>;

  // Twin-share price is the tour's base price; Single rooms add the single supplement.
  const passengerCost = (roomType: RoomType | null): number | null => {
    if (tour.price == null) return null;
    return roomType === "Single" ? tour.price + (tour.singleSupp ?? 0) : tour.price;
  };

  const commitNotes = () => act(() => api.tours.update(tourId, { notes: JSON.stringify(notes) }));

  // Run a change, surface any server-side rule (e.g. "room is full"), then refresh.
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^\d+ [^:]*: /, "").replace(/^\{"error":"(.*)"\}$/, "$1") : String(e));
    }
    load();
  };

  // Edits here update the customer record itself, so they show on every tour the person is on.
  const saveField = (customerId: number, field: CustomerField, value: string) => {
    if ((field === "firstName" || field === "lastName") && !value.trim()) {
      setError("First and last name can't be empty");
      load();
      return;
    }
    act(() => api.customers.update(customerId, { [field]: value.trim() === "" ? null : value.trim() } as Partial<Customer>));
  };

  const onTour = new Set(tour.passengers.map((p) => p.customerId));
  const available = customers
    .filter((c) => !onTour.has(c.id))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const labelFor = (c: Customer) => `${c.lastName}, ${c.firstName}`;

  const addPassenger = async (roomId: number | null) => {
    const match = available.find((c) => labelFor(c) === pick);
    if (!match) {
      setError("Pick a customer from the list");
      return;
    }
    await act(() => api.bookings.create({ customerId: match.id, tourId, roomId }));
    setPick("");
    setAdding(null);
  };

  const openRooms = tour.rooms.filter((r) => r.passengers.length < r.capacity);
  const targetsFor = (excludeRoomId?: number) =>
    openRooms
      .filter((r) => r.id !== excludeRoomId)
      .map((r) => ({ id: r.id, label: `Room ${tour.rooms.indexOf(r) + 1} (${r.roomType}, ${r.passengers.length}/${r.capacity})` }));

  const stat = (label: string, value: React.ReactNode) => (
    <div>
      <div className="label" style={{ fontSize: 12, color: "#8B8D97" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );

  const typeCounts = ROOM_TYPES.map((t) => [t, tour.rooms.filter((r) => r.roomType === t).length] as const);

  // Inline "add passenger" row. Inside a room it sits under the room's rowSpan cells.
  const addRow = (roomId: number | null, key: number | "unassigned", wide: boolean) =>
    adding === key ? (
      <tr key={`add-${key}`} style={{ borderTop: rowBorder }}>
        <td colSpan={wide ? COLS : COLS - 3} style={{ ...cell, background: "#FAFAF8" }}>
          <input
            list="available-customers"
            placeholder="Search customer (surname, first name)"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            style={{ width: 320, marginRight: 8 }}
            autoFocus
          />
          <button className="btn btn-primary" style={{ padding: "4px 12px" }} onClick={() => addPassenger(roomId)}>
            Add
          </button>{" "}
          <button className="btn btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setAdding(null)}>
            Cancel
          </button>
        </td>
      </tr>
    ) : null;

  return (
    <div>
      <Link to="/tours" className="back-link">
        ← Tours
      </Link>

      <div className="page-header">
        <div>
          <h1>
            {tour.tourCode ? `${tour.tourCode} · ` : ""}
            {tour.tourName}
          </h1>
          <span className="muted">
            {tour.departureDate} → {tour.returnDate} · {tour.numDays} days
            {tour.price != null ? ` · $${tour.price.toLocaleString()} pp` : ""}
            {tour.singleSupp != null ? ` · $${tour.singleSupp.toLocaleString()} single supp` : ""}
            {tour.price != null || tour.singleSupp != null ? ` · $${(tour.total ?? 0).toLocaleString()} total` : ""}
          </span>
        </div>
      </div>

      <div className="card" style={{ display: "flex", gap: 40, padding: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {stat("Seats", tour.seats ?? "—")}
        {stat("Passengers", tour.passengerCount)}
        {stat("Seats left", tour.seatsLeft ?? "—")}
        {stat("Rooms", tour.numRooms ?? "—")}
        {stat("Rooms used", tour.roomCount)}
        {stat("Rooms left", tour.roomsLeft ?? "—")}
        {stat("Pay 1 due", formatDob(tour.pay1Date))}
        {stat("Pay 2 due", formatDob(tour.pay2Date))}
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#4A4C55" }}>
          {typeCounts.map(([t, n]) => (
            <div key={t}>
              {t}: <b>{n}</b>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "#FDECEA", color: "#B42318", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <datalist id="available-customers">
        {available.map((c) => (
          <option key={c.id} value={labelFor(c)} />
        ))}
      </datalist>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="section-title">Rooms &amp; passengers</span>
        <button
          className={edit ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setEdit(!edit)}
          title="Edit customer details directly in the table"
        >
          {edit ? "Datasheet view: on" : "Datasheet view"}
        </button>
        {edit && <span className="muted">Changes save when you leave a cell and update the customer everywhere.</span>}
        <span style={{ marginLeft: "auto" }} />
        <select value={newRoomType} onChange={(e) => setNewRoomType(e.target.value as RoomType)}>
          {ROOM_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => act(() => api.rooms.create({ tourId, roomType: newRoomType }))}>
          + Add room
        </button>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["R.Type", "Rm", "Title", "Surname", "Name", "Dietary", "Email", "Phone", "Mobile", "Address", "Suburb", "State", "PC", "DOB", "Cost", "", ""].map((h) => (
                <th key={h} style={headCell}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tour.rooms.length === 0 && tour.unassigned.length === 0 && (
              <tr>
                <td colSpan={COLS}>
                  <div className="empty-state">No rooms or passengers yet.</div>
                </td>
              </tr>
            )}

            {tour.rooms.map((room: Room, i) => {
              const n = room.passengers.length;
              const full = n >= room.capacity;
              const isAdding = adding === room.id;
              const span = Math.max(n, 1) + (isAdding ? 1 : 0);
              const rows: (Passenger | null)[] = n === 0 ? [null] : room.passengers;
              const trs = rows.map((p, j) => (
                <tr key={p ? p.bookingId : `empty-${room.id}`} style={{ borderTop: j === 0 ? roomBorder : rowBorder }}>
                  {j === 0 && (
                    <>
                      <td
                        rowSpan={span}
                        style={{ ...cell, textAlign: "center", verticalAlign: "middle", borderRight: rowBorder, background: "#FAFAF8" }}
                      >
                        <select
                          value={room.roomType}
                          onChange={(e) => act(() => api.rooms.setType(room.id, e.target.value as RoomType))}
                          style={{ fontSize: 12, fontWeight: 700, color: "#4F6BFF" }}
                        >
                          {ROOM_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t.toUpperCase()}
                            </option>
                          ))}
                        </select>
                        {!full && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "1px 8px", fontSize: 12, marginTop: 4 }}
                            onClick={() => {
                              setPick("");
                              setAdding(room.id);
                            }}
                          >
                            + Add
                          </button>
                        )}
                      </td>
                      <td
                        rowSpan={span}
                        style={{ ...cell, textAlign: "center", verticalAlign: "middle", fontWeight: 700, borderRight: rowBorder }}
                      >
                        {i + 1}
                      </td>
                    </>
                  )}
                  {p ? (
                    <PassengerCells
                      p={p}
                      cost={passengerCost(room.roomType)}
                      onRemove={() => act(() => api.bookings.remove(p.bookingId))}
                      onMove={(roomId) => act(() => api.bookings.setRoom(p.bookingId, roomId))}
                      moveTargets={targetsFor(room.id)}
                      canUnassign
                      edit={edit}
                      onSave={saveField}
                    />
                  ) : (
                    <td colSpan={COLS - 3} style={{ ...cell, color: "#8B8D97" }}>
                      Empty room
                    </td>
                  )}
                  {j === 0 && (
                    <td
                      rowSpan={span}
                      style={{ ...cell, textAlign: "center", verticalAlign: "middle", borderLeft: rowBorder }}
                    >
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "3px 6px", display: "inline-flex" }}
                        title="Delete room"
                        onClick={() => setConfirmDeleteRoom(room.id)}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  )}
                </tr>
              ));
              return [...trs, ...(isAdding ? [addRow(room.id, room.id, false)] : [])];
            })}

            <tr style={{ borderTop: roomBorder }}>
              <td colSpan={COLS} style={{ ...cell, background: "#F1F1EC", fontWeight: 700 }}>
                Not in a room ({tour.unassigned.length})
                <button
                  className="btn btn-secondary"
                  style={{ padding: "2px 10px", fontSize: 12, marginLeft: 12 }}
                  onClick={() => {
                    setPick("");
                    setAdding("unassigned");
                  }}
                >
                  + Add passenger
                </button>
              </td>
            </tr>
            {tour.unassigned.map((p) => (
              <tr key={p.bookingId} style={{ borderTop: rowBorder }}>
                <td colSpan={2} />
                <PassengerCells
                  p={p}
                  cost={passengerCost(null)}
                  onRemove={() => act(() => api.bookings.remove(p.bookingId))}
                  onMove={(roomId) => act(() => api.bookings.setRoom(p.bookingId, roomId))}
                  moveTargets={targetsFor()}
                  canUnassign={false}
                  edit={edit}
                  onSave={saveField}
                />
                <td />
              </tr>
            ))}
            {addRow(null, "unassigned", true)}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", marginTop: 20 }}>
        <div style={{ width: "33%", minWidth: 280 }}>
          <span className="section-title">Notes</span>
          <div className="card" style={{ marginTop: 8, minHeight: 120 }}>
            <NotesGrid value={notes} onChange={setNotes} onCommit={commitNotes} />
          </div>
        </div>
      </div>

      {confirmDeleteRoom != null && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteRoom(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete this room?</h2>
            <p>
              Room {tour.rooms.findIndex((r) => r.id === confirmDeleteRoom) + 1} will be removed. Its passengers stay
              booked on the tour but become unassigned.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteRoom(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  act(() => api.rooms.remove(confirmDeleteRoom));
                  setConfirmDeleteRoom(null);
                }}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
