import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql, getTableColumns } from "drizzle-orm";
import { customers, tours, tasks, bookings, rooms, ROOM_TYPES } from "./db/schema";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

const db = (env: Env) => drizzle(env.DB);

const ROOM_CAPACITY: Record<string, number> = { Single: 1, Double: 2, Twin: 2, Triple: 3 };

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
    .set({ roomId: body.roomId ?? null, updatedAt: new Date().toISOString() })
    .where(eq(bookings.id, id))
    .returning();
  return c.json(updated);
});

app.delete("/api/bookings/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db(c.env).delete(bookings).where(eq(bookings.id, id));
  return c.body(null, 204);
});

export default app;
