import { evaluate, now, sleep } from "./cdp-client.mjs";
import { pageProbe } from "./chatgpt-page.mjs";
import { normalizeMessageText } from "./chatgpt-messages.mjs";

export function findExactTokenTurn(turns, token) {
  return turns.find((turn) =>
    String(turn)
      .split(/\n+/)
      .some((line) => line.trim() === token),
  );
}

export async function inputPrompt(cdp, composer, prompt) {
  const beforeClear = await composerText(cdp).catch(() => "");
  await clearComposer(cdp);
  const afterClear = await composerText(cdp).catch(() => "");
  if (afterClear.trim()) {
    const error = new Error("ChatGPT composer could not be cleared before typing.");
    error.errorCode = "composer.clear_failed";
    error.details = {
      beforeClearCharCount: beforeClear.length,
      afterClearCharCount: afterClear.length,
    };
    throw error;
  }
  await focusComposer(cdp);
  await cdp.send("Input.insertText", { text: prompt });
  const afterInsert = await waitForComposerText(cdp, prompt);
  return {
    beforeClearCharCount: beforeClear.length,
    promptCharCount: prompt.length,
    composerCharCount: afterInsert.length,
  };
}

export async function focusComposer(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const composer = document.querySelector("#prompt-textarea")
        || [...document.querySelectorAll('textarea[aria-label="Chat with ChatGPT"], textarea[placeholder], [contenteditable="true"][role="textbox"], [role="textbox"][aria-label="Chat with ChatGPT"]')]
          .find(visible);
      if (!composer) return false;
      composer.focus();
      if (composer.isContentEditable) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(composer);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return document.activeElement === composer || composer.contains(document.activeElement);
    })()`,
  );
}

export async function clearComposer(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const composer = document.querySelector("#prompt-textarea")
        || [...document.querySelectorAll('textarea[aria-label="Chat with ChatGPT"], textarea[placeholder], [contenteditable="true"][role="textbox"], [role="textbox"][aria-label="Chat with ChatGPT"]')]
          .find(visible);
      if (!composer) return false;
      composer.focus();
      if ("value" in composer) {
        composer.value = "";
      } else {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(composer);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("delete");
        composer.textContent = "";
      }
      composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward", data: null }));
      composer.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );
}

export async function composerText(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const composer = document.querySelector("#prompt-textarea")
        || [...document.querySelectorAll('textarea[aria-label="Chat with ChatGPT"], textarea[placeholder], [contenteditable="true"][role="textbox"], [role="textbox"][aria-label="Chat with ChatGPT"]')]
          .find(visible);
      if (!composer) return "";
      return "value" in composer ? composer.value || "" : composer.innerText || "";
    })()`,
  );
}

export async function waitForComposerText(cdp, expected, timeoutMs = 5_000) {
  const startedAt = now();
  let lastText = "";
  const normalizedExpected = normalizeMessageText(expected);
  while (now() - startedAt < timeoutMs) {
    lastText = await composerText(cdp).catch(() => "");
    if (lastText === expected) return lastText;
    if (normalizeMessageText(lastText) === normalizedExpected) return lastText;
    await sleep(100);
  }
  const error = new Error("ChatGPT composer text did not match the prompt before sending.");
  error.errorCode = "composer.input_mismatch";
  error.details = {
    expectedCharCount: expected.length,
    observedCharCount: lastText.length,
    expectedNormalizedCharCount: normalizedExpected.length,
    observedNormalizedCharCount: normalizeMessageText(lastText).length,
  };
  throw error;
}

