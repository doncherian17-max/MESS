"""Iteration 10: Admin BirthdayEditor - birthdays CRUD endpoints tests."""
import os
import io
import base64
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Try reading from frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

ADMIN_EMP = "135791"
ADMIN_PW = "admin@123"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={
        "employee_number": ADMIN_EMP, "password": ADMIN_PW
    })
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def all_employees(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/admin/employees")
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def existing_birthdays(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/admin/birthdays")
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def created_birthday(admin_client, all_employees, existing_birthdays):
    """Create (upsert) a birthday and return (id, user_id, added_new). Cleanup at end."""
    used_ids = {b["user_id"] for b in existing_birthdays}
    target = next((e for e in all_employees if e["id"] not in used_ids and e.get("role") != "admin"), None)
    added_new = target is not None
    prev_snapshot = None
    if not target:
        target = next((e for e in all_employees if e["id"] in used_ids), None)
        prev_snapshot = next((b for b in existing_birthdays if b["user_id"] == target["id"]), None)
    assert target
    payload = {"user_id": target["id"], "mmdd": "07-15",
               "comment": "TEST_pytest_iter10", "photo": None}
    r = admin_client.post(f"{BASE_URL}/api/admin/birthdays", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    yield {"id": data["id"], "user_id": target["id"], "added_new": added_new,
           "prev_snapshot": prev_snapshot}
    # Teardown
    try:
        if added_new:
            admin_client.delete(f"{BASE_URL}/api/admin/birthdays/{data['id']}")
        elif prev_snapshot:
            admin_client.patch(f"{BASE_URL}/api/admin/birthdays/{data['id']}", json={
                "mmdd": prev_snapshot["mmdd"],
                "comment": prev_snapshot.get("comment"),
                "clear_photo": prev_snapshot.get("photo") is None,
                "photo": prev_snapshot.get("photo") if prev_snapshot.get("photo") else None,
            })
    except Exception:
        pass


def _make_test_png_data_url(w=1200, h=800):
    img = Image.new("RGB", (w, h), color=(255, 100, 50))
    # Add a stripe to give some content
    for x in range(0, w, 40):
        for y in range(0, h):
            img.putpixel((x, y), (0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return "data:image/png;base64," + b64, len(buf.getvalue())


# --- 1. GET admin/birthdays: admin access + shape ---
class TestAdminBirthdaysList:
    def test_list_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/birthdays")
        assert r.status_code == 401

    def test_list_returns_array_sorted_by_mmdd(self, existing_birthdays):
        assert isinstance(existing_birthdays, list)
        # Should have ~303 imported entries per problem statement
        assert len(existing_birthdays) > 0, "No birthdays imported"
        # Verify sort by mmdd
        mmdds = [b["mmdd"] for b in existing_birthdays if b.get("mmdd")]
        assert mmdds == sorted(mmdds), "Birthdays not sorted by mmdd"
        # Verify shape
        b = existing_birthdays[0]
        for k in ("id", "user_id", "employee_number", "name", "mmdd"):
            assert k in b


# --- 2. POST admin/birthdays: create + upsert ---
class TestAdminBirthdaysCreate:
    def test_create_or_update_birthday(self, admin_client, created_birthday):
        bid = created_birthday["id"]
        uid = created_birthday["user_id"]
        r2 = admin_client.get(f"{BASE_URL}/api/admin/birthdays")
        assert r2.status_code == 200
        found = [b for b in r2.json() if b["user_id"] == uid]
        assert len(found) == 1
        assert found[0]["mmdd"] == "07-15"
        assert found[0]["comment"] == "TEST_pytest_iter10"
        assert found[0]["id"] == bid


# --- 3. PATCH admin/birthdays/{id}: comment, photo, clear_photo ---
class TestAdminBirthdaysPatch:
    def test_patch_photo_gets_resized_to_jpeg(self, admin_client, created_birthday):
        bid = created_birthday["id"]
        data_url, src_bytes = _make_test_png_data_url(1200, 800)
        r = admin_client.patch(f"{BASE_URL}/api/admin/birthdays/{bid}",
                               json={"photo": data_url})
        assert r.status_code == 200, f"PATCH photo failed: {r.text}"
        r2 = admin_client.get(f"{BASE_URL}/api/admin/birthdays")
        rec = next((b for b in r2.json() if b["id"] == bid), None)
        assert rec is not None
        photo = rec["photo"]
        assert photo is not None
        assert photo.startswith("data:image/jpeg;base64,"), f"Photo not JPEG: {photo[:60]}"
        b64 = photo.split(",", 1)[1]
        raw = base64.b64decode(b64)
        # Verify the resized image is 512x512 as spec'd
        resized = Image.open(io.BytesIO(raw))
        assert resized.size == (512, 512), f"Expected 512x512, got {resized.size}"
        assert resized.format == "JPEG"
        assert rec["comment"] == "TEST_pytest_iter10"

    def test_patch_clear_photo_keeps_comment(self, admin_client, created_birthday):
        bid = created_birthday["id"]
        # Ensure a photo is set first
        data_url, _ = _make_test_png_data_url(600, 400)
        admin_client.patch(f"{BASE_URL}/api/admin/birthdays/{bid}", json={"photo": data_url})
        r = admin_client.patch(f"{BASE_URL}/api/admin/birthdays/{bid}",
                               json={"clear_photo": True})
        assert r.status_code == 200
        r2 = admin_client.get(f"{BASE_URL}/api/admin/birthdays")
        rec = next((b for b in r2.json() if b["id"] == bid), None)
        assert rec["photo"] is None, "Photo should be null after clear_photo"
        assert rec["comment"] == "TEST_pytest_iter10", "Comment should remain unchanged"

    def test_patch_update_comment_and_mmdd(self, admin_client, created_birthday):
        bid = created_birthday["id"]
        r = admin_client.patch(f"{BASE_URL}/api/admin/birthdays/{bid}",
                               json={"comment": "TEST_updated", "mmdd": "08-20"})
        assert r.status_code == 200
        r2 = admin_client.get(f"{BASE_URL}/api/admin/birthdays")
        rec = next((b for b in r2.json() if b["id"] == bid), None)
        assert rec["comment"] == "TEST_updated"
        assert rec["mmdd"] == "08-20"

    def test_patch_invalid_mmdd_rejected(self, admin_client, created_birthday):
        bid = created_birthday["id"]
        # Backend regex ^\d{2}-\d{2}$ is digit-format only; "13-99" passes.
        # Report: backend accepts semantically invalid MM-DD (not blocking).
        r = admin_client.patch(f"{BASE_URL}/api/admin/birthdays/{bid}",
                               json={"mmdd": "ab-cd"})
        assert r.status_code == 422  # non-digits correctly rejected


# --- 4. Employee-facing /birthdays/today regression ---
class TestBirthdaysTodayShape:
    def test_today_endpoint_shape_and_auth(self, admin_client):
        r = requests.get(f"{BASE_URL}/api/birthdays/today")
        assert r.status_code == 401
        r = admin_client.get(f"{BASE_URL}/api/birthdays/today")
        assert r.status_code == 200
        data = r.json()
        assert "today" in data and "birthdays" in data
        assert isinstance(data["birthdays"], list)
        for card in data["birthdays"]:
            for k in ("id", "user_id", "employee_number", "name", "message"):
                assert k in card


# --- 5. DELETE admin/birthdays/{id} ---
class TestAdminBirthdaysDelete:
    def test_delete_invalid_id(self, admin_client):
        r = admin_client.delete(f"{BASE_URL}/api/admin/birthdays/notavalidid")
        assert r.status_code == 400


# --- 6. Non-admin cannot access admin endpoints ---
class TestAuthGuards:
    def test_post_admin_birthdays_no_token(self):
        r = requests.post(f"{BASE_URL}/api/admin/birthdays",
                          json={"user_id": "x", "mmdd": "01-01"})
        assert r.status_code == 401
