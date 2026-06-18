import mongoose from 'mongoose';

const splitParticipantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amountOwed: {
    type: Number,
    required: true,
  },
  share: {
    type: Number, // For percentage split (e.g. 50), share count (e.g. 2), or exact value
  },
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than zero'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Food', 'Travel', 'Rent', 'Shopping', 'Entertainment', 'Utilities', 'Healthcare', 'Education', 'Others'],
    default: 'Others',
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  splitAmong: [splitParticipantSchema],
  splitType: {
    type: String,
    enum: ['equal', 'percentage', 'exact', 'shares'],
    required: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
