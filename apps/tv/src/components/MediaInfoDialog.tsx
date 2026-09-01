import {useState} from "react";
import {colors} from "../theme";
import {TvModal} from "./TvModal";
import {useQuery} from "@tanstack/react-query";
import {mediaFileInfoOptions, mediaInfoOptions} from "../query-options";
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from "react-native";
import {formatBitRate, formatBytes, formatDurationSeconds, type MediaFileInfo, type MediaStreamInfo} from "@foyer/contracts";


interface MediaInfoDialogProps {
    title: string
    server: string
    visible: boolean
    onClose: () => void
    mediaId: string | null
}


export function MediaInfoDialog({ server, mediaId, title, visible, onClose }: MediaInfoDialogProps) {
    const info = useQuery({
        ...mediaInfoOptions(server, mediaId ?? ""),
        enabled: visible && Boolean(mediaId),
    })

    return (
        <TvModal
            width={860}
            scroll={true}
            visible={visible}
            onClose={onClose}
            title={`Media info · ${title}`}
            description="Technical information from the indexed files and their streams."
        >
            {info.isPending &&
                <ActivityIndicator
                    size="large"
                    color={colors.primary}
                />
            }

            {info.isError &&
                <Text style={styles.error}>
                    {info.error.message}
                </Text>
            }

            {info.data &&
                <View style={styles.content}>
                    <View style={styles.summary}>
                        <Text style={styles.pill}>
                            {info.data.files.length} files
                        </Text>
                        <Text style={styles.pill}>
                            {formatBytes(info.data.totalSize)} total
                        </Text>
                    </View>
                    {info.data.files.map((file) =>
                        <FileCard
                            file={file}
                            key={file.id}
                            server={server}
                            mediaId={info.data.id}
                        />
                    )}
                </View>
            }
        </TvModal>
    );
}


function FileCard({ server, mediaId, file }: { server: string; mediaId: string; file: MediaFileInfo }) {
    const [focused, setFocused] = useState(false);
    const [requested, setRequested] = useState(false);

    const probe = useQuery({
        ...mediaFileInfoOptions(server, mediaId, file),
        enabled: requested,
    });

    const details = probe.data ?? file;

    return (
        <Pressable
            android_disableSound={true}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.file, focused && styles.fileFocused]}
            accessibilityLabel={`Technical information for ${file.fileName}`}
            onPress={() => requested ? void probe.refetch() : setRequested(true)}
        >
            <View style={styles.fileHeader}>
                <View style={styles.fileCopy}>
                    <Text numberOfLines={1} style={styles.fileName}>
                        {file.fileName}
                    </Text>
                    <Text style={styles.path}>
                        {file.path}
                    </Text>
                </View>
                <Text style={styles.container}>
                    {file.container.toUpperCase()}
                </Text>
            </View>

            <View style={styles.facts}>
                <Fact label="Size" value={formatBytes(file.size)}/>
                <Fact label="MIME" value={file.mimeType}/>
                <Fact label="Format" value={details.formatName ?? file.container}/>
                <Fact label="Duration" value={formatDurationSeconds(details.durationSeconds)}/>
                <Fact label="Bit rate" value={formatBitRate(details.bitRate)}/>
            </View>

            {!requested &&
                <Text style={styles.notice}>
                    Press OK to inspect embedded streams
                </Text>
            }

            {probe.isFetching && requested &&
                <View style={styles.inspecting}>
                    <ActivityIndicator
                        size="small"
                        color={colors.primary}
                    />
                    <Text style={styles.notice}>
                        Inspecting streams...
                    </Text>
                </View>
            }

            {probe.isError && !probe.isFetching &&
                <Text style={styles.error}>
                    {probe.error.message} · Press OK to retry
                </Text>
            }

            {details.probeError && !probe.isFetching &&
                <Text style={styles.error}>
                    {details.probeError} · Press OK to retry
                </Text>
            }

            {details.streams.length &&
                <View style={styles.streams}>
                    <Text style={styles.subheading}>
                        Embedded streams
                    </Text>
                    {details.streams.map((stream) =>
                        <StreamRow
                            stream={stream}
                            key={stream.index}
                        />
                    )}
                </View>
            }

            {file.externalSubtitles.length &&
                <View style={styles.streams}>
                    <Text style={styles.subheading}>
                        External subtitles
                    </Text>
                    {file.externalSubtitles.map((subtitle) =>
                        <Text key={subtitle.id} style={styles.streamText}>
                            {subtitle.label} · {subtitle.format.toUpperCase()} · {subtitle.path}
                        </Text>
                    )}
                </View>
            }
        </Pressable>
    );
}


function StreamRow({ stream }: { stream: MediaStreamInfo }) {
    const details = stream.type === "video"
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
    );
}


function Fact({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;

    return (
        <View style={styles.fact}>
            <Text style={styles.factLabel}>
                {label}
            </Text>
            <Text numberOfLines={1} style={styles.factValue}>
                {value}
            </Text>
        </View>
    );
}


const styles = StyleSheet.create({
    content: { gap: 12 },
    summary: { flexDirection: "row", alignItems: "center", gap: 10 },
    pill: { color: colors.text, backgroundColor: colors.surfaceRaised, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, fontSize: 10, fontWeight: "700" },
    notice: { color: colors.primary, fontSize: 10 },
    inspecting: { flexDirection: "row", alignItems: "center", gap: 8 },
    file: { padding: 14, gap: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    fileFocused: { borderColor: colors.white },
    fileHeader: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
    fileCopy: { flex: 1, gap: 5 },
    fileName: { color: colors.text, fontSize: 12, fontWeight: "800" },
    path: { color: colors.muted, fontSize: 10, lineHeight: 14 },
    container: { color: colors.text, fontSize: 10, fontWeight: "800", borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
    facts: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
    fact: { width: 174, gap: 3 },
    factLabel: { color: colors.muted, fontSize: 10 },
    factValue: { color: colors.text, fontSize: 11, fontWeight: "700" },
    streams: { gap: 7 },
    subheading: { color: colors.text, fontSize: 12, fontWeight: "800" },
    streamText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
    error: { color: colors.danger, fontSize: 11, lineHeight: 16 },
});
