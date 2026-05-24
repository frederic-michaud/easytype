import { STARS } from '../constants';

export default function StarField({ brightMult = 0.5 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {STARS.map(s => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            borderRadius: '50%',
            background: 'white',
            opacity: s.baseOp * brightMult,
            animation: `twinkle ${s.dur}s ease-in-out infinite alternate`,
            transition: 'opacity .35s',
            boxShadow: brightMult > .75 && s.s > 1
              ? `0 0 ${s.s * 4}px rgba(255,255,255,${(brightMult - .3).toFixed(2)})`
              : 'none',
          }}
        />
      ))}
    </div>
  );
}
