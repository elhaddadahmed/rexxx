import { View, Text, SafeAreaView } from 'react-native';

export default function DashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl font-semibold">Willkommen</Text>
        <Text className="text-sm text-gray-500 mt-2">(Phase 3: Dashboard-Inhalte)</Text>
      </View>
    </SafeAreaView>
  );
}
