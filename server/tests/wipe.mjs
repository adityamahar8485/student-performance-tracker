// Wipes all app collections (users, subjects, enrollments, exams, marks).
// Run before `npm run seed` + `python tests/e2e.py` for a clean E2E pass.
import 'dotenv/config';
import mongoose from 'mongoose';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  for (const c of ['users', 'subjects', 'enrollments', 'exams', 'marks']) {
    const r = await mongoose.connection.db.collection(c).deleteMany({});
    console.log(c, 'deleted', r.deletedCount);
  }
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => { console.error(e.message); process.exit(1); });
