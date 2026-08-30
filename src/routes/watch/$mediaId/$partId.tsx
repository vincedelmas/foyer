import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {useSelector} from "@tanstack/react-store";
import {useEffect, useRef, useState} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {playerStore, updatePlayer} from "@/lib/player-store";
import {useSaveProgressMutation} from "@/lib/query-mutations";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {mediaOptions, streamAvailabilityOptions} from "@/lib/query-options";
import {ArrowLeftIcon, CaptionsIcon, ExpandIcon, FileWarningIcon, GaugeIcon} from "lucide-react";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";


export const Route = createFileRoute("/watch/$mediaId/$partId")({
    context: ({ params: { mediaId, partId } }) => ({
        mediaQueryOptions: mediaOptions(mediaId),
        streamAvailabilityQueryOptions: streamAvailabilityOptions(partId),
    }),
    loader: ({ context }) => Promise.all([
        context.queryClient.query(context.mediaQueryOptions),
        context.queryClient.query(context.streamAvailabilityQueryOptions),
    ]),
    component: WatchPage,
});


function WatchPage() {
    const { mediaId, partId } = Route.useParams();
    const { mediaQueryOptions, streamAvailabilityQueryOptions } = Route.useRouteContext();

    const media = useSuspenseQuery(mediaQueryOptions).data;
    const available = useSuspenseQuery(streamAvailabilityQueryOptions).data;
    const part = media.parts.find((candidate) => candidate.id === partId);

    if (!part) {
        return (
            <PlayerUnavailable
                mediaId={mediaId}
                title="This episode is no longer available"
                description="It is no longer part of this title. Rescan its collection if files were moved or deleted."
            />
        );
    }

    if (!available) {
        return (
            <PlayerUnavailable
                mediaId={mediaId}
                title={`“${media.title}” is unavailable`}
                description="Foyer can no longer find this file on the server. It may have been moved or deleted. Rescan its
                collection to remove the stale entry."
            />
        );
    }

    return (
        <ReadyPlayer
            part={part}
            mediaId={mediaId}
            mediaTitle={media.title}
        />
    );
}


interface PlayerUnavailableProps {
    title: string;
    mediaId: string;
    description: string;
}


function PlayerUnavailable({ mediaId, title, description }: PlayerUnavailableProps) {
    return (
        <main className="grid min-h-svh place-items-center bg-black p-6 text-white">
            <Alert className="max-w-xl border-white/15 bg-white/5 text-white">
                <FileWarningIcon/>
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-4 text-white/65">
                    <p>{description}</p>
                    <Button variant="secondary" render={<Link to="/media/$id" params={{ id: mediaId }}/>} nativeButton={false}>
                        <ArrowLeftIcon data-icon="inline-start"/>
                        Back to title
                    </Button>
                </AlertDescription>
            </Alert>
        </main>
    );
}


interface ReadyPlayerProps {
    mediaId: string;
    mediaTitle: string;
    part: import("@foyer/contracts").MediaPart;
}


