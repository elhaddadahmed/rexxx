import { Stack } from 'expo-router';

/**
 * Root Layout für Mobile-App (Expo Router).
 * Phase 3 wird mit echtem Auth-Flow erweitert.
 */

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="(auth)" options={{ animationEnabled: false }} />
      <Stack.Screen name="(employee)" />
      <Stack.Screen name="(manager)" />
    </Stack>
  );
}
