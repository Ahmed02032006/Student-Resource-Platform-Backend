import mongoose from 'mongoose';

const assessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ['quiz', 'exam', 'assignment', 'presentation', 'other'],
      default: 'other',
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Index for fast upcoming queries
assessmentSchema.index({ scheduledAt: 1 });

const Assessment = mongoose.model('Assessment', assessmentSchema);
export default Assessment;