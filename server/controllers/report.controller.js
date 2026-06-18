import Expense from '../models/expense.model.js';
import Group from '../models/group.model.js';
import Settlement from '../models/settlement.model.js';
import { calculateGroupHealth } from '../services/healthScore.service.js';
import { calculateUserReliability } from '../services/reliabilityScore.service.js';

// Helper to get ranges
const getMonthRange = (monthsAgo = 0) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

/**
 * @desc    Get dashboard summary cards data
 * @route   GET /api/reports/dashboard
 * @access  Private
 */
export const getDashboardSummary = async (req, res, next) => {
  const userId = req.user._id;

  try {
    // 1. Fetch user groups
    const groups = await Group.find({ members: userId });
    const groupIds = groups.map(g => g._id);

    // 2. Fetch all user expenses
    const expenses = await Expense.find({ groupId: { $in: groupIds } });

    // 3. Fetch all settlements
    const settlements = await Settlement.find({ groupId: { $in: groupIds } });

    // 4. Calculate Net Balances
    // - Spent: User's split shares in all expenses
    // - Owed to others (gross): User's split share in expenses paid by other users
    // - Lent to others (gross): Other users' split shares in expenses paid by the user
    let totalSpent = 0;
    let grossOwed = 0;
    let grossLent = 0;

    expenses.forEach(exp => {
      const payerId = exp.paidBy.toString();
      const isUserPayer = payerId === userId.toString();

      exp.splitAmong.forEach(split => {
        const debtorId = split.user.toString();
        const isUserDebtor = debtorId === userId.toString();

        if (isUserDebtor) {
          totalSpent += split.amountOwed;
          if (!isUserPayer) {
            grossOwed += split.amountOwed;
          }
        } else if (isUserPayer) {
          grossLent += split.amountOwed;
        }
      });
    });

    // 5. Deduct Completed Settlements
    // - Paid to others: Completed settlements from user to others
    // - Received from others: Completed settlements from others to user
    let paidToOthers = 0;
    let receivedFromOthers = 0;
    let pendingSettlementsCount = 0;

    settlements.forEach(settle => {
      const fromId = settle.payerId.toString();
      const toId = settle.receiverId.toString();

      if (settle.status === 'completed') {
        if (fromId === userId.toString()) {
          paidToOthers += settle.amount;
        } else if (toId === userId.toString()) {
          receivedFromOthers += settle.amount;
        }
      } else if (settle.status === 'pending') {
        if (fromId === userId.toString() || toId === userId.toString()) {
          pendingSettlementsCount++;
        }
      }
    });

    // Net Outstanding
    const youOwe = Math.max(0, Math.round((grossOwed - paidToOthers) * 100) / 100);
    const youAreOwed = Math.max(0, Math.round((grossLent - receivedFromOthers) * 100) / 100);

    // 6. Spending Trend (Last 6 Months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const { start, end } = getMonthRange(i);
      const monthLabel = start.toLocaleString('default', { month: 'short', year: '2-digit' });
      
      const monthExpenses = await Expense.find({
        'splitAmong.user': userId,
        date: { $gte: start, $lte: end }
      });

      let monthSpent = 0;
      monthExpenses.forEach(exp => {
        const split = exp.splitAmong.find(s => s.user.toString() === userId.toString());
        if (split) {
          monthSpent += split.amountOwed;
        }
      });

      monthlyTrend.push({
        month: monthLabel,
        Spent: Math.round(monthSpent * 100) / 100
      });
    }

    res.json({
      success: true,
      data: {
        totalGroups: groups.length,
        totalExpenses: expenses.length,
        youOwe,
        youAreOwed,
        pendingSettlementsCount,
        totalSpent: Math.round(totalSpent * 100) / 100,
        monthlyTrend
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get analytics and chart details
 * @route   GET /api/reports/analytics
 * @access  Private
 */
export const getAnalytics = async (req, res, next) => {
  const userId = req.user._id;

  try {
    const groups = await Group.find({ members: userId });
    const groupIds = groups.map(g => g._id);

    // 1. Category Wise Spending (Current Month)
    const { start: curStart, end: curEnd } = getMonthRange(0);
    const currentMonthExpenses = await Expense.find({
      'splitAmong.user': userId,
      date: { $gte: curStart, $lte: curEnd }
    }).populate('groupId', 'groupName');

    const categorySpending = {
      Food: 0, Travel: 0, Rent: 0, Shopping: 0, Entertainment: 0,
      Utilities: 0, Healthcare: 0, Education: 0, Others: 0
    };

    const groupSpending = {};

    currentMonthExpenses.forEach(exp => {
      const split = exp.splitAmong.find(s => s.user.toString() === userId.toString());
      if (split) {
        // Category
        const cat = exp.category || 'Others';
        categorySpending[cat] += split.amountOwed;

        // Group
        const gName = exp.groupId ? exp.groupId.groupName : 'Unknown Group';
        groupSpending[gName] = (groupSpending[gName] || 0) + split.amountOwed;
      }
    });

    const categoryData = Object.entries(categorySpending).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100
    })).filter(item => item.value > 0);

    const groupData = Object.entries(groupSpending).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100
    }));

    // 2. User Wise Spending Comparison inside groups (Who owes whom aggregate)
    // Settle rates (Completed vs total settlements)
    const settlements = await Settlement.find({ groupId: { $in: groupIds } });
    const completedCount = settlements.filter(s => s.status === 'completed').length;
    const totalCount = settlements.length;
    const settlementCompletionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

    res.json({
      success: true,
      data: {
        categorySpending: categoryData,
        groupSpending: groupData,
        settlementCompletionRate
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate full financial report including AI summary
 * @route   GET /api/reports/monthly
 * @access  Private
 */
export const getMonthlyReport = async (req, res, next) => {
  const userId = req.user._id;

  try {
    const groups = await Group.find({ members: userId })
      .populate('members', 'name email');
    const groupIds = groups.map(g => g._id);

    const { start, end } = getMonthRange(0);

    // Fetch this month's expenses
    const expenses = await Expense.find({
      groupId: { $in: groupIds },
      date: { $gte: start, $lte: end }
    }).populate('paidBy', 'name email')
      .populate('groupId', 'groupName');

    // Fetch this month's settlements
    const settlements = await Settlement.find({
      groupId: { $in: groupIds },
      date: { $gte: start, $lte: end }
    });

    // 1. Financial totals
    let totalSpending = 0; // total spent by user
    let grossOwed = 0;     // what user owes to others
    let grossLent = 0;     // what others owe to user

    expenses.forEach(exp => {
      const payerId = exp.paidBy._id.toString();
      const isUserPayer = payerId === userId.toString();

      exp.splitAmong.forEach(split => {
        const debtorId = split.user.toString();
        const isUserDebtor = debtorId === userId.toString();

        if (isUserDebtor) {
          totalSpending += split.amountOwed;
          if (!isUserPayer) {
            grossOwed += split.amountOwed;
          }
        } else if (isUserPayer) {
          grossLent += split.amountOwed;
        }
      });
    });

    // Completed settlements
    let paidToOthers = 0;
    let receivedFromOthers = 0;
    settlements.forEach(s => {
      if (s.status === 'completed') {
        if (s.payerId.toString() === userId.toString()) {
          paidToOthers += s.amount;
        } else if (s.receiverId.toString() === userId.toString()) {
          receivedFromOthers += s.amount;
        }
      }
    });

    const totalOwed = Math.max(0, Math.round((grossOwed - paidToOthers) * 100) / 100);
    const totalReceivable = Math.max(0, Math.round((grossLent - receivedFromOthers) * 100) / 100);

    // 2. Highest Spending Category
    const categoryTotals = {};
    expenses.forEach(exp => {
      const split = exp.splitAmong.find(s => s.user.toString() === userId.toString());
      if (split) {
        const cat = exp.category || 'Others';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + split.amountOwed;
      }
    });

    let highestCategory = 'N/A';
    let maxCatVal = 0;
    Object.entries(categoryTotals).forEach(([cat, val]) => {
      if (val > maxCatVal) {
        maxCatVal = val;
        highestCategory = cat;
      }
    });

    // 3. Most Active Group (highest expense count this month)
    const groupCounts = {};
    expenses.forEach(exp => {
      const gName = exp.groupId ? exp.groupId.groupName : 'Unknown Group';
      groupCounts[gName] = (groupCounts[gName] || 0) + 1;
    });

    let mostActiveGroup = 'N/A';
    let maxGroupVal = 0;
    Object.entries(groupCounts).forEach(([gName, val]) => {
      if (val > maxGroupVal) {
        maxGroupVal = val;
        mostActiveGroup = gName;
      }
    });

    // 4. Group Health Scores
    const healthScores = [];
    let sumHealth = 0;
    for (const group of groups) {
      const health = await calculateGroupHealth(group._id);
      healthScores.push({
        groupName: group.groupName,
        score: health.score,
        label: health.label
      });
      sumHealth += health.score;
    }
    const avgHealthScore = healthScores.length > 0 ? Math.round(sumHealth / healthScores.length) : 100;

    // 5. Reliability Score
    const reliability = await calculateUserReliability(userId);

    // 6. Settlement Statistics
    const totalSettlements = settlements.length;
    const completedSettlements = settlements.filter(s => s.status === 'completed').length;
    const pendingSettlements = totalSettlements - completedSettlements;
    const completionRate = totalSettlements > 0 ? Math.round((completedSettlements / totalSettlements) * 100) : 100;

    // 8. Pack detailed lists for CSV/Excel/PDF generation on the client
    const expensesList = expenses.map(exp => {
      const userSplit = exp.splitAmong.find(s => s.user.toString() === userId.toString());
      return {
        date: exp.date.toISOString().split('T')[0],
        description: exp.description,
        category: exp.category,
        groupName: exp.groupId ? exp.groupId.groupName : 'Unknown Group',
        paidBy: exp.paidBy.name,
        totalAmount: exp.amount,
        yourShare: userSplit ? userSplit.amountOwed : 0
      };
    });

    res.json({
      success: true,
      data: {
        totalSpending: Math.round(totalSpending * 100) / 100,
        totalOwed,
        totalReceivable,
        highestCategory,
        mostActiveGroup,
        avgHealthScore,
        healthScores,
        reliabilityScore: reliability.score,
        reliabilityLabel: reliability.label,
        settlements: {
          total: totalSettlements,
          completed: completedSettlements,
          pending: pendingSettlements,
          completionRate
        },
        expensesList
      }
    });
  } catch (error) {
    next(error);
  }
};
