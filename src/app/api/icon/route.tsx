import { ImageResponse } from 'next/og'

export function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const size = Number(searchParams.get('s') ?? 512)

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: '#0A0A0A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size * 0.2,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <span style={{
            color: '#C9F042',
            fontSize: size * 0.42,
            fontWeight: 900,
            lineHeight: 1,
            fontFamily: 'sans-serif',
            letterSpacing: '-4px',
          }}>
            C+
          </span>
          <span style={{
            color: 'rgba(201,240,66,0.5)',
            fontSize: size * 0.09,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            letterSpacing: '2px',
            marginTop: size * 0.02,
          }}>
            CONTAS
          </span>
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
