import { describe, expect, it } from "vitest";
import { redactPii } from "./redact";

describe("redactPii", () => {
  it("redacts a 13-digit SA ID number", () => {
    expect(redactPii("My ID is 8501015009087.")).toBe("My ID is [REDACTED_ID_NUMBER].");
  });

  it("redacts email addresses", () => {
    expect(redactPii("Contact me at thandi.mokoena@dsac.demo.gov.za please.")).toBe("Contact me at [REDACTED_EMAIL] please.");
  });

  it("redacts phone numbers in common SA formats", () => {
    expect(redactPii("Call 082 555 1234 or +27 82 555 1234.")).toBe("Call [REDACTED_PHONE] or [REDACTED_PHONE].");
  });

  it("leaves ordinary text and numbers untouched", () => {
    const text = "Q1 utilisation was 62% against a target of 75%.";
    expect(redactPii(text)).toBe(text);
  });

  it("does not falsely redact a short number sequence", () => {
    expect(redactPii("The entity ID is 12345.")).toBe("The entity ID is 12345.");
  });
});
