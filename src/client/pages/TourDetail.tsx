import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import EditCell from "../components/EditCell";
// The spreadsheet is large, so it's only loaded when someone opens it.
const NotesSheet = lazy(() => import("../components/NotesSheet"));
import NotesGrid, { emptyGrid, parseGrid, NotesGridValue } from "../components/NotesGrid";
import {
  api,
  Customer,
  Passenger,
  Room,
  RoomType,
  ROOM_TYPES,
  Cancellation,
  StaffRole,
  STAFF_ROLES,
  TourDetail as TourDetailType,
  TourStaff,
  WaitlistEntry,
} from "../lib/api";
import { localDate } from "../lib/dates";
import InvoiceDrawer from "../components/InvoiceDrawer";

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

// R.Type, Rm, 12 customer fields, Cost, Payments, Balance due, Invoice, Actions, room-delete.
const COLS = 20;
const roomBorder = "2px solid #B9BBC6";
const rowBorder = "1px solid #EEEEE9";

// A wide card whose horizontal scrollbar floats at the bottom of the browser window while the
// table is on screen, so you never have to scroll to the end of a long tour to reach it.
// The native bar is hidden; a sticky proxy bar below the card is kept in sync with it.
function FloatingHScroll({ children }: { children: React.ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      setContentWidth(body.scrollWidth);
      setOverflowing(body.scrollWidth > body.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    if (body.firstElementChild) ro.observe(body.firstElementChild);
    return () => ro.disconnect();
  }, []);

  // Setting an equal value doesn't fire another scroll event, so the two bars can't ping-pong.
  const mirror = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (from && to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
  };

  return (
    <div>
      <div
        ref={bodyRef}
        className="card"
        style={{ overflowX: "auto", scrollbarWidth: "none" }}
        onScroll={() => mirror(bodyRef.current, barRef.current)}
      >
        {children}
      </div>
      <div
        ref={barRef}
        onScroll={() => mirror(barRef.current, bodyRef.current)}
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 5,
          overflowX: "scroll",
          overflowY: "hidden",
          height: overflowing ? 16 : 0,
          background: "#FFFFFF",
          borderTop: overflowing ? "1px solid #E4E4DE" : "none",
        }}
      >
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
    </div>
  );
}

