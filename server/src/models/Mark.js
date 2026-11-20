import mongoose from 'mongoose';

// Assignment grade scale - pass = 40% of max marks
//   A >= 90 · B 75-89 · C 60-74 · D 40-59 · F < 40
export function gradeFor(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 75) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}

const markSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true, min: 0 },
    // Denormalised computed fields (set on save, recomputed on edit)
    percentage: { type: Number, min: 0, max: 100 },
    grade: { type: String, enum: ['A', 'B', 'C', 'D', 'F'] },
    isPass: { type: Boolean },
  },
  { timestamps: true }
);

// One mark entry per (exam, student) - bulk marks endpoints upsert against this
markSchema.index({ exam: 1, student: 1 }, { unique: true });
markSchema.index({ student: 1 }); // fast rank/performance pipelines

// Pre-save hook: derives percentage/grade/isPass from the exam's maxMarks.
// NOTE: update paths that bypass save() (bulkWrite/findOneAndUpdate) must
// recompute these fields explicitly in the service layer.
markSchema.pre('save', async function (next) {
  if (!this.isModified('score')) return next();
  try {
    const exam = await mongoose.model('Exam').findById(this.exam).select('maxMarks');
    if (!exam) return next(new Error('Referenced exam does not exist'));
    this.percentage = Math.round((this.score / exam.maxMarks) * 10000) / 100;
    this.grade = gradeFor(this.percentage);
    this.isPass = this.percentage >= 40;
    next();
  } catch (err) {
    next(err);
  }
});

markSchema.statics.gradeFor = gradeFor;

export default mongoose.model('Mark', markSchema);
