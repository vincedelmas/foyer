import { Store } from "@tanstack/react-store"

interface PlayerState {
  activePartId: string | null
  currentSeconds: number
  durationSeconds: number
  playing: boolean
}

export const playerStore = new Store<PlayerState>({
  activePartId: null,
  currentSeconds: 0,
  durationSeconds: 0,
  playing: false,
})

export const updatePlayer = (patch: Partial<PlayerState>) => {
  playerStore.setState((state) => ({ ...state, ...patch }))
}
