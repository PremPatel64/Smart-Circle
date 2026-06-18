import mongoose from 'mongoose';
import Expense from './models/expense.model.js';
import Settlement from './models/settlement.model.js';
import User from './models/user.model.js';

await mongoose.connect('mongodb://127.0.0.1:27017/smartsplit');

const groupId = new mongoose.Types.ObjectId('6a32aaecc000ab86911e5df0');

// 1. Fetch expenses
const expenses = await Expense.find({ groupId }).populate('paidBy').populate('splitAmong.user');

// 2. Fetch members
const memberSet = new Set();
expenses.forEach(exp => {
  if (exp.paidBy) memberSet.add(exp.paidBy._id.toString());
  exp.splitAmong.forEach(split => {
    if (split.user) memberSet.add(split.user._id.toString());
  });
});
const memberIds = Array.from(memberSet);
const users = await User.find({ _id: { $in: memberIds } });
const userMap = {};
users.forEach(u => { userMap[u._id.toString()] = u.name; });

// 3. Build debts matrix
const debts = {};
memberIds.forEach(id => {
  debts[id] = {};
  memberIds.forEach(id2 => { debts[id][id2] = 0; });
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

console.log('Debts before settlements:');
memberIds.forEach(u1 => {
  memberIds.forEach(u2 => {
    if (debts[u1][u2] > 0) console.log(userMap[u1] + ' owes ' + userMap[u2] + ' ₹' + debts[u1][u2]);
  });
});

// 4. Fetch settlements
const completedSettlements = await Settlement.find({ groupId, status: 'completed' });
console.log('\nCompleted Settlements:', completedSettlements.map(s => userMap[s.payerId.toString()] + ' paid ' + userMap[s.receiverId.toString()] + ' ₹' + s.amount));

// Helper DFS path finder
const findDebtPath = (start, end, debts, visited = new Set()) => {
  if (start === end) return [start];
  visited.add(start);
  for (const neighbor of Object.keys(debts[start] || {})) {
    if (debts[start][neighbor] > 0.01 && !visited.has(neighbor)) {
      const path = findDebtPath(neighbor, end, debts, visited);
      if (path) return [start, ...path];
    }
  }
  return null;
};

// Adjust debts matrix with path reduction
completedSettlements.forEach(settle => {
  const fromId = settle.payerId.toString();
  const toId = settle.receiverId.toString();
  const amount = settle.amount;
  const path = findDebtPath(fromId, toId, debts);
  if (path && path.length > 1) {
    console.log('\nFound path from ' + userMap[fromId] + ' to ' + userMap[toId] + ':', path.map(id => userMap[id]).join(' -> '));
    for (let i = 0; i < path.length - 1; i++) {
      debts[path[i]][path[i+1]] -= amount;
    }
  } else {
    if (debts[fromId] && debts[fromId][toId] !== undefined) {
      debts[fromId][toId] -= amount;
    }
  }
});

console.log('\nDebts after settlements (Path Reduction):');
let activeDebtCount = 0;
memberIds.forEach(u1 => {
  memberIds.forEach(u2 => {
    const diff = debts[u1][u2] - debts[u2][u1];
    if (diff > 0.01) {
      console.log(userMap[u1] + ' owes ' + userMap[u2] + ' ₹' + diff);
      activeDebtCount++;
    }
  });
});

if (activeDebtCount === 0) {
  console.log('Everyone is completely settled!');
}

await mongoose.disconnect();
