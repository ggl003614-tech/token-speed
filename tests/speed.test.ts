import { describe, expect, mock, test } from 'claude-code/testing'
import type { TurnStepChunk, TurnStepResult, TurnUsage } from 'claude-code'

import { addStep, EMPTY_STATS, formatStatus, measureStep } from '../hooks/speed'

const usage = (output_tokens: number): TurnUsage => ({
  input_tokens: 10,
  output_tokens,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  model: 'claude-test',
})

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
    expect(formatStatus(stats)).toBe('⚡ 300 tok/s · 首字 0.0s · 均速 200 tok/s')
  })
})

describe('turn.step hook', () => {
  test('shows the step speed in the status line', async ($, on) => {
    const clock = mock.clock(on)
    const statuses: (string | undefined)[] = []
    on('ui.status', (_$, e) => {
      statuses.push(e.text)
      return { value: undefined }
    })
    on('turn.step', async function* (): AsyncGenerator<TurnStepChunk, TurnStepResult> {
      await clock.sleep(800)
      yield { kind: 'text', index: 0, text: '你好' }
      await clock.sleep(2000)
      yield { kind: 'stop', stopReason: 'end_turn', usage: usage(120) }
      return { turnId: 't1', index: 0, answer: '你好', toolUses: [], stopReason: 'end_turn', usage: usage(120) }
    })

    const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-test', messageCount: 1 })
    const drained = (async () => {
      for await (const _ of stream) {
        // drain
      }
    })()
    await clock.advance(800)
    await clock.advance(2000)
    await drained

    // 120 tokens over 2.0 s of generation, first piece after 0.8 s.
    expect(statuses.at(-1)).toBe('⚡ 60 tok/s · 首字 0.8s · 均速 60 tok/s')
  })

  test("a subagent's steps leave the status line alone", async ($, on) => {
    const clock = mock.clock(on)
    const statuses: (string | undefined)[] = []
    on('ui.status', (_$, e) => {
      statuses.push(e.text)
      return { value: undefined }
    })
    on('turn.step', async function* (): AsyncGenerator<TurnStepChunk, TurnStepResult> {
      yield { kind: 'stop', stopReason: 'end_turn', usage: usage(120) }
      return { turnId: 't2', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: usage(120) }
    })

    const stream = $.turn.step({ turnId: 't2', index: 0, model: 'claude-test', messageCount: 1, agentId: 'sub-1' })
    for await (const _ of stream) {
      // drain
    }
    await clock.settle()

    expect(statuses).toEqual([])
  })

  test('/speed reports the session tally', async ($, on) => {
    const clock = mock.clock(on)
    on('turn.step', async function* (): AsyncGenerator<TurnStepChunk, TurnStepResult> {
      await clock.sleep(500)
      yield { kind: 'text', index: 0, text: 'hi' }
      await clock.sleep(1000)
      yield { kind: 'stop', stopReason: 'end_turn', usage: usage(80) }
      return { turnId: 't3', index: 0, answer: 'hi', toolUses: [], stopReason: 'end_turn', usage: usage(80) }
    })

    const stream = $.turn.step({ turnId: 't3', index: 0, model: 'claude-test', messageCount: 1 })
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
    expect(ran.text).toContain('平均速度   80 tok/s')
    expect(ran.text).toContain('平均首字   0.5s')
  })
})
