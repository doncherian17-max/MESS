# Setup UI scenario for iteration14 scratch UI tests (run after cleanup_scratch_test.sh)
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import requests
from test_iteration14_scratch_win import API, TODAY, TOMORROW, login, PW

admin = login("135791", "admin@123")
ids = {}
for e in ["TEST_SC1", "TEST_SC2", "TEST_SC3"]:
    r = requests.post(f"{API}/admin/employees", headers=admin, json={"employee_number": e, "name": f"Name {e}", "password": PW})
    ids[e] = r.json()["id"]
for e, d in [("TEST_SC1", TODAY), ("TEST_SC2", TODAY), ("TEST_SC1", TOMORROW)]:
    r = requests.post(f"{API}/admin/bookings", headers=admin, json={"user_id": ids[e], "meal_type": "dinner", "meal_date": d, "reason": "TEST"})
    print(e, d, r.status_code)
r = requests.put(f"{API}/admin/scratch/config", headers=admin, json={"enabled": True, "target": 2, "winners": 5, "reward": "TEST_Free Dessert"})
print(r.json())
