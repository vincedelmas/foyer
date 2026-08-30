import {useState} from "react";
import {MediaSummary} from "@ploux/contracts";
import {IdentifyDialog} from "./IdentifyDialog";
import {MediaInfoDialog} from "./MediaInfoDialog";
import {MediaActionsDialog} from "./MediaActionsDialog";


export const useMediaDialogs = () => {
    const [info, setInfo] = useState<MediaSummary | null>(null);
    const [actions, setActions] = useState<MediaSummary | null>(null);
    const [identify, setIdentify] = useState<MediaSummary | null>(null);

    return {
        info,
        actions,
        identify,
        openInfo: setInfo,
        openActions: setActions,
        openIdentify: setIdentify,
    }
}


export function MediaDialogs({ server, controller }: { server: string, controller: ReturnType<typeof useMediaDialogs> }) {
    return (
        <>
            <MediaActionsDialog
                server={server}
                item={controller.actions}
                onInfo={controller.openInfo}
                onIdentify={controller.openIdentify}
                visible={controller.actions !== null}
                onClose={() => controller.openActions(null)}
            />
            <IdentifyDialog
                server={server}
                media={controller.identify}
                visible={controller.identify !== null}
                onClose={() => controller.openIdentify(null)}
            />
            <MediaInfoDialog
                server={server}
                visible={controller.info !== null}
                title={controller.info?.title ?? ""}
                mediaId={controller.info?.id ?? null}
                onClose={() => controller.openInfo(null)}
            />
        </>
    );
}
