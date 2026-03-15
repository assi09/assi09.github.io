// Gradient intro
(function() {
  var intro = document.getElementById('gradientIntro');
  var canvas = document.getElementById('gradientCanvas');
  var spacer = document.getElementById('introSpacer');
  var progressFill = document.getElementById('introProgressFill');
  var introName = document.getElementById('introName');
  var introRole = document.getElementById('introRole');

  if (!intro || !canvas) {
    document.body.classList.remove('has-intro');
    return;
  }

  var gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true });
  if (!gl) {
    // WebGL2 not supported — skip intro
    document.body.classList.remove('has-intro');
    intro.remove();
    if (spacer) spacer.remove();
    return;
  }

  var introComplete = false;
  var animId;

  // ── Skip button ──
  var skipBtn = document.getElementById('introSkip');
  if (skipBtn) {
    skipBtn.addEventListener('click', function() {
      if (!introComplete) completeIntro();
    });
  }

  // ── Preset: Prism ──
  var preset = {
    color1: [5/255, 5/255, 5/255, 1],
    color2: [102/255, 179/255, 255/255, 1],
    color3: [255/255, 255/255, 255/255, 1],
    rotation: -50,
    proportion: 1,
    scale: 0.01,
    speed: 30,
    distortion: 0,
    swirl: 50,
    swirlIterations: 16,
    softness: 47,
    offset: -299,
    shape: 0,
    shapeSize: 45
  };

  // ── Shaders ──
  var vertSrc = '#version 300 es\nin vec4 a_position;\nvoid main(){gl_Position=a_position;}';

  var fragSrc = [
    '#version 300 es',
    'precision highp float;',
    'uniform float u_time;',
    'uniform float u_pixelRatio;',
    'uniform vec2 u_resolution;',
    'uniform float u_scale;',
    'uniform float u_rotation;',
    'uniform vec4 u_color1;',
    'uniform vec4 u_color2;',
    'uniform vec4 u_color3;',
    'uniform float u_proportion;',
    'uniform float u_softness;',
    'uniform float u_shape;',
    'uniform float u_shapeScale;',
    'uniform float u_distortion;',
    'uniform float u_swirl;',
    'uniform float u_swirlIterations;',
    'out vec4 fragColor;',
    '#define TWO_PI 6.28318530718',
    '#define PI 3.14159265358979323846',
    'vec2 rotate(vec2 uv,float th){return mat2(cos(th),sin(th),-sin(th),cos(th))*uv;}',
    'float random(vec2 st){return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123);}',
    'float noise(vec2 st){',
    '  vec2 i=floor(st);vec2 f=fract(st);',
    '  float a=random(i);float b=random(i+vec2(1.0,0.0));',
    '  float c=random(i+vec2(0.0,1.0));float d=random(i+vec2(1.0,1.0));',
    '  vec2 u=f*f*(3.0-2.0*f);',
    '  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);',
    '}',
    'vec4 blend_colors(vec4 c1,vec4 c2,vec4 c3,float mixer,float edgesWidth,float edge_blur){',
    '  vec3 color1=c1.rgb*c1.a;vec3 color2=c2.rgb*c2.a;vec3 color3=c3.rgb*c3.a;',
    '  float r1=smoothstep(.0+.35*edgesWidth,.7-.35*edgesWidth+.5*edge_blur,mixer);',
    '  float r2=smoothstep(.3+.35*edgesWidth,1.-.35*edgesWidth+edge_blur,mixer);',
    '  vec3 bc2=mix(color1,color2,r1);float bo2=mix(c1.a,c2.a,r1);',
    '  vec3 c=mix(bc2,color3,r2);float o=mix(bo2,c3.a,r2);',
    '  return vec4(c,o);',
    '}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/u_resolution.xy;',
    '  float t=.5*u_time;',
    '  float noise_scale=.0005+.006*u_scale;',
    '  uv-=.5;',
    '  uv*=(noise_scale*u_resolution);',
    '  uv=rotate(uv,u_rotation*.5*PI);',
    '  uv/=u_pixelRatio;',
    '  uv+=.5;',
    '  float n1=noise(uv*1.+t);',
    '  float n2=noise(uv*2.-t);',
    '  float angle=n1*TWO_PI;',
    '  uv.x+=4.*u_distortion*n2*cos(angle);',
    '  uv.y+=4.*u_distortion*n2*sin(angle);',
    '  float iterations_number=ceil(clamp(u_swirlIterations,1.,30.));',
    '  for(float i=1.;i<=30.;i++){',
    '    if(i>iterations_number)break;',
    '    uv.x+=clamp(u_swirl,0.,2.)/i*cos(t+i*1.5*uv.y);',
    '    uv.y+=clamp(u_swirl,0.,2.)/i*cos(t+i*1.*uv.x);',
    '  }',
    '  float proportion=clamp(u_proportion,0.,1.);',
    '  float shape=0.;float mixer=0.;',
    '  if(u_shape<.5){',
    '    vec2 cs=uv*(.5+3.5*u_shapeScale);',
    '    shape=.5+.5*sin(cs.x)*cos(cs.y);',
    '    mixer=shape+.48*sign(proportion-.5)*pow(abs(proportion-.5),.5);',
    '  }else if(u_shape<1.5){',
    '    vec2 ss=uv*(.25+3.*u_shapeScale);',
    '    float f=fract(ss.y);',
    '    shape=smoothstep(.0,.55,f)*smoothstep(1.,.45,f);',
    '    mixer=shape+.48*sign(proportion-.5)*pow(abs(proportion-.5),.5);',
    '  }else{',
    '    float sh=1.-uv.y;sh-=.5;sh/=(noise_scale*u_resolution.y);sh+=.5;',
    '    float ss2=.2*(1.-u_shapeScale);',
    '    shape=smoothstep(.45-ss2,.55+ss2,sh+.3*(proportion-.5));',
    '    mixer=shape;',
    '  }',
    '  vec4 cm=blend_colors(u_color1,u_color2,u_color3,mixer,1.-clamp(u_softness,0.,1.),.01+.01*u_scale);',
    '  fragColor=vec4(cm.rgb,cm.a);',
    '}'
  ].join('\n');

  // Compile shaders
  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  var vs = compileShader(gl.VERTEX_SHADER, vertSrc);
  var fs = compileShader(gl.FRAGMENT_SHADER, fragSrc);

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  // Full-screen quad
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  var posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Uniforms
  var u = {};
  ['u_time','u_resolution','u_pixelRatio','u_scale','u_rotation',
   'u_color1','u_color2','u_color3','u_proportion','u_softness',
   'u_shape','u_shapeScale','u_distortion','u_swirl','u_swirlIterations'].forEach(function(name) {
    u[name] = gl.getUniformLocation(program, name);
  });

  // Resize
  function resize() {
    if (introComplete) return;
    var w = intro.clientWidth;
    var h = intro.clientHeight;
    var pr = window.devicePixelRatio || 1;
    canvas.width = w * pr;
    canvas.height = h * pr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();

  var startTime = performance.now();

  // ── Animation loop ──
  function render(now) {
    if (introComplete) return;
    animId = requestAnimationFrame(render);

    var elapsed = (now - startTime) / 1000;
    var speed = (preset.speed / 100) * 5;
    var t = elapsed * speed + preset.offset * 0.01;

    gl.uniform1f(u.u_time, t);
    gl.uniform2f(u.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(u.u_pixelRatio, window.devicePixelRatio || 1);
    gl.uniform1f(u.u_scale, preset.scale);
    gl.uniform1f(u.u_rotation, (preset.rotation * Math.PI) / 180);
    gl.uniform4f(u.u_color1, preset.color1[0], preset.color1[1], preset.color1[2], preset.color1[3]);
    gl.uniform4f(u.u_color2, preset.color2[0], preset.color2[1], preset.color2[2], preset.color2[3]);
    gl.uniform4f(u.u_color3, preset.color3[0], preset.color3[1], preset.color3[2], preset.color3[3]);
    gl.uniform1f(u.u_proportion, preset.proportion / 100);
    gl.uniform1f(u.u_softness, preset.softness / 100);
    gl.uniform1f(u.u_shape, preset.shape);
    gl.uniform1f(u.u_shapeScale, preset.shapeSize / 100);
    gl.uniform1f(u.u_distortion, preset.distortion / 50);
    gl.uniform1f(u.u_swirl, preset.swirl / 100);
    gl.uniform1f(u.u_swirlIterations, preset.swirl === 0 ? 0 : preset.swirlIterations);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Time-based progress (5 seconds total)
    var introDuration = 5000;
    var progress = Math.min(elapsed * 1000 / introDuration, 1);

    if (progressFill) progressFill.style.transform = 'scaleX(' + progress + ')';

    // Fade out name + role in the last 1.5 seconds
    if (progress > 0.7) {
      var fadeOut = (progress - 0.7) / 0.3;
      if (introName) {
        introName.style.opacity = 1 - fadeOut;
        introName.style.transform = 'translateY(' + (-fadeOut * 30) + 'px) scale(' + (1 + fadeOut * 0.1) + ')';
      }
      if (introRole) introRole.style.opacity = 1 - fadeOut;
    }

    // Auto-dismiss after 5 seconds
    if (progress >= 1 && !introComplete) completeIntro();
  }

  function completeIntro() {
    introComplete = true;
    cancelAnimationFrame(animId);
    intro.classList.add('fade-out');

    setTimeout(function() {
      // Dispose WebGL
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      try { gl.getExtension('WEBGL_lose_context').loseContext(); } catch(e) {}
      canvas.width = 1;
      canvas.height = 1;

      intro.remove();
      if (spacer) spacer.remove();
      window.scrollTo(0, 0);
      document.body.style.overflow = '';
      document.body.classList.remove('has-intro');

      window.removeEventListener('resize', resize);

      if (typeof ScrollTrigger !== 'undefined') {
        setTimeout(function() { ScrollTrigger.refresh(); }, 100);
      }
      if (typeof window.__startEntrance === 'function') {
        window.__startEntrance();
      }
    }, 1000);
  }

  // ── Start ──
  // Prevent scrolling during intro
  document.body.style.overflow = 'hidden';

  // Show name after brief delay
  setTimeout(function() {
    if (introName) introName.classList.add('visible');
    if (introRole) introRole.classList.add('visible');
  }, 300);

  animId = requestAnimationFrame(render);
  window.addEventListener('resize', resize);

})();

