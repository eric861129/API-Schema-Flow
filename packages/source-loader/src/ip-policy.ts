import { BlockList, isIP } from 'node:net'

const blockedIpv4 = new BlockList()
blockedIpv4.addSubnet('0.0.0.0', 8, 'ipv4')
blockedIpv4.addSubnet('10.0.0.0', 8, 'ipv4')
blockedIpv4.addSubnet('100.64.0.0', 10, 'ipv4')
blockedIpv4.addSubnet('127.0.0.0', 8, 'ipv4')
blockedIpv4.addSubnet('169.254.0.0', 16, 'ipv4')
blockedIpv4.addSubnet('172.16.0.0', 12, 'ipv4')
blockedIpv4.addSubnet('192.0.0.0', 24, 'ipv4')
blockedIpv4.addSubnet('192.0.2.0', 24, 'ipv4')
blockedIpv4.addSubnet('192.168.0.0', 16, 'ipv4')
blockedIpv4.addSubnet('198.18.0.0', 15, 'ipv4')
blockedIpv4.addSubnet('198.51.100.0', 24, 'ipv4')
blockedIpv4.addSubnet('203.0.113.0', 24, 'ipv4')
blockedIpv4.addSubnet('224.0.0.0', 4, 'ipv4')
blockedIpv4.addSubnet('240.0.0.0', 4, 'ipv4')

const blockedIpv6 = new BlockList()
blockedIpv6.addAddress('::', 'ipv6')
blockedIpv6.addAddress('::1', 'ipv6')
blockedIpv6.addSubnet('fc00::', 7, 'ipv6')
blockedIpv6.addSubnet('fe80::', 10, 'ipv6')
blockedIpv6.addSubnet('ff00::', 8, 'ipv6')
blockedIpv6.addSubnet('2001:db8::', 32, 'ipv6')

function mappedIpv4(address: string): string | undefined {
  const match = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  return match?.[1]
}

export function isBlockedIpAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return true
  if (family === 4) return blockedIpv4.check(address, 'ipv4')

  const mapped = mappedIpv4(address)
  if (mapped !== undefined) return isBlockedIpAddress(mapped)
  return blockedIpv6.check(address, 'ipv6')
}
