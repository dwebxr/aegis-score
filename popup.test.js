/**
 * @jest-environment jsdom
 */

const mockTabsQuery = jest.fn();
const mockExecuteScript = jest.fn();

global.chrome = {
  tabs: { query: mockTabsQuery },
  scripting: { executeScript: mockExecuteScript },
};

const mockClipboardWrite = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, { clipboard: { writeText: mockClipboardWrite } });

const mockWindowOpen = jest.fn();
window.open = mockWindowOpen;

document.body.innerHTML = `<div id="content"></div>`;

let mod;
beforeAll(async () => {
  mockTabsQuery.mockResolvedValue([{ id: 1, url: "https://example.com" }]);
  mockExecuteScript.mockResolvedValue([{ result: "a ".repeat(200) }]);
  mod = require("./popup");
  await new Promise((r) => setTimeout(r, 0));
});

beforeEach(() => {
  jest.clearAllMocks();
  document.getElementById("content").innerHTML = "";
  mod.setCurrentUrl("");
});

describe("clamp", () => {
  test("returns value when within range", () => {
    expect(mod.clamp(5, 1, 10)).toBe(5);
  });

  test("clamps to min when value is below", () => {
    expect(mod.clamp(-3, 1, 10)).toBe(1);
  });

  test("clamps to max when value is above", () => {
    expect(mod.clamp(99, 1, 10)).toBe(10);
  });

  test("returns min when min === max", () => {
    expect(mod.clamp(5, 7, 7)).toBe(7);
  });

  test("handles zero correctly", () => {
    expect(mod.clamp(0, 0, 10)).toBe(0);
    expect(mod.clamp(0, 1, 10)).toBe(1);
  });

  test("handles negative ranges", () => {
    expect(mod.clamp(-5, -10, -1)).toBe(-5);
    expect(mod.clamp(0, -10, -1)).toBe(-1);
  });
});

describe("calcScores", () => {
  test("minimum text (100 chars, 50 words)", () => {
    const text = "x ".repeat(50);
    const scores = mod.calcScores(text);
    expect(scores.value).toBe(2);
    expect(scores.context).toBe(3);
    expect(scores.slop).toBe(9);
    expect(scores.oneLine).toBe("Well-structured article. Quick and valuable read.");
  });

  test("medium text (1000 chars, 200 words)", () => {
    const text = "word ".repeat(200);
    const scores = mod.calcScores(text);
    expect(scores.value).toBe(2);
    expect(scores.context).toBe(3);
    expect(scores.slop).toBe(9);
    expect(scores.oneLine).toBe("Well-structured article. Quick and valuable read.");
  });

  test("large text (2000 chars, 400 words)", () => {
    const text = "word ".repeat(400);
    const scores = mod.calcScores(text);
    expect(scores.value).toBe(6);
    expect(scores.context).toBe(5);
    expect(scores.slop).toBe(6);
    expect(scores.oneLine).toBe("High-value article with rich information. Definitely worth reading!");
  });

  test("very large text (10000 chars, 2000 words) caps at maximums", () => {
    const text = "word ".repeat(2000);
    const scores = mod.calcScores(text);
    expect(scores.value).toBe(10);
    expect(scores.context).toBe(10);
    expect(scores.slop).toBe(1);
  });

  test("boundary: exactly 1500 chars → short summary", () => {
    expect(mod.calcScores("a".repeat(1500)).oneLine)
      .toBe("Well-structured article. Quick and valuable read.");
  });

  test("boundary: 1501 chars → long summary", () => {
    expect(mod.calcScores("a".repeat(1501)).oneLine)
      .toBe("High-value article with rich information. Definitely worth reading!");
  });

  test("word count > 250 triggers value bonus (+3)", () => {
    const text = "ab ".repeat(500).slice(0, 1500);
    expect(mod.calcScores(text).value).toBe(5);
  });

  test("word count <= 250 does not trigger bonus", () => {
    const text = "a".repeat(600) + " word".repeat(50);
    expect(mod.calcScores(text).value).toBe(2);
  });

  test("text with no word-boundary matches (all spaces)", () => {
    const scores = mod.calcScores(" ".repeat(200));
    expect(scores.value).toBe(2);
    expect(scores.context).toBe(3);
  });

  test("slop is inversely related to value and context", () => {
    const low = mod.calcScores("x ".repeat(60));
    const high = mod.calcScores("word ".repeat(1500));
    expect(high.slop).toBeLessThan(low.slop);
  });
});

