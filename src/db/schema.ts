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
  streetAddress: text("street_address"),
  state: text("state"),
  postcode: text("postcode"),
  dietaries: text("dietaries"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const tours = sqliteTable("tours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tourName: text("tour_name").notNull(),
  departureDate: text("departure_date").notNull(), // ISO date string
  returnDate: text("return_date").notNull(), // ISO date string
  // Generated column in SQLite — computed automatically, never insert/update it directly.
  numDays: integer("num_days"),
  price: real("price"),
  totalPassengers: integer("total_passengers"),
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

export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  tourId: integer("tour_id").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Tour = typeof tours.$inferSelect;
export type NewTour = typeof tours.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
