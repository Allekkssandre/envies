import { describe, expect, it } from "vitest";
import { splitTitle } from "./splitTitle";

describe("splitTitle", () => {
  it("met le premier mot à part", () => {
    expect(splitTitle("Mes 30 ans")).toEqual({ first: "Mes", rest: "30 ans" });
    expect(splitTitle("Maison & déco")).toEqual({ first: "Maison", rest: "& déco" });
  });

  it("gère un seul mot et les espaces superflus", () => {
    expect(splitTitle("Envies")).toEqual({ first: "Envies", rest: "" });
    expect(splitTitle("  Noël   2026 ")).toEqual({ first: "Noël", rest: "2026" });
    expect(splitTitle("")).toEqual({ first: "", rest: "" });
  });
});
