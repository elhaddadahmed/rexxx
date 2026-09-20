import { View, Text, SafeAreaView } from 'react-native';

export default function TeamApprovalsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl font-semibold">Team-Genehmigungen</Text>
        <Text className="text-sm text-gray-500 mt-2">
          (Phase 3: Zeiterfassung & Urlaubsgenehmigungen)
        </Text>
      </View>
    </SafeAreaView>
  );
}
