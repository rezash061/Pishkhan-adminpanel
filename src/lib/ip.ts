function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!/^\d{1,3}$/.test(part) || n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** Exact match for any address, CIDR match for IPv4 (`10.8.0.0/16`). IPv4-mapped IPv6 is normalised. */
export function ipAllowed(ip: string | null, allowlist: readonly string[]): boolean {
  if (!ip) return false;
  const address = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return allowlist.some((entry) => {
    if (!entry.includes("/")) return entry === address;
    const [base, bitsText] = entry.split("/");
    const bits = Number(bitsText);
    const baseInt = ipv4ToInt(base ?? "");
    const ipInt = ipv4ToInt(address);
    if (baseInt === null || ipInt === null || !(bits >= 0 && bits <= 32)) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((baseInt & mask) >>> 0) === ((ipInt & mask) >>> 0);
  });
}
