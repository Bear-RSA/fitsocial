// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/constants/colors";

export default function TabsLayout() {
  const colors = useColors();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,      // 🔸 ORANGE when active
        tabBarInactiveTintColor: colors.textMuted,  // 🔹 muted gray when inactive
        tabBarStyle: {
          backgroundColor: colors.card,            // 🔸 dark card in dark mode, light card in light mode
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          let icon: keyof typeof Ionicons.glyphMap = "home";

          switch (route.name) {
            case "home":
              icon = "home";
              break;
            case "plan":
              icon = "barbell";
              break;
            case "meals":
              icon = "restaurant";
              break;
            case "community":
              icon = "people";
              break;
            case "profile":
              icon = "person";
              break;
            case "settings":
              icon = "settings";
              break;
          }

          // IMPORTANT: use the `color` Expo gives us, DON'T hardcode pink here
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home" }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: "Workouts" }}
      />
      <Tabs.Screen
        name="meals"
        options={{ title: "Meals" }}
      />
      <Tabs.Screen
        name="community"
        options={{ title: "The Hub" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
    </Tabs>
  );
}
