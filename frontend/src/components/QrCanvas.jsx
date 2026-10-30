import { useEffect, useRef, useState } from 'react'
import { renderQrToCanvas, barcodeSvg, normalizeFmt } from '../lib/qr.js'
import { t } from '../lib/i18n.js'

// Fork change: a card with a barcode (`fmt` other than QR) is drawn as an SVG from bwip-js, as
// wide as the QR would be. A one-line barcode then comes out low, a square code square.
export default function QrCanvas({ value, fmt, size = 240, className = '' }) {
  const token = normalizeFmt(fmt) || 'qrcode'
  if (token === 'qrcode') return <QrOnCanvas value={value} size={size} className={className} />
  return <BarcodeSvg value={value} fmt={token} size={size} className={className} />
}

function BarcodeSvg({ value, fmt, size, className }) {
  const [svg, setSvg] = useState(null)

  useEffect(() => {
    let alive = true
    setSvg(null)
    barcodeSvg(value, fmt)
      .then(text => { if (alive) setSvg(text) })
      .catch(() => { if (alive) setSvg(null) })
    return () => { alive = false }
  }, [value, fmt])

  return (
    <div
      className={'barcode-svg ' + className}
      style={{ width: size, opacity: svg ? 1 : 0 }}
      role="img"
      aria-label={t('Barcode')}
      dangerouslySetInnerHTML={{ __html: svg || '' }}
    />
  )
}

// Renders a gym check-in code as a QR image on a <canvas>. lean-qr draws one module per pixel;
// CSS (.qr-canvas) scales it up with image-rendering: pixelated so it stays razor-sharp at any
// display size without re-generating. Regenerated from `value` on every change — we never store
// the picture (see lib/qr.js).
//
// The lib loads via dynamic import, so the first paint is a frame behind; a plain box holds the
// space until then. A render failure (empty value, lib load error) shows nothing rather than a
// broken canvas — the caller decides what an unusable card looks like.
function QrOnCanvas({ value, size, className }) {
  const ref = useRef(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let alive = true
    setOk(false)
    renderQrToCanvas(ref.current, value)
      .then(mods => { if (alive) setOk(mods > 0) })
      .catch(() => { if (alive) setOk(false) })
    return () => { alive = false }
  }, [value])

  return (
    <canvas
      ref={ref}
      className={'qr-canvas ' + className}
      style={{ width: size, height: size, opacity: ok ? 1 : 0 }}
      aria-label={t('QR code')}
    />
  )
}
