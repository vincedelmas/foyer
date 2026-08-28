import type { MediaSummary, TmdbCandidate } from "@ploux/contracts"
import { tmdbImage } from "@ploux/contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, SearchIcon } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Image, Pressable, StyleSheet, Text, View } from "react-native"

import { tvApi } from "../api"
import { colors } from "../theme"
import { FocusButton } from "./FocusButton"
import { FocusTextInput } from "./FocusTextInput"
import { TvModal } from "./TvModal"

export function IdentifyDialog({
  server,
  media,
  visible,
  onClose,
}: {
  server: string
  media: Pick<MediaSummary, "id" | "title" | "year"> | null
  visible: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState("")
  const [year, setYear] = useState("")
  const [candidates, setCandidates] = useState<TmdbCandidate[]>([])
  const [focused, setFocused] = useState<number | null>(null)

  useEffect(() => {
    if (!visible || !media) return
    setQuery(media.title)
    setYear(media.year?.toString() ?? "")
    setCandidates([])
  }, [media, visible])

  const search = useMutation({
    mutationFn: () =>
      tvApi.searchMetadata(server, {
        mediaId: media!.id,
        query: query.trim(),
        year: year ? Number(year) : undefined,
      }),
    onSuccess: (result) => setCandidates(result.candidates),
  })
  const identify = useMutation({
    mutationFn: (tmdbId: number) =>
      tvApi.identify(server, media!.id, tmdbId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["tv-media", server, media!.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["tv-library", server] }),
        queryClient.invalidateQueries({ queryKey: ["tv-folders", server] }),
        queryClient.invalidateQueries({ queryKey: ["tv-watching", server] }),
      ])
      onClose()
    },
  })

  if (!media) return null
  const error = search.error ?? identify.error

  return (
    <TvModal
      visible={visible}
      title={`Identify “${media.title}”`}
      description={
        error
          ? error.message
          : "Search TMDB and choose the correct match. Your files are never changed."
      }
      onClose={onClose}
      width={840}
      scroll
    >
      <View style={styles.searchRow}>
        <FocusTextInput
          label="Title"
          value={query}
          onChangeText={setQuery}
          hasTVPreferredFocus
          style={styles.titleInput}
        />
        <FocusTextInput
          label="Year"
          value={year}
          onChangeText={(value) => setYear(value.replace(/\D/g, "").slice(0, 4))}
          keyboardType="number-pad"
          placeholder="Optional"
          style={styles.yearInput}
        />
        <FocusButton
          label={search.isPending ? "Searching…" : "Search"}
          icon={SearchIcon}
          onPress={() => search.mutate()}
          disabled={!query.trim() || search.isPending || identify.isPending}
          style={styles.searchButton}
        />
      </View>
      <View style={styles.results}>
        {candidates.map((candidate) => {
          const poster = tmdbImage(candidate.posterPath, "w342")
          return (
            <Pressable
              key={candidate.id}
              onFocus={() => setFocused(candidate.id)}
              onBlur={() => setFocused(null)}
              onPress={() => identify.mutate(candidate.id)}
              disabled={identify.isPending}
              style={({ pressed }) => [
                styles.candidate,
                focused === candidate.id && styles.candidateFocused,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.poster}>
                {poster ? (
                  <Image source={{ uri: poster }} style={styles.image} />
                ) : null}
              </View>
              <View style={styles.candidateCopy}>
                <Text numberOfLines={1} style={styles.candidateTitle}>
                  {candidate.title}
                </Text>
                <Text style={styles.candidateMeta}>
                  {candidate.year ?? "Year unknown"} · {candidate.kind === "movie" ? "Movie" : "TV"}
                </Text>
                <Text numberOfLines={3} style={styles.overview}>
                  {candidate.overview || "No synopsis available."}
                </Text>
                <View style={styles.choose}>
                  <CheckIcon color={colors.primary} size={17} />
                  <Text style={styles.chooseText}>
                    {identify.isPending && identify.variables === candidate.id
                      ? "Applying…"
                      : "Choose match"}
                  </Text>
                </View>
              </View>
            </Pressable>
          )
        })}
        {!candidates.length ? (
          <Text style={styles.empty}>Search results will appear here.</Text>
        ) : null}
      </View>
    </TvModal>
  )
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  titleInput: { width: 370 },
  yearInput: { width: 110 },
  searchButton: { marginBottom: 1 },
  results: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  candidate: {
    width: 387,
    minHeight: 142,
    padding: 9,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    flexDirection: "row",
    gap: 10,
  },
  candidateFocused: { borderColor: colors.white },
  pressed: { opacity: 0.75 },
  poster: {
    width: 78,
    height: 117,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  image: { width: "100%", height: "100%" },
  candidateCopy: { flex: 1, gap: 4 },
  candidateTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  candidateMeta: { color: colors.muted, fontSize: 9 },
  overview: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  choose: { marginTop: "auto", flexDirection: "row", alignItems: "center", gap: 7 },
  chooseText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  empty: { width: "100%", paddingVertical: 44, color: colors.muted, textAlign: "center" },
})
