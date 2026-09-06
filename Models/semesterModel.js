import mongoose from 'mongoose';

const semesterSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    isActive: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Semester = mongoose.model('Semester', semesterSchema);
export default Semester;
