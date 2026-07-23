"""
Comprehensive backend tests for iteration 2 features:
- Auth: change/forgot/reset password
- Bookings v2: quantity + booking_type, PATCH updates
- Holidays, Menu (admin & user-facing)
- Chef role & endpoints
- Admin: audit logs, email report
- Role-based access control
"""
import os
import io
import uuid
from datetime import date, timedelta, datetime
from zoneinfo import ZoneInfo

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://meal-reserve-32.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TZ = ZoneInfo("Asia/Kolkata")

ADMIN_EMP = "626586"
ADMIN_PW = "admin@123"

SUFFIX = str(uuid.uuid4())[:6]
EMP_NUM = f"E{SUFFIX}"
EMP_NAME = "Test Emp"
EMP_PW = "test1234"
EMP_EMAIL = f"emp_{SUFFIX}@example.com"

CHEF_NUM = f"C{SUFFIX}"
CHEF_PW = "chef1234"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


def auth(t):
    return {"Authorization": f"Bearer {t}"}


# --------------- Fixtures ---------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"employee_number": ADMIN_EMP, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def emp():
    """Create employee with email for password reset testing."""
    r = requests.post(f"{API}/auth/register", json={
        "employee_number": EMP_NUM, "name": EMP_NAME, "password": EMP_PW, "email": EMP_EMAIL,
    }, timeout=15)
    assert r.status_code == 200, f"Register failed: {r.text}"
    d = r.json()
    return {"token": d["token"], "id": d["user"]["id"], "num": EMP_NUM}


@pytest.fixture(scope="module")
def chef(admin_token):
    """Admin creates a chef account."""
    r = requests.post(f"{API}/admin/employees", headers=auth(admin_token), json={
        "employee_number": CHEF_NUM, "name": "Chef Boi", "password": CHEF_PW, "role": "chef",
    }, timeout=15)
    assert r.status_code == 200, f"Create chef failed: {r.text}"
    # Login as chef
    r2 = requests.post(f"{API}/auth/login", json={"employee_number": CHEF_NUM, "password": CHEF_PW}, timeout=10)
    assert r2.status_code == 200
    d = r2.json()
    assert d["user"]["role"] == "chef"
    return {"token": d["token"], "id": d["user"]["id"], "num": CHEF_NUM}


