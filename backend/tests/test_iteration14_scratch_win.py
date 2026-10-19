# Iteration 14: Daily Scratch & Win (config, lock/unlock, play, winner limit, concurrency, admin overview/history)
import os
import concurrent.futures as cf
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
IST = timezone(timedelta(hours=5, minutes=30))
TODAY = datetime.now(IST).date().isoformat()
TOMORROW = (datetime.now(IST).date() + timedelta(days=1)).isoformat()
PW = "test@1234"
EMPS = [f"TEST_SC{i}" for i in range(1, 7)]  # SC6 never books


def login(emp, pw):
    r = requests.post(f"{API}/auth/login", json={"employee_number": emp, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def ctx():
    admin = login("135791", "admin@123")
    users = {}
    for e in EMPS:
        r = requests.post(f"{API}/admin/employees", headers=admin,
                          json={"employee_number": e, "name": f"Name {e}", "password": PW})
        if r.status_code == 400:  # exists from prior run
            lst = requests.get(f"{API}/admin/employees", headers=admin).json()
            uid = next(u["id"] for u in lst if u["employee_number"] == e)
        else:
            assert r.status_code == 200, r.text
            uid = r.json()["id"]
        users[e] = {"id": uid, "h": login(e, PW)}
    yield {"admin": admin, "users": users}
    requests.put(f"{API}/admin/scratch/config", headers=admin,
                 json={"enabled": False, "target": 50, "winners": 3, "reward": "WINNER"})


def set_cfg(ctx, **kw):
    body = {"enabled": True, "target": 2, "winners": 1, "reward": "TEST_Free Dessert"}
    body.update(kw)
    r = requests.put(f"{API}/admin/scratch/config", headers=ctx["admin"], json=body)
    assert r.status_code == 200, r.text
    return r.json()


def admin_book(ctx, emp, date):
    r = requests.post(f"{API}/admin/bookings", headers=ctx["admin"], json={
        "user_id": ctx["users"][emp]["id"], "meal_type": "dinner", "meal_date": date, "reason": "TEST scratch"})
    assert r.status_code == 200, r.text


def card(ctx, emp, date):
    r = requests.get(f"{API}/scratch/status", headers=ctx["users"][emp]["h"])
    assert r.status_code == 200
    return next(c for c in r.json()["cards"] if c["dinner_date"] == date)


def play(ctx, emp, date):
    return requests.post(f"{API}/scratch/play", headers=ctx["users"][emp]["h"], json={"dinner_date": date})


class TestScratch:
    def test_01_disabled(self, ctx):
        cfg = set_cfg(ctx, enabled=False)
        assert cfg["enabled"] is False and cfg["reward"] == "TEST_Free Dessert"
        g = requests.get(f"{API}/admin/scratch/config", headers=ctx["admin"]).json()
        assert g["target"] == 2 and g["winners"] == 1
        s = requests.get(f"{API}/scratch/status", headers=ctx["users"]["TEST_SC1"]["h"]).json()
        assert s["enabled"] is False and s["cards"] == []
        assert play(ctx, "TEST_SC1", TODAY).status_code == 400

    def test_02_validation_and_auth(self, ctx):
        r = requests.put(f"{API}/admin/scratch/config", headers=ctx["admin"],
                         json={"enabled": True, "target": 0, "winners": 1, "reward": "x"})
        assert r.status_code == 422
        r = requests.put(f"{API}/admin/scratch/config", headers=ctx["users"]["TEST_SC1"]["h"],
                         json={"enabled": True, "target": 2, "winners": 1, "reward": "x"})
        assert r.status_code == 403
        assert requests.get(f"{API}/admin/scratch/overview", headers=ctx["users"]["TEST_SC1"]["h"]).status_code == 403
        set_cfg(ctx, reward="   ")
        assert requests.get(f"{API}/admin/scratch/config", headers=ctx["admin"]).json()["reward"] == "WINNER"

    def test_03_locked_until_target(self, ctx):
        set_cfg(ctx)
        # employee self-booking for today dinner (regression of booking create)
        r = requests.post(f"{API}/bookings", headers=ctx["users"]["TEST_SC1"]["h"],
                          json={"meal_type": "dinner", "meal_date": TODAY})
        assert r.status_code == 200, r.text
        c = card(ctx, "TEST_SC1", TODAY)
        assert c["bookings"] == 1 and c["unlocked"] is False and c["can_scratch"] is False and c["booked"] is True
        assert play(ctx, "TEST_SC1", TODAY).status_code == 400

    def test_04_unlock_and_non_booker(self, ctx):
        for e in ["TEST_SC2", "TEST_SC3", "TEST_SC4", "TEST_SC5"]:
            admin_book(ctx, e, TODAY)
        c = card(ctx, "TEST_SC1", TODAY)
        assert c["unlocked"] is True and c["can_scratch"] is True and c["bookings"] == 5
        c6 = card(ctx, "TEST_SC6", TODAY)
        assert c6["booked"] is False and c6["can_scratch"] is False
        assert play(ctx, "TEST_SC6", TODAY).status_code == 403

    def test_05_invalid_date(self, ctx):
        y = (datetime.now(IST).date() - timedelta(days=1)).isoformat()
        assert play(ctx, "TEST_SC1", y).status_code == 400
        assert play(ctx, "TEST_SC1", "2026/10/19").status_code == 422

    def test_06_concurrent_winner_limit(self, ctx):
        emps = ["TEST_SC1", "TEST_SC2", "TEST_SC3", "TEST_SC4", "TEST_SC5"]
        with cf.ThreadPoolExecutor(10) as ex:
            # each user fires 2 concurrent requests -> 1 must be 409
            futs = [ex.submit(play, ctx, e, TODAY) for e in emps for _ in range(2)]
            res = [f.result() for f in futs]
        codes = [r.status_code for r in res]
        assert codes.count(200) == 5 and codes.count(409) == 5, codes
        won = [r.json() for r in res if r.status_code == 200 and r.json()["result"] == "won"]
        assert len(won) <= 1
        print("today winners:", len(won))
        assert won and won[0]["reward"] == "TEST_Free Dessert"

    def test_07_second_play_409_and_static(self, ctx):
        assert play(ctx, "TEST_SC1", TODAY).status_code == 409
        c = card(ctx, "TEST_SC1", TODAY)
        assert c["result"] in ("won", "lost") and c["can_scratch"] is False
        assert c["winners_left"] == 0 and len(c["winners"]) == 1

    def test_08_stays_unlocked_when_target_raised(self, ctx):
        set_cfg(ctx, target=500)
        c = card(ctx, "TEST_SC2", TODAY)
        assert c["unlocked"] is True

    def test_09_all_win_when_slots_enough(self, ctx):
        set_cfg(ctx, target=3, winners=10)
        for e in ["TEST_SC1", "TEST_SC2", "TEST_SC3"]:
            admin_book(ctx, e, TOMORROW)
        results = [play(ctx, e, TOMORROW).json()["result"] for e in ["TEST_SC1", "TEST_SC2", "TEST_SC3"]]
        assert results == ["won", "won", "won"]

    def test_10_admin_overview_history(self, ctx):
        ov = requests.get(f"{API}/admin/scratch/overview", headers=ctx["admin"]).json()
        assert ov["config"]["winners"] == 10
        days = {d["dinner_date"]: d for d in ov["days"]}
        assert days[TODAY]["scratched"] == 5 and days[TODAY]["winners_count"] == 1
        assert days[TOMORROW]["scratched"] == 3 and days[TOMORROW]["winners_count"] == 3
        assert days[TODAY]["unlocked_at"] and days[TODAY]["winners"][0]["employee_number"].startswith("TEST_SC")
        assert "_id" not in str(ov)
        hist = requests.get(f"{API}/admin/scratch/history", headers=ctx["admin"]).json()
        hd = {h["dinner_date"]: h for h in hist}
        assert hd[TODAY]["scratched"] == 5 and len(hd[TOMORROW]["winners"]) == 3
        assert all(w["name"].startswith("Name TEST_SC") for w in hd[TOMORROW]["winners"])
