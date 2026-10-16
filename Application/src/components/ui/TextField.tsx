import { useState } from 'react';
import { Pressable, Text, TextInput, TextInputProps, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props extends TextInputProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

export function TextField({ label, required, error, hint, ...rest }: Props) {
  const { t } = useTheme();
  return (
    <View className="mb-3">
      {label ? (
        <Text className="mb-1.5 text-[13px] font-semibold" style={{ color: t.ink }}>
          {label} {required ? <Text style={{ color: t.danger }}>*</Text> : null}
        </Text>
      ) : null}
      <TextInput
        className="rounded-xl border px-3.5 py-3 text-[14px]"
        style={{ borderColor: error ? t.danger : t.divider, backgroundColor: t.surface, color: t.ink }}
        placeholderTextColor={t.secondary}
        {...rest}
      />
      {error ? <Text className="mt-1 text-[12px]" style={{ color: t.danger }}>{error}</Text>
        : hint ? <Text className="mt-1 text-[12px]" style={{ color: t.secondary }}>{hint}</Text> : null}
    </View>
  );
}

export function PasswordField({ label, required, error, ...rest }: Props) {
  const [show, setShow] = useState(false);
  const { t } = useTheme();
  return (
    <View className="mb-3">
      {label ? (
        <Text className="mb-1.5 text-[13px] font-semibold" style={{ color: t.ink }}>
          {label} {required ? <Text style={{ color: t.danger }}>*</Text> : null}
        </Text>
      ) : null}
      <View className="flex-row items-center rounded-xl border pr-2" style={{ borderColor: error ? t.danger : t.divider, backgroundColor: t.surface }}>
        <TextInput
          className="flex-1 px-3.5 py-3 text-[14px]"
          style={{ color: t.ink }}
          placeholderTextColor={t.secondary}
          secureTextEntry={!show}
          {...rest}
        />
        <Pressable accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow((s) => !s)} className="p-2">
          {show ? <EyeOff size={20} color={t.secondary} /> : <Eye size={20} color={t.secondary} />}
        </Pressable>
      </View>
      {error ? <Text className="mt-1 text-[12px]" style={{ color: t.danger }}>{error}</Text> : null}
    </View>
  );
}
