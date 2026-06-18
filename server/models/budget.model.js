import mongoose from 'mongoose';

const categoryLimitSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['Food', 'Travel', 'Rent', 'Shopping', 'Entertainment', 'Utilities', 'Healthcare', 'Education', 'Others'],
    required: true,
  },
  limit: {
    type: Number,
    required: true,
    min: [0, 'Limit cannot be negative'],
  },
}, { _id: false });

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  month: {
    type: String, // Format: YYYY-MM
    required: [true, 'Month is required (YYYY-MM)'],
  },
  monthlyLimit: {
    type: Number,
    required: [true, 'Monthly budget limit is required'],
    min: [0, 'Monthly limit cannot be negative'],
  },
  categoryLimits: [categoryLimitSchema],
}, { timestamps: true });

// Ensure one budget record per user per month
budgetSchema.index({ user: 1, month: 1 }, { unique: true });

const Budget = mongoose.model('Budget', budgetSchema);
export default Budget;