(function() {

  // ─── FOOTER YEAR ───
  var footerYear = document.getElementById('footerYear');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  // ─── CUSTOM CURSOR PREFERENCE (user can disable) ───
  var cursorDisabled = localStorage.getItem('cursorDisabled') === 'true';
  if (cursorDisabled) document.body.classList.add('cursor-disabled');

  // ─── PAGE LOADER / INTRO HANDOFF ───
  var loader = document.getElementById('pageLoader');
  var entranceFired = false;
  var hasIntro = document.body.classList.contains('has-intro');

  function dismissLoader() {
    if (entranceFired) return;
    entranceFired = true;
    loader.classList.add('done');
    if (!hasIntro) {
      // No intro — go straight to entrance animations
      setTimeout(function() { startEntranceAnimations(); }, 300);
    }
    // If intro is active, entrance will be called from completeIntro()
  }

  // Expose entrance trigger for the intro script
  window.__startEntrance = function() {
    startEntranceAnimations();
  };

  if (hasIntro) {
    // Hide loader immediately — intro takes over
    loader.classList.add('done');
  } else {
    window.addEventListener('load', function() { setTimeout(dismissLoader, 1200); });
    setTimeout(dismissLoader, 2500);
  }

  // ─── CUSTOM CURSOR (only when not disabled by user) ───
  var cursor = document.getElementById('cursor');
  var cursorDot = document.getElementById('cursorDot');
  var cx = 0, cy = 0, dx = 0, dy = 0;

  var heroGrid = document.querySelector('.hero-grid');
  document.addEventListener('mousemove', function(e) {
    cx = e.clientX;
    cy = e.clientY;
    if (cursorDot && !document.body.classList.contains('cursor-disabled')) cursorDot.style.left = cx + 'px';
    if (cursorDot && !document.body.classList.contains('cursor-disabled')) cursorDot.style.top = cy + 'px';
  });

  // Throttled hero grid glow (only when hero visible)
  var gridRaf;
  document.addEventListener('mousemove', function(e) {
    if (gridRaf) return;
    gridRaf = requestAnimationFrame(function() {
      gridRaf = null;
      if (!heroGrid || window.scrollY > window.innerHeight) return;
      heroGrid.style.setProperty('--mx', e.clientX + 'px');
      heroGrid.style.setProperty('--my', e.clientY + 'px');
    });
  });

  if (!document.body.classList.contains('cursor-disabled')) {
  // Trail setup (merged into cursor loop)
  var _trails = [];
  if (window.matchMedia('(pointer: fine)').matches) {
    for (var _ti = 0; _ti < 6; _ti++) {
      var _te = document.getElementById('trail' + _ti);
      if (_te) {
        var _sz = Math.max(3, 7 - _ti);
        _te.style.width = _sz + 'px';
        _te.style.height = _sz + 'px';
        _te.style.opacity = String(Math.max(0.05, 0.2 - _ti * 0.03));
        _trails.push({ el: _te, x: 0, y: 0 });
      }
    }
  }

  function animateCursor() {
    if (document.body.classList.contains('cursor-disabled')) { requestAnimationFrame(animateCursor); return; }
    dx += (cx - dx) * 0.15;
    dy += (cy - dy) * 0.15;
    if (cursor) { cursor.style.left = dx + 'px'; cursor.style.top = dy + 'px'; }
    // Trail follows cursor
    var px = cx, py = cy;
    for (var i = 0; i < _trails.length; i++) {
      var t = _trails[i];
      var ease = 0.18 - i * 0.02;
      t.x += (px - t.x) * ease;
      t.y += (py - t.y) * ease;
      t.el.style.left = t.x + 'px';
      t.el.style.top = t.y + 'px';
      px = t.x;
      py = t.y;
    }
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Hover states for cursor
  var hoverEls = document.querySelectorAll('a, button, .btn-fill, .btn-ghost, .btn-cv, .btn-submit, .stag, .about-card, .about-portrait-frame, .proj-card, .contact-link-item, .exp-item, .orbit-pill');
  hoverEls.forEach(function(el) {
    el.addEventListener('mouseenter', function() { if (cursor) cursor.classList.add('hover'); });
    el.addEventListener('mouseleave', function() { if (cursor) cursor.classList.remove('hover'); });
  });

  document.addEventListener('mousedown', function() { if (cursor) cursor.classList.add('clicking'); });
  document.addEventListener('mouseup', function() { if (cursor) cursor.classList.remove('clicking'); });
  }

  // ─── CURSOR TOGGLE BUTTON ───
  var cursorToggleBtn = document.getElementById('cursorToggle');
  if (cursorToggleBtn) {
    cursorToggleBtn.setAttribute('aria-pressed', cursorDisabled ? 'true' : 'false');
    cursorToggleBtn.textContent = cursorDisabled ? 'Use custom cursor' : 'Use default cursor';
    cursorToggleBtn.addEventListener('click', function() {
      var disabled = document.body.classList.toggle('cursor-disabled');
      localStorage.setItem('cursorDisabled', disabled ? 'true' : 'false');
      cursorToggleBtn.setAttribute('aria-pressed', disabled ? 'true' : 'false');
      cursorToggleBtn.textContent = disabled ? 'Use custom cursor' : 'Use default cursor';
      cursorToggleBtn.setAttribute('aria-label', disabled ? 'Use custom cursor' : 'Use default cursor');
    });
  }

  // ─── SECTION ORDER ───
  var mainEl = document.querySelector('main');
  if (mainEl) {
    ['home', 'about', 'experience', 'projects', 'skills', 'education', 'contact'].forEach(function(id) {
      var sec = document.getElementById(id);
      if (sec) mainEl.appendChild(sec);
    });
  }

  // ─── SCROLL PROGRESS BAR ───
  function updateScrollProgress() {
    var inner = document.getElementById('scrollProgressInner');
    var wrap = document.getElementById('scrollProgress');
    if (!inner || !wrap) return;
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var scrollHeight = (document.documentElement.scrollHeight - window.innerHeight) || 1;
    var p = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;
    inner.style.transform = 'scaleX(' + p + ')';
    wrap.style.scale = scrollHeight > 0 ? '1 1' : '0 1';
  }
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress);
  updateScrollProgress();

  // ─── NAV TUBELIGHT ───
  function updateNavTubelight() {
    var wrap = document.getElementById('navLinksWrap');
    var indicator = document.getElementById('navTubelight');
    var active = wrap && wrap.querySelector('a.active');
    if (!wrap || !indicator || !active) return;
    var row = active.closest('li');
    var el = row || active;
    var wrapRect = wrap.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    indicator.style.top = (elRect.top - wrapRect.top) + 'px';
    indicator.style.height = elRect.height + 'px';
  }

  // ─── ACTIVE NAV ON SCROLL (with color-shifting tubelight) ───
  var sectionColors = {
    home: { bg: 'rgba(0,87,255,0.08)', glow: 'rgba(0,87,255,0.5)', accent: 'var(--accent2)' },
    about: { bg: 'rgba(255,77,0,0.08)', glow: 'rgba(255,77,0,0.5)', accent: 'var(--accent)' },
    experience: { bg: 'rgba(0,200,150,0.08)', glow: 'rgba(0,200,150,0.5)', accent: 'var(--accent3)' },
    projects: { bg: 'rgba(0,87,255,0.08)', glow: 'rgba(0,87,255,0.5)', accent: 'var(--accent2)' },
    skills: { bg: 'rgba(147,51,234,0.08)', glow: 'rgba(147,51,234,0.5)', accent: '#9333ea' },
    education: { bg: 'rgba(255,204,0,0.08)', glow: 'rgba(255,204,0,0.5)', accent: 'var(--accent4)' },
    contact: { bg: 'rgba(255,77,0,0.08)', glow: 'rgba(255,77,0,0.5)', accent: 'var(--accent)' }
  };
  var tubelight = document.getElementById('navTubelight');
  var sections = document.querySelectorAll('section[id]');
  var links = document.querySelectorAll('.sidenav .nav-links a');
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        links.forEach(function(l) { l.classList.remove('active'); });
        var a = document.querySelector('.sidenav .nav-links a[href="#' + e.target.id + '"]');
        if (a) a.classList.add('active');
        updateNavTubelight();

        /* Color shift tubelight based on section */
        var col = sectionColors[e.target.id];
        if (col && tubelight) {
          tubelight.style.background = col.bg;
          tubelight.style.boxShadow = '0 0 24px ' + col.bg;
        }
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(function(s) { obs.observe(s); });

  updateNavTubelight();
  window.addEventListener('resize', updateNavTubelight);

  // ─── TEXT SPLIT ANIMATION ───
  function splitTextIntoChars(el) {
    // Don't re-split
    if (el.querySelector('.char')) return;
    var html = el.innerHTML;
    var result = '';
    var inTag = false;
    var inEntity = false;
    var entity = '';
    var charIndex = 0;
    for (var i = 0; i < html.length; i++) {
      var ch = html[i];
      if (ch === '<') { inTag = true; result += ch; continue; }
      if (ch === '>') { inTag = false; result += ch; continue; }
      if (inTag) { result += ch; continue; }
      // Handle HTML entities like &amp; &lt; etc.
      if (ch === '&') { inEntity = true; entity = '&'; continue; }
      if (inEntity) {
        entity += ch;
        if (ch === ';') {
          inEntity = false;
          result += '<span class="char" style="transition-delay:' + (charIndex * 25) + 'ms">' + entity + '</span>';
          charIndex++;
          entity = '';
        }
        continue;
      }
      if (ch === ' ' || ch === '\n') { result += ch; continue; }
      result += '<span class="char" style="transition-delay:' + (charIndex * 25) + 'ms">' + ch + '</span>';
      charIndex++;
    }
    el.innerHTML = result;
  }

  // Split hero title and section titles
  var heroTitle = document.querySelector('h1.hero-title');
  if (heroTitle) splitTextIntoChars(heroTitle);

  document.querySelectorAll('h2.section-title').forEach(function(title) {
    splitTextIntoChars(title);
  });

  // ─── COUNTER ANIMATION ───
  function animateCounter(el) {
    var target = parseFloat(el.dataset.counter);
    var decimals = parseInt(el.dataset.decimals) || 0;
    var suffix = el.dataset.suffix || '';
    var duration = 1500;
    var start = performance.now();

    function update(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      // Ease out expo
      var eased = 1 - Math.pow(2, -10 * progress);
      var current = eased * target;
      el.textContent = current.toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  // ─── SECTION IN-VIEW DETECTION ───
  var sectionObs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) e.target.classList.add('in-view');
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.white-section').forEach(function(s) { sectionObs.observe(s); });

  // Big quote reveal
  var quoteObs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) { e.target.classList.add('in-view'); quoteObs.unobserve(e.target); }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.big-quote').forEach(function(q) { quoteObs.observe(q); });

  // ─── ENTRANCE ANIMATIONS ───
  function startEntranceAnimations() {
    // Show sidenav (with slight delay for smoothness)
    var sidenav = document.getElementById('sidenav');
    setTimeout(function() {
      if (sidenav) sidenav.classList.add('loaded');
    }, 200);

    // Show cursor (only if user has not disabled it)
    if (!document.body.classList.contains('cursor-disabled')) {
      var cursorEl = document.getElementById('cursor');
      var cursorDotEl = document.getElementById('cursorDot');
      if (cursorEl) cursorEl.style.opacity = '1';
      if (cursorDotEl) cursorDotEl.style.opacity = '1';
    }

    // Always add animated to hero title
    if (heroTitle) heroTitle.classList.add('animated');

    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      // Fallback — show everything
      runRevealFallback();
      document.querySelectorAll('.hero-tag, .hero-subtitle, .hero-actions, .hero-stats-bar, .hero-scroll-hint').forEach(function(el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      document.querySelectorAll('h2.section-title').forEach(function(t) { t.classList.add('animated'); });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Hero entrance sequence
    var heroTl = gsap.timeline({ delay: 0.1 });

    heroTl.to('.hero-tag', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' })
      .call(function() { if (heroTitle) heroTitle.classList.add('animated'); }, null, '-=0.3')
      .to('.hero-subtitle', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '-=0.3')
      .to('.hero-actions', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '-=0.4')
      .to('.hero-stats-bar', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3')
      .to('.hero-scroll-hint', { opacity: 1, duration: 0.8, ease: 'power2.out' }, '-=0.2');

    // Counter animation on hero stats
    heroTl.call(function() {
      document.querySelectorAll('.hstat-val[data-counter]').forEach(function(el) {
        animateCounter(el);
      });
    }, null, '-=0.5');

    // Scroll-triggered reveals for all sections
    document.querySelectorAll('.reveal').forEach(function(el) {
      if (el.matches('h2.section-title')) return; // handled separately
      var isStagger = el.classList.contains('reveal-stagger');
      var children = isStagger ? el.children : null;

      if (isStagger && children && children.length) {
        gsap.set(el, { opacity: 1, clearProps: 'transform' });
        gsap.fromTo(children, { opacity: 0, y: 28 }, {
          opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', end: 'top 60%', toggleActions: 'play none none none' }
        });
      } else {
        gsap.fromTo(el, { opacity: 0, y: 32 }, {
          opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', end: 'top 55%', toggleActions: 'play none none none' }
        });
      }
    });

    // Section title character animations
    document.querySelectorAll('h2.section-title').forEach(function(title) {
      ScrollTrigger.create({
        trigger: title,
        start: 'top 85%',
        onEnter: function() { title.classList.add('animated'); },
        once: true
      });
      // Also scale
      gsap.fromTo(title, { scale: 0.94, opacity: 0.5 }, {
        scale: 1, opacity: 1, ease: 'power2.out',
        scrollTrigger: { trigger: title, start: 'top 88%', end: 'top 50%', scrub: 0.8 }
      });
    });

    // Hero parallax on scroll
    gsap.fromTo('.hero-content',
      { y: 0, opacity: 1 },
      { y: 120, opacity: 0.4, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: 1,
          onLeaveBack: function() {
            gsap.set('.hero-content', { y: 0, opacity: 1 });
          }
        }
    });
    gsap.fromTo('.hero-stats-bar',
      { y: 0, opacity: 1 },
      { y: 30, opacity: 0.8, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: '#home', start: '60% top', end: 'bottom top', scrub: 1,
          onLeaveBack: function() {
            gsap.set('.hero-stats-bar', { y: 0, opacity: 1 });
          }
        }
    });
    gsap.fromTo('.hero-bg',
      { scale: 1 },
      { scale: 1.2, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: 1.5 }
    });

    // Parallax on hero shapes
    document.querySelectorAll('.hero-shape').forEach(function(shape, i) {
      gsap.fromTo(shape,
        { y: 0 },
        { y: -80 * (i + 1), ease: 'none', immediateRender: false,
          scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: 1 }
      });
    });

    // Skill tags stagger with elastic feel
    document.querySelectorAll('.skill-tags').forEach(function(container) {
      gsap.fromTo(container.children, { opacity: 0, scale: 0.8, y: 12 }, {
        opacity: 1, scale: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'back.out(1.7)',
        scrollTrigger: { trigger: container, start: 'top 90%', toggleActions: 'play none none none' }
      });
    });

    // Project cards stagger in
    document.querySelectorAll('.proj-card').forEach(function(card, i) {
      gsap.fromTo(card, { opacity: 0, y: 40, scale: 0.96 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 92%', toggleActions: 'play none none none' },
        delay: i * 0.06
      });
    });

    // Experience cards pop in
    document.querySelectorAll('.exp-item').forEach(function(card, i) {
      gsap.fromTo(card, { opacity: 0, y: 40, rotateX: -8 }, {
        opacity: 1, y: 0, rotateX: 0, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 90%', toggleActions: 'play none none none' },
        delay: i * 0.12
      });
    });

    // Education rows
    document.querySelectorAll('.edu-row').forEach(function(row, i) {
      gsap.fromTo(row, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: row, start: 'top 90%', toggleActions: 'play none none none' },
        delay: i * 0.15
      });
    });

    // Contact link items slide in
    document.querySelectorAll('.contact-link-item').forEach(function(item, i) {
      gsap.fromTo(item, { opacity: 0, x: -30 }, {
        opacity: 1, x: 0, duration: 0.5, ease: 'power3.out',
        scrollTrigger: { trigger: item, start: 'top 95%', toggleActions: 'play none none none' },
        delay: i * 0.08
      });
    });

    // Form fields fade up
    document.querySelectorAll('.form-field').forEach(function(field, i) {
      gsap.fromTo(field, { opacity: 0, y: 20 }, {
        opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
        scrollTrigger: { trigger: field, start: 'top 95%', toggleActions: 'play none none none' },
        delay: i * 0.1
      });
    });

    // Reveal-text clip-path animations
    initRevealText();
  }

  // Fallback without GSAP
  function runRevealFallback() {
    var revs = document.querySelectorAll('.reveal');
    var rObs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          rObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.07 });
    revs.forEach(function(el) { rObs.observe(el); });
  }

  // ─── MOUSE PARALLAX ON HERO SHAPES (throttled) ───
  var shapeRaf;
  var heroShapes = document.querySelectorAll('.hero-shape');
  window.addEventListener('mousemove', function(e) {
    if (shapeRaf || window.scrollY > window.innerHeight) return;
    shapeRaf = requestAnimationFrame(function() {
      shapeRaf = null;
      var x = (e.clientX / window.innerWidth - 0.5) * 20;
      var y = (e.clientY / window.innerHeight - 0.5) * 20;
      heroShapes.forEach(function(el, i) {
        var f = (i + 1) * 0.4;
        if (typeof gsap !== 'undefined') gsap.to(el, { x: x * f, y: y * f, duration: 1, ease: 'power2.out' });
      });
    });
  });

  // ─── MOUSE-DEPENDENT EFFECTS (pointer devices only) ───
  var isPointerFine = window.matchMedia('(pointer: fine)').matches;
  if (isPointerFine) {

  // ─── MAGNETIC EFFECT ON BUTTONS ───
  document.querySelectorAll('.btn-fill, .btn-ghost, .btn-submit').forEach(function(btn) {
    btn.addEventListener('mousemove', function(e) {
      var rect = btn.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      if (typeof gsap !== 'undefined') {
        gsap.to(btn, { x: x * 0.2, y: y * 0.2, duration: 0.3, ease: 'power2.out' });
      }
    });
    btn.addEventListener('mouseleave', function() {
      if (typeof gsap !== 'undefined') {
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      }
    });
  });

  // ─── MAGNETIC 3D TILT ON ABOUT CARDS WITH LIGHT REFLECTION ───
  document.querySelectorAll('.about-card').forEach(function(card) {
    var glow = card.querySelector('.about-card-glow');
    card.addEventListener('mousemove', function(e) {
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width;
      var y = (e.clientY - rect.top) / rect.height;
      var mx = x - 0.5;
      var my = y - 0.5;
      if (typeof gsap !== 'undefined') {
        gsap.to(card, {
          rotateX: my * -15, rotateY: mx * 15,
          y: -8, scale: 1.04,
          transformPerspective: 600,
          boxShadow: '0 ' + (20 + my * 20) + 'px ' + (50 + Math.abs(mx) * 20) + 'px rgba(0,0,0,' + (0.12 + Math.abs(mx) * 0.08) + ')',
          duration: 0.3, ease: 'power2.out', overwrite: 'auto'
        });
      }
      if (glow) {
        glow.style.background = 'radial-gradient(circle at ' + (x * 100) + '% ' + (y * 100) + '%, rgba(255,255,255,0.25) 0%, transparent 60%)';
      }
    });
    card.addEventListener('mouseleave', function() {
      if (typeof gsap !== 'undefined') {
        gsap.to(card, { rotateX: 0, rotateY: 0, y: 0, scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)', duration: 0.6, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
      }
      if (glow) glow.style.background = '';
    });
  });

  // ─── 3D TILT + HOLOGRAPHIC SHEEN ON FEATURED PROJECTS (removed — unified cards) ───

  // ─── LENIS SMOOTH SCROLL (initialized after intro) ───
  // ─── MAGNETIC NAV LINKS (enhanced) ───
  document.querySelectorAll('.nav-links a').forEach(function(link) {
    link.addEventListener('mousemove', function(e) {
      var rect = link.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      if (typeof gsap !== 'undefined') {
        gsap.to(link, { x: x * 0.3, y: y * 0.3, duration: 0.25, ease: 'power2.out' });
        /* icon magnetic pull — stronger */
        var icon = link.querySelector('.icon');
        if (icon) {
          gsap.to(icon, { x: x * 0.15, y: y * 0.15, rotation: x * 0.3, duration: 0.25, ease: 'power2.out' });
        }
      }
    });
    link.addEventListener('mouseleave', function() {
      if (typeof gsap !== 'undefined') {
        gsap.to(link, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
        var icon = link.querySelector('.icon');
        if (icon) {
          gsap.to(icon, { x: 0, y: 0, rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
        }
      }
    });
  });

  // ─── NAV AMBIENT GLOW (follows mouse) ───
  var navGlow = document.getElementById('navAmbientGlow');
  var sidenav = document.getElementById('sidenav');
  if (navGlow && sidenav) {
    sidenav.addEventListener('mousemove', function(e) {
      var rect = sidenav.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      navGlow.style.background = 'radial-gradient(300px circle at ' + x + 'px ' + y + 'px, rgba(0,87,255,0.06), rgba(255,77,0,0.03), transparent 70%)';
    });
    sidenav.addEventListener('mouseleave', function() {
      navGlow.style.background = '';
    });
  }

  } // end isPointerFine

  // ─── PER-SECTION SCROLL PROGRESS IN NAV LINKS ───
  if (typeof ScrollTrigger !== 'undefined') {
    document.querySelectorAll('.nav-links a').forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      var section = document.querySelector(href);
      var progressBar = link.querySelector('.nav-link-progress');
      if (!section || !progressBar) return;

      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom top',
        onUpdate: function(self) {
          var pct = Math.max(0, Math.min(100, self.progress * 100));
          progressBar.style.width = pct + '%';
        },
        onLeave: function() { progressBar.style.width = '100%'; },
        onLeaveBack: function() { progressBar.style.width = '0%'; }
      });
    });
  }

  // ─── TEXT REVEAL ANIMATIONS ON SCROLL (clip-path mask) ───
  function initRevealText() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    document.querySelectorAll('.reveal-text').forEach(function(el) {
      gsap.fromTo(el,
        { clipPath: 'inset(100% 0 0 0)' },
        { clipPath: 'inset(0% 0 0 0)', duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
        }
      );
    });
  }


  // ─── ANIMATED FAVICON ───
  (function() {
    var faviconCanvas = document.createElement('canvas');
    faviconCanvas.width = 32;
    faviconCanvas.height = 32;
    var fctx = faviconCanvas.getContext('2d');
    var accentColors = ['#ff4d00', '#0057ff', '#00c896', '#ffcc00'];
    var colorIndex = 0;
    var faviconLink = document.querySelector('link[rel="icon"]');
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
    function drawFavicon() {
      var c1 = accentColors[colorIndex % accentColors.length];
      var c2 = accentColors[(colorIndex + 1) % accentColors.length];
      var grad = fctx.createLinearGradient(0, 0, 32, 32);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      fctx.clearRect(0, 0, 32, 32);
      // Rounded rect
      fctx.beginPath();
      fctx.roundRect(0, 0, 32, 32, 6);
      fctx.fillStyle = grad;
      fctx.fill();
      // Letter K
      fctx.font = 'bold 18px system-ui, sans-serif';
      fctx.fillStyle = '#ffffff';
      fctx.textAlign = 'center';
      fctx.textBaseline = 'middle';
      fctx.fillText('K', 16, 17);
      faviconLink.href = faviconCanvas.toDataURL('image/png');
      colorIndex++;
    }
    drawFavicon();
    setInterval(drawFavicon, 3000);
  })();

})();

