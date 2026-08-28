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
  width = 760,
  scroll = false,
}: {
  visible: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  width?: ViewStyle["width"]
  scroll?: boolean
}) {
  useEffect(() => {
    if (!visible) return
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose()
        return true
      }
    )
    return () => subscription.remove()
  }, [onClose, visible])

  const content = <View style={styles.body}>{children}</View>

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
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
            <FocusIconButton icon={XIcon} label="Close" onPress={onClose} />
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
    padding: 48,
    backgroundColor: colors.scrim,
  },
  panel: {
    maxHeight: "88%",
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    elevation: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 24,
    paddingHorizontal: 30,
    paddingTop: 28,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  copy: { flex: 1, gap: 7 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  body: { padding: 28 },
  scroll: { flexGrow: 0 },
  scrollContent: { flexGrow: 1 },
})
