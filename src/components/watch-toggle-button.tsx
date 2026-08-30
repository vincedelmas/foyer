import {CheckIcon} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Spinner} from "@/components/ui/spinner";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";


interface WatchToggleButtonProps {
    label: string;
    watched: boolean;
    pending: boolean;
    className?: string;
    onToggle: () => void;
    unwatchedVariant?: "outline" | "secondary";
}


export function WatchToggleButton(props: WatchToggleButtonProps) {
    const { label, watched, pending, className, onToggle, unwatchedVariant = "outline" } = props;

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        size="icon-sm"
                        aria-label={label}
                        disabled={pending}
                        onClick={onToggle}
                        className={className}
                        aria-pressed={watched}
                        variant={watched ? "default" : unwatchedVariant}
                    />
                }
            >
                {pending
                    ? <Spinner/>
                    : <CheckIcon/>
                }
            </TooltipTrigger>
            <TooltipContent>
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    );
}
