// Renders nothing in production. Shows a banner only when the
// deployment's environment variable VITE_APP_ENV is set to "staging".
// Set that variable only on the staging Vercel project — never on
// the real ariforder.vercel.app project.
export default function EnvBanner() {
  if (import.meta.env.VITE_APP_ENV !== 'staging') return null

  return (
    <div
      style={{
        background: '#B8860B',
        color: '#fff',
        textAlign: 'center',
        padding: '8px 12px',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 0.4,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      TEST ENVIRONMENT — staging data only, not connected to real customers or drivers
    </div>
  )
}
