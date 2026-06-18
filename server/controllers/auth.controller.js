import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { calculateUserReliability } from '../services/reliabilityScore.service.js';

// Token generator helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkey_smartsplit123', {
    expiresIn: '30d',
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = async (req, res, next) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.statusCode = 400;
      throw new Error('User already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          token: generateToken(user._id),
        },
      });
    } else {
      res.statusCode = 400;
      throw new Error('Invalid user data');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Auth user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          token: generateToken(user._id),
        },
      });
    } else {
      res.statusCode = 401;
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (user) {
      // Fetch reliability score dynamically
      const reliability = await calculateUserReliability(user._id);

      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt,
          reliability,
        },
      });
    } else {
      res.statusCode = 404;
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;

      const updatedUser = await user.save();

      res.json({
        success: true,
        data: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          avatar: updatedUser.avatar,
          token: generateToken(updatedUser._id),
        },
      });
    } else {
      res.statusCode = 404;
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change user password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
export const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (user && (await user.matchPassword(currentPassword))) {
      user.password = newPassword;
      await user.save();
      
      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } else {
      res.statusCode = 401;
      throw new Error('Incorrect current password');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload profile avatar image
 * @route   POST /api/auth/avatar
 * @access  Private
 */
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      res.statusCode = 400;
      throw new Error('Please upload an image file');
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.statusCode = 404;
      throw new Error('User not found');
    }

    // Format url path to save (e.g. /uploads/avatar-xxx.jpg)
    const filePath = `/uploads/${req.file.filename}`;
    user.avatar = filePath;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: filePath
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search users by email or name for adding to groups
 * @route   GET /api/auth/users
 * @access  Private
 */
export const searchUsers = async (req, res, next) => {
  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
        ],
      }
    : {};

  try {
    // Exclude current user from results
    const users = await User.find(keyword)
      .find({ _id: { $ne: req.user._id } })
      .select('name email avatar')
      .limit(10);

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};
