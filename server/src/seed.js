// Seeds the database.
//   npm run seed        -> admin only (used before the E2E suite)
//   npm run seed:demo   -> wipe + admin + full demo dataset (subjects, teachers,
//                          students, enrollments, exams with lock states, marks)
//
// The admin password is NEVER stored as plaintext: User's pre-save hook
// bcrypt-hashes passwordHash (12 rounds) on create.
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/User.js';
import Subject from './models/Subject.js';
import Enrollment from './models/Enrollment.js';
import Exam from './models/Exam.js';
import Mark, { gradeFor } from './models/Mark.js';

const DEMO = process.argv.includes('--demo');

const ADMIN_NAME = process.env.ADMIN_NAME || 'Aditya Mahar';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'adityamahar8485@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026';

// Deterministic pseudo-random so every seed run produces the same demo data
let s = 20261120;
const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const clamp01 = (v) => Math.min(1, Math.max(0.03, v));
const round2 = (n) => Math.round(n * 100) / 100;

const wipe = async () => {
  const db = mongoose.connection.db;
  for (const c of ['users', 'subjects', 'enrollments', 'exams', 'marks']) {
    await db.collection(c).deleteMany({});
  }
};

const seedAdmin = async () => {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    console.error('Refusing to seed a default admin password in production. Set ADMIN_PASSWORD.');
    process.exit(1);
  }
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`Admin already exists: ${ADMIN_EMAIL}`);
    return existing;
  }
  const admin = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    passwordHash: ADMIN_PASSWORD, // hashed by the pre-save hook
    role: 'admin',
  });
  console.log(`Admin created: ${ADMIN_EMAIL} (password bcrypt-hashed before saving)`);
  return admin;
};

const TEACHER_PASSWORD = 'Teacher@2026';
const STUDENT_PASSWORD = 'Student@2026';

const SUBJECTS = [
  { name: 'Mathematics', code: 'MATH101', teacher: 'priya.nair@school.dev' },
  { name: 'Physics', code: 'PHY102', teacher: 'rahul.menon@school.dev' },
  { name: 'Chemistry', code: 'CHEM201', teacher: 'sneha.kulkarni@school.dev' },
  { name: 'Computer Science', code: 'CSCO302', teacher: 'rahul.menon@school.dev' },
  { name: 'Biology', code: 'BIOL202', teacher: 'priya.nair@school.dev' },
  { name: 'English', code: 'ENGL102', teacher: 'sneha.kulkarni@school.dev' },
];

const TEACHERS = [
  { name: 'Priya Nair', email: 'priya.nair@school.dev' },
  { name: 'Rahul Menon', email: 'rahul.menon@school.dev' },
  { name: 'Sneha Kulkarni', email: 'sneha.kulkarni@school.dev' },
];

const BATCH_2026 = [
  'Aarav Sharma', 'Diya Patel', 'Kabir Singh', 'Ishaan Verma', 'Meera Iyer',
  'Rohan Gupta', 'Ananya Reddy', 'Vivaan Joshi', 'Sara Khan', 'Arnav Mehta',
  'Tara Bose', 'Dev Malhotra', 'Kiara Rao', 'Aditya Kulkarni',
];
const BATCH_2025 = [
  'Zoya Ahmed', 'Reyansh Chauhan', 'Anika Pillai', 'Samar Jain', 'Naina Kapoor',
  'Yash Thakur', 'Riya Das', 'Myra Saxena', 'Vihaan Ghosh', 'Karan Nair',
];

const emailFor = (name) =>
  `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/ +/g, '.')}@student.dev`;

// Per-subject exam plan: [name, maxMarks, date, lock]
//   lock: 'locked' (finalised), 'requested' (teacher asked, admin pending), 'open'
const EXAM_PLAN = [
  { name: 'Quiz One', maxMarks: 20, date: '2026-09-15', lock: 'locked' },
  { name: 'Midterm', maxMarks: 50, date: '2026-10-20', lock: 'per-subject' },
  { name: 'Final Exam', maxMarks: 100, date: '2026-11-24', lock: 'open' },
];
const MIDTERM_LOCK = {
  MATH101: 'locked', PHY102: 'locked', CHEM201: 'requested',
  CSCO302: 'open', BIOL202: 'open', ENGL102: 'open',
};
// Final exams without marks yet (empty-state demos in the UI)
const FINAL_UNMARKED = new Set(['CSCO302', 'ENGL102']);

