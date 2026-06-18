import Group from '../models/group.model.js';
import Expense from '../models/expense.model.js';
import Settlement from '../models/settlement.model.js';
import { calculateGroupHealth } from '../services/healthScore.service.js';
import { optimizeDebts } from '../services/smartCircle.service.js';

/**
 * @desc    Create a new group
 * @route   POST /api/groups
 * @access  Private
 */
export const createGroup = async (req, res, next) => {
  const { groupName, description, members } = req.body;

  try {
    if (!groupName) {
      res.statusCode = 400;
      throw new Error('Group name is required');
    }

    // Ensure creator is in the members list
    const groupMembers = Array.isArray(members) ? [...members] : [];
    if (!groupMembers.includes(req.user._id.toString())) {
      groupMembers.push(req.user._id.toString());
    }

    const group = await Group.create({
      groupName,
      description,
      createdBy: req.user._id,
      members: groupMembers,
    });

    res.status(201).json({
      success: true,
      data: group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get logged in user's groups
 * @route   GET /api/groups
 * @access  Private
 */
export const getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('createdBy', 'name email avatar')
      .populate('members', 'name email avatar');

    // Attach group health score and summary metrics dynamically
    const formattedGroups = await Promise.all(
      groups.map(async (group) => {
        const expensesCount = await Expense.countDocuments({ groupId: group._id });
        const health = await calculateGroupHealth(group._id);
        
        return {
          _id: group._id,
          groupName: group.groupName,
          description: group.description,
          createdBy: group.createdBy,
          members: group.members,
          createdAt: group.createdAt,
          expensesCount,
          healthScore: health.score,
          healthLabel: health.label,
        };
      })
    );

    res.json({
      success: true,
      data: formattedGroups,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get group details by ID
 * @route   GET /api/groups/:id
 * @access  Private
 */
export const getGroupDetails = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('createdBy', 'name email avatar')
      .populate('members', 'name email avatar');

    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    // Check if logged in user is a member
    const isMember = group.members.some(
      (m) => m._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      res.statusCode = 403;
      throw new Error('Not authorized to view this group');
    }

    // Calculate group health score
    const health = await calculateGroupHealth(group._id);

    // Calculate debt optimization (Smart Circle)
    const optimization = await optimizeDebts(group._id);

    res.json({
      success: true,
      data: {
        group,
        health,
        optimization,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update group details
 * @route   PUT /api/groups/:id
 * @access  Private
 */
export const updateGroup = async (req, res, next) => {
  const { groupName, description } = req.body;

  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    // Check if user is creator
    if (group.createdBy.toString() !== req.user._id.toString()) {
      res.statusCode = 403;
      throw new Error('Only the group creator can update group details');
    }

    group.groupName = groupName || group.groupName;
    group.description = description || group.description;

    const updatedGroup = await group.save();

    res.json({
      success: true,
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add members to a group
 * @route   POST /api/groups/:id/members
 * @access  Private
 */
export const addMembers = async (req, res, next) => {
  const { members } = req.body; // Array of user IDs

  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    // Check authorization (must be a member to add other members)
    const isMember = group.members.includes(req.user._id);
    if (!isMember) {
      res.statusCode = 403;
      throw new Error('Not authorized to add members to this group');
    }

    // Add only new members
    members.forEach((memberId) => {
      if (memberId && !group.members.includes(memberId)) {
        group.members.push(memberId);
      }
    });

    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'name email avatar')
      .populate('members', 'name email avatar');

    res.json({
      success: true,
      data: populatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove a member from group
 * @route   DELETE /api/groups/:id/members/:memberId
 * @access  Private
 */
export const removeMember = async (req, res, next) => {
  const { id, memberId } = req.params;

  try {
    const group = await Group.findById(id);

    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    // Check authorization (must be creator of group)
    if (group.createdBy.toString() !== req.user._id.toString()) {
      res.statusCode = 403;
      throw new Error('Only the group creator can remove members');
    }

    if (group.createdBy.toString() === memberId) {
      res.statusCode = 400;
      throw new Error('Group creator cannot be removed from the group');
    }

    // Check if the user has non-zero balance in this group
    const debts = await optimizeDebts(group._id);
    const userBalanceItem = debts.netBalances.find(
      (b) => b.user._id.toString() === memberId
    );

    if (userBalanceItem && Math.abs(userBalanceItem.balance) > 0.05) {
      res.statusCode = 400;
      throw new Error(
        `Cannot remove member: user has an outstanding balance of ₹${userBalanceItem.balance}`
      );
    }

    // Remove member
    group.members = group.members.filter((m) => m.toString() !== memberId);
    await group.save();

    res.json({
      success: true,
      message: 'Member removed successfully',
      data: group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Leave a group
 * @route   DELETE /api/groups/:id/leave
 * @access  Private
 */
export const leaveGroup = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id.toString();

  try {
    const group = await Group.findById(id);

    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    if (!group.members.includes(req.user._id)) {
      res.statusCode = 400;
      throw new Error('You are not a member of this group');
    }

    // Check if leaving user has non-zero balance in this group
    const debts = await optimizeDebts(group._id);
    const userBalanceItem = debts.netBalances.find(
      (b) => b.user._id.toString() === userId
    );

    if (userBalanceItem && Math.abs(userBalanceItem.balance) > 0.05) {
      res.statusCode = 400;
      throw new Error(
        `Cannot leave group: you have an outstanding balance of ₹${userBalanceItem.balance}`
      );
    }

    // If last member, delete group
    if (group.members.length === 1) {
      await Group.findByIdAndDelete(id);
      await Expense.deleteMany({ groupId: id });
      await Settlement.deleteMany({ groupId: id });
      return res.json({
        success: true,
        message: 'You left the group. Since you were the last member, the group has been deleted.',
      });
    }

    // Transfer creator role if leaving user was creator
    if (group.createdBy.toString() === userId) {
      const nextCreator = group.members.find((m) => m.toString() !== userId);
      group.createdBy = nextCreator;
    }

    // Remove user from group members
    group.members = group.members.filter((m) => m.toString() !== userId);
    await group.save();

    res.json({
      success: true,
      message: 'You left the group successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a group
 * @route   DELETE /api/groups/:id
 * @access  Private
 */
export const deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      res.statusCode = 404;
      throw new Error('Group not found');
    }

    // Check if user is creator
    if (group.createdBy.toString() !== req.user._id.toString()) {
      res.statusCode = 403;
      throw new Error('Only the group creator can delete this group');
    }

    // Delete group and all its related expenses and settlements
    await Group.findByIdAndDelete(req.params.id);
    await Expense.deleteMany({ groupId: req.params.id });
    await Settlement.deleteMany({ groupId: req.params.id });

    res.json({
      success: true,
      message: 'Group and all associated expenses and settlements deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
