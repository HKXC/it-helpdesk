// Full-screen transition for signing in and out.
// A brand-coloured circle grows from the button that was pressed, shows a short
// welcome / goodbye card, swaps the screen underneath, then zooms away.
// Reduced-motion users get the change immediately.

type Options = {
  mode: 'in' | 'out';
  title: string;
  subtitle: string;
  origin?: HTMLElement | null;
  /** Runs once the screen is covered. May be async (e.g. the logout request). */
  apply: () => void | Promise<void>;
};

const ICON_IN = `
<svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
  <circle class="fd-auth-ring" cx="26" cy="26" r="24" fill="none" stroke-width="3"/>
  <path class="fd-auth-check" d="M15 27 l7 7 l15 -16" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

let running = false;
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
// Animations can be paused in background tabs; never wait longer than the duration.
const settle = (a: Animation, ms: number) =>
  Promise.race([a.finished.catch(() => {}), wait(ms + 250)]);

export async function playAuthTransition({ mode, title, subtitle, origin, apply }: Options) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || running) {
    await apply();
    return;
  }
  running = true;
  const r = origin?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : innerWidth / 2;
  const y = r ? r.top + r.height / 2 : innerHeight / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  const fx = document.createElement('div');
  fx.className = 'fd-auth-fx is-' + mode;
  fx.setAttribute('role', 'status');
  fx.innerHTML = `
    <div class="fd-auth-card">
      <div class="fd-auth-icon">${mode === 'in' ? ICON_IN : '<span class="fd-auth-wave">👋</span>'}</div>
      <h2></h2>
      <p></p>
      <div class="fd-auth-dots"><i></i><i></i><i></i></div>
    </div>`;
  fx.querySelector('h2')!.textContent = title;
  fx.querySelector('p')!.textContent = subtitle;
  document.body.appendChild(fx);

  try {
    await settle(
      fx.animate(
        [
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
        ],
        { duration: 620, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' },
      ),
      620,
    );
  } catch {}
  fx.classList.add('is-covered');
  const started = Date.now();
  let failed = false;
  try {
    await apply();
  } catch (e) {
    failed = true;
    throw e;
  } finally {
    // Let the card be read, but never hold the screen too long.
    if (!failed) await wait(Math.max(0, 900 - (Date.now() - started)));
    fx.classList.add('is-leaving');
    try {
      await settle(
        fx.animate(
          mode === 'in'
            ? [
                { opacity: 1, transform: 'scale(1)' },
                { opacity: 0, transform: 'scale(1.08)' },
              ]
            : [
                { clipPath: `circle(${radius}px at 50% 50%)`, opacity: 1 },
                { clipPath: `circle(0px at 50% 50%)`, opacity: 1 },
              ],
          {
            duration: failed ? 200 : 520,
            easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
            fill: 'forwards',
          },
        ),
        520,
      );
    } catch {}
    fx.remove();
    running = false;
  }
}
