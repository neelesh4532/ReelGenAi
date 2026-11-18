import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    igUserId: { type: String, required: true },
    username: { type: String, required: true },
    accessTokenEnc: { type: String, required: true, select: false }, // never loaded unless asked for
    tokenIssuedAt: { type: Date, required: true },
    tokenExpiresAt: { type: Date }, // empty when the token never expires
  },
  { timestamps: true }
);

export const InstagramAccount = mongoose.model('InstagramAccount', schema);