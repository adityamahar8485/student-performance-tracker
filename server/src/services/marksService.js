import Mark, { gradeFor } from '../models/Mark.js';
import Enrollment from '../models/Enrollment.js';
import ApiError from '../utils/ApiError.js';

const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Bulk marks upsert - POST /api/teacher/exams/:id/marks
// Guards are enforced by the caller (teacher ownership + isLocked); this
// service handles validation, the 40% pass rule and denormalised grade
// fields (bulkWrite bypasses the pre-save hook, so we recompute here).
// ---------------------------------------------------------------------------
export const bulkUpsertMarks = async (exam, marks) => {
  if (!Array.isArray(marks) || marks.length === 0) {
    throw new ApiError(400, 'marks must be a non-empty array of { student, score }');
  }

  // Dedupe by student (last entry wins)
  const byStudent = new Map();
  for (const m of marks) {
    const score = Number(m?.score);
    if (!m?.student || !Number.isFinite(score)) {
      throw new ApiError(400, 'Each mark needs a student id and a numeric score');
    }
    if (score < 0) throw new ApiError(400, 'Score cannot be negative');
    if (score > exam.maxMarks) {
      throw new ApiError(400, `Score ${score} exceeds the exam max of ${exam.maxMarks}`);
    }
    byStudent.set(String(m.student), score);
  }

  // Every marked student must be enrolled in the exam's subject
  const studentIds = [...byStudent.keys()];
  const enrollments = await Enrollment.find({
    subject: exam.subject._id,
    student: { $in: studentIds },
  }).select('student');
  const enrolled = new Set(enrollments.map((e) => String(e.student)));
  const notEnrolled = studentIds.filter((id) => !enrolled.has(id));
  if (notEnrolled.length > 0) {
    throw new ApiError(400, `Students not enrolled in this subject: ${notEnrolled.join(', ')}`);
  }

  const ops = studentIds.map((studentId) => {
    const score = byStudent.get(studentId);
    const percentage = round2((score / exam.maxMarks) * 100);
    return {
      updateOne: {
        filter: { exam: exam._id, student: studentId },
        update: {
          $set: {
            score,
            percentage,
            grade: gradeFor(percentage),
            isPass: percentage >= 40,
          },
        },
        upsert: true,
      },
    };
  });

  const result = await Mark.bulkWrite(ops);
  return {
    processed: studentIds.length,
    created: result.upsertedCount,
    updated: result.modifiedCount,
  };
};
