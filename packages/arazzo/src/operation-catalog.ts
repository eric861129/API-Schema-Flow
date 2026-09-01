export interface ArazzoCatalogOperation {
  readonly key: string
  readonly operationId?: string
  readonly operationPath?: string
}

export interface ArazzoOperationCatalog {
  readonly sourceName: string
  readonly sourceUri: string
  readonly sourceType: string
  readonly operations: readonly ArazzoCatalogOperation[]
}
