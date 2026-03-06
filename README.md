# Aegis Score

Chrome extension that scores any webpage and extracts it into [Aegis](https://aegis.dwebxr.xyz) with one click.

## What it does

1. Open the popup on any webpage — V/C/L scores appear instantly
2. **Value** (2-10): content richness based on text length and word density
3. **Context** (3-10): informational depth based on word count
4. **Slop** (1-10): inverse quality signal derived from Value and Context
5. Click **"Extract this page in Aegis"** to open the full Aegis analysis with the page URL

## Install

### From source

1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** and select this folder

### Permissions

- `activeTab` — read text from the current tab when the popup is opened
- `scripting` — extract page text via `chrome.scripting.executeScript`

No data is stored. No external API calls are made for scoring. See [privacy-policy.md](privacy-policy.md).

## Project structure

```
popup.html    UI and styles
popup.js      Scoring logic, rendering, Aegis deep-link
manifest.json Chrome extension manifest (v3)
popup.test.js Jest test suite (37 tests)
```

## Development

```sh
npm install
npm test
```

## License

MIT
