import type { Register } from 'claude-code'

import { addStep, EMPTY_STATS, formatStatus, formatSummary, measureStep } from './speed'
import type { SpeedStats } from './speed'

const COMMAND = 'speed'

export const register: Register = on => {
  // Module state: a hot reload of the mod starts the tally over.
  let stats: SpeedStats = EMPTY_STATS

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: '查看本会话 Claude 的吐词速度统计',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async () => ({ text: formatSummary(stats) }))

  on('turn.step', async function* ($, e, next) {
    // Subagents run in parallel with the main loop; timing them here would
    // overwrite the number the person is watching.
    if (e.agentId !== undefined) return yield* next(e)

    const sentAt = await $.clock.now()
    const stream = next(e)
    let firstAt: number | undefined
    let endAt: number | undefined

    for await (const chunk of stream) {
      // Read the clock as each piece arrives, before handing it up, so the
      // time the screen takes to draw it is not counted as generation.
      if (firstAt === undefined) firstAt = await $.clock.now()
      if (chunk.kind === 'stop') endAt = await $.clock.now()
      yield chunk
    }

    const result = await stream.result
    const step = measureStep({
      sentAt,
      firstAt,
      endAt,
      outputTokens: result.usage?.output_tokens,
      model: result.usage?.model ?? e.model,
    })
    if (step !== undefined) {
      stats = addStep(stats, step)
      $.ui.status(formatStatus(stats))
    }

    return result
  })
}
