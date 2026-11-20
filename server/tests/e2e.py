"""E2E driver for the Student Tracker API - full role flow with assertions."""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:5000/api"
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


def check(name, cond, context=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"PASS  {name}")
    else:
        failed += 1
        print(f"FAIL  {name}  ->  {json.dumps(context)[:300]}")


# ---- 1. Admin sets up subjects and users -----------------------------------
_, r = call("POST", "/auth/login", {"email": "adityamahar8485@gmail.com", "password": "Admin@2026"})
TA = r["token"]
check("admin login", bool(TA), r)

s, r = call("POST", "/admin/subjects", {"name": "Mathematics", "code": "MATH101", "totalMarks": 100}, TA)
MATH = r["data"]["_id"]
check("create MATH101", s == 201, r)

s, r = call("POST", "/admin/subjects", {"name": "Physics", "code": "PHY102", "totalMarks": 100}, TA)
PHY = r["data"]["_id"]
check("create PHY102", s == 201, r)

s, r = call("POST", "/admin/teachers", {"name": "Riya Sharma", "email": "riya@school.dev", "password": "Teacher@1", "subject": MATH}, TA)
check("register teacher riya", s == 201, r)

s, r = call("POST", "/admin/teachers", {"name": "Vikram Rao", "email": "vikram@school.dev", "password": "Teacher@2", "subject": PHY}, TA)
check("register teacher vikram", s == 201, r)

students = {}
for name, email in [("Aarav", "aarav@student.dev"), ("Diya", "diya@student.dev"), ("Kabir", "kabir@student.dev")]:
    s, r = call("POST", "/admin/students", {"name": name, "email": email, "password": "Student@1", "batch": "2026", "subjects": [MATH, PHY]}, TA)
    students[email] = r["data"]["student"]["_id"]
    check(f"register student {name}", s == 201 and r["data"]["enrolledSubjects"] == 2, r)

s, r = call("POST", "/admin/students", {"name": "Isha", "email": "isha@student.dev", "password": "Student@1", "batch": "2026"}, TA)
ISHA = r["data"]["student"]["_id"]
check("register student Isha (no subjects)", s == 201 and r["data"]["enrolledSubjects"] == 0, r)

_, r = call("POST", "/auth/login", {"email": "riya@school.dev", "password": "Teacher@1"})
T1 = r["token"]
_, r = call("POST", "/auth/login", {"email": "vikram@school.dev", "password": "Teacher@2"})
T2 = r["token"]
check("teacher logins", bool(T1 and T2), r)

# ---- 2. Teacher enters marks ------------------------------------------------
s, r = call("GET", "/teacher/subjects", None, T1)
check("riya sees only MATH101", len(r["data"]) == 1 and r["data"][0]["code"] == "MATH101", r)

s, r = call("POST", "/teacher/exams", {"subject": MATH, "name": "Midterm", "date": "2026-11-10", "maxMarks": 50}, T1)
EXAM1 = r["data"]["_id"]
check("riya creates Midterm (max 50)", s == 201, r)

s, r = call("POST", "/teacher/exams", {"subject": PHY, "name": "Quiz", "date": "2026-11-12", "maxMarks": 40}, T1)
check("riya CANNOT create exam for vikram's subject", s == 403, r)

s, r = call("POST", f"/teacher/exams/{EXAM1}/marks", {"marks": [
    {"student": students["aarav@student.dev"], "score": 45},
    {"student": students["diya@student.dev"], "score": 30},
    {"student": students["kabir@student.dev"], "score": 15},
]}, T1)
check("bulk marks entered (3)", r.get("data", {}).get("processed") == 3, r)

s, r = call("POST", f"/teacher/exams/{EXAM1}/marks", {"marks": [{"student": ISHA, "score": 10}]}, T1)
check("unenrolled student rejected", s == 400 and "not enrolled" in r["message"], r)

s, r = call("POST", f"/teacher/exams/{EXAM1}/marks", {"marks": [{"student": students["aarav@student.dev"], "score": 60}]}, T1)
check("score above exam max rejected", s == 400 and "exceeds" in r["message"], r)

s, r = call("GET", f"/teacher/exams/{EXAM1}/results", None, T1)
rows = {x["student"]["email"]: x for x in r["data"]["results"]}
check("results: aarav 90% A pass", rows["aarav@student.dev"]["percentage"] == 90 and rows["aarav@student.dev"]["grade"] == "A" and rows["aarav@student.dev"]["isPass"] is True, r)
check("results: kabir 30% F fail", rows["kabir@student.dev"]["percentage"] == 30 and rows["kabir@student.dev"]["grade"] == "F" and rows["kabir@student.dev"]["isPass"] is False, r)
KABIR_MARK = rows["kabir@student.dev"]["markId"]

