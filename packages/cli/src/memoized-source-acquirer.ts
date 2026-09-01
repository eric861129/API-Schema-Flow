import type {
  SourceAcquirer,
  SourceAcquisitionContext,
  SourceAcquisitionResult,
  SourceLocation,
} from '@api-schema-flow/source-loader'

function locationKey(location: SourceLocation): string {
  switch (location.kind) {
    case 'file':
      return `file:${location.path}`
    case 'url':
      return `url:${location.url}`
    case 'inline':
      return `inline:${location.uri}\n${location.content}`
  }
}

export function createMemoizedSourceAcquirer(base: SourceAcquirer): SourceAcquirer {
  const cache = new Map<string, Promise<SourceAcquisitionResult>>()
  const accountedBudgets = new Map<string, WeakSet<object>>()

  return {
    ...(base.resolveLocation === undefined
      ? {}
      : {
          resolveLocation: (reference: string, parentUri: string) =>
            base.resolveLocation!(reference, parentUri),
        }),
    async acquire(location: SourceLocation, context: SourceAcquisitionContext) {
      const key = locationKey(location)
      let pending = cache.get(key)
      if (!pending) {
        pending = base.acquire(location, context)
        cache.set(key, pending)
        const budgets = new WeakSet<object>()
        budgets.add(context.budget)
        accountedBudgets.set(key, budgets)
        return pending
      }

      const result = await pending
      if (!result.source) return result
      const budgets = accountedBudgets.get(key) ?? new WeakSet<object>()
      if (budgets.has(context.budget)) return result

      const depthDiagnostics = context.budget.checkReferenceDepth(
        result.source.uri,
        context.depth ?? 0,
      )
      if (depthDiagnostics.length > 0) return { diagnostics: depthDiagnostics }
      const budgetDiagnostics = context.budget.consumeDocument(
        result.source.uri,
        result.source.byteLength,
      )
      if (budgetDiagnostics.length > 0) return { diagnostics: budgetDiagnostics }
      budgets.add(context.budget)
      accountedBudgets.set(key, budgets)
      return result
    },
  }
}
