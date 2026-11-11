'use strict';
/**
 * PDFme Cyber Mesh Background Animation Engine
 * Ultra-smooth, hardware-accelerated 60fps digital mesh / glowing nodes effect.
 * Non-intrusive, lightweight (<0.5% CPU), theme-adaptive, pause-on-hidden.
 */

(function initCyberBackground() {
  const canvas = document.getElementById('bg-cyber-mesh');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let animationFrameId = null;
  let particles = [];
  let isRunning = false;

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    initParticles();
    if (prefersReducedMotion) {
      renderSingleFrame();
    }
  }

  function initParticles() {
    // Fewer particles on mobile devices for peak performance
    const isMobile = width < 768;
    const count = isMobile ? 22 : 45;
    particles = [];

    for (let i = 0; i < count; i++) {
      const isGold = Math.random() > 0.65;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (isMobile ? 0.35 : 0.55),
        vy: (Math.random() - 0.5) * (isMobile ? 0.35 : 0.55),
        radius: isGold ? (Math.random() * 1.5 + 1.5) : (Math.random() * 1.8 + 1.2),
        isGold: isGold,
        pulseSpeed: 0.02 + Math.random() * 0.02,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }
  }

  function renderSingleFrame(now = 0) {
    ctx.clearRect(0, 0, width, height);

    const isLight = document.body.classList.contains('light-theme');
    const maxDist = width < 768 ? 95 : 130;

    // Node & line palettes
    const cyanRgb = isLight ? '8, 145, 178' : '34, 211, 238';
    const goldRgb = isLight ? '217, 119, 6' : '245, 158, 11';

    // 1. Draw connecting mesh lines
    const len = particles.length;
    for (let i = 0; i < len; i++) {
      const p1 = particles[i];
      for (let j = i + 1; j < len; j++) {
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.hypot(dx, dy);

        if (dist < maxDist) {
          const ratio = (1 - dist / maxDist);
          const alpha = ratio * (isLight ? 0.09 : 0.18);
          const strokeRgb = (p1.isGold || p2.isGold) ? goldRgb : cyanRgb;

          ctx.strokeStyle = `rgba(${strokeRgb}, ${alpha})`;
          ctx.lineWidth = ratio * 1.1;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // 2. Draw glowing particle nodes
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      const pulse = 0.8 + 0.3 * Math.sin(now * p.pulseSpeed + p.pulseOffset);
      const rad = p.radius * pulse;
      const rgb = p.isGold ? goldRgb : cyanRgb;
      const nodeAlpha = isLight ? (p.isGold ? 0.28 : 0.22) : (p.isGold ? 0.45 : 0.40);

      // Soft glow aura
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 3.5);
      grad.addColorStop(0, `rgba(${rgb}, ${nodeAlpha})`);
      grad.addColorStop(1, `rgba(${rgb}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Sharp particle center
      ctx.fillStyle = `rgba(${rgb}, ${nodeAlpha * 1.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(now) {
    if (!isRunning) return;

    // Update positions
    const len = particles.length;
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) { p.x = 0; p.vx *= -1; }
      else if (p.x > width) { p.x = width; p.vx *= -1; }

      if (p.y < 0) { p.y = 0; p.vy *= -1; }
      else if (p.y > height) { p.y = height; p.vy *= -1; }
    }

    renderSingleFrame(now * 0.001);
    animationFrameId = requestAnimationFrame(loop);
  }

  function start() {
    if (isRunning || prefersReducedMotion) return;
    isRunning = true;
    animationFrameId = requestAnimationFrame(loop);
  }

  function stop() {
    isRunning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // Lifecycle listeners
  window.addEventListener('resize', () => {
    resize();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      resize();
      start();
    });
  } else {
    resize();
    start();
  }
})();

