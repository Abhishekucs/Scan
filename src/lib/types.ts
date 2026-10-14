export const BUILDERS = [
  "Cursor",
  "Lovable",
  "Bolt",
  "Replit",
  "v0",
  "Claude Code",
  "Other",
] as const;

export type Builder = (typeof BUILDERS)[number];

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Category = "security" | "seo" | "performance" | "links";

export interface Finding {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  explanation: string;
  evidence?: string;
  fixPrompt: string;
}

export interface CategoryScore {
  score: number;
  maxScore: number;
  findings: Finding[];
}

export interface ScanScores {
  overall: number;
  security: CategoryScore;
  seo: CategoryScore;
  performance: CategoryScore;
  links: CategoryScore;
}

export interface ScanMeta {
  url: string;
  finalUrl: string;
  builder: Builder;
  scannedAt: string;
  title?: string;
  ttfbMs?: number;
  pageWeightBytes?: number;
  requestCount?: number;
  pagespeedUsed?: boolean;
}

export interface ScanResult {
  id: string;
  meta: ScanMeta;
  scores: ScanScores;
  findings: Finding[];
  unlocked: boolean;
  stripeSessionId?: string;
}

export interface ScanRequest {
  url: string;
  builder: Builder;
  ownsApp: boolean;
}
