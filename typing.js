/* Small, dependency-free BBS typing engine. Sound is opt-in. */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const splash = document.body.classList.contains('splash');
  let audio, sound = false, paused = false, sequence = 0;
  const versions = new WeakMap();
  const targets = new Map();
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const pause = document.querySelector(splash ? '#still' : '#object-still');
  pause?.addEventListener('change', () => { paused = pause.checked; });

  function clickSound() {
    if (!sound || !audio || audio.state !== 'running' || document.hidden) return;
    const t = audio.currentTime;
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * .023), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length / 5));
    const source = audio.createBufferSource(); source.buffer = buffer;
    const filter = audio.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1100 + Math.random() * 500; filter.Q.value = .7;
    const gain = audio.createGain(); gain.gain.setValueAtTime(.12, t); gain.gain.exponentialRampToValueAtTime(.001, t + .025);
    source.connect(filter); filter.connect(gain); gain.connect(audio.destination);
    source.start(t); source.stop(t + .03);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  function prepare(element, text) {
    if (!element) return null;
    text = (text ?? element.textContent).trim().replace(/\s+/g, ' ');
    const visual = document.createElement('span'); visual.className = 'typed-visual'; visual.setAttribute('aria-hidden', 'true');
    const accessible = document.createElement('span'); accessible.className = 'sr-only'; accessible.textContent = text;
    element.replaceChildren(accessible, visual); element.classList.add('live-type');
    targets.set(element, { text, visual });
    // Reserve the line's natural size without showing a second copy.
    const reserve = document.createElement('span'); reserve.className = 'type-reserve'; reserve.setAttribute('aria-hidden', 'true'); reserve.textContent = text;
    element.append(reserve);
    return element;
  }
  async function type(element, audible = false) {
    if (!element) return;
    const {text, visual} = targets.get(element);
    const version = (versions.get(element) || 0) + 1; versions.set(element, version);
    if (reduced.matches) { visual.textContent = text; element.classList.remove('is-typing'); return; }
    visual.textContent = ''; element.classList.add('is-typing');
    let output = '';
    for (const character of Array.from(text)) {
      while ((paused || document.hidden) && versions.get(element) === version && !reduced.matches) await delay(80);
      if (versions.get(element) !== version) return;
      if (reduced.matches) { visual.textContent = text; break; }
      output += character; visual.textContent = output;
      if (audible && character.trim()) clickSound();
      await delay(/[.,!?。]/.test(character) ? 230 : character === ' ' ? 45 : 48 + Math.random() * 32);
    }
    if (versions.get(element) === version) element.classList.remove('is-typing');
  }
  root.classList.add('typing-ready');
  if (splash) {
    const heading = prepare(document.querySelector('.heading-type'));
    const posts = [...document.querySelectorAll('.bbs-post')];
    const messages = posts.map(post => prepare(post.querySelector('.message'), post.querySelector('.post-text .sr-only').textContent));
    const enter = document.querySelector('.bbs-enter span'); enter.textContent = 'enter';
    const status = document.querySelector('.bbs-status span'); status.textContent = '3 notes';
    async function play(wait = 0) {
      const run = ++sequence;
      for (const [element, target] of targets) { versions.set(element, (versions.get(element) || 0) + 1); target.visual.textContent = ''; element.classList.remove('is-typing'); }
      posts.forEach(post => post.classList.add('waiting'));
      await delay(wait); if (run !== sequence) return;
      await type(heading, true);
      for (let i = 0; i < messages.length; i++) {
        if (run !== sequence) return;
        posts[i].classList.remove('waiting'); await type(messages[i], true); await delay(reduced.matches ? 0 : 260);
      }
    }
    const button = document.querySelector('#typing-sound');
    // Request audio automatically; browsers may keep it suspended until a gesture.
    sound = true;
    if (button) { button.textContent = 'sound off'; button.setAttribute('aria-pressed', 'true'); }
    function unlockAudio() {
      if (!sound) return;
      try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        audio.resume().catch(() => {});
      } catch { /* Keep the page usable when audio is unavailable. */ }
    }
    unlockAudio();
    document.addEventListener('pointerdown', unlockAudio, {capture: true});
    document.addEventListener('keydown', unlockAudio, {capture: true});
    button?.addEventListener('click', async () => {
      if (sound) { sound = false; button.textContent = 'sound on + replay'; button.setAttribute('aria-pressed', 'false'); return; }
      try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        await audio.resume(); sound = true; button.textContent = 'sound off'; button.setAttribute('aria-pressed', 'true');
        root.classList.add('intro-finished'); document.querySelector('video')?.pause();
        paused = false; if (pause) pause.checked = false;
        play();
      } catch { button.textContent = 'sound unavailable'; button.disabled = true; }
    });
    document.querySelector('.intro-skip')?.addEventListener('click', () => { root.classList.add('intro-finished'); document.querySelector('video')?.pause(); play(); });
    play(reduced.matches || location.hash === '#bbs' ? 0 : 3200);
  } else {
    const heading = prepare(document.querySelector('.object-typed-title'));
    type(heading);
    const elements = [...document.querySelectorAll('.chapter-counter, .photo figcaption, .footer-jp')].map(el => prepare(el));
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) { type(entry.target); observer.unobserve(entry.target); }
      }, {threshold: .45});
      elements.forEach(el => observer.observe(el));
    } else elements.forEach(el => type(el));
    document.querySelector('#retype-footer')?.addEventListener('change', () => type(document.querySelector('.footer-jp')));
  }
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    for (const [element, {text, visual}] of targets) { versions.set(element, (versions.get(element) || 0) + 1); visual.textContent = text; element.classList.remove('is-typing'); }
    document.querySelectorAll('.waiting').forEach(el => el.classList.remove('waiting'));
    root.classList.add('intro-finished'); document.querySelector('video')?.pause();
  });
})();
