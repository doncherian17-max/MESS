"""Iteration 11: Breakfast serving-time slot (7:15 / 9:15) - end-to-end pytest coverage.

Covers:
- POST /api/bookings (breakfast slot accepted, default 7:15, 422 on invalid)
- POST /api/bookings (dinner ignores breakfast_slot)
- PATCH /api/bookings/{id} for breakfast + dinner
- GET /api/bookings/status includes breakfast_slot
- GET /api/admin/today includes breakfast_slots_today / _tomorrow
- GET /api/chef/summary includes slot_7_15 / slot_9_15
- GET /api/chef/bookings and /api/admin/bookings include breakfast_slot
- POST /api/admin/bookings override with breakfast_slot
"""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for local runs; frontend/.env is source of truth
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_NUM = "135791"
ADMIN_PWD = "admin@123"
EMP_NUM = "16272"
EMP_PWD = "test1234"

IST = timezone(timedelta(hours=5, minutes=30))


def _login(session: requests.Session, num: str, pwd: str) -> str:
    r = session.post(f"{BASE_URL}/api/auth/login", json={"employee_number": num, "password": pwd})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json().get("token", "")


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    tok = _login(s, ADMIN_NUM, ADMIN_PWD)
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def emp_client():
    s = requests.Session()
    tok = _login(s, EMP_NUM, EMP_PWD)
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def emp_user_id(emp_client):
    r = emp_client.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    return r.json().get("id") or r.json().get("_id") or r.json().get("user_id")


def _future_breakfast_date() -> str:
    # Booking window for tomorrow breakfast opens the day before (4:30 AM). Use tomorrow.
    now = datetime.now(IST)
    d = now.date() + timedelta(days=1)
    if d.weekday() == 6:  # Sunday Mess Off
        d = d + timedelta(days=1)
    return d.isoformat()


def _future_dinner_date() -> str:
    now = datetime.now(IST)
    d = now.date() + timedelta(days=1)
    if d.weekday() == 6:
        d = d + timedelta(days=1)
    return d.isoformat()


def _cleanup(admin_client: requests.Session, booking_id: str):
    try:
        admin_client.delete(f"{BASE_URL}/api/admin/bookings/{booking_id}")
    except Exception:
        pass


