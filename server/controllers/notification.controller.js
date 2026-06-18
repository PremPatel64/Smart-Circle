import Notification from '../models/notification.model.js';

/**
 * @desc    Get current user's notifications
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark notifications as read
 * @route   PUT /api/notifications/read
 * @access  Private
 */
export const markNotificationsRead = async (req, res, next) => {
  const { id } = req.body;

  try {
    if (id) {
      await Notification.findByIdAndUpdate(id, { isRead: true });
    } else {
      // Mark all read for this user
      await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    }

    res.json({
      success: true,
      message: 'Notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
export const markSingleNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      res.statusCode = 404;
      throw new Error('Notification not found');
    }
    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    next(error);
  }
};
