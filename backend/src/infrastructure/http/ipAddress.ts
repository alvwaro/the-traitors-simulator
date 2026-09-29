import { isIPv4, isIPv6 } from 'node:net';

/**
 * Classificação de endereços IP para o proxy de imagens (proteção contra SSRF): só endereços públicos da
 * internet passam. As faixas especiais (RFC 6890) são reconhecidas pelos números de cada trecho do endereço.
 */

/** Os quatro números de um IPv4 ("a.b.c.d"). */
function ipv4Octets(address: string): number[] {
  return address.split('.').map(Number);
}

/** IPv4 fora da internet pública: a própria máquina, redes privadas, link-local (metadados de nuvem), CGNAT, documentação... */
function isSpecialIPv4([a, b, c]: readonly number[]): boolean {
  switch (a) {
    case 0: // "esta rede"
    case 10: // rede privada
    case 127: // a própria máquina
      return true;
    case 100:
      return b >= 64 && b <= 127; // CGNAT (100.64/10)
    case 169:
      return b === 254; // link-local (inclui os metadados de nuvem)
    case 172:
      return b >= 16 && b <= 31; // rede privada (172.16/12)
    case 192:
      return b === 168 || (b === 0 && (c === 0 || c === 2)); // rede privada, IETF e documentação
    case 198:
      return b === 18 || b === 19 || (b === 51 && c === 100); // testes de desempenho e documentação
    case 203:
      return b === 0 && c === 113; // documentação
    default:
      return a >= 224; // multicast, reservado e broadcast
  }
}

/** Os oito grupos de 16 bits de um IPv6 já validado (aceita "::" e um IPv4 no fim, como em ::ffff:1.2.3.4). */
function ipv6Groups(address: string): number[] {
  let text = address.split('%')[0].toLowerCase();
  const embedded: number[] = [];
  if (text.includes('.')) {
    const cut = text.lastIndexOf(':');
    const [a, b, c, d] = ipv4Octets(text.slice(cut + 1));
    embedded.push(a * 256 + b, c * 256 + d);
    text = text.slice(0, cut + 1);
    if (!text.endsWith('::')) text = text.slice(0, -1);
  }
  const hextets = (part: string) => (part ? part.split(':').map((h) => Number.parseInt(h, 16)) : []);
  const [head, tail] = text.includes('::') ? text.split('::') : [text, ''];
  const left = hextets(head);
  const right = [...hextets(tail), ...embedded];
  return [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];
}

const allZero = (groups: readonly number[]) => groups.every((g) => g === 0);

/** IPv4 guardado nos dois últimos grupos (ou em outros dois, no 6to4). */
const embeddedIPv4 = (high: number, low: number) => [high >> 8, high & 255, low >> 8, low & 255];

function isSpecialIPv6(groups: readonly number[]): boolean {
  const [first, second] = groups;
  if (allZero(groups.slice(0, 5)) && groups[5] === 0xffff) return isSpecialIPv4(embeddedIPv4(groups[6], groups[7])); // IPv4 mapeado
  if (first === 0x64 && second === 0xff9b && allZero(groups.slice(2, 6))) return isSpecialIPv4(embeddedIPv4(groups[6], groups[7])); // NAT64
  if (first === 0x2002) return isSpecialIPv4(embeddedIPv4(second, groups[2])); // 6to4
  // Só os endereços globais (2000::/3) são públicos; dentro deles, ficam de fora os protocolos da IETF
  // (Teredo, testes...) e a faixa de documentação. O resto (loopback, link-local, redes locais, multicast) nunca é público.
  const globalUnicast = (first & 0xe000) === 0x2000;
  const ietfProtocols = first === 0x2001 && second < 0x0200;
  const documentation = first === 0x2001 && second === 0x0db8;
  return !globalUnicast || ietfProtocols || documentation;
}

/** O endereço (IPv4 ou IPv6) é público na internet? Texto que não é IP nunca é público. */
export function isPublicAddress(address: string): boolean {
  if (isIPv4(address)) return !isSpecialIPv4(ipv4Octets(address));
  if (isIPv6(address)) return !isSpecialIPv6(ipv6Groups(address));
  return false;
}
