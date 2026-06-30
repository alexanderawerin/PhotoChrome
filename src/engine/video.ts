/** Public video API. Implementation is split by responsibility under ./video/. */
export { getExportCapabilities, isVideoCodecSupported, isVideoFile, supportsVideoExport, testVideoEncoderWorks } from './video/capabilities'
export { supportsAudioEncoding } from './video/audio'
export { ExportCancelledError } from './video/errors'
export { createVideoThumbnail, extractFirstFrame, loadVideo } from './video/frames'
export type { VideoMetadata } from './video/frames'
export { exportVideo } from './video/export'
