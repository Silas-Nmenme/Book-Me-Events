const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('./emailClient');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[character]));

async function createNotification({
  recipientId,
  type,
  title,
  message,
  link,
  entityType,
  entityId,
  io,
  email = false,
}) {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      type,
      title,
      message,
      link,
      entityType,
      entityId,
    });

    const payload = notification.toObject();
    if (io) io.to(`user:${recipientId}`).emit('notification:new', payload);

    if (email) {
      const recipient = await User.findById(recipientId).select('email firstName');
      if (recipient?.email) {
        await sendEmail({
          to: recipient.email,
          subject: title,
          text: message,
          html: `<p>${escapeHtml(message)}</p>`,
        });
      }
    }

    return payload;
  } catch (error) {
    console.error('Notification delivery failed:', error?.message || error);
    return null;
  }
}

module.exports = { createNotification };
