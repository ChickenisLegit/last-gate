let transitioning = false;

/** A quiet covered cut. The next renderer reveals itself only after its shaders are ready. */
export function transitionChapter(go: () => void) {
  if (transitioning) return;
  transitioning = true;
  const cover = document.createElement('div');
  cover.className = 'chapter-cover'; cover.setAttribute('aria-hidden', 'true');
  document.body.append(cover);
  requestAnimationFrame(() => requestAnimationFrame(() => cover.classList.add('covered')));
  let released = false, fallback = 0;
  const release = () => {
    if (released) return;
    released = true; clearTimeout(fallback);
    window.removeEventListener('lastgate:scene-ready', release);
    window.setTimeout(() => {
      cover.classList.remove('covered');
      window.setTimeout(() => { cover.remove(); transitioning = false; }, 550);
    }, 80);
  };
  window.setTimeout(() => {
    window.addEventListener('lastgate:scene-ready', release, { once: true });
    fallback = window.setTimeout(release, 6500);
    go();
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 300);
}
