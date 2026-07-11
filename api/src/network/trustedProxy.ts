import proxyaddr from 'proxy-addr';

export function parseTrustedProxyCidrs(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function createTrustedProxyPolicy(cidrs: readonly string[]) {
  if (!cidrs.length) return () => false;
  const trust = proxyaddr.compile([...cidrs]);
  return (address: string, index: number) => trust(address, index);
}
