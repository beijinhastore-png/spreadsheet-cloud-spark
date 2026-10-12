import { describe, expect, it } from "vitest";
import { formatarBRLCompacto, formatarPercentualSinal, formatarMes } from "@/lib/format";

describe("formatadores", () => {
  it("BRL compacto em milhões", () => expect(formatarBRLCompacto(1_234_000)).toBe("R$ 1,2 mi"));
  it("BRL compacto em mil", () => expect(formatarBRLCompacto(350_000)).toBe("R$ 350 mil"));
  it("percentual com sinal positivo", () => expect(formatarPercentualSinal(0.082)).toBe("+8,2%"));
  it("percentual com sinal negativo", () => expect(formatarPercentualSinal(-0.03)).toBe("−3,0%"));
  it("mês curto", () => expect(formatarMes("2026-01-15")).toBe("jan/26"));
});
