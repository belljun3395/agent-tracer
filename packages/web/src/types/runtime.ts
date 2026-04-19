export type EvidenceLevel = 'proven' | 'inferred' | 'self_reported' | 'unavailable'

export interface RuntimeCoverageItem {
  readonly key: string
  readonly label: string
  readonly level: EvidenceLevel
  readonly note: string
  readonly automatic?: boolean
}
