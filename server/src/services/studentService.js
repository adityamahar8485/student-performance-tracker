import mongoose from 'mongoose';
import Mark from '../models/Mark.js';
import User from '../models/User.js';
import Enrollment from '../models/Enrollment.js';
import ApiError from '../utils/ApiError.js';
import { gradeFor } from '../models/Mark.js';
import { getStudentRank } from './rankService.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

// ---------------------------------------------------------------------------
// Student-facing aggregations (per the spec note: aggregation lives in
// service files, never in route handlers / controllers).
// ---------------------------------------------------------------------------

// Per-subject summary for one student:
//   { subjectId, examCount, totalScore, totalMax, percentage }
export const subjectSummaries = (studentId) =>
  Mark.aggregate([
    { $match: { student: oid(studentId) } },
    { $lookup: { from: 'exams', localField: 'exam', foreignField: '_id', as: 'examDoc' } },
    { $unwind: '$examDoc' },
    {
      $group: {
        _id: '$examDoc.subject',
        examCount: { $sum: 1 },
        totalScore: { $sum: '$score' },
        totalMax: { $sum: '$examDoc.maxMarks' },
      },
    },
    {
      $project: {
        examCount: 1,
        totalScore: 1,
        totalMax: 1,
        percentage: {
          $round: [{ $multiply: [{ $divide: ['$totalScore', '$totalMax'] }, 100] }, 2],
        },
      },
    },
  ]);

// Grade distribution across the student's mark entries: { _id: 'A', count: 12 }
export const gradeCounts = (studentId) =>
  Mark.aggregate([
    { $match: { student: oid(studentId) } },
    { $group: { _id: '$grade', count: { $sum: 1 } } },
  ]);

// Score trend across exams for ONE subject, chronological (Recharts-ready)
export const trendForSubject = (studentId, subjectId) =>
  Mark.aggregate([
    { $match: { student: oid(studentId) } },
    { $lookup: { from: 'exams', localField: 'exam', foreignField: '_id', as: 'examDoc' } },
    { $unwind: '$examDoc' },
    { $match: { 'examDoc.subject': oid(subjectId) } },
    { $sort: { 'examDoc.date': 1, 'examDoc.name': 1 } },
    {
      $project: {
        _id: 0,
        examId: '$examDoc._id',
        name: '$examDoc.name',
        date: '$examDoc.date',
        score: 1,
        maxMarks: '$examDoc.maxMarks',
        percentage: {
          $round: [{ $multiply: [{ $divide: ['$score', '$examDoc.maxMarks'] }, 100] }, 2],
        },
      },
    },
  ]);

// Every marked exam of one student, chronological, with its subject id —
// the raw material for the admin/teacher student-profile view
export const examsBySubject = (studentId) =>
  Mark.aggregate([
    { $match: { student: oid(studentId) } },
    { $lookup: { from: 'exams', localField: 'exam', foreignField: '_id', as: 'examDoc' } },
    { $unwind: '$examDoc' },
    { $sort: { 'examDoc.date': 1, 'examDoc.name': 1 } },
    {
      $project: {
        _id: 0,
        subjectId: '$examDoc.subject',
        name: '$examDoc.name',
        date: '$examDoc.date',
        maxMarks: '$examDoc.maxMarks',
        isLocked: '$examDoc.isLocked',
        score: 1,
        percentage: 1,
        grade: 1,
        isPass: 1,
      },
    },
  ]);

// Full profile payload for a student — used by the admin and (for students
// sharing at least one of their subjects) the teacher. Aggregation-only.
export const buildStudentProfile = async (studentId) => {
  const student = await User.findOne({ _id: studentId, role: 'student' }).select(
    'name email batch isActive'
  );
  if (!student) throw new ApiError(404, 'Student not found');

  const [rank, summaries, grades, exams, enrollments] = await Promise.all([
    getStudentRank(studentId),
    subjectSummaries(studentId),
    gradeCounts(studentId),
    examsBySubject(studentId),
    Enrollment.find({ student: studentId }).populate('subject', 'name code totalMarks').lean(),
  ]);

  const bySubject = new Map(summaries.map((s) => [String(s._id), s]));
  const examsOf = new Map();
  for (const e of exams) {
    const key = String(e.subjectId);
    if (!examsOf.has(key)) examsOf.set(key, []);
    examsOf.get(key).push(e);
  }

  const perSubject = enrollments
    .map((en) => en.subject)
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
        exams: examsOf.get(String(subject._id)) ?? [],
      };
    });

  const gradeBreakdown = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const g of grades) {
    if (g._id) gradeBreakdown[g._id] = g.count;
  }

  return {
    student: {
      id: student._id,
      name: student.name,
      email: student.email,
      batch: student.batch,
    },
    cumulativePercentage: rank.cumulativePercentage,
    overallGrade:
      rank.cumulativePercentage === null ? null : gradeFor(rank.cumulativePercentage),
    rank: rank.rank,
    cohortSize: rank.cohortSize,
    totalScore: rank.totalScore,
    totalMax: rank.totalMax,
    gradeBreakdown,
    perSubject,
  };
};
