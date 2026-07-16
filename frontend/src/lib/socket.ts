import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (typeof window === 'undefined') {
    // Return a stub during Server-Side Rendering (SSR)
    return {} as Socket;
  }

  if (!socket) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    socket = io(backendUrl, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  return socket;
};
