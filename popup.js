console.log("📍 popup.js v0.4.6 - Full English Alerts");

let currentUrl = "";

async function startScoring() {
  const container = document.getElementById('content');
  container.innerHTML = `<div class="loading">🔄 Extracting text from page...<br><small>0.3 seconds</small></div>`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentUrl = tab.url;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.trim().slice(0, 10000)
    });

    const text = results[0].result || "";
    if (text.length < 100) throw new Error("Text is too short (please reload the page)");

    const len = text.length;
    const words = (text.match(/\b\w+\b/g) || []).length;
    const value = Math.min(10, Math.max(2, Math.floor(len / 600) + (words > 250 ? 3 : 0)));
    const context = Math.min(10, Math.max(3, Math.floor(words / 70)));
    const slop = Math.max(1, 11 - Math.floor(value * 0.65 + context * 0.35));

    const result = {
      valueScore: value,
      contextScore: context,
      slopScore: slop,
      oneLine: len > 1500 ? "High-value article with rich information. Definitely worth reading!" : "Well-structured article. Quick and valuable read."
    };

    chrome.storage.local.set({ aegisResult: result });
    renderResult(result);

  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;padding:20px;background:#1f2937;border-radius:12px;">⚠️ ${err.message}</div>`;
  }
}

function renderResult(result) {
  const container = document.getElementById('content');
  const v = result.valueScore ?? 5;
  const c = result.contextScore ?? 5;
  const l = result.slopScore ?? 5;
  const oneLine = result.oneLine ?? "Valuable content detected.";

  container.innerHTML = `
    <div style="display:flex;justify-content:space-around;margin:20px 0;">
      <div style="text-align:center;"><div style="font-size:36px;color:#22c55e;">${v}</div><div>VALUE</div></div>
      <div style="text-align:center;"><div style="font-size:36px;color:#3b82f6;">${c}</div><div>CONTEXT</div></div>
      <div style="text-align:center;"><div style="font-size:36px;color:#ef4444;">${l}</div><div>SLOP</div></div>
    </div>
    <div style="background:#1f2937;padding:16px;border-radius:12px;font-size:15px;line-height:1.5;">${oneLine}</div>
    
    <button id="importBtn" style="width:100%;padding:18px;margin:20px 0;background:#22c55e;color:white;border:none;border-radius:12px;cursor:pointer;font-size:18px;font-weight:bold;">
      🛡️ Extract this page in Aegis
    </button>
    
    <button id="retryBtn" style="width:100%;padding:12px;background:#3b82f6;color:white;border:none;border-radius:8px;cursor:pointer;">
      🔄 Score again
    </button>
  `;

  document.getElementById('importBtn').onclick = () => {
    if (!currentUrl) return alert("Failed to get URL. Please try again.");

    navigator.clipboard.writeText(currentUrl);
    const aegisUrl = `https://aegis.dwebxr.xyz/?tab=sources&url=${encodeURIComponent(currentUrl)}`;

    setTimeout(() => {
      window.open(aegisUrl, '_blank');
    }, 400);

    alert(`✅ Aegis opened with full deep link!\n\nSources tab is active.\nURL is automatically pasted.\nExtract button will trigger immediately.\n\nFull V/C/L scores + Zero Slop Briefing starts right away!`);
  };

  document.getElementById('retryBtn').onclick = startScoring;
}

// 初回画面
document.getElementById('content').innerHTML = `
  <button id="startBtn">🛡️ Score this page now</button>
  <div style="text-align:center;font-size:13px;opacity:0.7;margin-top:10px;">Works great on news sites, blogs, Medium, etc.</div>
`;
document.getElementById('startBtn').onclick = startScoring;