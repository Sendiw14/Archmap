import { describe, expect, it } from "vitest";
import { canManage, forgetManage, rememberManage } from "./session";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe("management session flag", () => {
  it("is keyed by analysis id and removable", () => {
    const s = new MemoryStorage() as unknown as Storage;
    rememberManage("a", true, s);
    expect(canManage("a", s)).toBe(true);
    expect(canManage("b", s)).toBe(false);
    forgetManage("a", s);
    expect(canManage("a", s)).toBe(false);
  });

  it("does not store anything when the create response said canManage=false", () => {
    const s = new MemoryStorage() as unknown as Storage;
    rememberManage("a", false, s);
    expect(canManage("a", s)).toBe(false);
  });

  it("never throws when storage is unavailable", () => {
    const broken = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => rememberManage("a", true, broken)).not.toThrow();
    expect(canManage("a", broken)).toBe(false);
  });
});
