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
}: TextInputProps & { label: string; hint?: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
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
  field: { gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
  input: {
    height: 56,
    paddingHorizontal: 17,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 17,
  },
  inputFocused: { borderColor: colors.white },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
})
