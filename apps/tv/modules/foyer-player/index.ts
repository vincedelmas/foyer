import { requireNativeModule } from "expo"

interface FoyerPlayerSubtitle {
  id: string
  label: string
  language: string
  format: string
  url: string
  isDefault: boolean
}

export interface FoyerPlayerPart {
  id: string
  title: string
  fileName: string
  streamUrl: string
  resumePositionSeconds: number
  subtitles: FoyerPlayerSubtitle[]
}

export interface FoyerPlayerOptions {
  serverUrl: string
  mediaTitle: string
  startPartId: string
  parts: FoyerPlayerPart[]
}

interface FoyerPlayerResult {
  reason: "back" | "ended" | "error"
  partId?: string
  positionSeconds?: number
  durationSeconds?: number
  error?: string
}

interface FoyerPlayerNativeModule {
  play(optionsJson: string): Promise<FoyerPlayerResult>
}

const nativeModule = requireNativeModule<FoyerPlayerNativeModule>("FoyerPlayer")

export const playNativeMedia = (options: FoyerPlayerOptions) =>
  nativeModule.play(JSON.stringify(options))
