const pad = (n: number) => String(n).padStart(2, "0");

// Calendar date in the user's own timezone as YYYY-MM-DD. toISOString() would give the UTC date,
// which is the previous day for the first hours of an Australian morning.
export const localDate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const localDateOffset = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
};
