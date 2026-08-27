import {Store} from "@tanstack/react-store";


interface PlayerState {
    playing: boolean;
    currentSeconds: number;
    durationSeconds: number;
    activePartId: string | null;
}


export const playerStore = new Store<PlayerState>({
    playing: false,
    currentSeconds: 0,
    durationSeconds: 0,
    activePartId: null,
})


export const updatePlayer = (patch: Partial<PlayerState>) => {
    playerStore.setState((state) => ({ ...state, ...patch }))
}
