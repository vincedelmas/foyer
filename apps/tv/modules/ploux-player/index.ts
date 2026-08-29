import { requireNativeModule } from "expo"

interface PlouxPlayerSubtitle {
  id: string
  label: string
  language: string
  format: string
  url: string
  isDefault: boolean
}

export interface PlouxPlayerPart {
  id: string
  title: string
  fileName: string
  streamUrl: string
  resumePositionSeconds: number
  subtitles: PlouxPlayerSubtitle[]
}

export interface PlouxPlayerOptions {
  serverUrl: string
  mediaTitle: string
  startPartId: string
  parts: PlouxPlayerPart[]
}

interface PlouxPlayerResult {
  reason: "back" | "ended" | "error"
  partId?: string
  positionSeconds?: number
  durationSeconds?: number
  error?: string
}

interface PlouxPlayerNativeModule {
  play(optionsJson: string): Promise<PlouxPlayerResult>
}

const nativeModule = requireNativeModule<PlouxPlayerNativeModule>("PlouxPlayer")

export const playNativeMedia = (options: PlouxPlayerOptions) =>
  nativeModule.play(JSON.stringify(options))
