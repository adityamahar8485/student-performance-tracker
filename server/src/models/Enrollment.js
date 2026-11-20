import mongoose from 'mongoose';

// Join collection: one student enrolled in one subject.
// Enables clean $lookup from both directions (marks per student, class lists per subject).
const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, subject: 1 }, { unique: true });
enrollmentSchema.index({ subject: 1 }); // fast class-list lookups + $lookup

export default mongoose.model('Enrollment', enrollmentSchema);
