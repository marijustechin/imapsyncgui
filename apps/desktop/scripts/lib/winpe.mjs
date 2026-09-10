#!/usr/bin/env node
// Minimal, dependency-free PE (Portable Executable) header inspection for
// verifying that a staged Windows runtime binary is a 64-bit x86-64 (AMD64)
// image. This is used by the native Windows validation/self-test tooling so
// that architecture is proven from the binary itself, not from the filename.
//
// Layout checked (per the PE/COFF specification):
//   - 0x00  "MZ" DOS header signature;
//   - 0x3C  e_lfanew (u32le) -> offset of the PE header;
//   - +0x00 "PE\0\0" signature;
//   - +0x04 COFF machine (u16le); 0x8664 == AMD64.

import { readFileSync } from 'node:fs'

export const PE_MACHINE_AMD64 = 0x8664

export const PE_MACHINE_I386 = 0x014c

export function readPeMachine(buffer) {
  if (buffer.length < 0x40) {
    throw new Error('file too small to be a PE executable')
  }
  if (buffer[0] !== 0x4d || buffer[1] !== 0x5a) {
    throw new Error('not a PE executable (missing MZ signature)')
  }

  const peOffset = buffer.readUInt32LE(0x3c)
  if (peOffset + 6 > buffer.length) {
    throw new Error('invalid PE header offset')
  }

  const signature = buffer.toString('ascii', peOffset, peOffset + 4)
  if (signature !== 'PE\0\0') {
    throw new Error('missing PE signature')
  }

  return buffer.readUInt16LE(peOffset + 4)
}

export function assertPeX64(filePath) {
  const buffer = readFileSync(filePath)
  const machine = readPeMachine(buffer)
  if (machine !== PE_MACHINE_AMD64) {
    const label = machine === PE_MACHINE_I386 ? 'x86 (32-bit)' : `0x${machine.toString(16)}`
    throw new Error(`PE executable is not AMD64: machine ${label}`)
  }
  return machine
}
