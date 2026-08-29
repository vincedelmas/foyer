import type {
  MediaFolderSummary,
  MediaPart,
  MediaSummary,
} from "@ploux/contracts"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NavigationBar } from "expo-navigation-bar"
import { StatusBar } from "expo-status-bar"
import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { TvUpdateProvider } from "./src/components/TvUpdateProvider"
import { CollectionScreen } from "./src/screens/CollectionScreen"
import { DetailScreen } from "./src/screens/DetailScreen"
import { HomeScreen } from "./src/screens/HomeScreen"
import { PlayerScreen } from "./src/screens/PlayerScreen"
import { SettingsScreen } from "./src/screens/SettingsScreen"
import { colors } from "./src/theme"

const SERVER_KEY = "ploux.server-url"
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

type ReturnScreen =
  | { name: "home" }
  | { name: "collection"; folder: MediaFolderSummary }

type Screen =
  | ReturnScreen
  | { name: "settings" }
  | { name: "detail"; media: MediaSummary; returnTo: ReturnScreen }
  | {
      name: "player"
      media: MediaSummary
      part: MediaPart
      parts: MediaPart[]
      returnTo: ReturnScreen
    }

export default function App() {
  const [server, setServer] = useState<string | null | undefined>(undefined)
  const [screen, setScreen] = useState<Screen>({ name: "home" })

  useEffect(() => {
    void AsyncStorage.getItem(SERVER_KEY).then((saved) => {
      setServer(saved ?? process.env.EXPO_PUBLIC_PLOUX_URL ?? null)
    })
  }, [])

  const saveServer = async (value: string) => {
    await AsyncStorage.setItem(SERVER_KEY, value)
    queryClient.clear()
    setServer(value)
    setScreen({ name: "home" })
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
      <TvUpdateProvider enabled={Boolean(server) && screen.name === "home"}>
        <StatusBar hidden />
        <NavigationBar hidden style="light" />
        {!server ? (
          <SettingsScreen
            initialServer="http://10.0.2.2:3000"
            firstRun
            onSave={saveServer}
            onBack={() => undefined}
          />
        ) : screen.name === "home" ? (
          <HomeScreen
            server={server}
            onOpenCollection={(folder) =>
              setScreen({ name: "collection", folder })
            }
            onOpenMedia={(media) =>
              setScreen({ name: "detail", media, returnTo: { name: "home" } })
            }
            onOpenSettings={() => setScreen({ name: "settings" })}
          />
        ) : screen.name === "collection" ? (
          <CollectionScreen
            server={server}
            initialFolder={screen.folder}
            onHome={() => setScreen({ name: "home" })}
            onOpenMedia={(media) =>
              setScreen({
                name: "detail",
                media,
                returnTo: { name: "collection", folder: screen.folder },
              })
            }
            onOpenSettings={() => setScreen({ name: "settings" })}
          />
        ) : screen.name === "settings" ? (
          <SettingsScreen
            initialServer={server}
            onSave={saveServer}
            onBack={() => setScreen({ name: "home" })}
          />
        ) : screen.name === "detail" ? (
          <DetailScreen
            server={server}
            summary={screen.media}
            onBack={() => setScreen(screen.returnTo)}
            onPlay={(part, media, parts) =>
              setScreen({
                name: "player",
                media,
                part,
                parts,
                returnTo: screen.returnTo,
              })
            }
          />
        ) : (
          <PlayerScreen
            server={server}
            mediaId={screen.media.id}
            mediaTitle={screen.media.title}
            part={screen.part}
            parts={screen.parts}
            onBack={() =>
              setScreen({
                name: "detail",
                media: screen.media,
                returnTo: screen.returnTo,
              })
            }
          />
        )}
      </TvUpdateProvider>
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
