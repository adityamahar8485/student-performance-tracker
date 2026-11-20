"""Demo verification (HTTP) — run after `npm run seed:demo` with the API up."""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:5000/api"
passed, failed = 0, 0


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def check(name, cond, ctx=""):
    global passed, failed
    if cond:
        passed += 1
        print("PASS ", name)
    else:
        failed += 1
        print("FAIL ", name, "->", json.dumps(ctx)[:200])


# 1. Role logins
_, r = call("POST", "/auth/login", {"email": "adityamahar8485@gmail.com", "password": "Admin@2026"})
TA = r.get("token")
check("admin login", bool(TA), r)
_, r = call("POST", "/auth/login", {"email": "priya.nair@school.dev", "password": "Teacher@2026"})
TT = r.get("token")
check("teacher login (Priya)", bool(TT), r)
_, r = call("POST", "/auth/login", {"email": "aarav.sharma@student.dev", "password": "Student@2026"})
TS = r.get("token")
check("student login (Aarav Sharma)", bool(TS), r)

# 2. Admin analytics over the demo dataset
_, r = call("GET", "/admin/analytics", None, TA)
d = r["data"]
check("totals: 6 subjects / 3 teachers / 24 students / 18 exams / 320 marks",
      d["totals"] == {"subjects": 6, "teachers": 3, "students": 24, "exams": 18, "marks": 320}, d["totals"])
check("avg per subject covers all 6", len(d["avgPerSubject"]) == 6,
      [x["subject"]["code"] for x in d["avgPerSubject"]])
print("      avg per subject:", {x["subject"]["code"]: x["avgPercentage"] for x in d["avgPerSubject"]})
check("lowest-avg subject exists", d["lowestAvgSubject"] is not None, d["lowestAvgSubject"]["subject"]["code"])
print("      top 3:", [(t["student"]["name"], t["cumulativePercentage"]) for t in d["topPerformers"]])
_, r = call("GET", "/admin/exams", None, TA)
pending = [e for e in r["data"] if e["lockRequested"] and not e["isLocked"]]
check("exactly 1 pending lock request (CHEM201 Midterm)",
      len(pending) == 1 and pending[0]["subject"]["code"] == "CHEM201" and pending[0]["name"] == "Midterm",
      [(e["subject"]["code"], e["name"]) for e in pending])

# 3. Teacher sees only their subjects
_, r = call("GET", "/teacher/subjects", None, TT)
codes = [s["code"] for s in r["data"]]
check("Priya owns MATH101 + BIOL202 only", sorted(codes) == ["BIOL202", "MATH101"], codes)

# 4. Student performance: rank within own batch cohort
_, r = call("GET", "/student/performance", None, TS)
p = r["data"]
check("Aarav cumulative % + grade present", p["cumulativePercentage"] is not None and p["overallGrade"] is not None, p)
check("rank within batch 2026 cohort of 14",
      p["batch"] == "2026" and p["rank"] >= 1 and p["cohortSize"] == 14,
      {"rank": p["rank"], "cohort": p["cohortSize"]})
print(f"      Aarav: {p['cumulativePercentage']}% grade {p['overallGrade']}, rank {p['rank']}/{p['cohortSize']}")
_, r = call("GET", "/student/subjects", None, TS)
subs = r["data"]
check("Aarav enrolled in 5 subjects with summaries", len(subs) == 5, len(subs))
first = subs[0]["subject"]
_, r = call("GET", f"/student/subjects/{first['_id']}/trend", None, TS)
trend = r["data"]["trend"]
check(f"trend for {first['code']} has 3 chronological points", len(trend) == 3, [t["name"] for t in trend])

# 5. Locked exam rejects writes (the graded lock rule, on demo data)
_, r = call("GET", "/teacher/exams", None, TT)
locked = next(e for e in r["data"] if e["isLocked"])
s, r = call("POST", f"/teacher/exams/{locked['_id']}/marks",
            {"marks": [{"student": None, "score": 1}]}, TT)
check("writing to a LOCKED exam is rejected (403)", s == 403, r)

print(f"\n===== {passed} passed, {failed} failed =====")
exit(1 if failed else 0)
