import Settlement from '../models/settlement.model.js';

/**
 * Calculates a reliability score (0-100) for a user.
 * @param {string} userId - The ID of the user
 * @returns {Promise<object>} The reliability score, label, and statistics
 */
export const calculateUserReliability = async (userId) => {
  // Find all settlements where this user is the payer (debtor)
  const settlements = await Settlement.find({ payerId: userId });

  if (settlements.length === 0) {
    return {
      score: 100,
      label: 'Excellent Payer',
      completedCount: 0,
      pendingCount: 0,
      averageSettlementTimeDays: 0,
    };
  }

  const completed = settlements.filter(s => s.status === 'completed');
  const pending = settlements.filter(s => s.status === 'pending');
  const total = settlements.length;

  // 1. Completion Rate Score (40% weight)
  const completionRate = (completed.length / total) * 100;

  // 2. Delayed Payments Score (40% weight)
  // A settlement is "delayed" if it's pending and older than 7 days, OR
  // completed but took more than 7 days to complete.
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  let delayedCount = 0;

  settlements.forEach(s => {
    const creationTime = new Date(s.createdAt).getTime();
    if (s.status === 'pending') {
      const timeElapsed = Date.now() - creationTime;
      if (timeElapsed > sevenDaysMs) {
        delayedCount++;
      }
    } else if (s.status === 'completed' && s.completedAt) {
      const completionTime = new Date(s.completedAt).getTime();
      if (completionTime - creationTime > sevenDaysMs) {
        delayedCount++;
      }
    }
  });

  const delayRate = delayedCount / total;
  const delayScore = (1 - delayRate) * 100;

  // 3. Settlement Speed Score (20% weight)
  // Calculate average settlement time in days for completed settlements
  let totalSpeedDays = 0;
  let speedScore = 80; // default if no completed settlements

  if (completed.length > 0) {
    let completedWithDates = 0;
    completed.forEach(s => {
      if (s.completedAt) {
        const timeDiff = new Date(s.completedAt).getTime() - new Date(s.createdAt).getTime();
        const diffDays = timeDiff / (24 * 60 * 60 * 1000);
        totalSpeedDays += diffDays;
        completedWithDates++;
      }
    });

    const averageDays = completedWithDates > 0 ? totalSpeedDays / completedWithDates : 0;
    if (averageDays <= 2) speedScore = 100;
    else if (averageDays <= 5) speedScore = 80;
    else if (averageDays <= 7) speedScore = 60;
    else speedScore = 40;
  }

  // Calculate overall score
  let score = Math.round(
    (completionRate * 0.40) +
    (delayScore * 0.40) +
    (speedScore * 0.20)
  );

  score = Math.min(100, Math.max(0, score));

  // Category labels
  let label = 'Delayed Payer';
  if (score >= 90) label = 'Excellent Payer';
  else if (score >= 75) label = 'Good Payer';
  else if (score >= 60) label = 'Average Payer';

  const avgDays = completed.length > 0 && totalSpeedDays > 0
    ? Math.round((totalSpeedDays / completed.length) * 10) / 10
    : 0;

  return {
    score,
    label,
    completedCount: completed.length,
    pendingCount: pending.length,
    averageSettlementTimeDays: avgDays,
    delayedCount
  };
};
