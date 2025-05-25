import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export const useLocation = (enabled: boolean = true) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('位置情報の許可が拒否されました');
          setLoading(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (mounted) {
          setLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            accuracy: currentLocation.coords.accuracy || 0,
            timestamp: currentLocation.timestamp,
          });
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError('位置情報の取得に失敗しました');
          console.error('Location error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getLocation();

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return { location, error, loading };
};
