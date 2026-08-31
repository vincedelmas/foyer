import React from "react";
import appCss from "../styles.css?url";
import {Button} from "@/components/ui/button";
import {Toaster} from "@/components/ui/toast";
import {QueryClient} from "@tanstack/react-query";
import {TooltipProvider} from "@/components/ui/tooltip";
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";
import {createRootRouteWithContext, HeadContent, Link, Scripts} from "@tanstack/react-router";


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    head: () => ({
        meta: [
            { charSet: "utf-8" },
            { title: "Foyer — Your media, at home" },
            { name: "theme-color", content: "#11100e" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { name: "description", content: "A small, direct-play home media library." },
        ],
        links: [
            { rel: "stylesheet", href: appCss },
            { rel: "icon", href: "/favicon.ico", sizes: "any" },
            { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
            { rel: "manifest", href: "/manifest.json" },
        ],
    }),
    notFoundComponent: NotFound,
    shellComponent: RootDocument,
});


function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
        <head>
            <HeadContent/>
        </head>
        <body className="min-h-svh bg-background text-foreground antialiased">
        <TooltipProvider>
            <Toaster>{children}</Toaster>
        </TooltipProvider>

        {import.meta.env.DEV &&
            <ReactQueryDevtools
                buttonPosition="bottom-left"
            />
        }
        <Scripts/>
        </body>
        </html>
    );
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
                <Button render={<Link to="/"/>} nativeButton={false}>
                    Return to library
                </Button>
            </div>
        </main>
    );
}
