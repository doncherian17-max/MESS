# SUPER MILLER — Mess Meal Booking

## Original problem
Publicly accessible mess meal booking web app for breakfast and dinner. Employees log in, book breakfast before 11:30 PM and dinner before 3:00 PM (updated from 2:30 PM), view current-month meal totals and ₹ deductions. Admins create/update employee accounts via Excel upload, set meal prices, manage weekly menus, mark holidays as date ranges, and delete booking data by date range.

## Roles
- Employee — login, book meals, view current month bookings and monthly ₹ deduction
- Admin — full ops (employees, prices, menus, holidays, reports, deductions, cancellations)
- Chef — see today's counts and menu, mark as served

## Tech stack (production)
- Frontend: React (CRA 5), Tailwind + Shadcn UI, Recharts, Lucide icons — deployed on Vercel
- Backend: FastAPI + Motor + JWT + bcrypt + openpyxl — deployed on Render
- Database: MongoDB Atlas (M0 free tier)
- No email dispatch (removed Feb 2026 per requirements)

## Deployment
- render.yaml at repo root (rootDir: backend)
- backend/requirements-prod.txt (slim; used by Render)
- frontend/vercel.json (yarn install, CI=false so ESLint warnings don't fail builds)
- CORS_ORIGINS env var must include Vercel URL

## Features implemented
- [x] Employee login only (self-signup removed)
- [x] Admin/chef/employee role separation
- [x] Booking with dine-in/parcel + quantity
- [x] Booking cutoffs: Breakfast 11:30 PM, Dinner 3:00 PM (updated Feb 2026)
- [x] Weekly menu Mon–Sun with breakfast/dinner + date override
- [x] Date-specific menu overrides weekly template
- [x] Excel upload for bulk employee create/update (Employee ID, Name, Password); duplicate ID → update name + reset password
- [x] Meal prices (₹) global settings — breakfast + dinner
- [x] Admin deductions view — per-employee current-month totals in ₹
- [x] Delete bookings by date range (keeps employees)
- [x] Holidays as date ranges (From – To)
- [x] Cancellation reason banner on employee dashboard (big red banner)
- [x] Current-month-only booking history for employees
- [x] Excel report export (download)
- [x] Emergency cancellations with reason
- [x] Audit log
- [x] SUPER MILLER red-branded UI throughout
- [x] Footer credit: Baratie renamed to SUPER MILLER; "Designed & Developed by Don Cherian & Arjun T S"
- [x] Chef auto-refresh + live booking counts

## Removed (Feb 2026 per user)
- Self-registration (/signup, /auth/register)
- Forgot/reset password (/forgot-password, /reset-password)
- Email sending (Resend/Emergent Email integration) — `send_email_async` and `send_apology_email` retained as no-op stubs for backwards compatibility
- Email column requirement (email still stored in DB but hidden from UI)
- /admin/email-report endpoint
- /admin/employees/{id}/send-reset-email endpoint
- RequireEmailGate component

## Key endpoints
- POST /api/auth/login
- GET/PATCH /api/auth/me, POST /api/auth/change-password
- GET /api/settings/prices (any auth)
- PUT /api/admin/settings/prices
- GET /api/admin/deductions?month=YYYY-MM
- POST /api/admin/bookings/range-delete
- POST /api/admin/employees/bulk (accepts .xlsx: Employee ID, Name, Password)
- POST /api/admin/holidays (with optional end_date)
- GET /api/bookings/mine (current month only, includes deduction)
- GET /api/bookings/status (now returns cancellation.reason when a meal is emergency-cancelled)
- GET/PUT/DELETE /api/admin/weekly-menu

## Test credentials
See `/app/memory/test_credentials.md`.

## Known trade-offs
- Report emailing removed by product decision — Excel can still be downloaded
- Free Render tier cold-starts ~30 s after 15 min idle
