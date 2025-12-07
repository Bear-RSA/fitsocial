// components/ui/SafeLinearGradient.tsx
import React, { ReactNode } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { LinearGradient, LinearGradientProps } from "expo-linear-gradient";
import { useColors } from "@/constants/colors";

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
} & Partial<LinearGradientProps>;

const SafeLinearGradient: React.FC<Props> = ({
  children,
  style,
  colors,
  start,
  end,
  ...rest
}) => {
  const brandColors = useColors();

  const gradientColors = colors ?? brandColors.accentGradient;
  const startPoint = start ?? { x: 0, y: 0 };
  const endPoint = end ?? { x: 1, y: 1 };

  return (
    <LinearGradient
      colors={gradientColors}
      start={startPoint}
      end={endPoint}
      style={style}
      {...rest}
    >
      {children}
    </LinearGradient>
  );
};

export default SafeLinearGradient;
