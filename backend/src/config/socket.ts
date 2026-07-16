import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import * as cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
}

interface SocketData {
  user: JwtPayload;
}

// In-memory mapping to track online users: tenantId -> Map<userId, Set<socketId>>
const onlinePresence = new Map<string, Map<string, Set<string>>>();

let io: SocketServer | null = null;

export const initSocket = (server: HttpServer): SocketServer => {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
  });

  // Socket authentication middleware via access_token cookie
  io.use((socket: Socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) {
        return next(new Error('Authentication failed: cookies missing'));
      }

      const cookies = (cookie as any).parseCookie(cookieHeader);
      const token = cookies.access_token;

      if (!token) {
        return next(new Error('Authentication failed: access_token cookie missing'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-change-in-production'
      ) as JwtPayload;

      socket.data = { user: decoded } as SocketData;
      next();
    } catch (error) {
      console.error('[SocketAuthError]', error);
      return next(new Error('Authentication failed: invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as SocketData).user;
    const { tenantId, id: userId } = user;
    const roomName = `tenant:${tenantId}`;

    // Join tenant-specific room for notifications & page state refreshes
    socket.join(roomName);

    // Track presence
    if (!onlinePresence.has(tenantId)) {
      onlinePresence.set(tenantId, new Map<string, Set<string>>());
    }

    const tenantMap = onlinePresence.get(tenantId)!;
    if (!tenantMap.has(userId)) {
      tenantMap.set(userId, new Set<string>());
    }
    tenantMap.get(userId)!.add(socket.id);

    // Broadcast presence update (updated list of online user IDs)
    broadcastPresence(tenantId);

    socket.on('disconnect', () => {
      const tMap = onlinePresence.get(tenantId);
      if (tMap) {
        const socketSet = tMap.get(userId);
        if (socketSet) {
          socketSet.delete(socket.id);
          if (socketSet.size === 0) {
            tMap.delete(userId);
          }
        }
        if (tMap.size === 0) {
          onlinePresence.delete(tenantId);
        }
      }
      broadcastPresence(tenantId);
    });
  });

  return io;
};

const broadcastPresence = (tenantId: string) => {
  if (!io) return;
  const tenantMap = onlinePresence.get(tenantId);
  const onlineUserIds = tenantMap ? Array.from(tenantMap.keys()) : [];
  io.to(`tenant:${tenantId}`).emit('PRESENCE_CHANGE', { onlineUserIds });
};

export const broadcastToTenant = (tenantId: string, event: string, data: any) => {
  if (io) {
    io.to(`tenant:${tenantId}`).emit(event, data);
  }
};

export const getOnlineUsers = (tenantId: string): string[] => {
  const tenantMap = onlinePresence.get(tenantId);
  return tenantMap ? Array.from(tenantMap.keys()) : [];
};
