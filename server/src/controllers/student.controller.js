import Enrollment from '../models/Enrollment.js';
import Subject from '../models/Subject.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { gradeFor } from '../models/Mark.js';
import { subjectSummaries, gradeCounts, trendForSubject } from '../services/studentService.js';
import { getStudentRank } from '../services/rankService.js';

const EMPTY_GRADES = { A: 0, B: 0, C: 0, D: 0, F: 0 };

// ---------------------------------------------------------------------------
// GET /api/student/subjects - enrolled subjects with summary card data
// ---------------------------------------------------------------------------
export const mySubjects = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user.id })
    .populate('subject', 'name code totalMarks')
    .lean();
  const subjects = enrollments.map((e) => e.subject).filter(Boolean);

  const summaries = await subjectSummaries(req.user.id);
  const bySubject = new Map(summaries.map((s) => [String(s._id), s]));

  const data = subjects.map((subject) => {
    const s = bySubject.get(String(subject._id));
    const percentage = s?.percentage ?? null;
    return {
      subject,
      examCount: s?.examCount ?? 0,
      totalScore: s?.totalScore ?? 0,
      totalMax: s?.totalMax ?? 0,
      percentage,
      grade: percentage === null ? null : gradeFor(percentage),
    };
  });

  res.json({ success: true, data });
});

// ---------------------------------------------------------------------------
// GET /api/student/performance - cumulative %, batch rank, grade breakdown
// ---------------------------------------------------------------------------
export const performance = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  const [rank, summaries, grades, enrollments] = await Promise.all([
    getStudentRank(studentId),
    subjectSummaries(studentId),
    gradeCounts(studentId),
    Enrollment.find({ student: studentId })
      .populate('subject', 'name code')
      .lean(),
  ]);

  const bySubject = new Map(summaries.map((s) => [String(s._id), s]));
  const perSubject = enrollments
    .map((e) => e.subject)
    .filter(Boolean)
    .map((subject) => {
      const s = bySubject.get(String(subject._id));
      const percentage = s?.percentage ?? null;
      return {
        subject,
        examCount: s?.examCount ?? 0,
        totalScore: s?.totalScore ?? 0,
        totalMax: s?.totalMax ?? 0,
        percentage,
        grade: percentage === null ? null : gradeFor(percentage),
      };
    });

  const gradeBreakdown = { ...EMPTY_GRADES };
  for (const g of grades) {
    if (g._id) gradeBreakdown[g._id] = g.count;
  }

  const cumulativePercentage = rank.cumulativePercentage;
  res.json({
    success: true,
    data: {
      cumulativePercentage,
      overallGrade: cumulativePercentage === null ? null : gradeFor(cumulativePercentage),
      rank: rank.rank,
      cohortSize: rank.cohortSize,
      totalScore: rank.totalScore,
      totalMax: rank.totalMax,
      batch: req.user.batch,
      gradeBreakdown,
      perSubject,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/student/subjects/:id/trend - score trend across exams (chart data)
// ---------------------------------------------------------------------------
export const subjectTrend = asyncHandler(async (req, res) => {
  const subjectId = req.params.id;

  const subject = await Subject.findById(subjectId).select('name code totalMarks');
  if (!subject) throw new ApiError(404, 'Subject not found');

  const enrolled = await Enrollment.exists({ student: req.user.id, subject: subjectId });
  if (!enrolled) throw new ApiError(403, 'You are not enrolled in this subject');

  const trend = await trendForSubject(req.user.id, subjectId);
  res.json({ success: true, data: { subject, trend } });
});
