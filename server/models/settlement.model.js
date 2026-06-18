import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  payerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than zero'],
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'completed',
  },
  isOptimized: {
    type: Boolean,
    default: false,
  },
  confirmedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }], 
  completedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Settlement = mongoose.model('Settlement', settlementSchema);
export default Settlement;
