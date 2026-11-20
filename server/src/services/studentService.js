import mongoose from 'mongoose';
import Mark from '../models/Mark.js';

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
