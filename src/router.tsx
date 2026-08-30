import {routeTree} from "./routeTree.gen";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {createRouter as createTanStackRouter} from "@tanstack/react-router";


export function getRouter() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: 1,
                staleTime: 30_000,
                refetchOnWindowFocus: false,
            },
        },
    });

    const router = createTanStackRouter({
        routeTree,
        defaultPreload: false,
        scrollRestoration: true,
        context: { queryClient },
        defaultErrorComponent: RouteError,
        defaultPendingComponent: RoutePending,
        Wrap: ({ children }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    });

    return router;
}


function RoutePending() {
    return (
        <main className="grid min-h-svh place-items-center">
            <Spinner className="size-8"/>
        </main>
    );
}


function RouteError({ error, reset }: { error: Error, reset: () => void }) {
    return (
        <main className="grid min-h-svh place-items-center px-6">
            <div className="flex max-w-md flex-col items-center gap-5 text-center">
                <div className="flex flex-col gap-2">
                    <h1 className="font-heading text-4xl">
                        Could not open this page
                    </h1>
                    <p className="text-muted-foreground">
                        {error.message}
                    </p>
                </div>
                <Button onClick={reset}>
                    Try again
                </Button>
            </div>
        </main>
    );
}


declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}
