// Bcrypt proof for the seeded admin — run after `npm run seed:demo`.
// Prints the stored hash (proving it is not plaintext) and verifies compare().
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import bcrypt from 'bcryptjs';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const admin = await User.findOne({ email: 'adityamahar8485@gmail.com' }).select('+passwordHash');
  console.log('stored hash:', admin.passwordHash.slice(0, 29) + '…');
  console.log('is bcrypt hash:', /^\$2[aby]\$/.test(admin.passwordHash));
  console.log('not plaintext:', admin.passwordHash !== 'Admin@2026');
  console.log('compare(Admin@2026) =', await bcrypt.compare('Admin@2026', admin.passwordHash));
  console.log('compare(wrong)     =', await bcrypt.compare('wrong', admin.passwordHash));
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => { console.error(e.message); process.exit(1); });
