import Expense from '../models/expense.model.js';
import Group from '../models/group.model.js';
import User from '../models/user.model.js';
import Settlement from '../models/settlement.model.js';
import { predictCategory } from '../utils/categoryPredictor.js';
import { createNotification } from '../services/notification.service.js';

// Helper to calculate splits
const calculateSplits = (amount, splitType, splitAmong) => {
  if (!splitAmong || splitAmong.length === 0) {
    throw new Error('splitAmong cannot be empty');
  }

  let calculatedSplits = [];
  
  if (splitType === 'equal') {
    const shareAmount = Math.round((amount / splitAmong.length) * 100) / 100;
    let sum = 0;
    calculatedSplits = splitAmong.map((item, idx) => {
      let itemAmt = shareAmount;
      if (idx === splitAmong.length - 1) {
        itemAmt = Math.round((amount - sum) * 100) / 100;
      }
      sum += itemAmt;
      return {
        user: item.user,
        amountOwed: itemAmt,
        share: 1
      };
    });
  } else if (splitType === 'percentage') {
    const sumPct = splitAmong.reduce((acc, item) => acc + (Number(item.share) || 0), 0);
    if (Math.abs(sumPct - 100) > 0.1) {
      throw new Error(`Percentages must sum to 100%. Currently they sum to ${sumPct}%`);
    }
    let sum = 0;
    calculatedSplits = splitAmong.map((item, idx) => {
      const pct = Number(item.share) || 0;
      let itemAmt = Math.round((amount * (pct / 100)) * 100) / 100;
      if (idx === splitAmong.length - 1) {
        itemAmt = Math.round((amount - sum) * 100) / 100;
      }
      sum += itemAmt;
      return {
        user: item.user,
        amountOwed: itemAmt,
        share: pct
      };
    });
  } else if (splitType === 'exact') {
    const sumExact = splitAmong.reduce((acc, item) => acc + (Number(item.share) || 0), 0);
    if (Math.abs(sumExact - amount) > 0.5) {
      throw new Error(`Exact amounts must sum to the total expense amount (₹${amount}). Currently they sum to ₹${sumExact}`);
    }
    calculatedSplits = splitAmong.map((item) => ({
      user: item.user,
      amountOwed: Number(item.share) || 0,
      share: Number(item.share) || 0
    }));
  } else if (splitType === 'shares') {
    const totalShares = splitAmong.reduce((acc, item) => acc + (Number(item.share) || 0), 0);
    if (totalShares <= 0) {
      throw new Error('Total shares must be greater than zero');
    }
    let sum = 0;
    calculatedSplits = splitAmong.map((item, idx) => {
      const shares = Number(item.share) || 0;
      let itemAmt = Math.round((amount * (shares / totalShares)) * 100) / 100;
      if (idx === splitAmong.length - 1) {
        itemAmt = Math.round((amount - sum) * 100) / 100;
      }
      sum += itemAmt;
      return {
        user: item.user,
        amountOwed: itemAmt,
        share: shares
      };
    });
  } else {
    throw new Error('Invalid split type. Must be equal, percentage, exact, or shares.');
  }

  return calculatedSplits;
};

/**
 * @desc    Add a new expense
 * @route   POST /api/expenses
 * @access  Private
 */
