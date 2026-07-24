"""
Iteration 5 retest — Regression fix for the iter-4 minor bug.

Bug (iter-4): After admin reopens an emergency cancellation, the previously-affected
employee could not re-book because create_booking's existing-row check did not filter
status='emergency_cancelled'. The soft-cancelled row blocked a fresh booking with
400 'You have already booked this meal'.

Fix under retest: create_booking now inspects existing.status; if it is
'emergency_cancelled', the row is revived ($set status='active', new qty/type/created_at
and $unset cancelled_at/cancelled_by) and success (200) is returned with the SAME booking id.

Retest cases:
  1. Full happy path: book -> emergency-cancel -> reopen -> re-book (same id, active).
  2. Aggregation confirmation: re-booked meal is counted in /admin/bookings and /admin/summary.
  3. Fresh employees (not affected by any cancellation) can still book normally.
  4. If cancellation is STILL ACTIVE (not reopened), the same POST /api/bookings
     still returns 400 with the cancellation reason.

Notes:
- Backend only supports meal_type in {breakfast, dinner}. We use "dinner" throughout
  because dinner has no `opens_at` (breakfast bookings only open the day before at 10:00 AM,
  which would block far-future dates in tests).
- /admin/summary uses query params `from` and `to` (aliases). /admin/bookings takes a single `date`.
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

_BE = os.environ.get("REACT_APP_BACKEND_URL") or "https://meal-reserve-32.preview.emergentagent.com"
BASE_URL = _BE.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_NUM = "135791"
ADMIN_PW = "admin@123"

SUFFIX = str(uuid.uuid4())[:6]
EMP_A_NUM = f"IT5A{SUFFIX}"
EMP_A_PW = "pw12345"
EMP_A_EMAIL = f"it5a_{SUFFIX}@example.com"

EMP_FRESH_NUM = f"IT5F{SUFFIX}"
EMP_FRESH_PW = "pw12345"
EMP_FRESH_EMAIL = f"it5f_{SUFFIX}@example.com"

EMP_B_NUM = f"IT5B{SUFFIX}"
EMP_B_PW = "pw12345"
EMP_B_EMAIL = f"it5b_{SUFFIX}@example.com"

MAIN_DATE = (date.today() + timedelta(days=5)).isoformat()   # for rebook flow (test 1 & 2 & 3)
BLOCK_DATE = (date.today() + timedelta(days=6)).isoformat()  # for still-active blocks test


def auth(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"employee_number": ADMIN_NUM, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def emp_a():
    r = requests.post(f"{API}/auth/register", json={
        "employee_number": EMP_A_NUM, "name": "IT5 A", "password": EMP_A_PW, "email": EMP_A_EMAIL,
    }, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "id": d["user"]["id"], "num": EMP_A_NUM}


@pytest.fixture(scope="module")
def emp_fresh():
    r = requests.post(f"{API}/auth/register", json={
        "employee_number": EMP_FRESH_NUM, "name": "IT5 Fresh", "password": EMP_FRESH_PW, "email": EMP_FRESH_EMAIL,
    }, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "id": d["user"]["id"], "num": EMP_FRESH_NUM}


@pytest.fixture(scope="module")
def emp_b():
    r = requests.post(f"{API}/auth/register", json={
        "employee_number": EMP_B_NUM, "name": "IT5 B", "password": EMP_B_PW, "email": EMP_B_EMAIL,
    }, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "id": d["user"]["id"], "num": EMP_B_NUM}


# ---------- Helpers ----------
def _create_emergency(admin_token, meal_date, meal_type="dinner", applies_to="all",
                      employee_ids=None, reason="IT5 retest"):
    payload = {"date": meal_date, "meal_type": meal_type, "applies_to": applies_to, "reason": reason}
    if employee_ids is not None:
        payload["employee_ids"] = employee_ids
    r = requests.post(f"{API}/admin/emergency-cancellations",
                      headers=auth(admin_token), json=payload, timeout=15)
    assert r.status_code == 200, f"Emergency create failed: {r.text}"
    return r.json()["id"]


def _reopen_emergency(admin_token, ec_id):
    r = requests.post(f"{API}/admin/emergency-cancellations/{ec_id}/reopen",
                      headers=auth(admin_token), timeout=15)
    assert r.status_code == 200, f"Reopen failed: {r.text}"


def _cleanup_bookings_for(emp_token):
    try:
        st = requests.get(f"{API}/bookings/status", headers=auth(emp_token), timeout=10).json()
        for i in st.get("items", []):
            if i.get("booked") and i.get("booking_id"):
                requests.delete(f"{API}/bookings/{i['booking_id']}",
                                headers=auth(emp_token), timeout=10)
    except Exception:
        pass


# ---------- Tests ----------
class TestRebookAfterReopen:
    """Regression retest: employee can re-book after admin reopens an emergency cancellation."""

    def test_full_flow_rebook_same_id_and_active(self, admin_token, emp_a):
        # 1) Employee A books DINNER for MAIN_DATE, qty=1
        r = requests.post(f"{API}/bookings", headers=auth(emp_a["token"]), json={
            "meal_type": "dinner", "meal_date": MAIN_DATE,
            "quantity": 1, "booking_type": "dine_in",
        }, timeout=15)
        assert r.status_code == 200, f"Initial booking failed: {r.status_code} {r.text}"
        original_id = r.json()["id"]
        assert r.json()["quantity"] == 1

        # 2) Admin emergency-cancels dinner for MAIN_DATE (applies_to=all)
        ec_id = _create_emergency(admin_token, MAIN_DATE, "dinner", "all",
                                  reason="IT5 retest — full flow")

        # After emergency cancel, /bookings/mine should exclude the row from active view
        st = requests.get(f"{API}/bookings/status", headers=auth(emp_a["token"]), timeout=10).json()
        di = next((x for x in st.get("items", []) if x["meal_type"] == "dinner"), None)
        assert di is not None
        assert di.get("booked") is False, f"Expected booked=False after emergency-cancel: {di}"

        # 3) Admin reopens the emergency
        _reopen_emergency(admin_token, ec_id)

        # 4) Employee A re-books SAME (MAIN_DATE, dinner) qty=2, dine_in
        r2 = requests.post(f"{API}/bookings", headers=auth(emp_a["token"]), json={
            "meal_type": "dinner", "meal_date": MAIN_DATE,
            "quantity": 2, "booking_type": "dine_in",
        }, timeout=15)
        assert r2.status_code == 200, f"Re-book failed: {r2.status_code} {r2.text}"
        payload = r2.json()
        # Same booking id (row was revived, not re-inserted)
        assert payload["id"] == original_id, f"Expected same id {original_id}, got {payload['id']}"
        assert payload["quantity"] == 2
        assert payload["meal_type"] == "dinner"
        assert payload["meal_date"] == MAIN_DATE
        assert payload["booking_type"] == "dine_in"

        # 5) Verify persistence: /bookings/mine shows it as active with qty=2
        mine_month = MAIN_DATE[:7]  # YYYY-MM
        mine = requests.get(f"{API}/bookings/mine",
                            headers=auth(emp_a["token"]),
                            params={"month": mine_month},
                            timeout=10).json()
        mine_items = mine.get("items", []) if isinstance(mine, dict) else mine
        row = next((b for b in mine_items if b.get("id") == original_id), None)
        assert row is not None, f"Re-booked row not in /bookings/mine: {mine}"
        assert row.get("quantity") == 2

    def test_aggregations_include_rebooked_meal(self, admin_token, emp_a):
        """After the previous test, EMP A has an active DINNER booking qty=2 on MAIN_DATE.
        Verify /admin/bookings and /admin/summary include it."""
        # /admin/bookings for that date
        rb = requests.get(f"{API}/admin/bookings",
                          headers=auth(admin_token),
                          params={"date": MAIN_DATE, "meal_type": "dinner"},
                          timeout=15)
        assert rb.status_code == 200, rb.text
        items = rb.json()
        emp_a_row = [b for b in items
                     if b.get("employee_number") == emp_a["num"]
                     and b.get("meal_type") == "dinner"
                     and b.get("meal_date") == MAIN_DATE]
        assert len(emp_a_row) == 1, f"Re-booked row missing in /admin/bookings: {items}"
        assert emp_a_row[0].get("quantity") == 2

        # /admin/summary with alias params `from` and `to`
        rs = requests.get(f"{API}/admin/summary",
                          headers=auth(admin_token),
                          params={"from": MAIN_DATE, "to": MAIN_DATE},
                          timeout=15)
        assert rs.status_code == 200, rs.text
        summary = rs.json()
        # server returns object with `employees` list + totals
        per_emp = summary.get("employees") or summary.get("per_employee") or []
        found = False
        for row in per_emp:
            if row.get("employee_number") == emp_a["num"]:
                assert row.get("dinner_dine_in", 0) >= 2, f"Expected dinner_dine_in>=2 for {emp_a['num']}, got {row}"
                found = True
                break
        assert found, f"Employee {emp_a['num']} missing from /admin/summary: {summary}"
        # Also verify aggregate totals include the re-booked qty
        assert summary.get("total_dinner_dine_in", 0) >= 2

    def test_fresh_employee_can_book_normally(self, emp_fresh):
        """A brand-new employee (never affected) can still book normally on MAIN_DATE dinner."""
        # Emergency for MAIN_DATE dinner was already reopened in test 1, so no active block.
        # Use MAIN_DATE breakfast? No — breakfast opens the day before at 10 AM (blocks far-future).
        # Use a fresh date + dinner to avoid unique-index collision with emp_a's row.
        fresh_date = (date.today() + timedelta(days=7)).isoformat()
        r = requests.post(f"{API}/bookings", headers=auth(emp_fresh["token"]), json={
            "meal_type": "dinner", "meal_date": fresh_date,
            "quantity": 1, "booking_type": "dine_in",
        }, timeout=15)
        assert r.status_code == 200, f"Fresh employee booking failed: {r.status_code} {r.text}"
        d = r.json()
        assert d["meal_type"] == "dinner"
        assert d["meal_date"] == fresh_date
        assert d["quantity"] == 1

    def test_active_cancellation_still_blocks(self, admin_token, emp_b):
        """If the emergency cancellation is STILL ACTIVE (not reopened), POST /api/bookings
        must still return 400 with the cancellation reason."""
        reason = "IT5 retest — still active block"
        ec_id = _create_emergency(admin_token, BLOCK_DATE, "dinner", "all", reason=reason)

        r = requests.post(f"{API}/bookings", headers=auth(emp_b["token"]), json={
            "meal_type": "dinner", "meal_date": BLOCK_DATE,
            "quantity": 1, "booking_type": "dine_in",
        }, timeout=15)
        assert r.status_code == 400, f"Expected 400 while cancellation active, got {r.status_code}: {r.text}"
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        assert reason in detail or "closed by admin" in detail, f"Missing cancellation reason: {detail}"

        # Cleanup: reopen so cleanup path is clean
        _reopen_emergency(admin_token, ec_id)


# ---------- Cleanup ----------
def test_zz_cleanup(admin_token, emp_a, emp_fresh, emp_b):
    for e in (emp_a, emp_fresh, emp_b):
        _cleanup_bookings_for(e["token"])
        try:
            requests.delete(f"{API}/admin/employees/{e['id']}",
                            headers=auth(admin_token), timeout=10)
        except Exception:
            pass
