import { timingSafeEqual } from "node:crypto";

export function secureEquals(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) {
    return false;
  }
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

