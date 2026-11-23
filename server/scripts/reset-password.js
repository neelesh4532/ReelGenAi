import readline from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

await connectDB();

try {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    const users = await User.find().select('email').sort({ createdAt: 1 });
    console.log('Accounts:');
    users.forEach((u) => console.log(`- ${u.email}`));
    console.log('\nRun again with an email:\nnode --env-file=.env scripts/reset-password.js your@email.com');
  } else {
    const user = await User.findOne({ email }).select('_id');
    if (!user) throw new Error('No account with that email');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const password = await rl.question('New password (8 to 72 characters, it will be visible): ');
    rl.close();
    if (password.length < 8 || password.length > 72) {
      throw new Error('The password must be 8 to 72 characters');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await User.updateOne({ _id: user._id }, { $set: { passwordHash } });
    console.log(`Password updated for ${email}`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}