// components/ui/PrimaryButton.tsx
import React from "react";
import {
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { useColors } from "@/constants/colors";
import { radius } from "@/constants/layout";
import { typography } from "@/constants/typography";

type Props = {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
};

const PrimaryButton: React.FC<Props> = ({
  label,
  onPress,
  style,
  disabled,
  loading,
}) => {
  const colors = useColors();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isDisabled
            ? colors.primaryDark + "99"
            : pressed
            ? colors.primaryDark
            : colors.primary,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text
          style={[
            typography.bodyStrong,
            { color: "#FFFFFF", textAlign: "center" },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
};

export default PrimaryButton;

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
