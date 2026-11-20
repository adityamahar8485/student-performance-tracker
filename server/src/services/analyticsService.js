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
