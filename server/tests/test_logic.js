import { predictCategory } from '../utils/categoryPredictor.js';
import { optimizeDebts } from '../services/smartCircle.service.js';
import Expense from '../models/expense.model.js';
import User from '../models/user.model.js';
import Settlement from '../models/settlement.model.js';

// Simple Assert Helper
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${message}`);
};

// 1. Test Category Predictor
const testCategoryPredictor = () => {
  console.log('\n--- Testing Category Predictor ---');
  assert(predictCategory("Pizza Hut dinner") === "Food", "Pizza Hut -> Food");
  assert(predictCategory("Uber ride to office") === "Travel", "Uber -> Travel");
  assert(predictCategory("Netflix subscription") === "Entertainment", "Netflix -> Entertainment");
  assert(predictCategory("Electricity bill June") === "Utilities", "Electricity -> Utilities");
  assert(predictCategory("Udemy Python course") === "Education", "Udemy -> Education");
  assert(predictCategory("Gym membership") === "Healthcare", "Gym -> Healthcare");
  assert(predictCategory("Random stuff") === "Others", "Unknown -> Others");
};

// Mock Database wrapper to test optimization logic
const testDebtOptimization = async () => {
  console.log('\n--- Testing Smart Circle Debt Optimization ---');

  const mockUsers = [
    { _id: '1', name: 'Prem', email: 'prem@gmail.com', avatar: '' },
    { _id: '2', name: 'Kunj', email: 'kunj@gmail.com', avatar: '' },
    { _id: '3', name: 'Mit', email: 'mit@gmail.com', avatar: '' }
  ];

  const mockExpenses = [
    {
      _id: 'exp1',
      amount: 1200,
      description: 'Goa Trip Hotel',
      category: 'Travel',
      paidBy: { _id: '1' }, // Prem
      splitAmong: [
        { user: { _id: '1' }, amountOwed: 400 },
        { user: { _id: '2' }, amountOwed: 400 },
        { user: { _id: '3' }, amountOwed: 400 }
      ],
      splitType: 'equal',
      groupId: 'group1'
    },
    {
      _id: 'exp2',
      amount: 500,
      description: 'Lunch',
      category: 'Food',
      paidBy: { _id: '2' }, // Kunj
      splitAmong: [
        { user: { _id: '2' }, amountOwed: 250 },
        { user: { _id: '3' }, amountOwed: 250 }
      ],
      splitType: 'equal',
      groupId: 'group1'
    },
    {
      _id: 'exp3',
      amount: 400,
      description: 'Taxi rides',
      category: 'Travel',
      paidBy: { _id: '3' }, // Mit
      splitAmong: [
        { user: { _id: '3' }, amountOwed: 200 },
        { user: { _id: '1' }, amountOwed: 200 }
      ],
      splitType: 'equal',
      groupId: 'group1'
    }
  ];

  // Monkey-patch Mongoose queries for test isolation
  Expense.find = () => {
    return {
      populate: () => ({
        populate: () => Promise.resolve(mockExpenses)
      })
    };
  };

  User.find = () => {
    return {
      select: () => Promise.resolve(mockUsers)
    };
  };

  Settlement.find = () => {
    return Promise.resolve([]);
  };

  // Run optimization
  const result = await optimizeDebts('group1');

  // Verify Net Balances
  // Expected: Prem: +600, Kunj: -150, Mit: -450
  const premBal = result.netBalances.find(b => b.user._id === '1').balance;
  const kunjBal = result.netBalances.find(b => b.user._id === '2').balance;
  const mitBal = result.netBalances.find(b => b.user._id === '3').balance;

  assert(premBal === 600, `Prem balance should be +600 (actual: ${premBal})`);
  assert(kunjBal === -150, `Kunj balance should be -150 (actual: ${kunjBal})`);
  assert(mitBal === -450, `Mit balance should be -450 (actual: ${mitBal})`);

  // Verify Optimized transactions
  // Expected: Mit pays Prem 450, Kunj pays Prem 150
  assert(result.optimizedTransactions.length === 2, "Should optimize to exactly 2 transactions");
  
  const mitTx = result.optimizedTransactions.find(t => t.fromUser._id === '3');
  const kunjTx = result.optimizedTransactions.find(t => t.fromUser._id === '2');

  assert(mitTx.toUser._id === '1' && mitTx.amount === 450, "Mit pays Prem 450");
  assert(kunjTx.toUser._id === '1' && kunjTx.amount === 150, "Kunj pays Prem 150");
  assert(result.transactionReductionCount === 1, "Should reduce transactions by 1");
};

// Run Tests
const runTests = async () => {
  try {
    testCategoryPredictor();
    await testDebtOptimization();
    console.log('\n🌟 ALL BACKEND TESTS PASSED SUCCESSFULY! 🌟\n');
  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  }
};

runTests();
