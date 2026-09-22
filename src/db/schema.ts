import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * These tables mirror what's already live in the `mini-crm` D1 database.
 * This file is for typed queries via drizzle-orm — it does not manage
 * migrations, since the tables were created directly. If you want Drizzle
 * to own migrations going forward, run `drizzle-kit introspect` against
 * the database first so the SQL here stays in sync.
 */

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title"), // Mr, Mrs, Ms, Dr, etc.
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"), // ISO date string YYYY-MM-DD
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  streetAddress: text("street_address"),
  suburb: text("suburb"),
  state: text("state"),
  postcode: text("postcode"),
  dietaries: text("dietaries"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const tours = sqliteTable("tours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tourCode: text("tour_code"),
  tourName: text("tour_name").notNull(),
  departureDate: text("departure_date").notNull(), // ISO date string
  returnDate: text("return_date").notNull(), // ISO date string
  // Generated column in SQLite — computed automatically, never insert/update it directly.
  numDays: integer("num_days").generatedAlwaysAs(
    sql`CAST(julianday(return_date) - julianday(departure_date) AS INTEGER)`,
    { mode: "virtual" },
  ),
  price: real("price"),
  singleSupp: real("single_supp"),
  // Generated column: price + single_supp. Never insert/update it directly.
  total: real("total").generatedAlwaysAs(sql`COALESCE(price, 0) + COALESCE(single_supp, 0)`, { mode: "virtual" }),
  totalPassengers: integer("total_passengers"),
  seats: integer("seats"), // seats available for sale
  numRooms: integer("num_rooms"), // rooms available
  pay1Date: text("pay1_date"),
  pay2Date: text("pay2_date"),
  notes: text("notes"), // JSON grid of strings, e.g. [["a","b"],["c","d"]]
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  task: text("task").notNull(), // multi-line free text
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const ROOM_TYPES = ["Single", "Double", "Twin", "Triple"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tourId: integer("tour_id").notNull(),
  roomType: text("room_type", { enum: ROOM_TYPES }).notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  tourId: integer("tour_id").notNull(),
  roomId: integer("room_id"), // null = not yet assigned to a room
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Tour = typeof tours.$inferSelect;
export type NewTour = typeof tours.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
