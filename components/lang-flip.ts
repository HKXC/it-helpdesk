// Language switch animation: a card under the button flips from the current
// language to the next with a greeting bubble, while page text blurs out and back
// in (View Transitions). Instant switch for reduced-motion users.

let running = false;

export function playLangSwitch(button: HTMLElement | null, toEnglish: boolean, apply: () => void) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || running || !button) {
    apply();
    return;
  }
  running = true;
  const r = button.getBoundingClientRect();
  const fx = document.createElement('div');
  fx.className = 'fd-lang-fx';
  fx.style.left = Math.round(r.left + r.width / 2) + 'px';
  fx.style.top = Math.round(r.bottom + 10) + 'px';
  fx.innerHTML = `
    <div class="fd-lang-card">
      <div class="fd-lang-face front"><b>${toEnglish ? 'ไทย' : 'EN'}</b><small>${toEnglish ? 'TH' : 'English'}</small></div>
      <div class="fd-lang-face back"><b>${toEnglish ? 'EN' : 'ไทย'}</b><small>${toEnglish ? 'English' : 'TH'}</small></div>
    </div>
    <div class="fd-lang-bubble">${toEnglish ? 'Hello! 👋' : 'สวัสดี! 🙏'}</div>`;
  document.body.appendChild(fx);

  let applied = false;
  const commit = () => {
    if (applied) return;
    applied = true;
    apply();
  };
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };

  window.setTimeout(() => fx.classList.add('is-flip'), 250);
  window.setTimeout(() => {
    if (doc.startViewTransition && document.visibilityState === 'visible') {
      document.documentElement.classList.add('fd-lang-swap');
      try {
        doc
          .startViewTransition(commit)
          .finished.catch(() => {})
          .finally(() => {
            commit();
            document.documentElement.classList.remove('fd-lang-swap');
          });
      } catch {
        commit();
      }
      window.setTimeout(commit, 400);
    } else commit();
  }, 520);
  window.setTimeout(() => fx.classList.add('is-leave'), 1500);
  window.setTimeout(() => {
    fx.remove();
    running = false;
  }, 1900);
}
