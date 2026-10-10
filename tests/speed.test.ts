import { describe, expect, mock, test } from 'claude-code/testing'
import type { TurnStepChunk, TurnStepResult, TurnUsage } from 'claude-code'

import { pickLanguage, STRINGS } from '../hooks/i18n'
import { addStep, EMPTY_STATS, formatStatus, measureStep } from '../hooks/speed'

const usage = (output_tokens: number): TurnUsage => ({
  input_tokens: 10,
  output_tokens,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  model: 'claude-test',
})

/** A response that starts after `ttftMs` and streams for `genMs`. */
function streamingBottom(clock: ReturnType<typeof mock.clock>, ttftMs: number, genMs: number, tokens: number) {
  return async function* (): AsyncGenerator<TurnStepChunk, TurnStepResult> {
    await clock.sleep(ttftMs)
    yield { kind: 'text', index: 0, text: 'hi' }
    await clock.sleep(genMs)
    yield { kind: 'stop', stopReason: 'end_turn', usage: usage(tokens) }
    return { turnId: 't', index: 0, answer: 'hi', toolUses: [], stopReason: 'end_turn', usage: usage(tokens) }
  }
}

describe('measureStep', () => {
  test('rate is output tokens over first-piece-to-stop time', () => {
    const step = measureStep({ sentAt: 0, firstAt: 500, endAt: 2500, outputTokens: 100, model: 'm' })
    expect(step?.tokPerSec).toBe(50)
    expect(step?.ttftMs).toBe(500)
  })

  test('a short reply keeps its first-piece delay but gets no rate', () => {
    const step = measureStep({ sentAt: 0, firstAt: 300, endAt: 400, outputTokens: 5, model: 'm' })
    expect(step?.tokPerSec).toBe(undefined)
    expect(step?.ttftMs).toBe(300)
  })

  test('an unfinished response is not measured', () => {
    expect(measureStep({ sentAt: 0, firstAt: 300, outputTokens: 50, model: 'm' })).toBe(undefined)
  })

  test('the average weighs steps by their tokens', () => {
    const a = measureStep({ sentAt: 0, firstAt: 0, endAt: 1000, outputTokens: 100, model: 'm' })!
    const b = measureStep({ sentAt: 0, firstAt: 0, endAt: 1000, outputTokens: 300, model: 'm' })!
    const stats = addStep(addStep(EMPTY_STATS, a), b)
    // 400 tokens over 2 s, not the mean of 100 and 300.
    expect(formatStatus(stats, STRINGS.en)).toBe('⚡ 300 tok/s · TTFT 0.0s · avg 200 tok/s')
    expect(formatStatus(stats, STRINGS['zh-CN'])).toBe('⚡ 300 tok/s · 首字 0.0s · 均速 200 tok/s')
  })
})

describe('pickLanguage', () => {
  test('the mod option wins over everything', () => {
    expect(pickLanguage({ option: 'ja', settingLanguage: 'chinese', systemLocale: 'ko-KR' })).toBe('ja')
  })

  test("'auto' falls through to Claude Code's language setting", () => {
    expect(pickLanguage({ option: 'auto', settingLanguage: 'japanese', systemLocale: 'en-US' })).toBe('ja')
    expect(pickLanguage({ settingLanguage: '繁體中文' })).toBe('zh-TW')
    expect(pickLanguage({ settingLanguage: '한국어' })).toBe('ko')
    expect(pickLanguage({ settingLanguage: 'Chinese' })).toBe('zh-CN')
  })

  test('then the shell locale', () => {
    expect(pickLanguage({ envLocale: 'zh_TW.UTF-8', systemLocale: 'en-US' })).toBe('zh-TW')
    expect(pickLanguage({ envLocale: 'en_GB.UTF-8', systemLocale: 'zh-CN' })).toBe('en')
  })

  test('C and POSIX say nothing, so the system locale decides', () => {
    expect(pickLanguage({ envLocale: 'C.UTF-8', systemLocale: 'ko-KR' })).toBe('ko')
    expect(pickLanguage({ envLocale: 'POSIX', systemLocale: 'zh-Hant-HK' })).toBe('zh-TW')
    expect(pickLanguage({ systemLocale: 'zh-SG' })).toBe('zh-CN')
  })

  test('a language we do not speak falls back to English', () => {
    expect(pickLanguage({ settingLanguage: 'french', systemLocale: 'fr-FR' })).toBe('en')
    expect(pickLanguage({})).toBe('en')
  })
})

describe('turn.step hook', () => {
  for (const [locale, expected] of [
    ['en_US.UTF-8', '⚡ 60 tok/s · TTFT 0.8s · avg 60 tok/s'],
    ['zh_CN.UTF-8', '⚡ 60 tok/s · 首字 0.8s · 均速 60 tok/s'],
    ['ko_KR.UTF-8', '⚡ 60 tok/s · 첫 토큰 0.8s · 평균 60 tok/s'],
  ] as const) {
    test(`shows the step speed in the status line (LANG=${locale})`, async ($, on) => {
      mock.env(on, { LANG: locale })
      const clock = mock.clock(on)
      const statuses: (string | undefined)[] = []
      on('ui.status', (_$, e) => {
        statuses.push(e.text)
        return { value: undefined }
      })
      on('turn.step', streamingBottom(clock, 800, 2000, 120))

      const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-test', messageCount: 1 })
      const drained = (async () => {
        for await (const _ of stream) {
          // drain
        }
      })()
      await clock.advance(800)
      await clock.advance(2000)
      await drained

      // 120 tokens over 2.0 s of generation, first piece after 0.8 s.
      expect(statuses.at(-1)).toBe(expected)
    })
  }

  test("a subagent's steps leave the status line alone", async ($, on) => {
    mock.env(on, { LANG: 'en_US.UTF-8' })
    const clock = mock.clock(on)
    const statuses: (string | undefined)[] = []
    on('ui.status', (_$, e) => {
      statuses.push(e.text)
      return { value: undefined }
    })
    on('turn.step', async function* (): AsyncGenerator<TurnStepChunk, TurnStepResult> {
      yield { kind: 'stop', stopReason: 'end_turn', usage: usage(120) }
      return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: usage(120) }
    })

    const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-test', messageCount: 1, agentId: 'sub-1' })
    for await (const _ of stream) {
      // drain
    }
    await clock.settle()

    expect(statuses).toEqual([])
  })

  test('/speed reports the session tally in the detected language', async ($, on) => {
    mock.env(on, { LANG: 'ja_JP.UTF-8' })
    const clock = mock.clock(on)
    on('ui.status', () => ({ value: undefined }))
    on('turn.step', streamingBottom(clock, 500, 1000, 80))

    const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-test', messageCount: 1 })
    const drained = (async () => {
      for await (const _ of stream) {
        // drain
      }
    })()
    await clock.advance(500)
    await clock.advance(1000)
    await drained

    const ran = await $.command.run({
      command: 'speed',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 80 },
    })
    expect(ran.text).toContain('出力速度 · claude-test')
    expect(ran.text).toContain('平均速度：80 tok/s')
    expect(ran.text).toContain('初回トークンまでの平均時間：0.5s')
  })
})
