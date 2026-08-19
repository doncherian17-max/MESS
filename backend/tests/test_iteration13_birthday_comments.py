"""
Iteration 13 backend regression tests: Birthday comment field + new-employee flow.
Covers:
  - POST /api/admin/birthdays accepts optional 'comment' and persists it
  - GET  /api/admin/birthdays returns 'comment'
  - PATCH /api/admin/birthdays/{id} with only {comment} updates comment without touching mmdd/photo
  - GET  /api/birthdays/today returns 'comment' per card
  - POST /api/admin/employees creates user; duplicate employee_number => 400
"""
import os
import datetime as dt
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMP = "135791"
ADMIN_PW = "admin@123"

TEST_PREFIX = "TESTBDCOM"


def _login(emp, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"employee_number": emp, "password": pw})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    tok = _login(ADMIN_EMP, ADMIN_PW)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_users(admin_headers):
    """Create two disposable users; clean up at end."""
    created = []
    for i in (1, 2):
        emp = f"{TEST_PREFIX}{i}"
        # cleanup any leftover
        r = requests.get(f"{BASE_URL}/api/admin/employees", headers=admin_headers)
        for u in r.json():
            if u["employee_number"] == emp:
                requests.delete(f"{BASE_URL}/api/admin/employees/{u['id']}",
                                headers=admin_headers)
        r = requests.post(f"{BASE_URL}/api/admin/employees", headers=admin_headers,
                          json={"employee_number": emp, "name": f"Test BDCom {i}",
                                "password": emp, "role": "employee"})
        assert r.status_code == 200, r.text
        created.append(r.json())
    yield created
    # teardown: delete birthdays + users
    r = requests.get(f"{BASE_URL}/api/admin/birthdays", headers=admin_headers)
    for b in r.json():
        if b["employee_number"].startswith(TEST_PREFIX):
            requests.delete(f"{BASE_URL}/api/admin/birthdays/{b['id']}",
                            headers=admin_headers)
    for u in created:
        requests.delete(f"{BASE_URL}/api/admin/employees/{u['id']}",
                        headers=admin_headers)


def test_create_employee_duplicate_returns_400(admin_headers, test_users):
    u = test_users[0]
    r = requests.post(f"{BASE_URL}/api/admin/employees", headers=admin_headers,
                      json={"employee_number": u["employee_number"], "name": "dupe",
                            "password": "abcd1234", "role": "employee"})
    assert r.status_code == 400, f"expected 400 duplicate, got {r.status_code} {r.text}"


def test_post_birthday_with_comment_persists(admin_headers, test_users):
    u = test_users[0]
    mmdd = dt.date.today().strftime("%m-%d")
    comment = "🎉 Enjoy your special day, buddy!"
    r = requests.post(f"{BASE_URL}/api/admin/birthdays", headers=admin_headers,
                      json={"user_id": u["id"], "mmdd": mmdd, "comment": comment})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["comment"] == comment
    assert body["mmdd"] == mmdd
    # verify via GET list
    r2 = requests.get(f"{BASE_URL}/api/admin/birthdays", headers=admin_headers)
    row = next((b for b in r2.json() if b["user_id"] == u["id"]), None)
    assert row is not None
    assert row["comment"] == comment


def test_patch_comment_only_does_not_touch_mmdd(admin_headers, test_users):
    u = test_users[0]
    # find birthday row
    r = requests.get(f"{BASE_URL}/api/admin/birthdays", headers=admin_headers)
    row = next(b for b in r.json() if b["user_id"] == u["id"])
    original_mmdd = row["mmdd"]
    new_comment = "Updated comment only ✨"
    r2 = requests.patch(f"{BASE_URL}/api/admin/birthdays/{row['id']}",
                        headers=admin_headers, json={"comment": new_comment})
    assert r2.status_code == 200, r2.text
    r3 = requests.get(f"{BASE_URL}/api/admin/birthdays", headers=admin_headers)
    row2 = next(b for b in r3.json() if b["id"] == row["id"])
    assert row2["comment"] == new_comment
    assert row2["mmdd"] == original_mmdd


def test_birthdays_today_returns_comment(admin_headers, test_users):
    # user 2: set birthday=today with a comment, then hit /birthdays/today (as employee)
    u = test_users[1]
    mmdd = dt.date.today().strftime("%m-%d")
    cmt = "Have a fantastic year ahead!"
    r = requests.post(f"{BASE_URL}/api/admin/birthdays", headers=admin_headers,
                      json={"user_id": u["id"], "mmdd": mmdd, "comment": cmt})
    assert r.status_code == 200
    # login as the new user - password == employee_number
    tok = _login(u["employee_number"], u["employee_number"])
    r2 = requests.get(f"{BASE_URL}/api/birthdays/today",
                      headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200, r2.text
    bd = r2.json()["birthdays"]
    mine = next((c for c in bd if c["employee_number"] == u["employee_number"]), None)
    assert mine is not None, f"expected {u['employee_number']} in today: {bd}"
    assert mine.get("comment") == cmt


def test_post_birthday_without_comment_ok(admin_headers, test_users):
    # updating existing (upsert) with no comment shouldn't blow up.
    u = test_users[0]
    mmdd = "12-25"
    r = requests.post(f"{BASE_URL}/api/admin/birthdays", headers=admin_headers,
                      json={"user_id": u["id"], "mmdd": mmdd})
    assert r.status_code == 200, r.text
    assert r.json()["mmdd"] == mmdd
