import { useMutation } from "@tanstack/react-query"
import { ArrowLeftIcon, CheckCircleIcon, ServerIcon } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"

import { tvApi } from "../api"
import { FocusButton } from "../components/FocusButton"
import { colors } from "../theme"

export function SettingsScreen({
  initialServer,
  onSave,
  onBack,
  firstRun = false,
}: {
  initialServer: string
  onSave: (server: string) => Promise<void>
  onBack: () => void
  firstRun?: boolean
}) {
  const [server, setServer] = useState(initialServer)
  const test = useMutation({ mutationFn: () => tvApi.health(server) })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onSave(server.trim().replace(/\/+$/, ""))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <ServerIcon color={colors.primary} size={42} />
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>
            {firstRun ? "WELCOME TO PLOUX TV" : "CONNECTION"}
          </Text>
          <Text style={styles.title}>
            {firstRun ? "Find your home server" : "Server settings"}
          </Text>
          <Text style={styles.description}>
            Enter the address of the computer running Ploux. Use its LAN IP—not
            localhost—from a physical TV.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={server}
            onChangeText={setServer}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.10:3000"
            placeholderTextColor={colors.muted}
            hasTVPreferredFocus={firstRun}
          />
        </View>

        {test.isSuccess ? (
          <Text style={styles.success}>Connected to Ploux.</Text>
        ) : null}
        {test.isError ? (
          <Text style={styles.error}>{test.error.message}</Text>
        ) : null}

        <View style={styles.actions}>
          {!firstRun ? (
            <FocusButton
              label="Back"
              icon={ArrowLeftIcon}
              variant="ghost"
              onPress={onBack}
            />
          ) : null}
          <FocusButton
            label={test.isPending ? "Testing…" : "Test connection"}
            variant="secondary"
            onPress={() => test.mutate()}
            disabled={!server || test.isPending}
          />
          <FocusButton
            label={saving ? "Saving…" : "Save and continue"}
            icon={CheckCircleIcon}
            onPress={() => void save()}
            disabled={!server || saving}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    width: 760,
    padding: 54,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 28,
  },
  copy: { gap: 9 },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
  },
  description: { color: colors.muted, fontSize: 16, lineHeight: 25 },
  field: { gap: 9 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
  input: {
    height: 58,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 18,
  },
  success: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  error: { color: colors.danger, fontSize: 14 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
})
