export type SourceLocation =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'url'; readonly url: string }
  | {
      readonly kind: 'inline'
      readonly uri: string
      readonly content: string
      readonly mediaType?: string
    }
