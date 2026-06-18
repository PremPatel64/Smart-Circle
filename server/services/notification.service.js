import Notification from '../models/notification.model.js';

/**
 * Creates and saves a notification in the database for a user.
 * @param {string} userId - User to receive notification
 * @param {string} title - Title of the notification
 * @param {string} message - Message description
 * @param {string} type - Notification type enum
 */
export const createNotification = async (userId, title, message, type) => {
  try {
    await Notification.create({
      userId: userId,
      title,
      message,
      type
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};
