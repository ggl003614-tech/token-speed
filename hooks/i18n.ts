// Which language to speak, and every string the mod shows in each one.

export const LANGS = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] as const
export type Lang = (typeof LANGS)[number]

export type Strings = {
  ttft: string
  avg: string
  colon: string
  commandDescription: string
  empty: string
  summaryTitle: string
  average: string
  fastestSlowest: string
  avgTtft: string
  total: (tokens: number, rated: number, steps: number) => string
  shortNote: (minTokens: number) => string
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    ttft: 'TTFT',
    avg: 'avg',
    colon: ': ',
    commandDescription: "Show Claude's output speed for this session",
    empty: 'No model output measured in this session yet.',
    summaryTitle: 'Output speed',
    average: 'Average',
    fastestSlowest: 'Fastest / slowest',
    avgTtft: 'Avg time to first token',
    total: (tokens, rated, steps) => `${tokens} tokens across ${rated} rated of ${steps} requests`,
    shortNote: min => `Replies under ${min} tokens count toward first-token time only.`,
  },
  'zh-CN': {
    ttft: '首字',
    avg: '均速',
    colon: '：',
    commandDescription: '查看本会话 Claude 的吐词速度',
    empty: '本会话还没有测到模型输出。',
    summaryTitle: '吐词速度',
    average: '平均速度',
    fastestSlowest: '最快 / 最慢',
    avgTtft: '平均首字',
    total: (tokens, rated, steps) => `共 ${tokens} tokens（${rated} 次计速 / ${steps} 次请求）`,
    shortNote: min => `少于 ${min} token 的短回复只记首字延迟，不计速度。`,
  },
  'zh-TW': {
    ttft: '首字',
    avg: '均速',
    colon: '：',
    commandDescription: '查看本次工作階段 Claude 的吐字速度',
    empty: '本次工作階段還沒有測到模型輸出。',
    summaryTitle: '吐字速度',
    average: '平均速度',
    fastestSlowest: '最快 / 最慢',
    avgTtft: '平均首字',
    total: (tokens, rated, steps) => `共 ${tokens} tokens（${rated} 次計速 / ${steps} 次請求）`,
    shortNote: min => `少於 ${min} token 的短回覆只記首字延遲，不計速度。`,
  },
  ja: {
    ttft: '初回',
    avg: '平均',
    colon: '：',
    commandDescription: 'このセッションの Claude の出力速度を表示',
    empty: 'このセッションではまだ出力を計測していません。',
    summaryTitle: '出力速度',
    average: '平均速度',
    fastestSlowest: '最速 / 最遅',
    avgTtft: '初回トークンまでの平均時間',
    total: (tokens, rated, steps) => `合計 ${tokens} トークン（計測 ${rated} 回 / リクエスト ${steps} 回）`,
    shortNote: min => `${min} トークン未満の短い応答は初回トークン時間のみ記録し、速度は計測しません。`,
  },
  ko: {
    ttft: '첫 토큰',
    avg: '평균',
    colon: ': ',
    commandDescription: '이번 세션의 Claude 출력 속도 보기',
    empty: '이번 세션에서 아직 측정된 출력이 없습니다.',
    summaryTitle: '출력 속도',
    average: '평균 속도',
    fastestSlowest: '최고 / 최저',
    avgTtft: '평균 첫 토큰 시간',
    total: (tokens, rated, steps) => `총 ${tokens} 토큰 (측정 ${rated}회 / 요청 ${steps}회)`,
    shortNote: min => `${min} 토큰 미만의 짧은 응답은 첫 토큰 시간만 기록하고 속도는 측정하지 않습니다.`,
  },
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value)
}

/** A locale tag (`zh_TW.UTF-8`, `zh-Hant-HK`, `ja-JP`) as one of ours. */
export function fromLocale(tag: string | undefined): Lang | undefined {
  if (tag === undefined) return undefined
  const t = tag.toLowerCase().replace(/[.@].*$/, '').replace(/_/g, '-').trim()
  if (t === '' || t === 'c' || t === 'posix') return undefined

  const [base] = t.split('-')
  if (base === 'zh') return /-(tw|hk|mo|hant)\b/.test(t) ? 'zh-TW' : 'zh-CN'
  if (base === 'en') return 'en'
  if (base === 'ja') return 'ja'
  if (base === 'ko') return 'ko'
  return undefined
}

/** Claude Code's `language` setting is free text: "chinese", "日本語", "korean". */
export function fromLanguageName(name: string | undefined): Lang | undefined {
  if (name === undefined) return undefined
  const n = name.toLowerCase().trim()
  if (n === '') return undefined
  if (/traditional|繁|台灣|台湾|香港/.test(n)) return 'zh-TW'
  if (/chinese|mandarin|中文|汉语|漢語|简体|普通话/.test(n)) return 'zh-CN'
  if (/japanese|日本/.test(n)) return 'ja'
  if (/korean|한국|조선/.test(n)) return 'ko'
  if (/english/.test(n)) return 'en'
  return fromLocale(n)
}

export type LanguageSources = {
  /** The mod's own option: `auto` or a language. */
  option?: string
  /** Claude Code's `language` setting. */
  settingLanguage?: string
  /** LC_ALL, LC_MESSAGES or LANG, the first that is set. */
  envLocale?: string
  /** The runtime's locale, which follows the operating system's. */
  systemLocale?: string
}

/** The first source that names a language we speak; English otherwise. */
export function pickLanguage(s: LanguageSources): Lang {
  if (isLang(s.option)) return s.option

  return (
    fromLanguageName(s.settingLanguage) ??
    fromLocale(s.envLocale) ??
    fromLocale(s.systemLocale) ??
    'en'
  )
}
