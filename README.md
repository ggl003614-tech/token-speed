# token-speed

See how fast Claude writes. A Claude Code plugin that shows each response's generation speed and time to first token in the status line, in your language.

```text
⚡ 86 tok/s · TTFT 1.4s · avg 79 tok/s
```

- **tok/s**: tokens per second for the response that just finished
- **TTFT**: time from sending the request to the first piece of the response
- **avg**: this session's average, weighted by tokens

Run `/speed` for a session summary: average, fastest / slowest, average time to first token, total output.

## Languages

The plugin speaks English, 简体中文, 繁體中文, 日本語 and 한국어, and picks one by itself, from the first of these that names a language it speaks:

1. the plugin's own **Language** option, if you set one (default `auto`)
2. Claude Code's `language` setting
3. your shell locale: `LC_ALL`, `LC_MESSAGES`, `LANG`
4. your operating system's language

Anything else falls back to English.

| Language | Status line |
| --- | --- |
| English | `⚡ 86 tok/s · TTFT 1.4s · avg 79 tok/s` |
| 简体中文 | `⚡ 86 tok/s · 首字 1.4s · 均速 79 tok/s` |
| 繁體中文 | `⚡ 86 tok/s · 首字 1.4s · 均速 79 tok/s` |
| 日本語 | `⚡ 86 tok/s · 初回 1.4s · 平均 79 tok/s` |
| 한국어 | `⚡ 86 tok/s · 첫 토큰 1.4s · 평균 79 tok/s` |

## Install

**Terminal:** in `claude`, run

```text
/plugin install token-speed --marketplace ggl003614-tech/token-speed
```

Answer `y` to add the marketplace, then pick a scope (user is fine). It is active right away. Installed at the user scope, it also loads in the desktop app's Code tab.

**Desktop app:** download `token-speed-<version>.zip` from [Releases](https://github.com/ggl003614-tech/token-speed/releases), then go to Settings → Plugins → Upload local plugin and drop the zip in.

> Needs a recent Claude Code. The plugin uses the function-hooks plugin API, built against 2.1.293. That API is in early access: older versions cannot load it, and later ones may change it.

## How it measures

The plugin hooks `turn.step` and, for every model request, notes three moments: the request goes out, the first piece of the response arrives, the stop arrives.

- **speed** = `output_tokens` as the API reports it ÷ (first piece → stop)
- **TTFT** = request out → first piece

The token count is the API's own, not an estimate from characters.

- Thinking tokens count. You don't see them, but the model is generating them.
- Replies under 20 tokens, or under 0.25 s of generation, get a TTFT but no rate.
- Subagent requests are skipped so they don't overwrite the main conversation's number.
- The tally lives in the session and starts over when the plugin reloads.

## Development

```text
claude plugin validate .
claude plugin test .
```

---

## 中文

看 Claude 吐字有多快。每次模型输出完，状态栏显示这一段的生成速度和首字延迟，输入 `/speed` 看本会话汇总。界面语言会自动跟随你的 Claude Code 语言设置或系统语言（支持简体、繁體、英文、日文、韩文），也可以在插件的 Language 选项里手动指定。

**终端安装：** 在 `claude` 里运行 `/plugin install token-speed --marketplace ggl003614-tech/token-speed`，提示时回 `y`。

**桌面版安装：** 从 [Releases](https://github.com/ggl003614-tech/token-speed/releases) 下载 `token-speed-<版本>.zip`，在 设置 → 插件 → 上传本地插件 里拖进去。

速度 = API 返回的 `output_tokens` ÷（首块 → 结束块）时长，包含思考 token；少于 20 token 的短回复只记首字延迟；子代理不计入。

MIT License.
