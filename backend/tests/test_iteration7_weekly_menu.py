"""
Iteration 7 – Weekly Menu Management tests

Covers:
  * GET/PUT/DELETE /api/admin/weekly-menu
  * GET /api/weekly-menu (auth required)
  * GET /api/weekly-menu/today
  * /api/menu resolution: date-specific override wins over weekly template,
    weekly template applies when no override, fallback restored after override delete.
"""
import os
import datetime as dt
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://meal-reserve-32.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMP = "135791"
ADMIN_PWD = "admin@123"

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"employee_number": ADMIN_EMP, "password": ADMIN_PWD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def employee_creds(admin_headers):
    """Create (or reuse) a TEST_ITER7 employee and return credentials."""
    emp_no = "TEST_ITER7_EMP"
    pwd = "test1234"
    payload = {
        "employee_number": emp_no,
        "name": "Iteration7 Employee",
        "email": "test_iter7_emp@example.com",
        "password": pwd,
        "role": "employee",
    }
    r = requests.post(f"{API}/admin/employees", headers=admin_headers, json=payload, timeout=15)
    # 200 create OR conflict (already exists) both acceptable — reset password if needed
    if r.status_code >= 400 and "exist" not in r.text.lower():
        # attempt to update password
        pass
    return {"employee_number": emp_no, "password": pwd}


