import { describe, expect, it } from 'vitest';
import { isPublicAddress } from '../../src/infrastructure/http/ipAddress';

describe('isPublicAddress (proteção contra SSRF)', () => {
  it.each([
    '8.8.8.8',
    '93.184.216.34',
    '172.15.0.1',
    '172.32.0.1',
    '100.63.0.1',
    '100.128.0.1',
    '192.169.0.1',
    '223.255.255.255',
    '2606:4700:4700::1111',
    '2a00:1450:4001:82a::200e',
    '::ffff:8.8.8.8',
    '::ffff:808:808',
    '64:ff9b::8.8.8.8',
    '2002:808:808::1',
  ])('deixa passar o endereço público %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ['0.0.0.0', 'esta rede'],
    ['10.1.2.3', 'rede privada'],
    ['127.0.0.1', 'a própria máquina'],
    ['169.254.169.254', 'metadados de nuvem'],
    ['172.16.0.1', 'rede privada'],
    ['172.31.255.255', 'rede privada'],
    ['192.168.1.1', 'rede privada'],
    ['100.64.0.1', 'CGNAT'],
    ['192.0.0.8', 'IETF'],
    ['192.0.2.1', 'documentação'],
    ['198.18.0.1', 'testes de desempenho'],
    ['198.51.100.7', 'documentação'],
    ['203.0.113.9', 'documentação'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['::', 'endereço vazio'],
    ['::1', 'a própria máquina'],
    ['fe80::1', 'link-local'],
    ['fe80::1%eth0', 'link-local com zona'],
    ['fd12:3456::1', 'rede local (ULA)'],
    ['ff02::1', 'multicast'],
    ['2001:db8::1', 'documentação'],
    ['2001:0:4136:e378:8000:63bf:3fff:fdd2', 'Teredo'],
    ['::ffff:127.0.0.1', 'IPv4 mapeado'],
    ['::FFFF:7F00:0001', 'IPv4 mapeado em hexadecimal'],
    ['::127.0.0.1', 'IPv4 compatível (obsoleto)'],
    ['64:ff9b::7f00:1', 'NAT64 apontando para a máquina'],
    ['2002:c0a8:101::1', '6to4 apontando para a rede privada'],
    ['localhost', 'nome (não é IP)'],
    ['1.2.3', 'IP incompleto'],
  ])('barra %s (%s)', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});
