
// components/ui/Themed.tsx
import React, { forwardRef } from "react";
import { View, ScrollView, Text, type ViewProps, type ScrollViewProps, type TextProps } from "react-native";
import { useColors } from "@/constants/colors";

// Themed View
export const ThemedView = forwardRef<View, ViewProps>(function ThemedView({ style, ...rest }, ref) {
  const colors = useColors();
  return <View ref={ref} style={[{ backgroundColor: colors.bg }, style]} {...rest} />;
});

// Themed ScrollView
export const ThemedScrollView = forwardRef<ScrollView, ScrollViewProps>(function ThemedScrollView(
  { style, contentContainerStyle, ...rest },
  ref
) {
  const colors = useColors();
  return (
    <ScrollView
      ref={ref}
      style={[{ backgroundColor: colors.bg }, style]}
      contentContainerStyle={contentContainerStyle}
      {...rest}
    />
  );
});

// Themed Text
export const ThemedText = forwardRef<Text, TextProps>(function ThemedText({ style, ...rest }, ref) {
  const colors = useColors();
  return <Text ref={ref} style={[{ color: colors.text }, style]} {...rest} />;
});
