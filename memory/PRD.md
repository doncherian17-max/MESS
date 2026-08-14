# SUPER MILER — Mess Meal Booking

## Product
Publicly accessible mess meal booking web app. Employees book breakfast (10 AM → 11:30 PM day before) and dinner (7 PM day before → 3 PM day of, rolling window). Sundays default to Mess Off; admins can open any Sunday for breakfast, dinner, or both.

## Roles
- Employee — login, book, view current month + ₹ deduction, 6:55 PM dinner reminder toast
- Admin — employees, prices, menus, holidays, Sunday overrides, deductions, cancellations
- Chef — today's counts + menu, live refresh

## Tech stack (production)
- Frontend: React (CRA 5) + Tailwind + Shadcn UI — Vercel
- Backend: FastAPI + Motor + JWT + bcrypt + openpyxl — Render
- DB: MongoDB Atlas M0

## Booking rules (Asia/Kolkata)
- Breakfast: 10:00 AM → 11:30 PM the day before
- Dinner: 7:00 PM day before → 3:00 PM day of (rolling)
- Sunday default = Mess Off; per-meal override (breakfast/dinner/both) via admin

## Latest features
- [x] **Admin Birthday Editor** — Admin → Employees tab now has a Birthdays card with search, month filter, Today-only toggle, Add/Edit/Delete, photo upload with auto-resize to 512×512 JPEG (Pillow, backend), admin comment, and live preview card (Feb 2026)
- [x] SUPER MILER brand rename everywhere
- [x] Sunday Mess Off + per-meal admin override (breakfast/dinner/both)
- [x] Admin **Open Sundays** UI card in Holidays tab (add/remove overrides, per-meal choice, upsert semantics)
- [x] Employee 6:55–7:05 PM in-app **Dinner Reminder** toast (once per day via sessionStorage)
- [x] Today/Tomorrow overline on booking cards; Sunday-off badge
- [x] Next-Day Dinner rolling (opens_at = 7 PM prev day; card rolls to tomorrow after 3 PM cutoff)

## Previously delivered
- Employee-only login (no signup/email)
- Excel bulk employee upload (upsert on Employee ID)
- Meal prices (₹) global settings + monthly deduction on employee dashboard
- Payroll ledger XLSX export
- Delete bookings by date range
- Holiday date ranges
- Cancellation reason banner
- Current-month-only booking history
- Weekly Mon–Sun menu + date-specific overrides
- Chef auto-refresh, emergency cancellations, audit log

## Endpoints (highlights)
- `POST /api/auth/login`
- `GET /api/bookings/status` — returns day_label, sunday_off, cancellation
- `POST /api/bookings` — enforces Sunday guard per meal_type
- `GET/POST /api/admin/sunday-overrides` — per-meal (`meals`: breakfast/dinner/both). Upsert on repeat POST.
- `DELETE /api/admin/sunday-overrides/{date}`
- `GET /api/sunday-off-info` — public policy + upcoming open Sundays
- `GET /api/admin/deductions?month=YYYY-MM`
- `GET /api/admin/payroll-export?month=YYYY-MM`
- `GET /api/admin/birthdays` — list all employee birthdays (photo, comment, mmdd)
- `POST /api/admin/birthdays` — upsert (user_id, mmdd, photo, comment). Photo auto-resized to 512×512 JPEG.
- `PATCH /api/admin/birthdays/{id}` — supports `{mmdd, photo, comment, clear_photo}`
- `DELETE /api/admin/birthdays/{id}`
- `GET /api/birthdays/today` — used by employee dashboard BirthdayModal

## Test credentials
See `/app/memory/test_credentials.md`.