describe("startScoring", () => {
  const fakeTab = { id: 42, url: "https://example.com/article" };

  test("shows loading state immediately", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockResolvedValue([{ result: "word ".repeat(100) }]);

    const promise = mod.startScoring();
    expect(document.getElementById("content").innerHTML).toContain("loading");
    await promise;
  });

  test("successful scoring renders all UI elements", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockResolvedValue([{ result: "word ".repeat(200) }]);

    await mod.startScoring();

    const content = document.getElementById("content");
    expect(content.querySelector(".score-value.value")).not.toBeNull();
    expect(content.querySelector(".score-value.context")).not.toBeNull();
    expect(content.querySelector(".score-value.slop")).not.toBeNull();
    expect(content.querySelector(".summary")).not.toBeNull();
    expect(content.querySelector("#importBtn")).not.toBeNull();
    expect(content.querySelector("#retryBtn")).not.toBeNull();
  });

  test("passes correct tabId and MAX_TEXT_LENGTH to executeScript", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockResolvedValue([{ result: "word ".repeat(200) }]);

    await mod.startScoring();

    const scriptCall = mockExecuteScript.mock.calls[0][0];
    expect(scriptCall.target.tabId).toBe(42);
    expect(scriptCall.args).toEqual([10000]);
  });

  test("sets currentUrl from tab", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockResolvedValue([{ result: "word ".repeat(200) }]);

    await mod.startScoring();

    expect(mod.getCurrentUrl()).toBe("https://example.com/article");
  });

  test("error: text too short", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockResolvedValue([{ result: "short" }]);

    await mod.startScoring();

    const errorEl = document.getElementById("content").querySelector(".error");
    expect(errorEl.textContent).toContain("Text is too short");
  });

  test("error: empty result from executeScript", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockResolvedValue([{ result: "" }]);

    await mod.startScoring();

    expect(document.getElementById("content").querySelector(".error").textContent)
      .toContain("Text is too short");
  });

  // null → "" fallback (bug fix: destructuring default doesn't cover null)
  test("error: null result defaults to empty string", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockResolvedValue([{ result: null }]);

    await mod.startScoring();

    expect(document.getElementById("content").querySelector(".error").textContent)
      .toContain("Text is too short");
  });

  test("error: chrome.tabs.query rejects", async () => {
    mockTabsQuery.mockRejectedValue(new Error("No active tab"));

    await mod.startScoring();

    expect(document.getElementById("content").querySelector(".error").textContent)
      .toContain("No active tab");
  });

  test("error: chrome.scripting.executeScript rejects", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockRejectedValue(new Error("Cannot access page"));

    await mod.startScoring();

    expect(document.getElementById("content").querySelector(".error").textContent)
      .toContain("Cannot access page");
  });

  // XSS safety: error rendered via textContent, not innerHTML
  test("error message is not rendered as HTML", async () => {
    mockTabsQuery.mockRejectedValue(new Error('<img src=x onerror="alert(1)">'));

    await mod.startScoring();

    const errorEl = document.getElementById("content").querySelector(".error");
    expect(errorEl.textContent).toContain("<img");
    expect(errorEl.querySelector("img")).toBeNull();
  });

  test("boundary: text exactly 100 chars is accepted", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockResolvedValue([{ result: "a ".repeat(50) }]);

    await mod.startScoring();

    expect(document.getElementById("content").querySelector(".error")).toBeNull();
    expect(document.getElementById("content").querySelector(".scores")).not.toBeNull();
  });

  test("boundary: text 99 chars is rejected", async () => {
    mockTabsQuery.mockResolvedValue([fakeTab]);
    mockExecuteScript.mockResolvedValue([{ result: "a ".repeat(49) + "a" }]);

    await mod.startScoring();

    expect(document.getElementById("content").querySelector(".error")).not.toBeNull();
  });
});

