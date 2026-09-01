import { useState } from "react"
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native"

import { colors } from "../theme"

export function FocusTextInput({
  label,
  hint,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        placeholderTextColor={colors.muted}
        style={[styles.input, focused && styles.inputFocused, style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 5 },
  label: { color: colors.text, fontSize: 10, fontWeight: "700" },
  input: {
    height: 44,
    paddingHorizontal: 13,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 12,
  },
  inputFocused: { borderColor: colors.white },
  hint: { color: colors.muted, fontSize: 9, lineHeight: 13 },
})
