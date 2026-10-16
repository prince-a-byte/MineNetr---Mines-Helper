import { Text, View } from 'react-native';

const MAP: Record<string, { bg: string; fg: string }> = {
  Active: { bg: '#E4F5EC', fg: '#159B72' },
  Verified: { bg: '#E4F5EC', fg: '#159B72' },
  Approved: { bg: '#E4F5EC', fg: '#159B72' },
  Paid: { bg: '#E4F5EC', fg: '#159B72' },
  'On Leave': { bg: '#FDF1E2', fg: '#C77E1A' },
  Pending: { bg: '#FDF1E2', fg: '#C77E1A' },
  Expiring: { bg: '#FDF1E2', fg: '#C77E1A' },
  Inactive: { bg: '#FBE7E9', fg: '#DC4C58' },
  Rejected: { bg: '#FBE7E9', fg: '#DC4C58' },
  Expired: { bg: '#FBE7E9', fg: '#DC4C58' },
};

export function Chip({ label }: { label: string }) {
  const c = MAP[label] ?? { bg: '#EAF3FF', fg: '#1463D9' };
  return (
    <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: c.bg }}>
      <Text className="text-[12px] font-bold" style={{ color: c.fg }}>{label}</Text>
    </View>
  );
}
