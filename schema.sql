-- Mirrors the live `mini-crm` D1 schema. Used to set up the local dev database:
--   npm run db:local
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  street_address TEXT,
  state TEXT,
  postcode TEXT,
  dietaries TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  phone TEXT,
  mobile TEXT,
  suburb TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS tours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_code TEXT,
  tour_name TEXT NOT NULL,
  departure_date TEXT NOT NULL,
  return_date TEXT NOT NULL,
  num_days INTEGER GENERATED ALWAYS AS (CAST(julianday(return_date) - julianday(departure_date) AS INTEGER)) VIRTUAL,
  price REAL,
  single_supp REAL,
  total REAL GENERATED ALWAYS AS (COALESCE(price, 0) + COALESCE(single_supp, 0)) VIRTUAL,
  total_passengers INTEGER,
  seats INTEGER,
  num_rooms INTEGER,
  pay1_date TEXT,
  pay2_date TEXT,
  notes TEXT, -- JSON grid of strings, e.g. [["a","b"],["c","d"]]
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  task TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tour_id INTEGER NOT NULL REFERENCES tours(id),
  room_type TEXT NOT NULL CHECK (room_type IN ('Single','Double','Twin','Triple')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  primary_contact_id INTEGER REFERENCES customers(id), -- the "To:" contact on the receipt
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Manual extra charge/credit lines on an invoice (e.g. a cancellation fee), on top of the
-- passengers' computed tour cost. amount can be negative for a credit/discount.
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  tour_id INTEGER NOT NULL REFERENCES tours(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  room_id INTEGER REFERENCES rooms(id),
  invoice_id INTEGER REFERENCES invoices(id)
);

-- The bank ledger: every payment received and every transfer out (negative amount).
-- Summing amount in date order should match the bank account balance.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER REFERENCES invoices(id), -- set for a customer payment/refund
  tour_id INTEGER REFERENCES tours(id), -- set for a transfer out, or to tag a customer payment's tour
  amount REAL NOT NULL, -- positive = money in, negative = money out
  method TEXT, -- CH, DD, CC, CS, BC, BANK, PP, CD, QD, MO, CREDIT, etc. (free text)
  description TEXT,
  received_date TEXT,
  banked_date TEXT, -- when it actually hit the bank, for reconciling against a statement
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