export async function clickComposerSendButton(cdp, { timeoutMs = 5_000 } = {}) {
  const startedAt = now();
  let lastButtonState = null;
  while (now() - startedAt < timeoutMs) {
    const result = await evaluate(
      cdp,
      `(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        const composer = document.querySelector("#prompt-textarea")
          || [...document.querySelectorAll('[contenteditable="true"][role="textbox"], [role="textbox"][aria-label="Chat with ChatGPT"], [role="textbox"]')]
            .find(visible);
        const form = composer?.closest("form") || document;
        const voiceBusy = /connecting to voice/i.test(document.body.innerText || "");
        const buttons = [...form.querySelectorAll("button")].filter(visible);
        const states = buttons.map((candidate) => {
          const label = [
            candidate.innerText,
            candidate.getAttribute("aria-label"),
            candidate.title,
            candidate.getAttribute("data-testid"),
            candidate.id,
            candidate.className,
          ].filter(Boolean).join(" ");
          return {
            label,
            disabled: candidate.disabled || candidate.getAttribute("aria-disabled") === "true",
          };
        });
        const button = buttons.find((candidate) => {
          const label = [
            candidate.innerText,
            candidate.getAttribute("aria-label"),
            candidate.title,
            candidate.getAttribute("data-testid"),
            candidate.id,
            candidate.className,
          ].filter(Boolean).join(" ");
          if (/dictation|voice|talk|microphone|audio/i.test(label)) return false;
          const looksLikeSend = /send|submit/i.test(label)
            || candidate.getAttribute("data-testid") === "send-button"
            || candidate.id === "composer-submit-button"
            || String(candidate.className || "").includes("composer-submit");
          return looksLikeSend && !candidate.disabled && candidate.getAttribute("aria-disabled") !== "true";
        });
        if (voiceBusy || !button) return { clicked: false, voiceBusy, states };
        const r = button.getBoundingClientRect();
        button.click();
        return {
          clicked: true,
          voiceBusy,
          method: "dom-button",
          label: [button.innerText, button.getAttribute("aria-label"), button.getAttribute("data-testid")].filter(Boolean).join(" "),
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2),
          states,
        };
      })()`,
    );
    lastButtonState = result?.states || null;
    if (result?.clicked) return result;
    await sleep(100);
  }
  return { clicked: false, states: lastButtonState };
}

export async function waitForSubmission(cdp, { initialUserCount, responseToken, timeoutMs = 8_000 }) {
  const startedAt = now();
  let lastProbe = null;
  while (now() - startedAt < timeoutMs) {
    const probe = await pageProbe(cdp);
    lastProbe = probe;
    const text = await composerText(cdp).catch(() => "");
    if (probe.userTurns.length > initialUserCount) return { submitted: true, probe };
    if (responseToken && !text.includes(responseToken) && text.length === 0) {
      return { submitted: true, probe };
    }
    if (!responseToken && text.length === 0) return { submitted: true, probe };
    await sleep(250);
  }
  return { submitted: false, probe: lastProbe };
}

export async function submitPrompt(cdp, { composer, initialUserCount, responseToken = "", attempts = 3 }) {
  let clicked = null;
  let submitted = null;
  const submitAttempts = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    clicked = await clickComposerSendButton(cdp);
    submitAttempts.push({
      attempt,
      clicked: Boolean(clicked?.clicked),
      label: clicked?.label || "",
    });
    if (!clicked?.clicked) {
      await sleep(500);
      continue;
    }
    submitted = await waitForSubmission(cdp, { initialUserCount, responseToken });
    if (submitted.submitted) {
      return {
        ...clicked,
        attempts: submitAttempts,
      };
    }
    const stagedText = await composerText(cdp).catch(() => "");
    submitAttempts.at(-1).composerTextLength = stagedText.length;
    if (!stagedText.trim()) break;
    await sleep(1_000);
  }

  if (!clicked?.clicked) {
    const error = new Error("ChatGPT send button was not found or was disabled.");
    error.errorCode = "page.send_button_not_found";
    error.details = {
      attempts: submitAttempts,
      buttons: clicked?.states || null,
    };
    throw error;
  }

  const error = new Error("ChatGPT prompt was not submitted.");
  error.errorCode = "chatgpt.prompt_not_submitted";
  error.details = {
    attempts: submitAttempts,
    observedUserTurnCount: submitted.probe?.userTurns?.length ?? null,
    observedAssistantTurnCount: submitted.probe?.assistantTurns?.length ?? null,
    composerTextLength: (await composerText(cdp).catch(() => "")).length,
  };
  throw error;
}

