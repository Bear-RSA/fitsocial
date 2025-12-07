// components/ui/Chip.tsx
import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";
import { radius } from "@/constants/layout";
import { typography } from "@/constants/typography";

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

const Chip: React.FC<Props> = ({ label, active, onPress }) => {
  const colors = useColors();

  const inactiveBg =
    colors.bg === "#020202" ? "#171717" : "#E6E0D8"; // dark vs light mode

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: active ? colors.primary : inactiveBg,
          borderColor: active ? colors.primaryDark : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          typography.caption,
          { color: active ? "#FFFFFF" : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export default Chip;

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginRight: 8,
  },
});