@pytest.fixture(scope="module")
def employee_token(employee_creds):
    r = requests.post(f"{API}/auth/login",
                      json={"employee_number": employee_creds["employee_number"],
                            "password": employee_creds["password"]}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Employee login failed: {r.text}")
    return r.json()["token"]


# ---------- helpers ----------
def _next_date_for_weekday(target_weekday_idx: int) -> str:
    """Return YYYY-MM-DD for the next occurrence of target weekday (Mon=0)."""
    today = dt.date.today()
    days_ahead = (target_weekday_idx - today.weekday()) % 7
    # ensure future date (avoid 'today' side-effects with time zone)
    if days_ahead < 3:
        days_ahead += 7
    return (today + dt.timedelta(days=days_ahead)).isoformat()


# ---------- Weekly Menu admin CRUD ----------
class TestAdminWeeklyMenu:
    def test_get_returns_14_slots(self, admin_headers):
        r = requests.get(f"{API}/admin/weekly-menu", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 14
        days = {row["day_of_week"] for row in data}
        meals = {row["meal_type"] for row in data}
        assert days == set(WEEKDAYS)
        assert meals == {"breakfast", "dinner"}
        for row in data:
            assert "items" in row and isinstance(row["items"], list)
            assert "updated_at" in row  # nullable ok

    def test_put_upsert_and_get_reflects(self, admin_headers):
        items = ["TEST_Idli", "TEST_Dosa", "TEST_Sambar"]
        r = requests.put(f"{API}/admin/weekly-menu", headers=admin_headers,
                         json={"day_of_week": "monday", "meal_type": "breakfast", "items": items}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["items"] == items
        # Read back
        r2 = requests.get(f"{API}/admin/weekly-menu", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        mon_b = next(x for x in r2.json() if x["day_of_week"] == "monday" and x["meal_type"] == "breakfast")
        assert mon_b["items"] == items
        assert mon_b["updated_at"]

    def test_put_trims_and_ignores_blanks(self, admin_headers):
        items = ["  TEST_Chapati ", "", "   ", "TEST_Dal"]
        r = requests.put(f"{API}/admin/weekly-menu", headers=admin_headers,
                         json={"day_of_week": "tuesday", "meal_type": "dinner", "items": items}, timeout=15)
        assert r.status_code == 200
        assert r.json()["items"] == ["TEST_Chapati", "TEST_Dal"]

    def test_put_rejects_invalid_day(self, admin_headers):
        r = requests.put(f"{API}/admin/weekly-menu", headers=admin_headers,
                         json={"day_of_week": "funday", "meal_type": "breakfast", "items": []}, timeout=15)
        assert r.status_code in (400, 422)

    def test_delete_success_then_404(self, admin_headers):
        # ensure something exists
        requests.put(f"{API}/admin/weekly-menu", headers=admin_headers,
                     json={"day_of_week": "wednesday", "meal_type": "dinner", "items": ["TEST_A"]}, timeout=15)
        r = requests.delete(f"{API}/admin/weekly-menu?day_of_week=wednesday&meal_type=dinner",
                            headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        # 2nd delete → 404
        r2 = requests.delete(f"{API}/admin/weekly-menu?day_of_week=wednesday&meal_type=dinner",
                             headers=admin_headers, timeout=15)
        assert r2.status_code == 404

    def test_non_admin_forbidden(self, employee_token):
        h = {"Authorization": f"Bearer {employee_token}", "Content-Type": "application/json"}
        r = requests.get(f"{API}/admin/weekly-menu", headers=h, timeout=15)
        assert r.status_code == 403


# ---------- Weekly Menu public (auth) ----------
class TestPublicWeeklyMenu:
    def test_get_weekly_menu_returns_14(self, employee_token):
        h = {"Authorization": f"Bearer {employee_token}"}
        r = requests.get(f"{API}/weekly-menu", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) == 14
        # monday breakfast should carry earlier upserted items (may be modified later)
        mon_b = next(x for x in data if x["day_of_week"] == "monday" and x["meal_type"] == "breakfast")
        assert isinstance(mon_b["items"], list)

    def test_get_weekly_today(self, employee_token):
        h = {"Authorization": f"Bearer {employee_token}"}
        r = requests.get(f"{API}/weekly-menu/today", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "date" in data and "day_of_week" in data
        assert data["day_of_week"] in WEEKDAYS
        assert isinstance(data["breakfast"], list)
        assert isinstance(data["dinner"], list)

    def test_weekly_menu_requires_auth(self):
        r = requests.get(f"{API}/weekly-menu", timeout=15)
        assert r.status_code == 401


# ---------- Menu resolution: weekly fallback vs date-specific override ----------
class TestMenuResolution:
    def test_weekly_applies_when_no_override(self, admin_headers, employee_token):
        # Set thursday breakfast weekly
        weekly_items = ["TEST_WEEKLY_A", "TEST_WEEKLY_B"]
        r = requests.put(f"{API}/admin/weekly-menu", headers=admin_headers,
                         json={"day_of_week": "thursday", "meal_type": "breakfast",
                               "items": weekly_items}, timeout=15)
        assert r.status_code == 200
        # Pick a future Thursday
        thursday_iso = _next_date_for_weekday(3)
        # Ensure no override exists (delete any existing menu row for that date/meal)
        h_admin = admin_headers
        # try to list & delete any that match
        list_r = requests.get(f"{API}/admin/menu?from={thursday_iso}&to={thursday_iso}",
                              headers=h_admin, timeout=15)
        assert list_r.status_code == 200
        for row in list_r.json():
            if row["meal_type"] == "breakfast":
                requests.delete(f"{API}/admin/menu/{row['id']}", headers=h_admin, timeout=15)
        # Fetch via /api/menu
        h_emp = {"Authorization": f"Bearer {employee_token}"}
        r2 = requests.get(f"{API}/menu?date={thursday_iso}&meal_type=breakfast",
                          headers=h_emp, timeout=15)
        assert r2.status_code == 200, r2.text
        payload = r2.json()
        assert isinstance(payload, list) and len(payload) == 1
        assert payload[0]["items"] == weekly_items

    def test_date_override_wins(self, admin_headers, employee_token):
        thursday_iso = _next_date_for_weekday(3)
        override_items = ["TEST_OVERRIDE_X", "TEST_OVERRIDE_Y", "TEST_OVERRIDE_Z"]
        r = requests.put(f"{API}/admin/menu", headers=admin_headers,
                         json={"date": thursday_iso, "meal_type": "breakfast",
                               "items": override_items}, timeout=15)
        assert r.status_code == 200, r.text

        h_emp = {"Authorization": f"Bearer {employee_token}"}
        r2 = requests.get(f"{API}/menu?date={thursday_iso}&meal_type=breakfast",
                          headers=h_emp, timeout=15)
        assert r2.status_code == 200
        assert r2.json()[0]["items"] == override_items

    def test_clearing_override_falls_back_to_weekly(self, admin_headers, employee_token):
        thursday_iso = _next_date_for_weekday(3)
        # find the override row and delete it
        list_r = requests.get(f"{API}/admin/menu?from={thursday_iso}&to={thursday_iso}",
                              headers=admin_headers, timeout=15)
        row = next((x for x in list_r.json() if x["meal_type"] == "breakfast"), None)
        assert row, "Expected date-specific override row from previous test"
        d = requests.delete(f"{API}/admin/menu/{row['id']}", headers=admin_headers, timeout=15)
        assert d.status_code == 200

        h_emp = {"Authorization": f"Bearer {employee_token}"}
        r2 = requests.get(f"{API}/menu?date={thursday_iso}&meal_type=breakfast",
                          headers=h_emp, timeout=15)
        assert r2.status_code == 200
        assert r2.json()[0]["items"] == ["TEST_WEEKLY_A", "TEST_WEEKLY_B"]


# ---------- Regression: date-specific menu CRUD still works ----------
class TestDateMenuRegression:
    def test_create_list_delete(self, admin_headers):
        future = (dt.date.today() + dt.timedelta(days=10)).isoformat()
        # cleanup pre-existing
        pre = requests.get(f"{API}/admin/menu?from={future}&to={future}",
                           headers=admin_headers, timeout=15).json()
        for row in pre:
            if row["meal_type"] == "dinner":
                requests.delete(f"{API}/admin/menu/{row['id']}", headers=admin_headers, timeout=15)
        # create
        r = requests.put(f"{API}/admin/menu", headers=admin_headers,
                         json={"date": future, "meal_type": "dinner",
                               "items": ["TEST_REG_A", "TEST_REG_B"]}, timeout=15)
        assert r.status_code == 200
        # list
        lst = requests.get(f"{API}/admin/menu?from={future}&to={future}",
                           headers=admin_headers, timeout=15).json()
        row = next(x for x in lst if x["meal_type"] == "dinner")
        assert row["items"] == ["TEST_REG_A", "TEST_REG_B"]
        # delete
        d = requests.delete(f"{API}/admin/menu/{row['id']}", headers=admin_headers, timeout=15)
        assert d.status_code == 200
