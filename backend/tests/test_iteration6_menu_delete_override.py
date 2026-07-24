"""Iteration 6 tests: Menu DELETE + admin booking override notifications + audit meta."""
import os
import time
import pytest
import requests
from datetime import date, timedelta
from bson import ObjectId

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://meal-reserve-32.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMP = "135791"
ADMIN_PW = "admin@123"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"employee_number": ADMIN_EMP, "password": ADMIN_PW})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def test_employee(admin_headers):
    """Create (or reuse) a test employee to receive bookings/emails."""
    emp_num = "TEST_ITER6_EMP"
    payload = {
        "employee_number": emp_num,
        "name": "Iteration6 Test Employee",
        "password": "test1234",
        "email": "test_iter6_emp@example.com",
        "role": "employee",
    }
    r = requests.post(f"{API}/admin/employees", json=payload, headers=admin_headers)
    if r.status_code == 400:  # already exists — fetch id from list
        r2 = requests.get(f"{API}/admin/employees", headers=admin_headers)
        assert r2.status_code == 200
        for u in r2.json():
            if u["employee_number"] == emp_num:
                return u
        pytest.fail("Test employee lookup failed after 400 conflict")
    assert r.status_code == 200, f"Create test employee failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture
def employee_token():
    """Login as the seeded test employee (created via test_employee fixture)."""
    r = requests.post(f"{API}/auth/login", json={"employee_number": "TEST_ITER6_EMP", "password": "test1234"})
    if r.status_code != 200:
        pytest.skip("Test employee not available")
    return r.json()["token"]


