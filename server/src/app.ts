import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// 環境変数の読み込み
dotenv.config();

console.log('🔧 Server starting...');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);

// Expressアプリケーションの作成
const app = express();
console.log('✅ Express app created');

const httpServer = createServer(app);
console.log('✅ HTTP server created');

// Socket.IOサーバーの作成
let io: Server;
try {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    allowEIO3: true
  });
  console.log('✅ Socket.IO server created');
} catch (error) {
  console.error('❌ Socket.IO creation failed:', error);
  process.exit(1);
}

// 型定義
interface User {
  id: string;
  socketId: string;
  nickname: string;
  roomId: string | null;
  joinedAt: Date;
}

interface Room {
  id: string;
  trainLine: string;
  users: Map<string, User>;
  messages: Message[];
  createdAt: Date;
}

interface Message {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  text: string;
  timestamp: Date;
}

// Socket.IOイベント定数
const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  ROOM_UPDATE: 'roomUpdate',
  SEND_MESSAGE: 'sendMessage',
  RECEIVE_MESSAGE: 'receiveMessage',
  USER_JOINED: 'userJoined',
  USER_LEFT: 'userLeft',
  UPDATE_NICKNAME: 'updateNickname',
  TRAIN_DETECTED: 'trainDetected',
  TRAIN_LEFT: 'trainLeft',
  FORCE_LEAVE: 'forceLeave',
  ERROR: 'error',
} as const;

// メモリ内データストア
const users = new Map<string, User>();
const rooms = new Map<string, Room>();

// ミドルウェアの設定
app.use(helmet());
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

console.log('✅ Middleware configured');

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stats: {
      connectedUsers: users.size,
      activeRooms: rooms.size,
      socketIOReady: !!io
    }
  });
});

// Socket.IOテストエンドポイント
app.get('/socket-test', (req, res) => {
  res.json({ 
    message: 'Socket.IO server is ready',
    engineReady: !!io.engine,
    clientsCount: io.engine ? io.engine.clientsCount : 0
  });
});

console.log('✅ Routes configured');

// ユーティリティ関数
function createRoom(roomId: string, trainLine: string): Room {
  const room: Room = {
    id: roomId,
    trainLine,
    users: new Map(),
    messages: [],
    createdAt: new Date()
  };
  rooms.set(roomId, room);
  console.log(`🚆 新しいルーム作成: ${roomId} (${trainLine})`);
  return room;
}

function deleteRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room && room.users.size === 0) {
    rooms.delete(roomId);
    console.log(`🗑️ 空のルーム削除: ${roomId}`);
  }
}

function broadcastToRoom(roomId: string, event: string, data: any, excludeSocketId?: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.users.forEach(user => {
    if (user.socketId !== excludeSocketId) {
      io.to(user.socketId).emit(event, data);
    }
  });
}

function getRoomUsers(roomId: string): Array<{id: string; nickname: string}> {
  const room = rooms.get(roomId);
  if (!room) return [];
  
  return Array.from(room.users.values()).map(user => ({
    id: user.id,
    nickname: user.nickname
  }));
}

// Socket.IOイベントハンドラ
try {
  io.on('connection', (socket) => {
    console.log('🔌 新しいクライアント接続:', socket.id);
    console.log('🔌 接続元IP:', socket.handshake.address);

    // 接続テスト用イベント
    socket.emit('connected', { message: 'Socket.IO connection successful' });

    // 以下、既存のイベントハンドラーを簡略化してテスト
    socket.on('disconnect', () => {
      console.log('🔌 クライアント切断:', socket.id);
    });

    // テスト用のpingイベント
    socket.on('ping', (callback) => {
      console.log('🏓 Ping received from:', socket.id);
      if (callback) callback({ message: 'pong' });
    });
  });
  console.log('✅ Socket.IO event handlers configured');
} catch (error) {
  console.error('❌ Socket.IO event handler setup failed:', error);
}

// エラーハンドリングミドルウェア
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Express error:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// サーバーの起動
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

console.log(`🚀 Starting server on ${HOST}:${PORT}...`);

const server = httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:8081'}`);
  console.log(`🔌 Socket.IO ready on http://${HOST}:${PORT}/socket.io/`);
  console.log(`🧪 Test endpoints:`);
  console.log(`   - Health: http://${HOST}:${PORT}/health`);
  console.log(`   - Socket Test: http://${HOST}:${PORT}/socket-test`);
});

server.on('error', (err) => {
  console.error('❌ Server startup error:', err);
});

export default app;