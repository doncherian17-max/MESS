# SUPER MILER — Mess Meal Booking

## Product
Publicly accessible mess meal booking web app for breakfast and dinner. Employees log in, book breakfast between 10:00 AM and 11:30 PM the day before, and book dinner from **7:00 PM the previous day** until **3:00 PM the day of** (Next-Day Dinner rolling window).

## Roles
- Employee — login, book meals, view current-month bookings + ₹ deduction
- Admin — full ops (employees, prices, menus, holidays, deductions, cancellations, sunday overrides)
- Chef — see today's counts and menu, mark as served

## Tech stack (production)
- Frontend: React (CRA 5), Tailwind + Shadcn UI, Recharts, Lucide — deployed on Vercel
- Backend: FastAPI + Motor + JWT + bcrypt + openpyxl — deployed on Render
- Database: MongoDB Atlas (M0 free tier)
- No email dispatch (removed Feb 2026)

## Booking windows (Asia/Kolkata)
- **Breakfast** (for tomorrow): 10:00 AM → 11:30 PM the day before
- **Dinner** (Next-Day Dinner rolling): 7:00 PM the day before → 3:00 PM the day of
- **Sundays**: Mess Off by default — bookings blocked. Admin can whitelist any Sunday via `sunday_overrides`.

## Features implemented (latest)
- [x] Rename SUPER MILLER → **SUPER MILER** everywhere
- [x] **Sunday = Mess Off** by default; blocked in `create_booking` via `is_sunday_blocked()`
- [x] **Admin Sunday Override** endpoints: GET/POST/DELETE `/api/admin/sunday-overrides` (validates weekday == Sunday)
- [x] **Next-Day Dinner** window: dinner opens 7:00 PM previous day; booking card auto-rolls to Tomorrow after 3 PM cutoff
- [x] Employee dashboard shows explicit **"Booking for TODAY" / "Booking for TOMORROW"** (green/red overline)
- [x] "Sunday · Mess Off" badge on meal card when applicable
- [x] `sunday_overrides` collection with unique index on `date`
- [x] Public `/api/sunday-off-info` endpoint

## Previously delivered
- Employee-only login (self-signup + email removed)
- Excel bulk employee upload (Employee ID · Name · Password); upsert
- Meal prices (₹) global settings
- Monthly ₹ deduction on employee dashboard
- Payroll ledger export (`GET /api/admin/payroll-export?month=YYYY-MM`)
- Delete bookings by date range
- Holidays as date ranges (From – To)
- Cancellation reason banner
- Current-month-only booking history
- Weekly Mon–Sun menu with date-specific overrides
- Admin/chef live counts, emergency cancellations, audit log

## Performance
- Existing indexes: users.employee_number (unique), bookings (compound + meal_date), holidays.date (unique), menus (compound unique), weekly_menus (compound unique), audit_logs.timestamp, sunday_overrides.date (unique)
- Frontend already uses code-splitting via CRA + lazy hydration; toasts are non-blocking; auto-refresh only on chef page
- Note: to compress assets further, add `compression` middleware or serve via Cloudflare (out of scope for this task)

## Test credentials
See `/app/memory/test_credentials.md`.