/* ─── CONTACT FORM (FormSubmit.co) ─── */
(function() {
  var form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = form.querySelector('button');
    var orig = btn.innerHTML;
    btn.innerHTML = 'Sending...';
    btn.disabled = true;

    var data = new FormData(form);

    fetch('https://formsubmit.co/ajax/assikarim10@gmail.com', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: data
    })
    .then(function(res) {
      if (res.ok) {
        btn.innerHTML = 'Message Sent ✓';
        btn.style.background = 'var(--accent3)';
        btn.style.color = '#fff';
        if (typeof gsap !== 'undefined') {
          gsap.fromTo(btn, { scale: 0.95 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
        }
        form.reset();
        setTimeout(function() {
          btn.innerHTML = orig;
          btn.style.background = '';
          btn.style.color = '';
          btn.disabled = false;
        }, 4000);
      } else {
        throw new Error('Server error');
      }
    })
    .catch(function() {
      btn.innerHTML = 'Error — Try Again';
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
      setTimeout(function() {
        btn.innerHTML = orig;
        btn.style.background = '';
        btn.style.color = '';
        btn.disabled = false;
      }, 3000);
    });
  });
})();

/* ─── DARK MODE TOGGLE ─── */
(function() {
  var toggle = document.getElementById('themeToggle');
  var html = document.documentElement;
  var celestial = toggle ? toggle.querySelector('.theme-toggle-celestial') : null;

  /* Check saved preference or system preference */
  var saved = localStorage.getItem('theme');
  if (saved) {
    html.setAttribute('data-theme', saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    html.setAttribute('data-theme', 'dark');
  }

  /* Listen for system preference changes */
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      if (!localStorage.getItem('theme')) {
        html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }

  if (toggle) {
    toggle.addEventListener('click', function() {
      var current = html.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);

      /* Animate the celestial body */
      if (typeof gsap !== 'undefined' && celestial) {
        gsap.fromTo(celestial,
          { scale: 0.3, rotation: next === 'dark' ? 180 : -180 },
          { scale: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' }
        );
      }
    });
  }
})();

/* ─── MOBILE NAV HAMBURGER ─── */
(function() {
  var hamburger = document.getElementById('mobileHamburger');
  var sidenav = document.getElementById('sidenav');
  var overlay = document.getElementById('mobileNavOverlay');
  if (!hamburger || !sidenav || !overlay) return;

  function toggle() {
    var open = sidenav.classList.toggle('mobile-open');
    hamburger.classList.toggle('active', open);
    overlay.classList.toggle('visible', open);
    hamburger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }

  hamburger.addEventListener('click', toggle);
  overlay.addEventListener('click', toggle);

  /* Close on nav link click */
  sidenav.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function() {
      if (sidenav.classList.contains('mobile-open')) toggle();
    });
  });
})();

