import User from '../models/user.model.js';
import Expense from '../models/expense.model.js';
import Settlement from '../models/settlement.model.js';
import Group from '../models/group.model.js';

/**
 * Finds a path from start to end in the debts graph where each edge has debt > 0.
 * Returns the array of node IDs on the path, or null if no path exists.
 */
const findDebtPath = (start, end, debts, visited = new Set()) => {
  if (start === end) return [start];
  visited.add(start);

  for (const neighbor of Object.keys(debts[start] || {})) {
    if (debts[start][neighbor] > 0.01 && !visited.has(neighbor)) {
      const path = findDebtPath(neighbor, end, debts, visited);
      if (path) {
        return [start, ...path];
      }
    }
  }

  visited.delete(start); // Backtrack
  return null;
};

/**
 * Calculates original pairwise net debts and optimized net transactions for a group.
 * @param {string} groupId - The ID of the group
 * @returns {Promise<object>} Optimization details
 */
export const optimizeDebts = async (groupId) => {
  const group = await Group.findById(groupId);

  // 1. Fetch all expenses in the group
  const expenses = await Expense.find({ groupId })
    .populate('paidBy', 'name email avatar')
    .populate('splitAmong.user', 'name email avatar');

  // Fetch all completed settlements early
  const completedSettlements = await Settlement.find({ groupId, status: 'completed' });

  // Find all unique members in this group (both from group members and expense participants)
  const memberSet = new Set();
  if (group) {
    group.members.forEach(m => memberSet.add(m.toString()));
  }
  expenses.forEach(exp => {
    if (exp.paidBy) memberSet.add(exp.paidBy._id.toString());
    exp.splitAmong.forEach(split => {
      if (split.user) memberSet.add(split.user._id.toString());
    });
  });

  const memberIds = Array.from(memberSet);

  // Fetch full details of all members involved
  const users = await User.find({ _id: { $in: memberIds } }).select('name email avatar');
  const userMap = {};
  users.forEach(u => {
    userMap[u._id.toString()] = {
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      avatar: u.avatar
    };
  });

  // If there are fewer than 2 users, no settlements needed
  if (memberIds.length < 2) {
    return {
      originalTransactions: [],
      optimizedTransactions: [],
      transactionReductionCount: 0,
      totalMoneySettled: 0,
      netBalances: []
    };
  }

  // 2. Calculate Original Pairwise Debts Matrix
  // debts[A][B] = amount A owes B
  const debts = {};
  memberIds.forEach(id => {
    debts[id] = {};
    memberIds.forEach(id2 => {
      debts[id][id2] = 0;
    });
  });

  expenses.forEach(exp => {
    const payerId = exp.paidBy._id.toString();
    exp.splitAmong.forEach(split => {
      const debtorId = split.user._id.toString();
      if (debtorId !== payerId) {
        debts[debtorId][payerId] += split.amountOwed;
      }
    });
  });

  // Adjust pairwise debts matrix with completed settlements using path reduction
  completedSettlements.forEach(settle => {
    const fromId = settle.payerId.toString();
    const toId = settle.receiverId.toString();
    let amount = settle.amount;

    if (debts[fromId] && debts[toId]) {
      while (amount > 0.01) {
        const path = findDebtPath(fromId, toId, debts);
        if (!path || path.length <= 1) {
          break;
        }

        // Find the bottleneck capacity in the path
        let bottleneck = Infinity;
        for (let i = 0; i < path.length - 1; i++) {
          const u = path[i];
          const v = path[i + 1];
          if (debts[u][v] < bottleneck) {
            bottleneck = debts[u][v];
          }
        }

        if (bottleneck <= 0.01) {
          break;
        }

        // Reduce by the minimum of remaining amount and bottleneck
        const reduceAmount = Math.min(amount, bottleneck);
        for (let i = 0; i < path.length - 1; i++) {
          const u = path[i];
          const v = path[i + 1];
          debts[u][v] = Math.max(0, debts[u][v] - reduceAmount);
        }

        amount -= reduceAmount;
      }

      // If there's still remaining amount, reduce the direct edge if it exists
      if (amount > 0.01 && debts[fromId][toId] !== undefined) {
        debts[fromId][toId] = Math.max(0, debts[fromId][toId] - amount);
      }
    }
  });

  // Simplify pairwise debts (A owes B 100, B owes A 40 => A owes B 60)
  const originalTransactions = [];
  let totalMoneySettled = 0;

  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      const u1 = memberIds[i];
      const u2 = memberIds[j];
      const diff = debts[u1][u2] - debts[u2][u1];

      if (diff > 0.01) {
        originalTransactions.push({
          fromUser: userMap[u1],
          toUser: userMap[u2],
          amount: Math.round(diff * 100) / 100
        });
      } else if (diff < -0.01) {
        originalTransactions.push({
          fromUser: userMap[u2],
          toUser: userMap[u1],
          amount: Math.round(Math.abs(diff) * 100) / 100
        });
      }
    }
  }

  // 3. Calculate Net Balances for each user
  // Net balance = Total paid - Total owed + (Paid Settlements - Received Settlements)
  const netBalances = {};
  memberIds.forEach(id => {
    netBalances[id] = 0;
  });

  expenses.forEach(exp => {
    const payerId = exp.paidBy._id.toString();
    netBalances[payerId] += exp.amount;

    exp.splitAmong.forEach(split => {
      const debtorId = split.user._id.toString();
      netBalances[debtorId] -= split.amountOwed;
    });
  });

  // Reuse the fetched completed settlements to adjust net balances
  completedSettlements.forEach(settle => {
    const fromId = settle.payerId.toString();
    const toId = settle.receiverId.toString();

    if (netBalances[fromId] !== undefined) {
      netBalances[fromId] += settle.amount;
    }
    if (netBalances[toId] !== undefined) {
      netBalances[toId] -= settle.amount;
    }
  });

  // Format net balances list
  const formattedBalances = Object.entries(netBalances).map(([userId, bal]) => ({
    user: userMap[userId],
    balance: Math.round(bal * 100) / 100
  })).sort((a, b) => b.balance - a.balance);

  // 4. Greedy Optimization Algorithm
  // Separate into debtors (net balance < 0) and creditors (net balance > 0)
  const debtors = [];
  const creditors = [];

  Object.entries(netBalances).forEach(([userId, bal]) => {
    const roundedBal = Math.round(bal * 100) / 100;
    if (roundedBal < -0.01) {
      debtors.push({ userId, balance: roundedBal });
    } else if (roundedBal > 0.01) {
      creditors.push({ userId, balance: roundedBal });
    }
  });

  // Sort descending by absolute values
  debtors.sort((a, b) => a.balance - b.balance); // more negative first
  creditors.sort((a, b) => b.balance - a.balance); // more positive first

  const optimizedTransactions = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const debtorOwes = Math.abs(debtor.balance);
    const creditorReceives = creditor.balance;

    const settledAmount = Math.min(debtorOwes, creditorReceives);
    const roundedSettled = Math.round(settledAmount * 100) / 100;

    if (roundedSettled > 0.01) {
      optimizedTransactions.push({
        fromUser: userMap[debtor.userId],
        toUser: userMap[creditor.userId],
        amount: roundedSettled
      });
      totalMoneySettled += roundedSettled;
    }

    // Update balances
    debtor.balance += roundedSettled;
    creditor.balance -= roundedSettled;

    if (Math.abs(debtor.balance) < 0.01) {
      dIdx++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      cIdx++;
    }
  }

  const origCount = originalTransactions.length;
  const optCount = optimizedTransactions.length;
  const reduction = origCount - optCount;

  // Identify middle users: users who have both incoming and outgoing raw debts
  const senders = new Set();
  const receivers = new Set();
  originalTransactions.forEach(tx => {
    if (tx.fromUser?._id) {
      senders.add(tx.fromUser._id.toString());
    }
    if (tx.toUser?._id) {
      receivers.add(tx.toUser._id.toString());
    }
  });
  const middleUsers = memberIds.filter(id => senders.has(id) && receivers.has(id));

  const isOptimized = group ? group.isOptimized : false;

  return {
    originalTransactions: isOptimized ? optimizedTransactions : originalTransactions,
    optimizedTransactions,
    transactionReductionCount: reduction > 0 ? reduction : 0,
    totalMoneySettled: Math.round(totalMoneySettled * 100) / 100,
    netBalances: formattedBalances,
    middleUsers: isOptimized ? [] : middleUsers,
    isOptimized
  };
};
