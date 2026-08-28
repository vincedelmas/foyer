import type { MediaFileInfo, MediaStreamInfo } from "@ploux/contracts"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { tvApi } from "../api"
import { colors } from "../theme"
import { TvModal } from "./TvModal"

export function MediaInfoDialog({
  server,
  mediaId,
  title,
  visible,
  onClose,
}: {
  server: string
  mediaId: string | null
  title: string
  visible: boolean
  onClose: () => void
}) {
  const info = useQuery({
    queryKey: ["tv-media-info", server, mediaId],
    queryFn: () => tvApi.mediaInfo(server, mediaId!),
    enabled: visible && Boolean(mediaId),
  })

  return (
    <TvModal
      visible={visible}
      title={`Media info · ${title}`}
      description="Technical information from the indexed files and their streams."
      onClose={onClose}
      width={1120}
      scroll
    >
      {info.isPending ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : null}
      {info.isError ? <Text style={styles.error}>{info.error.message}</Text> : null}
      {info.data ? (
        <View style={styles.content}>
          <View style={styles.summary}>
            <Text style={styles.pill}>{info.data.files.length} files</Text>
            <Text style={styles.pill}>{formatBytes(info.data.totalSize)} total</Text>
            {!info.data.probeAvailable ? (
              <Text style={styles.notice}>ffprobe unavailable · showing indexed information</Text>
            ) : null}
          </View>
          {info.data.files.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </View>
      ) : null}
    </TvModal>
  )
}

function FileCard({ file }: { file: MediaFileInfo }) {
  const [focused, setFocused] = useState(false)
  return (
    <Pressable
      accessibilityLabel={`Technical information for ${file.fileName}`}
      onPress={() => undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.file, focused && styles.fileFocused]}
    >
      <View style={styles.fileHeader}>
        <View style={styles.fileCopy}>
          <Text numberOfLines={1} style={styles.fileName}>{file.fileName}</Text>
          <Text style={styles.path}>{file.path}</Text>
        </View>
        <Text style={styles.container}>{file.container.toUpperCase()}</Text>
      </View>
      <View style={styles.facts}>
        <Fact label="Size" value={formatBytes(file.size)} />
        <Fact label="MIME" value={file.mimeType} />
        <Fact label="Format" value={file.formatName ?? file.container} />
        <Fact label="Duration" value={formatDuration(file.durationSeconds)} />
        <Fact label="Bit rate" value={formatBitRate(file.bitRate)} />
      </View>
      {file.probeError ? <Text style={styles.error}>{file.probeError}</Text> : null}
      {file.streams.length ? (
        <View style={styles.streams}>
          <Text style={styles.subheading}>Embedded streams</Text>
          {file.streams.map((stream) => (
            <StreamRow key={stream.index} stream={stream} />
          ))}
        </View>
      ) : null}
      {file.externalSubtitles.length ? (
        <View style={styles.streams}>
          <Text style={styles.subheading}>External subtitles</Text>
          {file.externalSubtitles.map((subtitle) => (
            <Text key={subtitle.id} style={styles.streamText}>
              {subtitle.label} · {subtitle.format.toUpperCase()} · {subtitle.path}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  )
}

function StreamRow({ stream }: { stream: MediaStreamInfo }) {
  const details =
    stream.type === "video"
      ? [
          stream.width && stream.height ? `${stream.width}×${stream.height}` : null,
          stream.frameRate ? `${stream.frameRate} fps` : null,
        ]
      : stream.type === "audio"
        ? [
            stream.channels ? `${stream.channels} channels` : null,
            stream.channelLayout,
            stream.sampleRate ? `${Math.round(stream.sampleRate / 1000)} kHz` : null,
          ]
        : [stream.title]
  return (
    <Text style={styles.streamText}>
      {stream.type.toUpperCase()} · {[stream.codec, stream.profile].filter(Boolean).join(" · ") || "Unknown"}
      {details.filter(Boolean).length ? ` · ${details.filter(Boolean).join(" · ")}` : ""}
      {stream.language ? ` · ${stream.language}` : ""}
    </Text>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.factValue}>{value}</Text>
    </View>
  )
}

const formatBytes = (bytes: number) => {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`
}

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return null
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return hours ? `${hours}h ${minutes}m ${rest}s` : `${minutes}m ${rest}s`
}

const formatBitRate = (value: number | null) =>
  value === null ? null : `${(value / 1_000_000).toFixed(2)} Mbps`

const styles = StyleSheet.create({
  content: { gap: 18 },
  summary: { flexDirection: "row", alignItems: "center", gap: 10 },
  pill: { color: colors.text, backgroundColor: colors.surfaceRaised, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, fontSize: 12, fontWeight: "700" },
  notice: { color: colors.primary, fontSize: 12 },
  file: { padding: 20, gap: 17, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  fileFocused: { borderColor: colors.white },
  fileHeader: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  fileCopy: { flex: 1, gap: 5 },
  fileName: { color: colors.text, fontSize: 18, fontWeight: "800" },
  path: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  container: { color: colors.text, fontSize: 11, fontWeight: "800", borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  fact: { width: 174, gap: 3 },
  factLabel: { color: colors.muted, fontSize: 11 },
  factValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  streams: { gap: 7 },
  subheading: { color: colors.text, fontSize: 14, fontWeight: "800" },
  streamText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
})
