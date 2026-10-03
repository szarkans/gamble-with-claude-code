<h1 align="center">gamble with claude code</h1>

<p align="center"><a href="README.ru.md">[🇷🇺 →]</a> · <a href="README.zh.md">[🇨🇳 →]</a> · <a href="README.ja.md">[🇯🇵 →]</a> </p>

<p align="center"><img src="docs/demo.gif" alt="slots, roulette and blackjack inside Claude Code" width="720"></p>

a casino right inside Claude Code. slots, roulette and blackjack — and you bet the tokens Claude Code actually burned today.

<h2 align="center">what's this about?</h2>

you burn millions of tokens a day anyway. might as well gamble them.

- every token Claude Code burned since midnight is a token in your wallet.
- lost it all? go back to work. the wallet refills with every prompt.
- the wallet burns at midnight. like your context window, but daily.

> [!IMPORTANT]
> no real money. not real tokens either: you don't spend them and you can't win them. your "gambling tokens" are just the tokens Claude burned working today.


<h2 align="center">install</h2>

```
/plugin marketplace add szarkans/gamble-with-claude-code
/plugin install gamble-with-claude-code@gamble-with-claude-code
```
or
```
claude plugin marketplace add szarkans/gamble-with-claude-code
claude plugin install gamble-with-claude-code@gamble-with-claude-code
```

then `/reload-plugins` (or restart Claude Code) and

```
/casino
```

requirements: Claude Code 2.1.287+ (the one with mods) and `python3`.
make the terminal ~50 rows tall, or scroll the panel with PageDown.

want new games without lifting a finger? `/plugin` → Marketplaces → gamble-with-claude-code → **Enable auto-update**.

<h2 align="center">games</h2>

**slots** — three reels, 777 pays ×20, `rm -rf` ×3 pays ×50.

**roulette** — european, 0–36. red/black, even/odd, halves, dozens, or a single number

**blackjack** — dealer stands on 17, blackjack pays 3:2, double down. no split. yet.

<h2 align="center">controls</h2>

`z` `x` `c` — slots, roulette, blackjack  
`1`–`4` — bet 10%, 25%, 50%, all in  
`s` — spin / deal / stand  
`h` — hit, `d` — double  
`esc` or `q` — back to work

mouse clicks work too, where your terminal reports them.

<h2 align="center">how are tokens counted?</h2>

from Claude Code's own session logs on your machine (`~/.claude/projects`, or `$CLAUDE_CONFIG_DIR`). today's input + cache writes + output. cache reads don't count — re-reading the same context isn't work.

nothing leaves your machine. the mod makes zero network calls.

<h2 align="center">also</h2>

not claude code's user or don't like in-terminal view? check out [gamble-your-tokens](https://github.com/szarkans/gamble-your-tokens) - same casino but in browser!

![gamble-your-tokens](https://github.com/szarkans/gamble-your-tokens/raw/main/assets/screenshot.png)

---

not affiliated with Anthropic. just a fan with a token problem.