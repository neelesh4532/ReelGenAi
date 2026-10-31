import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    // Becomes required on Day 6 when auth is added
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    audience: { type: String, trim: true, maxlength: 100 },
    tone: { type: String, trim: true, maxlength: 50 },
    targetSeconds: { type: Number, default: 30 },
    script: { type: mongoose.Schema.Types.Mixed },
    status: {
      videoPath: { type: String },
      videoDurationSec: { type: Number },
      renderedAt: { type: Date },
      renderError: { type: String },
      credits: { type: mongoose.Schema.Types.Mixed },  
      type: String,
      enum: ['draft', 'scripted', 'rendering', 'rendered', 'published', 'failed'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

export const Project = mongoose.model('Project', projectSchema);