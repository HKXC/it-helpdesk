// "Light bulb" theme switch: a bulb drops on its cord above the toggle button,
// gets tugged, switches on/off, and the new theme spreads out from the bulb.
// Falls back to an instant switch when the user prefers reduced motion.

const BULB_SVG = `
<svg viewBox="0 0 64 96" width="64" height="96" aria-hidden="true">
  <defs>
    <radialGradient id="fd-bulb-lit" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="#fffbe6"/>
      <stop offset="45%" stop-color="#ffe27a"/>
      <stop offset="100%" stop-color="#f5b82e"/>
    </radialGradient>
    <radialGradient id="fd-bulb-off" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#e9eef3"/>
      <stop offset="100%" stop-color="#9aa8b6"/>
    </radialGradient>
  </defs>
  <rect x="24" y="0" width="16" height="16" rx="3" fill="#56616d"/>
  <rect x="22" y="14" width="20" height="6" rx="2" fill="#7b8794"/>
  <rect x="22" y="21" width="20" height="5" rx="2" fill="#7b8794"/>
  <path class="fd-bulb-glass" d="M20 28 h24 c0 6 4 9 8 15 a22 22 0 1 1 -40 0 c4 -6 8 -9 8 -15 z"/>
  <path class="fd-bulb-filament" d="M26 52 q3 -8 6 0 q3 8 6 0" fill="none" stroke-width="2.4" stroke-linecap="round"/>
  <ellipse cx="25" cy="50" rx="4" ry="8" fill="#fff" opacity=".45"/>
</svg>`;

let running = false;

export function playThemeSwitch(button: HTMLElement | null, toDark: boolean, apply: () => void) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || running || !button) {
    apply();
    return;
  }
  running = true;
  const rect = button.getBoundingClientRect();
  const x = Math.round(rect.left + rect.width / 2);
  const drop = Math.min(260, Math.max(170, window.innerHeight * 0.28));

  const rig = document.createElement('div');
  rig.className = 'fd-bulb-rig ' + (toDark ? 'is-lit' : 'is-off');
  rig.style.left = x + 'px';
  rig.style.setProperty('--drop', drop + 'px');
  rig.innerHTML = `<div class="fd-bulb-cord"></div><div class="fd-bulb">${BULB_SVG}<span class="fd-bulb-glow"></span></div>`;
  document.body.appendChild(rig);

  // Bulb centre after it has dropped: the reveal circle starts here.
  const cx = x,
    cy = drop + 58;

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };

  window.setTimeout(() => rig.classList.add('is-tug'), 560);
  window.setTimeout(() => {
    rig.classList.toggle('is-lit', !toDark);
    rig.classList.toggle('is-off', toDark);
    rig.classList.add(toDark ? 'is-switch-off' : 'is-switch-on');
    let applied = false;
    const commit = () => {
      if (applied) return;
      applied = true;
      document.documentElement.dataset.theme = toDark ? 'dark' : 'light';
      document.documentElement.style.colorScheme = toDark ? 'dark' : 'light';
      apply();
    };
    if (doc.startViewTransition && document.visibilityState === 'visible') {
      document.documentElement.classList.add('fd-theme-swap');
      let vt;
      try {
        vt = doc.startViewTransition(commit);
      } catch {
        commit();
        return;
      }
      // Safety net: the theme must change even if the transition is skipped.
      window.setTimeout(commit, 400);
      vt.ready
        .then(() => {
          const r = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${r}px at ${cx}px ${cy}px)`] },
            {
              duration: 750,
              easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          );
        })
        .catch(() => {});
      vt.finished
        .catch(() => {})
        .finally(() => {
          commit();
          document.documentElement.classList.remove('fd-theme-swap');
        });
    } else {
      const flash = document.createElement('div');
      flash.className = 'fd-theme-flash ' + (toDark ? 'to-dark' : 'to-light');
      flash.style.setProperty('--cx', cx + 'px');
      flash.style.setProperty('--cy', cy + 'px');
      document.body.appendChild(flash);
      commit();
      window.setTimeout(() => flash.remove(), 800);
    }
  }, 760);
  window.setTimeout(() => rig.classList.add('is-leave'), 1750);
  window.setTimeout(() => {
    rig.remove();
    running = false;
  }, 2350);
}
