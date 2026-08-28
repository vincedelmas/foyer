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
      width={680}
    >
      <View style={styles.list}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Pressable
              key={item.key}
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
                  size={23}
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
  list: { gap: 8 },
  item: {
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  itemDanger: { backgroundColor: "rgba(216,94,84,0.09)" },
  itemSelected: { borderColor: colors.primary },
  itemFocused: { borderColor: colors.white, transform: [{ scale: 1.015 }] },
  itemDisabled: { opacity: 0.42 },
  itemPressed: { opacity: 0.76 },
  itemCopy: { flex: 1, gap: 3 },
  itemLabel: { color: colors.text, fontSize: 17, fontWeight: "700" },
  itemLabelDanger: { color: colors.danger },
  itemDescription: { color: colors.muted, fontSize: 12, lineHeight: 17 },
})
