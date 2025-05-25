import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_EVENTS } from '@train-chat/shared/dist/constants';

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  message: string;
  timestamp: Date;
}

export interface RoomInfo {
  roomId: string;
  trainId: string;
  trainLine: string;
  users: string[];
}

class SocketManager {
  private socket: Socket | null = null;
  private serverUrl: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  private listeners: Map<string, Function[]> = new Map();
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    const userId = await this.getUserId();
    this.currentUserId = userId;

    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
      query: {
        userId,
      },
    });

    this.setupEventHandlers();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.currentRoomId = null;
  }

  private async getUserId(): Promise<string> {
    let userId = await AsyncStorage.getItem('userId');
    if (!userId) {
      // より一意性の高いIDを生成
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random() * 10000)}`;
      await AsyncStorage.setItem('userId', userId);
    }
    
    // 開発環境では各アプリ起動で異なるIDを使用
    if (process.env.NODE_ENV === 'development') {
      // AsyncStorageを使用してセッション固有のIDを管理
      let sessionId = await AsyncStorage.getItem('sessionId');
      if (!sessionId) {
        sessionId = `session_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('sessionId', sessionId);
      }
      userId = `${userId}_${sessionId}`;
      
      console.log('🆔 開発環境用ユーザーID生成:', userId);
    }
    
    return userId;
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.emit('connected', true);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.emit('connected', false);
    });

    this.socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (message: ChatMessage) => {
      console.log('📨 メッセージ受信:', message);
      this.emit('message', message);
    });

    this.socket.on(SOCKET_EVENTS.USER_JOINED, (data: { userId: string; nickname: string }) => {
      console.log('👋 ユーザー参加:', data);
      this.emit('userJoined', data);
    });

    this.socket.on(SOCKET_EVENTS.USER_LEFT, (data: { userId: string; nickname: string }) => {
      console.log('👋 ユーザー退出:', data);
      this.emit('userLeft', data);
    });

    this.socket.on('roomUpdate', (roomInfo: RoomInfo) => {
      console.log('🚆 ルーム情報更新:', roomInfo);
      this.emit('roomUpdate', roomInfo);
    });

    this.socket.on('forceLeave', (data: { reason?: string }) => {
      console.log('🚪 強制退出:', data);
      this.emit('forceLeave', data);
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
      this.emit('error', error);
    });
  }

  // イベントリスナーの登録
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // イベントリスナーの削除
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // イベントの発火
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // ChatScreen用の便利なメソッド群
  onConnect(callback: () => void): void {
    // 既に接続済みの場合は即座にコールバック実行
    if (this.isConnected()) {
      callback();
    }
    
    this.on('connected', (isConnected: boolean) => {
      if (isConnected) callback();
    });
  }

  onDisconnect(callback: () => void): void {
    this.on('connected', (isConnected: boolean) => {
      if (!isConnected) callback();
    });
  }

  onMessage(callback: (data: any) => void): void {
    this.on('message', callback);
  }

  onUserJoined(callback: (data: any) => void): void {
    this.on('userJoined', callback);
  }

  onUserLeft(callback: (data: any) => void): void {
    this.on('userLeft', callback);
  }

  onRoomUpdate(callback: (data: any) => void): void {
    this.on('roomUpdate', callback);
  }

  onForceLeave(callback: (data: any) => void): void {
    this.on('forceLeave', callback);
  }

  // サーバーへのイベント送信
  async joinRoom(roomId: string, trainLine: string, nickname: string): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    this.currentRoomId = roomId;

    console.log('🚆 ルーム参加要求:', { roomId, trainLine, nickname });

    this.socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
      roomId,
      trainId: roomId, // roomIdとtrainIdを同じにする
      trainLine,
      nickname,
    });
  }

  leaveRoom(roomId?: string): void {
    if (!this.socket?.connected) return;

    const targetRoomId = roomId || this.currentRoomId;
    if (!targetRoomId) return;

    console.log('🚪 ルーム退出:', targetRoomId);

    this.socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId: targetRoomId });
    this.currentRoomId = null;
  }

  sendMessage(messageData: {
    id: string;
    text: string;
    nickname: string;
    timestamp: Date;
    roomId: string;
  }): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    console.log('📤 メッセージ送信:', messageData);

    this.socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
      roomId: messageData.roomId,
      message: messageData.text,
      nickname: messageData.nickname,
      timestamp: messageData.timestamp,
    });
  }

  updateNickname(nickname: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit(SOCKET_EVENTS.UPDATE_NICKNAME, { nickname });
  }

  // 電車検知の通知
  notifyTrainDetected(trainId: string, trainLine: string, location: any): void {
    if (!this.socket?.connected) return;

    this.socket.emit(SOCKET_EVENTS.TRAIN_DETECTED, {
      trainId,
      trainLine,
      location,
    });
  }

  notifyTrainLeft(): void {
    if (!this.socket?.connected) return;

    this.socket.emit(SOCKET_EVENTS.TRAIN_LEFT, {});
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  // デバッグ用メソッド
  getConnectionStatus(): {
    isConnected: boolean;
    currentRoomId: string | null;
    currentUserId: string | null;
    serverUrl: string;
  } {
    return {
      isConnected: this.isConnected(),
      currentRoomId: this.currentRoomId,
      currentUserId: this.currentUserId,
      serverUrl: this.serverUrl,
    };
  }
}

export default new SocketManager();