import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Parses the real tokens from globals.css so the test cannot drift from the stylesheet. */
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const token = (name: string): string => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token --color-${name} not found`);
  return m[1]!;
};

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACES = ["bg", "surface", "elevated"];

describe("design token contrast (WCAG 2.2)", () => {
  it("spec 10.1 base palette is unchanged", () => {
    expect(token("bg").toLowerCase()).toBe("#ffffff");
    expect(token("surface").toLowerCase()).toBe("#f7f9fc");
    expect(token("elevated").toLowerCase()).toBe("#f1f5fb");
    expect(token("ink").toLowerCase()).toBe("#151b2b");
    expect(token("muted").toLowerCase()).toBe("#526079");
    expect(token("line").toLowerCase()).toBe("#e2e8f0");
    expect(token("primary").toLowerCase()).toBe("#476cf0");
    expect(token("accent").toLowerCase()).toBe("#8d85f6");
  });

  it.each([
    "ink",
    "muted",
    "primary-strong",
    "accent-strong",
    "danger",
    "warning",
    "success",
    "cycle",
  ])("text colour %s is >= 4.5:1 on every surface", (name) => {
    for (const s of SURFACES)
      expect(contrast(token(name), token(s)), `${name} on ${s}`).toBeGreaterThanOrEqual(4.5);
  });

  it("white text on the filled primary button is >= 4.5:1", () => {
    expect(contrast("#ffffff", token("primary-strong"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", "#2b45b8")).toBeGreaterThanOrEqual(4.5); // hover colour
    expect(contrast("#ffffff", token("ink"))).toBeGreaterThanOrEqual(4.5); // node tag
  });

  it("text on soft tinted backgrounds is >= 4.5:1", () => {
    expect(contrast(token("ink"), token("primary-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("ink"), token("accent-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("muted"), token("accent-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("danger"), token("danger-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("warning"), token("warning-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("success"), token("success-soft"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("ink"), token("warning-soft"))).toBeGreaterThanOrEqual(4.5);
  });

  it("control borders, focus ring, edges and highlights are >= 3:1 against the canvas", () => {
    for (const s of SURFACES) {
      expect(contrast(token("control"), token(s)), `control on ${s}`).toBeGreaterThanOrEqual(3);
      expect(contrast(token("focus"), token(s)), `focus on ${s}`).toBeGreaterThanOrEqual(3);
      expect(contrast(token("edge"), token(s)), `edge on ${s}`).toBeGreaterThanOrEqual(3);
      expect(contrast(token("accent-strong"), token(s))).toBeGreaterThanOrEqual(3);
      expect(contrast(token("cycle"), token(s))).toBeGreaterThanOrEqual(3);
    }
    // primary (#476CF0) is used for graphics only on the white/surface graph canvas
    expect(contrast(token("primary"), token("bg"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("primary"), token("surface"))).toBeGreaterThanOrEqual(3);
  });
});
