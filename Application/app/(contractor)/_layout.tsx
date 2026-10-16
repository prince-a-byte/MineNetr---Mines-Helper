import { Stack } from 'expo-router';

export default function ContractorStack() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="mine/[id]" />
      <Stack.Screen name="worker/new" />
      <Stack.Screen name="worker/[id]" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="document/upload" />
      <Stack.Screen name="bill/new" />
      <Stack.Screen name="bill/[id]" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
