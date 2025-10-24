export function formatTokenPretty(amount: string | number | bigint, decimals?: number | null): string {
  const value = typeof amount === "bigint" ? amount : BigInt(String(amount));
  const places = typeof decimals === "number" && Number.isInteger(decimals) && decimals >= 0 ? decimals : 0;
  if (places === 0) {
    return value.toString();
  }
  const factor = BigInt(10) ** BigInt(places);
  const whole = value / factor;
  const fraction = value % factor;
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  return `${whole.toString()}.${fraction.toString().padStart(places, "0").replace(/0+$/, "")}`;
}
