import mongoose from 'mongoose';
import Mark from '../models/Mark.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

// ---------------------------------------------------------------------------
// Server-side student ranking.
// Spec note (repeated 4x): rank MUST be computed with aggregation - never
// fetch-all-and-sort in the frontend.
//
// Pipeline: join marks -> users (cohort) -> exams, $group cumulative %,
// then $setWindowFields + $rank (standard competition ranking: ties share a
// rank, the next rank skips). MongoDB 5.0+; Atlas M0 runs 8.0.
//
// Documented choice for the undefined "enrolled batch": ranked among students
// sharing the same User.batch value; a student without a batch is ranked
// against everyone who has marks.
// ---------------------------------------------------------------------------
export const getStudentRank = async (studentId) => {
  const student = await User.findById(studentId).select('batch');
  if (!student) throw new ApiError(404, 'Student not found');

  const cohortMatch = student.batch ? { 'studentDoc.batch': student.batch } : {};
  const oid = new mongoose.Types.ObjectId(studentId);

  const [result] = await Mark.aggregate([
    {
      $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: 'studentDoc' },
    },
    { $unwind: '$studentDoc' },
    { $match: cohortMatch },
    { $lookup: { from: 'exams', localField: 'exam', foreignField: '_id', as: 'examDoc' } },
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
    {
      $setWindowFields: {
        // $rank requires exactly ONE sortBy field; ties share the rank
        sortBy: { cumulativePercentage: -1 },
        output: { rank: { $rank: {} } },
      },
    },
    {
      $facet: {
        me: [{ $match: { _id: oid } }, { $project: { _id: 0, rank: 1, cumulativePercentage: 1, totalScore: 1, totalMax: 1 } }],
        cohort: [{ $count: 'size' }],
      },
    },
  ]);

  const me = result?.me?.[0] ?? null;
  return {
    rank: me?.rank ?? null,
    cohortSize: result?.cohort?.[0]?.size ?? 0,
    cumulativePercentage: me?.cumulativePercentage ?? null,
    totalScore: me?.totalScore ?? null,
    totalMax: me?.totalMax ?? null,
  };
};