function ReadyPlayer({ mediaTitle, mediaId, part }: ReadyPlayerProps) {
    const lastSavedAt = useRef(0);
    const save = useSaveProgressMutation(mediaId, part.id);
    const videoRef = useRef<HTMLVideoElement>(null);
    const playing = useSelector(playerStore, (state) => state.playing);
    const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(part.subtitles.find((s) => s.isDefault)?.id ?? null);

    const saveCurrentProgress = () => {
        const video = videoRef.current;
        if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;

        lastSavedAt.current = Date.now();

        save.mutate({
            durationSeconds: video.duration,
            positionSeconds: video.currentTime,
        });
    }

    useEffect(() => {
        updatePlayer({ playing: false, currentSeconds: 0, durationSeconds: 0, activePartId: part.id });

        const handleKey = (event: KeyboardEvent) => {
            const video = videoRef.current;
            if (!video) return;

            if (event.key === " " && event.target === document.body) {
                event.preventDefault();
                if (video.paused) void video.play();
                else video.pause();
            }

            if (event.key === "ArrowRight") {
                video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
            }

            if (event.key === "ArrowLeft") {
                video.currentTime = Math.max(0, video.currentTime - 10);
            }

            if (event.key.toLowerCase() === "f") {
                void video.requestFullscreen();
            }
        }
        window.addEventListener("keydown", handleKey)
        return () => {
            window.removeEventListener("keydown", handleKey);
            updatePlayer({ activePartId: null, playing: false });
        }
    }, [part.id]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        for (const track of Array.from(video.textTracks)) {
            track.mode = track.id === selectedSubtitle ? "showing" : "disabled";
        }

    }, [selectedSubtitle]);

    const subtitleItems = [
        { label: "Subtitles off", value: null },
        ...part.subtitles.map((subtitle) => ({ label: subtitle.label, value: subtitle.id })),
    ];

    const webCompatible = ["video/mp4", "video/webm", "video/ogg"].includes(part.mimeType);

    const episodeLabel = part.episodeNumber
        ? `S${String(part.seasonNumber ?? 1).padStart(2, "0")} E${String(part.episodeNumber).padStart(2, "0")}${part.title ? ` · ${part.title}` : ""}`
        : null;

    return (
        <main className="relative grid min-h-svh place-items-center overflow-hidden bg-black text-white">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-linear-to-b from-black/80 to-transparent p-4 pb-16 sm:p-6">
                <Button
                    size="icon"
                    variant="ghost"
                    nativeButton={false}
                    aria-label="Leave player"
                    render={<Link to="/media/$id" params={{ id: mediaId }}/>}
                >
                    <ArrowLeftIcon/>
                </Button>
                <div className="min-w-0">
                    <h1 className="truncate font-heading text-xl font-medium sm:text-2xl">
                        {mediaTitle}
                    </h1>
                    {!!episodeLabel &&
                        <p className="truncate text-xs text-white/65">
                            {episodeLabel}
                        </p>
                    }
                </div>
                <Badge variant="secondary" className="ml-auto hidden sm:inline-flex">
                    <GaugeIcon data-icon="inline-start"/>
                    Direct play
                </Badge>
                {part.subtitles.length &&
                    <Select items={subtitleItems} value={selectedSubtitle} onValueChange={setSelectedSubtitle}>
                        <SelectTrigger aria-label="Choose subtitles">
                            <CaptionsIcon/>
                            <SelectValue/>
                        </SelectTrigger>
                        <SelectContent align="end" alignItemWithTrigger={false}>
                            <SelectGroup>
                                {subtitleItems.map((subtitle) => (
                                    <SelectItem key={subtitle.value ?? "off"} value={subtitle.value}>
                                        {subtitle.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                }
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Enter fullscreen"
                    onClick={() => void videoRef.current?.requestFullscreen()}
                >
                    <ExpandIcon/>
                </Button>
            </div>

            {!webCompatible &&
                <Alert className="absolute top-24 left-1/2 z-10 max-w-xl -translate-x-1/2 bg-black/75 text-white backdrop-blur">
                    <AlertTitle>This container may not play in your browser</AlertTitle>
                    <AlertDescription className="text-white/70">
                        Foyer will not transcode it. Try the Android TV app or a browser
                        that supports {part.mimeType}.
                    </AlertDescription>
                </Alert>
            }

            <video
                controls
                autoPlay
                playsInline
                ref={videoRef}
                preload="metadata"
                src={part.streamUrl}
                onEnded={saveCurrentProgress}
                className="max-h-svh max-w-full bg-black"
                onPlay={() => updatePlayer({ playing: true })}
                onPause={() => {
                    updatePlayer({ playing: false });
                    saveCurrentProgress();
                }}
                onLoadedMetadata={(ev) => {
                    const video = ev.currentTarget;

                    if (part.progress && !part.progress.completed && part.progress.positionSeconds > 0) {
                        video.currentTime = Math.min(part.progress.positionSeconds, Math.max(0, video.duration - 1));
                    }

                    updatePlayer({ durationSeconds: video.duration, currentSeconds: video.currentTime });
                }}
                onTimeUpdate={(ev) => {
                    const video = ev.currentTarget;
                    updatePlayer({ currentSeconds: video.currentTime, durationSeconds: video.duration });
                    if (Date.now() - lastSavedAt.current >= 10_000) {
                        saveCurrentProgress();
                    }
                }}
            >
                {part.subtitles.map((subtitle) => (
                    <track
                        id={subtitle.id}
                        kind="subtitles"
                        key={subtitle.id}
                        src={subtitle.url}
                        label={subtitle.label}
                        srcLang={subtitle.language}
                        default={subtitle.isDefault}
                    />
                ))}
            </video>
            <span className="sr-only" aria-live="polite">
                {playing ? "Playing" : "Paused"}
            </span>
        </main>
    );
}
