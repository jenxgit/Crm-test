import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql, getTableColumns, inArray, isNotNull } from "drizzle-orm";
import { customers, tours, tasks, bookings, rooms, ROOM_TYPES, invoices, payments, invoiceItems } from "./db/schema";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

const db = (env: Env) => drizzle(env.DB);

const ROOM_CAPACITY: Record<string, number> = { Single: 1, Double: 2, Twin: 2, Triple: 3 };

// Twin-share price is the tour's base price; Single rooms add the single supplement.
const bookingCost = (tour: { price: number | null; singleSupp: number | null }, roomType: string | null) => {
  if (tour.price == null) return null;
  return roomType === "Single" ? tour.price + (tour.singleSupp ?? 0) : tour.price;
};

// Australian financial year: 1 July -> 30 June. Identified by its starting calendar year,
// e.g. startYear 2025 = FY "2025–26" = 2025-07-01 through 2026-06-30.
const fyStartYear = (dateStr: string): number => {
  const [y, m] = dateStr.split("-").map(Number);
  return m >= 7 ? y : y - 1;
};
const fyRange = (startYear: number) => ({ start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` });
const fyLabel = (startYear: number) => `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;

// seatsLeft / roomsLeft are derived from live counts rather than stored.
const withAvailability = <T extends { seats: number | null; numRooms: number | null }>(
  t: T & { passengerCount: number; roomCount: number },
) => ({
  ...t,
  seatsLeft: t.seats != null ? t.seats - t.passengerCount : null,
  roomsLeft: t.numRooms != null ? t.numRooms - t.roomCount : null,
});

const tourWithCounts = (env: Env) =>
  db(env)
    .select({
      ...getTableColumns(tours),
      passengerCount: sql<number>`(SELECT COUNT(*) FROM bookings WHERE bookings.tour_id = tours.id)`,
      roomCount: sql<number>`(SELECT COUNT(*) FROM rooms WHERE rooms.tour_id = tours.id)`,
    })
    .from(tours);

// ---------- Customers ----------

app.get("/api/customers", async (c) => {
  const rows = await db(c.env).select().from(customers).all();
  return c.json(rows);
});

app.get("/api/customers/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [customer] = await db(c.env).select().from(customers).where(eq(customers.id, id));
  if (!customer) return c.json({ error: "Not found" }, 404);

  const customerBookings = await db(c.env)
    .select({
      id: bookings.id,
      tourId: bookings.tourId,
      createdAt: bookings.createdAt,
      tourName: tours.tourName,
      departureDate: tours.departureDate,
      returnDate: tours.returnDate,
      numDays: tours.numDays,
      price: tours.price,
    })
    .from(bookings)
    .innerJoin(tours, eq(bookings.tourId, tours.id))
    .where(eq(bookings.customerId, id));

  const customerTasks = await db(c.env).select().from(tasks).where(eq(tasks.customerId, id));

  return c.json({ ...customer, bookings: customerBookings, tasks: customerTasks });
});

app.post("/api/customers", async (c) => {
  const body = await c.req.json();
  const [created] = await db(c.env)
    .insert(customers)
    .values({
      title: body.title ?? null,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      mobile: body.mobile ?? null,
      streetAddress: body.streetAddress ?? null,
      suburb: body.suburb ?? null,
      state: body.state ?? null,
      postcode: body.postcode ?? null,
      dietaries: body.dietaries ?? null,
    })
    .returning();
  return c.json(created, 201);
});

app.put("/api/customers/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const [updated] = await db(c.env)
    .update(customers)
    .set({
      title: body.title,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
      email: body.email,
      phone: body.phone,
      mobile: body.mobile,
      streetAddress: body.streetAddress,
      suburb: body.suburb,
      state: body.state,
      postcode: body.postcode,
      dietaries: body.dietaries,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(customers.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

app.delete("/api/customers/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db(c.env).delete(customers).where(eq(customers.id, id));
  return c.body(null, 204);
});

// ---------- Tours ----------

app.get("/api/tours", async (c) => {
  const rows = await tourWithCounts(c.env).all();
  return c.json(rows.map(withAvailability));
});

app.get("/api/tours/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [tour] = await tourWithCounts(c.env).where(eq(tours.id, id));
  if (!tour) return c.json({ error: "Not found" }, 404);

  const passengers = await db(c.env)
    .select({
      bookingId: bookings.id,
      roomId: bookings.roomId,
      invoiceId: bookings.invoiceId,
      invoiceNumber: invoices.invoiceNumber,
      customerId: customers.id,
      title: customers.title,
      firstName: customers.firstName,
      lastName: customers.lastName,
      dietaries: customers.dietaries,
      email: customers.email,
      phone: customers.phone,
      mobile: customers.mobile,
      streetAddress: customers.streetAddress,
      suburb: customers.suburb,
      state: customers.state,
      postcode: customers.postcode,
      dateOfBirth: customers.dateOfBirth,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(invoices, eq(bookings.invoiceId, invoices.id))
    .where(eq(bookings.tourId, id))
    .orderBy(bookings.id);

  const tourRooms = await db(c.env).select().from(rooms).where(eq(rooms.tourId, id)).orderBy(rooms.id);
  const roomsWithPassengers = tourRooms.map((r) => ({
    id: r.id,
    roomType: r.roomType,
    capacity: ROOM_CAPACITY[r.roomType],
    passengers: passengers.filter((p) => p.roomId === r.id),
  }));
  const unassigned = passengers.filter((p) => p.roomId == null);

  return c.json({ ...withAvailability(tour), rooms: roomsWithPassengers, unassigned, passengers });
});

app.post("/api/tours", async (c) => {
  const body = await c.req.json();
  const [created] = await db(c.env)
    .insert(tours)
    .values({
      tourCode: body.tourCode ?? null,
      tourName: body.tourName,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      price: body.price ?? null,
      singleSupp: body.singleSupp ?? null,
      totalPassengers: body.totalPassengers ?? null,
      seats: body.seats ?? null,
      numRooms: body.numRooms ?? null,
      pay1Date: body.pay1Date ?? null,
      pay2Date: body.pay2Date ?? null,
      notes: body.notes ?? null,
    })
    .returning();
  return c.json(created, 201);
});

app.put("/api/tours/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const [updated] = await db(c.env)
    .update(tours)
    .set({
      tourCode: body.tourCode,
      tourName: body.tourName,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      price: body.price,
      singleSupp: body.singleSupp,
      totalPassengers: body.totalPassengers,
      seats: body.seats,
      numRooms: body.numRooms,
      pay1Date: body.pay1Date,
      pay2Date: body.pay2Date,
      notes: body.notes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tours.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

app.delete("/api/tours/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db(c.env).delete(tours).where(eq(tours.id, id));
  return c.body(null, 204);
});

// ---------- Tasks ----------

app.get("/api/tasks", async (c) => {
  const rows = await db(c.env)
    .select({
      id: tasks.id,
      task: tasks.task,
      createdAt: tasks.createdAt,
      customerId: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(tasks)
    .innerJoin(customers, eq(tasks.customerId, customers.id))
    .all();
  return c.json(rows);
});

app.post("/api/tasks", async (c) => {
  const body = await c.req.json();
  const [created] = await db(c.env)
    .insert(tasks)
    .values({ customerId: body.customerId, task: body.task })
    .returning();
  return c.json(created, 201);
});

app.put("/api/tasks/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const [updated] = await db(c.env)
    .update(tasks)
    .set({ task: body.task, updatedAt: new Date().toISOString() })
    .where(eq(tasks.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

app.delete("/api/tasks/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db(c.env).delete(tasks).where(eq(tasks.id, id));
  return c.body(null, 204);
});

// ---------- Rooms ----------

app.post("/api/rooms", async (c) => {
  const body = await c.req.json();
  if (!ROOM_TYPES.includes(body.roomType)) return c.json({ error: "Invalid room type" }, 400);
  const [created] = await db(c.env)
    .insert(rooms)
    .values({ tourId: body.tourId, roomType: body.roomType })
    .returning();
  return c.json(created, 201);
});

app.put("/api/rooms/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  if (!ROOM_TYPES.includes(body.roomType)) return c.json({ error: "Invalid room type" }, 400);
  const occupants = await db(c.env).select().from(bookings).where(eq(bookings.roomId, id));
  if (occupants.length > ROOM_CAPACITY[body.roomType]) {
    return c.json({ error: `A ${body.roomType} room holds ${ROOM_CAPACITY[body.roomType]}` }, 400);
  }
  const [updated] = await db(c.env)
    .update(rooms)
    .set({ roomType: body.roomType, updatedAt: new Date().toISOString() })
    .where(eq(rooms.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// Deleting a room leaves its passengers booked on the tour but unassigned.
app.delete("/api/rooms/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db(c.env).update(bookings).set({ roomId: null }).where(eq(bookings.roomId, id));
  await db(c.env).delete(rooms).where(eq(rooms.id, id));
  return c.body(null, 204);
});

// ---------- Bookings ----------

// Returns an error message if the room can't take another passenger.
const roomProblem = async (env: Env, roomId: number, tourId: number, excludeBookingId?: number) => {
  const [room] = await db(env).select().from(rooms).where(eq(rooms.id, roomId));
  if (!room || room.tourId !== tourId) return "Room not found on this tour";
  const occupants = (await db(env).select().from(bookings).where(eq(bookings.roomId, roomId))).filter(
    (b) => b.id !== excludeBookingId,
  );
  if (occupants.length >= ROOM_CAPACITY[room.roomType]) return `This ${room.roomType} room is full`;
  return null;
};

app.post("/api/bookings", async (c) => {
  const body = await c.req.json();
  if (body.roomId != null) {
    const problem = await roomProblem(c.env, body.roomId, body.tourId);
    if (problem) return c.json({ error: problem }, 400);
  }
  const [created] = await db(c.env)
    .insert(bookings)
    .values({ customerId: body.customerId, tourId: body.tourId, roomId: body.roomId ?? null })
    .returning();
  return c.json(created, 201);
});

// Move a passenger into a room, or pass roomId: null to unassign.
// Body may include roomId and/or invoiceId; a field left out of the body is left unchanged
// (Drizzle skips `undefined` set() values), so pass null explicitly to clear one.
app.put("/api/bookings/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const [booking] = await db(c.env).select().from(bookings).where(eq(bookings.id, id));
  if (!booking) return c.json({ error: "Not found" }, 404);
  if (body.roomId != null) {
    const problem = await roomProblem(c.env, body.roomId, booking.tourId, id);
    if (problem) return c.json({ error: problem }, 400);
  }
  const [updated] = await db(c.env)
    .update(bookings)
    .set({ roomId: body.roomId, invoiceId: body.invoiceId, updatedAt: new Date().toISOString() })
    .where(eq(bookings.id, id))
    .returning();
  return c.json(updated);
});

app.delete("/api/bookings/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db(c.env).delete(bookings).where(eq(bookings.id, id));
  return c.body(null, 204);
});

// ---------- Invoices ----------

// One invoice can cover several bookings (e.g. a couple sharing a room and an invoice),
// or a room full of friends can each have their own invoice for their own share.
const invoiceBookingRows = (env: Env) =>
  db(env)
    .select({
      invoiceId: bookings.invoiceId,
      bookingId: bookings.id,
      customerId: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      roomId: bookings.roomId,
      tourId: tours.id,
      tourCode: tours.tourCode,
      tourName: tours.tourName,
      departureDate: tours.departureDate,
      price: tours.price,
      singleSupp: tours.singleSupp,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(tours, eq(bookings.tourId, tours.id))
    .where(isNotNull(bookings.invoiceId));

// Shared by GET /api/invoices and the dashboard: each invoice's charged/paid/balance,
// with the tour it's attached to (via its bookings — an invoice has no tour_id of its own).
const computeInvoiceSummaries = async (env: Env) => {
  const [allInvoices, bookingRows, roomRows, paymentRows, itemRows] = await Promise.all([
    db(env).select().from(invoices),
    invoiceBookingRows(env),
    db(env).select().from(rooms),
    db(env).select().from(payments),
    db(env).select().from(invoiceItems),
  ]);
  const roomTypeById = new Map(roomRows.map((r) => [r.id, r.roomType]));

  return allInvoices.map((inv) => {
    const rows = bookingRows.filter((b) => b.invoiceId === inv.id);
    const first = rows[0];
    const bookingsOut = rows.map((b) => ({
      bookingId: b.bookingId,
      customerId: b.customerId,
      firstName: b.firstName,
      lastName: b.lastName,
      cost: bookingCost(b, b.roomId != null ? (roomTypeById.get(b.roomId) ?? null) : null),
    }));
    const items = itemRows.filter((it) => it.invoiceId === inv.id);
    const totalCharged =
      bookingsOut.reduce((sum, b) => sum + (b.cost ?? 0), 0) + items.reduce((sum, it) => sum + it.amount, 0);
    const totalPaid = paymentRows.filter((p) => p.invoiceId === inv.id).reduce((sum, p) => sum + p.amount, 0);
    return {
      ...inv,
      tourId: first?.tourId ?? null,
      tourCode: first?.tourCode ?? null,
      tourName: first?.tourName ?? null,
      departureDate: first?.departureDate ?? null,
      bookings: bookingsOut,
      totalCharged,
      totalPaid,
      balance: totalCharged - totalPaid,
    };
  });
};

// Full customer record for the invoice's "To:" contact block.
const contactFields = {
  id: customers.id,
  title: customers.title,
  firstName: customers.firstName,
  lastName: customers.lastName,
  email: customers.email,
  phone: customers.phone,
  mobile: customers.mobile,
  streetAddress: customers.streetAddress,
  suburb: customers.suburb,
  state: customers.state,
  postcode: customers.postcode,
};

app.get("/api/invoices", async (c) => {
  const [summaries, contactRows] = await Promise.all([
    computeInvoiceSummaries(c.env),
    db(c.env).select(contactFields).from(customers),
  ]);
  const contactById = new Map(contactRows.map((r) => [r.id, r]));

  const result = summaries
    .map((inv) => ({
      ...inv,
      primaryContact: inv.primaryContactId != null ? (contactById.get(inv.primaryContactId) ?? null) : null,
    }))
    .sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
  return c.json(result);
});

app.get("/api/invoices/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [inv] = await db(c.env).select().from(invoices).where(eq(invoices.id, id));
  if (!inv) return c.json({ error: "Not found" }, 404);

  const [bookingRows, roomRows, invoicePayments, items, contact] = await Promise.all([
    invoiceBookingRows(c.env).then((rows) => rows.filter((b) => b.invoiceId === id)),
    db(c.env).select().from(rooms),
    db(c.env).select().from(payments).where(eq(payments.invoiceId, id)).orderBy(payments.receivedDate, payments.id),
    db(c.env).select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(invoiceItems.id),
    inv.primaryContactId != null
      ? db(c.env)
          .select(contactFields)
          .from(customers)
          .where(eq(customers.id, inv.primaryContactId))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);
  const roomTypeById = new Map(roomRows.map((r) => [r.id, r.roomType]));
  const first = bookingRows[0];
  const tourRow = first ? await db(c.env).select().from(tours).where(eq(tours.id, first.tourId)) : [];
  const tourDetail = tourRow[0] ?? null;

  const bookingsOut = bookingRows.map((b) => ({
    bookingId: b.bookingId,
    customerId: b.customerId,
    firstName: b.firstName,
    lastName: b.lastName,
    cost: bookingCost(b, b.roomId != null ? (roomTypeById.get(b.roomId) ?? null) : null),
  }));
  const totalCharged =
    bookingsOut.reduce((sum, b) => sum + (b.cost ?? 0), 0) + items.reduce((sum, it) => sum + it.amount, 0);
  const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);

  return c.json({
    ...inv,
    tourId: first?.tourId ?? null,
    tourCode: first?.tourCode ?? null,
    tourName: first?.tourName ?? null,
    departureDate: tourDetail?.departureDate ?? null,
    returnDate: tourDetail?.returnDate ?? null,
    numDays: tourDetail?.numDays ?? null,
    price: tourDetail?.price ?? null,
    singleSupp: tourDetail?.singleSupp ?? null,
    primaryContact: contact,
    bookings: bookingsOut,
    lineItems: items,
    payments: invoicePayments,
    totalCharged,
    totalPaid,
    balance: totalCharged - totalPaid,
  });
});

// Creates an invoice and attaches the given (currently un-invoiced) bookings to it in one step.
// The primary ("To:") contact defaults to the first booking's customer unless given explicitly.
app.post("/api/invoices", async (c) => {
  const body = await c.req.json();
  const invoiceNumber = String(body.invoiceNumber ?? "").trim();
  const bookingIds: number[] = Array.isArray(body.bookingIds) ? body.bookingIds : [];
  if (!invoiceNumber) return c.json({ error: "Invoice number is required" }, 400);
  if (bookingIds.length === 0) return c.json({ error: "Select at least one passenger" }, 400);

  let primaryContactId: number | null = body.primaryContactId ?? null;
  if (primaryContactId == null) {
    const [firstBooking] = await db(c.env).select().from(bookings).where(eq(bookings.id, bookingIds[0]));
    primaryContactId = firstBooking?.customerId ?? null;
  }

  let created;
  try {
    [created] = await db(c.env)
      .insert(invoices)
      .values({ invoiceNumber, primaryContactId, dueDate: body.dueDate ?? null })
      .returning();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique/i.test(msg)) return c.json({ error: `Invoice number "${invoiceNumber}" is already in use` }, 400);
    return c.json({ error: `Could not create invoice: ${msg}` }, 400);
  }
  await db(c.env)
    .update(bookings)
    .set({ invoiceId: created.id, updatedAt: new Date().toISOString() })
    .where(inArray(bookings.id, bookingIds));
  return c.json(created, 201);
});

// Fields left out of the body are left unchanged (Drizzle skips undefined set() values);
// pass null explicitly to clear primaryContactId or dueDate.
app.put("/api/invoices/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  if (body.invoiceNumber !== undefined && !String(body.invoiceNumber).trim()) {
    return c.json({ error: "Invoice number is required" }, 400);
  }
  let updated;
  try {
    [updated] = await db(c.env)
      .update(invoices)
      .set({
        invoiceNumber: body.invoiceNumber !== undefined ? String(body.invoiceNumber).trim() : undefined,
        primaryContactId: body.primaryContactId,
        dueDate: body.dueDate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, id))
      .returning();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique/i.test(msg)) return c.json({ error: `Invoice number "${body.invoiceNumber}" is already in use` }, 400);
    return c.json({ error: `Could not update invoice: ${msg}` }, 400);
  }
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// Refuses to delete an invoice with payments recorded against it, so a payment never
// silently loses its invoice. Detach its bookings first (or just stop using it) otherwise.
app.delete("/api/invoices/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const linkedPayments = await db(c.env).select().from(payments).where(eq(payments.invoiceId, id));
  if (linkedPayments.length > 0) {
    return c.json({ error: "This invoice has payments recorded against it and can't be deleted" }, 400);
  }
  await db(c.env).update(bookings).set({ invoiceId: null }).where(eq(bookings.invoiceId, id));
  await db(c.env).delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  await db(c.env).delete(invoices).where(eq(invoices.id, id));
  return c.body(null, 204);
});

// ---------- Invoice line items (manual extra charges/credits, e.g. a cancellation fee) ----------

app.post("/api/invoices/:id/items", async (c) => {
  const invoiceId = Number(c.req.param("id"));
  const body = await c.req.json();
  const description = String(body.description ?? "").trim();
  if (!description) return c.json({ error: "Description is required" }, 400);
  if (body.amount == null || Number.isNaN(Number(body.amount))) return c.json({ error: "Amount is required" }, 400);
  const [invoice] = await db(c.env).select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice) return c.json({ error: "Not found" }, 404);
  const [created] = await db(c.env)
    .insert(invoiceItems)
    .values({ invoiceId, description, amount: Number(body.amount) })
    .returning();
  return c.json(created, 201);
});

app.delete("/api/invoice-items/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db(c.env).delete(invoiceItems).where(eq(invoiceItems.id, id));
  return c.body(null, 204);
});

// ---------- Payments (the bank ledger) ----------

// A payment/refund is linked to an invoice; a transfer out (e.g. paying the tour operator)
// is linked to a tour instead (or to neither, for a general expense). Amount is signed:
// positive = money in, negative = money out. Running balance is computed over the WHOLE
// ledger in date order so it always means "the bank balance after this line", then the
// tour/invoice filters (if any) just narrow which rows come back.
app.get("/api/payments", async (c) => {
  const tourId = c.req.query("tourId");
  const invoiceId = c.req.query("invoiceId");

  const all = await db(c.env)
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      tourId: payments.tourId,
      amount: payments.amount,
      method: payments.method,
      description: payments.description,
      receivedDate: payments.receivedDate,
      bankedDate: payments.bankedDate,
      createdAt: payments.createdAt,
      invoiceNumber: invoices.invoiceNumber,
      tourCode: tours.tourCode,
    })
    .from(payments)
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(tours, eq(payments.tourId, tours.id))
    .orderBy(sql`${payments.receivedDate} is null, ${payments.receivedDate}`, payments.id);

  let running = 0;
  const withBalance = all.map((p) => {
    running += p.amount;
    return { ...p, runningBalance: running };
  });

  const filtered = withBalance.filter(
    (p) =>
      (tourId == null || p.tourId === Number(tourId)) && (invoiceId == null || p.invoiceId === Number(invoiceId)),
  );
  return c.json(filtered);
});

app.post("/api/payments", async (c) => {
  const body = await c.req.json();
  if (body.amount == null || Number.isNaN(Number(body.amount))) {
    return c.json({ error: "Amount is required" }, 400);
  }
  const [created] = await db(c.env)
    .insert(payments)
    .values({
      invoiceId: body.invoiceId ?? null,
      tourId: body.tourId ?? null,
      amount: Number(body.amount),
      method: body.method ?? null,
      description: body.description ?? null,
      receivedDate: body.receivedDate ?? null,
      bankedDate: body.bankedDate ?? null,
    })
    .returning();
  return c.json(created, 201);
});

app.put("/api/payments/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const [updated] = await db(c.env)
    .update(payments)
    .set({
      invoiceId: body.invoiceId,
      tourId: body.tourId,
      amount: body.amount != null ? Number(body.amount) : undefined,
      method: body.method,
      description: body.description,
      receivedDate: body.receivedDate,
      bankedDate: body.bankedDate,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(payments.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

app.delete("/api/payments/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db(c.env).delete(payments).where(eq(payments.id, id));
  return c.body(null, 204);
});

// ---------- Dashboard ----------

app.get("/api/dashboard", async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const currentFy = fyStartYear(today);
  const fyParam = c.req.query("fy");
  const fy = fyParam ? Number(fyParam) : currentFy;
  const { start, end } = fyRange(fy);

  const [allTours, invoiceSummaries, allPayments] = await Promise.all([
    tourWithCounts(c.env).all(),
    computeInvoiceSummaries(c.env),
    db(c.env).select().from(payments),
  ]);
  const withAvail = allTours.map(withAvailability);

  const toursInFy = withAvail.filter((t) => t.departureDate >= start && t.departureDate <= end);
  const toursCompleted = toursInFy.filter((t) => t.departureDate < today);
  const toursPlanned = toursInFy.filter((t) => t.departureDate >= today);
  const totalBookings = toursInFy.reduce((sum, t) => sum + t.passengerCount, 0);

  // Revenue billed: every booking's tour cost, for tours that have already departed this FY.
  const completedIds = toursCompleted.map((t) => t.id);
  const [completedBookingRows, completedRoomRows] =
    completedIds.length > 0
      ? await Promise.all([
          db(c.env).select({ tourId: bookings.tourId, roomId: bookings.roomId }).from(bookings).where(inArray(bookings.tourId, completedIds)),
          db(c.env).select().from(rooms).where(inArray(rooms.tourId, completedIds)),
        ])
      : [[], []];
  const roomTypeById = new Map(completedRoomRows.map((r) => [r.id, r.roomType]));
  const completedTourById = new Map(toursCompleted.map((t) => [t.id, t]));
  const revenueBilled = completedBookingRows.reduce((sum, b) => {
    const tour = completedTourById.get(b.tourId);
    if (!tour) return sum;
    return sum + (bookingCost(tour, b.roomId != null ? (roomTypeById.get(b.roomId) ?? null) : null) ?? 0);
  }, 0);

  // Payments actually received in the FY (cash-in view — differs from revenue billed, which
  // is attributed by tour departure date instead of payment date).
  const paymentsReceived = allPayments
    .filter((p) => p.amount > 0 && p.receivedDate != null && p.receivedDate >= start && p.receivedDate <= end)
    .reduce((sum, p) => sum + p.amount, 0);

  // Outstanding balance across this FY's invoices; overdueBalance narrows that to tours that
  // have already departed (money that should have been collected by now).
  const fyTourIds = new Set(toursInFy.map((t) => t.id));
  const fyInvoices = invoiceSummaries.filter((inv) => inv.tourId != null && fyTourIds.has(inv.tourId));
  const outstandingBalance = fyInvoices.reduce((sum, inv) => sum + Math.max(inv.balance, 0), 0);
  const overdueBalance = fyInvoices
    .filter((inv) => inv.departureDate != null && inv.departureDate < today)
    .reduce((sum, inv) => sum + Math.max(inv.balance, 0), 0);

  const upcomingTours = toursPlanned
    .filter((t) => t.seatsLeft != null && t.seatsLeft > 0)
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      tourCode: t.tourCode,
      tourName: t.tourName,
      departureDate: t.departureDate,
      seats: t.seats,
      seatsLeft: t.seatsLeft,
      passengerCount: t.passengerCount,
    }));

  const yearsSet = new Set<number>(withAvail.map((t) => fyStartYear(t.departureDate)));
  yearsSet.add(currentFy);
  const availableYears = [...yearsSet].sort((a, b) => b - a).map((y) => ({ startYear: y, label: fyLabel(y) }));

  return c.json({
    fy: { startYear: fy, label: fyLabel(fy) },
    availableYears,
    toursCompleted: toursCompleted.length,
    toursPlanned: toursPlanned.length,
    totalBookings,
    revenueBilled,
    paymentsReceived,
    outstandingBalance,
    overdueBalance,
    upcomingTours,
  });
});

export default app;
