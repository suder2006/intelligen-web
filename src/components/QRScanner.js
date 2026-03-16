'use client'
import { useEffect, useRef, useState } from 'react'

export default function QRScanner({ onScan, onClose, title = 'Scan QR Code' }) {
  const scannerRef = useRef(null)
  const [error, setError] = useState(null)
  const [started, setStarted] = useState(false)
  const html5QrCodeRef = useRef(null)

  useEffect(() => {
    let scanner = null
    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        scanner = new Html5Qrcode('qr-reader')
        html5QrCodeRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText)
          },
          () => {} // ignore errors during scan
        )
        setStarted(true)
      } catch (err) {
        setError('Camera access denied or not available. Please allow camera permission.')
      }
    }
    startScanner()
    return () => {
      if (html5QrCodeRef.current && started) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const handleClose = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop()
      }
    } catch (e) {}
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: '700', fontSize: '18px', color: '#fff' }}>{title}</div>
          <button onClick={handleClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>✕ Close</button>
        </div>

        {error ? (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#f87171', fontSize: '14px' }}>
            ❌ {error}
            <br /><br />
            <button onClick={onClose} style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>Go Back</button>
          </div>
        ) : (
          <>
            <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '12px', padding: '10px', marginBottom: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
              📷 Point camera at the QR code
            </div>
            <div id='qr-reader' style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }} />
          </>
        )}
      </div>
    </div>
  )
}