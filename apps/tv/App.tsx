import type { MediaPart, MediaSummary } from "@ploux/contracts"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StatusBar } from "expo-status-bar"
import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { LibraryScreen } from "./src/screens/LibraryScreen"
import { DetailScreen } from "./src/screens/DetailScreen"
import { PlayerScreen } from "./src/screens/PlayerScreen"
import { SettingsScreen } from "./src/screens/SettingsScreen"
import { colors } from "./src/theme"

const SERVER_KEY = "ploux.server-url"
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

type Screen =
  | { name: "library" }
  | { name: "settings" }
  | { name: "detail"; media: MediaSummary }
  | { name: "player"; media: MediaSummary; part: MediaPart }

export default function App() {
  const [server, setServer] = useState<string | null | undefined>(undefined)
  const [screen, setScreen] = useState<Screen>({ name: "library" })

  useEffect(() => {
    void AsyncStorage.getItem(SERVER_KEY).then((saved) => {
      setServer(saved ?? process.env.EXPO_PUBLIC_PLOUX_URL ?? null)
    })
  }, [])

  const saveServer = async (value: string) => {
    await AsyncStorage.setItem(SERVER_KEY, value)
    queryClient.clear()
    setServer(value)
    setScreen({ name: "library" })
  }

  if (server === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar hidden />
      {!server ? (
        <SettingsScreen
          initialServer="http://10.0.2.2:3000"
          firstRun
          onSave={saveServer}
          onBack={() => undefined}
        />
      ) : screen.name === "library" ? (
        <LibraryScreen
          server={server}
          onOpenMedia={(media) => setScreen({ name: "detail", media })}
          onOpenSettings={() => setScreen({ name: "settings" })}
        />
      ) : screen.name === "settings" ? (
        <SettingsScreen
          initialServer={server}
          onSave={saveServer}
          onBack={() => setScreen({ name: "library" })}
        />
      ) : screen.name === "detail" ? (
        <DetailScreen
          server={server}
          summary={screen.media}
          onBack={() => setScreen({ name: "library" })}
          onPlay={(part) =>
            setScreen({ name: "player", media: screen.media, part })
          }
        />
      ) : (
        <PlayerScreen
          server={server}
          mediaId={screen.media.id}
          mediaTitle={screen.media.title}
          part={screen.part}
          onBack={() => setScreen({ name: "detail", media: screen.media })}
        />
      )}
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
})
