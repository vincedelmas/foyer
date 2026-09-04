import type { LucideIcon } from "lucide-react-native"
import { Pressable, StyleSheet, type PressableProps } from "react-native"
import { useState } from "react"

import { colors } from "../theme"

export function FocusIconButton({
  icon: Icon,
  active = false,
  danger = false,
  label,
  onFocus,
  onBlur,
  ...props
}: PressableProps & {
  icon: LucideIcon
  active?: boolean
  danger?: boolean
  label: string
}) {
  const [focused, setFocused] = useState(false)

  return (
    <Pressable
      {...props}
      android_disableSound
      accessibilityLabel={label}
      accessibilityRole="button"
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      style={({ pressed }) => [
        styles.button,
        active && styles.active,
        danger && styles.danger,
        props.disabled && styles.disabled,
        focused && styles.focused,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        size={21}
        strokeWidth={active ? 3 : 2.3}
        color={active ? colors.primaryText : colors.text}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "rgba(18,17,15,0.9)",
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  focused: {
    borderColor: colors.white,
    transform: [{ scale: 1.08 }],
    elevation: 12,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.42 },
})
