export type Customer = {
  id: number;
  title: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  streetAddress: string | null;
  state: string | null;
  postcode: string | null;
  dietaries: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Tour = {
  id: number;
  tourName: string;
  departureDate: string;
  returnDate: string;
  numDays: number;
  price: number | null;
  totalPassengers: number | null;
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
    get: (id: number) => request<Tour & { passengers: any[] }>(`/api/tours/${id}`),
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
  bookings: {
    create: (data: { customerId: number; tourId: number }) =>
      request<Booking>("/api/bookings", { method: "POST", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/bookings/${id}`, { method: "DELETE" }),
  },
};
