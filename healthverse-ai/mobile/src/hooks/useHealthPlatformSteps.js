import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Requires a custom Expo dev client, NOT Expo Go - these packages contain
// native code Expo Go doesn't bundle. See mobile/README.md's wearable
// sync section for the full activation steps (app.json plugin config,
// AndroidManifest.xml/MainActivity.kt changes for Android, Xcode
// HealthKit capability for iOS). UNTESTED - no native build tooling in
// my sandbox to verify any of this against a real device.
//
// Until that dev-client switch happens, this hook safely no-ops: returns
// available:false rather than crashing, so it's safe to import even
// before the native setup is done.
export function useHealthPlatformSteps() {
  const [available, setAvailable] = useState(false);
  const [steps, setSteps] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          // npm install react-native-health-connect
          const HealthConnect = require('react-native-health-connect');
          const isInitialized = await HealthConnect.initialize();
          if (!isInitialized) {
            setError('Health Connect not installed on this device - available on the Play Store.');
            return;
          }
          const granted = await HealthConnect.requestPermission([
            { accessType: 'read', recordType: 'Steps' },
          ]);
          if (!granted.length) {
            setError('Health Connect permission not granted.');
            return;
          }
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const { records } = await HealthConnect.readRecords('Steps', {
            timeRangeFilter: { operator: 'after', startTime: midnight.toISOString() },
          });
          const total = records.reduce((sum, r) => sum + (r.count ?? 0), 0);
          setSteps(total);
          setAvailable(true);
        } else if (Platform.OS === 'ios') {
          // yarn add @kingstinct/react-native-healthkit react-native-nitro-modules
          const { useMostRecentQuantitySample } = require('@kingstinct/react-native-healthkit');
          // Real usage is a hook called at component top level, not inside
          // an effect - this branch is a placeholder showing the intended
          // shape; wire useMostRecentQuantitySample('HKQuantityTypeIdentifierStepCount')
          // directly in the component that needs it, same pattern as the
          // Android branch above once you're in a dev client.
          setError('iOS HealthKit wiring sketched but not completed - see comment above.');
        } else {
          setError('Not available on this platform.');
        }
      } catch (e) {
        setError(String(e?.message ?? e));
      }
    })();
  }, []);

  return { available, steps, error };
}