# ---------- create breakfast booking ----------
class TestBreakfastSlot:
    def test_create_breakfast_default_slot(self, emp_client, admin_client):
        date = _future_breakfast_date()
        # ensure clean
        _pre_cleanup(admin_client, EMP_NUM, date, "breakfast")
        r = emp_client.post(f"{BASE_URL}/api/bookings", json={
            "meal_type": "breakfast", "meal_date": date, "quantity": 1,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["breakfast_slot"] == "7:15"
        _cleanup(admin_client, data["id"])

    def test_create_breakfast_slot_915(self, emp_client, admin_client):
        date = _future_breakfast_date()
        _pre_cleanup(admin_client, EMP_NUM, date, "breakfast")
        r = emp_client.post(f"{BASE_URL}/api/bookings", json={
            "meal_type": "breakfast", "meal_date": date, "quantity": 2,
            "breakfast_slot": "9:15",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["breakfast_slot"] == "9:15"
        assert data["quantity"] == 2
        _cleanup(admin_client, data["id"])

    def test_invalid_slot_rejected(self, emp_client):
        date = _future_breakfast_date()
        r = emp_client.post(f"{BASE_URL}/api/bookings", json={
            "meal_type": "breakfast", "meal_date": date, "breakfast_slot": "8:00",
        })
        assert r.status_code == 422, r.text

    def test_dinner_ignores_slot(self, admin_client, emp_user_id):
        # Use admin override to bypass dinner cutoff window; verify field is not persisted for dinner.
        date = _future_dinner_date()
        _pre_cleanup(admin_client, EMP_NUM, date, "dinner")
        r = admin_client.post(f"{BASE_URL}/api/admin/bookings", json={
            "user_id": emp_user_id, "meal_type": "dinner", "meal_date": date,
            "quantity": 1, "breakfast_slot": "9:15", "reason": "TEST_dinner_ignore",
        })
        assert r.status_code == 200, r.text
        bk_id = r.json()["id"]
        r2 = admin_client.get(f"{BASE_URL}/api/admin/bookings?date={date}&meal_type=dinner")
        assert r2.status_code == 200
        items = [x for x in r2.json() if x["id"] == bk_id]
        assert len(items) == 1
        assert items[0]["breakfast_slot"] is None
        _cleanup(admin_client, bk_id)


def _pre_cleanup(admin_client, emp_num, date, meal_type):
    r = admin_client.get(f"{BASE_URL}/api/admin/bookings?date={date}&meal_type={meal_type}")
    if r.status_code == 200:
        for it in r.json():
            if it["employee_number"] == emp_num:
                admin_client.delete(f"{BASE_URL}/api/admin/bookings/{it['id']}")


# ---------- PATCH ----------
class TestPatchSlot:
    def test_patch_breakfast_slot(self, emp_client, admin_client):
        date = _future_breakfast_date()
        _pre_cleanup(admin_client, EMP_NUM, date, "breakfast")
        r = emp_client.post(f"{BASE_URL}/api/bookings", json={
            "meal_type": "breakfast", "meal_date": date, "breakfast_slot": "7:15",
        })
        assert r.status_code == 200
        bid = r.json()["id"]
        try:
            r2 = emp_client.patch(f"{BASE_URL}/api/bookings/{bid}", json={"breakfast_slot": "9:15"})
            assert r2.status_code == 200, r2.text
            # Verify via status endpoint
            r3 = emp_client.get(f"{BASE_URL}/api/bookings/status")
            assert r3.status_code == 200
            found = [it for it in r3.json()["items"] if it.get("booking_id") == bid]
            assert len(found) == 1
            assert found[0]["breakfast_slot"] == "9:15"
        finally:
            _cleanup(admin_client, bid)

    def test_patch_dinner_slot_ignored(self, emp_client, admin_client, emp_user_id):
        date = _future_dinner_date()
        _pre_cleanup(admin_client, EMP_NUM, date, "dinner")
        # Use admin override to create dinner (bypasses cutoff window)
        r = admin_client.post(f"{BASE_URL}/api/admin/bookings", json={
            "user_id": emp_user_id, "meal_type": "dinner", "meal_date": date,
            "quantity": 1, "reason": "TEST_patch_dinner",
        })
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        try:
            # PATCH by employee should be blocked because after admin override cutoff may have passed;
            # but if it succeeds, breakfast_slot must not be persisted for dinner.
            r2 = emp_client.patch(f"{BASE_URL}/api/bookings/{bid}", json={"breakfast_slot": "9:15"})
            # Either 400 (cutoff) or 200 with slot ignored — both acceptable for dinner
            r3 = admin_client.get(f"{BASE_URL}/api/admin/bookings?date={date}&meal_type=dinner")
            items = [x for x in r3.json() if x["id"] == bid]
            assert len(items) == 1
            assert items[0]["breakfast_slot"] is None
        finally:
            _cleanup(admin_client, bid)


# ---------- GET status / admin/today / chef/summary ----------
class TestAggregations:
    def test_status_has_slot_field(self, emp_client):
        r = emp_client.get(f"{BASE_URL}/api/bookings/status")
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert "breakfast_slot" in it
            if it["meal_type"] == "dinner":
                assert it["breakfast_slot"] is None

    def test_admin_today_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/today")
        assert r.status_code == 200
        d = r.json()
        for k in ("breakfast_slots_today", "breakfast_slots_tomorrow",
                  "breakfast_today", "breakfast_tomorrow"):
            assert k in d, f"missing {k}"
        for slot_field in ("breakfast_slots_today", "breakfast_slots_tomorrow"):
            assert "7:15" in d[slot_field]
            assert "9:15" in d[slot_field]
            assert isinstance(d[slot_field]["7:15"], int)
            assert isinstance(d[slot_field]["9:15"], int)
        # legacy total = slot 7:15 + slot 9:15
        assert d["breakfast_today"] == d["breakfast_slots_today"]["7:15"] + d["breakfast_slots_today"]["9:15"]
        assert d["breakfast_tomorrow"] == d["breakfast_slots_tomorrow"]["7:15"] + d["breakfast_slots_tomorrow"]["9:15"]

    def test_chef_summary_slots(self, admin_client, emp_client):
        date = _future_breakfast_date()
        _pre_cleanup(admin_client, EMP_NUM, date, "breakfast")
        r = emp_client.post(f"{BASE_URL}/api/bookings", json={
            "meal_type": "breakfast", "meal_date": date, "quantity": 3, "breakfast_slot": "9:15",
        })
        bid = r.json()["id"]
        try:
            r2 = admin_client.get(f"{BASE_URL}/api/chef/summary?date={date}")
            assert r2.status_code == 200
            bf = r2.json()["breakfast"]
            assert "slot_7_15" in bf
            assert "slot_9_15" in bf
            assert bf["slot_9_15"] >= 3
            # dinner block should not include slot fields
            din = r2.json()["dinner"]
            assert "slot_7_15" not in din
            assert "slot_9_15" not in din
        finally:
            _cleanup(admin_client, bid)

    def test_chef_bookings_and_admin_bookings_include_slot(self, admin_client, emp_client):
        date = _future_breakfast_date()
        _pre_cleanup(admin_client, EMP_NUM, date, "breakfast")
        r = emp_client.post(f"{BASE_URL}/api/bookings", json={
            "meal_type": "breakfast", "meal_date": date, "breakfast_slot": "9:15",
        })
        bid = r.json()["id"]
        try:
            r2 = admin_client.get(f"{BASE_URL}/api/chef/bookings?date={date}&meal_type=breakfast")
            assert r2.status_code == 200
            items = [x for x in r2.json() if x["id"] == bid]
            assert items and items[0]["breakfast_slot"] == "9:15"

            r3 = admin_client.get(f"{BASE_URL}/api/admin/bookings?date={date}&meal_type=breakfast")
            assert r3.status_code == 200
            items = [x for x in r3.json() if x["id"] == bid]
            assert items and items[0]["breakfast_slot"] == "9:15"
        finally:
            _cleanup(admin_client, bid)


# ---------- Admin override with slot ----------
class TestAdminOverride:
    def test_admin_override_stores_slot(self, admin_client, emp_user_id):
        date = _future_breakfast_date()
        _pre_cleanup(admin_client, EMP_NUM, date, "breakfast")
        r = admin_client.post(f"{BASE_URL}/api/admin/bookings", json={
            "user_id": emp_user_id, "meal_type": "breakfast", "meal_date": date,
            "quantity": 1, "breakfast_slot": "9:15", "reason": "TEST_slot",
        })
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        try:
            r2 = admin_client.get(f"{BASE_URL}/api/admin/bookings?date={date}&meal_type=breakfast")
            items = [x for x in r2.json() if x["id"] == bid]
            assert items and items[0]["breakfast_slot"] == "9:15"
        finally:
            _cleanup(admin_client, bid)

    def test_admin_override_dinner_ignores_slot(self, admin_client, emp_user_id):
        date = _future_dinner_date()
        _pre_cleanup(admin_client, EMP_NUM, date, "dinner")
        r = admin_client.post(f"{BASE_URL}/api/admin/bookings", json={
            "user_id": emp_user_id, "meal_type": "dinner", "meal_date": date,
            "quantity": 1, "breakfast_slot": "9:15", "reason": "TEST_slot_ignored",
        })
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        try:
            r2 = admin_client.get(f"{BASE_URL}/api/admin/bookings?date={date}&meal_type=dinner")
            items = [x for x in r2.json() if x["id"] == bid]
            assert items and items[0]["breakfast_slot"] is None
        finally:
            _cleanup(admin_client, bid)


# ---------- Legacy backfill ----------
class TestLegacyBackfill:
    def test_legacy_no_slot_counts_as_715(self, admin_client, emp_user_id, emp_client):
        """Simulate legacy booking (no breakfast_slot stored) by direct DB write via admin override + unset.
        We can't $unset via API, but we can just create with slot omitted then verify it defaults to 7:15
        (which is the backward-compat behavior)."""
        date = _future_breakfast_date()
        _pre_cleanup(admin_client, EMP_NUM, date, "breakfast")
        # Create WITHOUT slot -> should default to 7:15 and count in 7:15 bucket
        r = admin_client.post(f"{BASE_URL}/api/admin/bookings", json={
            "user_id": emp_user_id, "meal_type": "breakfast", "meal_date": date,
            "quantity": 1, "reason": "TEST_legacy",
        })
        assert r.status_code == 200
        bid = r.json()["id"]
        try:
            r2 = admin_client.get(f"{BASE_URL}/api/chef/summary?date={date}")
            bf = r2.json()["breakfast"]
            assert bf["slot_7_15"] >= 1
        finally:
            _cleanup(admin_client, bid)