/* ─── SKILLS ORBIT: 3D Tilt + Particle Trails ─── */
(function() {
  var orbit = document.getElementById('skillsOrbit');
  var scene = document.getElementById('orbitScene');
  var canvas = document.getElementById('orbitParticles');
  if (!orbit || !scene || !canvas) return;
  var ctx = canvas.getContext('2d');
  var particles = [];
  var dpr = window.devicePixelRatio || 1;
  var W, H, cx, cy;

  function resize() {
    var rect = orbit.getBoundingClientRect();
    W = rect.width; H = rect.height;
    cx = W / 2; cy = H / 2;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  /* 3D mouse tilt */
  orbit.addEventListener('mousemove', function(e) {
    var rect = orbit.getBoundingClientRect();
    var mx = (e.clientX - rect.left) / rect.width - 0.5;
    var my = (e.clientY - rect.top) / rect.height - 0.5;
    scene.style.transform = 'rotateY(' + (mx * 20) + 'deg) rotateX(' + (-my * 15) + 'deg)';
  });
  orbit.addEventListener('mouseleave', function() {
    scene.style.transform = 'rotateY(0deg) rotateX(0deg)';
  });

  /* Particle system */
  var colors = [
    'rgba(255,77,0,', 'rgba(0,87,255,',
    'rgba(0,200,150,', 'rgba(147,51,234,'
  ];
  var ringRadii = [80, 120, 160, 200];
  var ringSpeeds = [10, -16, 22, -28];

  function spawnParticle() {
    var ri = Math.floor(Math.random() * 4);
    var angle = Math.random() * Math.PI * 2;
    var r = ringRadii[ri] + (Math.random() - 0.5) * 6;
    particles.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      life: 1,
      decay: 0.008 + Math.random() * 0.012,
      size: 1 + Math.random() * 2,
      color: colors[ri]
    });
  }

  var orbitRunning = false;
  var isMobile = !window.matchMedia('(pointer: fine)').matches;
  var maxParticles = isMobile ? 30 : 80;

  function animate() {
    if (!orbitRunning) return;
    ctx.clearRect(0, 0, W, H);

    /* Spawn new particles */
    if (particles.length < maxParticles) {
      spawnParticle();
      if (!isMobile) spawnParticle();
    }

    /* Update & draw */
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color + (p.life * 0.5) + ')';
      ctx.fill();

      /* Glow */
      if (!isMobile) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life * 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color + (p.life * 0.1) + ')';
        ctx.fill();
      }
    }

    requestAnimationFrame(animate);
  }

  /* Only run when visible */
  var orbitObs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        if (!orbitRunning) { orbitRunning = true; animate(); }
      } else {
        orbitRunning = false;
      }
    });
  }, { threshold: 0.1 });
  orbitObs.observe(orbit);
})();
</script>

