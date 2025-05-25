// shared/src/constants/socketEvents.ts
export const SOCKET_EVENTS = {
  // 接続関連
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // ルーム関連
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  ROOM_UPDATE: 'roomUpdate',
  
  // メッセージ関連
  SEND_MESSAGE: 'sendMessage',
  RECEIVE_MESSAGE: 'receiveMessage',
  
  // ユーザー関連
  USER_JOINED: 'userJoined',
  USER_LEFT: 'userLeft',
  UPDATE_NICKNAME: 'updateNickname',
  
  // 電車検知関連
  TRAIN_DETECTED: 'trainDetected',
  TRAIN_LEFT: 'trainLeft',
  
  // システム関連
  FORCE_LEAVE: 'forceLeave',
  ERROR: 'error',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];