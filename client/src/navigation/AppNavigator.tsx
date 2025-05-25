import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import NicknameScreen from '../screens/NicknameScreen';
import TrainDetectionScreen from '../screens/TrainDetectionScreen';
import ChatScreen from '../screens/ChatScreen';
import { colors } from '../styles/theme';

export type RootStackParamList = {
  Welcome: undefined;
  Nickname: undefined;
  TrainDetection: undefined;
  Chat: { roomId: string; trainId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Welcome"
        screenOptions={{
          headerStyle: {
            backgroundColor: 'white',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTintColor: colors.text.primary,
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        <Stack.Screen 
          name="Welcome" 
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Nickname" 
          component={NicknameScreen}
          options={{ 
            title: 'ニックネーム設定',
            headerBackTitle: '戻る',
          }}
        />
        <Stack.Screen 
          name="TrainDetection" 
          component={TrainDetectionScreen}
          options={{ 
            title: '電車検知中',
            headerBackTitle: '戻る',
          }}
        />
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen}
          options={{ 
            headerShown: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
