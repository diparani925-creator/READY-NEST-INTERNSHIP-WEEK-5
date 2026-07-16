import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import prisma from './config/db';
import { initSocket } from './config/socket';

const PORT = process.env.PORT || 5000;

// Wrap Express app in HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

server.listen(PORT, () => {
  console.log(`[Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

const gracefulShutdown = async () => {
  console.log('[Server] Graceful shutdown initiated.');
  server.close(async () => {
    console.log('[Server] Server closed.');
    await prisma.$disconnect();
    console.log('[Server] Database client disconnected.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
