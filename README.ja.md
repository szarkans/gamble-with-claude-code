<h1 align="center">gamble with claude code</h1>

<p align="center"><a href="README.md">[🇬🇧 →]</a> · <a href="README.ru.md">[🇷🇺 →]</a> · <a href="README.zh.md">[🇨🇳 →]</a> </p>

<p align="center"><img src="docs/demo.gif" alt="Claude Code の中のスロット、ルーレット、ブラックジャック" width="720"></p>

Claude Code の中にそのままカジノ。スロット、ルーレット、ブラックジャック — 賭けるのは、今日 Claude Code が実際に燃やしたトークン。

<h2 align="center">これは何？</h2>

どうせ毎日何百万トークンも燃やしてるんだ。ならいっそ賭けてしまおう。

- 深夜0時以降に Claude Code が燃やしたトークンは、すべてあなたのウォレットのトークンになる。
- 全部溶かした？ 仕事に戻ろう。プロンプトを送るたびにウォレットは補充される。
- ウォレットは深夜0時に燃え尽きる。コンテキストウィンドウみたいなものだ、ただし毎日。

> [!IMPORTANT]
> 本物のお金は一切なし。本物のトークンでもない: 消費することも、獲得することもできない。あなたの「ギャンブル用トークン」は、今日 Claude が作業で燃やしたトークンにすぎない。


<h2 align="center">インストール</h2>

```
/plugin marketplace add szarkans/gamble-with-claude-code
/plugin install gamble-with-claude-code@gamble-with-claude-code
```
または
```
claude plugin marketplace add szarkans/gamble-with-claude-code
claude plugin install gamble-with-claude-code@gamble-with-claude-code
```

その後 `/reload-plugins`（または Claude Code を再起動）して

```
/casino
```

動作要件: Claude Code 2.1.287 以降（mod 対応版）と `python3`。
ターミナルの高さは約50行にするか、PageDown でパネルをスクロールしてほしい。

指一本動かさずに新しいゲームを手に入れたい？ `/plugin` → Marketplaces → gamble-with-claude-code → **Enable auto-update**。

<h2 align="center">ゲーム</h2>

**スロット** — 3リール。777 で ×20、`rm -rf` が3つ揃えば ×50。

**ルーレット** — ヨーロピアン、0–36。赤/黒、偶数/奇数、ハーフ、ダズン、またはシングルナンバー。

**ブラックジャック** — ディーラーは17でスタンド、ブラックジャックは 3:2 配当、ダブルダウンあり。スプリットはなし。今のところは。

<h2 align="center">操作方法</h2>

`z` `x` `c` — スロット、ルーレット、ブラックジャック  
`1`–`4` — ベット 10%、25%、50%、オールイン  
`s` — スピン / ディール / スタンド  
`h` — ヒット、`d` — ダブル  
`esc` または `q` — 仕事に戻る

ターミナルが対応していれば、マウスクリックも使える。

<h2 align="center">トークンはどう数えられる？</h2>

あなたのマシン上にある Claude Code 自身のセッションログ（`~/.claude/projects`、または `$CLAUDE_CONFIG_DIR`）から集計する。今日の入力 + キャッシュ書き込み + 出力。キャッシュ読み込みはカウントしない — 同じコンテキストを読み直すのは仕事じゃない。

データがマシンの外に出ることはない。この mod はネットワーク通信を一切行わない。

<h2 align="center">ほかにも</h2>

Claude Code のユーザーじゃない、またはターミナル内の表示が好みじゃない？ [gamble-your-tokens](https://github.com/szarkans/gamble-your-tokens) をチェックしてほしい — 同じカジノのブラウザ版だ！

![gamble-your-tokens](https://github.com/szarkans/gamble-your-tokens/raw/main/assets/screenshot.png)

---

Anthropic とは無関係。トークン問題を抱えたただのファンです。
