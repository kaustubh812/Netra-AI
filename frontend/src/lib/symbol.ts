export function toUrlSymbol(symbol: string): string {
  return symbol.replace(/\.NS$/i, "");
}

export function fromUrlSymbol(urlSymbol: string): string {
  const decoded = decodeURIComponent(urlSymbol);
  return /\.NS$/i.test(decoded) ? decoded : `${decoded}.NS`;
}
