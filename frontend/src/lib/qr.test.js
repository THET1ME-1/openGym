import { describe, it, expect } from 'vitest'
import { normalizeFmt, canRenderFmt, barcodeSvg } from './qr.js'

// The QR helpers decide which scanned/typed codes the check-in feature will store: it can read
// many symbologies but only redraw QR, so canRenderFmt is the gate, and normalizeFmt is what
// folds every spelling mlkit might report into the single token everything else compares on.

describe('normalizeFmt', () => {
  it('folds every QR spelling to "qrcode"', () => {
    // mlkit's BarcodeFormat, the enum-ish casings, and the casual 'qr' all mean the same thing.
    expect(normalizeFmt('QR_CODE')).toBe('qrcode')
    expect(normalizeFmt('QrCode')).toBe('qrcode')
    expect(normalizeFmt('qrcode')).toBe('qrcode')
    expect(normalizeFmt('qr')).toBe('qrcode')
    expect(normalizeFmt('QR')).toBe('qrcode')
  })

  it('lower-cases and strips separators for other formats', () => {
    expect(normalizeFmt('EAN_13')).toBe('ean13')
    expect(normalizeFmt('Code128')).toBe('code128')
    expect(normalizeFmt('CODE_128')).toBe('code128')
  })

  it('treats empty / nullish as an empty token rather than throwing', () => {
    expect(normalizeFmt('')).toBe('')
    expect(normalizeFmt(null)).toBe('')
    expect(normalizeFmt(undefined)).toBe('')
  })
})

describe('canRenderFmt', () => {
  it('accepts only QR, in any spelling', () => {
    expect(canRenderFmt('QR_CODE')).toBe(true)
    expect(canRenderFmt('QrCode')).toBe(true)
    expect(canRenderFmt('qr')).toBe(true)
  })

  it('accepts the barcodes a membership card carries, drawn by bwip-js', () => {
    for (const fmt of ['EAN_13', 'EAN_8', 'CODE_128', 'CODE_39', 'CODE_93', 'CODABAR', 'ITF', 'UPC_A', 'UPC_E', 'PDF_417', 'AZTEC', 'DATA_MATRIX']) {
      expect(canRenderFmt(fmt)).toBe(true)
    }
  })

  it('rejects empty / unknown formats', () => {
    expect(canRenderFmt('')).toBe(false)
    expect(canRenderFmt(null)).toBe(false)
    expect(canRenderFmt('something-else')).toBe(false)
    expect(canRenderFmt('UNKNOWN')).toBe(false)
  })
})

describe('barcodeSvg', () => {
  it('draws an EAN-13 card number as bars', async () => {
    expect(await barcodeSvg('5901234123457', 'EAN_13')).toMatch(/^<svg[\s\S]*<\/svg>\s*$/)
  })

  it('draws a Code 128 card with letters in it', async () => {
    expect(await barcodeSvg('MEMBER-9931', 'CODE_128')).toContain('<svg')
  })

  it('draws a Codabar number that came without its start and stop letters', async () => {
    expect(await barcodeSvg('1234567', 'CODABAR')).toContain('<svg')
  })

  it('gives null for a value the format cannot hold, never wrong bars', async () => {
    expect(await barcodeSvg('ABC', 'EAN_13')).toBeNull()
    expect(await barcodeSvg('12345678901234567', 'EAN_13')).toBeNull()
  })

  it('gives null for QR, which lean-qr draws', async () => {
    expect(await barcodeSvg('X', 'QR_CODE')).toBeNull()
  })
})
