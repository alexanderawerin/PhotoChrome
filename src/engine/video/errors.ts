export class AudioPreservationError extends Error {
  constructor() {
    super('Sound cannot be preserved in this browser. Choose Export without sound, or try another browser to keep the audio.')
    this.name = 'AudioPreservationError'
  }
}

export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled')
    this.name = 'ExportCancelledError'
  }
}

interface ClosableCodec {
  readonly state: string
  close: () => void
}

/** WebCodecs may transition to `closed` asynchronously after an encoder error. */
export function closeCodecSafely(codec: ClosableCodec): void {
  if (codec.state === 'closed') return
  try {
    codec.close()
  } catch {
    // Cleanup must never replace the original encoding error.
  }
}
