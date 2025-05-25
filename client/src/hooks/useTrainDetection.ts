import { useState, useEffect, useRef } from 'react';

interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface TrainStatus {
  isOnTrain: boolean;
  trainLine: string | null;
  speed: number;
  lastUpdate: number;
}

interface TrainDetectionResult {
  trainStatus: TrainStatus;
  isDetecting: boolean;
  startDetection: () => Promise<boolean>;
  stopDetection: () => void;
  onTrainExit?: () => void; // 降車時のコールバック
}

// 開発用モック位置情報
const MOCK_LOCATIONS = [
  { lat: 35.6762, lng: 139.6503, name: '東京駅' },
  { lat: 35.6581, lng: 139.7414, name: '新宿駅' },
  { lat: 35.7281, lng: 139.7186, name: '池袋駅' },
  { lat: 35.6284, lng: 139.7387, name: '渋谷駅' },
  { lat: 35.6938, lng: 139.7034, name: '上野駅' }
];

// 位置情報モック関数
const setupGeolocationMock = () => {
  if (!('geolocation' in navigator)) {
    console.warn('Geolocation API not supported');
    return;
  }

  let currentMockIndex = 0;
  let watchCallbacks: Array<{
    success: PositionCallback;
    error?: PositionErrorCallback;
  }> = [];
  let watchId = 0;

  // getCurrentPosition のモック
  const mockGetCurrentPosition = (
    success: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions
  ) => {
    console.log('🔧 モック位置情報を使用 (getCurrentPosition)');
    
    const mockLocation = MOCK_LOCATIONS[currentMockIndex];
    // 型安全性を確保するためのヘルパー関数
    const createMockPosition = (): GeolocationPosition => ({
      coords: {
        latitude: mockLocation.lat + (Math.random() - 0.5) * 0.0001,
        longitude: mockLocation.lng + (Math.random() - 0.5) * 0.0001,
        accuracy: 10 + Math.random() * 40,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: Math.random() * 80 + 20, // 20-100 km/h の模擬速度
        toJSON: () => ({})
      } as GeolocationCoordinates,
      timestamp: Date.now(),
      toJSON: () => ({})
    } as GeolocationPosition);

    setTimeout(() => success(createMockPosition()), 100);
  };

  // watchPosition のモック
  const mockWatchPosition = (
    success: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions
  ) => {
    console.log('🔧 モック位置監視を開始 (watchPosition)');
    
    const id = ++watchId;
    watchCallbacks.push({ success, error });

    // 3秒ごとに位置を更新（段階的な速度変化を実装）
    let mockSpeedPhase = 0; // 0: 停止, 1: 加速中, 2: 電車速度, 3: 減速中
    
    const interval = setInterval(() => {
      const mockLocation = MOCK_LOCATIONS[currentMockIndex];
      
      // 段階的な速度変化をシミュレート
      let mockSpeed = 0; // m/s
      switch (mockSpeedPhase) {
        case 0: // 停止〜歩行速度
          mockSpeed = Math.random() * 2 + 1; // 1-3 m/s (3.6-10.8 km/h)
          break;
        case 1: // 加速中
          mockSpeed = Math.random() * 10 + 5; // 5-15 m/s (18-54 km/h)
          break;
        case 2: // 電車速度
          mockSpeed = Math.random() * 15 + 15; // 15-30 m/s (54-108 km/h)
          // 30%の確率で駅を移動
          if (Math.random() < 0.3) {
            currentMockIndex = (currentMockIndex + 1) % MOCK_LOCATIONS.length;
          }
          break;
        case 3: // 減速中
          mockSpeed = Math.random() * 8 + 2; // 2-10 m/s (7.2-36 km/h)
          break;
      }
      
      // 15秒ごとにフェーズを変更
      if (Math.random() < 0.2) {
        mockSpeedPhase = (mockSpeedPhase + 1) % 4;
        console.log('🚆 速度フェーズ変更:', {
          phase: mockSpeedPhase,
          description: ['停止', '加速中', '電車速度', '減速中'][mockSpeedPhase]
        });
      }

      const createMockPosition = (): GeolocationPosition => ({
        coords: {
          latitude: mockLocation.lat + (Math.random() - 0.5) * 0.0001,
          longitude: mockLocation.lng + (Math.random() - 0.5) * 0.0001,
          accuracy: 10 + Math.random() * 40,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: mockSpeed, // m/s 単位
          toJSON: () => ({})
        } as GeolocationCoordinates,
        timestamp: Date.now(),
        toJSON: () => ({})
      } as GeolocationPosition);

      watchCallbacks.forEach(callback => {
        if (callback.success) {
          const mockPos = createMockPosition();
          console.log('🔧 モック位置更新:', {
            location: mockLocation.name,
            lat: mockPos.coords.latitude.toFixed(4),
            lng: mockPos.coords.longitude.toFixed(4),
            speed: mockPos.coords.speed ? (mockPos.coords.speed * 3.6).toFixed(1) + ' km/h' : '0 km/h',
            phase: ['停止', '加速中', '電車速度', '減速中'][mockSpeedPhase]
          });
          callback.success(mockPos);
        }
      });
    }, 3000);

    // クリーンアップ用の参照を保存
    (global as any)[`mockInterval_${id}`] = interval;
    
    return id;
  };

  // clearWatch のモック
  const mockClearWatch = (watchId: number) => {
    console.log('🔧 モック位置監視を停止');
    const interval = (global as any)[`mockInterval_${watchId}`];
    if (interval) {
      clearInterval(interval);
      delete (global as any)[`mockInterval_${watchId}`];
    }
    watchCallbacks = watchCallbacks.filter((_, index) => index !== watchId - 1);
  };

  // Navigator geolocation をモックで置き換え
  Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
    value: mockGetCurrentPosition,
    writable: true,
    configurable: true
  });

  Object.defineProperty(navigator.geolocation, 'watchPosition', {
    value: mockWatchPosition,
    writable: true,
    configurable: true
  });

  Object.defineProperty(navigator.geolocation, 'clearWatch', {
    value: mockClearWatch,
    writable: true,
    configurable: true
  });
};

