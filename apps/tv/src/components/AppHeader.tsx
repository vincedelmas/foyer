import { HomeIcon, SettingsIcon } from "lucide-react-native"
import { StyleSheet, Text, View } from "react-native"
import Svg, { Path, Rect } from "react-native-svg"

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
        <View style={styles.logo}>
          <Svg width={30} height={30} viewBox="0 0 30 30">
            <Path
              d="M4 27V14C4 6.8 8.7 3 15 3s11 3.8 11 11v13"
              fill="none"
              stroke={colors.primary}
              strokeWidth={4}
              strokeLinecap="round"
            />
            <Rect x={7.5} y={9} width={15} height={10} rx={2.4} fill={colors.text} />
            <Path d="m13 11.5 5.5 2.5-5.5 2.5Z" fill={colors.background} />
            <Path d="M8 22h14v5H8Z" fill="#7f3f20" />
          </Svg>
        </View>
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
  logo: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.surfaceRaised,
  },
  brandText: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -1,
  },
  navigation: { flex: 1, flexDirection: "row" },
})