# ---- 3. Edit before lock works, then request lock ---------------------------
s, r = call("PATCH", f"/teacher/marks/{KABIR_MARK}", {"score": 20}, T1)
check("edit mark 15 -> 20 (40%, now passes)", r["data"]["percentage"] == 40 and r["data"]["grade"] == "D" and r["data"]["isPass"] is True, r)

s, r = call("PATCH", f"/teacher/exams/{EXAM1}/request-lock", None, T1)
check("riya requests lock", r["data"]["lockRequested"] is True, r)

# ---- 4. Teacher 2 + second exam ---------------------------------------------
s, r = call("POST", "/teacher/exams", {"subject": PHY, "name": "Unit Test", "date": "2026-11-15", "maxMarks": 40}, T2)
EXAM2 = r["data"]["_id"]
check("vikram creates Unit Test (max 40)", s == 201, r)

s, r = call("POST", f"/teacher/exams/{EXAM2}/marks", {"marks": [
    {"student": students["aarav@student.dev"], "score": 36},
    {"student": students["diya@student.dev"], "score": 20},
    {"student": students["kabir@student.dev"], "score": 8},
]}, T2)
check("bulk marks for physics", r.get("data", {}).get("processed") == 3, r)

# ---- 5. Admin locks; edits must now be blocked ------------------------------
s, r = call("GET", "/admin/exams", None, TA)
e1 = next(e for e in r["data"] if e["_id"] == EXAM1)
check("admin sees lockRequested flag", e1["lockRequested"] is True and e1["isLocked"] is False, e1)

s, r = call("PATCH", f"/admin/exams/{EXAM1}/lock", {"isLocked": True}, TA)
check("admin locks Midterm", r["data"]["isLocked"] is True, r)

s, r = call("PATCH", f"/teacher/marks/{KABIR_MARK}", {"score": 25}, T1)
check("edit AFTER lock blocked (403)", s == 403 and "locked" in r["message"], r)

s, r = call("POST", f"/teacher/exams/{EXAM1}/marks", {"marks": [{"student": students["aarav@student.dev"], "score": 10}]}, T1)
check("bulk entry AFTER lock blocked (403)", s == 403 and "locked" in r["message"], r)

# ---- 6. Analytics - verify computed numbers ---------------------------------
# MATH: (45+30+20)/150 = 63.33% · PHY: (36+20+8)/120 = 53.33%
# MATH pass 3 (>=20) fail 0 · PHY pass 2 (>=16) fail 1
# top: aarav 81/90=90 · diya 50/90=55.56 · kabir 28/90=31.11 · lowest = PHY
s, r = call("GET", "/admin/analytics", None, TA)
d = r["data"]
avg = {x["subject"]["code"]: x for x in d["avgPerSubject"]}
check("avg MATH101 = 63.33", avg["MATH101"]["avgPercentage"] == 63.33, d["avgPerSubject"])
check("avg PHY102 = 53.33", avg["PHY102"]["avgPercentage"] == 53.33, d["avgPerSubject"])
pf = {x["subject"]["code"]: x for x in d["passFailPerSubject"]}
check("MATH pass/fail = 3/0", pf["MATH101"]["passCount"] == 3 and pf["MATH101"]["failCount"] == 0, d["passFailPerSubject"])
check("PHY pass/fail = 2/1", pf["PHY102"]["passCount"] == 2 and pf["PHY102"]["failCount"] == 1, d["passFailPerSubject"])
tp = d["topPerformers"]
check("top3 order aarav>diya>kabir", [t["student"]["email"] for t in tp] == ["aarav@student.dev", "diya@student.dev", "kabir@student.dev"], tp)
check("top1 cumulative 90.0", tp[0]["cumulativePercentage"] == 90.0, tp)
check("lowest avg subject = PHY102 (needs attention)", d["lowestAvgSubject"]["subject"]["code"] == "PHY102", d["lowestAvgSubject"])
check("totals sane", d["totals"] == {"subjects": 2, "teachers": 2, "students": 4, "exams": 2, "marks": 6}, d["totals"])
check("exam trend sheet has both exams chronological", [t["name"] for t in d.get("examTrend", [])] == ["Midterm", "Unit Test"], d.get("examTrend"))

# ---- 6b. Admin/teacher visibility of student profiles ------------------------
s, r = call("GET", f"/admin/students/{students['aarav@student.dev']}/performance", None, TA)
check("admin sees Aarav's full profile (rank 1, 2 subjects, exam rows)",
      r["data"]["rank"] == 1 and len(r["data"]["perSubject"]) == 2
      and all(len(p["exams"]) > 0 for p in r["data"]["perSubject"]), r.get("data", r))
s, r = call("GET", f"/teacher/students/{ISHA}/performance", None, T1)
check("teacher blocked from non-shared student profile (403)", s == 403, r)
s, r = call("GET", f"/teacher/students/{students['aarav@student.dev']}/performance", None, T1)
check("teacher sees shared student's profile", s == 200 and r["data"]["student"]["name"] == "Aarav", r)

