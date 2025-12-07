// components/ui/Screen.tsx
import React from "react";
import { View, StyleSheet, StatusBar, ViewProps } from "react-native";
import { useColors } from "@/constants/colors";

type Props = ViewProps & { padded?: boolean };

const Screen: React.FC<Props> = ({ children, padded = true, style, ...rest }) => {
  const colors = useColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          paddingHorizontal: padded ? 16 : 0,
        },
        style,
      ]}
      {...rest}
    >
      <StatusBar
        barStyle={colors.bg === "#020202" ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />
      {children}
    </View>
  );
};

export default Screen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
});
