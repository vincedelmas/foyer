import { AlertTriangleIcon } from "lucide-react-native"
import { StyleSheet, Text, View } from "react-native"

import { colors } from "../theme"
import { FocusButton } from "./FocusButton"
import { TvModal } from "./TvModal"

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
  onClose,
}: {
  visible: boolean
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <TvModal visible={visible} title={title} onClose={onClose} width={700}>
      <View style={styles.warning}>
        <AlertTriangleIcon color={colors.danger} size={27} />
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.actions}>
        <FocusButton
          label="Cancel"
          variant="secondary"
          onPress={onClose}
          disabled={pending}
          hasTVPreferredFocus
        />
        <FocusButton
          label={pending ? "Working…" : confirmLabel}
          variant="danger"
          onPress={onConfirm}
          disabled={pending}
        />
      </View>
    </TvModal>
  )
}

const styles = StyleSheet.create({
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 15 },
  description: { flex: 1, color: colors.muted, fontSize: 16, lineHeight: 25 },
  actions: {
    marginTop: 26,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
})