<script>
/* ─── ABOUT CARDS: ANIMATED COUNTERS ─── */
(function() {
  var counted = false;
  var counters = document.querySelectorAll('.card-num[data-count-to]');
  var special = document.querySelectorAll('.card-num[data-count-special]');

  function animateCounters() {
    if (counted) return;
    counted = true;

    counters.forEach(function(el) {
      var target = parseFloat(el.getAttribute('data-count-to'));
      var decimals = parseInt(el.getAttribute('data-decimals') || '0');
      var suffix = el.getAttribute('data-suffix') || '';
      var duration = 2000;
      var start = performance.now();

      function tick(now) {
        var elapsed = now - start;
        var progress = Math.min(elapsed / duration, 1);
        /* Ease out cubic */
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = eased * target;
        el.textContent = current.toFixed(decimals) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });

    /* Special infinity card — scale pulse */
    special.forEach(function(el) {
      if (typeof gsap !== 'undefined') {
        gsap.fromTo(el, { scale: 0, rotation: -180, opacity: 0 }, {
          scale: 1, rotation: 0, opacity: 1, duration: 1.2,
          ease: 'elastic.out(1, 0.4)'
        });
      }
    });
  }

  /* Trigger when about cards scroll into view */
  var aboutCards = document.querySelector('.about-cards');
  if (aboutCards) {
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          animateCounters();
          obs.disconnect();
        }
      });
    }, { threshold: 0.3 });
    obs.observe(aboutCards);
  }
})();