# --------------- Bookings v2 (qty + booking_type + PATCH) ---------------
class TestBookingsV2:
    def _breakfast_cutoff_ok(self):
        now = datetime.now(tz=TZ)
        cutoff = now.replace(hour=23, minute=30, second=0, microsecond=0)
        return now < cutoff

    def test_book_with_qty_and_parcel(self, emp):
        if not self._breakfast_cutoff_ok():
            pytest.skip("Past breakfast cutoff")
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        # cleanup
        st = requests.get(f"{API}/bookings/status", headers=auth(emp["token"]), timeout=10).json()
        for i in st["items"]:
            if i["meal_type"] == "breakfast" and i["booked"]:
                requests.delete(f"{API}/bookings/{i['booking_id']}", headers=auth(emp["token"]), timeout=10)

        # POST with qty=3, parcel
        r = requests.post(f"{API}/bookings", headers=auth(emp["token"]), json={
            "meal_type": "breakfast", "meal_date": tomorrow, "quantity": 3, "booking_type": "parcel",
        }, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["quantity"] == 3
        assert d["booking_type"] == "parcel"
        bid = d["id"]

        # Verify via status
        st2 = requests.get(f"{API}/bookings/status", headers=auth(emp["token"]), timeout=10).json()
        bk = next(i for i in st2["items"] if i["meal_type"] == "breakfast")
        assert bk["booked"] is True
        assert bk["quantity"] == 3
        assert bk["booking_type"] == "parcel"

        # Verify mine reflects qty (breakfast_count is sum of quantity)
        month = date.today().strftime("%Y-%m")
        tom = date.today() + timedelta(days=1)
        # Use month of the meal_date, which is tomorrow
        month_tom = tom.strftime("%Y-%m")
        mine = requests.get(f"{API}/bookings/mine", headers=auth(emp["token"]), params={"month": month_tom}, timeout=10).json()
        assert mine["breakfast_count"] >= 3

        # PATCH - update qty=2, dine_in
        r2 = requests.patch(f"{API}/bookings/{bid}", headers=auth(emp["token"]), json={
            "quantity": 2, "booking_type": "dine_in",
        }, timeout=10)
        assert r2.status_code == 200, r2.text
        # Verify persisted
        st3 = requests.get(f"{API}/bookings/status", headers=auth(emp["token"]), timeout=10).json()
        bk2 = next(i for i in st3["items"] if i["meal_type"] == "breakfast")
        assert bk2["quantity"] == 2
        assert bk2["booking_type"] == "dine_in"

        # Cleanup
        requests.delete(f"{API}/bookings/{bid}", headers=auth(emp["token"]), timeout=10)

    def test_qty_validation(self, emp):
        if not self._breakfast_cutoff_ok():
            pytest.skip("Past cutoff")
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        # invalid qty=0
        r = requests.post(f"{API}/bookings", headers=auth(emp["token"]), json={
            "meal_type": "breakfast", "meal_date": tomorrow, "quantity": 0,
        }, timeout=10)
        assert r.status_code == 422
        # invalid qty=6
        r2 = requests.post(f"{API}/bookings", headers=auth(emp["token"]), json={
            "meal_type": "breakfast", "meal_date": tomorrow, "quantity": 6,
        }, timeout=10)
        assert r2.status_code == 422

    def test_patch_others_forbidden(self, emp, admin_token):
        if not self._breakfast_cutoff_ok():
            pytest.skip("Past cutoff")
        # Cleanup
        st = requests.get(f"{API}/bookings/status", headers=auth(admin_token), timeout=10).json()
        for i in st["items"]:
            if i["meal_type"] == "breakfast" and i["booked"]:
                requests.delete(f"{API}/bookings/{i['booking_id']}", headers=auth(admin_token), timeout=10)
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        r = requests.post(f"{API}/bookings", headers=auth(admin_token), json={
            "meal_type": "breakfast", "meal_date": tomorrow,
        }, timeout=10)
        assert r.status_code == 200
        bid = r.json()["id"]
        r2 = requests.patch(f"{API}/bookings/{bid}", headers=auth(emp["token"]), json={"quantity": 2}, timeout=10)
        assert r2.status_code == 403
        requests.delete(f"{API}/bookings/{bid}", headers=auth(admin_token), timeout=10)


# --------------- Holidays ---------------
class TestHolidays:
    holiday_id = None
    holiday_date = None

    def test_admin_create_holiday(self, admin_token):
        # Use a date 3 days in future to avoid conflict
        d = (date.today() + timedelta(days=3)).isoformat()
        # cleanup any existing
        lst = requests.get(f"{API}/admin/holidays", headers=auth(admin_token), timeout=10).json()
        for h in lst:
            if h["date"] == d:
                requests.delete(f"{API}/admin/holidays/{h['id']}", headers=auth(admin_token), timeout=10)
        r = requests.post(f"{API}/admin/holidays", headers=auth(admin_token), json={
            "date": d, "name": "TEST_Holiday", "applies_to": "both",
        }, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["date"] == d
        assert data["name"] == "TEST_Holiday"
        TestHolidays.holiday_id = data["id"]
        TestHolidays.holiday_date = d

    def test_duplicate_holiday_rejected(self, admin_token):
        assert TestHolidays.holiday_date
        r = requests.post(f"{API}/admin/holidays", headers=auth(admin_token), json={
            "date": TestHolidays.holiday_date, "name": "Dup", "applies_to": "both",
        }, timeout=10)
        assert r.status_code == 400

    def test_user_sees_holiday(self, emp):
        r = requests.get(f"{API}/holidays", headers=auth(emp["token"]), timeout=10)
        assert r.status_code == 200
        lst = r.json()
        assert any(h["date"] == TestHolidays.holiday_date for h in lst)

    def test_holiday_blocks_booking(self, emp):
        """If we try to book on holiday date, should return 400."""
        # Cutoff: if holiday is 3 days from now, breakfast cutoff (day before at 23:30) is 2 days away -> still open
        # But need to be careful — booking is for tomorrow. Let's set a holiday for tomorrow.
        pass  # covered in tomorrow-specific test via UI

    def test_admin_delete_holiday(self, admin_token):
        assert TestHolidays.holiday_id
        r = requests.delete(f"{API}/admin/holidays/{TestHolidays.holiday_id}", headers=auth(admin_token), timeout=10)
        assert r.status_code == 200
        # Verify gone
        lst = requests.get(f"{API}/admin/holidays", headers=auth(admin_token), timeout=10).json()
        assert not any(h["id"] == TestHolidays.holiday_id for h in lst)


class TestHolidayBlocksBookingTomorrow:
    """Create a holiday for tomorrow, verify booking is blocked, then cleanup."""
    def test_flow(self, admin_token, emp):
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        # Cleanup any existing holiday for tomorrow
        lst = requests.get(f"{API}/admin/holidays", headers=auth(admin_token), timeout=10).json()
        for h in lst:
            if h["date"] == tomorrow:
                requests.delete(f"{API}/admin/holidays/{h['id']}", headers=auth(admin_token), timeout=10)
        # Also cleanup any existing booking
        st = requests.get(f"{API}/bookings/status", headers=auth(emp["token"]), timeout=10).json()
        for i in st["items"]:
            if i["meal_type"] == "breakfast" and i["booked"]:
                requests.delete(f"{API}/bookings/{i['booking_id']}", headers=auth(emp["token"]), timeout=10)

        r = requests.post(f"{API}/admin/holidays", headers=auth(admin_token), json={
            "date": tomorrow, "name": "TEST_TomorrowHoliday", "applies_to": "breakfast",
        }, timeout=10)
        assert r.status_code == 200
        hid = r.json()["id"]

        # Try booking breakfast tomorrow → should fail
        r2 = requests.post(f"{API}/bookings", headers=auth(emp["token"]), json={
            "meal_type": "breakfast", "meal_date": tomorrow,
        }, timeout=10)
        assert r2.status_code == 400
        assert "holiday" in r2.text.lower()

        # Cleanup
        requests.delete(f"{API}/admin/holidays/{hid}", headers=auth(admin_token), timeout=10)


# --------------- Menu ---------------
class TestMenu:
    def test_admin_upsert_and_user_read(self, admin_token, emp):
        d = (date.today() + timedelta(days=5)).isoformat()
        # PUT (upsert)
        r = requests.put(f"{API}/admin/menu", headers=auth(admin_token), json={
            "date": d, "meal_type": "breakfast", "items": ["Idli", "Sambar", "Coffee"],
        }, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["items"] == ["Idli", "Sambar", "Coffee"]

        # Upsert again with different items
        r2 = requests.put(f"{API}/admin/menu", headers=auth(admin_token), json={
            "date": d, "meal_type": "breakfast", "items": ["Dosa", "Chutney"],
        }, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["items"] == ["Dosa", "Chutney"]

        # User read
        r3 = requests.get(f"{API}/menu", headers=auth(emp["token"]), params={"date": d}, timeout=10)
        assert r3.status_code == 200
        items = r3.json()
        assert len(items) >= 1
        b = next(i for i in items if i["meal_type"] == "breakfast")
        assert b["items"] == ["Dosa", "Chutney"]

        # Admin list
        r4 = requests.get(f"{API}/admin/menu", headers=auth(admin_token), timeout=10)
        assert r4.status_code == 200

    def test_menu_admin_only(self, emp):
        d = (date.today() + timedelta(days=5)).isoformat()
        r = requests.put(f"{API}/admin/menu", headers=auth(emp["token"]), json={
            "date": d, "meal_type": "breakfast", "items": [],
        }, timeout=10)
        assert r.status_code == 403


# --------------- Chef ---------------
class TestChef:
    def test_chef_login_role(self, chef):
        assert chef["token"]

    def test_chef_summary_shape(self, chef):
        r = requests.get(f"{API}/chef/summary", headers=auth(chef["token"]), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "breakfast" in data
        assert "dinner" in data
        for meal in ("breakfast", "dinner"):
            for key in ("total", "parcel", "dine_in", "served", "pending", "orders"):
                assert key in data[meal], f"missing {key} in {meal}"

    def test_chef_bookings_search(self, chef, emp, admin_token):
        """Create a booking, then search and serve/unserve."""
        now = datetime.now(tz=TZ)
        # Book dinner today only works if before 14:30 IST, otherwise skip
        # Try tomorrow's breakfast if before 23:30
        cutoff = now.replace(hour=23, minute=30, second=0, microsecond=0)
        if now >= cutoff:
            pytest.skip("Past breakfast cutoff")
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        # cleanup existing
        st = requests.get(f"{API}/bookings/status", headers=auth(emp["token"]), timeout=10).json()
        for i in st["items"]:
            if i["meal_type"] == "breakfast" and i["booked"]:
                requests.delete(f"{API}/bookings/{i['booking_id']}", headers=auth(emp["token"]), timeout=10)

        rb = requests.post(f"{API}/bookings", headers=auth(emp["token"]), json={
            "meal_type": "breakfast", "meal_date": tomorrow, "quantity": 2, "booking_type": "parcel",
        }, timeout=10)
        assert rb.status_code == 200
        bid = rb.json()["id"]

        # Chef fetches tomorrow's bookings
        r = requests.get(f"{API}/chef/bookings", headers=auth(chef["token"]), params={"date": tomorrow, "meal_type": "breakfast"}, timeout=10)
        assert r.status_code == 200
        lst = r.json()
        assert any(b["id"] == bid for b in lst)
        me_b = next(b for b in lst if b["id"] == bid)
        assert me_b["quantity"] == 2
        assert me_b["booking_type"] == "parcel"
        assert me_b["employee_number"] == EMP_NUM

        # Search by employee number
        r2 = requests.get(f"{API}/chef/bookings", headers=auth(chef["token"]), params={"date": tomorrow, "q": EMP_NUM}, timeout=10)
        assert r2.status_code == 200
        assert any(b["id"] == bid for b in r2.json())

        # Search by name
        r3 = requests.get(f"{API}/chef/bookings", headers=auth(chef["token"]), params={"date": tomorrow, "q": "Test Emp"}, timeout=10)
        assert r3.status_code == 200
        assert any(b["id"] == bid for b in r3.json())

        # Search that returns nothing
        r4 = requests.get(f"{API}/chef/bookings", headers=auth(chef["token"]), params={"date": tomorrow, "q": "ZZNOMATCHZZ"}, timeout=10)
        assert r4.status_code == 200
        assert r4.json() == []

        # Serve
        r5 = requests.post(f"{API}/chef/serve/{bid}", headers=auth(chef["token"]), timeout=10)
        assert r5.status_code == 200
        # Verify served in list
        r6 = requests.get(f"{API}/chef/bookings", headers=auth(chef["token"]), params={"date": tomorrow}, timeout=10)
        b6 = next(b for b in r6.json() if b["id"] == bid)
        assert b6["served"] is True
        assert b6["served_by"] == CHEF_NUM

        # Double serve -> 400
        r7 = requests.post(f"{API}/chef/serve/{bid}", headers=auth(chef["token"]), timeout=10)
        assert r7.status_code == 400

        # Verify summary reflects served
        s = requests.get(f"{API}/chef/summary", headers=auth(chef["token"]), params={"date": tomorrow}, timeout=10).json()
        assert s["breakfast"]["served"] >= 2

        # Unserve
        r8 = requests.post(f"{API}/chef/unserve/{bid}", headers=auth(chef["token"]), timeout=10)
        assert r8.status_code == 200

        # Cleanup: employee cancels booking
        requests.delete(f"{API}/bookings/{bid}", headers=auth(emp["token"]), timeout=10)

    def test_chef_cannot_access_admin(self, chef):
        r = requests.get(f"{API}/admin/employees", headers=auth(chef["token"]), timeout=10)
        assert r.status_code == 403

    def test_employee_cannot_access_chef(self, emp):
        r = requests.get(f"{API}/chef/summary", headers=auth(emp["token"]), timeout=10)
        assert r.status_code == 403


# --------------- Change/Forgot/Reset password ---------------
class TestPasswordFlows:
    def test_change_password(self):
        """Register a fresh user, change password, re-login."""
        emp_num = f"CP{SUFFIX}"
        r = requests.post(f"{API}/auth/register", json={
            "employee_number": emp_num, "name": "CP User", "password": "oldpass1",
        }, timeout=10)
        assert r.status_code == 200
        tok = r.json()["token"]

        # Wrong current password
        r2 = requests.post(f"{API}/auth/change-password", headers=auth(tok), json={
            "current_password": "WRONG", "new_password": "newpass1",
        }, timeout=10)
        assert r2.status_code == 400

        # Correct
        r3 = requests.post(f"{API}/auth/change-password", headers=auth(tok), json={
            "current_password": "oldpass1", "new_password": "newpass1",
        }, timeout=10)
        assert r3.status_code == 200
        assert r3.json()["ok"] is True

        # Re-login with new password
        r4 = requests.post(f"{API}/auth/login", json={"employee_number": emp_num, "password": "newpass1"}, timeout=10)
        assert r4.status_code == 200

        # Old fails
        r5 = requests.post(f"{API}/auth/login", json={"employee_number": emp_num, "password": "oldpass1"}, timeout=10)
        assert r5.status_code == 401

    def test_forgot_password_generic_response(self):
        # Unknown employee -> still returns 200 ok (does not leak)
        r = requests.post(f"{API}/auth/forgot-password", json={"employee_number": "NONEXISTENT99999"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["ok"] is True

        # Existing employee with email -> also 200
        r2 = requests.post(f"{API}/auth/forgot-password", json={"employee_number": EMP_NUM}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["ok"] is True

    def test_reset_password_flow(self, emp):
        """Trigger forgot-password, fetch token from Mongo, reset, then login."""
        # 1. Trigger forgot
        r = requests.post(f"{API}/auth/forgot-password", json={"employee_number": EMP_NUM}, timeout=10)
        assert r.status_code == 200

        # 2. Fetch latest token from Mongo
        async def get_token():
            client = AsyncIOMotorClient(MONGO_URL)
            db = client[DB_NAME]
            rec = await db.password_reset_tokens.find_one(
                {"user_id": emp["id"], "used": False}, sort=[("expires_at", -1)]
            )
            client.close()
            return rec

        rec = asyncio.run(get_token())
        assert rec is not None, "No reset token stored in password_reset_tokens"
        token = rec["token"]

        # 3. Invalid token
        r_bad = requests.post(f"{API}/auth/reset-password", json={"token": "invalid_xyz", "new_password": "n123"}, timeout=10)
        assert r_bad.status_code == 400

        # 4. Reset with valid token
        new_pw = "resetpass1"
        r2 = requests.post(f"{API}/auth/reset-password", json={"token": token, "new_password": new_pw}, timeout=10)
        assert r2.status_code == 200

        # 5. Login with new password
        r3 = requests.post(f"{API}/auth/login", json={"employee_number": EMP_NUM, "password": new_pw}, timeout=10)
        assert r3.status_code == 200

        # 6. Reuse token -> 400
        r4 = requests.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "again"}, timeout=10)
        assert r4.status_code == 400

        # 7. Restore original password so other tests using EMP_PW aren't broken
        new_tok = r3.json()["token"]
        requests.post(f"{API}/auth/change-password", headers=auth(new_tok), json={
            "current_password": new_pw, "new_password": EMP_PW,
        }, timeout=10)


# --------------- Audit logs ---------------
class TestAudit:
    def test_audit_logs_returned(self, admin_token):
        r = requests.get(f"{API}/admin/audit-logs", headers=auth(admin_token), timeout=10)
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, list)
        # After prior tests, should have some entries
        actions = {l["action"] for l in logs}
        # Not asserting specific actions since tests may run in any order; just verify shape
        if logs:
            for key in ("action", "timestamp", "actor_employee_number"):
                assert key in logs[0]

    def test_audit_logs_admin_only(self, emp):
        r = requests.get(f"{API}/admin/audit-logs", headers=auth(emp["token"]), timeout=10)
        assert r.status_code == 403


# --------------- Email report ---------------
class TestEmailReport:
    def test_email_report_returns_ok(self, admin_token):
        today = date.today().isoformat()
        week_ago = (date.today() - timedelta(days=7)).isoformat()
        r = requests.post(f"{API}/admin/email-report", headers=auth(admin_token), json={
            "email": "test@example.com", "from_date": week_ago, "to_date": today,
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_email_report_bad_date(self, admin_token):
        r = requests.post(f"{API}/admin/email-report", headers=auth(admin_token), json={
            "email": "test@example.com", "from_date": "bad", "to_date": "date",
        }, timeout=10)
        assert r.status_code == 400

    def test_email_report_admin_only(self, emp):
        today = date.today().isoformat()
        r = requests.post(f"{API}/admin/email-report", headers=auth(emp["token"]), json={
            "email": "test@example.com", "from_date": today, "to_date": today,
        }, timeout=10)
        assert r.status_code == 403


# --------------- Cleanup ---------------
def test_cleanup_created_users(admin_token):
    """Delete the test users created (best-effort, at end of test run)."""
    emps = requests.get(f"{API}/admin/employees", headers=auth(admin_token), timeout=10).json()
    for e in emps:
        if e["employee_number"] in (EMP_NUM, CHEF_NUM, f"CP{SUFFIX}"):
            requests.delete(f"{API}/admin/employees/{e['id']}", headers=auth(admin_token), timeout=10)
