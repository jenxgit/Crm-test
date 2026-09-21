import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { customers, tours, tasks, bookings } from "./db/schema";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

const db = (env: Env) => drizzle(env.DB);

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
      streetAddress: body.streetAddress ?? null,
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
      streetAddress: body.streetAddress,
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
  const rows = await db(c.env).select().from(tours).all();
  return c.json(rows);
});

app.get("/api/tours/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [tour] = await db(c.env).select().from(tours).where(eq(tours.id, id));
  if (!tour) return c.json({ error: "Not found" }, 404);

  const passengers = await db(c.env)
    .select({
      bookingId: bookings.id,
      customerId: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      dietaries: customers.dietaries,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(eq(bookings.tourId, id));

  return c.json({ ...tour, passengers });
});

app.post("/api/tours", async (c) => {
  const body = await c.req.json();
  const [created] = await db(c.env)
    .insert(tours)
    .values({
      tourName: body.tourName,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      price: body.price ?? null,
      totalPassengers: body.totalPassengers ?? null,
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
      tourName: body.tourName,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      price: body.price,
      totalPassengers: body.totalPassengers,
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

// ---------- Bookings ----------

app.post("/api/bookings", async (c) => {
  const body = await c.req.json();
  const [created] = await db(c.env)
    .insert(bookings)
    .values({ customerId: body.customerId, tourId: body.tourId })
    .returning();
  return c.json(created, 201);
});

app.delete("/api/bookings/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await db(c.env).delete(bookings).where(eq(bookings.id, id));
  return c.body(null, 204);
});

export default app;
