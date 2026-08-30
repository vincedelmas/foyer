import {api} from "@/lib/api";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {useSelector} from "@tanstack/react-store";
import {useEffect, useRef, useState} from "react";
import {createFileRoute, Link} from "@tanstack/react-router";
import {playerStore, updatePlayer} from "@/lib/player-store";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowLeftIcon, CaptionsIcon, ExpandIcon, FileWarningIcon, GaugeIcon} from "lucide-react";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";


export const Route = createFileRoute("/watch/$mediaId/$partId")({
    component: WatchPage,
})


function WatchPage() {
    const { mediaId, partId } = Route.useParams();
    const media = useQuery({
        queryKey: ["media", mediaId],
        queryFn: () => api.media(mediaId),
    });

    if (media.isPending) {
        return (
            <div className="grid min-h-svh place-items-center bg-black">
                <Spinner className="size-8 text-white"/>
            </div>
        );
    }

    if (media.isError) {
        return (
            <div className="grid min-h-svh place-items-center bg-black p-6 text-white">
                <p>{media.error.message}</p>
            </div>
        );
    }

    const part = media.data.parts.find((candidate) => candidate.id === partId);

    if (!part) {
        return (
            <PlayerUnavailable
                mediaId={mediaId}
                title="This episode is no longer available"
                description="It is no longer part of this title. Rescan its collection if files were moved or deleted."
            />
        );
    }

    return (
        <DirectPlayer
            part={part}
            mediaId={mediaId}
            mediaTitle={media.data.title}
        />
    );
}


interface DirectPlayerProps {
    mediaId: string;
    mediaTitle: string;
    part: import("@ploux/contracts").MediaPart;
}


function DirectPlayer({ mediaTitle, mediaId, part }: DirectPlayerProps) {
    const availability = useQuery({
        queryKey: ["stream-availability", part.id],
        queryFn: async ({ signal }) => {
            const response = await fetch(part.streamUrl, {
                method: "HEAD",
                signal,
            });

            if (response.status === 404) return false;

            if (!response.ok) {
                throw new Error(`The media server responded with status ${response.status}.`)
            }

            return true;
        },
        retry: false,
    })

    if (availability.isPending) {
        return (
            <div className="grid min-h-svh place-items-center bg-black">
                <Spinner className="size-8 text-white"/>
            </div>
        );
    }

    if (availability.isError) {
        return (
            <PlayerUnavailable
                mediaId={mediaId}
                description={availability.error.message}
                title={`Could not check “${mediaTitle}”`}
            />
        );
    }

    if (!availability.data) {
        return (
            <PlayerUnavailable
                mediaId={mediaId}
                title={`“${mediaTitle}” is unavailable`}
                description="Ploux can no longer find this file on the server. It may have been moved or deleted. Rescan its
                collection to remove the stale entry."
            />
        );
    }

    return (
        <ReadyPlayer
            part={part}
            mediaId={mediaId}
            mediaTitle={mediaTitle}
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
    part: import("@ploux/contracts").MediaPart;
}


function ReadyPlayer({ mediaTitle, mediaId, part }: ReadyPlayerProps) {
    const queryClient = useQueryClient();
    const lastSavedAt = useRef(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const playing = useSelector(playerStore, (state) => state.playing);
    const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(part.subtitles.find((s) => s.isDefault)?.id ?? null);

    const save = useMutation({
        mutationFn: (value: { positionSeconds: number; durationSeconds: number }) => api.progress({ partId: part.id, ...value }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["library"] });
            void queryClient.invalidateQueries({ queryKey: ["media", mediaId] });
            void queryClient.invalidateQueries({ queryKey: ["currently-watching"] });
        },
    })

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
                        Ploux will not transcode it. Try the Android TV app or a browser
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
