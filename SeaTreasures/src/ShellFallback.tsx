import { useId } from 'react'
import { getShape } from './model.ts'
import type { ShellState } from './model.ts'

export function ShellFallback({
  state,
  aperture = false,
}: {
  state: ShellState
  aperture?: boolean
}) {
  const id = useId().replaceAll(':', '')
  const shape = getShape(state.progress)
  const spots = Array.from({ length: 66 }, (_, index) => ({
    x: 125 + ((index * 67 + 13) % 352),
    y: 112 + ((index * 41 + 7) % 165),
    r: 2 + ((index * 7) % 6),
  }))
  const outline =
    'M100 208C77 138 161 79 285 86C408 88 509 145 505 213C500 285 405 314 290 299C190 291 116 269 100 208Z'
  return (
    <svg className="shell-fallback" viewBox="0 0 600 390" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-light`} cx="42%" cy="25%" r="80%">
          <stop stopColor="var(--cp-shell-lip)" />
          <stop offset=".55" stopColor="var(--cp-shell)" />
          <stop offset="1" stopColor="var(--cp-border-strong)" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <path d={outline} />
        </clipPath>
      </defs>
      <g
        transform={`translate(300 200) scale(${shape.scale}) translate(-300 -200) rotate(-12 300 200)`}
      >
        <ellipse
          cx="305"
          cy="306"
          rx="181"
          ry="14"
          fill="var(--cp-shell-spot)"
          opacity=".08"
        />
        <path d={outline} fill={`url(#${id}-light)`} />
        {aperture ? (
          <g>
            <path
              d="M126 215Q302 188 480 218"
              stroke="var(--cp-shell-spot)"
              strokeWidth={6 + shape.opening * 30}
              fill="none"
              strokeLinecap="round"
            />
            {state.progress < 75 &&
              [-1, 1].map((side) => {
                const offset = side * (3 + shape.opening * 15)
                return (
                  <path
                    key={side}
                    d={`M126 ${215 + offset}Q302 ${188 + offset} 480 ${218 + offset}`}
                    stroke="var(--cp-accent)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                )
              })}
            {Array.from({ length: 25 }, (_, i) => (
              <path
                key={i}
                d={`M${144 + i * 13} 199l3 17m-1 7l3 17`}
                stroke="var(--cp-shell-lip)"
                strokeWidth="5"
                strokeLinecap="round"
                opacity={shape.teeth}
              />
            ))}
          </g>
        ) : (
          <g clipPath={`url(#${id}-clip)`}>
            {spots.map((spot, i) => (
              <ellipse
                key={i}
                cx={spot.x}
                cy={spot.y}
                rx={spot.r}
                ry={spot.r * 0.7}
                fill="var(--cp-shell-spot)"
                opacity=".75"
              />
            ))}
            {state.mantle > 0 && (
              <path
                d={outline}
                fill="none"
                stroke="var(--cp-accent)"
                strokeWidth={state.mantle * 2.2}
                opacity=".9"
              />
            )}
            {state.showRepair && (
              <path
                d="M300 110q-45 35-12 82t-14 71"
                stroke="var(--cp-accent)"
                strokeWidth="3"
                fill="none"
              />
            )}
          </g>
        )}
        {shape.coilVisibility > 0 && (
          <path
            d="M265 202c-35-36 5-83 54-48s-1 111-64 68 0-150 87-83"
            fill="none"
            stroke="var(--cp-shell-spot)"
            strokeWidth="6"
            opacity={shape.coilVisibility}
          />
        )}
      </g>
    </svg>
  )
}
