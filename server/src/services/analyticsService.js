import Mark from '../models/Mark.js';
import Subject from '../models/Subject.js';
import Exam from '../models/Exam.js';
import User from '../models/User.js';

// ---------------------------------------------------------------------------
// Admin analytics - ALL computed with MongoDB aggregation pipelines
// ($group / $sort / $lookup / $project / $cond / $sum / $divide).
// No JS number-crunching loops over marks anywhere in this file.
//
// Documented interpretation choices (spec is ambiguous):
//   * "Average score per subject" = CUMULATIVE percentage
//     (Σ score / Σ exam maxMarks) - NOT the mean of per-exam percentages,
//     which is a different number when exams have different max marks.
//   * Pass/fail counted PER MARK ENTRY against the 40%-of-exam-max rule,
//     recomputed inside the pipeline from score vs maxMarks.
// ---------------------------------------------------------------------------

// Mark -> Exam join used by every pipeline
const joinExam = {
  $lookup: { from: 'exams', localField: 'exam', foreignField: '_id', as: 'examDoc' },
};
const joinSubject = {
  $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subjectDoc' },
};
const joinUser = {
  $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'studentDoc' },
};

// Average (cumulative) percentage per subject, highest first.
// Subjects with no marks recorded are absent (division needs Σ maxMarks > 0).
export const avgPerSubject = () =>
  Mark.aggregate([
    joinExam,
    { $unwind: '$examDoc' },
    {
      $group: {
        _id: '$examDoc.subject',
        totalScore: { $sum: '$score' },
        totalMax: { $sum: '$examDoc.maxMarks' },
        entries: { $sum: 1 },
      },
    },
    {
      $project: {
        totalScore: 1,
        totalMax: 1,
        entries: 1,
        avgPercentage: {
          $round: [{ $multiply: [{ $divide: ['$totalScore', '$totalMax'] }, 100] }, 2],
        },
      },
    },
    joinSubject,
    { $unwind: '$subjectDoc' },
    {
      $project: {
        _id: 0, // safe to drop only AFTER the subject $lookup joined on _id
        totalScore: 1,
        totalMax: 1,
        entries: 1,
        avgPercentage: 1,
        subject: { id: '$_id', name: '$subjectDoc.name', code: '$subjectDoc.code' },
      },
    },
    { $sort: { avgPercentage: -1 } },
  ]);

// Pass / fail counts per subject - pass = score >= 40% of that exam's max marks.
// The threshold is recomputed inside the pipeline from raw values.
export const passFailPerSubject = () =>
  Mark.aggregate([
    joinExam,
    { $unwind: '$examDoc' },
    {
      $group: {
        _id: '$examDoc.subject',
        totalEntries: { $sum: 1 },
        passCount: {
          $sum: {
            $cond: [{ $gte: ['$score', { $multiply: ['$examDoc.maxMarks', 0.4] }] }, 1, 0],
          },
        },
        failCount: {
          $sum: {
            $cond: [{ $lt: ['$score', { $multiply: ['$examDoc.maxMarks', 0.4] }] }, 1, 0],
          },
        },
      },
    },
    joinSubject,
    { $unwind: '$subjectDoc' },
    {
      $project: {
        _id: 0,
        totalEntries: 1,
        passCount: 1,
        failCount: 1,
        subject: { id: '$_id', name: '$subjectDoc.name', code: '$subjectDoc.code' },
      },
    },
    { $sort: { 'subject.name': 1 } },
  ]);

// Top N performers overall by cumulative percentage across all their marks
export const topPerformers = (limit = 3) =>
  Mark.aggregate([
    joinExam,
    { $unwind: '$examDoc' },
    {
      $group: {
        _id: '$student',
        totalScore: { $sum: '$score' },
        totalMax: { $sum: '$examDoc.maxMarks' },
      },
    },
    {
      $project: {
        totalScore: 1,
        totalMax: 1,
        cumulativePercentage: {
          $round: [{ $multiply: [{ $divide: ['$totalScore', '$totalMax'] }, 100] }, 2],
        },
      },
    },
    { $sort: { cumulativePercentage: -1, totalScore: -1 } },
    { $limit: limit },
    joinUser,
    { $unwind: '$studentDoc' },
    {
      $project: {
        _id: 0,
        totalScore: 1,
        totalMax: 1,
        cumulativePercentage: 1,
        student: { id: '$_id', name: '$studentDoc.name', email: '$studentDoc.email' },
      },
    },
  ]);

// "Needs attention": the subject with the lowest cumulative average.
// Reuses the avgPerSubject pipeline (already sorted desc) - only subjects
// that actually have marks are eligible.
export const lowestAvgSubject = async () => {
  const rows = await avgPerSubject();
  if (rows.length === 0) return null;
  return rows[rows.length - 1];
};

// Institution mean percentage per exam, chronological - feeds the admin
// board's pinned trend sheet (Σscore / ΣmaxMarks per exam, in-pipeline).
export const examTrend = () =>
  Mark.aggregate([
    joinExam,
    { $unwind: '$examDoc' },
    {
      $group: {
        _id: '$exam',
        name: { $first: '$examDoc.name' },
        date: { $first: '$examDoc.date' },
        totalScore: { $sum: '$score' },
        totalMax: { $sum: '$examDoc.maxMarks' },
        entries: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        name: 1,
        date: 1,
        entries: 1,
        meanPercentage: {
          $round: [{ $multiply: [{ $divide: ['$totalScore', '$totalMax'] }, 100] }, 2],
        },
      },
    },
    { $sort: { date: 1 } },
  ]);