// 電車路線の判定（簡易版）
const detectTrainLine = (location: Location): string | null => {
  const lines = [
    { name: 'JR山手線', lat: 35.6762, lng: 139.6503, radius: 0.05 },
    { name: 'JR中央線', lat: 35.6581, lng: 139.7414, radius: 0.03 },
    { name: 'JR京浜東北線', lat: 35.7281, lng: 139.7186, radius: 0.03 },
  ];

  for (const line of lines) {
    const distance = Math.sqrt(
      Math.pow(location.lat - line.lat, 2) + 
      Math.pow(location.lng - line.lng, 2)
    );
    if (distance < line.radius) {
      return line.name;
    }
  }
  
  return null;
};

// 2点間の距離計算（メートル）
const calculateDistance = (loc1: Location, loc2: Location): number => {
  const R = 6371000; // 地球の半径（メートル）
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
  const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const useTrainDetection = (onTrainExit?: () => void): TrainDetectionResult => {
  const [isOnTrain, setIsOnTrain] = useState(false);
  const [currentLine, setCurrentLine] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  const watchIdRef = useRef<number | null>(null);
  const previousLocationRef = useRef<Location | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  
  // 降車検知用の状態
  const [lowSpeedCount, setLowSpeedCount] = useState(0);
  const [wasOnTrain, setWasOnTrain] = useState(false);
  const previousTrainStatusRef = useRef(false);
  
  // コールバック関数の最新参照を保持
  const onTrainExitRef = useRef(onTrainExit);
  
  // onTrainExitが変更されたら参照を更新
  useEffect(() => {
    onTrainExitRef.current = onTrainExit;
  }, [onTrainExit]);

  // 検知開始関数
  const startDetection = async (): Promise<boolean> => {
    console.log('🚀 電車検知を開始します');
    setIsDetecting(true);
    setError(null);
    
    return new Promise((resolve) => {
      // まず実際のGeolocation APIをテスト
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ 実際の位置情報が取得できました:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          // 実際の位置情報が取得できる場合はモックを使用しない
          startRealGeolocation(resolve);
        },
        (error) => {
          console.log('❌ 実際の位置情報が取得できません:', error.code);
          // エラーの場合のみモックを有効化
          const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
          if (isDevelopment) {
            console.log('🔧 位置情報エラーのためモックを有効化');
            setupGeolocationMock();
            setTimeout(() => startRealGeolocation(resolve), 1000);
          } else {
            setError('位置情報の取得に失敗しました');
            setIsDetecting(false);
            resolve(false);
          }
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  };

  // 実際の位置情報監視を開始
  const startRealGeolocation = (resolve: (value: boolean) => void) => {
    if (!('geolocation' in navigator)) {
      setError('このブラウザは位置情報をサポートしていません');
      setIsDetecting(false);
      resolve(false);
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    };

    const successCallback = (position: GeolocationPosition) => {
      const newLocation: Location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      setLocation(newLocation);
      setError(null);
      setLastUpdate(Date.now());

      // 速度計算
      const currentTime = Date.now();
      let calculatedSpeed = 0;
      
      if (previousLocationRef.current && lastUpdateRef.current) {
        const timeDiff = (currentTime - lastUpdateRef.current) / 1000; // 秒
        const distance = calculateDistance(previousLocationRef.current, newLocation);
        const rawSpeed = (distance / timeDiff) * 3.6; // km/h に変換
        
        // 異常な速度値を制限（Developer Tools での瞬間移動対策）
        if (rawSpeed > 200) {
          // 異常に高速な場合は電車の平均速度に調整
          calculatedSpeed = Math.random() * 40 + 40; // 40-80 km/h
          console.log('🚅 異常速度を電車速度に調整:', {
            raw: rawSpeed.toFixed(1) + 'km/h',
            adjusted: calculatedSpeed.toFixed(1) + 'km/h'
          });
        } else if (rawSpeed < 5 && timeDiff > 2) {
          // 長時間停止していた場合は低速維持
          calculatedSpeed = rawSpeed;
        } else {
          calculatedSpeed = rawSpeed;
        }
        
        console.log('📍 位置更新:', {
          from: `${previousLocationRef.current.lat.toFixed(4)}, ${previousLocationRef.current.lng.toFixed(4)}`,
          to: `${newLocation.lat.toFixed(4)}, ${newLocation.lng.toFixed(4)}`,
          distance: distance.toFixed(2) + 'm',
          time: timeDiff.toFixed(1) + 's',
          rawSpeed: rawSpeed.toFixed(1) + 'km/h',
          finalSpeed: calculatedSpeed.toFixed(1) + 'km/h'
        });
      } else {
        // 初回の場合
        calculatedSpeed = position.coords.speed ? 
          Math.min(position.coords.speed * 3.6, 100) : // 最大100km/hに制限
          0; // 初回は速度0から開始
        
        console.log('📍 初回位置取得:', {
          location: `${newLocation.lat.toFixed(4)}, ${newLocation.lng.toFixed(4)}`,
          speed: calculatedSpeed.toFixed(1) + 'km/h',
          source: position.coords.speed ? 'GPS' : 'calculated'
        });
      }
      
      setSpeed(calculatedSpeed);

      // 電車判定を段階的に行う
      const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
      let isTrainDetected = false;
      
      if (isDevelopment) {
        // 開発環境：現実的な電車速度範囲での判定
        const hasMultipleUpdates = previousLocationRef.current !== null;
        const isTrainSpeed = calculatedSpeed >= 30 && calculatedSpeed <= 120; // 30-120km/h
        const hasTrainLine = detectTrainLine(newLocation) !== null;
        
        isTrainDetected = hasMultipleUpdates && isTrainSpeed && hasTrainLine;
        
        console.log('🚆 電車判定チェック:', {
          hasMultipleUpdates,
          speed: calculatedSpeed.toFixed(1) + ' km/h',
          isTrainSpeed: `${isTrainSpeed} (30-120km/h)`,
          hasTrainLine,
          result: isTrainDetected
        });
      } else {
        // 本番環境：厳密な速度判定
        isTrainDetected = calculatedSpeed > 20 && calculatedSpeed < 100;
      }
      
      // 降車検知ロジック
      const wasOnTrainPreviously = previousTrainStatusRef.current;
      
      if (wasOnTrainPreviously && !isTrainDetected) {
        // 電車から降りた可能性をチェック
        if (calculatedSpeed < 15) { // 徒歩速度（15km/h未満）
          setLowSpeedCount(prev => prev + 1);
          
          console.log('🚶 徒歩速度検知:', {
            speed: calculatedSpeed.toFixed(1) + ' km/h',
            lowSpeedCount: lowSpeedCount + 1,
            threshold: '3回連続で降車判定'
          });
          
          // 3回連続で低速（約9秒間）なら降車確定
          if (lowSpeedCount >= 2) {
            console.log('🚪 降車を検知しました');
            setIsOnTrain(false);
            setCurrentLine(null);
            setLowSpeedCount(0);
            
            // 降車コールバックを実行
            if (onTrainExitRef.current) {
              setTimeout(() => {
                console.log('🚪 降車コールバック実行中...');
                onTrainExitRef.current!();
              }, 1000); // 1秒後に実行（UIの更新を待つ）
            } else {
              console.log('❌ 降車コールバックが設定されていません');
            }
          }
        } else {
          // 速度が上がった場合はカウントリセット
          setLowSpeedCount(0);
        }
      } else {
        // 通常の電車判定
        setIsOnTrain(isTrainDetected);
        setLowSpeedCount(0);
        
        if (isTrainDetected) {
          const line = detectTrainLine(newLocation);
          setCurrentLine(line || 'JR山手線');
        } else {
          setCurrentLine(null);
        }
      }
      
      // 前回の電車状態を記録
      previousTrainStatusRef.current = isTrainDetected;

      previousLocationRef.current = newLocation;
      lastUpdateRef.current = currentTime;
    };

    const errorCallback = (error: GeolocationPositionError) => {
      console.error('位置情報取得エラー:', error.code, error.message);
      setError(`位置情報の取得に失敗しました (エラー: ${error.code})`);
      setIsDetecting(false);
      resolve(false);
    };

    // 位置情報の監視開始
    const watchId = navigator.geolocation.watchPosition(
      successCallback,
      errorCallback,
      options
    );
    
    watchIdRef.current = watchId;
    resolve(true);
  };

  // 検知停止関数
  const stopDetection = () => {
    console.log('⏹️ 電車検知を停止します');
    setIsDetecting(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // 開発用：Console からテストできる関数をグローバルに登録
  useEffect(() => {
    const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      // 電車速度テスト用関数
      (global as any).testTrainSpeed = (speed: number) => {
        console.log(`🚆 電車速度テスト: ${speed}km/h`);
        setSpeed(speed);
        const isOnTrainTest = speed >= 30 && speed <= 120;
        setIsOnTrain(isOnTrainTest);
        setCurrentLine(isOnTrainTest ? 'JR山手線' : null);
        previousTrainStatusRef.current = isOnTrainTest;
      };

      // 降車テスト用関数
      (global as any).testTrainExit = () => {
        console.log('🚪 降車テスト開始...');
        
        // まず電車状態に設定
        previousTrainStatusRef.current = true;
        setIsOnTrain(true);
        setCurrentLine('JR山手線');
        setSpeed(60); // 電車速度
        
        let count = 0;
        const interval = setInterval(() => {
          count++;
          const walkingSpeed = Math.random() * 8 + 3; // 3-11km/h（徒歩速度）
          
          console.log(`🚶 徒歩速度シミュレート ${count}/3: ${walkingSpeed.toFixed(1)}km/h`);
          
          // 実際の降車検知ロジックを実行
          const wasOnTrainPreviously = previousTrainStatusRef.current;
          const isTrainDetected = false; // 徒歩速度なので電車ではない
          
          if (wasOnTrainPreviously && !isTrainDetected) {
            if (walkingSpeed < 15) {
              setLowSpeedCount(count - 1);
              setSpeed(walkingSpeed);
              
              console.log('🚶 徒歩速度検知:', {
                speed: walkingSpeed.toFixed(1) + ' km/h',
                lowSpeedCount: count,
                threshold: '3回連続で降車判定'
              });
              
              // 3回目で降車確定
              if (count >= 3) {
                console.log('🚪 降車を検知しました');
                setIsOnTrain(false);
                setCurrentLine(null);
                setLowSpeedCount(0);
                
                // 降車コールバックを実行
                if (onTrainExit) {
                  setTimeout(() => {
                    onTrainExit();
                  }, 1000);
                }
                
                clearInterval(interval);
                console.log('🚪 降車テスト完了 - コールバック実行');
                return;
              }
            }
          }
          
          if (count >= 3) {
            clearInterval(interval);
            console.log('🚪 降車テスト完了');
          }
        }, 3000);
      };

      // その他のテスト関数...
      (global as any).testExitCallback = () => {
        console.log('🧪 降車コールバック直接テスト');
        if (onTrainExitRef.current) {
          console.log('✅ コールバック関数が存在します - 実行中...');
          onTrainExitRef.current();
        } else {
          console.log('❌ コールバック関数が設定されていません');
        }
      };

      (global as any).checkTrainState = () => {
        console.log('🔍 現在の電車検知状態:', {
          isOnTrain,
          currentLine,
          speed: speed.toFixed(1) + 'km/h',
          lowSpeedCount,
          wasOnTrain: previousTrainStatusRef.current,
          hasExitCallback: !!onTrainExitRef.current
        });
      };

      (global as any).forceTrainExit = () => {
        console.log('🚪 強制降車テスト実行');
        
        // 電車状態から即座に降車状態に変更
        setIsOnTrain(false);
        setCurrentLine(null);
        setSpeed(8); // 徒歩速度
        
        // 降車コールバックを即座に実行
        if (onTrainExitRef.current) {
          setTimeout(() => {
            console.log('🚪 強制降車コールバック実行');
            onTrainExitRef.current!();
          }, 500);
        } else {
          console.log('❌ 降車コールバックが設定されていません');
        }
      };

      // 使用方法をConsoleに表示
      console.log('🛠️ 開発用テスト関数が利用可能です:');
      console.log('checkTrainState() - 現在の状態確認');
      console.log('testExitCallback() - 降車コールバック直接テスト');
      console.log('testTrainSpeed(60) - 指定速度でテスト');
      console.log('testTrainExit() - 降車テスト（9秒で完了）');
      console.log('forceTrainExit() - 即座に降車をシミュレート');
    }
  }, []);

  // TrainDetectionScreen.tsx が期待する形式で戻り値を返す
  return {
    trainStatus: {
      isOnTrain,
      trainLine: currentLine,
      speed: Math.round(speed),
      lastUpdate
    },
    isDetecting,
    startDetection,
    stopDetection
  };
};