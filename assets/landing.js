(() => {
  const burger = document.getElementById('burgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileClose = document.getElementById('mobileClose');
  burger?.addEventListener('click', () => mobileMenu.classList.add('open'));
  mobileClose?.addEventListener('click', () => mobileMenu.classList.remove('open'));
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.remove('open')));

  // Reveal-on-scroll. Content starts at opacity:0 (see styles.css), so this
  // MUST eventually reveal everything even if IntersectionObserver never
  // fires for some reason — otherwise a visitor would see a blank page.
  const targets = document.querySelectorAll('[data-reveal]');
  if (targets.length) {
    const reveal = (el) => el.classList.add('in');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
      }, { threshold: 0.15 });
      targets.forEach(t => io.observe(t));
    }
    // Safety net: force-reveal anything still hidden after 1.2s regardless.
    setTimeout(() => targets.forEach(reveal), 1200);
  }

  // Scroll-spy: highlight the sidebar nav link for whichever section is in view.
  // Plain scroll-position math instead of IntersectionObserver — simpler and
  // just as reliable for this one job.
  const navLinks = document.querySelectorAll('.site-links a[data-sec]');
  const sections = [...document.querySelectorAll('header[data-sec], section[data-sec]')];
  if (navLinks.length && sections.length) {
    const updateActive = () => {
      const probe = window.scrollY + window.innerHeight * 0.35;
      let current = sections[0].dataset.sec;
      for (const s of sections) { if (s.offsetTop <= probe) current = s.dataset.sec; }
      navLinks.forEach(a => a.classList.toggle('on', a.dataset.sec === current));
    };
    updateActive();
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      setTimeout(() => { updateActive(); ticking = false; }, 80);
    }, { passive: true });
  }
})();
