import mongoose from 'mongoose';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import Enrollment from '../models/Enrollment.js';
import Exam from '../models/Exam.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { getAnalytics } from '../services/analyticsService.js';
import { buildStudentProfile } from '../services/studentService.js';

// Reject malformed ids with a 400 naming the value, before Mongoose CastError
// turns them into a misleading 404
const assertObjectIds = (ids, label) => {
  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, `Invalid ${label} id: ${id}`);
    }
  }
};

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

// POST /api/admin/subjects  { name, code, totalMarks }
export const createSubject = asyncHandler(async (req, res) => {
  const { name, code, totalMarks = 100 } = req.body;
  if (!name || !code) throw new ApiError(400, 'Subject name and code are required');

  const subject = await Subject.create({ name, code, totalMarks });
  res.status(201).json({ success: true, data: subject });
});

// GET /api/admin/subjects - with assigned teacher and enrolled student count
export const listSubjects = asyncHandler(async (req, res) => {
  const subjects = await Subject.find().populate('teacher', 'name email').lean();

  // Enrolled student counts, one aggregation for all subjects
  const counts = await Enrollment.aggregate([
    { $group: { _id: '$subject', studentCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.studentCount]));

  const data = subjects.map((s) => ({
    ...s,
    studentCount: countMap.get(String(s._id)) ?? 0,
  }));
  res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

// POST /api/admin/teachers  { name, email, password, subject }
export const createTeacher = asyncHandler(async (req, res) => {
  const { name, email, password, subject: subjectId } = req.body;
  if (!name || !email || !password || !subjectId) {
    throw new ApiError(400, 'name, email, password and subject are required');
  }
  if (String(password).length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  assertObjectIds([subjectId], 'subject');
  const subject = await Subject.findById(subjectId);
  if (!subject) throw new ApiError(404, 'Subject not found');

  const teacher = await User.create({ name, email, passwordHash: password, role: 'teacher' });
  subject.teacher = teacher._id;
  await subject.save();

  res.status(201).json({
    success: true,
    data: { teacher, assignedSubject: { id: subject._id, name: subject.name, code: subject.code } },
  });
});

// GET /api/admin/teachers - each with their assigned subjects
export const listTeachers = asyncHandler(async (req, res) => {
  const teachers = await User.find({ role: 'teacher' }).select('name email isActive').lean();
  const subjects = await Subject.find().select('name code teacher').lean();

  const byTeacher = new Map();
  for (const s of subjects) {
    if (!s.teacher) continue;
    const key = String(s.teacher);
    if (!byTeacher.has(key)) byTeacher.set(key, []);
    byTeacher.get(key).push({ id: s._id, name: s.name, code: s.code });
  }

  const data = teachers.map((t) => ({ ...t, subjects: byTeacher.get(String(t._id)) ?? [] }));
  res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

// POST /api/admin/students  { name, email, password, batch, subjects: [id,...] }
export const createStudent = asyncHandler(async (req, res) => {
  const { name, email, password, batch = null, subjects = [] } = req.body;
  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email and password are required');
  }
  if (String(password).length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }
  if (!Array.isArray(subjects)) throw new ApiError(400, 'subjects must be an array of subject ids');
  assertObjectIds(subjects, 'subject');

  const found = subjects.length
    ? await Subject.find({ _id: { $in: subjects } }).select('_id')
    : [];
  if (found.length !== subjects.length) {
    throw new ApiError(400, 'One or more subject ids are invalid');
  }

  const student = await User.create({ name, email, passwordHash: password, role: 'student', batch });

  if (found.length) {
    await Enrollment.insertMany(
      found.map((s) => ({ student: student._id, subject: s._id })),
      { ordered: false }
    );
  }

  res.status(201).json({
    success: true,
    data: { student, enrolledSubjects: found.length },
  });
});

// GET /api/admin/students - with enrolled subjects
export const listStudents = asyncHandler(async (req, res) => {
  const students = await User.find({ role: 'student' }).select('name email batch isActive').lean();
  const enrollments = await Enrollment.find().populate('subject', 'name code').lean();

  const byStudent = new Map();
  for (const e of enrollments) {
    const key = String(e.student);
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push(e.subject);
  }

  const data = students.map((s) => ({ ...s, subjects: byStudent.get(String(s._id)) ?? [] }));
  res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// Exams + lock
// ---------------------------------------------------------------------------

// GET /api/admin/exams - lock dashboard (subject + owning teacher included)
export const listExams = asyncHandler(async (req, res) => {
  const exams = await Exam.find()
    .populate({
      path: 'subject',
      select: 'name code',
      populate: { path: 'teacher', select: 'name' },
    })
    .populate('createdBy', 'name')
    .sort({ date: -1 })
    .lean();
  res.json({ success: true, data: exams });
});

// PATCH /api/admin/exams/:id/lock  { isLocked = true }
// Admin action - this is the ONLY path that flips isLocked. Locked exams
// reject every marks write (see teacher controller guards).
export const lockExam = asyncHandler(async (req, res) => {
  const { isLocked = true } = req.body;
  const exam = await Exam.findById(req.params.id);
  if (!exam) throw new ApiError(404, 'Exam not found');

  exam.isLocked = Boolean(isLocked);
  exam.lockedAt = exam.isLocked ? new Date() : null;
  await exam.save();

  res.json({
    success: true,
    data: { id: exam._id, name: exam.name, isLocked: exam.isLocked, lockedAt: exam.lockedAt },
  });
});

// GET /api/admin/students/:id/performance — any student's full profile
export const studentPerformance = asyncHandler(async (req, res) => {
  const data = await buildStudentProfile(req.params.id);
  res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

// GET /api/admin/analytics - all pipelines in one payload
export const analytics = asyncHandler(async (req, res) => {
  const data = await getAnalytics();
  res.json({ success: true, data });
});
