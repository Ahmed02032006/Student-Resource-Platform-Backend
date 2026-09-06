import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    courseId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Course',
      required: true,
    },
    type: {
      type:     String,
      enum:     ['pdf', 'video', 'image', 'note'],
      required: true,
    },
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    cloudinaryPublicId: {
      type:     String,
      required: true,
      trim:     true,
    },
    cloudinaryUrl: {
      type:     String,
      required: true,
      trim:     true,
    },
    uploadedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
  },
  { timestamps: true }
);

const Resource = mongoose.model('Resource', resourceSchema);
export default Resource;