export async function waitForReadyProbe(cdp, timeoutMs = 20_000) {
  const startedAt = now();
  let lastError = null;
  while (now() - startedAt < timeoutMs) {
    try {
      const probe = await pageProbe(cdp);
      if (probe.isLoggedOut || probe.composer) return probe;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ChatGPT page readiness: ${lastError?.message || "not ready"}`);
}

export async function waitForTokenOutput(cdp, responseToken, initialAssistantCount, timeoutMs) {
  const startedAt = now();
  let lastProbe = null;
  while (now() - startedAt < timeoutMs) {
    const probe = await pageProbe(cdp);
    lastProbe = probe;
    const newAssistantTurns = probe.assistantTurns.slice(initialAssistantCount);
    const tokenTurn = findExactTokenTurn(newAssistantTurns, responseToken);
    if (tokenTurn) {
      await sleep(1000);
      const stableProbe = await pageProbe(cdp);
      const stableAssistantTurns = stableProbe.assistantTurns.slice(initialAssistantCount);
      const stableTokenTurn = findExactTokenTurn(stableAssistantTurns, responseToken);
      if (stableTokenTurn) return { probe: stableProbe, exactAssistantText: stableTokenTurn.trim() };
    }
    await sleep(750);
  }
  const error = new Error(`Timed out waiting for assistant response token ${responseToken}.`);
  error.errorCode = "chatgpt.response_timeout";
  error.details = {
    timeoutMs,
    observedAssistantTurnCount: lastProbe?.assistantTurns?.length ?? null,
    observedUserTurnCount: lastProbe?.userTurns?.length ?? null,
    bodyTextLength: lastProbe?.bodyText?.length ?? null,
  };
  throw error;
}

function cleanAssistantText(text) {
  const progressLine = /^(pro thinking|thinking|reasoning|working|show more|show less)$/i;
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !progressLine.test(line))
    .join("\n")
    .trim();
}

function isProgressPlaceholder(text) {
  return !cleanAssistantText(text) && /pro thinking|thinking|reasoning|working/i.test(String(text || ""));
}

async function generationState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const labels = [...document.querySelectorAll("button")]
        .filter(visible)
        .map((button) => {
          const label = [button.innerText, button.getAttribute("aria-label"), button.title, button.getAttribute("data-testid")]
            .filter(Boolean)
            .join(" ");
          return label.trim();
        });
      return {
        active: labels.some((label) => /stop answering|stop generating|interrupt|cancel/i.test(label))
          || labels.some((label) => /^pro thinking$/i.test(label)),
        labels: labels.filter((label) => /stop|interrupt|cancel|pro thinking/i.test(label)),
      };
    })()`,
  );
}

export async function waitForAssistantResponse(cdp, initialAssistantCount, {
  timeoutMs = 240_000,
  stableMs = 4_000,
} = {}) {
  const startedAt = now();
  let lastProbe = null;
  let lastText = "";
  let changedAt = now();

  while (now() - startedAt < timeoutMs) {
    const probe = await pageProbe(cdp);
    lastProbe = probe;
    const newAssistantTurns = probe.assistantTurns.slice(initialAssistantCount);
    const rawText = (newAssistantTurns.at(-1) || "").trim();
    const text = cleanAssistantText(rawText);
    if (text && text !== lastText) {
      lastText = text;
      changedAt = now();
    }

    const generating = await generationState(cdp).catch(() => ({ active: null }));
    const stableFor = now() - changedAt;
    if (isProgressPlaceholder(rawText)) {
      await sleep(750);
      continue;
    }
    if (lastText && generating.active === false && stableFor >= stableMs) {
      return {
        probe,
        assistantText: lastText,
        stableMs: Math.round(stableFor),
        finishDetectedBy: "stop_button_gone",
      };
    }
    if (lastText && generating.active === null && stableFor >= stableMs * 2) {
      return {
        probe,
        assistantText: lastText,
        stableMs: Math.round(stableFor),
        finishDetectedBy: "dom_stable",
      };
    }

    await sleep(750);
  }

  const error = new Error("Timed out waiting for assistant response.");
  error.errorCode = "chatgpt.response_timeout";
  error.details = {
    timeoutMs,
    observedAssistantTurnCount: lastProbe?.assistantTurns?.length ?? null,
    observedUserTurnCount: lastProbe?.userTurns?.length ?? null,
    bodyTextLength: lastProbe?.bodyText?.length ?? null,
    partialAssistantTextLength: lastText.length,
  };
  throw error;
}
