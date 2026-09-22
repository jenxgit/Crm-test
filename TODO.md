# Mini CRM to-do

## Planned features
- [ ] Add hostess and driver to the tour sheet and to the seat/room calculations
- [ ] Cost per person for each room (single supplement applies to Single rooms)
- [ ] Total $ booking value (per tour, and per customer/booking)
- [ ] Payments (deposit, pay 1, pay 2, balance, date deposited) and a payments table
- [ ] Waitlist (per tour; convert to booking when a seat opens)

## Also worth doing
- [ ] **Deploy + import to live.** Everything below the schema is local only. Live D1 has the tables and columns, but no tours, customers, bookings or rooms. Decide when to load the 2023/2024 data live, then `npm run deploy` (needs `npx wrangler login`).
- [ ] **Login / access control before deploying.** The app has no authentication and holds addresses, DOBs and emails. Put it behind Cloudflare Access (or similar) first.
- [ ] Edit tour details in the UI (code, dates, price, single supp, seats, rooms). Currently only settable when a tour is created.
- [ ] Way to delete a room in the UI (the button was removed; the API still supports it)
- [ ] Days calculation: app shows return minus departure (e.g. 13); the sheet counts both days (14). Decide which to use.
- [ ] Group tours (HX Hunter Valley, CY Cowra) only have the group contact, not the individual members
- [ ] Import the sheet notes (room holds, "wants to book" comments, waiting-list notes), likely as tasks or waitlist entries
- [ ] Tours without tabs yet: OR-290424, VH-050524, TW-190924, RV-251024, MP-041124 (and MF-180324 / NF-080424 have no passengers yet)
- [ ] Kevin and Kay on TA-280224: surname missing in the sheet, so they weren't imported
- [ ] Passenger count mismatches vs the cover sheet: DK-300723, FR-220823, WA-040923, ML-291023, NF-250923 (3 extra unassigned McNamara rows), TA-081123, MP-091023
- [ ] Possible duplicate customers where two people share a name and have no DOB (they were merged on import)
- [ ] Import older years (2014-2022) if wanted
- [ ] Backups / export (CSV or Excel) for the live database
- [ ] Wrangler compatibility-date warning and 13 npm audit findings
- [ ] Local dev DB has a leftover test customer named "a a" (customer id 1)
