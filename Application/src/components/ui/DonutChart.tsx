import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

/** Accessible SVG donut with center label + legend. */
export function DonutChart({
  segments, size = 150, centerTop, centerSub,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerTop: string;
  centerSub?: string;
}) {
  const { t } = useTheme();
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const stroke = 16;
  return (
    <View className="flex-row items-center">
      <View style={{ width: size, height: size }} accessibilityLabel={`${centerTop} total`}>
        <Svg width={size} height={size} viewBox="0 0 140 140">
          <Circle cx="70" cy="70" r={R} stroke={t.divider} strokeWidth={stroke} fill="none" />
          {segments.map((s) => {
            const frac = s.value / total;
            const el = (
              <Circle
                key={s.label}
                cx="70" cy="70" r={R}
                stroke={s.color} strokeWidth={stroke} fill="none"
                strokeDasharray={`${frac * C} ${C}`}
                strokeDashoffset={-acc * C}
                strokeLinecap="butt"
                rotation={-90} origin="70,70"
              />
            );
            acc += frac;
            return el;
          })}
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-[20px] font-extrabold" style={{ color: t.ink }}>{centerTop}</Text>
          {centerSub ? <Text className="text-[11px]" style={{ color: t.secondary }}>{centerSub}</Text> : null}
        </View>
      </View>
      <View className="ml-3 flex-1 gap-1.5">
        {segments.map((s) => (
          <View key={s.label} className="flex-row items-center">
            <View className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <Text className="flex-1 text-[12px]" style={{ color: t.secondary }}>{s.label}</Text>
            <Text className="text-[12px] font-bold" style={{ color: t.ink }}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
