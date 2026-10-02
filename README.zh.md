<h1 align="center">gamble with claude code</h1>

<p align="center"><i>you're absolutely right! 全押。</i></p>

<p align="center"><a href="README.md">[🇬🇧 →]</a> · <a href="README.ru.md">[🇷🇺 →]</a> </p>

<p align="center"><img src="docs/demo.gif" alt="Claude Code 里的老虎机、轮盘和二十一点" width="720"></p>

一个开在 Claude Code 里面的赌场。老虎机、轮盘、二十一点 —— 下注用的是 Claude Code 今天真实烧掉的 token。

<h2 align="center">这是什么？</h2>

反正你每天都要烧掉几百万 token，不如拿来赌一把。

- Claude Code 从午夜起烧掉的每一个 token，就是你钱包里的一个 token。
- 输光了？回去干活。每发一条 prompt，钱包就会回血。
- 午夜钱包清零。就像上下文窗口，只不过一天一次。

没有真钱。不能充值，不能提现，永远不能。这是关于赌博的玩笑，不是赌博。

<h2 align="center">安装</h2>

```
/plugin marketplace add szarkans/gamble-with-claude-code
/plugin install gamble-with-claude-code@gamble-with-claude-code
```
或者
```
claude plugin marketplace add szarkans/gamble-with-claude-code
claude plugin install gamble-with-claude-code@gamble-with-claude-code
```

然后 `/reload-plugins`（或重启 Claude Code），再输入

```
/casino
```

需要：Claude Code 2.1.287+（支持 mods 的版本）和 `python3` —— 用来统计今天的 token，只用标准库。在终端里运行；`claude -p` 和 VS Code 聊天里 mods 不会显示。
终端最好有 50 行左右高，否则用 PageDown 滚动面板。

想不动手就收到新游戏？`/plugin` → Marketplaces → gamble-with-claude-code → **Enable auto-update**。

<h2 align="center">游戏</h2>

**老虎机** —— 三个转轮，777 赔 ×20，三个 `rm -rf` 赔 ×50。别问。

**轮盘** —— 欧式，0–36。红/黑、单/双、大/小、打（dozen），或者押单个数字 35 赔 1。

**二十一点** —— 庄家 17 点停牌，blackjack 赔 3:2，可以加倍。不能分牌。暂时。

<h2 align="center">操作</h2>

`z` `x` `c` —— 老虎机、轮盘、二十一点  
`1`–`4` —— 下注 10%、25%、50%、全押  
`s` —— 转 / 发牌 / 停牌  
`h` —— 要牌，`d` —— 加倍  
`esc` 或 `q` —— 回去干活

终端支持鼠标点击的话，也可以直接点。

<h2 align="center">token 怎么算？</h2>

读取你本机上 Claude Code 自己的会话日志（`~/.claude/projects`，或 `$CLAUDE_CONFIG_DIR`）。今天的输入 + 缓存写入 + 输出。缓存读取不算 —— 重读同样的上下文不算干活。

数据不会离开你的电脑。这个 mod 不发任何网络请求。

<h2 align="center">另外</h2>

- 声音只在 macOS 上有。这是 Claude Code 的限制，不是我们的。
- `GWCC_DEBUG=1 claude` 会给你一个独立的假钱包和强制中大奖的按钮。截图用的。我们懂你。
- 下一步：**gamble-with-ai** —— 同一个赌场，浏览器版，支持你用的所有智能体。

与 Anthropic 无关。只是一个有 token 瘾的粉丝。

<h2 align="center">为什么 README 是这个画风？</h2>

因为是人写的。*大部分是*。  
赌博不好。`--dangerously-skip-permissions` 也不好。反正你两样都在干。