/* ─── EXPERIENCE: ENERGY BEAM ON SCROLL ─── */
(function() {
  var timeline = document.getElementById('expTimeline');
  var beamFill = document.getElementById('expBeamFill');
  var beamHead = document.getElementById('expBeamHead');
  if (!timeline || !beamFill || !beamHead) return;

  var items = timeline.querySelectorAll('.exp-item');
  var activated = [];
  items.forEach(function() { activated.push(false); });

  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({
      trigger: timeline,
      start: 'top 80%',
      end: 'bottom 40%',
      scrub: 0.5,
      onUpdate: function(self) {
        var pct = self.progress * 100;
        beamFill.style.height = pct + '%';

        /* Check each item node */
        items.forEach(function(item, i) {
          var itemRect = item.getBoundingClientRect();
          var tlRect = timeline.getBoundingClientRect();
          var nodeY = (itemRect.top - tlRect.top + 32) / tlRect.height * 100;

          if (pct >= nodeY && !activated[i]) {
            activated[i] = true;
            /* Pulse the timeline dot */
            var dot = item.querySelector('.exp-content');
            if (dot && typeof gsap !== 'undefined') {
              gsap.fromTo(item, { '--dot-scale': 1 }, {
                '--dot-scale': 2, duration: 0.3, yoyo: true, repeat: 1,
                onUpdate: function() {
                  var s = gsap.getProperty(item, '--dot-scale') || 1;
                  item.style.setProperty('--dot-glow', s);
                }
              });
              /* Flash the content area */
              gsap.fromTo(dot, { boxShadow: '0 0 0 0 rgba(255,77,0,0)' }, {
                boxShadow: '0 0 30px 5px rgba(0,87,255,0.15)', duration: 0.4,
                yoyo: true, repeat: 1
              });
            }
          }
        });
      }
    });
  }
})();

