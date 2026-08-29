import type { LucideIcon } from "lucide-react-native"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { useState } from "react"

import { colors } from "../theme"
import { TvModal } from "./TvModal"

export interface ActionMenuItem {
  key: string
  label: string
  description?: string
  icon: LucideIcon
  danger?: boolean
  disabled?: boolean
  pending?: boolean
  selected?: boolean
  onPress: () => void
}

export function ActionMenu({
  visible,
  title,
  description,
  items,
  onClose,
}: {
  visible: boolean
  title: string
  description?: string
  items: ActionMenuItem[]
  onClose: () => void
}) {
  const [focused, setFocused] = useState<string | null>(null)
  const firstEnabledKey = items.find(
    (item) => !item.disabled && !item.pending
  )?.key

  return (
    <TvModal
      visible={visible}
      title={title}
      description={description}
      onClose={onClose}
      width={520}
      scroll
    >
      <View style={styles.list}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Pressable
              key={item.key}
              android_disableSound
              disabled={item.disabled || item.pending}
              hasTVPreferredFocus={item.key === firstEnabledKey}
              onFocus={() => setFocused(item.key)}
              onBlur={() => setFocused(null)}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.item,
                item.danger && styles.itemDanger,
                item.selected && styles.itemSelected,
                focused === item.key && styles.itemFocused,
                (item.disabled || item.pending) && styles.itemDisabled,
                pressed && styles.itemPressed,
              ]}
            >
              {item.pending ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Icon
                  color={
                    item.danger
                      ? colors.danger
                      : item.selected
                        ? colors.primary
                        : colors.text
                  }
                  size={19}
                />
              )}
              <View style={styles.itemCopy}>
                <Text
                  style={[
                    styles.itemLabel,
                    item.danger && styles.itemLabelDanger,
                  ]}
                >
                  {item.label}
                </Text>
                {item.description ? (
                  <Text style={styles.itemDescription}>{item.description}</Text>
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </View>
    </TvModal>
  )
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  item: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemDanger: { backgroundColor: "rgba(216,94,84,0.09)" },
  itemSelected: { borderColor: colors.primary },
  itemFocused: { borderColor: colors.white },
  itemDisabled: { opacity: 0.42 },
  itemPressed: { opacity: 0.76 },
  itemCopy: { flex: 1, gap: 2 },
  itemLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  itemLabelDanger: { color: colors.danger },
  itemDescription: { color: colors.muted, fontSize: 10, lineHeight: 14 },
})
