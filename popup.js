const AEGIS_URL = "https://aegis-ai.xyz/";
const MIN_TEXT_LENGTH = 100;
const MAX_TEXT_LENGTH = 10000;

let currentUrl = "";

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

function calcScores(text) {
  const len = text.length;
  const words = (text.match(/\b\w+\b/g) || []).length;
  const value = clamp(Math.floor(len / 600) + (words > 250 ? 3 : 0), 2, 10);
  const context = clamp(Math.floor(words / 70), 3, 10);
  const slop = clamp(11 - Math.floor(value * 0.65 + context * 0.35), 1, 10);
  const oneLine = len > 1500
    ? "High-value article with rich information. Definitely worth reading!"
    : "Well-structured article. Quick and valuable read.";
  return { value, context, slop, oneLine };
}

async function startScoring() {
  const container = document.getElementById("content");
  container.innerHTML = `<div class="loading">🔄 Extracting text from page...</div>`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentUrl = tab.url;

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (max) => document.body.innerText.trim().slice(0, max),
      args: [MAX_TEXT_LENGTH],
    });
    const text = result || "";

    if (text.length < MIN_TEXT_LENGTH) {
      throw new Error("Text is too short (please reload the page)");
    }

    const scores = calcScores(text);
    renderResult(scores);
  } catch (err) {
    const el = document.createElement("div");
    el.className = "error";
    el.textContent = `⚠️ ${err.message}`;
    container.replaceChildren(el);
  }
}

function renderResult({ value, context, slop, oneLine }) {
  const container = document.getElementById("content");
  container.innerHTML = `
    <div class="scores">
      <div class="score"><div class="score-value value">${value}</div><div>VALUE</div></div>
      <div class="score"><div class="score-value context">${context}</div><div>CONTEXT</div></div>
      <div class="score"><div class="score-value slop">${slop}</div><div>SLOP</div></div>
    </div>
    <div class="summary">${oneLine}</div>
    <button id="importBtn" class="btn-extract">🛡️ Extract this page in Aegis</button>
    <button id="retryBtn" class="btn-retry">🔄 Score again</button>
  `;

  document.getElementById("importBtn").onclick = () => {
    if (!currentUrl) return;
    navigator.clipboard.writeText(currentUrl);
    window.open(`${AEGIS_URL}?tab=sources&url=${encodeURIComponent(currentUrl)}`, "_blank");
  };

  document.getElementById("retryBtn").onclick = startScoring;
}

startScoring();

if (typeof module !== "undefined") {
  module.exports = {
    clamp, calcScores, startScoring, renderResult,
    AEGIS_URL, MIN_TEXT_LENGTH, MAX_TEXT_LENGTH,
    getCurrentUrl: () => currentUrl,
    setCurrentUrl: (url) => { currentUrl = url; },
  };
}
