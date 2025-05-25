import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, fontSize } from '../styles/theme';
import SocketManager from '../services/socket/SocketManager';

type Props = {
  route: RouteProp<RootStackParamList, 'Chat'>;
  navigation: StackNavigationProp<RootStackParamList, 'Chat'>;
};

interface Message {
  id: string;
  text: string;
  userId: string;
  nickname: string;
  timestamp: Date;
  isOwn: boolean;
  isSystem?: boolean;
}

interface User {
  id: string;
  nickname: string;
}

const { width } = Dimensions.get('window');

export default function ChatScreen({ route, navigation }: Props) {
  const { roomId, trainId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [nickname, setNickname] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadNickname();
    setupSocketListeners();
    
    // Socket接続の確保
    const ensureConnection = async () => {
      if (!SocketManager.isConnected()) {
        try {
          await SocketManager.connect();
          console.log('🔄 チャット画面でSocket再接続しました');
        } catch (error) {
          console.error('Socket接続エラー:', error);
        }
      }
    };
    
    ensureConnection();
    
    // デバッグ用のグローバル関数を追加
    if (process.env.NODE_ENV === 'development') {
      (window as any).chatDebug = {
        socketStatus: () => SocketManager.getConnectionStatus(),
        isConnected: () => SocketManager.isConnected(),
        forceConnect: () => setIsConnected(true),
        forceDisconnect: () => setIsConnected(false),
        sendTestMessage: () => {
          if (SocketManager.isConnected()) {
            const actualRoomId = SocketManager.getCurrentRoomId() || roomId;
            
            console.log('🧪 テストメッセージ送信:', {
              originalRoomId: roomId,
              actualRoomId: actualRoomId,
              nickname: nickname || 'テストユーザー'
            });
            
            SocketManager.sendMessage({
              id: Date.now().toString(),
              text: 'テストメッセージ',
              nickname: nickname || 'テストユーザー',
              timestamp: new Date(),
              roomId: actualRoomId // 実際のルームIDを使用
            });
          } else {
            console.log('❌ Socket未接続のためメッセージ送信できません');
          }
        },
        reconnect: async () => {
          try {
            await SocketManager.connect();
            console.log('🔄 手動再接続完了');
          } catch (error) {
            console.error('再接続エラー:', error);
          }
        }
      };
      
      console.log('🛠️ チャットデバッグ関数が利用可能です:');
      console.log('chatDebug.socketStatus() - Socket状態確認');
      console.log('chatDebug.isConnected() - 接続状態確認');  
      console.log('chatDebug.forceConnect() - 強制接続状態');
      console.log('chatDebug.reconnect() - Socket再接続');
      console.log('chatDebug.sendTestMessage() - テストメッセージ送信');
    }
    
    return () => {
      // チャット画面のクリーンアップではSocketを切断しない
      console.log('💬 チャット画面をクリーンアップ（Socket接続は維持）');
      // SocketManager.disconnect(); // コメントアウト
    };
  }, []);

  const loadNickname = async () => {
    try {
      const saved = await AsyncStorage.getItem('nickname');
      if (saved) setNickname(saved);
    } catch (error) {
      console.error('Failed to load nickname:', error);
    }
  };

  const setupSocketListeners = () => {
    // 接続状態の監視
    SocketManager.onConnect(() => {
      console.log('💬 チャットルームに接続しました');
      setIsConnected(true);
    });

    SocketManager.onDisconnect(() => {
      console.log('💬 チャットルームから切断されました');
      setIsConnected(false);
    });

    // 初期接続状態の確認
    if (SocketManager.isConnected()) {
      console.log('💬 既に接続済みです');
      setIsConnected(true);
    }

    // メッセージ受信
    SocketManager.onMessage((data: any) => {
      console.log('📨 メッセージ受信:', data);
      const message: Message = {
        id: data.id || Date.now().toString(),
        text: data.text,
        userId: data.userId,
        nickname: data.nickname,
        timestamp: new Date(data.timestamp),
        isOwn: false, // 受信メッセージは自分のものではない
      };
      setMessages(prev => [...prev, message]);
    });

    // ユーザー参加通知
    SocketManager.onUserJoined((data: any) => {
      console.log('👋 ユーザー参加:', data);
      addSystemMessage(`${data.nickname}さんが参加しました`);
      
      // オンラインユーザーリストを更新
      setOnlineUsers(prev => {
        const existing = prev.find(user => user.id === data.userId);
        if (!existing) {
          return [...prev, { id: data.userId, nickname: data.nickname }];
        }
        return prev;
      });
    });

    // ユーザー退出通知
    SocketManager.onUserLeft((data: any) => {
      console.log('👋 ユーザー退出:', data);
      addSystemMessage(`${data.nickname}さんが退出しました`);
      
      // オンラインユーザーリストから削除
      setOnlineUsers(prev => prev.filter(user => user.id !== data.userId));
    });

    // ルーム情報更新
    SocketManager.onRoomUpdate((data: any) => {
      console.log('🚆 ルーム情報更新:', data);
      setOnlineUsers(data.users || []);
    });

    // 強制退出（電車から降車）
    SocketManager.onForceLeave((data: any) => {
      console.log('🚪 強制退出:', data);
      Alert.alert(
        '降車を検知しました',
        data.reason || '電車から降車したため、チャットルームを終了します。',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ],
        { cancelable: false }
      );
    });
  };

  const addSystemMessage = (text: string) => {
    const message: Message = {
      id: Date.now().toString(),
      text,
      userId: 'system',
      nickname: 'システム',
      timestamp: new Date(),
      isOwn: false,
      isSystem: true,
    };
    setMessages(prev => [...prev, message]);
  };

  const sendMessage = () => {
    if (!inputText.trim() || !isConnected) return;

    // SocketManagerから実際のルームIDを取得
    const actualRoomId = SocketManager.getCurrentRoomId() || roomId;

    const messageData = {
      id: Date.now().toString(),
      text: inputText.trim(),
      nickname: nickname,
      timestamp: new Date(),
      roomId: actualRoomId // 実際のルームIDを使用
    };

    console.log('📤 メッセージ送信準備:', {
      originalRoomId: roomId,
      actualRoomId: actualRoomId,
      text: messageData.text,
      nickname: messageData.nickname
    });

    // 自分のメッセージをすぐに表示
    const ownMessage: Message = {
      ...messageData,
      userId: 'self',
      isOwn: true,
    };
    setMessages(prev => [...prev, ownMessage]);
    setInputText('');

    // サーバーに送信
    SocketManager.sendMessage(messageData);
  };

  const handleExit = () => {
    Alert.alert(
      '電車を降りますか？',
      'チャットルームから退出します',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '降りる',
          style: 'destructive',
          onPress: () => {
            SocketManager.leaveRoom(roomId);
            SocketManager.disconnect();
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleKeyPress = (e: any) => {
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.text}</Text>
          <Text style={styles.systemMessageTime}>
            {item.timestamp.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      );
    }

    return (
      <View style={[
        styles.messageRow,
        item.isOwn ? styles.messageRowOwn : styles.messageRowOther
      ]}>
        <View style={[
          styles.messageBubble,
          item.isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther
        ]}>
          {!item.isOwn && (
            <Text style={styles.messageNickname}>{item.nickname}</Text>
          )}
          <Text style={[
            styles.messageText,
            item.isOwn ? styles.messageTextOwn : styles.messageTextOther
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.messageTime,
            item.isOwn ? styles.messageTimeOwn : styles.messageTimeOther
          ]}>
            {item.timestamp.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.trainInfo}>
            <Ionicons name="train" size={20} color={colors.primary} />
            <Text style={styles.trainName}>{trainId || '山手線'}</Text>
          </View>
          <View style={styles.connectionStatus}>
            <View style={[
              styles.statusDot,
              isConnected ? styles.statusDotOnline : styles.statusDotOffline
            ]} />
            <Text style={styles.statusText}>
              {isConnected ? '接続中' : 'オフライン'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
          <Ionicons name="exit-outline" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* オンラインユーザー */}
      <View style={styles.onlineUsersContainer}>
        <Ionicons name="people" size={16} color={colors.text.secondary} />
        <Text style={styles.onlineUsersText}>
          {onlineUsers.length}人が乗車中
        </Text>
        <View style={styles.userChips}>
          {onlineUsers.slice(0, 3).map((user, index) => (
            <View key={user.id || index} style={styles.userChip}>
              <Text style={styles.userChipText}>{user.nickname}</Text>
            </View>
          ))}
          {onlineUsers.length > 3 && (
            <Text style={styles.moreUsers}>+{onlineUsers.length - 3}</Text>
          )}
        </View>
      </View>

      {/* 接続状態の警告 */}
      {!isConnected && (
        <View style={styles.disconnectedBanner}>
          <Ionicons name="warning" size={16} color={colors.danger} />
          <Text style={styles.disconnectedText}>
            接続が切断されました。メッセージを送信できません。
          </Text>
        </View>
      )}

      {/* メッセージリスト */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        showsVerticalScrollIndicator={false}
      />

      {/* 入力エリア */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.textInput,
                !isConnected && styles.textInputDisabled
              ]}
              value={inputText}
              onChangeText={setInputText}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "メッセージを入力..." : "接続中..."}
              placeholderTextColor={colors.text.light}
              multiline
              maxLength={200}
              editable={isConnected}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || !isConnected) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || !isConnected}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={(!inputText.trim() || !isConnected) ? colors.text.light : "white"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  trainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  trainName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginLeft: spacing.xs,
    color: colors.text.primary,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusDotOnline: {
    backgroundColor: colors.success,
  },
  statusDotOffline: {
    backgroundColor: colors.offline,
  },
  statusText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  exitButton: {
    padding: spacing.sm,
  },
  onlineUsersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  onlineUsersText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
    marginRight: spacing.sm,
  },
  userChips: {
    flexDirection: 'row',
    flex: 1,
  },
  userChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginRight: spacing.xs,
  },
  userChipText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  moreUsers: {
    fontSize: fontSize.xs,
    color: colors.text.light,
    alignSelf: 'center',
  },
  disconnectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  disconnectedText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    marginLeft: spacing.xs,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  systemMessageText: {
    fontSize: fontSize.xs,
    color: colors.text.light,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  systemMessageTime: {
    fontSize: 10,
    color: colors.text.light,
    marginTop: 2,
  },
  messageRow: {
    marginVertical: spacing.xs,
  },
  messageRowOwn: {
    alignItems: 'flex-end',
  },
  messageRowOther: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: width * 0.75,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageNickname: {
    fontSize: fontSize.xs,
    color: colors.primary,
    marginBottom: 2,
    fontWeight: '500',
  },
  messageText: {
    fontSize: fontSize.base,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: 'white',
  },
  messageTextOther: {
    color: colors.text.primary,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 2,
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  messageTimeOther: {
    color: colors.text.light,
  },
  inputContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    maxHeight: 100,
    marginRight: spacing.sm,
    backgroundColor: colors.background,
  },
  textInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: colors.text.light,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.text.light,
  },
});