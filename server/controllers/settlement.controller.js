import Settlement from '../models/settlement.model.js';
import Group from '../models/group.model.js';
import User from '../models/user.model.js';
import { optimizeDebts } from '../services/smartCircle.service.js';
import { createNotification } from '../services/notification.service.js';

/**
 * @desc    Get optimization details (Smart Circle) without writing to DB
 * @route   GET /api/settlements/optimize/:groupId
 * @access  Private
 */
export const getOptimization = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    if (!group.members.includes(req.user._id)) {
      res.statusCode = 403;
      throw new Error('Not authorized to access this group');
    }

    const optimization = await optimizeDebts(group._id);
    res.json({
      success: true,
      data: optimization
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm and record optimized settlements in bulk
 * @route   POST /api/settlements/optimize/:groupId
 * @access  Private
 */
export const confirmOptimization = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId).populate('members', 'name email avatar');
    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    // Run the optimization algorithm to get the latest transactions
    const optimization = await optimizeDebts(group._id);
    const { optimizedTransactions } = optimization;

    if (optimizedTransactions.length === 0) {
      res.statusCode = 400;
      throw new Error('No pending debts to optimize in this group.');
    }

    // Mark group as optimized in the database
    group.isOptimized = true;
    await group.save();

    const createdSettlements = [];

    // Group original and optimized transactions by user
    const originalSent = {};
    const originalRecv = {};
    const optimizedSent = {};
    const optimizedRecv = {};

    optimization.originalTransactions.forEach(tx => {
      const fromId = tx.fromUser._id.toString();
      const toId = tx.toUser._id.toString();
      if (!originalSent[fromId]) originalSent[fromId] = [];
      originalSent[fromId].push({ user: tx.toUser, amount: tx.amount });

      if (!originalRecv[toId]) originalRecv[toId] = [];
      originalRecv[toId].push({ user: tx.fromUser, amount: tx.amount });
    });

    optimizedTransactions.forEach(tx => {
      const fromId = tx.fromUser._id.toString();
      const toId = tx.toUser._id.toString();
      if (!optimizedSent[fromId]) optimizedSent[fromId] = [];
      optimizedSent[fromId].push({ user: tx.toUser, amount: tx.amount });

      if (!optimizedRecv[toId]) optimizedRecv[toId] = [];
      optimizedRecv[toId].push({ user: tx.fromUser, amount: tx.amount });
    });

    const userNotifications = {};
    const addNotification = (userId, title, message) => {
      if (!userNotifications[userId]) {
        userNotifications[userId] = [];
      }
      if (!userNotifications[userId].some(n => n.message === message)) {
        userNotifications[userId].push({ title, message });
      }
    };

    group.members.forEach(member => {
      const memberId = member._id.toString();
      const origSent = originalSent[memberId] || [];
      const origRecv = originalRecv[memberId] || [];
      const optSent = optimizedSent[memberId] || [];
      const optRecv = optimizedRecv[memberId] || [];

      // Case 1: Redirected Senders
      optSent.forEach(optTx => {
        const toUser = optTx.user;
        const toUserId = toUser._id.toString();
        const origTx = origSent.find(t => t.user._id.toString() === toUserId);
        const origOwedAmount = origTx ? origTx.amount : 0;

        if (optTx.amount > origOwedAmount) {
          const addedOwed = optTx.amount - origOwedAmount;
          origSent.forEach(oTx => {
            const vUser = oTx.user;
            const vUserId = vUser._id.toString();
            const optOwedToV = optSent.find(t => t.user._id.toString() === vUserId);
            const optOwedToVAmount = optOwedToV ? optOwedToV.amount : 0;

            if (oTx.amount > optOwedToVAmount) {
              const reducedAmount = oTx.amount - optOwedToVAmount;
              const convertedAmount = Math.min(addedOwed, reducedAmount);

              if (convertedAmount > 0.01) {
                // Debtor receives:
                addNotification(
                  memberId,
                  'Smart Circle Optimization Applied',
                  `Your debt of ₹${convertedAmount} to ${vUser.name} has been converted into a direct payment to ${toUser.name}.`
                );

                // Creditor receives:
                addNotification(
                  toUserId,
                  'Smart Circle Optimization Applied',
                  `${member.name} now owes you ₹${convertedAmount} directly.`
                );
              }
            }
          });
        }
      });

      // Case 2: Removed Middle Users
      if (origSent.length > 0 && origRecv.length > 0) {
        if (optSent.length === 0 || optRecv.length === 0) {
          addNotification(
            memberId,
            'Smart Circle Optimization Successful',
            'You have been removed from the settlement chain.'
          );
        }
      }
    });

    // Save notifications to DB
    for (const [userId, list] of Object.entries(userNotifications)) {
      for (const n of list) {
        await createNotification(userId, n.title, n.message, 'settlement_completed');
      }
    }

    res.status(201).json({
      success: true,
      message: 'Smart Circle settlements completed successfully. Notifications sent to all other participants.',
      data: createdSettlements
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Log a new individual peer-to-peer settlement
 * @route   POST /api/settlements
 * @access  Private
 */
export const createSettlement = async (req, res, next) => {
  const { groupId, payerId, receiverId, toUser, amount } = req.body;

  try {
    const targetReceiver = receiverId || toUser;
    const targetPayer = payerId || req.user._id;

    if (!groupId || !targetReceiver || !amount) {
      res.statusCode = 400;
      throw new Error('Please provide groupId, receiverId, and amount');
    }

    const group = await Group.findById(groupId);
    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    // Payer is the logged-in user or specified payerId
    const settlement = await Settlement.create({
      groupId,
      payerId: targetPayer,
      receiverId: targetReceiver,
      amount: Number(amount),
      status: 'completed',
      completedAt: new Date()
    });

    // Remove any previous pending settlements between these two users in this group to prevent duplicates
    await Settlement.deleteMany({
      groupId,
      payerId: targetPayer,
      receiverId: targetReceiver,
      status: 'pending'
    });

    // Notify the other party
    const groupName = group ? group.groupName : 'Group';
    const isPayer = req.user._id.toString() === targetPayer.toString();
    const notifyUserId = isPayer ? targetReceiver : targetPayer;
    const relationWord = isPayer ? 'to you' : 'from you';

    const notifyUser = await User.findById(notifyUserId);
    if (notifyUser) {
      await createNotification(
        notifyUserId,
        'Payment Settled',
        `${req.user.name} recorded a payment of ₹${amount} ${relationWord} in ${groupName}. This debt has been settled.`,
        'settlement_completed'
      );
    }

    res.status(201).json({
      success: true,
      data: settlement
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm a pending settlement (Mark as completed)
 * @route   PUT /api/settlements/:id/confirm
 * @access  Private
 */
export const confirmSettlement = async (req, res, next) => {
  try {
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement) {
      res.statusCode = 404;
      throw new Error('Settlement record not found');
    }

    // Only the recipient (creditor) should confirm payment completion
    if (settlement.receiverId.toString() !== req.user._id.toString()) {
      res.statusCode = 403;
      throw new Error('Only the receiving member can confirm this payment');
    }

    settlement.status = 'completed';
    settlement.completedAt = new Date();
    
    // Add logged in user to confirmed list if not already there
    if (!settlement.confirmedBy.includes(req.user._id)) {
      settlement.confirmedBy.push(req.user._id);
    }
    
    await settlement.save();

    // Notify the payer that the settlement is completed
    const group = await Group.findById(settlement.groupId);
    await createNotification(
      settlement.payerId,
      'Settlement Confirmed',
      `${req.user.name} confirmed your payment of ₹${settlement.amount} in "${group ? group.groupName : 'Group'}".`,
      'settlement_completed'
    );

    res.json({
      success: true,
      message: 'Settlement confirmed and marked as completed.',
      data: settlement
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get settlement history (both pending and completed) for a group
 * @route   GET /api/settlements/group/:groupId
 * @access  Private
 */
export const getGroupSettlements = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    const settlements = await Settlement.find({ groupId: req.params.groupId })
      .populate('payerId', 'name email avatar')
      .populate('receiverId', 'name email avatar')
      .sort({ createdAt: -1 });

    const formatted = settlements.map(s => {
      const obj = s.toObject();
      obj.fromUser = s.payerId;
      obj.toUser = s.receiverId;
      obj.date = s.createdAt;
      return obj;
    });

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};
