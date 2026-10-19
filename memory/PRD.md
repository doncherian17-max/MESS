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
- [x] **Daily Scratch & Win** (2026-10-19) — User request: "Add a Daily Scratch & Win feature… Admin should be able to set daily dinner booking targets, number of winners, rewards, and toggle the feature. Employees who booked dinner get a scratch card once the target is reached." Each dinner date (today + tomorrow, IST) is its own campaign. Admin → Scratch & Win tab: enable toggle, target, winners/day, winner message (default "WINNER", no payroll effect), live day cards, history. Employee dashboard: locked progress → canvas scratch card → WINNER popup with confetti; unlock toast. Backend: `secrets` random draw (slots_left/remaining_players), atomic winner counter, unique (user_id, dinner_date) attempts → no duplicates (409). Employee cancelling a dinner after scratching forfeits the attempt (win slot freed, cannot re-scratch). Endpoints: `GET /api/scratch/status`, `POST /api/scratch/play`, `GET/PUT /api/admin/scratch/config`, `GET /api/admin/scratch/overview`, `GET /api/admin/scratch/history`. Collections: scratch_config, scratch_days, scratch_attempts. Tested iteration_14 (100%).
- [x] **Birthdays Ergonomics** — Add-birthday dialog now supports (a) an admin comment textbox that appears on the celebration card, (b) an 'Existing / New employee' toggle so admins can register a brand-new employee (Employee ID + Name) on the fly with password = Employee ID, and (c) the Existing list now shows ALL employees with a 'has DOB' badge for those already set (selecting them overwrites). Multi-birthday celebration popup now shows ALL of today's birthdays in one scrollable grid instead of prev/next navigation. (Feb 2026)
- [x] **Admin Custom Special Days** — New Admin → Special days tab with full CRUD (add, edit, delete) for greeting popups. Fields: MMDD, name, message, emoji picker + live preview. Endpoints: GET/POST/PATCH/DELETE `/api/admin/special-days`. Employees see the popup + banner on the matching date (Feb 2026)
- [x] **Birthdays as a Standalone Tab** — Moved out of Employees tab into its own Admin → Birthdays top-level tab. Simplified UI (no photo). New `POST /api/admin/birthdays/bulk-import` accepts Excel with columns Employee ID, Name, Birthday; auto-creates missing employees (password = Employee ID); reports created/added/updated/errors (Feb 2026)
- [x] **Breakfast Serving-Time Slots** — Employees can pick 7:15 AM or 9:15 AM when booking breakfast. Slot is stored on the booking, editable via PATCH, and aggregated in `/api/admin/today` (`breakfast_slots_today` / `_tomorrow`) and `/api/chef/summary` (`slot_7_15` / `slot_9_15`). Admin KPI cards and Chef breakfast card show per-slot counts. Dinner unchanged. Legacy breakfast bookings without a slot count into 7:15 for backward compat. (Feb 2026)
- [x] **Special Day Greeting Popup** — Employee dashboard now pops a festive modal on login when the day is a configured special day (Independence Day, Republic Day, Gandhi Jayanti, etc.) with themed gradient + emoji confetti. Also wired the previously-orphaned greeting banner. Once-per-day via sessionStorage. (Feb 2026)
- [x] **Birthday Cheer Sound** — Birthday modal plays a synthesized ~3s cheer chime on open (Web Audio API, no external asset). Mute toggle (Volume2/VolumeX icon top-left) persists in localStorage (Feb 2026)
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

## Backlog
- P1: Split backend/server.py into routes/models modules
- P2: CI smoke suite (pytest) for core endpoints
- Scratch & Win ideas: "All prizes claimed" state when winners_left = 0; per-day config snapshot

## Test credentials
See `/app/memory/test_credentials.md`.
