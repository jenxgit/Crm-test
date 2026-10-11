export type Customer = {
  id: number;
  title: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  streetAddress: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  dietaries: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Tour = {
  id: number;
  tourCode: string | null;
  tourName: string;
  departureDate: string;
  returnDate: string;
  numDays: number;
  price: number | null;
  singleSupp: number | null;
  total: number | null;
  totalPassengers: number | null;
  seats: number | null;
  numRooms: number | null;
  seatsLeft: number | null;
  roomsLeft: number | null;
  passengerCount: number;
  roomCount: number;
  pay1Date: string | null;
  pay2Date: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Booking = {
  id: number;
  tourId: number;
  createdAt: string;
  tourName: string;
  departureDate: string;
  returnDate: string;
  numDays: number;
  price: number | null;
};

export type Task = {
  id: number;
  task: string;
  createdAt: string;
  customerId: number;
  firstName?: string;
  lastName?: string;
};

export type RoomType = "Single" | "Double" | "Twin" | "Triple";
export const ROOM_TYPES: RoomType[] = ["Single", "Double", "Twin", "Triple"];

export type Passenger = {
  bookingId: number;
  roomId: number | null;
  invoiceId: number | null;
  invoiceNumber: string | null;
  paymentsTotal: number | null; // this passenger's share of their invoice's payments
  balanceDue: number | null; // this passenger's share of the invoice charges, less their payments
  customerId: number;
  title: string | null;
  firstName: string;
  lastName: string;
  dietaries: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  streetAddress: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  dateOfBirth: string | null;
};

// A passenger who has cancelled: off the room grid and seat count, kept on the tour record.
export type Cancellation = Passenger & {
  cancelledDate: string | null;
  cancelNote: string | null;
  cancelledRoomType: string | null;
  sharedWith: string[]; // who was still in the room they left
};

export type Room = { id: number; roomType: RoomType; capacity: number; passengers: Passenger[] };

export type StaffRole = "Hostess" | "Driver";
export const STAFF_ROLES: StaffRole[] = ["Hostess", "Driver"];
// Travels with the tour and takes their own room (counted in the tour's rooms), not a passenger seat.
export type TourStaff = { id: number; tourId: number; role: StaffRole; name: string | null };

// Someone waiting for a seat on a tour. Doesn't use a seat or a room until moved onto the tour.
export type WaitlistEntry = {
  id: number;
  customerId: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  dateAdded: string; // YYYY-MM-DD
  pax: number;
  note: string | null;
  done: boolean; // dealt with: kept on the list but shown struck through
};

export type TourDetail = Tour & {
  rooms: Room[];
  unassigned: Passenger[];
  passengers: Passenger[];
  staff: TourStaff[];
  waitlist: WaitlistEntry[];
  cancellations: Cancellation[];
};

export type CustomerDetail = Customer & { bookings: Booking[]; tasks: Task[] };

export type InvoiceBooking = {
  bookingId: number;
  status?: "active" | "cancelled";
  customerId: number;
  firstName: string;
  lastName: string;
  cost: number | null;
};

// The "To:" contact on a receipt — a full customer record, but not necessarily one of the
// invoice's travelling passengers (e.g. a club treasurer paying for the group).
export type InvoiceContact = {
  id: number;
  title: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  streetAddress: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
};

export type InvoiceLineItem = { id: number; invoiceId: number; description: string; amount: number; createdAt: string };

export type InvoiceSummary = {
  id: number;
  invoiceNumber: string;
  primaryContactId: number | null;
  primaryContact: InvoiceContact | null;
  dueDate: string | null;
  tourId: number | null;
  tourCode: string | null;
  tourName: string | null;
  bookings: InvoiceBooking[];
  totalCharged: number;
  totalPaid: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type PaymentEntry = {
  id: number;
  invoiceId: number | null;
  tourId: number | null;
  amount: number;
  method: string | null;
  description: string | null;
  receivedDate: string | null;
  bankedDate: string | null;
  createdAt: string;
  invoiceNumber?: string | null;
  tourCode?: string | null;
  runningBalance?: number;
  // Custom split across the invoice's passengers; empty means an even split.
  allocations?: { bookingId: number; amount: number }[];
};

export type InvoiceDetail = InvoiceSummary & {
  payments: PaymentEntry[];
  lineItems: InvoiceLineItem[];
  departureDate: string | null;
  returnDate: string | null;
  numDays: number | null;
  price: number | null;
  singleSupp: number | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type FyOption = { startYear: number; label: string };

export type DashboardTour = {
  id: number;
  tourCode: string | null;
  tourName: string;
  departureDate: string;
  seats: number | null;
  seatsLeft: number | null;
  passengerCount: number;
};

export type DashboardData = {
  fy: FyOption;
  availableYears: FyOption[];
  toursCompleted: number;
  toursPlanned: number;
  totalBookings: number;
  revenueBilled: number;
  paymentsReceived: number;
  outstandingBalance: number;
  overdueBalance: number;
  upcomingTours: DashboardTour[];
};

export const api = {
  customers: {
    list: () => request<Customer[]>("/api/customers"),
    get: (id: number) => request<CustomerDetail>(`/api/customers/${id}`),
    create: (data: Partial<Customer>) =>
      request<Customer>("/api/customers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Customer>) =>
      request<Customer>(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/customers/${id}`, { method: "DELETE" }),
  },
  tours: {
    list: () => request<Tour[]>("/api/tours"),
    get: (id: number) => request<TourDetail>(`/api/tours/${id}`),
    create: (data: Partial<Tour>) => request<Tour>("/api/tours", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Tour>) =>
      request<Tour>(`/api/tours/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/tours/${id}`, { method: "DELETE" }),
  },
  tasks: {
    list: () => request<Task[]>("/api/tasks"),
    create: (data: { customerId: number; task: string }) =>
      request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, task: string) =>
      request<Task>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify({ task }) }),
    remove: (id: number) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  },
  waitlist: {
    create: (data: { tourId: number; customerId: number; dateAdded?: string; pax?: number; note?: string }) =>
      request<{ id: number }>("/api/tour-waitlist", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { dateAdded?: string; pax?: number; note?: string; done?: boolean }) =>
      request<{ id: number }>(`/api/tour-waitlist/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/tour-waitlist/${id}`, { method: "DELETE" }),
  },
  staff: {
    create: (data: { tourId: number; role: StaffRole; name?: string }) =>
      request<TourStaff>("/api/tour-staff", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { role?: StaffRole; name?: string }) =>
      request<TourStaff>(`/api/tour-staff/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/tour-staff/${id}`, { method: "DELETE" }),
  },
  rooms: {
    create: (data: { tourId: number; roomType: RoomType }) =>
      request<{ id: number }>("/api/rooms", { method: "POST", body: JSON.stringify(data) }),
    setType: (id: number, roomType: RoomType) =>
      request<{ id: number }>(`/api/rooms/${id}`, { method: "PUT", body: JSON.stringify({ roomType }) }),
    remove: (id: number) => request<void>(`/api/rooms/${id}`, { method: "DELETE" }),
  },
  dashboard: {
    get: (fy?: number) => request<DashboardData>(`/api/dashboard${fy != null ? `?fy=${fy}` : ""}`),
  },
  bookings: {
    create: (data: { customerId: number; tourId: number; roomId?: number | null }) =>
      request<Booking>("/api/bookings", { method: "POST", body: JSON.stringify(data) }),
    setRoom: (id: number, roomId: number | null) =>
      request<Booking>(`/api/bookings/${id}`, { method: "PUT", body: JSON.stringify({ roomId }) }),
    setInvoice: (id: number, invoiceId: number | null) =>
      request<Booking>(`/api/bookings/${id}`, { method: "PUT", body: JSON.stringify({ invoiceId }) }),
    // Cancelling keeps the passenger on the tour record (and invoice); remove deletes the booking.
    cancel: (id: number, data: { date?: string; note?: string }) =>
      request<{ ok: true }>(`/api/bookings/${id}/cancel`, { method: "POST", body: JSON.stringify(data) }),
    reactivate: (id: number, roomId?: number | null) =>
      request<{ ok: true; roomId: number | null }>(`/api/bookings/${id}/reactivate`, {
        method: "POST",
        body: JSON.stringify(roomId === undefined ? {} : { roomId }),
      }),
    remove: (id: number) => request<void>(`/api/bookings/${id}`, { method: "DELETE" }),
  },
  invoices: {
    list: () => request<InvoiceSummary[]>("/api/invoices"),
    get: (id: number) => request<InvoiceDetail>(`/api/invoices/${id}`),
    create: (data: { invoiceNumber: string; bookingIds: number[]; primaryContactId?: number | null; dueDate?: string | null }) =>
      request<{ id: number; invoiceNumber: string }>("/api/invoices", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { invoiceNumber?: string; primaryContactId?: number | null; dueDate?: string | null }) =>
      request<{ id: number; invoiceNumber: string }>(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/invoices/${id}`, { method: "DELETE" }),
    addItem: (invoiceId: number, description: string, amount: number) =>
      request<InvoiceLineItem>(`/api/invoices/${invoiceId}/items`, {
        method: "POST",
        body: JSON.stringify({ description, amount }),
      }),
    removeItem: (itemId: number) => request<void>(`/api/invoice-items/${itemId}`, { method: "DELETE" }),
  },
  payments: {
    list: (params?: { tourId?: number; invoiceId?: number }) => {
      const qs = new URLSearchParams();
      if (params?.tourId != null) qs.set("tourId", String(params.tourId));
      if (params?.invoiceId != null) qs.set("invoiceId", String(params.invoiceId));
      const suffix = qs.toString() ? `?${qs}` : "";
      return request<PaymentEntry[]>(`/api/payments${suffix}`);
    },
    create: (data: Partial<PaymentEntry>) =>
      request<PaymentEntry>("/api/payments", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<PaymentEntry>) =>
      request<PaymentEntry>(`/api/payments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    setAllocations: (id: number, allocations: { bookingId: number; amount: number }[]) =>
      request<{ ok: true }>(`/api/payments/${id}/allocations`, {
        method: "PUT",
        body: JSON.stringify({ allocations }),
      }),
    remove: (id: number) => request<void>(`/api/payments/${id}`, { method: "DELETE" }),
  },
};
