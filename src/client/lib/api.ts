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

export type Room = { id: number; roomType: RoomType; capacity: number; passengers: Passenger[] };

export type TourDetail = Tour & { rooms: Room[]; unassigned: Passenger[]; passengers: Passenger[] };

export type CustomerDetail = Customer & { bookings: Booking[]; tasks: Task[] };

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
  rooms: {
    create: (data: { tourId: number; roomType: RoomType }) =>
      request<{ id: number }>("/api/rooms", { method: "POST", body: JSON.stringify(data) }),
    setType: (id: number, roomType: RoomType) =>
      request<{ id: number }>(`/api/rooms/${id}`, { method: "PUT", body: JSON.stringify({ roomType }) }),
    remove: (id: number) => request<void>(`/api/rooms/${id}`, { method: "DELETE" }),
  },
  bookings: {
    create: (data: { customerId: number; tourId: number; roomId?: number | null }) =>
      request<Booking>("/api/bookings", { method: "POST", body: JSON.stringify(data) }),
    setRoom: (id: number, roomId: number | null) =>
      request<Booking>(`/api/bookings/${id}`, { method: "PUT", body: JSON.stringify({ roomId }) }),
    remove: (id: number) => request<void>(`/api/bookings/${id}`, { method: "DELETE" }),
  },
};