const seedDemo = async () => {
  // Teachers
  const teacherIds = {};
  for (const t of TEACHERS) {
    teacherIds[t.email] = (
      await User.create({ ...t, passwordHash: TEACHER_PASSWORD, role: 'teacher' })
    )._id;
  }

  // Subjects
  const subjects = {};
  for (const def of SUBJECTS) {
    subjects[def.code] = await Subject.create({
      name: def.name,
      code: def.code,
      totalMarks: 100,
      teacher: teacherIds[def.teacher],
    });
  }

  // Students (batch 2025 slightly stronger — seniors)
  const students = [];
  for (const [batch, names, lo, hi] of [
    ['2026', BATCH_2026, 0.42, 0.88],
    ['2025', BATCH_2025, 0.5, 0.95],
  ]) {
    for (const name of names) {
      const user = await User.create({
        name,
        email: emailFor(name),
        passwordHash: STUDENT_PASSWORD,
        role: 'student',
        batch,
      });
      students.push({
        id: user._id,
        batch,
        // stable per-student ability factor driving realistic score spread
        ability: lo + rnd() * (hi - lo),
      });
    }
  }

  // Enrollments: everyone takes MATH101 + PHY102 + ENGL102, plus a rotating
  // pair from CHEM201 / CSCO302 / BIOL202
  const electives = ['CHEM201', 'CSCO302', 'BIOL202'];
  const enrollmentRows = [];
  const subjectOf = {}; // studentId -> [codes]
  students.forEach((st, i) => {
    const codes = ['MATH101', 'PHY102', 'ENGL102', electives[i % 3], electives[(i + 1) % 3]];
    subjectOf[String(st.id)] = codes;
    for (const code of codes) {
      enrollmentRows.push({ student: st.id, subject: subjects[code]._id });
    }
  });
  await Enrollment.insertMany(enrollmentRows);

  // Exams
  const exams = []; // { doc, code, enrolled: [studentId] }
  for (const code of Object.keys(subjects)) {
    for (const plan of EXAM_PLAN) {
      const lock = plan.lock === 'per-subject' ? MIDTERM_LOCK[code] : plan.lock;
      const doc = await Exam.create({
        subject: subjects[code]._id,
        name: plan.name,
        date: new Date(plan.date),
        maxMarks: plan.maxMarks,
        createdBy: teacherIds[SUBJECTS.find((x) => x.code === code).teacher],
        lockRequested: lock === 'requested' || lock === 'locked',
        isLocked: lock === 'locked',
        lockedAt: lock === 'locked' ? new Date('2026-11-01') : null,
      });
      const enrolled = students
        .filter((st) => subjectOf[String(st.id)].includes(code))
        .map((st) => st.id);
      exams.push({ doc, code, plan, enrolled });
    }
  }

  // Marks — deterministic spread: ability ± noise, clamped to [0, max]
  const markRows = [];
  for (const { doc, code, plan, enrolled } of exams) {
    if (plan.name === 'Final Exam' && FINAL_UNMARKED.has(code)) continue; // unmarked demo
    for (const studentId of enrolled) {
      const st = students.find((x) => String(x.id) === String(studentId));
      const pct = clamp01(st.ability + (rnd() - 0.5) * 0.24);
      const score = Math.min(plan.maxMarks, Math.max(0, Math.round(plan.maxMarks * pct)));
      const percentage = round2((score / plan.maxMarks) * 100);
      markRows.push({
        exam: doc._id,
        student: studentId,
        score,
        percentage,
        grade: gradeFor(percentage),
        isPass: percentage >= 40,
      });
    }
  }
  await Mark.insertMany(markRows);

  console.log('Demo dataset seeded:');
  console.log(`  subjects:    ${Object.keys(subjects).length}`);
  console.log(`  teachers:    ${TEACHERS.length}`);
  console.log(`  students:    ${students.length} (${BATCH_2026.length} batch 2026, ${BATCH_2025.length} batch 2025)`);
  console.log(`  enrollments: ${enrollmentRows.length}`);
  console.log(`  exams:       ${exams.length} (incl. locked + 1 pending lock request)`);
  console.log(`  marks:       ${markRows.length}`);
};

const run = async () => {
  await connectDB();
  if (DEMO) await wipe(); // wipe first so the admin the demo creates survives
  await seedAdmin();
  if (DEMO) await seedDemo();
  await mongoose.disconnect();
  console.log('Seed complete.');
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
