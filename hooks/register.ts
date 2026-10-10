import type { EngineInterface, Register } from 'claude-code'

import { isLang, pickLanguage, STRINGS } from './i18n'
import type { Lang } from './i18n'
import { addStep, EMPTY_STATS, formatStatus, formatSummary, measureStep } from './speed'
import type { SpeedStats } from './speed'

const COMMAND = 'speed'

/** Each source read on its own: one that fails or is missing is skipped. */
async function detectLanguage($: EngineInterface): Promise<Lang> {
  const settingLanguage = await $.settings
    .read()
    .then(s => (typeof s.language === 'string' ? s.language : undefined))
    .catch(() => undefined)
  const envLocale =
    (await $.env.get('LC_ALL').catch(() => undefined)) ||
    (await $.env.get('LC_MESSAGES').catch(() => undefined)) ||
    (await $.env.get('LANG').catch(() => undefined))
  let systemLocale: string | undefined
  try {
    systemLocale = Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    systemLocale = undefined
  }

  return pickLanguage({ settingLanguage, envLocale, systemLocale })
}

export const register: Register = (on, options) => {
  // Module state: a hot reload of the mod starts the tally over.
  let stats: SpeedStats = EMPTY_STATS
  let lang: Lang | undefined = isLang(options.language) ? options.language : undefined

  on('session.start', async ($, e, next) => {
    lang ??= await detectLanguage($)
    await $.command.register({ name: COMMAND, description: STRINGS[lang].commandDescription })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    lang ??= await detectLanguage($)

    return { text: formatSummary(stats, STRINGS[lang]) }
  })

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
      lang ??= await detectLanguage($)
      $.ui.status(formatStatus(stats, STRINGS[lang]))
    }

    return result
  })
}
