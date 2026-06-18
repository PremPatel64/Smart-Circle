import Settlement from '../models/settlement.model.js';
import Expense from '../models/expense.model.js';

/**
 * Calculates a health score (0-100) for a group.
 * @param {string} groupId - The ID of the group
 * @returns {Promise<object>} The health score, label, and reasons
 */
export const calculateGroupHealth = async (groupId) => {
  const settlements = await Settlement.find({ groupId });
  const expenses = await Expense.find({ groupId });

  if (expenses.length === 0) {
    return {
      score: 100,
      label: 'Excellent',
      reasons: ['No expenses recorded. The group has no outstanding debt.']
    };
  }

  // 1. Calculate settlement completion rate
  const totalSettlements = settlements.length;
  const completedSettlements = settlements.filter(s => s.status === 'completed').length;
  const pendingSettlements = totalSettlements - completedSettlements;
  
  const completionRate = totalSettlements > 0 ? (completedSettlements / totalSettlements) * 100 : 100;

  // 2. Calculate unsettled debt amount vs total spending
  const totalSpend = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const unsettledDebt = settlements
    .filter(s => s.status === 'pending')
    .reduce((sum, s) => sum + s.amount, 0);

  const debtRatio = totalSpend > 0 ? unsettledDebt / totalSpend : 0;
  const debtScore = Math.max(0, (1 - debtRatio) * 100);

  // 3. Calculate overdue payments (pending settlements older than 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const overdueSettlements = settlements.filter(s => 
    s.status === 'pending' && new Date(s.createdAt) < sevenDaysAgo
  ).length;

  const overdueRate = pendingSettlements > 0 ? overdueSettlements / pendingSettlements : 0;
  const overdueScore = (1 - overdueRate) * 100;

  // 4. Calculate final score (Weighted Average)
  // 40% Completion Rate, 30% Debt Ratio, 30% Overdue Rate
  let score = Math.round(
    (completionRate * 0.40) + 
    (debtScore * 0.30) + 
    (overdueScore * 0.30)
  );

  // Safeguard limits
  score = Math.min(100, Math.max(0, score));

  // Determine Label
  let label = 'Poor';
  if (score >= 90) label = 'Excellent';
  else if (score >= 70) label = 'Good';
  else if (score >= 50) label = 'Average';

  // Gather reasons
  const reasons = [];
  if (pendingSettlements > 3) {
    reasons.push('High count of pending settlements.');
  }
  if (overdueSettlements > 0) {
    reasons.push(`Multiple overdue balances (${overdueSettlements} older than 7 days).`);
  }
  if (debtRatio > 0.4) {
    reasons.push('Unsettled debt represents a high percentage of group spending.');
  }
  if (completionRate < 60 && totalSettlements > 0) {
    reasons.push('Low settlement completion rate.');
  }

  if (reasons.length === 0) {
    if (score >= 90) {
      reasons.push('All debts are actively settled and paid on time.');
    } else {
      reasons.push('Debts are fairly stable but could be settled quicker.');
    }
  }

  return {
    score,
    label,
    reasons
  };
};
