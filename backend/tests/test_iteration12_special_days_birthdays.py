"""Backend tests for iteration 12: Special Days CRUD + Birthdays bulk-import."""
import io
import os
import pytest
import requests
from openpyxl import Workbook

def _load_frontend_url():
    p = "/app/frontend/.env"
    try:
        for line in open(p):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return ""

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_url()).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMP = "135791"
ADMIN_PW = "admin@123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"employee_number": ADMIN_EMP, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Special days ----------
class TestSpecialDays:
    def test_list_seeded(self, admin_headers):
        r = requests.get(f"{API}/admin/special-days", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        mmdds = [d["mmdd"] for d in data]
        for expected in ["01-01", "01-26", "08-15", "12-25"]:
            assert expected in mmdds, f"missing seeded {expected}"
        # sorted by mmdd
        assert mmdds == sorted(mmdds)
        # entries include required fields
        for d in data:
            for k in ("id", "mmdd", "name", "message", "emoji"):
                assert k in d

    def test_create_duplicate_and_patch_delete(self, admin_headers):
        # Use unusual date to avoid clashes
        mmdd = "07-19"
        # cleanup any previous
        listing = requests.get(f"{API}/admin/special-days", headers=admin_headers).json()
        for d in listing:
            if d["mmdd"] in (mmdd, "07-20"):
                requests.delete(f"{API}/admin/special-days/{d['id']}", headers=admin_headers)

        # Create
        payload = {"mmdd": mmdd, "name": "TEST Day", "message": "Test greeting", "emoji": "🎈"}
        r = requests.post(f"{API}/admin/special-days", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        assert "id" in created
        assert created["mmdd"] == mmdd
        sd_id = created["id"]

        # Duplicate mmdd
        r2 = requests.post(f"{API}/admin/special-days", headers=admin_headers, json=payload, timeout=15)
        assert r2.status_code == 400

        # Patch each field individually
        for patch in [{"message": "New msg"}, {"name": "Renamed"}, {"emoji": "🎁"}, {"mmdd": "07-20"}]:
            rp = requests.patch(f"{API}/admin/special-days/{sd_id}", headers=admin_headers, json=patch, timeout=15)
            assert rp.status_code == 200, f"patch {patch} => {rp.text}"

        # Verify persisted
        listing = requests.get(f"{API}/admin/special-days", headers=admin_headers).json()
        row = next(d for d in listing if d["id"] == sd_id)
        assert row["mmdd"] == "07-20"
        assert row["name"] == "Renamed"
        assert row["message"] == "New msg"
        assert row["emoji"] == "🎁"

        # Move to an existing mmdd -> 400
        other = next(d for d in listing if d["mmdd"] == "01-01")
        rc = requests.patch(f"{API}/admin/special-days/{sd_id}",
                            headers=admin_headers, json={"mmdd": "01-01"}, timeout=15)
        assert rc.status_code == 400
        assert other  # sanity

        # Delete
        rd = requests.delete(f"{API}/admin/special-days/{sd_id}", headers=admin_headers, timeout=15)
        assert rd.status_code == 200

        # Verify gone
        listing2 = requests.get(f"{API}/admin/special-days", headers=admin_headers).json()
        assert not any(d["id"] == sd_id for d in listing2)

    def test_greetings_today_shape(self, admin_headers):
        r = requests.get(f"{API}/greetings/today", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "today" in data and "greeting" in data
        if data["greeting"] is not None:
            for k in ("name", "message", "emoji"):
                assert k in data["greeting"]


# ---------- Birthdays bulk import ----------
def _make_xlsx(headers, rows):
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


class TestBirthdayBulkImport:
    def test_reject_non_xlsx(self, admin_headers):
        files = {"file": ("x.txt", b"hello", "text/plain")}
        r = requests.post(f"{API}/admin/birthdays/bulk-import", headers=admin_headers, files=files, timeout=20)
        assert r.status_code == 400

    def test_missing_columns_rejected(self, admin_headers):
        buf = _make_xlsx(["Employee ID", "Name"], [["T_X1", "Missing DOB"]])
        files = {"file": ("bad.xlsx", buf.getvalue(),
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/admin/birthdays/bulk-import", headers=admin_headers, files=files, timeout=20)
        assert r.status_code == 400

    def test_import_creates_users_and_reports_errors(self, admin_headers):
        # Use unlikely emp numbers for cleanup
        emp1 = "TESTBD001"
        emp2 = "TESTBD002"
        # Cleanup any previous test data
        for emp in (emp1, emp2):
            u = requests.get(f"{API}/admin/employees", headers=admin_headers).json()
            for row in u:
                if row["employee_number"] == emp:
                    requests.delete(f"{API}/admin/employees/{row['id']}", headers=admin_headers)

        buf = _make_xlsx(
            ["Employee ID", "Name", "Birthday"],
            [
                [emp1, "TEST User One", "15/03/1990"],
                [emp2, "TEST User Two", "1985-07-21"],
                ["", "Blank ID", "1990-01-01"],   # error
                [emp1, "TEST User One", "not-a-date"],  # error
            ],
        )
        files = {"file": ("bd.xlsx", buf.getvalue(),
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/admin/birthdays/bulk-import", headers=admin_headers, files=files, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created_users"] >= 2
        assert d["birthdays_added"] >= 2
        assert isinstance(d["errors"], list)
        assert len(d["errors"]) >= 2
        for e in d["errors"]:
            assert "line" in e and "error" in e

        # Re-import same rows to test update path
        buf2 = _make_xlsx(
            ["Employee ID", "Name", "Birthday"],
            [[emp1, "TEST User One", "16/03/1990"]],
        )
        files2 = {"file": ("bd2.xlsx", buf2.getvalue(),
                           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r2 = requests.post(f"{API}/admin/birthdays/bulk-import", headers=admin_headers, files=files2, timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["birthdays_updated"] >= 1

        # Verify birthdays now include emp1 with 03-16
        bl = requests.get(f"{API}/admin/birthdays", headers=admin_headers, timeout=15).json()
        row = next((b for b in bl if b["employee_number"] == emp1), None)
        assert row is not None
        assert row["mmdd"] == "03-16"

        # Cleanup: delete test users
        emps = requests.get(f"{API}/admin/employees", headers=admin_headers).json()
        for row in emps:
            if row["employee_number"] in (emp1, emp2):
                requests.delete(f"{API}/admin/employees/{row['id']}", headers=admin_headers)
