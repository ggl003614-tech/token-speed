# token-speed

看 Claude 吐字有多快。这是一个 Claude Code 插件：每次模型输出完，状态栏显示这一段的生成速度和首字延迟。

```text
⚡ 86 tok/s · 首字 1.4s · 均速 79 tok/s
```

- **tok/s**：这一段每秒生成的 token 数
- **首字**：从请求发出到第一块内容到达的时间
- **均速**：本会话的平均速度，按 token 数加权

输入 `/speed` 看本会话汇总：平均速度、最快 / 最慢、平均首字延迟、总输出量。

## 安装

在终端里的 `claude` 中运行：

```text
/plugin install token-speed --marketplace ggl003614-tech/token-speed
```

提示 `Add marketplace?` 时回 `y`，再选安装范围（默认的用户级别就行）。装完立即生效，不用重启。用户级别装好后，桌面版的 Code 标签页也会加载它。

> 需要较新的 Claude Code：本插件用的是函数钩子（function hooks）插件接口，基于 2.1.293 开发。这套接口还在早期预览阶段，旧版本加载不了，以后的版本也可能有变化。

## 怎么测的

插件挂在 `turn.step` 上，每次模型请求记三个时间点：请求发出、第一块内容到达、结束标记到达。

- **速度** = API 返回的 `output_tokens` ÷（第一块 → 结束）的时长
- **首字** = 请求发出 → 第一块到达

用的是 API 官方的 token 数，不是按字数估算。

说明：

- 速度包含**思考 token**。思考内容不显示，但模型确实在生成。
- 少于 20 个 token、或生成不到 0.25 秒的短回复，只记首字延迟，不计速度。
- 子代理的请求不计入，免得覆盖主对话的数字。
- 统计只在当前会话里，插件重新加载后从零开始。

## 开发

```text
claude plugin validate .
claude plugin test .
```

---

## English

A Claude Code plugin that shows how fast Claude is generating. After each model response, the status line shows that response's speed and time to first token:

```text
⚡ 86 tok/s · 首字 1.4s · 均速 79 tok/s
```

(`首字` = time to first token, `均速` = token-weighted session average.) Run `/speed` for a session summary.

**Install** from `claude` in a terminal:

```text
/plugin install token-speed --marketplace ggl003614-tech/token-speed
```

Answer `y` to add the marketplace, then pick a scope. Requires a recent Claude Code with the function-hooks plugin API (built on 2.1.293; the API is early access and may change).

**How it measures:** `output_tokens` reported by the API, divided by the time from the first streamed chunk to the stop chunk. Thinking tokens are included. Replies under 20 tokens get a first-token time but no rate. Subagent requests are skipped.

MIT License.
