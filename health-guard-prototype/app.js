(() => {
  const SLIDE_W = 1280;
  const SLIDE_H = 720;

  const slide = document.getElementById('slide');
  const viewport = document.getElementById('viewport');
  const article = document.getElementById('article');

  const btn = document.getElementById('hg-btn');
  const panel = document.getElementById('hg-panel');
  const closeBtn = document.getElementById('hg-close');
  const replayBtn = document.getElementById('hg-replay');
  const bubble = document.getElementById('hg-bubble');
  const cursor = document.getElementById('hg-cursor');

  const scanBlock = document.getElementById('hg-scan');
  const resultBlock = document.getElementById('hg-result');

  const claimTarget = document.getElementById('claimTarget');

  const claimText = document.getElementById('hg-claim-text');
  const bubbleSub = document.getElementById('hg-bubble-sub');
  const confEl = document.getElementById('hg-conf');
  const aiPillEl = document.getElementById('hg-ai-pill');
  const aiScoreEl = document.getElementById('hg-ai-score');
  const aiExplainerEl = document.getElementById('hg-ai-explainer');
  const explainerEl = document.getElementById('hg-explainer');
  const sourcesWrap = document.getElementById('hg-sources');

  const state = {
    open: false,
    timer: null,
    cursorTimer: null,
  };

  const sampleData = {
    claim: 'A sudden “sense of doom” can be a warning sign of a heart attack.',
    status: { label: 'Likely supported', className: 'good' },
    confidence: 0.92,
    ai: {
      status: { label: 'AI-generated: Possible', className: 'warn' },
      score: 0.63,
      explainer:
        'This detector looks for patterns common in AI-generated or heavily templated writing. A higher score suggests possible AI assistance, but results are probabilistic and not definitive — formatting, quotes, and editing can affect the score.',
    },
    sources: [
      { name: 'American Heart Association', tag: 'Supported', tone: 'good' },
      { name: 'NHLBI (NIH)', tag: 'Consistent', tone: 'good' },
      { name: 'Mayo Clinic', tag: 'Consistent', tone: 'good' },
      { name: 'Research summaries', tag: 'Mixed', tone: 'warn' },
    ],
    explainer:
      'Multiple reputable medical sources describe anxiety, nausea, sweating, or a feeling that something is “very wrong” as possible heart‑attack symptoms. This checker flags the claim as plausible — but symptoms vary by person, so always rely on professional guidance.',
    bubble:
      'Matched to multiple reputable sources (AHA / NIH / Mayo Clinic).',
  };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function setScale() {
    const pad = 20; // breathing room
    const s = Math.min(
      (window.innerWidth - pad) / SLIDE_W,
      (window.innerHeight - pad) / SLIDE_H,
      1
    );
    slide.style.setProperty('--scale', String(s));
  }

  // Make the article feel like a normal webpage: if the user scrolls anywhere inside the
  // browser viewport (except inside the plugin panel), we forward the wheel to the article.
  function enableViewportScrollForwarding() {
    if (!viewport || !article) return;

    viewport.addEventListener(
      'wheel',
      (e) => {
        const inPanel = panel && panel.contains(e.target);
        const inArticle = article.contains(e.target);
        if (inPanel || inArticle) return;

        // Forward scroll to the article container.
        article.scrollBy({ top: e.deltaY, left: e.deltaX });
        e.preventDefault();
      },
      { passive: false }
    );
  }

  // Keep the callout bubble anchored if the user scrolls the article after the scan runs.
  function enableBubbleAutoPositioning() {
    if (!article) return;
    let raf = null;
    const schedule = () => {
      if (!bubble.classList.contains('is-open')) return;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        positionBubble();
      });
    };

    article.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
  }

  function clearTimers() {
    if (state.timer) window.clearTimeout(state.timer);
    if (state.cursorTimer) window.clearTimeout(state.cursorTimer);
    state.timer = null;
    state.cursorTimer = null;
  }

  function openPanel() {
    state.open = true;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    state.open = false;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');

    bubble.classList.remove('is-open');
    bubble.setAttribute('aria-hidden', 'true');

    claimTarget.classList.remove('is-active');
    cursor.classList.remove('is-visible');

    // Reset panel to scanning state for the next run.
    scanBlock.classList.remove('hidden');
    resultBlock.classList.add('hidden');

    clearTimers();
  }

  function setSources(sources) {
    sourcesWrap.innerHTML = '';
    for (const s of sources) {
      const row = document.createElement('div');
      row.className = 'source';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = s.name;

      const tag = document.createElement('div');
      tag.className = `tag ${s.tone || ''}`.trim();
      tag.textContent = s.tag;

      row.appendChild(name);
      row.appendChild(tag);
      sourcesWrap.appendChild(row);
    }
  }

  function positionBubble() {
    // Bubble is absolutely positioned relative to the viewport.
    const claimRect = claimTarget.getBoundingClientRect();
    const vpRect = viewport.getBoundingClientRect();

    // Temporarily show the bubble so we can measure it.
    bubble.classList.add('is-open');
    bubble.style.left = '0px';
    bubble.style.top = '0px';

    const bubbleRect = bubble.getBoundingClientRect();

    const rawLeft = claimRect.left - vpRect.left - 14;
    const rawTop = claimRect.top - vpRect.top - bubbleRect.height - 18;

    const maxLeft = vpRect.width - bubbleRect.width - 14;
    const left = clamp(rawLeft, 14, maxLeft);
    const top = clamp(rawTop, 10, vpRect.height - bubbleRect.height - 18);

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  function showCursorHint() {
    cursor.classList.add('is-visible');
    state.cursorTimer = window.setTimeout(() => {
      cursor.classList.remove('is-visible');
      state.cursorTimer = null;
    }, 1800);
  }

  function runScan() {
    clearTimers();
    openPanel();

    // Switch to scanning
    scanBlock.classList.remove('hidden');
    resultBlock.classList.add('hidden');

    bubble.classList.remove('is-open');
    bubble.setAttribute('aria-hidden', 'true');
    claimTarget.classList.remove('is-active');

    // Scroll a bit so the highlighted line is visible even if user scrolled.
    if (article) {
      article.scrollTo({ top: 180, behavior: 'smooth' });
    }

    // Simulate work
    state.timer = window.setTimeout(() => {
      // Fill result UI
      claimText.textContent = sampleData.claim;
      bubbleSub.textContent = sampleData.bubble;
      confEl.textContent = sampleData.confidence.toFixed(2);
      explainerEl.textContent = sampleData.explainer;
      setSources(sampleData.sources);

      // AI detection block
      if (aiScoreEl) aiScoreEl.textContent = sampleData.ai.score.toFixed(2);
      if (aiExplainerEl) aiExplainerEl.textContent = sampleData.ai.explainer;
      if (aiPillEl) {
        aiPillEl.textContent = sampleData.ai.status.label;
        aiPillEl.classList.remove('good', 'warn', 'bad');
        aiPillEl.classList.add(sampleData.ai.status.className);
      }

      // Apply status pill
      const pill = panel.querySelector('#hg-status-pill');
      if (pill) {
        pill.textContent = sampleData.status.label;
        pill.classList.remove('good', 'warn', 'bad');
        pill.classList.add(sampleData.status.className);
      }

      // Show result
      scanBlock.classList.add('hidden');
      resultBlock.classList.remove('hidden');

      // Highlight claim and place bubble
      claimTarget.classList.add('is-active');
      positionBubble();
      bubble.setAttribute('aria-hidden', 'false');

      showCursorHint();

      state.timer = null;
    }, 900);
  }

  function togglePanel() {
    if (!state.open) {
      runScan();
    } else {
      closePanel();
    }
  }

  // Events
  window.addEventListener('resize', setScale);

  btn?.addEventListener('click', togglePanel);
  btn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePanel();
    }
  });

  closeBtn?.addEventListener('click', closePanel);
  replayBtn?.addEventListener('click', runScan);

  // Convenience keys
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') runScan();
    if (e.key === 'Escape') closePanel();
  });

  // Start
  setScale();
  enableViewportScrollForwarding();
  enableBubbleAutoPositioning();

  // Auto-play once for a "slide" feel.
  window.setTimeout(() => {
    runScan();
  }, 650);
})();
