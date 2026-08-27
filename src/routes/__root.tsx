import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Ploux — Your cinema, at home",
      },
      {
        name: "description",
        content: "A small, direct-play home media library.",
      },
      {
        name: "theme-color",
        content: "#11100e",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      })
  )

  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh bg-background text-foreground antialiased">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
          {import.meta.env.DEV ? (
            <ReactQueryDevtools buttonPosition="bottom-left" />
          ) : null}
        </QueryClientProvider>
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "TanStack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <p className="font-heading text-8xl font-light text-primary italic">
          404
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl">
            This reel isn&apos;t in the archive.
          </h1>
          <p className="text-muted-foreground">
            The page may have moved, or the title was removed.
          </p>
        </div>
        <Button render={<Link to="/" />} nativeButton={false}>
          Return to library
        </Button>
      </div>
    </main>
  )
}