# ==================== MENU DELETE ====================
class TestMenuDelete:
    def _create_menu(self, headers, d=None):
        d = d or (date.today() + timedelta(days=10)).isoformat()
        r = requests.put(f"{API}/admin/menu",
                         json={"date": d, "meal_type": "breakfast", "items": ["TEST_ITEM_A", "TEST_ITEM_B"]},
                         headers=headers)
        assert r.status_code == 200
        # Fetch the id
        r2 = requests.get(f"{API}/admin/menu?from={d}&to={d}", headers=headers)
        assert r2.status_code == 200
        for m in r2.json():
            if m["date"] == d and m["meal_type"] == "breakfast":
                return m
        pytest.fail("Menu row not found after upsert")

    def test_delete_menu_success(self, admin_headers):
        m = self._create_menu(admin_headers, d=(date.today() + timedelta(days=11)).isoformat())
        r = requests.delete(f"{API}/admin/menu/{m['id']}", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("message") == "Menu item deleted successfully."

        # GET → verify row is gone
        r2 = requests.get(f"{API}/admin/menu?from={m['date']}&to={m['date']}", headers=admin_headers)
        assert r2.status_code == 200
        ids = [row["id"] for row in r2.json()]
        assert m["id"] not in ids

    def test_delete_menu_writes_audit_log(self, admin_headers):
        m = self._create_menu(admin_headers, d=(date.today() + timedelta(days=12)).isoformat())
        del_r = requests.delete(f"{API}/admin/menu/{m['id']}", headers=admin_headers)
        assert del_r.status_code == 200

        # Fetch audit logs, find menu.delete
        r = requests.get(f"{API}/admin/audit-logs?limit=50", headers=admin_headers)
        assert r.status_code == 200
        logs = r.json()
        matches = [l for l in logs if l["action"] == "menu.delete" and l.get("target", "").startswith(m["date"])]
        assert matches, "No menu.delete audit log found for deleted item"
        meta = matches[0].get("meta", {})
        assert meta.get("date") == m["date"]
        assert meta.get("meal_type") == "breakfast"
        assert "items" in meta
        # Actor
        assert matches[0].get("actor_employee_number") == ADMIN_EMP

    def test_delete_menu_invalid_id_returns_400(self, admin_headers):
        r = requests.delete(f"{API}/admin/menu/not-a-valid-oid", headers=admin_headers)
        assert r.status_code == 400

    def test_delete_menu_nonexistent_returns_404(self, admin_headers):
        fake = str(ObjectId())
        r = requests.delete(f"{API}/admin/menu/{fake}", headers=admin_headers)
        assert r.status_code == 404

    def test_delete_menu_non_admin_forbidden(self, admin_headers, test_employee, employee_token):
        m = self._create_menu(admin_headers, d=(date.today() + timedelta(days=13)).isoformat())
        r = requests.delete(f"{API}/admin/menu/{m['id']}",
                            headers={"Authorization": f"Bearer {employee_token}"})
        assert r.status_code == 403
        # Cleanup as admin
        requests.delete(f"{API}/admin/menu/{m['id']}", headers=admin_headers)


# ==================== ADMIN BOOKING OVERRIDE ====================
class TestAdminBookingOverride:
    def test_override_create_returns_success_and_marker(self, admin_headers, test_employee):
        meal_date = (date.today() + timedelta(days=5)).isoformat()
        payload = {
            "user_id": test_employee["id"],
            "meal_type": "breakfast",
            "meal_date": meal_date,
            "quantity": 2,
            "booking_type": "dine_in",
            "reason": "TEST — iter6 override booking (single meal)",
        }
        r = requests.post(f"{API}/admin/bookings", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "id" in body

        # Verify marker via list endpoint
        r2 = requests.get(f"{API}/admin/bookings?date={meal_date}&meal_type=breakfast", headers=admin_headers)
        assert r2.status_code == 200
        rows = [x for x in r2.json() if x["id"] == body["id"]]
        assert rows, "Created booking not found in admin listing"
        row = rows[0]
        assert row["admin_override"] is True
        assert row["override_reason"] == payload["reason"]

    def test_override_audit_meta_has_all_fields(self, admin_headers, test_employee):
        meal_date = (date.today() + timedelta(days=6)).isoformat()
        reason = "TEST — iter6 audit meta check"
        payload = {
            "user_id": test_employee["id"],
            "meal_type": "dinner",
            "meal_date": meal_date,
            "quantity": 1,
            "booking_type": "parcel",
            "reason": reason,
        }
        r = requests.post(f"{API}/admin/bookings", json=payload, headers=admin_headers)
        assert r.status_code == 200
        bid = r.json()["id"]

        # small delay to let audit log settle
        time.sleep(0.5)
        r2 = requests.get(f"{API}/admin/audit-logs?limit=100", headers=admin_headers)
        assert r2.status_code == 200
        logs = r2.json()
        matches = [l for l in logs if l["action"] == "admin.booking.override_create" and l.get("target") == bid]
        assert matches, "override_create audit log not found"
        meta = matches[0]["meta"]
        for key in ("admin_name", "employee_number", "employee_name",
                    "meal_date", "meal_type", "quantity", "booking_type", "reason"):
            assert key in meta, f"missing key {key} in override_create meta: {meta}"
        assert meta["reason"] == reason
        assert meta["meal_type"] == "dinner"
        assert meta["meal_date"] == meal_date
        assert meta["quantity"] == 1
        assert meta["employee_number"] == test_employee["employee_number"]

    def test_override_two_meals_creates_two_audit_rows(self, admin_headers, test_employee):
        """Simulate the frontend 'both meals' flow — two separate POSTs."""
        meal_date = (date.today() + timedelta(days=7)).isoformat()
        reason = "TEST — iter6 both-meals audit dedupe"
        ids = []
        for meal in ("breakfast", "dinner"):
            r = requests.post(f"{API}/admin/bookings", json={
                "user_id": test_employee["id"], "meal_type": meal, "meal_date": meal_date,
                "quantity": 1, "booking_type": "dine_in", "reason": reason,
            }, headers=admin_headers)
            assert r.status_code == 200
            ids.append(r.json()["id"])
        assert len(set(ids)) == 2

        time.sleep(0.5)
        r = requests.get(f"{API}/admin/audit-logs?limit=200", headers=admin_headers)
        logs = r.json()
        matches = [l for l in logs if l["action"] == "admin.booking.override_create" and l.get("target") in ids]
        # Should have at least 2 rows (one per booking id)
        targets = {l["target"] for l in matches}
        assert len(targets) == 2, f"Expected 2 audit rows for both-meals, got {len(targets)}: {targets}"

    def test_override_invalid_user_id(self, admin_headers):
        r = requests.post(f"{API}/admin/bookings", json={
            "user_id": "bad-id", "meal_type": "breakfast",
            "meal_date": (date.today() + timedelta(days=8)).isoformat(),
            "quantity": 1, "booking_type": "dine_in", "reason": "test",
        }, headers=admin_headers)
        assert r.status_code == 400

    def test_override_non_admin_forbidden(self, employee_token, test_employee):
        r = requests.post(f"{API}/admin/bookings",
                          json={"user_id": test_employee["id"], "meal_type": "breakfast",
                                "meal_date": (date.today() + timedelta(days=9)).isoformat(),
                                "quantity": 1, "booking_type": "dine_in", "reason": "test"},
                          headers={"Authorization": f"Bearer {employee_token}"})
        assert r.status_code == 403
