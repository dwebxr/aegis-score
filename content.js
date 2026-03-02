console.log("📍 content.js v0.1.7 FINAL");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scorePage") {
        console.log("✅ scorePage受信 → テキスト抽出");
        let text = document.body.innerText.trim();
        if (text.length > 12000) text = text.slice(0, 12000);

        chrome.runtime.sendMessage({
            action: "analyze",
            text: text,
            url: location.href
        });

        sendResponse({ status: "ok" });
        return true; // 非同期レスポンス宣言
    }
});