/** Scoped CSS that lights one named part, so a selection never rebuilds the drawing. */
export function highlight(scope: string, part: string) {
  const at = `#${scope} [data-part="${part}"]`
  return [
    `${at}.an-q{fill:color-mix(in srgb,var(--an-tone) 84%,var(--cp-accent));stroke:color-mix(in srgb,var(--an-tone) 84%,var(--cp-accent))}`,
    `${at}.an-q[data-soft]{fill:color-mix(in srgb,var(--an-tone) 66%,var(--cp-accent));stroke:color-mix(in srgb,var(--an-tone) 66%,var(--cp-accent))}`,
    `${at}.an-edge{stroke:var(--anatomy-lit)}`,
    `${at}.an-cut{fill:var(--anatomy-lit-top);stroke:var(--anatomy-lit-top)}`,
  ].join('')
}
