import { XIcon } from "lucide-react-native"
import { type ReactNode, useEffect } from "react"
import {
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native"

import { colors } from "../theme"
import { FocusIconButton } from "./FocusIconButton"

export function TvModal({
  visible,
  title,
  description,
  onClose,
  children,
  width = 600,
  scroll = false,
  dismissible = true,
}: {
  visible: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  width?: ViewStyle["width"]
  scroll?: boolean
  dismissible?: boolean
}) {
  useEffect(() => {
    if (!visible) return
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (dismissible) onClose()
        return true
      }
    )
    return () => subscription.remove()
  }, [dismissible, onClose, visible])

  const content = <View style={styles.body}>{children}</View>

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={dismissible ? onClose : () => undefined}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <View style={[styles.panel, { width }]}>
          <View style={styles.header}>
            <View style={styles.copy}>
              <Text style={styles.title}>{title}</Text>
              {description ? (
                <Text style={styles.description}>{description}</Text>
              ) : null}
            </View>
            {dismissible ? (
              <FocusIconButton icon={XIcon} label="Close" onPress={onClose} />
            ) : null}
          </View>
          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {content}
            </ScrollView>
          ) : (
            content
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: colors.scrim,
  },
  panel: {
    maxHeight: "84%",
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    elevation: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  copy: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  description: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  body: { padding: 18 },
  scroll: { flexGrow: 0 },
  scrollContent: { flexGrow: 1 },
})
