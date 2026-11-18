# AI Empire

A browser management game about running your own AI company. Design and train models, release them to earn money, hire staff, buy hardware, raise funding, and survive market crashes and crises while you race rival labs to the top of the rankings.

The whole game is a single HTML file with no build step and no server. Your progress saves automatically in your browser.

## ▶ How to start the game

You don't need to install anything. All you need is a web browser (Chrome, Edge, Firefox or Safari).

1. On this page, click the green **Code** button, then **Download ZIP**.
2. Unzip the downloaded file. On Windows, right-click it and choose **Extract All**.
3. Open the unzipped folder and start the game:
   - **Windows:** double-click **`Play.bat`**, or double-click `index.html`.
   - **Mac / Linux:** double-click **`index.html`**.

The game opens in your browser. That's it.

> **Windows shows a "Windows protected your PC" warning for `Play.bat`?** Click **More info → Run anyway**, or just double-click `index.html` instead. Both open the same game.
>
> **`index.html` opens in a text editor instead of a browser?** Right-click it, choose **Open with**, and pick your browser.

### Progress not saving?

A few browsers limit saving for pages opened straight from a file. If that happens, run a tiny local server from the game folder and open **http://localhost:8000**:

```sh
python -m http.server 8000     # Windows (or: py -m http.server 8000)
python3 -m http.server 8000    # Mac / Linux
npm start                      # if you have Node.js (opens on http://localhost:3000)
```

### Put it online (optional)

Push the repository to a **public** GitHub repo, then go to **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, pick `main` and `/ (root)`, and save. After a minute the game is live at `https://<your-username>.github.io/ai-empire/`.

## How to play

When you start a new game, you name your company and a short guided tour walks you through the basics. In short:

1. **Create a model.** Pick a family, size, architecture, precision, data quality, context window and safety level. Every option has a plain-English explanation. Bigger and better costs more and scores higher.
2. **Train it.** Training takes in-game days. When it finishes, the model gets a score from 1 to 100.
3. **Release it.** Released models earn money every day. A higher score earns much more. Older versions earn less once you release a newer one.
4. **Grow.** Hire employees, buy GPUs, unlock research, run marketing, take investment or loans, and attend conferences.
5. **Survive.** Markets boom and bust, and every few months a crisis pauses the game and asks for your decision. If your money drops below zero, you go bankrupt.

### Controls

| Key or button | Action |
|---|---|
| `Space` / ⏸ | Pause or resume |
| `1` / `2` / `3` | Speed 1×, 2×, 5× |
| Sidebar | Switch between pages |

## Saves

- The game saves to your browser's local storage automatically. There are 5 save slots, managed in **Settings**.
- Saves stay on one browser on one computer. Clearing site data deletes them.
- Use **Export** in the save manager to download a save file, and **Import** to load it on another browser or computer.
- When you reopen the game with a save, it waits paused until you click **Continue Game**.

## Features

See [FEATURES.md](FEATURES.md) for the full list: employees, hardware, the research tree, marketing, benchmarks, deals and acquisitions, government relations, random events, crises, achievements and more.

## Development

### Project layout

```
index.html              the whole game (HTML, CSS and JavaScript)
Play.bat                Windows shortcut that opens index.html in your browser
FEATURES.md             feature list
```

The page loads its fonts from Google Fonts. Without internet access, it falls back to system fonts.

## License

[MIT](LICENSE)
