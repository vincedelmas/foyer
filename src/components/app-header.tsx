import {Button} from "@/components/ui/button";
import {Link, useLocation} from "@tanstack/react-router";
import {ClapperboardIcon, Settings2Icon} from "lucide-react";


export function AppHeader() {
    const location = useLocation();

    return (
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/78 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-[100rem] items-center gap-5 px-4 sm:px-6 lg:px-10">
                <Link
                    to="/"
                    className="group flex shrink-0 items-center gap-2.5"
                >
                    <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground transition-transform
                    group-hover:-rotate-6">
                        <ClapperboardIcon className="size-4"/>
                    </span>
                    <span className="font-heading text-xl font-semibold tracking-tight">
                        Ploux
                    </span>
                </Link>

                <nav className="flex items-center">
                    <Button
                        size="sm"
                        nativeButton={false}
                        render={<Link to="/"/>}
                        variant={location.pathname === "/" ? "secondary" : "ghost"}
                    >
                        Home
                    </Button>
                </nav>

                <div className="ml-auto">
                    <Button
                        size="icon"
                        nativeButton={false}
                        render={<Link to="/admin"/>}
                        aria-label="Open settings"
                        title="Settings"
                        variant={location.pathname === "/admin" ? "secondary" : "ghost"}
                    >
                        <Settings2Icon/>
                    </Button>
                </div>
            </div>
        </header>
    );
}
