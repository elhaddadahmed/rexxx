import { Stack } from 'expo-router';

export default function EmployeeLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Zurück',
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'Übersicht' }} />
    </Stack>
  );
}