describe("renderResult", () => {
  const scores = { value: 7, context: 8, slop: 3, oneLine: "Test summary." };

  test("displays correct score values and summary", () => {
    mod.renderResult(scores);

    const content = document.getElementById("content");
    expect(content.querySelector(".score-value.value").textContent).toBe("7");
    expect(content.querySelector(".score-value.context").textContent).toBe("8");
    expect(content.querySelector(".score-value.slop").textContent).toBe("3");
    expect(content.querySelector(".summary").textContent).toBe("Test summary.");
  });

  test("Extract button copies URL and opens Aegis", () => {
    mod.setCurrentUrl("https://test.com/page");
    mod.renderResult(scores);

    document.getElementById("importBtn").click();

    expect(mockClipboardWrite).toHaveBeenCalledWith("https://test.com/page");
    expect(mockWindowOpen).toHaveBeenCalledWith(
      `https://aegis-ai.xyz/?tab=sources&url=${encodeURIComponent("https://test.com/page")}`,
      "_blank"
    );
  });

  test("Extract button URL-encodes special characters", () => {
    mod.setCurrentUrl("https://example.com/a b?q=1&r=2");
    mod.renderResult(scores);

    document.getElementById("importBtn").click();

    expect(mockWindowOpen.mock.calls[0][0])
      .toContain(encodeURIComponent("https://example.com/a b?q=1&r=2"));
  });

  test("Extract button does nothing when currentUrl is empty", () => {
    mod.setCurrentUrl("");
    mod.renderResult(scores);

    document.getElementById("importBtn").click();

    expect(mockClipboardWrite).not.toHaveBeenCalled();
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  test("Retry button completes with new scores", async () => {
    mod.renderResult(scores);

    mockTabsQuery.mockResolvedValue([{ id: 1, url: "https://retry.com" }]);
    const retryText = "word ".repeat(300);
    mockExecuteScript.mockResolvedValue([{ result: retryText }]);

    document.getElementById("retryBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const content = document.getElementById("content");
    expect(content.querySelector(".loading")).toBeNull();
    const expected = mod.calcScores(retryText);
    expect(content.querySelector(".score-value.value").textContent).toBe(String(expected.value));
    expect(content.querySelector(".score-value.context").textContent).toBe(String(expected.context));
    expect(mod.getCurrentUrl()).toBe("https://retry.com");
  });
});

describe("integration: full scoring flow", () => {
  test("popup open → score → verify exact values → extract", async () => {
    const pageUrl = "https://news.example.com/article/123";
    const pageText = "word ".repeat(400);

    mockTabsQuery.mockResolvedValue([{ id: 10, url: pageUrl }]);
    mockExecuteScript.mockResolvedValue([{ result: pageText }]);

    await mod.startScoring();

    const content = document.getElementById("content");
    const expected = mod.calcScores(pageText);

    expect(content.querySelector(".score-value.value").textContent).toBe(String(expected.value));
    expect(content.querySelector(".score-value.context").textContent).toBe(String(expected.context));
    expect(content.querySelector(".score-value.slop").textContent).toBe(String(expected.slop));
    expect(content.querySelector(".summary").textContent).toBe(expected.oneLine);

    document.getElementById("importBtn").click();
    expect(mockClipboardWrite).toHaveBeenCalledWith(pageUrl);
    expect(mockWindowOpen).toHaveBeenCalledWith(
      `https://aegis-ai.xyz/?tab=sources&url=${encodeURIComponent(pageUrl)}`,
      "_blank"
    );
  });

  test("score → error → retry → success", async () => {
    mockTabsQuery.mockResolvedValue([{ id: 1, url: "https://x.com" }]);
    mockExecuteScript.mockResolvedValue([{ result: "short" }]);
    await mod.startScoring();

    expect(document.getElementById("content").querySelector(".error").textContent)
      .toContain("Text is too short");

    const retryText = "word ".repeat(200);
    mockExecuteScript.mockResolvedValue([{ result: retryText }]);
    await mod.startScoring();

    const content = document.getElementById("content");
    expect(content.querySelector(".error")).toBeNull();
    const expected = mod.calcScores(retryText);
    expect(content.querySelector(".score-value.value").textContent).toBe(String(expected.value));
  });

  // Concurrent calls: last write wins (no mutex in popup lifecycle)
  test("multiple rapid scorings — last call determines final state", async () => {
    mockTabsQuery.mockResolvedValue([{ id: 1, url: "https://a.com" }]);

    const text1 = "word ".repeat(200);
    const text2 = "longword ".repeat(600);

    mockExecuteScript
      .mockResolvedValueOnce([{ result: text1 }])
      .mockResolvedValueOnce([{ result: text2 }]);

    await Promise.all([mod.startScoring(), mod.startScoring()]);

    const content = document.getElementById("content");
    const expected = mod.calcScores(text2);
    expect(content.querySelector(".score-value.value").textContent).toBe(String(expected.value));
    expect(content.querySelector(".score-value.context").textContent).toBe(String(expected.context));
    expect(content.querySelector(".score-value.slop").textContent).toBe(String(expected.slop));
  });

  test("currentUrl updates across multiple scorings", async () => {
    mockTabsQuery.mockResolvedValue([{ id: 1, url: "https://first.com" }]);
    mockExecuteScript.mockResolvedValue([{ result: "word ".repeat(200) }]);
    await mod.startScoring();
    expect(mod.getCurrentUrl()).toBe("https://first.com");

    mockTabsQuery.mockResolvedValue([{ id: 2, url: "https://second.com" }]);
    await mod.startScoring();
    expect(mod.getCurrentUrl()).toBe("https://second.com");
  });
});
