import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';

export function SelectSheet({
  label, required, value, placeholder, options, onPick, error,
}: {
  label?: string;
  required?: boolean;
  value?: string;
  placeholder: string;
  options: readonly string[] | string[];
  onPick: (v: string) => void;
  error?: string;
}) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View className="mb-3">
      {label ? (
        <Text className="mb-1.5 text-[13px] font-semibold" style={{ color: t.ink }}>
          {label} {required ? <Text style={{ color: t.danger }}>*</Text> : null}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl border px-3.5 py-3"
        style={{ borderColor: error ? t.danger : t.divider, backgroundColor: t.surface }}
      >
        <Text className="text-[14px]" style={{ color: value ? t.ink : t.secondary }}>
          {value || placeholder}
        </Text>
        <ChevronDown size={18} color={t.secondary} />
      </Pressable>
      {error ? <Text className="mt-1 text-[12px]" style={{ color: t.danger }}>{error}</Text> : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: t.surface }} className="rounded-t-3xl p-4 pb-8">
            <Text className="mb-2 text-[15px] font-bold" style={{ color: t.ink }}>{label ?? placeholder}</Text>
            <FlatList
              data={options as string[]}
              keyExtractor={(o) => o}
              renderItem={({ item }) => (
                <Pressable
                  className="flex-row items-center justify-between border-b px-2 py-3.5"
                  style={{ borderColor: t.divider }}
                  onPress={() => { onPick(item); setOpen(false); }}
                >
                  <Text className="text-[14px]" style={{ color: t.ink }}>{item}</Text>
                  {value === item ? <Check size={18} color={t.primary} /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
