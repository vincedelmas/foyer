import React from "react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {AppHeader} from "@/components/app-header";
import {createFileRoute} from "@tanstack/react-router";
import {useSuspenseQuery} from "@tanstack/react-query";
import {LibraryForm} from "@/components/settings/library-form";
import {useScanAllLibrariesMutation} from "@/lib/query-mutations";
import {LibrariesTable} from "@/components/settings/libraries-table";
import {settingsLibraryOptions, settingsOptions} from "@/lib/query-options";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {DatabaseIcon, FilmIcon, FolderSyncIcon, LibraryIcon, SparklesIcon} from "lucide-react";


export const Route = createFileRoute("/settings")({
    context: () => ({
        settingsQueryOptions: settingsOptions,
        libraryQueryOptions: settingsLibraryOptions,
    }),
    loader: ({ context }) => Promise.all([
        context.queryClient.query(context.libraryQueryOptions),
        context.queryClient.query(context.settingsQueryOptions),
    ]),
    component: SettingsPage,
});


function SettingsPage() {
    const { libraryQueryOptions, settingsQueryOptions } = Route.useRouteContext();

    const scanAll = useScanAllLibrariesMutation();
    const library = useSuspenseQuery(libraryQueryOptions).data;
    const settings = useSuspenseQuery(settingsQueryOptions).data;

    return (
        <div className="min-h-svh">
            <AppHeader/>

            <main className="mx-auto flex max-w-[100rem] flex-col gap-8 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                    <div>
                        <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                            Foyer settings
                        </p>
                        <h1 className="font-heading text-5xl font-medium tracking-tight sm:text-6xl">
                            Settings
                        </h1>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                            Create your media folders, point them at the server, and keep
                            metadata tidy. Files are only removed after an explicit
                            permanent-delete confirmation.
                        </p>
                    </div>
                    <Button onClick={() => scanAll.mutate()} disabled={scanAll.isPending || !settings.libraries.length}>
                        {scanAll.isPending
                            ? <Spinner data-icon="inline-start"/>
                            : <FolderSyncIcon data-icon="inline-start"/>
                        }
                        Scan all folders
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title="Titles"
                        icon={FilmIcon}
                        value={library.stats.titles}
                    />
                    <StatCard
                        icon={LibraryIcon}
                        title="Media folders"
                        value={settings.libraries.length}
                    />
                    <StatCard
                        title="Unmatched"
                        icon={SparklesIcon}
                        value={library.stats.unmatched}
                    />
                    <StatCard
                        icon={DatabaseIcon}
                        title="In progress"
                        value={library.stats.inProgress}
                    />
                </div>

                <Tabs defaultValue="libraries" className="gap-6">
                    <TabsList variant="line">
                        <TabsTrigger value="libraries">Media folders</TabsTrigger>
                        <TabsTrigger value="activity">Activity</TabsTrigger>
                    </TabsList>

                    <TabsContent value="libraries">
                        <div className="flex flex-col gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Add a media folder</CardTitle>
                                    <CardDescription>
                                        Give it any name you like, then choose an absolute server
                                        path and whether it contains movies or TV shows.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <LibraryForm/>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Your media folders</CardTitle>
                                    <CardDescription>
                                        Removing a media folder deletes its index only. Your media
                                        remains untouched.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {settings.libraries.length ?
                                        <LibrariesTable
                                            libraries={settings.libraries}
                                        />
                                        :
                                        <p className="py-12 text-center text-sm text-muted-foreground">
                                            No media folders have been added yet.
                                        </p>
                                    }
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="activity">
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent scans</CardTitle>
                                <CardDescription>
                                    The last 25 indexing jobs on this server.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col gap-3">
                                    {settings.scans.map((scan) => (
                                        <div key={scan.id} className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {scan.status === "completed"
                                                        ? `${scan.filesSeen} files indexed`
                                                        : scan.status === "running"
                                                            ? "Scan in progress"
                                                            : "Scan failed"
                                                    }
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {new Date(scan.startedAt).toLocaleString()} ·{" "}
                                                    {scan.titlesAdded} new titles · {scan.subtitlesFound}{" "}
                                                    subtitles
                                                </p>
                                            </div>
                                            <Badge
                                                variant={scan.status === "failed" ? "destructive"
                                                    : scan.status === "completed" ? "default" : "secondary"
                                                }
                                            >
                                                {scan.status}
                                            </Badge>
                                        </div>
                                    ))}
                                    {!settings.scans.length &&
                                        <p className="py-12 text-center text-sm text-muted-foreground">
                                            No scans have run yet.
                                        </p>
                                    }
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}


interface StatCard {
    title: string;
    value: number | undefined;
    icon: React.ComponentType<{ className?: string }>;
}


function StatCard({ icon: Icon, title, value }: StatCard) {
    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardDescription>{title}</CardDescription>
                <Icon className="size-4 text-muted-foreground"/>
            </CardHeader>
            <CardContent>
                <p className="font-heading text-4xl font-medium">
                    {value ?? "—"}
                </p>
            </CardContent>
        </Card>
    );
}
