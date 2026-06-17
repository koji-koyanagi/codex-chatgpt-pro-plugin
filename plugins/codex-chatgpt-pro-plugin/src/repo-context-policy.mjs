export const REPO_CONTEXT_MODES = ["auto", "upload", "inline", "off"];

const AUTO_REPO_CONTEXT_KEYWORDS = [
  "architecture",
  "architectural",
  "codebase",
  "concurrency",
  "debug",
  "design",
  "failure",
  "failing",
  "feature",
  "implementation",
  "migration",
  "multi-agent",
  "package",
  "plan",
  "planning",
  "plugin",
  "refactor",
  "repo",
  "research",
  "review",
  "session history",
  "spec",
  "specification",
  "system",
  "test",
  "tradeoff",
  "upload",
];

export function decideRepoContextMode({
  requestedMode = "auto",
  prompt = "",
  contextDir = "",
  contextFile = "",
  uploadFileCount = 0,
} = {}) {
  if (!REPO_CONTEXT_MODES.includes(requestedMode)) {
    const error = new Error(`Unsupported repo context mode: ${requestedMode}. Use auto, upload, inline, or off.`);
    error.errorCode = "input.repo_context_mode_unsupported";
    throw error;
  }

  if (requestedMode !== "auto") {
    return {
      requestedMode,
      effectiveMode: requestedMode,
      attached: ["upload", "inline"].includes(requestedMode),
      reason: "explicit",
      matchedKeywords: [],
    };
  }

  if (contextDir) {
    return {
      requestedMode,
      effectiveMode: "off",
      attached: false,
      reason: "context_dir_supplied",
      matchedKeywords: [],
    };
  }

  if (contextFile) {
    return {
      requestedMode,
      effectiveMode: "off",
      attached: false,
      reason: "context_file_supplied",
      matchedKeywords: [],
    };
  }

  if (uploadFileCount > 0) {
    return {
      requestedMode,
      effectiveMode: "off",
      attached: false,
      reason: "upload_files_supplied",
      matchedKeywords: [],
    };
  }

  const normalizedPrompt = String(prompt || "").toLowerCase();
  const matchedKeywords = AUTO_REPO_CONTEXT_KEYWORDS.filter((keyword) => normalizedPrompt.includes(keyword));
  if (matchedKeywords.length > 0) {
    return {
      requestedMode,
      effectiveMode: "upload",
      attached: true,
      reason: "auto_keyword_match",
      matchedKeywords,
    };
  }

  if (normalizedPrompt.length >= 1200) {
    return {
      requestedMode,
      effectiveMode: "upload",
      attached: true,
      reason: "auto_long_prompt",
      matchedKeywords: [],
    };
  }

  return {
    requestedMode,
    effectiveMode: "off",
    attached: false,
    reason: "auto_no_repo_context_signal",
    matchedKeywords: [],
  };
}
