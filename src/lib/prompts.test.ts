import { describe, expect, it } from "vitest";
import { buildFixPrompt } from "./prompts";

describe("buildFixPrompt", () => {
  it("tailors prompt to the selected builder", () => {
    const cursor = buildFixPrompt(
      "Cursor",
      "Missing title",
      "Add a title tag",
      "<head> empty"
    );
    expect(cursor).toContain("Cursor");
    expect(cursor).toContain("Missing title");
    expect(cursor).toContain("<head> empty");

    const lovable = buildFixPrompt("Lovable", "Missing title", "Add a title tag");
    expect(lovable).toContain("Lovable");
  });
});
