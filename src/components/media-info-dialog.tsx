import type {MediaFileInfo, MediaInfo, MediaStreamInfo} from "@ploux/contracts"
import {useQuery} from "@tanstack/react-query"
import {AudioLinesIcon, CaptionsIcon, FileVideoIcon, InfoIcon} from "lucide-react"
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert"
import {Badge} from "@/components/ui/badge"
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {Skeleton} from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {api} from "@/lib/api"


export function MediaInfoDialog({
    mediaId,
    title,
    open,
    onOpenChange,
}: {
    mediaId: string
    title: string
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const info = useQuery({
        queryKey: ["media-info", mediaId],
        queryFn: () => api.mediaInfo(mediaId),
        enabled: open,
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Media info · {title}</DialogTitle>
                    <DialogDescription>
                        Technical information from the indexed files and their streams.
                    </DialogDescription>
                </DialogHeader>

                {info.isPending ? <MediaInfoSkeleton/> : null}

                {info.isError ? (
                    <Alert variant="destructive">
                        <InfoIcon/>
                        <AlertTitle>Could not inspect this media</AlertTitle>
                        <AlertDescription>{info.error.message}</AlertDescription>
                    </Alert>
                ) : null}

                {info.data ? <MediaInfoContent info={info.data}/> : null}
            </DialogContent>
        </Dialog>
    )
}


function MediaInfoContent({info}: {info: MediaInfo}) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                    <FileVideoIcon data-icon="inline-start"/>
                    {info.files.length} {info.files.length === 1 ? "file" : "files"}
                </Badge>
                <Badge variant="secondary">{formatBytes(info.totalSize)} total</Badge>
            </div>

            {!info.probeAvailable && info.files.length ? (
                <Alert>
                    <InfoIcon/>
                    <AlertTitle>Stream inspection is unavailable</AlertTitle>
                    <AlertDescription>
                        ffprobe is not installed on this server. Indexed file and external
                        subtitle information is still shown below.
                    </AlertDescription>
                </Alert>
            ) : null}

            {info.files.map((file) => (
                <MediaFileCard
                    key={file.id}
                    file={file}
                    showProbeError={info.probeAvailable}
                />
            ))}
        </div>
    )
}


function MediaFileCard({
    file,
    showProbeError,
}: {
    file: MediaFileInfo
    showProbeError: boolean
}) {
    return (
        <Card size="sm">
            <CardHeader>
                <CardTitle className="truncate">{file.fileName}</CardTitle>
                <CardDescription className="break-all">{file.path}</CardDescription>
                <CardAction>
                    <Badge variant="outline">{file.container.toUpperCase()}</Badge>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <InfoTerm term="Size" value={formatBytes(file.size)}/>
                    <InfoTerm term="MIME type" value={file.mimeType}/>
                    <InfoTerm term="Format" value={file.formatName ?? file.container}/>
                    <InfoTerm term="Duration" value={formatDuration(file.durationSeconds)}/>
                    <InfoTerm term="Bit rate" value={formatBitRate(file.bitRate)}/>
                    <InfoTerm
                        term="Modified"
                        value={new Date(file.modifiedAt).toLocaleString()}
                    />
                </dl>

                {showProbeError && file.probeError ? (
                    <Alert variant="destructive">
                        <InfoIcon/>
                        <AlertTitle>Could not inspect streams</AlertTitle>
                        <AlertDescription>{file.probeError}</AlertDescription>
                    </Alert>
                ) : null}

                {file.streams.length ? <StreamTable streams={file.streams}/> : null}

                {file.externalSubtitles.length ? (
                    <div className="flex flex-col gap-2">
                        <h4 className="flex items-center gap-2 text-sm font-medium">
                            <CaptionsIcon className="size-4"/>
                            External subtitles
                        </h4>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Language</TableHead>
                                    <TableHead>Format</TableHead>
                                    <TableHead>Path</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {file.externalSubtitles.map((subtitle) => (
                                    <TableRow key={subtitle.id}>
                                        <TableCell>{subtitle.label}</TableCell>
                                        <TableCell>{subtitle.format.toUpperCase()}</TableCell>
                                        <TableCell className="max-w-md break-all">
                                            {subtitle.path}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}


function StreamTable({streams}: {streams: MediaStreamInfo[]}) {
    return (
        <div className="flex flex-col gap-2">
            <h4 className="flex items-center gap-2 text-sm font-medium">
                <AudioLinesIcon className="size-4"/>
                Embedded streams
            </h4>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Codec</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Language</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {streams.map((stream) => (
                        <TableRow key={stream.index}>
                            <TableCell>
                                <Badge variant="secondary">{stream.type}</Badge>
                            </TableCell>
                            <TableCell>
                                {[stream.codec, stream.profile].filter(Boolean).join(" · ") || "Unknown"}
                            </TableCell>
                            <TableCell>{streamDetails(stream)}</TableCell>
                            <TableCell>{stream.language ?? "—"}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}


function InfoTerm({term, value}: {term: string; value: string | null}) {
    if (!value) return null
    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="mt-0.5 truncate font-medium" title={value}>{value}</dd>
        </div>
    )
}


const streamDetails = (stream: MediaStreamInfo) => {
    if (stream.type === "video") {
        return [
            stream.width && stream.height ? `${stream.width}×${stream.height}` : null,
            stream.frameRate ? `${stream.frameRate} fps` : null,
        ].filter(Boolean).join(" · ") || "—"
    }
    if (stream.type === "audio") {
        return [
            stream.channels ? `${stream.channels} channels` : null,
            stream.channelLayout,
            stream.sampleRate ? `${Math.round(stream.sampleRate / 1000)} kHz` : null,
        ].filter(Boolean).join(" · ") || "—"
    }
    return stream.title ?? "—"
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
    const totalSeconds = Math.round(seconds)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const remainingSeconds = totalSeconds % 60
    return hours
        ? `${hours}h ${minutes}m ${remainingSeconds}s`
        : `${minutes}m ${remainingSeconds}s`
}


const formatBitRate = (bitRate: number | null) =>
    bitRate === null ? null : `${(bitRate / 1_000_000).toFixed(2)} Mbps`


function MediaInfoSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-40"/>
            <Skeleton className="h-64 w-full rounded-xl"/>
        </div>
    )
}
