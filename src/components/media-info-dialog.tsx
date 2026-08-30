import {useState} from "react";
import {plouxQueries} from "@/lib/queries";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {useQuery} from "@tanstack/react-query";
import {Spinner} from "@/components/ui/spinner";
import {Skeleton} from "@/components/ui/skeleton";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {AudioLinesIcon, CaptionsIcon, FileVideoIcon, InfoIcon} from "lucide-react";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {formatBitRate, formatBytes, formatDurationSeconds, type MediaFileInfo, type MediaInfo, type MediaStreamInfo} from "@ploux/contracts";


interface MediaInfoDialogProps {
    title: string;
    open: boolean;
    mediaId: string;
    onOpenChange: (open: boolean) => void;
}


export function MediaInfoDialog({ mediaId, title, open, onOpenChange }: MediaInfoDialogProps) {
    const info = useQuery({
        ...plouxQueries.options.mediaInfo(mediaId),
        enabled: open,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Media info · {title}</DialogTitle>
                    <DialogDescription>
                        Technical information from the indexed files and their streams.
                    </DialogDescription>
                </DialogHeader>

                {info.isPending && <MediaInfoSkeleton/>}

                {info.isError &&
                    <Alert variant="destructive">
                        <InfoIcon/>
                        <AlertTitle>Could not inspect this media</AlertTitle>
                        <AlertDescription>{info.error.message}</AlertDescription>
                    </Alert>
                }

                {info.data && <MediaInfoContent info={info.data}/>}
            </DialogContent>
        </Dialog>
    );
}


function MediaInfoContent({ info }: { info: MediaInfo }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                    <FileVideoIcon data-icon="inline-start"/>
                    {info.files.length} {info.files.length === 1 ? "file" : "files"}
                </Badge>
                <Badge variant="secondary">
                    {formatBytes(info.totalSize)} total
                </Badge>
            </div>

            {info.files.map((file) =>
                <MediaFileCard
                    file={file}
                    key={file.id}
                    mediaId={info.id}
                />
            )}
        </div>
    );
}


function MediaFileCard({ mediaId, file }: { mediaId: string, file: MediaFileInfo }) {
    const [requested, setRequested] = useState(false);

    const probe = useQuery({
        ...plouxQueries.options.mediaFileInfo(mediaId, file),
        enabled: requested,
    });

    const details = probe.data ?? file;

    return (
        <Card size="sm">
            <CardHeader>
                <CardTitle className="truncate">
                    {file.fileName}
                </CardTitle>
                <CardDescription className="break-all">
                    {file.path}
                </CardDescription>
                <CardAction>
                    <Badge variant="outline">
                        {file.container.toUpperCase()}
                    </Badge>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <InfoTerm term="Size" value={formatBytes(file.size)}/>
                    <InfoTerm term="MIME type" value={file.mimeType}/>
                    <InfoTerm term="Format" value={details.formatName ?? file.container}/>
                    <InfoTerm term="Duration" value={formatDurationSeconds(details.durationSeconds)}/>
                    <InfoTerm term="Bit rate" value={formatBitRate(details.bitRate)}/>
                    <InfoTerm term="Modified" value={new Date(file.modifiedAt).toLocaleString()}/>
                </dl>

                {!requested &&
                    <Button size="sm" className="self-start" variant="outline" onClick={() => setRequested(true)}>
                        Inspect streams
                    </Button>
                }

                {probe.isFetching && requested &&
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner/>
                        Inspecting streams…
                    </div>
                }

                {probe.isError && !probe.isFetching &&
                    <Alert variant="destructive">
                        <InfoIcon/>
                        <AlertTitle>Could not inspect streams</AlertTitle>
                        <AlertDescription className="flex flex-col items-start gap-2">
                            {probe.error.message}
                            <Button size="sm" variant="outline" onClick={() => void probe.refetch()}>
                                Try again
                            </Button>
                        </AlertDescription>
                    </Alert>
                }

                {details.probeError && !probe.isFetching &&
                    <Alert variant="destructive">
                        <InfoIcon/>
                        <AlertTitle>Could not inspect streams</AlertTitle>
                        <AlertDescription className="flex flex-col items-start gap-2">
                            {details.probeError}
                            <Button size="sm" variant="outline" onClick={() => void probe.refetch()}>
                                Try again
                            </Button>
                        </AlertDescription>
                    </Alert>
                }

                {!!details.streams.length &&
                    <StreamTable
                        streams={details.streams}
                    />
                }

                {!!file.externalSubtitles.length &&
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
                                {file.externalSubtitles.map((subtitle) =>
                                    <TableRow key={subtitle.id}>
                                        <TableCell>{subtitle.label}</TableCell>
                                        <TableCell>{subtitle.format.toUpperCase()}</TableCell>
                                        <TableCell className="max-w-md break-all">
                                            {subtitle.path}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                }
            </CardContent>
        </Card>
    );
}


function StreamTable({ streams }: { streams: MediaStreamInfo[] }) {
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
                    {streams.map((stream) =>
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
                    )}
                </TableBody>
            </Table>
        </div>
    );
}


function InfoTerm({ term, value }: { term: string; value: string | null }) {
    if (!value) return null;

    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="mt-0.5 truncate font-medium" title={value}>{value}</dd>
        </div>
    );
}


const streamDetails = (stream: MediaStreamInfo) => {
    if (stream.type === "video") {
        return [
            stream.frameRate ? `${stream.frameRate} fps` : null,
            stream.width && stream.height ? `${stream.width}×${stream.height}` : null,
        ].filter(Boolean).join(" · ") || "—";
    }

    if (stream.type === "audio") {
        return [
            stream.channelLayout,
            stream.channels ? `${stream.channels} channels` : null,
            stream.sampleRate ? `${Math.round(stream.sampleRate / 1000)} kHz` : null,
        ].filter(Boolean).join(" · ") || "—";
    }

    return stream.title ?? "—";
};


function MediaInfoSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-40"/>
            <Skeleton className="h-64 w-full rounded-xl"/>
        </div>
    );
}