export const addExpense = async (req, res, next) => {
  const { amount, description, category, splitType, splitAmong, groupId, date } = req.body;

  try {
    if (!amount || !description || !splitType || !groupId) {
      res.statusCode = 400;
      throw new Error('Please enter all required fields: amount, description, splitType, groupId');
    }

    const group = await Group.findById(groupId);
    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    // Delete any completed optimized settlements in this group since the expense list has changed
    await Settlement.deleteMany({ groupId, isOptimized: true });

    // Predict category if not provided
    const chosenCategory = category || predictCategory(description);

    // Calculate splits
    const finalSplits = calculateSplits(Number(amount), splitType, splitAmong);

    // Create expense
    const expense = await Expense.create({
      amount: Number(amount),
      description,
      category: chosenCategory,
      paidBy: req.user._id,
      splitAmong: finalSplits,
      splitType,
      groupId,
      date: date || new Date()
    });

    const populatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name email avatar')
      .populate('splitAmong.user', 'name email avatar');

    // Create notifications for group members who owe money (except the payer)
    const notificationPromises = finalSplits
      .filter((s) => s.user.toString() !== req.user._id.toString())
      .map((s) => 
        createNotification(
          s.user,
          'New Expense Added',
          `${req.user.name} added "${description}" in "${group.groupName}". You owe ₹${s.amountOwed}.`,
          'expense_added'
        )
      );
    
    await Promise.all(notificationPromises);

    res.status(201).json({
      success: true,
      data: populatedExpense
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all expenses for a group
 * @route   GET /api/expenses/group/:groupId
 * @access  Private
 */
export const getGroupExpenses = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    if (!group.members.includes(req.user._id)) {
      res.statusCode = 403;
      throw new Error('Not authorized to view expenses of this group');
    }

    const expenses = await Expense.find({ groupId: req.params.groupId })
      .populate('paidBy', 'name email avatar')
      .populate('splitAmong.user', 'name email avatar')
      .sort({ date: -1 });

    res.json({
      success: true,
      data: expenses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an expense
 * @route   PUT /api/expenses/:id
 * @access  Private
 */
export const updateExpense = async (req, res, next) => {
  const { amount, description, category, splitType, splitAmong, date } = req.body;

  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.statusCode = 404;
      throw new Error('Expense not found');
    }

    // Check authorization (only the payer can edit the expense)
    if (expense.paidBy.toString() !== req.user._id.toString()) {
      res.statusCode = 403;
      throw new Error('Only the member who paid for this expense can edit it');
    }

    const newAmount = amount ? Number(amount) : expense.amount;
    const newSplitType = splitType || expense.splitType;
    const newSplitAmong = splitAmong || expense.splitAmong;

    expense.description = description || expense.description;
    expense.category = category || (description ? predictCategory(description) : expense.category);
    expense.amount = newAmount;
    expense.splitType = newSplitType;
    expense.date = date || expense.date;

    // Recalculate splits if amount, splitType, or splitAmong changed
    if (amount || splitType || splitAmong) {
      expense.splitAmong = calculateSplits(newAmount, newSplitType, newSplitAmong);
    }

    const updatedExpense = await expense.save();

    // Delete any completed optimized settlements in this group since the expense list has changed
    await Settlement.deleteMany({ groupId: expense.groupId, isOptimized: true });
    
    const populated = await Expense.findById(updatedExpense._id)
      .populate('paidBy', 'name email avatar')
      .populate('splitAmong.user', 'name email avatar');

    res.json({
      success: true,
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an expense
 * @route   DELETE /api/expenses/:id
 * @access  Private
 */
export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.statusCode = 404;
      throw new Error('Expense not found');
    }

    // Only creator of expense or creator of group can delete
    const group = await Group.findById(expense.groupId);
    const isGroupCreator = group && group.createdBy.toString() === req.user._id.toString();
    const isExpensePayer = expense.paidBy.toString() === req.user._id.toString();

    if (!isExpensePayer && !isGroupCreator) {
      res.statusCode = 403;
      throw new Error('Not authorized to delete this expense');
    }

    await Expense.findByIdAndDelete(req.params.id);

    // Delete any completed optimized settlements in this group since the expense list has changed
    await Settlement.deleteMany({ groupId: expense.groupId, isOptimized: true });

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search and filter user expenses globally
 * @route   GET /api/expenses/search
 * @access  Private
 */
export const searchExpenses = async (req, res, next) => {
  const { query, category, groupId, dateRange } = req.query;
  const userId = req.user._id;

  try {
    // User must be part of the group the expenses belong to.
    const userGroups = await Group.find({ members: userId }).select('_id');
    const groupIds = userGroups.map(g => g._id);

    const filter = { groupId: { $in: groupIds } };

    // Search query
    if (query) {
      filter.description = { $regex: query, $options: 'i' };
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Group filter
    if (groupId) {
      filter.groupId = groupId;
    }

    // Date range filter
    if (dateRange) {
      const now = new Date();
      if (dateRange === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        filter.date = { $gte: start };
      } else if (dateRange === 'week') {
        const start = new Date();
        start.setDate(now.getDate() - 7);
        filter.date = { $gte: start };
      } else if (dateRange === 'month') {
        const start = new Date();
        start.setMonth(now.getMonth() - 1);
        filter.date = { $gte: start };
      } else if (dateRange === 'custom' && req.query.startDate && req.query.endDate) {
        filter.date = {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate)
        };
      }
    }

    const expenses = await Expense.find(filter)
      .populate('paidBy', 'name email avatar')
      .populate('groupId', 'groupName')
      .sort({ date: -1 });

    res.json({
      success: true,
      data: expenses
    });
  } catch (error) {
    next(error);
  }
};
