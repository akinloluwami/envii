import { describe, expect, it } from "vitest";
import {
  generateVaultId,
  verifyRecoveryPhrase,
} from "./crypto.js";

const PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const OTHER_PHRASE =
  "legal winner thank year wave sausage worth useful legal winner thank yellow";

describe("verifyRecoveryPhrase", () => {
  it("accepts the valid phrase used to create the vault", () => {
    expect(verifyRecoveryPhrase(PHRASE, generateVaultId(PHRASE))).toBe(true);
  });

  it("rejects a different valid recovery phrase", () => {
    expect(verifyRecoveryPhrase(OTHER_PHRASE, generateVaultId(PHRASE))).toBe(
      false,
    );
  });

  it("rejects arbitrary twelve-word input", () => {
    const arbitraryPhrase = Array(12).fill("random").join(" ");

    expect(verifyRecoveryPhrase(arbitraryPhrase, generateVaultId(PHRASE))).toBe(
      false,
    );
  });
});