# ---- 6c. Admin visibility of teacher profiles --------------------------------
_, r = call("POST", "/auth/login", {"email": "riya@school.dev", "password": "Teacher@1"})
T1_ID = r["user"]["id"]
s, r = call("GET", f"/admin/teachers/{T1_ID}/profile", None, TA)
check("admin sees riya's profile (1 subject, MATH101, exam register with marks)",
      len(r["data"]["subjects"]) == 1 and r["data"]["subjects"][0]["subject"]["code"] == "MATH101"
      and len(r["data"]["exams"]) >= 1 and all(e["marksEntered"] > 0 for e in r["data"]["exams"]),
      r.get("data", r))
s, r = call("GET", f"/admin/teachers/{T1_ID}/profile", None, T2)
check("teacher blocked from admin teacher-profile route (403)", s == 403, r)

# ---- 7. Access control spot checks ------------------------------------------
s, r = call("GET", "/admin/analytics", None, T1)
check("teacher blocked from admin analytics", s == 403, r)
s, r = call("GET", "/teacher/subjects", None, None)
check("no token -> 401", s == 401, r)

# ---- 8. Student phase: second exam, then subjects/rank/trend ---------------
s, r = call("POST", "/teacher/exams", {"subject": MATH, "name": "Final", "date": "2026-11-25", "maxMarks": 50}, T1)
EXAM3 = r["data"]["_id"]
check("riya creates Final (max 50)", s == 201, r)

s, r = call("POST", f"/teacher/exams/{EXAM3}/marks", {"marks": [
    {"student": students["aarav@student.dev"], "score": 40},
    {"student": students["diya@student.dev"], "score": 35},
    {"student": students["kabir@student.dev"], "score": 10},
]}, T1)
check("bulk marks for Final", r.get("data", {}).get("processed") == 3, r)

def student_login(email):
    _, r = call("POST", "/auth/login", {"email": email, "password": "Student@1"})
    return r["token"]

SA = student_login("aarav@student.dev")
SK = student_login("kabir@student.dev")
SI = student_login("isha@student.dev")

# aarav: MATH (45+40)/100 = 85 B · PHY 36/40 = 90 A
s, r = call("GET", "/student/subjects", None, SA)
sub = {x["subject"]["code"]: x for x in r["data"]}
check("aarav subject card MATH 85% B", sub["MATH101"]["percentage"] == 85 and sub["MATH101"]["grade"] == "B" and sub["MATH101"]["examCount"] == 2, sub)
check("aarav subject card PHY 90% A", sub["PHY102"]["percentage"] == 90 and sub["PHY102"]["grade"] == "A", sub)

# aarav overall: 121/140 = 86.43 B, rank 1/3 · kabir: 38/140 = 27.14 F, rank 3
s, r = call("GET", "/student/performance", None, SA)
check("aarav cumulative 86.43 grade B", r["data"]["cumulativePercentage"] == 86.43 and r["data"]["overallGrade"] == "B", r["data"])
check("aarav rank 1 of cohort 3", r["data"]["rank"] == 1 and r["data"]["cohortSize"] == 3, r["data"])
check("aarav grade breakdown A2 B1", r["data"]["gradeBreakdown"] == {"A": 2, "B": 1, "C": 0, "D": 0, "F": 0}, r["data"])

s, r = call("GET", "/student/performance", None, SK)
check("kabir cumulative 27.14 grade F rank 3", r["data"]["cumulativePercentage"] == 27.14 and r["data"]["overallGrade"] == "F" and r["data"]["rank"] == 3, r["data"])

# trend: Midterm (Nov 10) 90 -> Final (Nov 25) 80
s, r = call("GET", f"/student/subjects/{MATH}/trend", None, SA)
trend = r["data"]["trend"]
check("aarav MATH trend has 2 points [90, 80]", [t["percentage"] for t in trend] == [90, 80], trend)

# isha: enrolled in nothing
s, r = call("GET", "/student/subjects", None, SI)
check("isha has no subjects", r["data"] == [], r)
s, r = call("GET", "/student/performance", None, SI)
check("isha unranked but cohort exists (3 marked students)", r["data"]["rank"] is None and r["data"]["cohortSize"] == 3, r["data"])
s, r = call("GET", f"/student/subjects/{MATH}/trend", None, SI)
check("isha blocked from un-enrolled subject trend (403)", s == 403, r)

# ---- 9. Locked exam still counts, new exam editable -------------------------
s, r = call("POST", f"/teacher/exams/{EXAM3}/marks", {"marks": [{"student": students["diya@student.dev"], "score": 38}]}, T1)
check("marks can be corrected on unlocked Final exam", r.get("data", {}).get("updated") >= 1, r)

print(f"\n===== {passed} passed, {failed} failed =====")
exit(1 if failed else 0)
