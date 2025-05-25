import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../styles/theme';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Welcome'>;
};

const { width } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleStart = () => {
    if (!hasPermission) {
      Alert.alert(
        '位置情報が必要です',
        '電車を検知するために位置情報の許可が必要です。',
        [{ text: 'OK', onPress: checkLocationPermission }]
      );
      return;
    }
    navigation.navigate('Nickname');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="train" size={80} color={colors.primary} />
        </View>

        <Text style={styles.title}>電車チャット</Text>
        <Text style={styles.subtitle}>
          同じ電車に乗っている人と{'\n'}匿名でチャットしよう！
        </Text>
        
        <View style={styles.features}>
          <FeatureItem icon="location" text="電車に乗っている時だけ使える" />
          <FeatureItem icon="person" text="完全匿名" />
          <FeatureItem icon="exit" text="電車を降りたら自動退出" />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            hasPermission === false && styles.buttonDisabled
          ]}
          onPress={handleStart}
          disabled={hasPermission === false}
        >
          <Text style={styles.buttonText}>はじめる</Text>
          <Ionicons name="arrow-forward" size={20} color="white" style={styles.buttonIcon} />
        </TouchableOpacity>

        {hasPermission === false && (
          <View style={styles.warningContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.warning}>位置情報の許可が必要です</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIconContainer}>
      <Ionicons name={icon as any} size={20} color={colors.success} />
    </View>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBF8FF',
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
    borderRadius: borderRadius.full,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  features: {
    marginBottom: spacing.xl,
    width: '100%',
    maxWidth: 300,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: 'white',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  featureText: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    flex: 1,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    justifyContent: 'center',
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
  },
  warning: {
    marginLeft: spacing.xs,
    color: colors.danger,
    fontSize: fontSize.xs,
  },
});