// GET /api/admin/analytics - one response with everything
export const getAnalytics = async () => {
  const [avgRows, passFailRows, top3, lowest, trend, subjects, teachers, students, exams, marks] =
    await Promise.all([
      avgPerSubject(),
      passFailPerSubject(),
      topPerformers(3),
      lowestAvgSubject(),
      examTrend(),
      Subject.countDocuments(),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      Exam.countDocuments(),
      Mark.countDocuments(),
    ]);

  return {
    avgPerSubject: avgRows,
    passFailPerSubject: passFailRows,
    topPerformers: top3,
    lowestAvgSubject: lowest,
    examTrend: trend,
    totals: { subjects, teachers, students, exams, marks },
  };
};

import mongoose from 'mongoose';
import Enrollment from '../models/Enrollment.js';
import ApiError from '../utils/ApiError.js';
const toOid = (id) => new mongoose.Types.ObjectId(id);

// ---------------------------------------------------------------------------
// Teacher profile (admin view) — everything scoped to the subjects the
// teacher owns, all via aggregation. Grades/pass rule recomputed in-pipeline
// exactly as in the institution-wide analytics.
// ---------------------------------------------------------------------------
export const buildTeacherProfile = async (teacherId) => {
  const teacher = await User.findOne({ _id: teacherId, role: 'teacher' }).select(
    'name email isActive'
  );
  if (!teacher) throw new ApiError(404, 'Teacher not found');

  const subjects = await Subject.find({ teacher: teacherId }).lean();
  const subjectIds = subjects.map((s) => s._id);

  const [enrolled, avgRows, passFailRows, exams, marksPerExam] =
    await Promise.all([
      subjectIds.length
        ? Enrollment.aggregate([
            { $match: { subject: { $in: subjectIds } } },
            { $group: { _id: '$subject', studentCount: { $sum: 1 } } },
          ])
        : [],
      subjectIds.length
        ? Mark.aggregate([
            joinExam,
            { $unwind: '$examDoc' },
            { $match: { 'examDoc.subject': { $in: subjectIds } } },
            {
              $group: {
                _id: '$examDoc.subject',
                totalScore: { $sum: '$score' },
                totalMax: { $sum: '$examDoc.maxMarks' },
                entries: { $sum: 1 },
              },
            },
            {
              $project: {
                entries: 1,
                totalScore: 1,
                totalMax: 1,
                avgPercentage: {
                  $round: [{ $multiply: [{ $divide: ['$totalScore', '$totalMax'] }, 100] }, 2],
                },
              },
            },
          ])
        : [],
      subjectIds.length
        ? Mark.aggregate([
            joinExam,
            { $unwind: '$examDoc' },
            { $match: { 'examDoc.subject': { $in: subjectIds } } },
            {
              $group: {
                _id: '$examDoc.subject',
                passCount: {
                  $sum: { $cond: [{ $gte: ['$score', { $multiply: ['$examDoc.maxMarks', 0.4] }] }, 1, 0] },
                },
                failCount: {
                  $sum: { $cond: [{ $lt: ['$score', { $multiply: ['$examDoc.maxMarks', 0.4] }] }, 1, 0] },
                },
              },
            },
          ])
        : [],
      Exam.find({ subject: { $in: subjectIds } }).sort({ date: -1 }).lean(),
      Mark.aggregate([
        { $group: { _id: '$exam', marksEntered: { $sum: 1 } } },
      ]),
    ]);

  const enrolledMap = new Map(enrolled.map((e) => [String(e._id), e.studentCount]));
  const avgMap = new Map(avgRows.map((a) => [String(a._id), a]));
  const pfMap = new Map(passFailRows.map((p) => [String(p._id), p]));
  const marksMap = new Map(marksPerExam.map((m) => [String(m._id), m.marksEntered]));
  const subjectById = new Map(subjects.map((s) => [String(s._id), s]));
  const examCountBySubject = new Map();
  for (const e of exams) {
    const k = String(e.subject);
    examCountBySubject.set(k, (examCountBySubject.get(k) ?? 0) + 1);
  }

  const subjectCards = subjects.map((s) => {
    const a = avgMap.get(String(s._id));
    const p = pfMap.get(String(s._id));
    return {
      subject: { id: s._id, name: s.name, code: s.code, totalMarks: s.totalMarks },
      studentCount: enrolledMap.get(String(s._id)) ?? 0,
      examCount: examCountBySubject.get(String(s._id)) ?? 0,
      entries: a?.entries ?? 0,
      avgPercentage: a?.avgPercentage ?? null,
      passCount: p?.passCount ?? 0,
      failCount: p?.failCount ?? 0,
    };
  });

  return {
    teacher: { id: teacher._id, name: teacher.name, email: teacher.email, isActive: teacher.isActive },
    subjects: subjectCards,
    exams: exams.map((e) => ({
      id: e._id,
      name: e.name,
      subject: subjectById.get(String(e.subject)) ?? null,
      date: e.date,
      maxMarks: e.maxMarks,
      isLocked: e.isLocked,
      lockRequested: e.lockRequested,
      marksEntered: marksMap.get(String(e._id)) ?? 0,
    })),
    // Marks counted only within THIS teacher's subjects (Σ entries from the
    // scoped pipelines) — never the institution-wide total
    totals: {
      subjects: subjects.length,
      exams: exams.length,
      marks: avgRows.reduce((sum, a) => sum + a.entries, 0),
    },
  };
};
