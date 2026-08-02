"""Iteration 8 tests: booking_status fix + is_sunday_blocked per-meal logic.

Covers:
- Employee & Admin login
- GET /api/bookings/status returns 200 with new fields (day_label, sunday_off, cancellation)
- Sunday overrides per-meal permutations via POST /api/bookings
- Regression: /bookings/mine, /admin/employees, PATCH employee (password reset),
  /admin/deductions, /admin/payroll-export, /admin/sunday-overrides CRUD,
  /admin/holidays, /settings/prices
"""

import os
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMP = "135791"
ADMIN_PW = "admin@123"
EMP_EMP = "612480"
EMP_PW = "newpass123"


def _login(emp, pw):
    r = requests.post(f"{API}/auth/login", json={"employee_number": emp, "password": pw}, timeout=15)
    return r


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_EMP, ADMIN_PW)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def employee_token():
    r = _login(EMP_EMP, EMP_PW)
    assert r.status_code == 200, f"employee login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def next_sunday_iso():
    today = date.today()
    days_ahead = (6 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return (today + timedelta(days=days_ahead)).isoformat()


# ------------- Auth -------------

def test_admin_login():
    r = _login(ADMIN_EMP, ADMIN_PW)
    assert r.status_code == 200
    j = r.json()
    assert "token" in j
    assert j.get("user", {}).get("role") == "admin"


def test_employee_login():
    r = _login(EMP_EMP, EMP_PW)
    assert r.status_code == 200
    assert r.json().get("user", {}).get("role") in ("employee", "user", "staff")


# ------------- The main bug fix -------------

def test_bookings_status_returns_200_with_new_fields(employee_token):
    r = requests.get(f"{API}/bookings/status",
                     headers={"Authorization": f"Bearer {employee_token}"}, timeout=15)
    assert r.status_code == 200, f"/bookings/status failed: {r.status_code} {r.text}"
    j = r.json()
    assert "items" in j and isinstance(j["items"], list)
    meal_types = {it["meal_type"] for it in j["items"]}
    assert meal_types == {"breakfast", "dinner"}, f"expected both meals, got {meal_types}"
    for it in j["items"]:
        assert "day_label" in it
        assert "sunday_off" in it and isinstance(it["sunday_off"], bool)
        assert "cancellation" in it  # nullable


# ------------- Sunday per-meal permutations -------------

def _delete_override(admin_token, d):
    requests.delete(f"{API}/admin/sunday-overrides/{d}",
                    headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)


def _set_override(admin_token, d, meals):
    r = requests.post(f"{API}/admin/sunday-overrides",
                      headers={"Authorization": f"Bearer {admin_token}"},
                      json={"date": d, "meals": meals}, timeout=10)
    assert r.status_code == 200, f"set override failed: {r.text}"


def _try_book(employee_token, d, meal):
    return requests.post(f"{API}/bookings",
                         headers={"Authorization": f"Bearer {employee_token}"},
                         json={"meal_date": d, "meal_type": meal, "quantity": 1,
                               "booking_type": "dine_in"}, timeout=10)


def _blocked_by_sunday(resp):
    if resp.status_code != 400:
        return False
    detail = (resp.json().get("detail") or "").lower()
    return "sunday" in detail and "mess off" in detail


def _allowed_or_non_sunday_block(resp):
    """True if not blocked by Sunday rule (could be cutoff/opens_at/etc, but NOT sunday)."""
    if resp.status_code == 200:
        return True
    if resp.status_code == 400:
        detail = (resp.json().get("detail") or "").lower()
        return not ("sunday is mess off" in detail)
    return False


def _override_roundtrip(admin_token, d, meals):
    """Set an override and verify it comes back via GET with correct meals value."""
    _set_override(admin_token, d, meals)
    r = requests.get(f"{API}/admin/sunday-overrides",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200
    row = next((x for x in r.json() if x["date"] == d), None)
    assert row is not None, f"override for {d} not found"
    assert row["meals"] == meals, f"expected meals={meals}, got {row['meals']}"


def test_sunday_override_permutations_stored_correctly(admin_token, next_sunday_iso):
    """Verify admin-side per-meal override storage (breakfast/dinner/both)."""
    _delete_override(admin_token, next_sunday_iso)
    for meals in ("breakfast", "dinner", "both"):
        _override_roundtrip(admin_token, next_sunday_iso, meals)
    _delete_override(admin_token, next_sunday_iso)


def test_sunday_block_via_create_booking_when_in_window(admin_token, employee_token, next_sunday_iso):
    """When the Sunday date is inside its booking window (opens_at has passed) we should
    see a Sunday-specific 400. Otherwise create_booking returns opens_at 400 first (expected).
    This test asserts the per-meal logic end-to-end only when we're in-window; else it just
    validates that create_booking never returned an unexpected 500."""
    from datetime import datetime
    today = date.today()
    # Sunday's breakfast opens at Saturday 10:00 local; dinner opens Saturday 19:00.
    # We're in-window if today is Saturday AND current time past those hours, OR if today is Sunday.
    tomorrow_is_sunday = (today.weekday() == 5)  # Sat -> tomorrow Sun
    in_window = tomorrow_is_sunday or today.weekday() == 6

    # No override => both should be blocked (or opens_at pending)
    _delete_override(admin_token, next_sunday_iso)
    rb = _try_book(employee_token, next_sunday_iso, "breakfast")
    rd = _try_book(employee_token, next_sunday_iso, "dinner")
    assert rb.status_code in (200, 400), f"unexpected: {rb.status_code} {rb.text}"
    assert rd.status_code in (200, 400), f"unexpected: {rd.status_code} {rd.text}"
    if in_window:
        assert _blocked_by_sunday(rb) or "opens" in rb.text.lower()
        assert _blocked_by_sunday(rd) or "opens" in rd.text.lower()

    # Override for breakfast only
    _set_override(admin_token, next_sunday_iso, "breakfast")
    rb = _try_book(employee_token, next_sunday_iso, "breakfast")
    rd = _try_book(employee_token, next_sunday_iso, "dinner")
    # dinner must not be allowed (still Sunday-blocked or opens-pending)
    assert not (rd.status_code == 200), "dinner should NOT succeed with breakfast-only override"

    # Override for both -> Sunday rule must not fire for either
    _set_override(admin_token, next_sunday_iso, "both")
    rb = _try_book(employee_token, next_sunday_iso, "breakfast")
    rd = _try_book(employee_token, next_sunday_iso, "dinner")
    assert not _blocked_by_sunday(rb), f"breakfast still sunday-blocked with meals=both: {rb.text}"
    assert not _blocked_by_sunday(rd), f"dinner still sunday-blocked with meals=both: {rd.text}"

    _delete_override(admin_token, next_sunday_iso)


def test_sunday_off_field_in_booking_status(employee_token, admin_token, next_sunday_iso):
    """If tomorrow is Sunday, verify sunday_off field flips based on override."""
    today = date.today()
    if today.weekday() != 5:  # Sat -> tomorrow Sun
        pytest.skip("Tomorrow is not Sunday; sunday_off flip test only applicable then")

    _delete_override(admin_token, next_sunday_iso)
    r = requests.get(f"{API}/bookings/status",
                     headers={"Authorization": f"Bearer {employee_token}"}, timeout=10)
    assert r.status_code == 200
    bf = next(i for i in r.json()["items"] if i["meal_type"] == "breakfast")
    assert bf["sunday_off"] is True

    _set_override(admin_token, next_sunday_iso, "both")
    r = requests.get(f"{API}/bookings/status",
                     headers={"Authorization": f"Bearer {employee_token}"}, timeout=10)
    bf = next(i for i in r.json()["items"] if i["meal_type"] == "breakfast")
    assert bf["sunday_off"] is False
    _delete_override(admin_token, next_sunday_iso)


# ------------- Regression -------------

def test_bookings_mine(employee_token):
    r = requests.get(f"{API}/bookings/mine",
                     headers={"Authorization": f"Bearer {employee_token}"}, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), (list, dict))


def test_admin_employees_list(admin_token):
    r = requests.get(f"{API}/admin/employees",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_reset_employee_password_and_relogin(admin_token):
    # find the employee
    r = requests.get(f"{API}/admin/employees",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    emp = next((e for e in r.json() if e.get("employee_number") == EMP_EMP), None)
    assert emp, "test employee 612480 not found"
    emp_id = emp.get("id") or emp.get("_id")
    # rotate password to a new value, then back to the known one
    tmp_pw = "TmpPw123!"
    r1 = requests.patch(f"{API}/admin/employees/{emp_id}",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        json={"password": tmp_pw}, timeout=10)
    assert r1.status_code == 200, f"patch password failed: {r1.text}"
    assert _login(EMP_EMP, tmp_pw).status_code == 200
    r2 = requests.patch(f"{API}/admin/employees/{emp_id}",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        json={"password": EMP_PW}, timeout=10)
    assert r2.status_code == 200
    assert _login(EMP_EMP, EMP_PW).status_code == 200


def test_admin_deductions(admin_token):
    r = requests.get(f"{API}/admin/deductions",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200


def test_admin_payroll_export_xlsx(admin_token):
    today = date.today()
    month = f"{today.year:04d}-{today.month:02d}"
    r = requests.get(f"{API}/admin/payroll-export",
                     headers={"Authorization": f"Bearer {admin_token}"},
                     params={"month": month}, timeout=30)
    assert r.status_code == 200, f"payroll export failed: {r.status_code} {r.text[:200]}"
    ctype = r.headers.get("content-type", "")
    assert "spreadsheet" in ctype or "xlsx" in ctype or "octet-stream" in ctype, \
        f"unexpected content-type: {ctype}"


def test_admin_sunday_overrides_crud(admin_token, next_sunday_iso):
    # POST
    r = requests.post(f"{API}/admin/sunday-overrides",
                      headers={"Authorization": f"Bearer {admin_token}"},
                      json={"date": next_sunday_iso, "meals": "both"}, timeout=10)
    assert r.status_code == 200
    # GET
    r = requests.get(f"{API}/admin/sunday-overrides",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200
    assert any(x["date"] == next_sunday_iso for x in r.json())
    # DELETE
    r = requests.delete(f"{API}/admin/sunday-overrides/{next_sunday_iso}",
                        headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200


def test_admin_holidays(admin_token):
    r = requests.get(f"{API}/admin/holidays",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200


def test_settings_prices_get_put(admin_token):
    r = requests.get(f"{API}/settings/prices",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200
    original = r.json()
    # PUT unchanged values to verify write path
    payload = {k: v for k, v in original.items() if k in ("breakfast", "dinner", "breakfast_price", "dinner_price")}
    if not payload:
        payload = original
    r2 = requests.put(f"{API}/admin/settings/prices",
                      headers={"Authorization": f"Bearer {admin_token}"},
                      json=payload, timeout=10)
    assert r2.status_code in (200, 204)


def test_non_sunday_not_blocked(admin_token, employee_token):
    # find next Monday (weekday=0)
    today = date.today()
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    mon = (today + timedelta(days=days_ahead)).isoformat()
    r = _try_book(employee_token, mon, "breakfast")
    # Should NOT be sunday-blocked. Could be cutoff/opens_at/duplicate/success.
    assert not _blocked_by_sunday(r), f"Monday incorrectly Sunday-blocked: {r.status_code} {r.text}"
