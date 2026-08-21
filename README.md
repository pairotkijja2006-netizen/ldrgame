# Long Distance Relationship

A 2-player cooperative pixel-art web game about Momo and Tian Tian. A giant black ball named **LDR** splits them up. They have to communicate, trust each other, and stay connected through three tasks to reunite.

## Play

```bash
npm install
npm start
```

Then open **two** desktop browser windows to:

- http://localhost:3000

If you are on two computers on the same network, use the LAN address printed in the terminal.

## Controls

| Key | Action |
| --- | --- |
| Space / click | Advance dialogue |
| Enter | Lock telepathy word |
| Esc | Pause menu |
| ♪ button | Mute |

## Player flow

1. Each person picks **Momo** or **Tian Tian** (the other character locks).
2. When both are in, a short countdown starts the cafe dinner.
3. LDR appears, separates them, and three co-op games begin.
4. After game 3 they reunite. **Play Again** keeps the same two players.

A third visitor sees **SERVER FULL**. If someone disconnects, the other waits for a reconnect (about 90 seconds). Refreshing the page should put you back in the same seat.

## Games

1. **Telepathy** — each of you secretly types one word from a category. Match to win. Misses are shown so you can learn how the other thinks.
2. **How well do you know each other?** — write 3 multiple-choice questions about yourself, then answer your partner's. You both need at least 2 / 3.
3. **Rock paper scissors** — pick the same move and beat LDR three times in a row. Ties and mismatches reset the streak.
