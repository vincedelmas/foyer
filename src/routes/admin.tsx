import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  DatabaseIcon,
  FilmIcon,
  FolderSyncIcon,
  LibraryIcon,
  ScanSearchIcon,
  SparklesIcon,
} from "lucide-react"

import { AppHeader } from "@/components/app-header"
import { LibrariesTable } from "@/components/admin/libraries-table"
import { LibraryForm } from "@/components/admin/library-form"
import { TmdbForm } from "@/components/admin/tmdb-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"

export const Route = createFileRoute("/admin")({ component: AdminPage })

function AdminPage() {
  const queryClient = useQueryClient()
  const admin = useQuery({ queryKey: ["admin"], queryFn: api.admin })
  const library = useQuery({
    queryKey: ["library", "admin-stats"],
    queryFn: () => api.library({}),
  })
  const scanAll = useMutation({
    mutationFn: () => api.scan(),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin"] }),
        queryClient.invalidateQueries({ queryKey: ["library"] }),
      ])
      toast.add({
        title: "All libraries scanned",
        description: `${result.scans.length} libraries completed.`,
        type: "success",
      })
    },
    onError: (error) =>
      toast.add({
        title: "Scan failed",
        description: error.message,
        type: "error",
      }),
  })

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto flex max-w-[100rem] flex-col gap-8 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
              Control room
            </p>
            <h1 className="font-heading text-5xl font-medium tracking-tight sm:text-6xl">
              Administration
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Point Ploux at folders, scan files, and keep metadata tidy. Files
              are always read-only.
            </p>
          </div>
          <Button
            onClick={() => scanAll.mutate()}
            disabled={scanAll.isPending || !admin.data?.libraries.length}
          >
            {scanAll.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <FolderSyncIcon data-icon="inline-start" />
            )}
            Scan all libraries
          </Button>
        </div>

        <Alert>
          <ScanSearchIcon />
          <AlertTitle>Built for a trusted home network</AlertTitle>
          <AlertDescription>
            Ploux has no accounts or permission system. Do not expose it
            directly to the public internet without an authenticated reverse
            proxy.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FilmIcon}
            title="Titles"
            value={library.data?.stats.titles}
          />
          <StatCard
            icon={LibraryIcon}
            title="Libraries"
            value={admin.data?.libraries.length}
          />
          <StatCard
            icon={SparklesIcon}
            title="Unmatched"
            value={library.data?.stats.unmatched}
          />
          <StatCard
            icon={DatabaseIcon}
            title="In progress"
            value={library.data?.stats.inProgress}
          />
        </div>

        <Tabs defaultValue="libraries" className="gap-6">
          <TabsList variant="line">
            <TabsTrigger value="libraries">Libraries</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="libraries">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add a media folder</CardTitle>
                  <CardDescription>
                    Use an absolute path visible to the server. Series and anime
                    should have one top-level folder per show.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LibraryForm />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Indexed libraries</CardTitle>
                  <CardDescription>
                    Removing a library deletes its index only. Your media
                    remains untouched.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {admin.isPending ? (
                    <Skeleton className="h-40 w-full" />
                  ) : null}
                  {admin.data?.libraries.length ? (
                    <LibrariesTable libraries={admin.data.libraries} />
                  ) : (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      No folders have been added yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="metadata">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  TMDB connection{" "}
                  {admin.data?.tmdbConfigured ? (
                    <Badge>Connected</Badge>
                  ) : (
                    <Badge variant="secondary">Not configured</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Used for posters, synopses, cast, seasons, ratings, and
                  runtime. Artwork is loaded from TMDB&apos;s image CDN.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TmdbForm
                  environmentManaged={admin.data?.tmdbSource === "environment"}
                />
              </CardContent>
            </Card>
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
                  {admin.data?.scans.map((scan) => (
                    <div
                      key={scan.id}
                      className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {scan.status === "completed"
                            ? `${scan.filesSeen} files indexed`
                            : scan.status === "running"
                              ? "Scan in progress"
                              : "Scan failed"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(scan.startedAt).toLocaleString()} ·{" "}
                          {scan.titlesAdded} new titles · {scan.subtitlesFound}{" "}
                          subtitles
                        </p>
                      </div>
                      <Badge
                        variant={
                          scan.status === "failed"
                            ? "destructive"
                            : scan.status === "completed"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {scan.status}
                      </Badge>
                    </div>
                  ))}
                  {!admin.data?.scans.length ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      No scans have run yet.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

function StatCard({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  value: number | undefined
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardDescription>{title}</CardDescription>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="font-heading text-4xl font-medium">{value ?? "—"}</p>
      </CardContent>
    </Card>
  )
}
