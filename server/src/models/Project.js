import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    audience: { type: String, trim: true, maxlength: 100 },
    tone: { type: String, trim: true, maxlength: 50 },
    targetSeconds: { type: Number, default: 30 },
    script: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['draft', 'scripted', 'queued', 'rendering', 'rendered', 'published', 'failed'],
      default: 'draft',
    },
    videoPath: { type: String },
    videoDurationSec: { type: Number },
    renderedAt: { type: Date },
    renderError: { type: String },
    credits: { type: mongoose.Schema.Types.Mixed },
    storageProvider: { type: String },
    videoUrl: { type: String },
    videoPublicId: { type: String },
    videoBytes: { type: Number },
  },
  { timestamps: true }
);

export const Project = mongoose.model('Project', projectSchema);