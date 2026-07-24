# MessBook — Mess Meal Booking

## Original problem statement
> I want to create a website for order food in our mess breakfast and dinner. Login + password required. Each employee identified by their employee number. Book breakfast before 11:30 PM and dinner before 2:30 PM. Each employee sees how many breakfasts/dinners they had in a particular month. Admin can export data to Excel for a date range. Accessible to everyone.

## Architecture
- Backend: FastAPI + MongoDB (Motor async). Auth: JWT Bearer tokens in localStorage.
- Frontend: React (react-scripts) + Tailwind + Shadcn UI. Router: react-router-dom.
- Excel: openpyxl. Email: Emergent-managed Resend via `https://integrations.emergentagent.com/api/v1/email/send`.
- Timezone: Asia/Kolkata.
- Cutoffs: breakfast for date D → 23:30 the day before; dinner for date D → 14:30 same day.

## Roles
- **employee** — self-signup, book/update/cancel own meals, monthly stats
- **chef** — chef dashboard: served/pending totals, employee search, mark meal served
- **admin** — full console: report/export/email, employees, holidays, menu, audit logs
- Default admin: employee_number `135791`, password `admin@123` (seeded on startup). Legacy `626586` was deleted and must not be re-seeded.

## Completed features (Feb 2026)
- [x] JWT login/register with employee_number as identifier
- [x] Booking with `booking_type` (dine_in|parcel) + `quantity` (1-5), cutoff & duplicate prevention
- [x] PATCH bookings (update qty/type before cutoff)
- [x] Cancel bookings before cutoff
- [x] Monthly stats (qty-based, not just count) + booking history
- [x] Admin Excel export (Summary + Bookings sheets) with date range
- [x] Admin email report to any address (HTML summary)
- [x] Chef dashboard (served/pending, dine_in/parcel breakdown, search, mark served)
- [x] Holiday management (blocks bookings on chosen dates for breakfast/dinner/both)
- [x] Menu planner (per date + meal, shown on employee cards)
- [x] Weekly Menu Management (Feb 2026) — Monday–Sunday recurring template with separate breakfast & dinner slots, multi-line item entry, date-specific overrides winning over weekly. Chef dashboard displays today's resolved menu next to booking counts. Employees see today's items on booking cards.
- [x] Audit logs (booking create/cancel/serve, employee/holiday/menu CRUD, report ops)
- [x] Forgot / reset / change password (Resend email)
- [x] Dark / light theme toggle
- [x] Role-based route protection (/dashboard, /admin, /chef)

## Backlog / next
- P1: Email attachment of Excel file (current email report is HTML-only summary)
- P1: Auto-refresh chef dashboard every 30s during service
- P2: Bulk employee CSV import
- P2: Charts (weekly trend, top eaters) on admin dashboard
- P2: Session-timeout warning modal
- P3: Meal ratings / feedback after each served meal

## Files map
- `/app/backend/server.py` — all API (auth, bookings, chef, admin, menu, holidays, audit, email)
- `/app/frontend/src/App.js` — routes + protected wrapper
- `/app/frontend/src/context/AuthContext.jsx`, `ThemeContext.jsx`
- `/app/frontend/src/pages/LoginPage.jsx`, `SignupPage.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, `EmployeeDashboard.jsx`, `AdminDashboard.jsx`, `ChefDashboard.jsx`
- `/app/frontend/src/components/TopBar.jsx`, `ChangePasswordDialog.jsx`
