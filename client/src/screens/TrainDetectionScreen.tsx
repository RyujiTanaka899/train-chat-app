import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, fontSize } from '../styles/theme';
import { useTrainDetection } from '../hooks/useTrainDetection';
import SocketManager from '../services/socket/SocketManager';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'TrainDetection'>;
};

export default function TrainDetectionScreen({ navigation }: Props) {
  const [nickname, setNickname] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // 降車時のコールバック関数を定義（useCallbackで最適化）
  const handleTrainExit = useCallback(() => {
    console.log('🚪 handleTrainExit が呼び出されました');
    
    // Web環境とネイティブ環境の両方に対応
    const showExitDialog = () => {
      // チャットルームから退出
      SocketManager.disconnect();
      
      console.log('🚪 チャットルーム終了処理完了');
      
      // 前の画面に戻る
      navigation.goBack();
    };

    // Web環境での確認ダイアログ
    if (typeof window !== 'undefined' && window.confirm) {
      const userConfirmed = window.confirm(
        '降車を検知しました\n\n電車から降車したため、チャットルームを終了します。'
      );
      if (userConfirmed) {
        showExitDialog();
      }
    } else {
      // React Native環境
      try {
        Alert.alert(
          '降車を検知しました',
          '電車から降車したため、チャットルームを終了します。',
          [
            {
              text: 'OK',
              onPress: showExitDialog
            }
          ],
          { cancelable: false }
        );
      } catch (error) {
        console.error('Alert.alert エラー:', error);
        // アラートが失敗した場合は直接実行
        showExitDialog();
      }
    }
  }, [navigation]);

  // 降車コールバックを渡してフックを使用
  const { trainStatus, isDetecting, startDetection, stopDetection } = useTrainDetection(handleTrainExit);

  useEffect(() => {
    loadNicknameAndStart();
    return () => {
      stopDetection();
      // Socket接続は維持（チャット画面で使用するため）
      // SocketManager.disconnect(); // コメントアウト
    };
  }, []);

  useEffect(() => {
    if (trainStatus.isOnTrain && trainStatus.trainLine && !isConnecting) {
      connectToChat();
    }
  }, [trainStatus.isOnTrain, trainStatus.trainLine]);

  const loadNicknameAndStart = async () => {
    try {
      const saved = await AsyncStorage.getItem('nickname');
      if (saved) {
        setNickname(saved);
        await SocketManager.connect();
        const started = await startDetection();
        if (!started) {
          Alert.alert(
            'エラー',
            '位置情報の取得に失敗しました',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      }
    } catch (error) {
      console.error('Failed to load nickname:', error);
    }
  };

  const connectToChat = async () => {
    if (!trainStatus.trainLine || !nickname) return;

    setIsConnecting(true);
    try {
      // 路線名ベースの固定ルームIDを使用（タイムスタンプなし）
      const baseRoomId = `train_${trainStatus.trainLine}`;
      
      await SocketManager.joinRoom(
        baseRoomId,
        trainStatus.trainLine,
        nickname
      );

      navigation.replace('Chat', {
        roomId: baseRoomId,
        trainId: trainStatus.trainLine,
      });
    } catch (error) {
      Alert.alert('エラー', 'チャットルームへの接続に失敗しました');
      setIsConnecting(false);
    }
  };

  const handleCancel = () => {
    stopDetection();
    navigation.goBack();
  };

  // 速度に応じた表示色を決定
  const getSpeedColor = () => {
    if (trainStatus.speed >= 30) return colors.success; // 電車速度
    if (trainStatus.speed >= 15) return '#F59E0B'; // 中間速度（オレンジ色）
    return colors.text.secondary; // 徒歩速度
  };

  // 移動状態の表示テキスト
  const getMovementStatus = () => {
    if (trainStatus.speed >= 30) return '🚆 電車移動中';
    if (trainStatus.speed >= 15) return '🚌 乗り物移動中';
    if (trainStatus.speed >= 5) return '🚶 徒歩移動中';
    return '🛑 停止中';
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={60} color={colors.primary} />
          {isDetecting && (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loadingOverlay}
            />
          )}
        </View>

        <Text style={styles.title}>電車を検知中...</Text>
        <Text style={styles.subtitle}>
          電車に乗車すると自動的にチャットルームに接続されます
        </Text>

        <View style={styles.statusContainer}>
          <StatusItem
            icon="speedometer"
            label="速度"
            value={`${trainStatus.speed.toFixed(1)} km/h`}
            color={getSpeedColor()}
          />
          <StatusItem
            icon="train"
            label="路線"
            value={trainStatus.trainLine || '未検出'}
          />
          <StatusItem
            icon="walk"
            label="状態"
            value={getMovementStatus()}
          />
          <StatusItem
            icon="time"
            label="更新"
            value={new Date(trainStatus.lastUpdate).toLocaleTimeString('ja-JP')}
          />
        </View>

        {trainStatus.isOnTrain && (
          <View style={styles.detectedContainer}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={styles.detectedText}>
              {trainStatus.trainLine}を検出しました！
            </Text>
          </View>
        )}

        {/* 降車検知の説明 */}
        {trainStatus.isOnTrain && (
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              電車から降車すると自動的にチャットが終了します
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
        >
          <Text style={styles.cancelButtonText}>キャンセル</Text>
        </TouchableOpacity>

        {/* デモ用ボタン */}
        <TouchableOpacity
          style={styles.demoButton}
          onPress={() => {
            navigation.replace('Chat', {
              roomId: 'demo-room',
              trainId: 'demo-train',
            });
          }}
        >
          <Text style={styles.demoButtonText}>デモモードで開始</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const StatusItem = ({ 
  icon, 
  label, 
  value, 
  color = colors.text.primary 
}: { 
  icon: string; 
  label: string; 
  value: string; 
  color?: string;
}) => (
  <View style={styles.statusItem}>
    <Ionicons name={icon as any} size={20} color={colors.text.secondary} />
    <Text style={styles.statusLabel}>{label}</Text>
    <Text style={[styles.statusValue, { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  loadingOverlay: {
    position: 'absolute',
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  statusContainer: {
    backgroundColor: 'white',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  statusValue: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    fontWeight: '500',
  },
  detectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  detectedText: {
    color: colors.success,
    marginLeft: spacing.sm,
    fontWeight: '600',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xl,
  },
  infoText: {
    color: colors.primary,
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
  },
  cancelButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontSize: fontSize.base,
  },
  demoButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  demoButtonText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    textDecorationLine: 'underline',
  },
});