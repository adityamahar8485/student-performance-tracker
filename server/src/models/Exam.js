import mongoose from 'mongoose';

// LOCK DESIGN (the most commonly missed feature - modeled from day one):
//   lockRequested (teacher): teacher flags "marks finalised, please lock"
//   isLocked      (admin):   admin flips via PATCH /api/admin/exams/:id/lock
// Marks edits are blocked ONLY by isLocked (lockRequested is just a request signal).
const examSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    name: { type: String, required: [true, 'Exam name is required'], trim: true },
    date: { type: Date, required: [true, 'Exam date is required'] },
    maxMarks: { type: Number, required: true, min: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lockRequested: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

examSchema.index({ subject: 1, date: 1 });

export default mongoose.model('Exam', examSchema);
