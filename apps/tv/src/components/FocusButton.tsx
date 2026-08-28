import type { LucideIcon } from "lucide-react-native"
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { useState } from "react"

import { colors } from "../theme"

export function FocusButton({
  label,
  icon: Icon,
  variant = "primary",
  size = "default",
  style,
  onFocus,
  onBlur,
  ...props
}: PressableProps & {
  label: string
  icon?: LucideIcon
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "small" | "default"
  style?: StyleProp<ViewStyle>
}) {
  const [focused, setFocused] = useState(false)
  return (
    <Pressable
      {...props}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        size === "small" && styles.small,
        props.disabled && styles.disabled,
        focused && styles.focused,
        pressed && styles.pressed,
        style,
      ]}
    >
      {Icon ? (
        <Icon
          size={22}
          color={variant === "primary" ? colors.primaryText : colors.text}
        />
      ) : null}
      <Text
        style={[
          styles.label,
          size === "small" && styles.smallLabel,
          variant === "primary" && styles.primaryLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  primary: { backgroundColor: colors.primary },
  primaryLabel: { color: colors.primaryText },
  secondary: { backgroundColor: colors.surfaceRaised },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.danger },
  small: { height: 42, paddingHorizontal: 16 },
  focused: {
    borderColor: colors.white,
    transform: [{ scale: 1.06 }],
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.42 },
  label: { color: colors.text, fontSize: 16, fontWeight: "700" },
  smallLabel: { fontSize: 14 },
})
