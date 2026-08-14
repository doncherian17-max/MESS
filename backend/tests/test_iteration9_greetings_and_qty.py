"""Iteration 9: Greeting banner + Admin add-booking quantity fix + regressions."""
import os
import datetime as dt
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://meal-reserve-32.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN = {"employee_number": "135791", "password": "admin@123"}
EMP = {"employee_number": "612480", "password": "newpass123"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json().get("token")
    assert token, "no token in login response"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def admin_sess():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def emp_sess():
    return _login(EMP)


@pytest.fixture(scope="module")
def mongo():
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    dbname = os.environ.get("DB_NAME", "test_database")
    c = MongoClient(url)
    return c[dbname]


# ---------------- Greetings ----------------
class TestGreetings:
    def test_seeded_special_days_present(self, mongo):
        mmdds = {d["mmdd"] for d in mongo.special_days.find({}, {"mmdd": 1})}
        for req in ["01-26", "08-15", "10-02", "12-25"]:
            assert req in mmdds, f"missing seed {req}"

    def test_greetings_today_shape(self, emp_sess):
        r = emp_sess.get(f"{API}/greetings/today", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "today" in data and "greeting" in data
        # greeting may be None or dict; if dict validate keys
        if data["greeting"] is not None:
            for k in ["name", "message", "emoji"]:
                assert k in data["greeting"]

    def test_greetings_today_with_injected_entry(self, emp_sess, mongo):
        """Insert a temp special-day for today's IST MM-DD, verify banner data."""
        # Compute today in Asia/Kolkata
        ist = dt.datetime.utcnow() + dt.timedelta(hours=5, minutes=30)
        mmdd = f"{ist.month:02d}-{ist.day:02d}"
        existed = mongo.special_days.find_one({"mmdd": mmdd})
        temp_name = "TEST_Greeting_Day"
        if not existed:
            mongo.special_days.insert_one({
                "mmdd": mmdd, "name": temp_name,
                "message": "TEST greeting message", "emoji": "🧪"
            })
        try:
            r = emp_sess.get(f"{API}/greetings/today", timeout=15)
            assert r.status_code == 200
            g = r.json()["greeting"]
            assert g is not None
            assert isinstance(g["name"], str) and g["name"]
            assert isinstance(g["message"], str) and g["message"]
            assert isinstance(g["emoji"], str) and g["emoji"]
        finally:
            if not existed:
                mongo.special_days.delete_one({"mmdd": mmdd, "name": temp_name})

    def test_greetings_requires_auth(self):
        r = requests.get(f"{API}/greetings/today", timeout=15)
        assert r.status_code in (401, 403)


# ---------------- Admin add booking quantity ----------------
class TestAdminAddBookingQuantity:
    def test_force_book_quantity_3(self, admin_sess, mongo):
        # find employee id
        r = admin_sess.get(f"{API}/admin/employees", timeout=15)
        assert r.status_code == 200
        users = r.json()
        emp = next((u for u in users if str(u.get("employee_number")) == EMP["employee_number"]), None)
        assert emp, "test employee not found"
        user_id = emp["id"]

        # Use a distant future Monday-ish date to avoid clashes
        target_date = (dt.date.today() + dt.timedelta(days=30)).isoformat()
        meal_type = "breakfast"

        # Cleanup any pre-existing
        mongo.bookings.delete_many({"user_id": user_id, "meal_date": target_date, "meal_type": meal_type})

        payload = {
            "user_id": user_id,
            "meal_type": meal_type,
            "meal_date": target_date,
            "quantity": 3,
            "booking_type": "dine_in",
            "reason": "TEST_iteration9 quantity=3 override",
        }
        r = admin_sess.post(f"{API}/admin/bookings", json=payload, timeout=20)
        assert r.status_code in (200, 201), f"force book failed: {r.status_code} {r.text}"

        # verify in Mongo
        b = mongo.bookings.find_one({"user_id": user_id, "meal_date": target_date, "meal_type": meal_type})
        assert b is not None, "booking not persisted"
        assert b.get("quantity") == 3, f"quantity mismatch: {b.get('quantity')}"

        # verify visible via admin bookings list
        r = admin_sess.get(f"{API}/admin/bookings", params={"date": target_date}, timeout=15)
        if r.status_code == 200:
            rows = r.json() if isinstance(r.json(), list) else r.json().get("bookings", [])
            match = [x for x in rows if x.get("user_id") == user_id and x.get("meal_type") == meal_type]
            if match:
                assert match[0].get("quantity") == 3

        # cleanup
        mongo.bookings.delete_many({"user_id": user_id, "meal_date": target_date, "meal_type": meal_type})


# ---------------- Regressions ----------------
class TestRegressions:
    def test_bookings_status(self, emp_sess):
        r = emp_sess.get(f"{API}/bookings/status", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Fields may be nested; check top-level keys
        text = str(data)
        for k in ["day_label", "sunday_off", "cancellation"]:
            assert k in text, f"missing {k} in status"
