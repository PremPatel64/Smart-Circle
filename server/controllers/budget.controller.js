import Budget from '../models/budget.model.js';
import Expense from '../models/expense.model.js';
import { createNotification } from '../services/notification.service.js';

// Helper to get start and end dates of current month
const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

// Helper to format month as YYYY-MM
const getCurrentMonthString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * @desc    Get user budget for a specific month
 * @route   GET /api/budgets/:month
 * @access  Private
 */
export const getBudget = async (req, res, next) => {
  const month = req.params.month || getCurrentMonthString();

  try {
    let budget = await Budget.findOne({ user: req.user._id, month });

    if (!budget) {
      // Return a default empty budget template
      budget = {
        month,
        monthlyLimit: 0,
        categoryLimits: []
      };
    }

    res.json({
      success: true,
      data: budget
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create or update user budget
 * @route   POST /api/budgets
 * @access  Private
 */
export const setBudget = async (req, res, next) => {
  const { month, monthlyLimit, categoryLimits } = req.body;
  const monthStr = month || getCurrentMonthString();

  try {
    if (monthlyLimit === undefined) {
      res.statusCode = 400;
      throw new Error('Monthly limit is required');
    }

    let budget = await Budget.findOne({ user: req.user._id, month: monthStr });

    if (budget) {
      budget.monthlyLimit = Number(monthlyLimit);
      budget.categoryLimits = categoryLimits || budget.categoryLimits;
      await budget.save();
    } else {
      budget = await Budget.create({
        user: req.user._id,
        month: monthStr,
        monthlyLimit: Number(monthlyLimit),
        categoryLimits: categoryLimits || []
      });
    }

    res.json({
      success: true,
      message: 'Budget saved successfully',
      data: budget
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get budget consumption status
 * @route   GET /api/budgets/status/:month
 * @access  Private
 */
export const getBudgetStatus = async (req, res, next) => {
  const month = req.params.month || getCurrentMonthString();
  const userId = req.user._id;

  try {
    // 1. Fetch budget
    const budget = await Budget.findOne({ user: userId, month });
    const monthlyLimit = budget ? budget.monthlyLimit : 0;
    const catLimitsMap = {};
    if (budget) {
      budget.categoryLimits.forEach(cl => {
        catLimitsMap[cl.category] = cl.limit;
      });
    }

    // 2. Calculate actual user spending for this month (user's share of expenses)
    const { start, end } = getCurrentMonthRange();
    const expenses = await Expense.find({
      'splitAmong.user': userId,
      date: { $gte: start, $lte: end }
    });

    let totalSpent = 0;
    const categorySpent = {
      Food: 0, Travel: 0, Rent: 0, Shopping: 0, Entertainment: 0,
      Utilities: 0, Healthcare: 0, Education: 0, Others: 0
    };

    expenses.forEach(exp => {
      const userSplit = exp.splitAmong.find(s => s.user.toString() === userId.toString());
      if (userSplit) {
        totalSpent += userSplit.amountOwed;
        const cat = exp.category || 'Others';
        categorySpent[cat] = (categorySpent[cat] || 0) + userSplit.amountOwed;
      }
    });

    // Round total and category spending
    totalSpent = Math.round(totalSpent * 100) / 100;
    Object.keys(categorySpent).forEach(cat => {
      categorySpent[cat] = Math.round(categorySpent[cat] * 100) / 100;
    });

    // Find overspent categories
    const overspentCategories = [];
    Object.entries(categorySpent).forEach(([cat, spent]) => {
      const limit = catLimitsMap[cat];
      if (limit !== undefined && limit > 0 && spent > limit) {
        overspentCategories.push(cat);
      }
    });

    // 3. Trigger warning notifications if budget is exceeded
    if (monthlyLimit > 0) {
      const percentUsed = (totalSpent / monthlyLimit) * 100;
      if (percentUsed >= 100) {
        await createNotification(
          userId,
          'Budget Limit Exceeded!',
          `You have spent ₹${totalSpent}, which exceeds your monthly budget limit of ₹${monthlyLimit} by ₹${Math.round((totalSpent - monthlyLimit) * 100) / 100}.`,
          'budget_warning'
        );
      } else if (percentUsed >= 80) {
        await createNotification(
          userId,
          'Budget Warning (80% used)',
          `Warning: You have used ${Math.round(percentUsed)}% of your monthly budget limit. You spent ₹${totalSpent} out of ₹${monthlyLimit}.`,
          'budget_warning'
        );
      }
    }

    // Trigger individual category overspent notifications
    for (const cat of overspentCategories) {
      await createNotification(
        userId,
        `Category Budget Warning: ${cat}`,
        `You have exceeded your ₹${catLimitsMap[cat]} budget for "${cat}". Current spending: ₹${categorySpent[cat]}.`,
        'budget_warning'
      );
    }

    res.json({
      success: true,
      data: {
        month,
        monthlyLimit,
        totalSpent,
        categorySpent,
        categoryLimits: budget ? budget.categoryLimits : [],
        overspentCategories
      }
    });
  } catch (error) {
    next(error);
  }
};
