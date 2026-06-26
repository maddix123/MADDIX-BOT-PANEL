import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function setupSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.username}`);
    socket.join(`user:${socket.user._id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.username}`);
    });
  });
}
