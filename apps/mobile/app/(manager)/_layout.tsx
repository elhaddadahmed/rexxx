import { Stack } from 'expo-router';

export default function ManagerLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Zurück',
      }}
    >
      <Stack.Screen
        name="team-approvals"
        options={{ title: 'Team-Genehmigungen' }}
      />
    </Stack>
  );
}
