import Subject from '../models/Subject.js';
import Exam from '../models/Exam.js';
import Mark from '../models/Mark.js';
import Enrollment from '../models/Enrollment.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { bulkUpsertMarks } from '../services/marksService.js';
import { buildStudentProfile } from '../services/studentService.js';

// Guard: exam must exist, belong to a subject THIS teacher owns, and be unlocked
const loadOwnUnlockedExam = async (examId, teacherId) => {
  const exam = await Exam.findById(examId).populate('subject');
  if (!exam) throw new ApiError(404, 'Exam not found');
  if (!exam.subject || String(exam.subject.teacher) !== String(teacherId)) {
    throw new ApiError(403, 'You can only manage exams for your own subjects');
  }
  return exam;
};

// ---------------------------------------------------------------------------
// GET /api/teacher/subjects - assigned subjects + enrolled student count
// ---------------------------------------------------------------------------
export const mySubjects = asyncHandler(async (req, res) => {
  const subjects = await Subject.find({ teacher: req.user.id })
    .populate('teacher', 'name email')
    .lean();

  const counts = await Enrollment.aggregate([
    { $match: { subject: { $in: subjects.map((s) => s._id) } } },
    { $group: { _id: '$subject', studentCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.studentCount]));

  const data = subjects.map((s) => ({ ...s, studentCount: countMap.get(String(s._id)) ?? 0 }));
  res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// POST /api/teacher/exams  { subject, name, date, maxMarks }
// ---------------------------------------------------------------------------
export const createExam = asyncHandler(async (req, res) => {
  const { subject: subjectId, name, date, maxMarks } = req.body;
  if (!subjectId || !name || !date || !maxMarks) {
    throw new ApiError(400, 'subject, name, date and maxMarks are required');
  }

  const subject = await Subject.findById(subjectId);
  if (!subject) throw new ApiError(404, 'Subject not found');
  if (String(subject.teacher) !== String(req.user.id)) {
    throw new ApiError(403, 'You can only create exams for your own subjects');
  }

  const exam = await Exam.create({
    subject: subjectId,
    name,
    date,
    maxMarks,
    createdBy: req.user.id,
  });
  res.status(201).json({ success: true, data: exam });
});

// ---------------------------------------------------------------------------
// GET /api/teacher/exams - exams under the teacher's subjects
// ---------------------------------------------------------------------------
export const myExams = asyncHandler(async (req, res) => {
  const subjects = await Subject.find({ teacher: req.user.id }).select('_id');
  const exams = await Exam.find({ subject: { $in: subjects.map((s) => s._id) } })
    .populate('subject', 'name code')
    .sort({ date: -1 })
    .lean();
  res.json({ success: true, data: exams });
});

// ---------------------------------------------------------------------------
// POST /api/teacher/exams/:id/marks  { marks: [{ student, score }] }
// Bulk entry for enrolled students. Blocked once the exam is locked.
// ---------------------------------------------------------------------------
export const enterMarks = asyncHandler(async (req, res) => {
  const exam = await loadOwnUnlockedExam(req.params.id, req.user.id);
  if (exam.isLocked) {
    throw new ApiError(403, `Exam '${exam.name}' is locked - marks cannot be entered`);
  }

  const result = await bulkUpsertMarks(exam, req.body.marks);
  res.json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// PATCH /api/teacher/marks/:id  { score }
// Single-mark correction. Blocked once the exam is locked.
// ---------------------------------------------------------------------------
export const editMark = asyncHandler(async (req, res) => {
  const { score } = req.body;
  if (score === undefined) throw new ApiError(400, 'score is required');
  const numScore = Number(score);
  if (!Number.isFinite(numScore) || numScore < 0) {
    throw new ApiError(400, 'Score must be a non-negative number');
  }

  const mark = await Mark.findById(req.params.id).populate({
    path: 'exam',
    populate: { path: 'subject' },
  });
  if (!mark) throw new ApiError(404, 'Mark entry not found');
  if (!mark.exam.subject || String(mark.exam.subject.teacher) !== String(req.user.id)) {
    throw new ApiError(403, 'You can only edit marks for your own subjects');
  }
  if (mark.exam.isLocked) {
    throw new ApiError(403, `Exam '${mark.exam.name}' is locked - marks cannot be edited`);
  }
  if (numScore > mark.exam.maxMarks) {
    throw new ApiError(400, `Score ${numScore} exceeds the exam max of ${mark.exam.maxMarks}`);
  }

  mark.score = numScore;
  await mark.save(); // pre-save hook recomputes percentage / grade / isPass

  res.json({ success: true, data: mark });
});

// ---------------------------------------------------------------------------
// GET /api/teacher/exams/:id/results - marks table for one exam
// Includes enrolled students without a mark yet (score: null).
// ---------------------------------------------------------------------------
export const examResults = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id).populate('subject');
  if (!exam) throw new ApiError(404, 'Exam not found');
  if (!exam.subject || String(exam.subject.teacher) !== String(req.user.id)) {
    throw new ApiError(403, 'You can only view results for your own subjects');
  }

  const enrolled = await Enrollment.find({ subject: exam.subject._id })
    .populate('student', 'name email')
    .lean();
  const marks = await Mark.find({ exam: exam._id }).lean();
  const markByStudent = new Map(marks.map((m) => [String(m.student), m]));

  const results = enrolled
    .map((e) => {
      const m = markByStudent.get(String(e.student._id));
      return {
        markId: m?._id ?? null, // needed for PATCH /api/teacher/marks/:id
        student: e.student,
        score: m?.score ?? null,
        percentage: m?.percentage ?? null,
        grade: m?.grade ?? null,
        isPass: m?.isPass ?? null,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)); // display order only

  res.json({ success: true, data: { exam, results } });
});

// ---------------------------------------------------------------------------
// GET /api/teacher/students/:id/performance — only for students sharing at
// least one of THIS teacher's subjects (same ownership rule as every route)
// ---------------------------------------------------------------------------
export const studentPerformance = asyncHandler(async (req, res) => {
  const mySubjects = await Subject.find({ teacher: req.user.id }).select('_id');
  const shared = await Enrollment.exists({
    student: req.params.id,
    subject: { $in: mySubjects.map((s) => s._id) },
  });
  if (!shared) throw new ApiError(403, 'This student is not enrolled in any of your subjects');

  const data = await buildStudentProfile(req.params.id);
  res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// PATCH /api/teacher/exams/:id/request-lock
// Teacher flags marks as finalised; admin then locks via the admin endpoint.
// Does NOT block edits by itself - only isLocked (set by admin) does.
// ---------------------------------------------------------------------------
export const requestLock = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id).populate('subject');
  if (!exam) throw new ApiError(404, 'Exam not found');
  if (!exam.subject || String(exam.subject.teacher) !== String(req.user.id)) {
    throw new ApiError(403, 'You can only request locks for your own exams');
  }
  if (exam.isLocked) throw new ApiError(400, 'Exam is already locked');

  exam.lockRequested = true;
  await exam.save();

  res.json({
    success: true,
    data: { id: exam._id, name: exam.name, lockRequested: exam.lockRequested },
  });
});