// Cancelled passengers, listed below the notes like the sheet. Each keeps their details, who they
// were sharing with, a date and a note. Reactivate puts them back on the tour.
function CancellationsSection({
  entries,
  onOpenInvoice,
  onNote,
  onReactivate,
  onDelete,
}: {
  entries: Cancellation[];
  onOpenInvoice: (invoiceId: number) => void;
  onNote: (bookingId: number, date: string | null, note: string) => void;
  onReactivate: (bookingId: number) => void;
  onDelete: (e: Cancellation) => void;
}) {
  if (entries.length === 0) return null;
  const th: React.CSSProperties = { ...headCell, padding: "4px 8px" };
  const td: React.CSSProperties = { padding: "6px 8px", fontSize: 13, verticalAlign: "top" };
  const address = (e: Cancellation) =>
    [e.streetAddress, e.suburb, [e.state, e.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <div style={{ marginTop: 20 }}>
      <span className="section-title">Cancellations</span>
      <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
        {entries.length}
      </span>
      <div className="card" style={{ marginTop: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Cancelled", "Name", "Phone", "Email", "Address", "Was in", "Invoice", "Note", ""].map((h, i) => (
                <th key={i} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.bookingId} style={{ borderTop: rowBorder }}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{formatDob(e.cancelledDate)}</td>
                <td style={{ ...td, whiteSpace: "nowrap", color: "#B3261E", fontWeight: 600 }}>
                  <Link to={`/customers/${e.customerId}`} style={{ color: "inherit" }}>
                    {e.title ? `${e.title} ` : ""}
                    {e.firstName} {e.lastName}
                  </Link>
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{dash(e.mobile || e.phone)}</td>
                <td style={td}>{dash(e.email)}</td>
                <td style={td}>{address(e) || "—"}</td>
                <td style={td}>
                  {e.cancelledRoomType ?? "—"}
                  {e.sharedWith.length > 0 && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      with {e.sharedWith.join(", ")}
                    </div>
                  )}
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {e.invoiceId != null ? (
                    <Link
                      to={`/invoices/${e.invoiceId}`}
                      onClick={(ev) => {
                        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
                        ev.preventDefault();
                        onOpenInvoice(e.invoiceId!);
                      }}
                    >
                      {e.invoiceNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ ...td, width: "100%" }}>
                  <input
                    key={`${e.bookingId}-${e.cancelNote ?? ""}`}
                    defaultValue={e.cancelNote ?? ""}
                    placeholder="Note"
                    style={{ width: "100%", minWidth: 180, boxSizing: "border-box", fontSize: 13 }}
                    onBlur={(ev) =>
                      ev.target.value.trim() !== (e.cancelNote ?? "") && onNote(e.bookingId, e.cancelledDate, ev.target.value)
                    }
                    onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                  />
                </td>
                <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "2px 8px", fontSize: 12, marginRight: 6 }}
                    onClick={() => onReactivate(e.bookingId)}
                  >
                    Reactivate
                  </button>
                  <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => onDelete(e)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Hostess and driver: each is allocated their own room, which counts toward the tour's rooms.
function StaffSection({
  staff,
  onAdd,
  onUpdate,
  onRemove,
}: {
  staff: TourStaff[];
  onAdd: (role: StaffRole) => void;
  onUpdate: (id: number, data: { role?: StaffRole; name?: string }) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div style={{ width: "33%", minWidth: 340 }}>
      <span className="section-title">Hostess &amp; driver</span>
      <div className="card" style={{ marginTop: 8, padding: 12 }}>
        {staff.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No hostess or driver allocated.</div>}
        {staff.map((s) => (
          <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <select
              value={s.role}
              onChange={(e) => onUpdate(s.id, { role: e.target.value as StaffRole })}
              style={{ fontWeight: 700, width: 100 }}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <input
              key={`${s.id}-${s.name ?? ""}`}
              defaultValue={s.name ?? ""}
              placeholder="TBC"
              style={{ flex: 1, minWidth: 0 }}
              onBlur={(e) => e.target.value.trim() !== (s.name ?? "") && onUpdate(s.id, { name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>1 room</span>
            <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => onRemove(s.id)}>
              Remove
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: staff.length ? 4 : 8 }}>
          {STAFF_ROLES.map((r) => (
            <button key={r} className="btn btn-secondary" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => onAdd(r)}>
              + {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Waitlist: who is waiting for a seat, how many people, and when they asked. Sits beside the
// hostess & driver box. Contacts come from the customer records.
function WaitlistSection({
  entries,
  customers,
  onAdd,
  onAddNew,
  onUpdate,
  onRemove,
  onError,
}: {
  entries: WaitlistEntry[];
  customers: Customer[];
  onAdd: (data: { customerId: number; dateAdded: string; pax: number; note: string }) => void;
  // Creates a new customer record first, then puts them on the waitlist.
  onAddNew: (
    customer: { firstName: string; lastName: string; mobile: string; email: string },
    data: { dateAdded: string; pax: number; note: string },
  ) => void;
  onUpdate: (id: number, data: { dateAdded?: string; pax?: number; note?: string; done?: boolean }) => void;
  onRemove: (id: number) => void;
  onError: (message: string) => void;
}) {
  const today = localDate();
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [date, setDate] = useState(today);
  const [pax, setPax] = useState("1");
  const [note, setNote] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [nFirst, setNFirst] = useState("");
  const [nLast, setNLast] = useState("");
  const [nMobile, setNMobile] = useState("");
  const [nEmail, setNEmail] = useState("");

  const label = (c: { lastName: string; firstName: string }) => `${c.lastName}, ${c.firstName}`;
  const waiting = new Set(entries.map((e) => e.customerId));
  const options = customers
    .filter((c) => !waiting.has(c.id))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  const reset = () => {
    setAdding(false);
    setPick("");
    setDate(today);
    setPax("1");
    setNote("");
    setIsNew(false);
    setNFirst("");
    setNLast("");
    setNMobile("");
    setNEmail("");
  };
  const submit = () => {
    if (isNew) {
      if (!nFirst.trim() || !nLast.trim()) {
        onError("Enter the new customer's first and last name");
        return;
      }
      onAddNew(
        { firstName: nFirst.trim(), lastName: nLast.trim(), mobile: nMobile.trim(), email: nEmail.trim() },
        { dateAdded: date || today, pax: Math.max(1, Number(pax) || 1), note },
      );
      reset();
      return;
    }
    const match = options.find((c) => label(c) === pick);
    if (!match) {
      onError("Pick a customer from the list");
      return;
    }
    onAdd({ customerId: match.id, dateAdded: date || today, pax: Math.max(1, Number(pax) || 1), note });
    reset();
  };

  // Done entries stay on the list (struck through, at the bottom) and don't count as waiting.
  const waitingEntries = entries.filter((e) => !e.done);
  const total = waitingEntries.reduce((sum, e) => sum + e.pax, 0);
  const sorted = [...waitingEntries, ...entries.filter((e) => e.done)];
  // Inputs inherit the row's strikethrough/colour so a done entry reads as done all the way across.
  const input: React.CSSProperties = { fontSize: 13, textDecoration: "inherit", color: "inherit" };
  const th: React.CSSProperties = { ...headCell, padding: "4px 6px" };
  const td: React.CSSProperties = { padding: "4px 6px", fontSize: 13, verticalAlign: "middle" };

  return (
    <div style={{ flex: 1, minWidth: 420 }}>
      <span className="section-title">Waitlist</span>
      <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
        {waitingEntries.length} waiting · {total} pax
        {entries.length > waitingEntries.length && ` · ${entries.length - waitingEntries.length} done`}
      </span>
      <div className="card" style={{ marginTop: 8, padding: 12, overflowX: "auto" }}>
        <datalist id="waitlist-customers">
          {options.map((c) => (
            <option key={c.id} value={label(c)} />
          ))}
        </datalist>
        {entries.length === 0 && !adding && (
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Nobody on the waitlist.</div>
        )}
        {(entries.length > 0 || adding) && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Done</th>
                <th style={th}>Date added</th>
                <th style={th}>Contact</th>
                <th style={th}>PAX</th>
                <th style={{ ...th, width: "100%" }}>Note</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr
                  key={e.id}
                  style={{
                    borderTop: rowBorder,
                    textDecoration: e.done ? "line-through" : undefined,
                    color: e.done ? "#B3261E" : undefined,
                  }}
                >
                  <td style={{ ...td, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      title={e.done ? "Mark as waiting again" : "Mark as done"}
                      checked={e.done}
                      onChange={(ev) => onUpdate(e.id, { done: ev.target.checked })}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="date"
                      key={`${e.id}-${e.dateAdded}`}
                      defaultValue={e.dateAdded}
                      style={input}
                      onBlur={(ev) => ev.target.value && ev.target.value !== e.dateAdded && onUpdate(e.id, { dateAdded: ev.target.value })}
                    />
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <Link to={`/customers/${e.customerId}`} style={e.done ? { color: "inherit" } : undefined}>
                      {e.firstName} {e.lastName}
                    </Link>
                    {(e.mobile || e.phone) && (
                      <div className="muted" style={{ fontSize: 12 }}>{e.mobile || e.phone}</div>
                    )}
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      min={1}
                      key={`${e.id}-${e.pax}`}
                      defaultValue={e.pax}
                      style={{ ...input, width: 56 }}
                      onBlur={(ev) => Number(ev.target.value) !== e.pax && onUpdate(e.id, { pax: Number(ev.target.value) })}
                    />
                  </td>
                  <td style={td}>
                    <input
                      key={`${e.id}-${e.note ?? ""}`}
                      defaultValue={e.note ?? ""}
                      placeholder="Note"
                      style={{ ...input, width: "100%", minWidth: 140, boxSizing: "border-box" }}
                      onBlur={(ev) => ev.target.value.trim() !== (e.note ?? "") && onUpdate(e.id, { note: ev.target.value })}
                      onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                    />
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => onRemove(e.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {adding && (
                <tr style={{ borderTop: rowBorder, background: "#FAFAF8" }}>
                  <td style={td} />
                  <td style={td}>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
                  </td>
                  <td style={td}>
                    {isNew ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <input
                          placeholder="First name"
                          value={nFirst}
                          onChange={(e) => setNFirst(e.target.value)}
                          style={{ ...input, width: 220 }}
                          autoFocus
                        />
                        <input
                          placeholder="Last name"
                          value={nLast}
                          onChange={(e) => setNLast(e.target.value)}
                          style={{ ...input, width: 220 }}
                        />
                        <input
                          placeholder="Mobile (optional)"
                          value={nMobile}
                          onChange={(e) => setNMobile(e.target.value)}
                          style={{ ...input, width: 220 }}
                        />
                        <input
                          type="email"
                          placeholder="Email (optional)"
                          value={nEmail}
                          onChange={(e) => setNEmail(e.target.value)}
                          style={{ ...input, width: 220 }}
                        />
                      </div>
                    ) : (
                      <input
                        list="waitlist-customers"
                        placeholder="Search customer (surname, first name)"
                        value={pick}
                        onChange={(e) => setPick(e.target.value)}
                        style={{ ...input, width: 220 }}
                        autoFocus
                      />
                    )}
                    <div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "0 8px", fontSize: 11, marginTop: 4 }}
                        onClick={() => setIsNew(!isNew)}
                      >
                        {isNew ? "← Existing customer" : "+ New customer"}
                      </button>
                    </div>
                  </td>
                  <td style={td}>
                    <input type="number" min={1} value={pax} onChange={(e) => setPax(e.target.value)} style={{ ...input, width: 56 }} />
                  </td>
                  <td style={td}>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note"
                      style={{ ...input, width: "100%", minWidth: 140, boxSizing: "border-box" }}
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                    />
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-primary" style={{ padding: "2px 10px", fontSize: 12, marginRight: 6 }} onClick={submit}>
                      Add
                    </button>
                    <button className="btn btn-secondary" style={{ padding: "2px 10px", fontSize: 12 }} onClick={reset}>
                      Cancel
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {!adding && (
          <button className="btn btn-secondary" style={{ padding: "2px 10px", fontSize: 12, marginTop: entries.length ? 8 : 0 }} onClick={() => setAdding(true)}>
            + Add to waitlist
          </button>
        )}
      </div>
    </div>
  );
}

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

// Lets a passenger row join an existing invoice on this tour, or start a new one.
function InvoiceCell({
  p,
  tourInvoices,
  onCreate,
  onAttach,
  onDetach,
  onOpen,
}: {
  p: Passenger;
  tourInvoices: { id: number; invoiceNumber: string }[];
  onOpen: (invoiceId: number) => void;
  onCreate: (bookingId: number, invoiceNumber: string) => void;
  onAttach: (bookingId: number, invoiceId: number) => void;
  onDetach: (bookingId: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState("new");
  const [newNumber, setNewNumber] = useState("");

  if (p.invoiceId != null) {
    return (
      <td style={cell}>
        {/* Opens the invoice in a slide-over; ctrl/cmd/middle-click still opens the full page. */}
        <Link
          to={`/invoices/${p.invoiceId}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onOpen(p.invoiceId!);
          }}
        >
          {p.invoiceNumber}
        </Link>{" "}
        <button
          className="btn btn-secondary"
          style={{ padding: "0 6px", fontSize: 11 }}
          title="Remove from invoice"
          onClick={() => onDetach(p.bookingId)}
        >
          ×
        </button>
      </td>
    );
  }

  if (!editing) {
    return (
      <td style={cell}>
        <button className="btn btn-secondary" style={{ padding: "1px 6px", fontSize: 11 }} onClick={() => setEditing(true)}>
          + Invoice
        </button>
      </td>
    );
  }

  const confirm = () => {
    if (choice === "new") {
      if (!newNumber.trim()) return;
      onCreate(p.bookingId, newNumber.trim());
    } else {
      onAttach(p.bookingId, Number(choice));
    }
    setEditing(false);
    setNewNumber("");
    setChoice("new");
  };

  return (
    <td style={cell}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} style={{ fontSize: 11 }}>
          <option value="new">New invoice…</option>
          {tourInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              Join {inv.invoiceNumber}
            </option>
          ))}
        </select>
        {choice === "new" && (
          <input
            autoFocus
            placeholder="Invoice #"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            style={{ width: 90, fontSize: 11 }}
          />
        )}
        <button className="btn btn-primary" style={{ padding: "1px 6px", fontSize: 11 }} onClick={confirm}>
          ✓
        </button>
        <button className="btn btn-secondary" style={{ padding: "1px 6px", fontSize: 11 }} onClick={() => setEditing(false)}>
          ×
        </button>
      </div>
    </td>
  );
}

// This passenger's share of their invoice's payments, and what they still owe.
function InvoiceTotalsCells({ p }: { p: Passenger }) {
  const linked = p.invoiceId != null;
  return (
    <>
      <td style={{ ...calcCell, textAlign: "right" }}>{linked ? money(p.paymentsTotal) : "—"}</td>
      <td
        style={{
          ...calcCell,
          textAlign: "right",
          fontWeight: 600,
          color: linked && (p.balanceDue ?? 0) > 0 ? "#B3261E" : calcCell.color,
        }}
      >
        {linked ? money(p.balanceDue) : "—"}
      </td>
    </>
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
  onCancel,
  onMove,
  moveTargets,
  canUnassign,
  edit,
  onSave,
  invoiceCell,
}: {
  p: Passenger;
  invoiceCell: React.ReactNode;
  cost: number | null;
  edit: boolean;
  onSave: (customerId: number, field: CustomerField, value: string) => void;
  onRemove: () => void; // delete from the tour (asks first)
  onCancel: () => void;
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
      <InvoiceTotalsCells p={p} />
      {invoiceCell}
      <td style={{ ...cell, textAlign: "right" }}>
        {/* One dropdown for everything you can do to a passenger. It always snaps back to "Actions". */}
        <select
          value=""
          aria-label={`Actions for ${p.firstName} ${p.lastName}`}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("move:")) onMove(Number(v.slice(5)));
            else if (v === "unassign") onMove(null);
            else if (v === "cancel") onCancel();
            else if (v === "delete") onRemove();
          }}
          style={{ fontSize: 12 }}
        >
          <option value="">Actions…</option>
          {moveTargets.length > 0 && (
            <optgroup label="Move to room">
              {moveTargets.map((t) => (
                <option key={t.id} value={`move:${t.id}`}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          )}
          {canUnassign && <option value="unassign">Unassign from room</option>}
          <option value="cancel">Cancel booking</option>
          <option value="delete">Delete from tour…</option>
        </select>
      </td>
    </>
  );
}

export default function TourDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sheetMode = searchParams.get("sheet") === "1";
  const tourId = Number(id);
  const [tour, setTour] = useState<TourDetailType | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newRoomType, setNewRoomType] = useState<RoomType>("Twin");
  const [adding, setAdding] = useState<number | "unassigned" | null>(null);
  const [pick, setPick] = useState("");
  const [edit, setEdit] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<number | null>(null);
  const [openInvoice, setOpenInvoice] = useState<number | null>(null);
  // Passenger being cancelled / deleted (dialogs below), and the cancel form values.
  const [cancelTarget, setCancelTarget] = useState<{ bookingId: number; name: string } | null>(null);
  const [cancelDate, setCancelDate] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ bookingId: number; name: string } | null>(null);
  const [notes, setNotes] = useState<NotesGridValue>(emptyGrid());

  const load = () => {
    api.tours.get(tourId).then(setTour);
  };

  useEffect(() => {
    load();
    api.customers.list().then(setCustomers);
  }, [tourId]);

  // The notes JSON this page last sent to the server, and a queue so saves go out in order.
  const lastSavedNotes = useRef<string | null>(null);
  const notesQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    lastSavedNotes.current = null; // a different tour: forget what we last saved
  }, [tourId]);

  // Re-sync from the server only when the notes were changed somewhere else. Our own saves are
  // skipped: otherwise a slow save finishing while you type in the next cell would reset the grid
  // to the older saved copy and wipe what you've just typed.
  useEffect(() => {
    if (!tour) return;
    if (tour.notes !== null && tour.notes === lastSavedNotes.current) return;
    setNotes(parseGrid(tour.notes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.notes]);

  if (!tour) return <div className="empty-state">Loading&hellip;</div>;

  // Twin-share price is the tour's base price; Single rooms add the single supplement.
  const passengerCost = (roomType: RoomType | null): number | null => {
    if (tour.price == null) return null;
    return roomType === "Single" ? tour.price + (tour.singleSupp ?? 0) : tour.price;
  };

  // Pass the new grid when saving right after a change; state hasn't updated yet at that point.
  const commitNotes = (next?: NotesGridValue) => saveNotesJson(JSON.stringify(next ?? notes));
  const saveNotesJson = (json: string) => {
    if (json === lastSavedNotes.current || (lastSavedNotes.current === null && json === tour.notes)) return;
    lastSavedNotes.current = json;
    notesQueue.current = notesQueue.current
      .then(() => api.tours.update(tourId, { notes: json }))
      .catch(() => {
        lastSavedNotes.current = null;
        setError("Couldn't save the notes. Check your connection and try again.");
      });
  };

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

  const openCancel = (bookingId: number, name: string, date?: string | null, note?: string | null) => {
    setCancelTarget({ bookingId, name });
    setCancelDate(date || localDate());
    setCancelNote(note ?? "");
  };
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const { bookingId } = cancelTarget;
    setCancelTarget(null);
    await act(() => api.bookings.cancel(bookingId, { date: cancelDate || localDate(), note: cancelNote }));
  };

  const onTour = new Set([...tour.passengers, ...tour.cancellations].map((p) => p.customerId));
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

  // Invoices already used on this tour, so a passenger can join one instead of starting a new one.
  const tourInvoicesMap = new Map<number, string>();
  tour.passengers.forEach((p) => {
    if (p.invoiceId != null && p.invoiceNumber) tourInvoicesMap.set(p.invoiceId, p.invoiceNumber);
  });
  const tourInvoices = [...tourInvoicesMap.entries()].map(([invId, invoiceNumber]) => ({ id: invId, invoiceNumber }));

  const createInvoice = (bookingId: number, invoiceNumber: string) =>
    act(() => api.invoices.create({ invoiceNumber, bookingIds: [bookingId] }));
  const attachInvoice = (bookingId: number, invId: number) => act(() => api.bookings.setInvoice(bookingId, invId));
  const detachInvoice = (bookingId: number) => act(() => api.bookings.setInvoice(bookingId, null));

  // A label/value row in the summary card; a dot colour marks a payment date as past (teal) or still to come (orange).
  const detailRow = (label: string, value: React.ReactNode, dot?: string) => (
    <div className="detail-row" key={label}>
      {dot && <span className="dot" style={{ background: dot }} />}
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
  const dueColor = (d: string | null) => (d && d < localDate() ? "#0B6E6E" : "#C2410C");

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

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="tour-summary-row">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 14px", minWidth: 0 }}>
            {tour.tourCode && <span className="badge num">{tour.tourCode}</span>}
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{tour.tourName}</h1>
            <span className="muted">
              {formatDob(tour.departureDate)} → {formatDob(tour.returnDate)} · {tour.numDays} days
            </span>
          </div>
          <div className="tour-meters">
            <div className="meter-item">
              <span>Seats</span>
              <div className={"meter" + (tour.seatsLeft === 0 ? " full" : "")} style={{ width: 110 }}>
                <span style={{ width: `${tour.seats ? Math.min(100, (tour.passengerCount / tour.seats) * 100) : 0}%` }} />
              </div>
              <span className="num" style={{ color: "#1B2A38" }}>
                {tour.passengerCount} / {tour.seats ?? "—"}
              </span>
            </div>
            <div className="meter-item">
              <span>Rooms</span>
              <div className="meter" style={{ width: 80 }}>
                <span style={{ width: `${tour.numRooms ? Math.min(100, (tour.roomCount / tour.numRooms) * 100) : 0}%` }} />
              </div>
              <span className="num" style={{ color: "#1B2A38" }}>
                {tour.roomCount} / {tour.numRooms ?? "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="tour-details">
          <div className="tour-details-col">
            <div className="tour-details-title">Price</div>
            {detailRow("Price per person", money(tour.price))}
            {detailRow("Single supplement", money(tour.singleSupp))}
            {detailRow("Total (single)", money(tour.total))}
          </div>
          <div className="tour-details-col">
            <div className="tour-details-title">Payment dates</div>
            {detailRow("Pay 1 due", formatDob(tour.pay1Date), dueColor(tour.pay1Date))}
            {detailRow("Pay 2 due", formatDob(tour.pay2Date), dueColor(tour.pay2Date))}
          </div>
          <div className="tour-details-col">
            <div className="tour-details-title">Availability</div>
            {detailRow("Seats left", tour.seatsLeft ?? "—")}
            {detailRow("Rooms left", tour.roomsLeft ?? "—")}
          </div>
          <div className="tour-details-col">
            <div className="tour-details-title">Room types</div>
            {typeCounts.map(([t, n]) => detailRow(t, n))}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FCEBE7", color: "#A4361F", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
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

      <FloatingHScroll>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["R.Type", "Rm", "Title", "Surname", "Name", "Dietary", "Email", "Phone", "Mobile", "Address", "Suburb", "State", "PC", "DOB", "Cost", "Payments", "Balance due", "Invoice", "Actions", ""].map((h, i) => (
                <th key={i} style={headCell}>
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
                          style={{ fontSize: 12, fontWeight: 700, color: "#0B6E6E" }}
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
                    <>
                      <PassengerCells
                        p={p}
                        cost={passengerCost(room.roomType)}
                        onRemove={() => setDeleteTarget({ bookingId: p.bookingId, name: `${p.firstName} ${p.lastName}` })}
                  onCancel={() => openCancel(p.bookingId, `${p.firstName} ${p.lastName}`)}
                        onMove={(roomId) => act(() => api.bookings.setRoom(p.bookingId, roomId))}
                        moveTargets={targetsFor(room.id)}
                        canUnassign
                        edit={edit}
                        onSave={saveField}
                        invoiceCell={
                          <InvoiceCell
                            p={p}
                            tourInvoices={tourInvoices}
                            onCreate={createInvoice}
                            onAttach={attachInvoice}
                            onDetach={detachInvoice}
                            onOpen={setOpenInvoice}
                          />
                        }
                      />
                    </>
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
                  onRemove={() => setDeleteTarget({ bookingId: p.bookingId, name: `${p.firstName} ${p.lastName}` })}
                  onCancel={() => openCancel(p.bookingId, `${p.firstName} ${p.lastName}`)}
                  onMove={(roomId) => act(() => api.bookings.setRoom(p.bookingId, roomId))}
                  moveTargets={targetsFor()}
                  canUnassign={false}
                  edit={edit}
                  onSave={saveField}
                  invoiceCell={
                    <InvoiceCell
                      p={p}
                      tourInvoices={tourInvoices}
                      onCreate={createInvoice}
                      onAttach={attachInvoice}
                      onDetach={detachInvoice}
                      onOpen={setOpenInvoice}
                    />
                  }
                />
                <td />
              </tr>
            ))}
            {addRow(null, "unassigned", true)}
          </tbody>
        </table>
      </FloatingHScroll>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start", marginTop: 20 }}>
        <StaffSection
          staff={tour.staff}
          onAdd={(role) => act(() => api.staff.create({ tourId, role }))}
          onUpdate={(sid, data) => act(() => api.staff.update(sid, data))}
          onRemove={(sid) => act(() => api.staff.remove(sid))}
        />
        <WaitlistSection
          entries={tour.waitlist}
          customers={customers}
          onAdd={(data) => act(() => api.waitlist.create({ tourId, ...data }))}
          onAddNew={(cust, data) =>
            act(async () => {
              const created = await api.customers.create({
                firstName: cust.firstName,
                lastName: cust.lastName,
                mobile: cust.mobile || null,
                email: cust.email || null,
              });
              await api.waitlist.create({ tourId, customerId: created.id, ...data });
              api.customers.list().then(setCustomers); // so they show up in the passenger picker too
            })
          }
          onUpdate={(wid, data) => act(() => api.waitlist.update(wid, data))}
          onRemove={(wid) => act(() => api.waitlist.remove(wid))}
          onError={setError}
        />
      </div>

      <div style={{ display: "flex", marginTop: 20 }}>
        <div style={{ width: "100%" }}>
          <span className="section-title">Notes</span>
          <button
            className="btn btn-secondary"
            style={{ padding: "1px 8px", fontSize: 11, marginLeft: 10 }}
            onClick={() => setSearchParams(sheetMode ? {} : { sheet: "1" })}
          >
            {sheetMode ? "Use simple grid" : "Try spreadsheet (beta)"}
          </button>
          <div className="card" style={{ marginTop: 8, minHeight: 120 }}>
            {sheetMode ? (
              <Suspense fallback={<div className="empty-state">Loading spreadsheet&hellip;</div>}>
                <NotesSheet raw={tour.notes} onSave={saveNotesJson} />
              </Suspense>
            ) : (
              <NotesGrid value={notes} onChange={setNotes} onCommit={commitNotes} />
            )}
          </div>
        </div>
      </div>

      <CancellationsSection
        entries={tour.cancellations}
        onOpenInvoice={setOpenInvoice}
        onNote={(bookingId, date, note) => act(() => api.bookings.cancel(bookingId, { date: date ?? undefined, note }))}
        onReactivate={(bookingId) => act(() => api.bookings.reactivate(bookingId))}
        onDelete={(e) => setDeleteTarget({ bookingId: e.bookingId, name: `${e.firstName} ${e.lastName}` })}
      />

      {cancelTarget && (
        <div className="modal-backdrop" onClick={() => setCancelTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Cancel booking?</h2>
            <p>
              {cancelTarget.name} will come off the room list and stop counting as a passenger. They stay on the
              invoice (marked cancelled) and appear under Cancellations, where you can reactivate them.
            </p>
            <div className="form-grid">
              <label>
                Date cancelled
                <input type="date" value={cancelDate} onChange={(e) => setCancelDate(e.target.value)} />
              </label>
            </div>
            <div className="form-grid full">
              <label>
                Note
                <input
                  autoFocus
                  placeholder="e.g. Ph 2/5/23 - may go on Tas Nov '23"
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmCancel()}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCancelTarget(null)}>
                Keep booking
              </button>
              <button className="btn btn-primary" onClick={confirmCancel}>
                Cancel booking
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete from tour?</h2>
            <p>
              This removes {deleteTarget.name} from the tour completely, with no record of a cancellation. If they
              have cancelled, use <strong>Cancel booking</strong> instead so there is a record.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Keep
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const { bookingId } = deleteTarget;
                  setDeleteTarget(null);
                  act(() => api.bookings.remove(bookingId));
                }}
              >
                Delete from tour
              </button>
            </div>
          </div>
        </div>
      )}

      {openInvoice != null && (
        <InvoiceDrawer invoiceId={openInvoice} onClose={() => setOpenInvoice(null)} onChanged={load} />
      )}

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
