import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    courseId: {
      type:     String,
      required: true,
      trim:     true,
    },
    courseCode: {
      type:     String,
      required: true,
      trim:     true,
    },
    courseName: {
      type:     String,
      required: true,
      trim:     true,
    },
    semesterId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Semester',
      required: true,
      index:    true, // Index: fast lookup of all courses in a given semester
    },
    createdBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
  },
  { timestamps: true }
);

const Course = mongoose.model('Course', courseSchema);
export default Course;
