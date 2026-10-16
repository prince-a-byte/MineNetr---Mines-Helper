import { Pressable, ScrollView, Text, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { TextInput } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { t } = useTheme();
  return (
    <View className="mb-3 flex-row items-center rounded-xl border px-3" style={{ borderColor: t.divider, backgroundColor: t.surface }}>
      <Search size={18} color={t.secondary} />
      <TextInput
        className="flex-1 px-2 py-3 text-[14px]"
        style={{ color: t.ink }}
        placeholderTextColor={t.secondary}
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

export function SegmentedTabs<T extends string>({
  options, value, onChange, counts,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  const { t } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const active = o === value;
        const label = counts?.[o] != null ? `${o} (${counts[o]})` : o;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            onPress={() => onChange(o)}
            className="rounded-xl px-4 py-2.5"
            style={{ backgroundColor: active ? t.navy : t.lightBlue }}
          >
            <Text className="text-[13px] font-bold" style={{ color: active ? '#fff' : t.ink }}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
