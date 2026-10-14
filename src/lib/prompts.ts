import type { Builder } from "./types";

function builderContext(builder: Builder): string {
  switch (builder) {
    case "Cursor":
      return "I'm building this app in Cursor. Apply the fix carefully and show me the exact file changes.";
    case "Lovable":
      return "I'm building this with Lovable. Make the smallest change that fixes this, and keep the existing design system.";
    case "Bolt":
      return "I'm building this with Bolt.new. Implement this fix in the current project without breaking other pages.";
    case "Replit":
      return "I'm building this on Replit. Apply this fix and keep the app deployable.";
    case "v0":
      return "I'm iterating on this with v0. Update the relevant components/pages to fix this issue.";
    case "Claude Code":
      return "I'm using Claude Code. Inspect the repo, then apply a minimal patch that fixes this finding.";
    default:
      return "Apply this fix to my web app with the smallest safe change.";
  }
}

export function buildFixPrompt(
  builder: Builder,
  title: string,
  explanation: string,
  evidence?: string
): string {
  const parts = [
    builderContext(builder),
    "",
    `Issue: ${title}`,
    `Why it matters: ${explanation}`,
  ];
  if (evidence) {
    parts.push(`Evidence from launch scan: ${evidence}`);
  }
  parts.push(
    "",
    "Please:",
    "1) Locate the root cause in the codebase",
    "2) Apply a minimal fix",
    "3) Briefly explain what changed and how to verify"
  );
  return parts.join("\n");
}
