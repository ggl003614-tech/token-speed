// Pure speed math: no `$`, so the tests can check it directly.

/** Below these, a step is too short for its rate to mean anything. */
export const MIN_TOKENS = 20
export const MIN_GEN_MS = 250

/** The clock readings of one model request, all in milliseconds. */
export type StepTiming = {
  /** The request was handed to the engine to send. */
  sentAt: number
  /** The first piece of the response arrived; absent when none did. */
  firstAt?: number
  /** The stop chunk arrived; absent when the response never finished. */
  endAt?: number
  /** Tokens generated, thinking included, as the API reported them. */
  outputTokens?: number
  model: string
}

export type StepSpeed = {
  tokens: number
  /** First piece to stop: how long the model spent generating. */
  genMs: number
  /** Request to first piece: queueing plus reading the prompt. */
  ttftMs: number
  /** Undefined when the step was too short to rate. */
  tokPerSec: number | undefined
  model: string
}

export type SpeedStats = {
  steps: number
  /** Steps long enough to rate; only these feed the average. */
  rated: number
  ratedTokens: number
  ratedGenMs: number
  ttftMsTotal: number
  fastest?: number
  slowest?: number
  last?: StepSpeed
}

export const EMPTY_STATS: SpeedStats = {
  steps: 0,
  rated: 0,
  ratedTokens: 0,
  ratedGenMs: 0,
  ttftMsTotal: 0,
}

export function measureStep(t: StepTiming): StepSpeed | undefined {
  if (t.firstAt === undefined || t.endAt === undefined || t.outputTokens === undefined) {
    return undefined
  }

  const genMs = Math.max(0, t.endAt - t.firstAt)
  const ttftMs = Math.max(0, t.firstAt - t.sentAt)
  const isRateable = t.outputTokens >= MIN_TOKENS && genMs >= MIN_GEN_MS

  return {
    tokens: t.outputTokens,
    genMs,
    ttftMs,
    tokPerSec: isRateable ? (t.outputTokens * 1000) / genMs : undefined,
    model: t.model,
  }
}

export function addStep(stats: SpeedStats, step: StepSpeed): SpeedStats {
  const rate = step.tokPerSec
  const next: SpeedStats = {
    ...stats,
    steps: stats.steps + 1,
    ttftMsTotal: stats.ttftMsTotal + step.ttftMs,
    last: step,
  }
  if (rate === undefined) return next

  return {
    ...next,
    rated: stats.rated + 1,
    ratedTokens: stats.ratedTokens + step.tokens,
    ratedGenMs: stats.ratedGenMs + step.genMs,
    fastest: Math.max(stats.fastest ?? rate, rate),
    slowest: Math.min(stats.slowest ?? rate, rate),
  }
}

/** Token-weighted: a long answer counts for more than a one-line reply. */
export function averageRate(stats: SpeedStats): number | undefined {
  return stats.ratedGenMs > 0 ? (stats.ratedTokens * 1000) / stats.ratedGenMs : undefined
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`
const rate = (r: number) => `${Math.round(r)} tok/s`

export function formatStatus(stats: SpeedStats): string | undefined {
  const last = stats.last
  if (last === undefined) return undefined

  const parts: string[] = []
  if (last.tokPerSec !== undefined) parts.push(rate(last.tokPerSec))
  parts.push(`首字 ${seconds(last.ttftMs)}`)
  const avg = averageRate(stats)
  if (avg !== undefined) parts.push(`均速 ${rate(avg)}`)

  return `⚡ ${parts.join(' · ')}`
}

export function formatSummary(stats: SpeedStats): string {
  if (stats.steps === 0) return '本会话还没有测到模型输出。'

  const avg = averageRate(stats)
  const lines = [
    `吐词速度 · ${stats.last?.model ?? ''}`,
    `  平均速度   ${avg === undefined ? '—' : rate(avg)}`,
    `  最快 / 最慢 ${stats.fastest === undefined ? '—' : rate(stats.fastest)} / ${stats.slowest === undefined ? '—' : rate(stats.slowest)}`,
    `  平均首字   ${seconds(stats.ttftMsTotal / stats.steps)}`,
    `  共输出     ${stats.ratedTokens} tokens（${stats.rated} 次计速 / ${stats.steps} 次请求）`,
  ]
  if (stats.rated < stats.steps) {
    lines.push(`  少于 ${MIN_TOKENS} token 的短回复只记首字延迟，不计速度。`)
  }

  return lines.join('\n')
}
