export default function Rocket({ power = 0, w = 70, h = 130 }) {
  const sc = w / 70;
  const fp = Math.min(100, Math.max(0, power));
  const fH = (20 + fp * .9) * sc;
  const fW = (14 + fp * .18) * sc;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={w} height={h} viewBox="0 0 70 130" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="rg1" x1="0" x2="1">
            <stop offset="0%" stopColor="#7080a0" />
            <stop offset="40%" stopColor="#ccdcea" />
            <stop offset="100%" stopColor="#7080a0" />
          </linearGradient>
          <linearGradient id="rg2" x1="0" x2="1">
            <stop offset="0%" stopColor="#9aaabb" />
            <stop offset="50%" stopColor="#eef2f8" />
            <stop offset="100%" stopColor="#9aaabb" />
          </linearGradient>
        </defs>
        <path d="M35 6 L17 52 Q35 43 53 52 Z" fill="url(#rg2)" />
        <rect x="17" y="50" width="36" height="58" rx="7" fill="url(#rg1)" />
        <circle cx="35" cy="70" r="11" fill="#4ab0e0" stroke="#3880c0" strokeWidth="2.5" />
        <circle cx="35" cy="70" r="7" fill="#80d0f0" opacity=".7" />
        <circle cx="30" cy="65" r="2.5" fill="white" opacity=".45" />
        <rect x="17" y="84" width="36" height="6" fill="#cc2233" opacity=".75" />
        <rect x="17" y="90" width="36" height="3" fill="white" opacity=".55" />
        <path d="M24 108 L19 123 L51 123 L46 108 Z" fill="#686e80" />
        <path d="M17 84 L6 118 L17 105 Z" fill="#4858a0" />
        <path d="M53 84 L64 118 L53 105 Z" fill="#4858a0" />
        <ellipse cx="35" cy="123" rx="16" ry="4.5" fill="#484e60" />
      </svg>

      {fp > 3 && (
        <div style={{ marginTop: -7 * sc, position: 'relative', width: fW + 12 * sc, height: fH * 1.5 }}>
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: fW + 12 * sc, height: fH * 1.5,
            background: 'linear-gradient(to bottom,#ff6a0077,#ff220033 60%,transparent)',
            borderRadius: '40% 40% 60% 60%',
            filter: `blur(${5 * sc}px)`,
            animation: 'flkr1 .13s ease-in-out infinite alternate',
          }} />
          <div style={{
            position: 'absolute', top: 3 * sc, left: '50%', transform: 'translateX(-50%)',
            width: fW, height: fH,
            background: 'linear-gradient(to bottom,#fff,#ffe066 22%,#ff8800 65%,transparent)',
            borderRadius: '40% 40% 60% 60%',
            filter: `blur(${(1 + fp * .012) * sc}px)`,
            animation: 'flkr2 .09s ease-in-out infinite alternate',
          }} />
        </div>
      )}
    </div>
  );
}
