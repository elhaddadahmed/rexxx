import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema } from '@novaro/shared-validation';
import type { LoginInput } from '@novaro/shared-validation';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleLogin = async () => {
    setValidationError(null);

    // Validierung
    const validation = loginSchema.safeParse(formData);
    if (!validation.success) {
      setValidationError(validation.error.errors[0]?.message || 'Validierungsfehler');
      return;
    }

    try {
      await login(formData.email, formData.password);
      // Router navigiert via onAuthStateChange
      router.push('/(employee)/dashboard');
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const errorMessage = error || validationError;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center px-6">
        <Text className="text-4xl font-bold text-center mb-2">Novaro HR</Text>
        <Text className="text-sm text-center text-gray-500 mb-8">Anmelden</Text>

        {errorMessage && (
          <View className="mb-4 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
            <Text className="text-sm text-red-700">{errorMessage}</Text>
          </View>
        )}

        <View className="mb-4">
          <Text className="text-sm font-medium mb-2">E-Mail</Text>
          <TextInput
            placeholder="name@example.com"
            placeholderTextColor="#999"
            value={formData.email}
            onChangeText={(email) => setFormData({ ...formData, email })}
            editable={!loading}
            keyboardType="email-address"
            autoCapitalize="none"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium mb-2">Passwort</Text>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor="#999"
            value={formData.password}
            onChangeText={(password) => setFormData({ ...formData, password })}
            editable={!loading}
            secureTextEntry
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
          />
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 py-3 rounded-lg items-center"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold">Anmelden</Text>
          )}
        </TouchableOpacity>

        <Text className="text-xs text-center text-gray-500 mt-8">
          Noch kein Konto? Kontaktiere deinen Administrator
        </Text>
      </View>
    </SafeAreaView>
  );
}
