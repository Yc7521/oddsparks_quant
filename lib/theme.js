// Theme helper: initTheme() and setTheme(themeName)
// themeName is one of: 'theme-blue', 'theme-pink', 'theme-purple'
function initTheme() {
  const saved = localStorage.getItem('app-theme') || 'theme-blue';
  // If page has no body class set, set it; otherwise preserve other classes
  document.body.classList.remove('theme-blue','theme-pink','theme-purple');
  document.body.classList.add(saved);
}

function setTheme(name) {
  document.body.classList.remove('theme-blue','theme-pink','theme-purple');
  document.body.classList.add(name);
  localStorage.setItem('app-theme', name);
}

// Expose to window for inline onclick handlers in HTML
window.initTheme = initTheme;
window.setTheme = setTheme;

const allThemes = [
    ['theme-blue', '蓝色', "#66ccff"],
    ['theme-pink', '粉色', "#ff85a2"],
    ['theme-purple', '紫色', "#9999ff"]
];

// Enhance UI behavior: collapse theme dots after selection and keep aria attributes in sync
function attachThemeUI() {
  console.log('attachThemeUI');
  const switchers = document.querySelectorAll('.theme-switcher');
  switchers.forEach(sw => {
    const dots = sw.querySelector('.theme-dots');
    if (!dots) return;
    // keep aria-hidden in sync
    sw.addEventListener('mouseenter', () => dots.setAttribute('aria-hidden', 'false'));
    sw.addEventListener('mouseleave', () => dots.setAttribute('aria-hidden', 'true'));
    sw.addEventListener('focusin', () => dots.setAttribute('aria-hidden', 'false'));
    sw.addEventListener('focusout', (e) => {
      // if focus moved outside the switcher, hide
      if (!sw.contains(e.relatedTarget)) dots.setAttribute('aria-hidden', 'true');
    });
    
    for (const [theme, title, color] of allThemes) {
        const dot = document.createElement('div');
        dot.className = 'theme-dot';
        dot.style.background = color;
        dot.setAttribute('onclick', `setTheme('${theme}')`);
        dot.setAttribute('title', title);
        dot.setAttribute('role', 'menuitem');
        dot.addEventListener('click', () => {dots.setAttribute('aria-hidden', 'true');setTheme(theme);});
        dots.appendChild(dot);
    }
  });
}

// auto-run attachThemeUI after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { attachThemeUI(); });
} else {
  attachThemeUI();
}
