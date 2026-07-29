/**
 * InviteCodeGenerator — ported verbatim from Swift InviteCodeGenerator.swift.
 *
 * 8-char codes from a 32-char alphabet (no ambiguous chars: 0/O/1/l/I).
 * ~40 bits of entropy. Collision-retry against existing codes.
 */

// 32 chars: a-z (minus i, l, o) + 2-9 (minus 0, 1). Matches the Swift alphabet exactly.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const LENGTH = 8;

/**
 * Generate a single invite code using crypto.getRandomValues.
 */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Generate an invite code, retrying up to 10 times if it collides with an existing code.
 * Returns null if all 10 attempts collide (astronomically unlikely).
 */
export function generateUniqueInviteCode(existing: Set<string>): string | null {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    if (!existing.has(code)) return code;
  }
  return null;
}
