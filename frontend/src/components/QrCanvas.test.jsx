// @vitest-environment happy-dom
//
// The card face draws a QR on a canvas (lean-qr) and every other format as bars from bwip-js.
// happy-dom has no real canvas, so the QR side is only checked for picking the canvas.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import QrCanvas from './QrCanvas.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const show = async props => {
  await act(async () => { root.render(<QrCanvas {...props} />) })
  // bwip-js loads through a dynamic import
  await act(async () => { await new Promise(r => setTimeout(r, 50)) })
}

describe('QrCanvas', () => {
  it('draws a QR card on the canvas', async () => {
    await show({ value: 'MEMBER-9931', fmt: 'qrcode' })
    expect(host.querySelector('canvas')).toBeTruthy()
    expect(host.querySelector('svg')).toBeFalsy()
  })

  it('a card saved without a format is still a QR', async () => {
    await show({ value: 'MEMBER-9931' })
    expect(host.querySelector('canvas')).toBeTruthy()
  })

  it('draws a barcode card as bars, wider than it is tall', async () => {
    await show({ value: '5901234123457', fmt: 'ean13', size: 230 })
    const svg = host.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(host.querySelector('canvas')).toBeFalsy()
    const [, , w, h] = svg.getAttribute('viewBox').split(' ').map(Number)
    expect(w).toBeGreaterThan(h)
  })

  it('a value the format cannot hold shows nothing rather than wrong bars', async () => {
    await show({ value: 'ABC', fmt: 'ean13' })
    expect(host.querySelector('svg')).toBeFalsy()
  })
})
