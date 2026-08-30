import { HomeIcon, SettingsIcon } from "lucide-react-native"
import { Image, StyleSheet, Text, View } from "react-native"

import { colors, spacing } from "../theme"
import { FocusButton } from "./FocusButton"

export function AppHeader({
  active,
  onHome,
  onSettings,
}: {
  active: "home" | "settings" | "other"
  onHome: () => void
  onSettings: () => void
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} />
        <Text style={styles.brandText}>Foyer</Text>
      </View>
      <View style={styles.navigation}>
        <FocusButton
          label="Home"
          icon={HomeIcon}
          variant={active === "home" ? "secondary" : "ghost"}
          size="small"
          onPress={onHome}
        />
      </View>
      <FocusButton
        label="Settings"
        icon={SettingsIcon}
        variant={active === "settings" ? "secondary" : "ghost"}
        size="small"
        onPress={onSettings}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 62,
    paddingHorizontal: spacing.page,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    backgroundColor: colors.background,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 30, height: 30, borderRadius: 7 },
  brandText: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -1,
  },
  navigation: { flex: 1, flexDirection: "row" },
})
