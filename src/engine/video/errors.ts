export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled')
    this.name = 'ExportCancelledError'
  }
}
