import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../styles/theme';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Nickname'>;
};

export default function NicknameScreen({ navigation }: Props) {
  const [nickname, setNickname] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    
    if (trimmed.length === 0) {
      Alert.alert('エラー', 'ニックネームを入力してください');
      return;
    }
    
    if (trimmed.length > 20) {
      Alert.alert('エラー', 'ニックネームは20文字以内で入力してください');
      return;
    }

    try {
      await AsyncStorage.setItem('nickname', trimmed);
      
      // TODO: 電車検知を開始
      navigation.navigate('TrainDetection');// navigation.navigate('Chat', {
        // roomId: 'test-room',
        // trainId: 'test-train'
      // });
    } catch (error) {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  const isValid = nickname.trim().length > 0 && nickname.trim().length <= 20;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.headerSection}>
            <View style={styles.iconContainer}>
              <Ionicons name="person-circle" size={60} color={colors.primary} />
            </View>
            <Text style={styles.title}>ニックネームを決めよう</Text>
            <Text style={styles.subtitle}>
              チャットで表示される名前です
            </Text>
          </View>

          <View style={styles.inputSection}>
            <View style={[
              styles.inputContainer,
              isFocused && styles.inputContainerFocused
            ]}>
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="例：通勤戦士"
                placeholderTextColor={colors.text.light}
                maxLength={20}
                autoFocus
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
              <Text style={[
                styles.counter,
                nickname.length > 15 && styles.counterWarning
              ]}>
                {nickname.length}/20
              </Text>
            </View>

            <View style={styles.suggestions}>
              <Text style={styles.suggestionTitle}>例：</Text>
              {['通勤戦士', '電車旅人', 'コーヒー好き'].map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionChip}
                  onPress={() => setNickname(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, !isValid && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid}
          >
            <Text style={styles.buttonText}>決定</Text>
            <Ionicons 
              name="checkmark-circle" 
              size={20} 
              color="white" 
              style={styles.buttonIcon} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
  },
  inputSection: {
    flex: 1,
  },
  inputContainer: {
    backgroundColor: 'white',
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text.primary,
  },
  counter: {
    fontSize: fontSize.sm,
    color: colors.text.light,
  },
  counterWarning: {
    color: '#F59E0B',
  },
  suggestions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  suggestionTitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  suggestionChip: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  suggestionText: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: colors.text.light,
    shadowOpacity: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: spacing.sm,
  },
});