/* ─── CONTACT: INTERACTIVE CONSTELLATION ─── */
(function() {
  var canvas = document.getElementById('contactConstellation');
  var section = document.getElementById('contact');
  if (!canvas || !section) return;
  var ctx = canvas.getContext('2d');
  var particles = [];
  var mouse = { x: -9999, y: -9999 };
  var dpr = window.devicePixelRatio || 1;
  var W, H;
  var running = false;
  var isMobileConstellation = !window.matchMedia('(pointer: fine)').matches;
  var PARTICLE_COUNT = isMobileConstellation ? 30 : 70;
  var MAX_DIST = 120;

  function resize() {
    var rect = section.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initParticles() {
    particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 1.2 + Math.random() * 1.5,
        color: i % 4 === 0 ? '255,77,0' : i % 4 === 1 ? '0,87,255' : i % 4 === 2 ? '0,200,150' : '255,204,0'
      });
    }
  }

  section.addEventListener('mousemove', function(e) {
    var rect = section.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  section.addEventListener('mouseleave', function() {
    mouse.x = -9999; mouse.y = -9999;
  });

  function animate() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    /* Update particles */
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      /* Mouse repulsion/attraction */
      var dx = p.x - mouse.x;
      var dy = p.y - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150 && dist > 0) {
        var force = (150 - dist) / 150 * 0.02;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }

      p.x += p.vx;
      p.y += p.vy;

      /* Damping */
      p.vx *= 0.99;
      p.vy *= 0.99;

      /* Wrap */
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      /* Draw particle */
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.color + ',0.5)';
      ctx.fill();

      /* Glow */
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.color + ',0.08)';
      ctx.fill();
    }

    /* Draw connections */
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          var alpha = (1 - dist / MAX_DIST) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    /* Mouse connections */
    if (mouse.x > 0 && mouse.y > 0) {
      for (var i = 0; i < particles.length; i++) {
        var dx = particles[i].x - mouse.x;
        var dy = particles[i].y - mouse.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          var alpha = (1 - dist / 180) * 0.3;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = 'rgba(255,204,0,' + alpha + ')';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  /* Only animate when in view */
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        if (!running) {
          running = true;
          resize();
          if (particles.length === 0) initParticles();
          animate();
        }
      } else {
        running = false;
      }
    });
  }, { threshold: 0.1 });
  obs.observe(section);

  window.addEventListener('resize', function() {
    resize();
    if (particles.length === 0) initParticles();
  });
})();
