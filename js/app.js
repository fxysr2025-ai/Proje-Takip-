/* ==========================================================================
   EKRAN KORUYUCU — TAKIMYILDIZ AĞI MOTORU
   ========================================================================== */
const SCREENSAVER_KEY = 'yaser_v10_screensaver_ms';
const SAVER_CFG_KEY = 'yaser_v10_saver_cfg';
let screensaverTimeoutMs = Number(localStorage.getItem(SCREENSAVER_KEY));
if (!Number.isFinite(screensaverTimeoutMs)) screensaverTimeoutMs = 180000;
if (screensaverTimeoutMs < 0 || screensaverTimeoutMs > 3600000) screensaverTimeoutMs = 180000;

/* Kullanıcı ayarları: nokta sayısı, bağlantı mesafesi, hız */
let saverCfg = { nodes: 70, link: 120, speed: 1 };
try {
    const savedCfg = JSON.parse(localStorage.getItem(SAVER_CFG_KEY));
    if (savedCfg && typeof savedCfg === 'object') {
        if (Number.isFinite(savedCfg.nodes)) saverCfg.nodes = savedCfg.nodes;
        if (Number.isFinite(savedCfg.link)) saverCfg.link = savedCfg.link;
        if (Number.isFinite(savedCfg.speed)) saverCfg.speed = savedCfg.speed;
    }
} catch (e) { /* bozuk kayıt: varsayılan kalır */ }

let svCanvas = null;
let svCtx = null;
let svNodes = [];
let svRaf = null;
let svIdleTimer = null;
let svRunning = false;
let svLastT = 0;
let svClockTimer = null;

function svResize() {
    if (!svCanvas) return;
    svCanvas.width = window.innerWidth;
    svCanvas.height = window.innerHeight;
}

function svSpawnNodes() {
    svNodes = [];
    for (let i = 0; i < saverCfg.nodes; i++) {
        svNodes.push({
            x: Math.random() * svCanvas.width,
            y: Math.random() * svCanvas.height,
            vx: (Math.random() - 0.5) * 22,
            vy: (Math.random() - 0.5) * 22,
            r: 1.4 + Math.random() * 2.1
        });
    }
}

function svUpdateNodes(dt) {
    const w = svCanvas.width;
    const h = svCanvas.height;
    const sp = saverCfg.speed;
    for (const n of svNodes) {
        n.x += n.vx * dt * sp;
        n.y += n.vy * dt * sp;
        /* Kenarlardan yumuşak sekme */
        if (n.x < 0 || n.x > w) { n.vx = -n.vx; n.x = Math.max(0, Math.min(w, n.x)); }
        if (n.y < 0 || n.y > h) { n.vy = -n.vy; n.y = Math.max(0, Math.min(h, n.y)); }
    }
}

function svDrawNodes() {
    svCtx.clearRect(0, 0, svCanvas.width, svCanvas.height);
    const link = saverCfg.link;
    const linkSq = link * link;

    /* Bağlantı çizgileri: mesafeyle solan soluk mavi */
    for (let i = 0; i < svNodes.length; i++) {
        for (let j = i + 1; j < svNodes.length; j++) {
            const a = svNodes[i];
            const b = svNodes[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < linkSq) {
                const opacity = (1 - Math.sqrt(distSq) / link) * 0.5;
                svCtx.strokeStyle = 'rgba(74, 106, 138, ' + opacity.toFixed(3) + ')';
                svCtx.lineWidth = 1;
                svCtx.beginPath();
                svCtx.moveTo(a.x, a.y);
                svCtx.lineTo(b.x, b.y);
                svCtx.stroke();
            }
        }
    }

    /* Noktalar: soluk mavi-gri ışıma */
    for (const n of svNodes) {
        svCtx.fillStyle = 'rgba(125, 165, 205, 0.75)';
        svCtx.beginPath();
        svCtx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        svCtx.fill();
        /* Büyük noktalarda hafif halo */
        if (n.r > 2.6) {
            svCtx.fillStyle = 'rgba(125, 165, 205, 0.12)';
            svCtx.beginPath();
            svCtx.arc(n.x, n.y, n.r * 2.6, 0, Math.PI * 2);
            svCtx.fill();
        }
    }
}

function svAnimate(now) {
    if (!svRunning) return;
    if (!svLastT) svLastT = now;
    const dt = Math.min(0.05, (now - svLastT) / 1000);
    svLastT = now;
    svUpdateNodes(dt);
    svDrawNodes();
    svRaf = requestAnimationFrame(svAnimate);
}

function svUpdateClock() {
    const el = document.getElementById('screensaver-clock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function showScreensaver() {
    /* Zen modda arka plan dekorları kapalı; tam ekran takımyıldız ağı
       karanlık bir zeminde anlamsız biçimde belirip kullanıcıyı şaşırttı.
       Ekran koruyucu normal moda dönülünce kendiliğinden yeniden çalışır
       (idle timer her etkileşimde yeniden kurulur). */
    if (document.body.classList.contains('zen-mode')) return;
    const overlay = document.getElementById('screensaver-overlay');
    if (!overlay || svRunning) return;
    svCanvas = document.getElementById('screensaver-canvas');
    if (!svCanvas) return;
    svCtx = svCanvas.getContext('2d');
    svResize();
    svSpawnNodes();
    svRunning = true;
    svLastT = 0;
    overlay.classList.add('active');
    svUpdateClock();
    if (svClockTimer) clearInterval(svClockTimer);
    svClockTimer = setInterval(svUpdateClock, 1000);
    svRaf = requestAnimationFrame(svAnimate);
}

function hideScreensaver() {
    const overlay = document.getElementById('screensaver-overlay');
    if (overlay) overlay.classList.remove('active');
    svRunning = false;
    if (svRaf) { cancelAnimationFrame(svRaf); svRaf = null; }
    if (svClockTimer) { clearInterval(svClockTimer); svClockTimer = null; }
    svLastT = 0;
}

function resetScreensaverIdle() {
    if (svRunning) hideScreensaver();
    if (svIdleTimer) clearTimeout(svIdleTimer);
    if (screensaverTimeoutMs > 0) {
        svIdleTimer = setTimeout(showScreensaver, screensaverTimeoutMs);
    }
}

function setScreensaverTimeout(valMs) {
    const ms = Number(valMs);
    if (!Number.isFinite(ms) || ms < 0) return;
    screensaverTimeoutMs = ms;
    localStorage.setItem(SCREENSAVER_KEY, String(ms));
    resetScreensaverIdle();
}

/* Nokta sayısı / bağlantı mesafesi / hız ayarı — canlı uygulanır */
function setSaverConfig(key, val) {
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) return;
    if (key === 'nodes' || key === 'link' || key === 'speed') {
        saverCfg[key] = num;
        localStorage.setItem(SAVER_CFG_KEY, JSON.stringify(saverCfg));
        if (svRunning) {
            if (key === 'nodes') svSpawnNodes();
        }
    }
}

function previewScreensaver() {
    /* Zen modda ekran koruyucu bilinçli olarak engellenir; "Şimdi Test Et"
       boş bir tıklama gibi görünmesin diye sebebi bildirilir. */
    if (document.body.classList.contains('zen-mode')) {
        if (typeof showToast === 'function') showToast('Ekran koruyucu Odak Modu açıkken devre dışıdır.', 'info');
        return;
    }
    resetScreensaverIdle();
    showScreensaver();
}

function initScreensaver() {
    svCanvas = document.getElementById('screensaver-canvas');
    if (!svCanvas) return;
    const saverSelect = document.getElementById('screensaver-timeout-select');
    if (saverSelect) saverSelect.value = String(screensaverTimeoutMs);
    const nodesSelect = document.getElementById('saver-nodes-select');
    if (nodesSelect) nodesSelect.value = String(saverCfg.nodes);
    const linkSelect = document.getElementById('saver-link-select');
    if (linkSelect) linkSelect.value = String(saverCfg.link);
    const speedSelect = document.getElementById('saver-speed-select');
    if (speedSelect) speedSelect.value = String(saverCfg.speed);
    window.addEventListener('resize', () => { if (svRunning) svResize(); });
    ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(evt => {
        window.addEventListener(evt, resetScreensaverIdle, { passive: true });
    });
    resetScreensaverIdle();
}

/* ==========================================================================
   INTERACTIVE CONSTELLATION BACKGROUND ENGINE
   ========================================================================== */
const canvas = document.getElementById('constellation-canvas');
const ctx = canvas.getContext('2d');

let particlesArray = [];
let mouse = { x: null, y: null, radius: 130 };

/* PERF: Tema her karede DOM'dan (getAttribute) okunuyordu; bu, saniyede
   ~60 kez stil hesabı tetikleyip tüm ağacın stil yeniden hesaplanmasına
   yol açıyordu. Tema yalnızca değiştiğinde güncellenen tek bir bayrağa
   çevrildi — görsel sonuç birebir aynı, DOM okuması kare başına 0. */
let isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
const constellationThemeObserver = new MutationObserver(() => {
    isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
});
constellationThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* Fare ışıması gradyanı: her karede yeni RadialGradient üretiliyordu.
   Konum değişmedikçe nesne yeniden kullanılır; fare durduğunda kare başına
   gradyan ayırma maliyeti ortadan kalkar, görsel aynı kalır. */
let cachedGlow = null;
let cachedGlowX = NaN;
let cachedGlowY = NaN;
let cachedGlowDark = true;
const GLOW_OPACITY = 0.07;

/* PERF: Bağlantı çizgileri kare içinde yığılar, sonra opaklık seviyesine
   göre toplu çizilir. Opaklık 1/255 adımına yuvarlanır (8-bit renk basamağının
   altında kalan fark, ekranda zaten ayırt edilemez) — böylece tipik karede
   yüzlerce ayrı stroke() yerine onlarca toplu stroke() çalışır. */
const _linkBatches = new Map();

function _queueLink(x1, y1, x2, y2, opacity, isDark) {
    const key = (Math.round(opacity * 255) << 1) | (isDark ? 1 : 0);
    let batch = _linkBatches.get(key);
    if (!batch) { batch = []; _linkBatches.set(key, batch); }
    batch.push(x1, y1, x2, y2);
}

function _flushLinks() {
    if (_linkBatches.size === 0) return;
    ctx.lineWidth = 1;
    for (const [key, batch] of _linkBatches) {
        const isDark = (key & 1) === 1;
        const alpha = (key >> 1) / 255;
        ctx.strokeStyle = isDark ? `rgba(96, 165, 250, ${alpha})` : `rgba(59, 130, 246, ${alpha})`;
        ctx.beginPath();
        for (let i = 0; i < batch.length; i += 4) {
            ctx.moveTo(batch[i], batch[i + 1]);
            ctx.lineTo(batch[i + 2], batch[i + 3]);
        }
        ctx.stroke();
    }
    _linkBatches.clear();
}

/* PERF: { passive: true } ekleniyor. Bu dinleyici preventDefault çağırmıyor;
   yalnızca iki sayı okuyup saklıyor. Passive olmayan bir mousemove
   dinleyicisi, tarayıcıya kaydırma zincirinin bu olayı bekleyebileceğini
   söyler ve kaydırma sırasında kare düşürme (scroll jank) yaratır. */
window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
}, { passive: true });

window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
}, { passive: true });

/* PERF: Tuval, CSS boyutunun devicePixelRatio ile (en fazla 2×) çarpılmış
   yazma çözünürlüğünde çizilir. Çizim komutları CSS pikseliyle verilir;
   setTransform ölçeklemeyi üstlenir. Böylece 4K/retina ekranlarda her karede
   işlenen piksel sayısı 4-9 kat düşer, görüntü ise aynı kalır. */
let canvasCssWidth = window.innerWidth;
let canvasCssHeight = window.innerHeight;

function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasCssWidth = window.innerWidth;
    canvasCssHeight = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(canvasCssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvasCssHeight * dpr));
    /* Fare koordinatları CSS pikseliyle gelir; ctx ölçeğini eşitliyoruz. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* PERF: Boyut değişince birikmiş ışıma gradyanı geçersiz kalır. */
    cachedGlow = null;
    cachedGlowX = NaN;
    cachedGlowY = NaN;
}

/* PERF: 'resize' saniyede onlarca kez tetiklenebiliyor ve her tetiklemede
   tuval yeniden boyutlanıp tüm parçacıklar yeniden üretiliyordu.
   rAF ile tek kareye birleştirildi: aynı sonuç, tekrarlı iş yok. */
let canvasResizeRaf = 0;
window.addEventListener('resize', () => {
    if (canvasResizeRaf) return;
    canvasResizeRaf = requestAnimationFrame(() => {
        canvasResizeRaf = 0;
        resizeCanvas();
        initParticles();
    });
});
resizeCanvas();

class Particle {
    constructor() {
        /* PERF: Parçacıklar CSS pikseli koordinatında yaşar (ctx ölçeği
           dpr'ye eşitlendi), böylece hem parçacık sayısı hem de bağlantı
           mesafesi ekran çözünürlüğünden bağımsız olarak aynı kalır. */
        this.x = Math.random() * canvasCssWidth;
        this.y = Math.random() * canvasCssHeight;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
        this.radius = Math.random() * 2 + 1;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvasCssWidth) this.vx = -this.vx;
        if (this.y < 0 || this.y > canvasCssHeight) this.vy = -this.vy;

        if (mouse.x !== null && mouse.y !== null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < mouse.radius) {
                let forceDirectionX = dx / distance;
                let forceDirectionY = dy / distance;
                let force = (mouse.radius - distance) / mouse.radius;
                this.x -= forceDirectionX * force * 1.5;
                this.y -= forceDirectionY * force * 1.5;
            }
        }
    }
    draw() {
        ctx.fillStyle = isDarkTheme ? 'rgba(96, 165, 250, 0.6)' : 'rgba(59, 130, 246, 0.5)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();

        /* FX: fare yakınındaki parçacıklar cyan ışıma kazanır */
        if (mouse.x !== null && mouse.y !== null) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const mdist = Math.sqrt(dx * dx + dy * dy);
            if (mdist < mouse.radius) {
                const glowStrength = 1 - mdist / mouse.radius;
                ctx.fillStyle = isDarkTheme
                    ? `rgba(125, 211, 252, ${0.05 + glowStrength * 0.2})`
                    : `rgba(59, 130, 246, ${0.04 + glowStrength * 0.14})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * (2.4 + glowStrength * 1.6), 0, Math.PI * 2);
                ctx.closePath();
                ctx.fill();
            }
        }
    }
}

function initParticles() {
    particlesArray = [];
    /* PERF: Alan hesabı CSS ölçüsüyle yapılır; böylece yoğun ekranda
       dpr=2 yüzünden parçacık sayısı gereksiz 4 katına çıkmaz. */
    let numberOfParticles = Math.floor((canvasCssWidth * canvasCssHeight) / 16000);
    if (numberOfParticles < 30) numberOfParticles = 30;
    if (numberOfParticles > 90) numberOfParticles = 90;

    for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new Particle());
    }
}

function animateParticles() {
    /* PERF: setTransform uygulandığı için clearRect da CSS koordinatıyla
       verilmelidir (aksi halde yalnızca bir kısmı temizlenirdi). */
    ctx.clearRect(0, 0, canvasCssWidth, canvasCssHeight);
    const isDark = isDarkTheme;

    /* FX: fareyi takip eden yumuşak spot ışığı */
    if (mouse.x !== null && mouse.y !== null) {
        const glowRadius = mouse.radius * 1.6;
        /* PERF: Gradyan yalnızca fare konumu ya da tema değiştiğinde yeniden kurulur. */
        if (!cachedGlow || cachedGlowX !== mouse.x || cachedGlowY !== mouse.y || cachedGlowDark !== isDark) {
            cachedGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, glowRadius);
            cachedGlow.addColorStop(0, isDark ? `rgba(56, 189, 248, ${GLOW_OPACITY})` : 'rgba(59, 130, 246, 0.05)');
            cachedGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
            cachedGlowX = mouse.x;
            cachedGlowY = mouse.y;
            cachedGlowDark = isDark;
        }
        ctx.fillStyle = cachedGlow;
        ctx.fillRect(mouse.x - glowRadius, mouse.y - glowRadius, glowRadius * 2, glowRadius * 2);
    }

    const count = particlesArray.length;
    const LINK_DIST = 110;
    const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
    const baseAlpha = isDark ? 0.22 : 0.16;
    const mouseActive = (mouse.x !== null && mouse.y !== null);

    /* PERF: Bağlantı hesabı artık kare başına tek bir geçiş yapıyor.
       Tüm çiftler tek tek beginPath/stroke ile çizilmek yerine, eşik mesafesi
       (110) doğrudan karekök ALINMADAN karekök üzerinden karşılaştırılır.
       Kare içinde opaklık gruplandırılıp yol toplu (tek stroke) çizilir:
       aynı renk/alpha, aynı piksel çıktısı — ama yüzlerce stroke çağrısı
       yerine birkaç batch. */
    if (mouseActive) {
        for (let i = 0; i < count; i++) {
            const p = particlesArray[i];
            p.update();
            p.draw();

            for (let j = i + 1; j < count; j++) {
                const q = particlesArray[j];
                const dx = p.x - q.x;
                const dy = p.y - q.y;
                const distSq = dx * dx + dy * dy;
                if (distSq >= LINK_DIST_SQ) continue;

                const dist = Math.sqrt(distSq);
                let opacity = (1 - (dist / LINK_DIST)) * baseAlpha;
                const d1x = mouse.x - p.x, d1y = mouse.y - p.y;
                const d2x = mouse.x - q.x, d2y = mouse.y - q.y;
                const nearest = Math.min(Math.sqrt(d1x * d1x + d1y * d1y), Math.sqrt(d2x * d2x + d2y * d2y));
                if (nearest < mouse.radius) opacity += (1 - nearest / mouse.radius) * 0.3;
                _queueLink(p.x, p.y, q.x, q.y, opacity, isDark);
            }
        }
    } else {
        for (let i = 0; i < count; i++) {
            const p = particlesArray[i];
            p.update();
            p.draw();

            for (let j = i + 1; j < count; j++) {
                const q = particlesArray[j];
                const dx = p.x - q.x;
                const dy = p.y - q.y;
                const distSq = dx * dx + dy * dy;
                if (distSq >= LINK_DIST_SQ) continue;
                _queueLink(p.x, p.y, q.x, q.y, (1 - (Math.sqrt(distSq) / LINK_DIST)) * baseAlpha, isDark);
            }
        }
    }

    _flushLinks();
    requestAnimationFrame(animateParticles);
}

initParticles();
animateParticles();

/* ==========================================================================
   SPLASH SCREEN — BLUEPRINT LOADER
   ========================================================================== */
/* Yükleme çubuğu 0 → 100 ilerler; sayı ve çubuk birlikte güncellenir.
   İlerleme doğal bir bitiş için hafif ease-out eğrisi kullanır. */

function startSplashLoader() {
    const barEl = document.getElementById('splash-loader-bar');
    const statusEl = document.getElementById('splash-status');
    const pctEl = document.getElementById('splash-percent-value');
    const pctInlineEl = document.getElementById('splash-loader-pct-inline');
    const stageEl = document.getElementById('splash-loader-stage');
    if (!barEl || !statusEl || !pctEl) return;

    const steps = [
        { at: 8,  msg: 'Çekirdek modüller yükleniyor...' },
        { at: 22, msg: 'Veri tabanı bağlantısı kuruluyor...' },
        { at: 38, msg: 'Harita modülleri yükleniyor...' },
        { at: 54, msg: 'İl sınır verileri çözümleniyor...' },
        { at: 70, msg: 'TS 825 verileri doğrulanıyor...' },
        { at: 86, msg: 'Kullanıcı arayüzü hazırlanıyor...' },
        { at: 100, msg: 'Sistem hazır.' }
    ];

    const startedAt = performance.now();
    const total = 3400; // toplam yükleme süresi

    // 0 → 100 dolum: lineer değil, hafif yavaşlayan (ease-out) his.
    // Böylece sona doğru "kilitleyen" değil, doğal bitiş veriyor.
    const easeOut = t => 1 - Math.pow(1 - t, 2.2);

    let lastPct = -1;

    function tick() {
        const elapsed = performance.now() - startedAt;
        const ratio = Math.min(1, elapsed / total);
        const pct = Math.min(100, Math.round(easeOut(ratio) * 100));

        barEl.style.width = pct + '%';

        if (pct !== lastPct) {
            pctEl.textContent = String(pct).padStart(3, '0');
            if (pctInlineEl) pctInlineEl.textContent = pct + '%';
            if (stageEl) stageEl.textContent = pct + ' / 100';

            // Sayı değiştiğinde küçük bir zıplama — lazer yerine sade geri bildirim.
            pctEl.classList.remove('is-bump');
            // reflow tetikleyerek animasyonun yeniden başlamasını sağla
            void pctEl.offsetWidth;
            pctEl.classList.add('is-bump');

            lastPct = pct;
        }

        for (let i = steps.length - 1; i >= 0; i--) {
            if (pct >= steps[i].at) { statusEl.textContent = steps[i].msg; break; }
        }

        if (pct < 100) {
            requestAnimationFrame(tick);
        } else {
            // Son kare: 100'ü sabitle ve efekti temizle.
            pctEl.textContent = '100';
            if (pctInlineEl) pctInlineEl.textContent = '100%';
            if (stageEl) stageEl.textContent = '100 / 100';
            pctEl.classList.remove('is-bump');

            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                if (splash) {
                    splash.classList.add('hiding');
                    setTimeout(() => splash.classList.add('hidden'), 620);
                }
            }, 700);
        }
    }
    requestAnimationFrame(tick);
}

function generateSplashBeams() {
    // Eski beam üretimi artık kullanılmıyor (blueprint grid ile değiştirildi).
    // Fonksiyonu bilerek boş bırakıldı — geriye dönük çağrı hata vermesin.
}

/* ==========================================================================
   CANLI SAAT ENGINE
   PERF + LEAK DÜZELTMESİ: interval artık modül değişkeninde tutulur ve
   startLiveClock yeniden çağrılırsa eski saat silinir (çoğalmaz). Sekme arka
   plana geçince tik durur, dönerse visibilitychange ile anında senkronlanır;
   ayrıca second'lar tek yerde biçimlenip cache'lenir (her saniye locale
   çağrısı azalır; dakika/dilim cache'i yeniden kullanılır).
   ========================================================================== */
let _liveClockTimer = null;
let _liveClockVisBound = false;
let _liveClockDatePrefix = '';
let _liveClockDateKey = '';
const _liveClockTimeCache = {};
function startLiveClock() {
    const clockEl = document.getElementById('clock-text');
    if (!clockEl) return;

    const paint = () => {
        const now = new Date();
        const dayKey = now.getDate() + '.' + now.getMonth();
        if (dayKey !== _liveClockDateKey) {
            _liveClockDateKey = dayKey;
            _liveClockDatePrefix = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' • ';
        }
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        if (_liveClockTimeCache.h !== h) { _liveClockTimeCache.h = h; _liveClockTimeCache.hm = h + ':' + m; }
        if (_liveClockTimeCache.m !== m) { _liveClockTimeCache.hm = h + ':' + m; _liveClockTimeCache.m = m; }
        clockEl.innerText = _liveClockDatePrefix + _liveClockTimeCache.hm + ':' + s;
    };

    if (_liveClockTimer) clearInterval(_liveClockTimer);
    paint();
    _liveClockTimer = setInterval(() => { if (!document.hidden) paint(); }, 1000);
    if (!_liveClockVisBound) {
        _liveClockVisBound = true;
        document.addEventListener('visibilitychange', () => { if (!document.hidden && _liveClockTimer) paint(); });
    }
}

/* ==========================================================================
   APP SCRIPTS & DATA MANAGEMENT
   ========================================================================== */
const turkeyCities = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"
];

/* ==========================================================================
   DİNAMİK LİSTE AYARLARI — VARSAYILAN DEĞERLER
   --------------------------------------------------------------------------
   Bu liste, "Sistem ve Panel Ayarları > Dinamik Liste Ayarları" ekranındaki
   kategori kartlarının içeriğini besler. Kullanıcı bu ekrandan kartlara yeni
   eleman ekleyip çıkarabilir; değişiklikler tarayıcıda saklanır.

   Stok (örnek) içerik YALNIZCA dört temel sınıflandırmada tutulur, çünkü bu
   dört alan uygulamanın çekirdeğidir ve her iş kaydında bir değer bekler:

       projeTuru (KATEGORİ / PROTOKOL), tur (TÜR),
       avanUygulama (AVAN / UYGULAMA), asama (AŞAMA)

   Kalan alanlar (protokol, proje/alt/insaat müşavirleri, disiplin uzmanları)
   yalnızca "-" ile başlar. Bu, uygulamanın gerçek kullanımda bu listelerin
   KİŞİYE/FİRMA ADLARIYLA doldurulacağını gösterir: sabit birkaç isim
   yazılı bırakmak, o isimlerin gerçek olması ve kullanıcı tarafından
   genişletilmesi gerekmezken yanlış bir "hazır liste" izlenimi verirdi.

   Not: "-" değeri her alanda "belirtilmemiş" anlamına gelir ve uygulama
   tarafından özellikle kullanılır; boş bırakmakla aynı davranıştır ama
   açıkça görünür olmasını sağlar.
   ========================================================================== */
const defaultDropdownSettings = {
    /* --- Çekirdek sınıflandırmalar: stok içerik korunur --- */
    projeTuru: ["250Bin", "500Bin", "EGM", "JGK", "MSB", "Devam Eden İşler", "Biten İşler"],
    tur: ["MSB", "EGM", "JGK", "KENTSEL", "İDARE UYGULAMA", "TALEP", "-"],
    avanUygulama: ["Avan Proje", "Uygulama Projesi", "-"],
    asama: ["Proje", "İhale", "Yapım", "Beklemede", "İptal", "Bitti"],

    /* --- Kurum/personel listeleri: yalnızca "-" ile başlar --- */
    protokol: ["-"],
    projeMusaviri: ["-"],
    altYuklenici: ["-"],
    insaatMusaviri: ["-"],
    mimari: ["-"],
    statik: ["-"],
    mekanik: ["-"],
    elektrik: ["-"],
    altyapi: ["-"],
    peyzaj: ["-"],
    zemin: ["-"],
    plankote: ["-"]
};

const defaultHeaderTitles = {
    projeTuru: "KATEGORİ / PROTOKOL",
    tur: "TÜR",
    protokol: "PROTOKOL",
    asama: "AŞAMA",
    avanUygulama: "AVAN / UYGULAMA",
    projeMusaviri: "PROJE MÜŞAVİRİ",
    altYuklenici: "ALT YÜKLENİCİ",
    insaatMusaviri: "İNŞAAT MÜŞAVİRİ",
    mimari: "MİMARİ",
    statik: "STATİK",
    mekanik: "MEKANİK",
    elektrik: "ELEKTRİK",
    altyapi: "ALTYAPI",
    peyzaj: "PEYZAJ",
    zemin: "ZEMİN",
    plankote: "PLANKOTE"
};

/* ==========================================================================
   DEMO İŞ KAYDI
   --------------------------------------------------------------------------
   Uygulama ilk açılışta (localStorage boşken) aşağıdaki demo kaydı yüklenir.
   Amaç: her panelin fonksiyonunu anlaşılır kılmak. Bu kayıt bilerek
   FARKLI ve EKSİK değerlerle dolduruldu ki uygulamanın hangi panelde ne
   gösterdiği görülebilsin:

     • eksik "Sistem ID"          -> kimlik katmanı (safeRecordId) görünür
     • eksik ihale/sözleşme tarihi -> "Veri Tamamlama" paneli bu satırı işaretler
     • zengin timeline              -> "Son Timeline Notu" ve iş modalı dolu görünür
     • uzun metinler               -> tablo hücrelerinin kırpma davranışı görünür
     • farklı il/ilçe ve tür       -> harita ve istatistik panelleri örneklenir

   Bu kayıt gerçek bir proje kaydı DEĞİLDİR; yalnızca arayüzün her özelliğini
   göstermek için tasarlanmıştır. Gerçek kullanıma geçerken Ayarlar > Varsayılanlara
   Dön ile temizlenebilir ya da bu blok silinebilir.

   NOT: "id" alanı boş bırakılmıştır; uygulama açılışta safeRecordId() ile
   benzersiz bir kimlik üretir. Böylece demo kaydı hiçbir kimlik çakışmasına
   yol açmaz.
   ========================================================================== */
const initialJobsData = [
  {
    section: "500Bin",
    tur: "KENTSEL",
    kapsam: "AFET",
    il: "Ankara",
    ilce: "Keçiören",
    is_tanimi: "DEMO KAYDI — Kentsel Dönüşüm Konut Projesi (Bu kayıt arayüzü tanıtır, gerçek iş değildir)",
    proje: "Örnek Proje Müşavirliği",
    alt_yuklenici: "Örnek Yüklenici Ltd. Şti.",
    asama: "İhale",
    avan_uygolama: "Uygulama Projesi",
    protokol: "Örnek Protokol",
    digerDaire: "",
    ihale_yazisi: "",
    ihale_tarihi: "",
    sozlesme_tarihi: "",
    ihale_bedeli: "128.750.000 TL",
    insaat_musaviri: "Örnek İnşaat Müşavirliği",
    yuklenici: "Örnek Yüklenici Ltd. Şti.",
    insaat_alani: "42.300",
    folder_path: "C:/Projeler/DEMO",
    important_notes: "Bu bir DEMO kaydıdır. Uygulamanın tüm panellerini görmek için yerleştirilmiştir; gerçek bir proje verisi içermez.",
    /* Aşama ve tür kırılımlarının nasıl çalıştığını görmek için farklı
       değerler: harita ısı bölgeleri, istatistik donut'ı ve tür dağılımı
       bu kayıttan beslenir. */
    timeline: [
      { text: "DEMO ADIM 1 — Proje öncesi fizibilite çalışması tamamlandı; saha etüdü raporu arşive yüklendi.", date: "2026-08-14" },
      { text: "DEMO ADIM 2 — Uygulama projesi onaylandı, KİEP kapsamı netleştirildi.", date: "2026-09-02" },
      { text: "DEMO ADIM 3 — İhale ilan metni hazırlandı. DEMO amaçlı olduğu için ihale tarihi ve sözleşme bilgileri BİLEREK boş bırakıldı; bu sayede \"Veri Tamamlama\" panelinin eksik alanı nasıl işaretlediği görülebilir.", date: "2026-09-18" }
    ],
    experts: {
      mimari: "Demo Mimar",
      statik: "Demo Statik Mühendisi",
      elektrik: "Demo Elektrik Mühendisi",
      mekanik: "Demo Mekanik Mühendisi",
      altyapi: "-",
      peyzaj: "Demo Peyzaj Mimarı",
      zemin: "-",
      plankote: "-"
    }
  }
];

let jobs = [];
let activeJobIds = []; 
let notes = [];
let noteTopics = [];
let tasks = [];
let files = [];
let quickNotes = [];
let stickyNotes = [];
let weeklyGoal = { Pazartesi: 0, Salı: 0, Çarşamba: 0, Perşembe: 0, Cuma: 0 };
let settings = {};
let customHeaderTitles = {};
let customThemeVars = {};
let customListColumns = [];
let customListPickerSelection = [];
let activeView = 'home';
let tempTimeline = [];
let editingTimelineIdx = null;
let editingTaskId = null;
let globalSearchQuery = '';
let selectedExcelFilters = {};
let isTurSublistExpanded = false;
let selectedMapCity = null;
let activeMapTypeFilter = null; 
let deleteTargetJobId = null;
/* Silme modalının hedef türü: 'job' (iş kaydı) veya 'board' (not pano). */
let deleteTargetType = null;
let deleteTargetBoardTopic = null;

/* --- GERİ AL YIĞINI -------------------------------------------------------
   Yanlışlıkla yapılan silme / taşıma işlemlerini geri alabilmek için son
   durumların JSON kopyaları tutulur. 30 kayıtla sınırlı; eski kayıtlar
   düşer. Not: sadece bellek içidir, sayfa yenilenince geçmiş sıfırlanır. */
const UNDO_STACK_LIMIT = 30;
let undoStack = [];

/* D3 Map Global Variables */
let geojsonData = null;
let neighborGeoData = null; /* Komşu ülkelerin kara alanları (dekoratif katman) */
let mapSvg, mapG, mapZoom;
let mapResizeObserver = null;

/* UYDU MODU durumu (aşağıda motoru var: "UYDU / TOPOĞRAFYA KATMANI" bölümü) */
let satelliteModeActive = false;

/* ISİ BÖLGELERİ (TS 825 / BEP-TR) — Veri ve durum */
let heatZonesActive = false;
const TR_HEAT_ZONES = [
    { id: 1, label: '1. Derece Isı Bölgesi', short: '1. Bölge', color: '#f43f5e', tint: 'rgba(244, 63, 94, 0.12)', icon: 'fa-sun',
      cities: ['Antalya', 'Mersin', 'Adana', 'Muğla'] },
    { id: 2, label: '2. Derece Isı Bölgesi', short: '2. Bölge', color: '#fb923c', tint: 'rgba(251, 146, 60, 0.12)', icon: 'fa-sun',
      cities: ['İzmir', 'Manisa', 'Aydın', 'Denizli', 'Hatay', 'Gaziantep', 'Osmaniye', 'Kahramanmaraş', 'Adıyaman', 'Şanlıurfa', 'Mardin', 'Batman', 'Siirt', 'Kilis'] },
    { id: 3, label: '3. Derece Isı Bölgesi', short: '3. Bölge', color: '#fbbf24', tint: 'rgba(251, 191, 36, 0.12)', icon: 'fa-cloud-sun',
      cities: ['Balıkesir', 'Çanakkale', 'İstanbul', 'Tekirdağ', 'Bursa', 'Kocaeli', 'Sakarya', 'Zonguldak', 'Sinop', 'Samsun', 'Ordu', 'Giresun', 'Trabzon', 'Rize', 'Edirne', 'Kırklareli', 'Yalova'] },
    { id: 4, label: '4. Derece Isı Bölgesi', short: '4. Bölge', color: '#22d3ee', tint: 'rgba(34, 211, 238, 0.12)', icon: 'fa-snowflake',
      cities: ['Konya', 'Karaman', 'Isparta', 'Burdur', 'Ankara', 'Afyonkarahisar', 'Uşak', 'Kütahya', 'Eskişehir', 'Bilecik', 'Düzce', 'Bolu', 'Karabük', 'Bartın', 'Çankırı', 'Çorum', 'Amasya', 'Tokat', 'Kırıkkale', 'Kırşehir', 'Aksaray', 'Nevşehir', 'Niğde', 'Kayseri', 'Malatya', 'Elazığ', 'Diyarbakır', 'Şırnak', 'Bingöl', 'Tunceli', 'Erzincan', 'Artvin', 'Iğdır'] },
    { id: 5, label: '5. Derece Isı Bölgesi', short: '5. Bölge', color: '#3b82f6', tint: 'rgba(59, 130, 246, 0.12)', icon: 'fa-snowflake',
      cities: ['Yozgat', 'Sivas', 'Kastamonu', 'Bayburt', 'Gümüşhane', 'Muş', 'Bitlis', 'Van', 'Hakkari'] },
    { id: 6, label: '6. Derece Isı Bölgesi', short: '6. Bölge', color: '#8b5cf6', tint: 'rgba(139, 92, 246, 0.12)', icon: 'fa-snowflake',
      cities: ['Erzurum', 'Kars', 'Ağrı', 'Ardahan'] }
];

const CITY_NAME_ALIASES = { 'afyon': 'afyonkarahisar' }; // GeoJSON'da il adı "Afyon" olarak geçiyor

/* Harita derinlik katmanı sabitleri: komşu kara alanları + denize kıyısı olan iller */
const NEIGHBOR_LANDMASSES = new Set(['greece', 'bulgaria', 'georgia', 'armenia', 'azerbaijan', 'iran', 'iraq', 'syria', 'cyprus', 'northern cyprus', 'russia']);
const COASTAL_PROVINCES = new Set(['istanbul', 'tekirdag', 'kirklareli', 'edirne', 'kocaeli', 'sakarya', 'duzce', 'zonguldak', 'bartin', 'kastamonu', 'sinop', 'samsun', 'ordu', 'giresun', 'trabzon', 'rize', 'artvin', 'canakkale', 'balikesir', 'yalova', 'bursa', 'izmir', 'aydin', 'mugla', 'antalya', 'mersin', 'adana', 'hatay']);
function mapAsciiFold(s) {
    return (s || '').toLocaleLowerCase('tr-TR').trim()
        .replace(/i\u0307/g, 'i')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c')
        .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ı/g, 'i');
}

/* PERF: Bu fonksiyon harita render'ında 81 il için, her render'da (ve resize
   başına) çağrılıyordu. Eski hâlde her çağrıda 5 bölgenin tüm şehirleri
   `toLocaleLowerCase` ile yeniden normalize ediliyordu (yani 81 × 5 × ~80
   karşılaştırma). Şehir → bölge eşlemesi bir kez kurulup önbelleğe alınıyor;
   sonraki çağrılar tek bir Map okuması. Anahtarlar ve normalizasyon aynı
   olduğu için sonuç birebir değişmez. */
let _cityZoneLookup = null;

function _buildCityZoneLookup() {
    const lookup = new Map();
    for (const zone of TR_HEAT_ZONES) {
        for (const c of zone.cities) {
            lookup.set(String(c).trim().toLocaleLowerCase('tr-TR'), zone);
        }
    }
    return lookup;
}

function getCityHeatZone(cityName) {
    if (!cityName) return null;
    const norm = String(cityName).trim().toLocaleLowerCase('tr-TR');
    if (!norm) return null;

    if (!_cityZoneLookup) _cityZoneLookup = _buildCityZoneLookup();

    const resolved = CITY_NAME_ALIASES[norm] || norm;
    return _cityZoneLookup.get(resolved) || null;
}

function getZoneTooltipBadgeHtml(zone) {
    if (!zone) return '';
    return `<span class="zone-tooltip-badge" style="background:${zone.color};"><i class="fa-solid ${zone.icon}"></i> ${escapeHtml(zone.short)}</span>`;
}

/* Bölge notları: compact=true → tooltip (etiketler gizli), false → modal bulutu (etiketli) */
function getZoneNotesListHtml(zone, compact = false) {
    if (!zone) return '';
    const notes = [];

    if (zone.id <= 3) {
        notes.push({ icon: 'fa-layer-group', label: 'Cam Seçimi',
            text: `İlk camı <b>güneş ve ısı kontrol kaplamalı</b>, iç camı temperli <b>4+16+4 mm</b> çift cam kullanılacaktır (Poz No: <b>15.470.1419/A</b>).` });
    } else {
        notes.push({ icon: 'fa-layer-group', label: 'Cam Seçimi',
            text: `İlk camı sadece <b>ısı kontrol kaplamalı</b>, iç camı temperli <b>4+16+4 mm</b> çift cam kullanılacaktır (Poz No: <b>15.470.1216/A</b>).` });
    }

    if (zone.id >= 5) {
        notes.push({ icon: 'fa-house-chimney', label: 'Çatı & Saçak',
            text: `Metal kiremit çatı örtüsü <b>(ÖZEL-22)</b> uygulanır; beton saçak <b>100 cm</b> imal edilir, oluk ve yağmur iniş borusu kullanılmaz.` });
    }

    notes.push({ icon: 'fa-calculator', label: 'Yalıtım',
        text: `Mantolama (EPS/Taş Yünü), çatı, döşeme ve toprakla temas eden perde yalıtım kalınlıkları <b>TS 825</b> ve <b>BEP-TR</b> hesaplarına göre belirlenir.` });

    if (!compact) {
        notes.push({ icon: 'fa-temperature-half', label: 'Isıtılmayan Hacim',
            text: `Perde duvarlarda ısıtılmayan hacimler için minimum <b>5 cm XPS</b> şart koşulmuştur.` });
    }

    return notes.map(n => `
        <div class="zone-note-row">
            <i class="fa-solid ${n.icon}" style="color:${zone.color};"></i>
            <span>${compact ? '' : `<b>${escapeHtml(n.label)}:</b> `}${n.text}</span>
        </div>
    `).join('');
}

/* IŞIK HARİTASI KALDIRILDI -------------------------------------------------------
   "Proje Bazlı Işık Haritası" (glow map: lacivert zemin, altın ışıklar, fiber
   optik ağı) denemesinden vazgeçildi; tüm durum, çizim ve CSS'i silindi.
   İhtiyaç hâlinde yedekten geri alınabilir:
   index.snapshot-20261012-before-cleanup.html */

function toggleHeatZones() {
    /* İklim bölgeleri ile normal harita aynı anda açık olabilir; ışık haritası
       kalktığı için eski karşılıklı dışlama kuralına gerek kalmadı. */
    heatZonesActive = !heatZonesActive;
    renderD3Map();
    updateMapLegendMode();
}

function updateMapLegendMode() {
    const projectsLegend = document.getElementById('legend-projects');
    const zonesLegend = document.getElementById('legend-zones');
    const zoneBtn = document.getElementById('zone-toggle-btn');
    if (!projectsLegend || !zonesLegend) return;

    /* Işık haritası kalktı: legend yalnızca normal choropleth ve ısı bölgeleri
       arasında geçiş yapar. */
    if (heatZonesActive) {
        projectsLegend.style.display = 'none';
        zonesLegend.style.display = 'flex';
        zonesLegend.innerHTML = '<span style="font-weight:800;">Isı Bölgesi:</span>' + TR_HEAT_ZONES.map(z =>
            `<span class="zone-legend-item"><span class="zone-swatch" style="background:${z.color};"></span>${z.id}</span>`
        ).join('');
    } else {
        projectsLegend.style.display = 'flex';
        zonesLegend.style.display = 'none';
    }

    if (zoneBtn) zoneBtn.classList.toggle('active', heatZonesActive);
}

/* ============================================================
   SAYI GİRİŞİ (Türkçe biçim)
   - Yazarken/Enter'da otomatik binlik ayırıcı (nokta) + ondalık (virgül)
   - Kaydetmede birim otomatik eklenir (m² / TL)
   - Kopyalarken ham sayı verilir (kullanıcı Ctrl+A/Ctrl+C yaptığında
     input değeri biçimli olduğu için, kopyalama olayında ham değer
     panoya yazılır)
   ============================================================ */

/* "45.500.000,50 TL" -> 45500000.5 | "18.851" -> 18851 | "abc" -> null
   Sondaki birim ve tüm ayırıcı ayıklanır, ondalık ayırıcı olarak virgül kabul edilir. */
function parseTrNumber(v) {
    if (v === null || v === undefined) return null;
    let s = String(v).trim();
    if (!s) return null;
    // Once birimleri at. Harf+rakam grubu ("m2") de silinir, yoksa "m²"
    // yazildiginda kalan "2" ondalik haneye eklenir.
    s = s.replace(/[A-Za-zÇĞİÖŞÜçğıöşü²°]+\d*/g, '');
    s = s.replace(/[^\d.,\-+]/g, '');
    if (!s || !/\d/.test(s)) return null;

    // Negatif işareti koru
    const neg = /^\s*-/.test(s) || /-\s*\d/.test(s.replace(/[^\d.,-]/g, ''));
    s = s.replace(/-/g, '');

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    let intPart, decPart = '';

    if (lastComma > lastDot) {
        // Virgül ondalık ayırıcı: noktalar binlik ayırıcı
        intPart = s.slice(0, lastComma).replace(/\./g, '');
        decPart = s.slice(lastComma + 1).replace(/\D/g, '');
    } else if (lastDot > lastComma) {
        const tail = s.slice(lastDot + 1);
        // Noktadan sonra tam 3 hane varsa nokta binlik ayırıcıdır ("45.500.000"),
        // aksi halde ondalık ayırıcıdır ("45500.5").
        if (tail.length === 3) {
            intPart = s.replace(/[.,]/g, '');
        } else {
            intPart = s.slice(0, lastDot).replace(/,/g, '');
            decPart = tail.replace(/\D/g, '');
        }
    } else {
        // Ayırıcı yok: tam sayı
        intPart = s.replace(/[.,]/g, '');
    }

    intPart = intPart.replace(/\D/g, '') || '0';
    let out = decPart ? intPart + '.' + decPart : intPart;
    const n = parseFloat(out);
    if (isNaN(n)) return null;
    return neg ? -n : n;
}

/* Esnek tarih çözümleyici. Desteklenen biçimler:
   - dd.mm.yyyy / dd-mm-yyyy / dd/mm/yyyy  (Türkçe kayıtlar, Excel içe aktarımı)
   - yyyy-mm-dd / yyyy/mm/dd               (formdaki <input type="date"> çıktısı)
   - ISO datetime ("2019-03-15T00:00:00")  → tarih kısmı alınır
   - 2 haneli yıllar ("15.03.19") → 2019 (yy<70 ise 2000'ler, değilse 1900'ler)
   Dönen değer UTC gece yarısı zaman damgasıdır; böylece gün farkları Yaz Saati
   (DST) kaymalarından etkilenmez. Tanınmayan/eksik değerlerde null döner. */
function parseFlexibleDate(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;

    /* Yıl-öncelikli biçimler (ISO / type=date çıktısı) */
    const iso = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?!\d)/);
    if (iso) {
        const y = +iso[1], mo = +iso[2], d = +iso[3];
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
        return Date.UTC(y, mo - 1, d);
    }

    /* Gün-öncelikli Türkçe biçimler. 4 haneli yıllara üst sınır konmaz: "3019"
       gibi yazım hatalı yıllar da çözümlensin ki AYKIRI koruması ve
       diagIhaleSozlesme() bunları ham tarih metniyle gösterebilsin.
       2 haneli yıllar 20xx/19xx'e eşlenir. */
    const tr = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?!\d)/);
    if (tr) {
        const d = +tr[1], mo = +tr[2];
        let y = +tr[3];
        if (tr[3].length === 2) y += (y < 70 ? 2000 : 1900);
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
        return Date.UTC(y, mo - 1, d);
    }

    /* Son çare: yerel Date ayrıştırma (örn. "March 15, 2019"), UTC'ye sabitlenir */
    const native = new Date(s);
    if (isNaN(native.getTime())) return null;
    return Date.UTC(native.getFullYear(), native.getMonth(), native.getDate());
}

/* 18851 -> "18.851" | 45500000.5 -> "45.500.000,50" */
function formatTrNumber(n, maxDecimals) {
    if (n === null || n === undefined || isNaN(n)) return '';
    const dec = (maxDecimals === undefined) ? 2 : maxDecimals;
    return Number(n).toLocaleString('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: dec
    });
}

/* --- İNŞAAT ALANI GEÇERLİLİK KURALI (birim fiyat istisnası) --------------
   Birim fiyat üzerinden çıkan bazı ihalelerde toplam inşaat alanı BİLİNMEZ;
   bu işlerde alan bilinçli olarak 0 girilir. Bu kayıtlar:
     • m² bazlı ORTALAMA BİRİM FİYAT hesabına GİRİLMEZ (0'a bölme veya
       ortalamayı aşağı çekme hatası),
     • toplam alan ve "En Büyük Alanlı İşler" sıralamasına da girmez.
   Bu yüzden istatistik tarafındaki "geçerli alan" tanımı tek yerde burada
   yaşar: sayı çözülebiliyor VE > 0. */
function isValidAreaForStats(j) {
    const area = parseTrNumber(j && j.insaat_alani);
    return area !== null && area > 0;
}

/**
 * Genel/ortalama m² birim fiyatını hesaplar: toplam bedel / toplam alan.
 *
 * YALNIZCA her iki alanı da > 0 olan kayıtlar ortalamaya girer; birim fiyat
 * esaslı (m² = 0) işler burada dışarıda kalır. Bu, "0 m²" yazan bir kaydın
 * hem sıfıra bölme hatası vermesini hem de ortalamayı sistematik olarak
 * düşürmesini engeller.
 *
 * @returns {{avg:number|null, totalCost:number, totalArea:number, used:number,
 *            skippedZeroArea:number, skippedMissingArea:number,
 *            skippedNoCost:number, skippedNoArea:number}}
 *   avg null ise hesaplanacak uygun kayıt yoktur (çağıranlar "veri yok" gösterir).
 */
function computeAverageM2Price(jobList) {
    let totalCost = 0, totalArea = 0, used = 0;
    let skippedZeroArea = 0, skippedMissingArea = 0, skippedNoCost = 0;
    (jobList || []).forEach(j => {
        const area = parseTrNumber(j && j.insaat_alani);
        const cost = parseTrNumber(j && j.ihale_bedeli);
        /* Alan önce değerlendirilir: 0 m² bilinçli "birim fiyat" işareti,
           boş/geçersiz ise normal eksik veridir; ikisi de ortalamaya girmez
           ama sayaçlarda ayrı raporlanır. */
        if (area === null || isNaN(area) || area === 0) { skippedZeroArea++; return; }
        if (area < 0) { skippedMissingArea++; return; }
        if (cost === null || isNaN(cost) || cost <= 0) { skippedNoCost++; return; }
        totalCost += cost;
        totalArea += area;
        used++;
    });
    const avg = (used > 0 && totalArea > 0) ? (totalCost / totalArea) : null;
    return {
        avg: avg,
        totalCost: totalCost,
        totalArea: totalArea,
        used: used,
        skippedZeroArea: skippedZeroArea,
        skippedMissingArea: skippedMissingArea,
        skippedNoCost: skippedNoCost
    };
}

/* Alan tanimlari. Birim, input degerininIcinde degil; ayri bir rozet olarak
   gosterilir. Bu sayede sayi yazilir yazilmaz gorunur ve sayi silinene kadar kalir.
   Kaydedilirken birim metne eklenir (kayitlar "18.851 m²" seklinde saklanir). */
const NUMBER_FIELD_DEFS = {
    insaat_alani:  { unit: 'm²', decimals: 2, placeholder: 'Örn: 12500' },
    ihale_bedeli:  { unit: 'TL', decimals: 2, placeholder: 'Örn: 45500000' }
};

/* Birim rozetini gosterir/gizler: deger bos degilse gorunur */
function syncNumberFieldSuffix(input) {
    const wrap = input.closest('.num-field');
    if (!wrap) return;
    wrap.classList.toggle('has-value', parseTrNumber(input.value) !== null);
}

/* Input degerini bicimlendirir. Birim degerinIcinde tutulmaz.
   withUnit=true ise birlik dondurur ("18.851 m²"). */
function formatNumberFieldValue(input, withUnit) {
    const def = NUMBER_FIELD_DEFS[input.dataset.numField];
    if (!def) return '';
    // Eski kayitlardan gelen birimi ("18.851 m²") soyup sayiya cevir
    const stripped = input.value.replace(new RegExp('\\s*' + def.unit + '\\s*$', 'i'), '').trim();
    const n = parseTrNumber(stripped);
    if (n === null) {
        input.value = '';
        syncNumberFieldSuffix(input);
        return '';
    }
    const formatted = formatTrNumber(n, def.decimals);
    input.value = formatted;
    syncNumberFieldSuffix(input);
    return withUnit ? formatted + ' ' + def.unit : formatted;
}

/* Kopyalama: ham sayı panoya yazılır (birim ve ayırıcı yok,
   ondalık için nokta - Excel'in tanıdığı biçim). */
function numberFieldCopyHandler(e) {
    const input = e.target;
    const def = NUMBER_FIELD_DEFS[input.dataset.numField];
    if (!def) return;
    const n = parseTrNumber(input.value);
    if (n === null) return;
    e.clipboardData.setData('text/plain', String(n));
    e.preventDefault();
}

/* Kaydetme aninda alani bicimlendirip "18.851 m²" seklinde dondurur */
function normalizeNumberFieldValue(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return '';
    return formatNumberFieldValue(input, true);
}

function initNumberFields() {
    document.querySelectorAll('[data-num-field]').forEach(input => {
        const def = NUMBER_FIELD_DEFS[input.dataset.numField];
        if (!def) return;
        input.setAttribute('inputmode', 'decimal');
        input.setAttribute('autocomplete', 'off');
        input.placeholder = def.placeholder;

        // Yazarken: rakam/ayırıcı dışını temizle, rozeti güncelle.
        // (Biçimlendirme Enter/blur'da yapılır, yoksa imleç her tuşta kayıyor.)
        input.addEventListener('input', () => {
            const cleaned = input.value.replace(/[^\d.,\-\s]/g, '');
            if (cleaned !== input.value) input.value = cleaned;
            syncNumberFieldSuffix(input);
        });

        // Enter: bicimlendir, rozet kalsin
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                formatNumberFieldValue(input, false);
                input.blur();
            }
        });
        // Blur: bicimlendir (birim degerIcinde yazilmaz, rozet gosterir)
        input.addEventListener('blur', () => formatNumberFieldValue(input, false));

        // Ctrl+C / kopyala -> ham sayı
        input.addEventListener('copy', numberFieldCopyHandler);

        // Başlangıç durumunu senkronla (modal açılmadan önce de doğru görünsün)
        syncNumberFieldSuffix(input);
    });
}

/* ==========================================================================
   GERİ SAYIM SAYACI — AY / HAFTA / GÜN
   --------------------------------------------------------------------------
   Sidebar'daki flip kartlara kalan süreyi yazar. Ayarlar, localStorage'da
   iki anahtarda tutulur:
     yaser_v10_countdown_target -> "YYYY-MM-DD"
     yaser_v10_countdown_title  -> serbest metin (boş olabilir)

   HESAPLAMA YAPISI
   Kalan süre önce TAM AY sayısına bölünür, artan günler haftaya, kalan
   günler tek tek dağılır. Böylece "1 ay 2 hafta 3 gün" her zaman toplam
   gün sayısıyla birebir tutarlıdır (30+14+3 = 47). Sabit "1 ay = 30 gün"
   varsayımı Şubat gibi aylarda yanlış sonuç verdiği için kullanılmaz. */
const COUNTDOWN_TARGET_KEY = 'yaser_v10_countdown_target';
const COUNTDOWN_TITLE_KEY  = 'yaser_v10_countdown_title';
const CD_SOON_THRESHOLD_D  = 30;   // bu günden az kaldıysa uyarı rozeti
let countdownTimerId = null;

function getCountdownSettings() {
    let target = '';
    let title = '';
    try { target = localStorage.getItem(COUNTDOWN_TARGET_KEY) || ''; } catch (e) { /* gizli sekmede localStorage kapalı olabilir */ }
    try { title  = localStorage.getItem(COUNTDOWN_TITLE_KEY)  || ''; } catch (e) { /* yukarıya bakınız */ }
    return { target: target.trim(), title: title.trim() };
}

/* "YYYY-MM-DD" -> yerel saatiyle gece yarısından oluşan Date.
   new Date("2026-03-01") UTC kabul eder ve TRT'de bir gün kayar; bu yüzden
   bileşenler elle kurulur. Geçersiz/boş girdi null döner. */
function parseCountdownDate(value) {
    if (!value || typeof value !== 'string') return null;
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (mo < 1 || mo > 12) return null;
    const dt = new Date(y, mo - 1, d);
    // 31 Şubat gibi imkânsız günler new Date tarafından kaydırılır; reddet.
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
}

/* İki yerel tarih arasındaki TAM gün farkı (saat dilimi kayması hariç).
   Günler Date.UTC ile normalize edilip 86400000'e bölünür; DST geçişlerinde
   (23 veya 25 saatlik gün) yuvarlama hatası oluşmaz. */
function daysBetween(fromDate, toDate) {
    const a = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const b = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    return Math.round((b - a) / 86400000);
}

function pad2(n) { return n < 10 ? '0' + n : String(n); }

/* Kalan takvim gününü { months, weeks, days, total, expired } olarak ayrıştırır.
   AY sayısı gerçek takvim aylarıyla hesaplanır (artık yıl ve ay uzunlukları
   dahil), kalan günler 7'ye bölünerek hafta/gün elde edilir. */
function computeCountdown(targetDate, nowDate) {
    const totalDays = daysBetween(nowDate, targetDate);
    if (totalDays < 0) return { months: 0, weeks: 0, days: 0, total: totalDays, expired: true };

    let months = (targetDate.getFullYear() - nowDate.getFullYear()) * 12
               + (targetDate.getMonth()  - nowDate.getMonth());

    // Hedef ayın günü bugünkü günden küçükse ay henüz tamamlanmamıştır.
    // (15 Tem -> 14 Ağu: 1 ay değil 0 ay; 15 Ağustos'ta 1 ay olur.)
    if (targetDate.getDate() < nowDate.getDate()) months--;

    // Ayları bugünden ilerletip kalan gün sayısını çıkar. İlerletirken gün
    // taşması olursa (31 Oca -> 28/29 Şub) son günü hedefle.
    let cursor = new Date(nowDate.getFullYear(), nowDate.getMonth() + months, nowDate.getDate());
    if (cursor.getDate() !== nowDate.getDate()) {
        cursor = new Date(nowDate.getFullYear(), nowDate.getMonth() + months + 1, 0);
    }
    let rest = daysBetween(cursor, targetDate);
    if (rest < 0) rest = 0;

    return {
        months: months,
        weeks: Math.floor(rest / 7),
        days:  rest % 7,
        total: totalDays,
        expired: false
    };
}

/* Bir kartın değerini yazar; değer değiştiyse çevirme animasyonu oynatır. */
function setCountdownCard(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const next = String(value);
    if (el.textContent === next) return;
    el.textContent = next;
    el.classList.remove('flip-in');
    void el.offsetWidth;   // reflow: animasyonun yeniden tetiklenmesi için
    el.classList.add('flip-in');
}

function renderCountdown() {
    const root = document.getElementById('sidebar-countdown');
    if (!root) return;

    const { target, title } = getCountdownSettings();
    const titleEl = document.getElementById('countdown-title-text');
    if (titleEl) titleEl.textContent = title || 'Geri Sayım';

    const targetDate = parseCountdownDate(target);
    // Hedef tarih yoksa: kartları gizle, kurulum ipucunu göster.
    if (!targetDate) {
        root.classList.add('is-empty');
        root.classList.remove('is-expired', 'is-soon');
        setCountdownCard('cd-value-month', '--');
        setCountdownCard('cd-value-week', '--');
        setCountdownCard('cd-value-day', '--');
        renderCountdownSettingsPreview();
        return;
    }

    root.classList.remove('is-empty');

    // "Bugün" sayılır: hedef günün 00:00'ında dolmuş olsa bile o günün sonuna
    // kadar sayaç sıfırı gösterir, ertesi gün "Süre Doldu!" durumuna geçer.
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const r = computeCountdown(targetDate, today);

    setCountdownCard('cd-value-month', pad2(r.months));
    setCountdownCard('cd-value-week',  pad2(r.weeks));
    setCountdownCard('cd-value-day',   pad2(r.days));

    const statusText = document.getElementById('cd-status-text');
    const expired = r.expired;
    const soon = !expired && r.total <= CD_SOON_THRESHOLD_D;

    root.classList.toggle('is-expired', expired);
    root.classList.toggle('is-soon', soon);

    if (statusText) {
        if (expired) statusText.textContent = 'Süre Doldu! ' + Math.abs(r.total) + ' gün geçti';
        else if (soon) statusText.textContent = r.total + ' gün kaldı!';
    }

    renderCountdownSettingsPreview();
}

/* Ayarlar sekmesindeki canlı önizleme satırı. */
function renderCountdownSettingsPreview() {
    const textEl = document.getElementById('countdown-preview-text');
    const dotEl  = document.getElementById('countdown-preview-dot');
    const dlEl   = document.getElementById('countdown-preview-deadline');
    if (!textEl) return;

    const inputTarget = document.getElementById('countdown-target-input');
    const raw = (inputTarget ? inputTarget.value : getCountdownSettings().target) || '';
    const dt = parseCountdownDate(raw);

    if (!dt) {
        textEl.textContent = 'Hedef tarih seçilmedi';
        textEl.style.color = 'var(--txt-main)';
        if (dotEl) dotEl.style.color = 'var(--txt-muted)';
        if (dlEl) dlEl.textContent = '—';
        return;
    }

    if (dotEl) dotEl.style.color = 'var(--color-primary)';
    if (dlEl) dlEl.textContent = dt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const r = computeCountdown(dt, today);
    if (r.expired) {
        textEl.textContent = 'Süre doldu — ' + Math.abs(r.total) + ' gün geçti';
        textEl.style.color = 'var(--color-rose)';
    } else {
        textEl.textContent = r.months + ' ay ' + r.weeks + ' hafta ' + r.days + ' gün kaldı';
        textEl.style.color = 'var(--txt-main)';
    }
}

/* Ayarlar panelindeki alanları kayıtlı değerlerle doldurur. */
function loadCountdownSettingsForm() {
    const { target, title } = getCountdownSettings();
    const t = document.getElementById('countdown-target-input');
    const h = document.getElementById('countdown-title-input');
    if (t) t.value = target;
    if (h) h.value = title;
    renderCountdownSettingsPreview();
}

function saveCountdownSettings() {
    const t = document.getElementById('countdown-target-input');
    const h = document.getElementById('countdown-title-input');
    const feedback = document.getElementById('countdown-save-feedback');

    const raw = t ? t.value.trim() : '';
    if (raw && !parseCountdownDate(raw)) {
        if (feedback) { feedback.style.color = 'var(--color-rose)'; feedback.textContent = 'Geçersiz tarih.'; }
        return;
    }

    try {
        // Boş tarih "sayaç kapalı" demektir: anahtar silinir, ipucu geri gelir.
        if (raw) localStorage.setItem(COUNTDOWN_TARGET_KEY, raw);
        else localStorage.removeItem(COUNTDOWN_TARGET_KEY);
        if (h && h.value.trim()) localStorage.setItem(COUNTDOWN_TITLE_KEY, h.value.trim());
        else localStorage.removeItem(COUNTDOWN_TITLE_KEY);
    } catch (e) {
        if (feedback) { feedback.style.color = 'var(--color-rose)'; feedback.textContent = 'Kaydedilemedi.'; }
        return;
    }

    if (feedback) { feedback.style.color = 'var(--color-emerald)'; feedback.textContent = 'Kaydedildi.'; }
    renderCountdown();
    setTimeout(() => { if (feedback) feedback.textContent = ''; }, 2200);
}

function resetCountdownSettings() {
    try {
        localStorage.removeItem(COUNTDOWN_TARGET_KEY);
        localStorage.removeItem(COUNTDOWN_TITLE_KEY);
    } catch (e) { /* yoksay */ }
    loadCountdownSettingsForm();
    renderCountdown();
    const feedback = document.getElementById('countdown-save-feedback');
    if (feedback) { feedback.style.color = 'var(--txt-sub)'; feedback.textContent = 'Sıfırlandı.'; }
}

const APP_VERSION = '1.0';
const APP_BUILD_DATE = '11.10.2026';
const PROFILE_SETTINGS_KEY = 'yaser_v10_profile';

/* Varsayılan profil: stok kurulumda rol "ADMİN" olarak görünür. */
const defaultProfileSettings = {
    name: 'No Name',
    role: 'ADMİN',
    unit: 'Etüt & Proje',
    permission: 'Tam Erişim'
};

function getProfileSettings() {
    try {
        const raw = JSON.parse(_zkRead(PROFILE_SETTINGS_KEY));
        if (raw && typeof raw === 'object') {
            return {
                name: String(raw.name || '').trim() || defaultProfileSettings.name,
                role: String(raw.role || '').trim() || defaultProfileSettings.role,
                unit: String(raw.unit || '').trim() || defaultProfileSettings.unit,
                permission: String(raw.permission || '').trim() || defaultProfileSettings.permission
            };
        }
    } catch (e) { /* bozuk veri: varsayılana dön */ }
    return { ...defaultProfileSettings };
}

/* Paneldeki tüm görünen profil noktalarını (sidebar kartı, popover, ayar
   formu) güncel değerlerle eşitler. HTML'e yazılmış statik "No Name" ve
   rol metinleri de ilk açılışta bu fonksiyonla değiştirilir. */
function applyProfileToDom() {
    const p = getProfileSettings();

    const cardName = document.querySelector('.user-profile-card .profile-meta h4');
    const cardRole = document.querySelector('.user-profile-card .profile-meta p');
    if (cardName) cardName.textContent = p.name;
    if (cardRole) cardRole.textContent = p.role;

    const popName = document.querySelector('.profile-popover .profile-pop-name');
    const popRoleEl = document.getElementById('profile-pop-role-text');
    if (popName) popName.textContent = p.name;
    if (popRoleEl) popRoleEl.textContent = p.role;

    const roleEl = document.getElementById('profile-display-role');
    if (roleEl) roleEl.textContent = p.role;

    const unitEl = document.getElementById('profile-display-unit');
    if (unitEl) unitEl.textContent = p.unit;

    const permEl = document.getElementById('profile-display-permission');
    if (permEl) permEl.textContent = p.permission;
}

function setProfileFeedback(text, color) {
    const feedback = document.getElementById('profile-save-feedback');
    if (!feedback) return;
    feedback.style.color = color || 'var(--txt-muted)';
    feedback.textContent = text;
    if (text) setTimeout(() => { if (feedback.textContent === text) feedback.textContent = ''; }, 2600);
}

function loadProfileSettingsForm() {
    const p = getProfileSettings();
    const n = document.getElementById('profile-name-input');
    const r = document.getElementById('profile-role-input');
    const u = document.getElementById('profile-unit-input');
    const perm = document.getElementById('profile-permission-input');
    if (n) n.value = p.name;
    if (r) r.value = p.role;
    if (u) u.value = p.unit;
    if (perm) perm.value = p.permission;
}

function saveProfileSettings() {
    const n = document.getElementById('profile-name-input');
    const r = document.getElementById('profile-role-input');
    const u = document.getElementById('profile-unit-input');
    const perm = document.getElementById('profile-permission-input');

    const name = n ? n.value.trim() : '';
    const role = r ? r.value.trim() : '';
    if (!name) { setProfileFeedback('Ad Soyad boş olamaz.', 'var(--color-rose)'); return; }
    if (!role) { setProfileFeedback('Rol boş olamaz.', 'var(--color-rose)'); return; }

    /* Metinler sonradan template literal'lara değil textContent'e yazılır;
       XSS yüzeyi oluşmaz. Yine de kullanıcı girdisi kaydedilmeden boşaltılır. */
    try {
        _zkWrite(PROFILE_SETTINGS_KEY, JSON.stringify({
            name: name,
            role: role,
            unit: (u ? u.value.trim() : '') || defaultProfileSettings.unit,
            permission: (perm ? perm.value.trim() : '') || defaultProfileSettings.permission
        }));
    } catch (e) {
        setProfileFeedback('Kaydedilemedi.', 'var(--color-rose)');
        return;
    }

    applyProfileToDom();
    setProfileFeedback('Kaydedildi.', 'var(--color-emerald)');
}

function resetProfileSettings() {
    try { _zkRemove(PROFILE_SETTINGS_KEY); } catch (e) { /* yoksay */ }
    loadProfileSettingsForm();
    applyProfileToDom();
    setProfileFeedback('Varsayılana döndürüldü.', 'var(--txt-sub)');
}

function renderAboutVersion() {
    const el = document.getElementById('about-version-text');
    if (el) el.textContent = APP_VERSION;
}

/* Sidebar'daki ipucuna tıklanınca: Ayarlar sayfasına git ve sekmeyi aç. */
function openCountdownSettings() {
    if (typeof navigateTo === 'function') navigateTo('settings');
    setTimeout(() => { switchSettingsTab('countdown'); }, 60);
}

/* Günlük yenileme: gece yarısını geçince "bugün" değişir, kartlar güncellenir.
   LEAK DÜZELTMESİ: visibilitychange dinleyicisi fonksiyon içinde DEĞİL, bir kez
   modül seviyesinde bağlanır; startCountdown her çağrıldığında eklenip birikmez. */
let _countdownVisBound = false;
function startCountdown() {
    renderCountdown();
    if (countdownTimerId) clearInterval(countdownTimerId);
    countdownTimerId = setInterval(() => {
        if (document.hidden) return;
        renderCountdown();
    }, 60000);
    // Sekme tekrar görünür olduğunda gece yarısı geçmiş olabilir.
    if (!_countdownVisBound) {
        _countdownVisBound = true;
        document.addEventListener('visibilitychange', () => { if (!document.hidden) renderCountdown(); });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    /* Güvenlik panelindeki parola gücü göstergesi, kullanıcı yazarken
       canlı güncellensin. Dinleyici bir kez bağlanır; alan yoksa sessizce
       geçilir (panel DOM'u başka bir akışta da kaldırılabilir). */
    const npInput = document.getElementById('zk-new-password');
    if (npInput) npInput.addEventListener('input', updateZkStrengthMeter);

    /* --- GUEST FORM MODE: kısıtlı dış form modunda master parola
       SORULMAZ ve normal boot zinciri hiç başlatılmaz. */
    if (typeof initGuestFormMode === 'function' && initGuestFormMode()) {
        return;
    }

    /* --- UÇTAN UCA ŞİFRELEME: uygulama verisi yüklenmeden ÖNCE master parola
       istenir. Kilit açılana kadar loadAllData()/renderCurrentView() çalışmaz,
       dolayısıyla çözülmemiş hiçbir veri ekrana da gelmez. Web Crypto destek
       lenmiyorsa zkBoot() hemen çözülür ve akış eskisi gibi devam eder. */
    zkBootWorkModeGate().then(() => { bootAfterUnlock(); });
});

function bootAfterUnlock() {
    /* GUEST FORM MODE: kısıtlı dış form modundaysa normal panel akışı
       TAMAMEN atlanır. loadAllData() çağrılmaz → localStorage'daki diğer
       yaser_v10_* iş verileri RAM'e hiç alınmaz (sıfır sızma). */
    if (typeof initGuestFormMode === 'function' && initGuestFormMode()) {
        return;
    }

    startSplashLoader();
    startLiveClock();
    initNumberFields();
    startCountdown();
    initNoteRichEditor();
    updateUndoIndicator();

    initFxRipple();
    initFxCursorGlow();
    initFxSurfaceSheen();
    initFxTableRows();
    initFxDigitRoll();
    initScreensaver();
    /* GÖREV 1 & 5: kayıtlı odak modu ve harita dokunma uyarısı.
       Zen modu initScreensaver()'den SONRA uygulanır: aksi hâlde zen modda
       başlatılan ekran koruyucu timer'ı boşuna iş görürdü. */
    loadZenModePreference();
    initHoldToDelete();
    initMapTouchHint();
    initMobileNav();
    initTheme();
    loadCustomTheme();
    /* Profil adı/rolü/birimi HTML'de statik yazılıdır; kayıtlı tercihle
       eşleştirmek için ilk açılışta DOM'a yansıtılır. */
    applyProfileToDom();
    /* Sol menü durumu renderCurrentView'dan ÖNCE geri yüklenir: harita ve
       tablolar genişliğe göre çizilir, menü sonradan daralırsa içerik
       240px ölçüde kalır ve güncellenmez. */
    restoreSidebarState();
    bindSidebarHover();
    loadAllData();
    /* GitHub senkronizasyonu veri yüklendikten SONRA çalışır: karar motoru
       "bu cihazda veri var mı?" diye bakıyor ve zkPlainCache'in dolu olmasını
       bekliyor. Sessizce hata verirse uygulama yine normal açılır. */
    if (typeof zkApplyStartupSync === 'function') {
        Promise.resolve(zkApplyStartupSync()).catch(function (err) {
            console.warn('[zk] GitHub senkronizasyonu başarısız:', err);
        });
    }
    /* BULUT SENKRONİZASYONU (/api/data): her yerel kayıtta buluta yazılır;
       panel açılışında ve 60 sn'de bir buluttan gelen güncellemeler
       yaser_v10_jobs dizisine ID bazlı birleştirilir. Sessiz çalışır; API
       yapılandırılmamışsa yalnızca konsol uyarısı verir, uygulama akışı
       hiç etkilenmez. */
    initWorkMode();
    if (typeof isWorkModePrivate === 'function' && isWorkModePrivate()) {
        if (typeof hookSaveAllDataForCloudSync === 'function') hookSaveAllDataForCloudSync();
        if (typeof initCloudSyncWatcher === 'function') initCloudSyncWatcher();
    }
    if (typeof initCloudSyncWatcher === 'function') initCloudSyncWatcher();
    populateCityDropdown();
    
    document.getElementById('todo-input-date').value = taskDateKey();

    renderCurrentView();
    /* Panel açıklama bandı: uygulama 'home' ile açıldığı için ilk bant da
       Ana Sayfa için gösterilir. Sonraki panellerde navigateTo() yeniler. */
    renderPanelGuide(activeView || 'home');

    /* KPI çip tıklama + tooltip dinleyicileri (bir kez bağlanır). */
    initKpiChipInteractions();

    /* Günler arası görev taşıma + gece yarısı otomatik devri (kullanıcı isteği). */
    initTaskDayDragDrop();
    runMidnightTaskRollover(true);
    startMidnightTaskWatcher();

    initD3TurkeyMap();
    initMapResizeObserver();
    initDashboardSplitters();

    document.addEventListener('keydown', (e) => {
        /* Ctrl+Z / Cmd+Z geri al. Metin yazılan bir alanda (input, textarea,
           contenteditable, zengin metin editörü) tarayıcının kendi geri alma
           davranışı çalışsın; sadece veri kaybı yaratabileceğimiz durumda
           yakalayalım. */
        /* "/" arama kutusuna odaklanır (yaygın uygulama kısayolu). Yazarken
           çalışmaz, aksi halde "/" karakteri yazılamazdı. */
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const el = document.activeElement;
            const isTyping = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
            if (!isTyping) {
                const searchInput = document.getElementById('global-search-input');
                if (searchInput) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
                return;
            }
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
            const el = document.activeElement;
            const isTyping = el && (
                el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
                el.isContentEditable ||
                (el.closest && el.closest('.note-rich-editor'))
            );
            if (!isTyping && undoStack.length) {
                e.preventDefault();
                undoLastChange();
            }
            return;
        }
        if (e.key === 'Escape') {
            closeJobModal();
            closeNoteModal();
            closeFileModal();
            closeDetailModal();
            closeSelectActiveJobModal();
            closeCustomColumnModal();
            closeCustomListFilterMenus();
            closeAllExcelFilterDropdowns();
            closeDashboardDrawer();
            closeSecurityDeleteModal();
        }
    });

    document.addEventListener('click', (e) => {
        const drawer = document.getElementById('dashboard-drawer');
        if (drawer && drawer.classList.contains('open')) {
            const isClickInsideDrawer = drawer.contains(e.target);
            const isClickOnMapPath = e.target.classList.contains('map-city-path');
            /* Hologram panelinin kendi tıklamaları (tür süzgeci, kapatma düğmesi)
               ne çekmeceyi ne de odak modunu kapatmalı. */
            const isClickInsideHolo = !!(e.target.closest && e.target.closest('#map-holo'));

            if (!isClickInsideDrawer && !isClickOnMapPath && !isClickInsideHolo) {
                closeDashboardDrawer();
            }
        }

        if (!e.target.closest('th')) {
            closeAllExcelFilterDropdowns();
        }

        if (customListOpenFilter && !e.target.closest('.cl-filter-dropdown')) {
            closeCustomListFilterMenus();
        }
    });
}

/* --- GÖREV 1: ODAK / ZEN MODU ---------------------------------------------
   Tercih localStorage'da tutulur (yaser_v10_zen_mode). applyZenMode() hem
   sınıfı body'ye yazar hem de ayar anahtarını senkronlar; böylece sayfa
   yüklendiğinde hem görünüm hem kontrol doğru durumdadır. */
const ZEN_MODE_KEY = 'yaser_v10_zen_mode';

function applyZenMode(on) {
    document.body.classList.toggle('zen-mode', !!on);
    const sw = document.getElementById('zen-mode-switch');
    if (sw) {
        sw.classList.toggle('on', !!on);
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    /* Ekran koruyucu zen modda hiç başlamasın: boşta bekleme saniyelerce
       görünmez bir katman ve boşuna bir rAF döngüsü çalıştırıyordu. */
    if (on && typeof hideScreensaver === 'function' && svRunning) hideScreensaver();
}

function toggleZenMode() {
    const next = !document.body.classList.contains('zen-mode');
    applyZenMode(next);
    try { localStorage.setItem(ZEN_MODE_KEY, next ? '1' : '0'); } catch (e) { /* private mod */ }
}

function loadZenModePreference() {
    let saved = null;
    try { saved = localStorage.getItem(ZEN_MODE_KEY); } catch (e) { /* yoksay */ }
    applyZenMode(saved === '1');
}

/* --- GÖREV 5: HARİTA DOKUNMA UYARISI --------------------------------------
   Cihaz tespiti matchMedia ile değil, doğrudan pointerType üzerinden yapılır
   (bkz. initMapTouchHint açıklaması). sessionStorage bayrağı aynı oturumda
   tekrar gösterilmesini engeller. */
const MAP_TOUCH_HINT_KEY = 'yaser_map_touch_hint_seen';

function showMapTouchHint() {
    let seen = null;
    try { seen = sessionStorage.getItem(MAP_TOUCH_HINT_KEY); } catch (e) { /* yoksay */ }
    if (seen === '1') return;

    const hint = document.getElementById('map-touch-hint');
    if (!hint) return;
    try { sessionStorage.setItem(MAP_TOUCH_HINT_KEY, '1'); } catch (e) { /* yoksay */ }

    hint.classList.remove('fade');
    hint.classList.add('show');

    /* 2 saniye görünür, sonra 0.6s'lik yumuşak sönüşle kaybolur. */
    setTimeout(() => {
        hint.classList.remove('show');
        hint.classList.add('fade');
        setTimeout(() => hint.classList.remove('fade'), 640);
    }, 2000);
}

function initMapTouchHint() {
    const svg = document.getElementById('turkey-map-svg');
    if (!svg) return;
    /* Dinleyici KOŞULSUZ bağlanır, filtre olayın kendisindedir: yalnızca
       pointerType === 'touch' olan dokunuşlar uyarıyı tetikler. matchMedia
       ('hover: none') bazı gömülü tarayıcılarda yanlış negatif verdiği için
       cihaz tespitine güvenilmez — bu yol her ortamda doğru çalışır ve
       masaüstünde zaten hiç tetiklenmez. */
    svg.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') showMapTouchHint();
    }, { passive: true });
}

function initTheme() {
    const saved = localStorage.getItem('yaser_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
}

function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('yaser_theme', next);
    if(mapG) updateMapColors();
}

function loadCustomTheme() {
    const savedCustom = localStorage.getItem('yaser_v10_custom_theme');
    if (savedCustom) {
        customThemeVars = JSON.parse(savedCustom);
        Object.keys(customThemeVars).forEach(key => {
            document.documentElement.style.setProperty(key, customThemeVars[key]);
            
            const pickerId = 'picker-' + key.replace('--', '');
            const hexTextId = 'hex-' + key.replace('--', '');
            
            const pickerEl = document.getElementById(pickerId);
            const hexTextEl = document.getElementById(hexTextId);
            
            if (pickerEl && customThemeVars[key].startsWith('#')) { 
                pickerEl.value = customThemeVars[key]; 
            }
            if (hexTextEl) { 
                hexTextEl.innerText = customThemeVars[key]; 
            }
        });
    }
}

function updateThemeVariable(key, val) {
    document.documentElement.style.setProperty(key, val);
    customThemeVars[key] = val;
    localStorage.setItem('yaser_v10_custom_theme', JSON.stringify(customThemeVars));
    
    const hexTextId = 'hex-' + key.replace('--', '');
    const hexTextEl = document.getElementById(hexTextId);
    if (hexTextEl) {
        hexTextEl.innerText = val;
    }
    if (mapG) updateMapColors();
}

function resetCustomThemeToDefault() {
    customThemeVars = {};
    localStorage.removeItem('yaser_v10_custom_theme');
    location.reload();
}

/* --- SOL MENÜ: akıllı daralma + hover'da geçici açılma --------------------
   Üç durum:
     1) normal        -> menü sabit açık
     2) collapsed     -> menü daralmış, içerik sola kaymış, sol kenarda
                         ince trigger çubuğu var
     3) hover-open    -> durum 2 + menü içeriğin ÜZERİNE binerek açık
                         (layout SALLANMAZ; .main-wrapper margin-left'i
                         70px olarak kalır)
   Kalıcı durum localStorage'a yazılır (yaser_v10_sidebar_collapsed);
   hover durumu KAYDEDILMEZ çünkü geçicidir. */
const SIDEBAR_COLLAPSED_KEY = 'yaser_v10_sidebar_collapsed';
/* Menü daralınca harita yeniden çizilir: SVG genişliği değiştiği için
   eski ölçüde kalmış olurdu. Aynı nedenle toggleSidebar'da da vardı.

   ZAMANLAMA: Geçiş CSS'teki --transition-sidebar (0.4s) kadar sürüyor.
   Sabit bir süre yazmak yerine değişkenin kendisi okunur, böylece
   animasyon süresi değiştirilirse buradaki bekleme otomatik uyar ve
   harita geçiş ORTASINDA (yarım ölçüde) yeniden çizilmez. */
let _sidebarResizeTimer = null;
function sidebarTransitionMs() {
    const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--transition-sidebar').trim();
    const m = /^([0-9.]+)s$/.exec(raw);
    return m ? parseFloat(m[1]) * 1000 : 400;
}
function refreshSidebarAffectedViews() {
    if (_sidebarResizeTimer) clearTimeout(_sidebarResizeTimer);
    _sidebarResizeTimer = setTimeout(() => {
        _sidebarResizeTimer = null;
        if (activeView === 'home' && geojsonData) {
            renderD3Map();
        }
    }, sidebarTransitionMs() + 50);
}

function isSidebarCollapsed() {
    return document.body.classList.contains('sidebar-collapsed');
}

/* --- MOBİL / TABLET MENÜ YÖNETİMİ (≤1024px) --------------------------------
   CSS sınırı 1024px; JS tarafındaki eşik de aynı olmalı, yoksa düğme
   görünürken menü masaüstü mantığıyla çalışır ve iki katman birbirine karışır.

   KAPSAM DIŞI BIRAKILAN YER: localStorage. Masaüstünde kullanıcı menüyü
   daraltmışsa bu tercih silinmez; ama mobilde 240px'lik daraltma hiçbir
   şey kazandırmadığı gibi 390px'de içeriği kullanılamaz hâle getiriyordu.
   Mobilde menü durumu geçici (DOM) bilgidir, kalıcı tercih değil. */
const MOBILE_LAYOUT_MAX = 1024;

function isMobileLayout() {
    return window.innerWidth <= MOBILE_LAYOUT_MAX;
}

function isMobileNavOpen() {
    return document.body.classList.contains('mobile-nav-open');
}

function openMobileNav() {
    if (!isMobileLayout()) return;
    document.body.classList.add('mobile-nav-open');
    const btn = document.getElementById('mobile-nav-btn');
    if (btn) {
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Menüyü kapat');
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-xmark';
    }
}

function closeMobileNav() {
    if (!document.body.classList.contains('mobile-nav-open')) return;
    document.body.classList.remove('mobile-nav-open');
    const btn = document.getElementById('mobile-nav-btn');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Menüyü aç');
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars-staggered';
    }
}

function toggleMobileNav(event) {
    if (event) event.stopPropagation();
    if (isMobileNavOpen()) closeMobileNav();
    else openMobileNav();
}

/* Pencere genişliği eşiği geçtiğinde menüyü temizle: 1024px üstünde
   .mobile-nav-open kalırsa masaüstü menüsü yerinden oynamaz. */
function initMobileNav() {
    window.addEventListener('resize', () => {
        if (!isMobileLayout()) closeMobileNav();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMobileNavOpen()) closeMobileNav();
    });
}

/* Hover ile aç: menü KATMAN olarak açılır, sayfa düzeni değişmez. */
function openSidebarOnHover() {
    if (!isSidebarCollapsed()) return;   /* sabit modda hover geçersiz */
    document.body.classList.add('sidebar-hover-open');
    refreshSidebarAffectedViews();
}

/* Hover ile kapat: yalnızca geçici açılış sınıfını kaldırır; kalıcı
   collapsed durumu korunur. */
function closeSidebarHover() {
    if (!document.body.classList.contains('sidebar-hover-open')) return;
    document.body.classList.remove('sidebar-hover-open');
    refreshSidebarAffectedViews();
}

/* Ok butonuna (veya trigger çubuğuna) tıklama: daralt / sabitle.
   Hover sınıfı da temizlenir; aksi hâlde menü yeniden sabitlenmişken
   eski hover açılması ekranda kalırdı. */
function toggleSidebar() {
    /* Mobil/tablet ekranında bu düğme görünmez; menü hamburger ile yönetilir.
       Yanlışlıkla (ör. klavye odağıyla) çağrılırsa mobil modda hiçbir şey
       yapmaz — 240px daraltma mobil düzeni bozardı. */
    if (isMobileLayout()) { toggleMobileNav(); return; }
    document.body.classList.remove('sidebar-hover-open');
    const nowCollapsed = document.body.classList.toggle('sidebar-collapsed');
    try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, nowCollapsed ? 'true' : 'false');
    } catch (e) { /* private mod: sessizce geç, varsayılan açık kalsın */ }
    refreshSidebarAffectedViews();
}

/* Sayfa açılışında kayıtlı durumu geri yükle. */
function restoreSidebarState() {
    let saved = null;
    try { saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY); } catch (e) { /* yoksay */ }
    if (saved === 'true') document.body.classList.add('sidebar-collapsed');
    if (saved === 'false') document.body.classList.remove('sidebar-collapsed');
}

/* Fare olaylarını bağla. Kayan menüde olay dinleyicilerinin kayması
   sorun değil: menü fiziksel olarak 240px genişliğe animasyonla büyür,
   ama DOM sabittir. Yine de "raf ömrü" (hover grace) eklenir: menü
   açıldıktan sonra kısa süre içinde çıkıldığında hemen kapanmaz, çünkü
   fare çubuk -> menü geçişinde 1-2px'lik boşluğa takılabilir. */
let _sidebarHoverGraceTimer = null;
function bindSidebarHover() {
    const sidebar = document.getElementById('sidebar');
    const trigger = document.getElementById('sidebar-edge-trigger');
    if (!sidebar || !trigger) return;

    trigger.addEventListener('mouseenter', () => {
        if (_sidebarHoverGraceTimer) { clearTimeout(_sidebarHoverGraceTimer); _sidebarHoverGraceTimer = null; }
        openSidebarOnHover();
    });
    /* Çubuktan çıkarken menü henüz açılmadıysa (veya zaten kapandıysa)
       kapatma; grace süresi biter. Menü açıldıysa hemen kapat. */
    trigger.addEventListener('mouseleave', () => {
        if (!document.body.classList.contains('sidebar-hover-open')) return;
        _sidebarHoverGraceTimer = setTimeout(closeSidebarHover, 90);
    });

    sidebar.addEventListener('mouseenter', () => {
        if (_sidebarHoverGraceTimer) { clearTimeout(_sidebarHoverGraceTimer); _sidebarHoverGraceTimer = null; }
        /* Sabit (pinned) modda menü zaten açık; sınıf eklemek bir şey
           değiştirmez ama hover-open'ı da temiz tutar. */
        if (isSidebarCollapsed()) openSidebarOnHover();
    });
    sidebar.addEventListener('mouseleave', () => {
        if (!isSidebarCollapsed()) return;     /* sabit mod: dokunma */
        _sidebarHoverGraceTimer = setTimeout(closeSidebarHover, 90);
    });

    /* Klavye erişilebilirliği: trigger çubuğu odaklanınca Enter/Space ile
       menü açılır, Escape ile kapatılır. */
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSidebar();
        } else if (e.key === 'Escape') {
            closeSidebarHover();
        }
    });
    /* Dokunmatik/tablet: trigger'a dokununca menü açılıp dokunma dışına
       çıkınca kapansın. Fare mantığının dokunmatik karşılığı. */
    trigger.addEventListener('touchstart', () => openSidebarOnHover(), { passive: true });
    sidebar.addEventListener('touchend', () => { if (isSidebarCollapsed()) closeSidebarHover(); }, { passive: true });
}

function handleOverlayClick(event, modalId) {
    if (event.target.id === modalId) { document.getElementById(modalId).classList.remove('active'); }
}

function sortAlphabetically(arr) {
    return (arr || []).slice().sort((a, b) => {
        const strA = String(a).trim();
        const strB = String(b).trim();
        const isPriorityA = strA === '-' || strA === '_' || strA.startsWith('-') || strA.startsWith('_');
        const isPriorityB = strB === '-' || strB === '_' || strB.startsWith('-') || strB.startsWith('_');
        
        if (isPriorityA && !isPriorityB) return -1;
        if (!isPriorityA && isPriorityB) return 1;
        
        return strA.localeCompare(strB, 'tr', { sensitivity: 'base' });
    });
}

/* AWWWARDS YARDIMCI — Mevcut render çıktılarını bozmadan stagger için
   yalnızca --i CSS değişkeni atar. Veri, state, localStorage akışına dokunmaz.
   Hem tek bir Element hem de NodeList (örn. .querySelectorAll) kabul eder;
   NodeList durumunda her bir node'un .children'ı işlenir. */
function _applyStaggerIndex(container, maxItems) {
    if (!container) return;
    const cap = Math.max(1, maxItems || 15);
    const nodes = (container instanceof NodeList || container instanceof Array)
        ? container
        : [container];
    for (const node of nodes) {
        if (!node || !node.children) continue;
        const children = node.children;
        for (let i = 0; i < children.length && i < cap; i++) {
            children[i].style.setProperty('--i', i);
        }
    }
}

/* Bir modal açıldığında gövdesindeki alanlara sıra numarası verir.
   Animasyon yalnızca İLK açılışta oynar: aynı modal ikinci kez açıldığında
   --i değerleri zaten durduğu için animasyon yeniden tetiklenmez.
   Kullanıcı modalı hızla açıp kapatıp yeniden açarsa sıra eski kaldığı için
   alanlar anında görünür kalır (istenen davranış: her açılışta bekleme yok). */
function _staggerModalBody(modalId) {
    const body = document.querySelector('#' + modalId + ' .modal-stagger');
    if (!body) return;
    if (body.dataset.staggered === '1') return;
    body.dataset.staggered = '1';
    _applyStaggerIndex(body, 12);
}

/* ==========================================================================
   UYGULAMA İÇİ / UÇTAN UCA ŞİFRELEME — AES-256-GCM (Web Crypto API)
   --------------------------------------------------------------------------
   MİMARİ
     · Anahtar türetme : PBKDF2-SHA256, 100.000 iterasyon → 256-bit "root" bit
       dizisi. TÜRETME YALNIZCA RAM'de tutulan bu diziden yapılır.
     · Anahtar ayrımı   : Her kayıt için rastgele 16 bayt salt üretilir ve
       HKDF-SHA256 ile o kayda özel AES-GCM anahtarı türetilir. Böylece her
       şifreleme işleminde hem SALT hem IV (12 bayt) rastgeledir, ama
       100k iterasyon her tuş vuruşunda tekrarlanmaz.
     · Doğrulama        : 'yaser_v10_zk_check' kaydı sabit bir metni şifreler.
       AES-GCM'in kimlik doğrulama etiketi (auth tag) yanlış parolada çözmeyi
       reddeder → "Hatalı Parola" ayrımı kriptografik olarak kesindir.
     · Zero-knowledge   : Parola ve türetilmiş anahtarlar yalnızca session
       RAM'inde tutulur. localStorage'a DÜZ METİN olarak hiçbir şey yazılmaz;
       oraya yalnızca 'zk:v1:salt.iv.ciphertext' yazan kayıtlar çıkar.
     · Geçiş (migrate) : Şifreleme ilk kez kurulurken diskte hâlâ düz metin
       bulunan eski kayıtlar otomatik olarak şifreli biçime çevrilir.
   ========================================================================== */
const ZK_META_KEY   = 'yaser_v10_zk_meta';
const ZK_CHECK_KEY  = 'yaser_v10_zk_check';
const ZK_PREFIX     = 'zk:v1:';
const ZK_PBKDF2_ITERS = 100000;
const ZK_RECORD_INFO = 'yaser-v10-aesgcm';
const ZK_EXPORT_INFO = 'yaser-v10-export';
const ZK_CHECK_TEXT  = 'YASER-ZK-OK-V1';

/* Şifrelenecek veri anahtarları. Sunum/oturum anahtarları (tema, ekran
   koruyucu, geri sayım, gece devri damgası) bilinçli olarak listede yok:
   onlar veri değil, sunum tercihidir. */
const ZK_DATA_KEYS = new Set([
    'yaser_v10_jobs', 'yaser_v10_active_jobs', 'yaser_v10_notes', 'yaser_v10_note_topics',
    'yaser_v10_note_boards_cleared', 'yaser_v10_tasks', 'yaser_v10_files',
    'yaser_v10_quick_notes', 'yaser_v10_sticky_notes', 'yaser_v10_weekly_goal',
    'yaser_v10_settings', 'yaser_v10_header_titles',
    'yaser_v10_custom_list_columns', 'yaser_v10_dash_layout', 'yaser_v10_profile'
]);

/* --- RAM durumu (parola ve anahtarlar yalnızca burada) ---------------------- */
let zkRootBits = null;                      // Uint8Array(32) — oturum anahtarı
let zkPlainCache = new Map();               // key -> düz metin (RAM)
const _zkWriteChains = new Map();           // key -> Promise (yazma sırası)
const zkCipherCache = new Map();            // key -> son yazılan şifreli metin
let zkUnlockPending = null;                 // kilit açılınca çalışacak callback
let zkMode = 'unlock';                      // 'unlock' | 'setup'

function zkB64(buf) {
    const b = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
}
function zkUnB64(str) {
    const s = atob(str);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
}
function zkRandomB64(len) {
    const b = new Uint8Array(len);
    crypto.getRandomValues(b);
    return zkB64(b);
}
function zkCryptoAvailable() {
    return !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues);
}
function zkHasVault() {
    try { return !!localStorage.getItem(ZK_META_KEY); } catch (e) { return false; }
}

/* Parola + salt → 256-bit root bit dizisi (asla diske yazılmaz). */
async function zkDeriveRootBits(password, saltB64) {
    const base = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: zkUnB64(saltB64), iterations: ZK_PBKDF2_ITERS, hash: 'SHA-256' },
        base, 256);
    return new Uint8Array(bits);
}

/* Root bitlerinden, kayda özel rastgele salt ile AES-GCM anahtarı. */
async function zkRecordKey(rootBits, saltB64, info) {
    const hk = await crypto.subtle.importKey('raw', rootBits, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: zkUnB64(saltB64), info: new TextEncoder().encode(info) },
        hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function zkEncryptString(rootBits, plaintext, info) {
    const salt = zkRandomB64(16);
    const iv = zkRandomB64(12);
    const key = await zkRecordKey(rootBits, salt, info);
    const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: zkUnB64(iv) }, key, new TextEncoder().encode(String(plaintext)));
    return ZK_PREFIX + salt + '.' + iv + '.' + zkB64(ct);
}

/* Hatalı parola / bozuk kayıt BURADA istisna atar (AES-GCM auth tag). */
async function zkDecryptString(rootBits, blob, info) {
    if (typeof blob !== 'string' || blob.indexOf(ZK_PREFIX) !== 0) throw new Error('zk:not-encrypted');
    const parts = blob.slice(ZK_PREFIX.length).split('.');
    if (parts.length !== 3) throw new Error('zk:bad-record');
    const key = await zkRecordKey(rootBits, parts[0], info);
    const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: zkUnB64(parts[1]) }, key, zkUnB64(parts[2]));
    return new TextDecoder().decode(plain);
}
/* --- depo erişimi ---------------------------------------------------------
   Uygulamadaki tüm veri okumaları _zkRead() üzerinden, tüm veri yazmaları
   _zkWrite() üzerinden geçer. Yazma asenkron olduğu için aynı anahtar için
   işlemler bir Promise zincirinde SIRA ile yürütülür; böylece hızlı art arda
   kaydetmelerde yeni bir şifreli metin eskisinin üstüne yazılmaz. */
function _zkRead(key) {
    return zkPlainCache.has(key) ? zkPlainCache.get(key) : null;
}

function _zkWrite(key, value) {
    const text = String(value);
    zkPlainCache.set(key, text);
    /* ÇALIŞMA MODU: kasa yok (public veya purge edilmiş private oturum)
       → şifresiz yerel depoya yaz; aksi hâlde RAM dışında hiç kalıcı iz
       oluşmaz ve sayfa yenilenince veriler kaybolurdu. wmPlainWrite, şifreli
       kasa varken yazımı engeller (kasa korunur). */
    if (!zkRootBits) {
        if (typeof wmPlainWrite === 'function') wmPlainWrite(key, text);
        else { try { localStorage.setItem(key, text); } catch (e) { /* yoksay */ } }
        return Promise.resolve();
    }
    const prev = _zkWriteChains.get(key) || Promise.resolve();
    const next = prev.then(async () => {
        if (!zkRootBits) return;   /* kilitliyken düz metin ASLA yazılmaz */
        const cipher = await zkEncryptString(zkRootBits, text, ZK_RECORD_INFO);
        localStorage.setItem(key, cipher);
        zkCipherCache.set(key, cipher);
    }).catch(err => {
        console.warn('[zk] Şifreli yazma başarısız (' + key + '):', err);
    });
    _zkWriteChains.set(key, next);
    return next;
}

function _zkRemove(key) {
    zkPlainCache.delete(key);
    zkCipherCache.delete(key);
    const prev = _zkWriteChains.get(key) || Promise.resolve();
    _zkWriteChains.set(key, prev.then(() => { try { localStorage.removeItem(key); } catch (e) {} }).catch(() => {}));
}

/* Diskteki kayıtları çözer; şifresiz (eski) kayıtlar olduğu gibi cache'e
   alınır ve migrate=true ise şifreli biçime yeniden yazılır. */
async function zkFillPlainCache(rootBits, migrate) {
    const cache = new Map();
    for (const key of ZK_DATA_KEYS) {
        let raw = null;
        try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
        if (raw === null || raw === undefined) continue;
        if (raw.indexOf(ZK_PREFIX) === 0) {
            try {
                cache.set(key, await zkDecryptString(rootBits, raw, ZK_RECORD_INFO));
            } catch (err) {
                throw new Error('zk:undecryptable');
            }
        } else {
            cache.set(key, raw);
        }
    }
    zkPlainCache = cache;
    /* Parola değiştirme akışı bu HARİTAYI döndürür: yeniden şifreleme
       diski tekrar okumak yerine bu anlık görüntü üzerinden yapılır. */
    if (migrate) {
        for (const key of ZK_DATA_KEYS) {
            if (!cache.has(key)) continue;
            _zkWrite(key, cache.get(key));
        }
    }
    return cache;
}

/* Çoklu sekme: başka sekmede yazılan şifreli metni çözüp cache'i tazeler.
   Çözülemezse (başka sekmede FARKLI master parola kullanılmışsa) veri
   sessizce değiştirilmez; uyarı verilir. */
async function zkRefreshPlainCache() {
    if (!zkRootBits) return false;
    try {
        await zkFillPlainCache(zkRootBits, false);
        return true;
    } catch (err) {
        console.warn('[zk] Çapraz sekme kaydı çözülemedi:', err);
        return false;
    }
}

/* --- KİLİT EKRANI (DOM + akış) -------------------------------------------
   Modal, mevcut cam temasının değişkenlerini kullanır; yeni tema değeri
   tanımlanmaz. id'ler yalnızca zk- ön ekli ve YENİDİR: mevcut DOM ID'leri
   ile çakışmaz. */
function zkEls() {
    return {
        overlay: document.getElementById('zk-lock-overlay'),
        form:    document.getElementById('zk-lock-form'),
        pw:      document.getElementById('zk-lock-password'),
        pw2:     document.getElementById('zk-lock-password2'),
        confirm: document.getElementById('zk-lock-confirm-field'),
        error:   document.getElementById('zk-lock-error'),
        submit:  document.getElementById('zk-lock-submit'),
        submitTx:document.getElementById('zk-lock-submit-text'),
        title:   document.getElementById('zk-lock-title'),
        desc:    document.getElementById('zk-lock-desc')
    };
}

function zkShowLock(mode) {
    const el = zkEls();
    if (!el.overlay) return;
    zkMode = mode || (zkHasVault() ? 'unlock' : 'setup');
    const isSetup = zkMode === 'setup';

    if (el.title) el.title.textContent = isSetup ? 'Master Parola Belirle' : 'Uygulama Kilidi';
    if (el.desc) el.desc.innerHTML = isSetup
        ? 'Verilerinizin şifrelenebilmesi için bir <b>Master Parola</b> belirleyin. ' +
          'Bir kez girmeniz yeterli: anahtar bu cihaza <b>şifreli</b> olarak kaydedilir ve ' +
          'sonraki açılışlarda sorulmaz. Üst bardaki <b>Kilitle</b> düğmesi otomatik açmayı kapatır.'
        : 'Verileriniz bu tarayıcıda <b>AES-256-GCM</b> ile şifrelenerek saklanır. ' +
          'Bu cihazda otomatik açma kapalı; devam etmek için Master Parola gerekir.';
    if (el.submitTx) el.submitTx.textContent = isSetup ? 'Parolayı Kur ve Başla' : 'Kilidi Aç';
    if (el.confirm) el.confirm.style.display = isSetup ? 'flex' : 'none';
    if (el.pw2) el.pw2.value = '';
    if (el.error) el.error.textContent = '';
    if (el.pw) el.pw.value = '';

    el.overlay.style.opacity = '1';
    el.overlay.style.pointerEvents = 'auto';
    el.overlay.setAttribute('aria-hidden', 'false');
    el.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    /* Açılış ekranı (#splash-screen, z-index 99999) henüz ÇALIŞMADI: onu
       başlatan startSplashLoader() ancak parola girilince çağrılır. Yani
       ekran donuk durur ve parolanın yazıldığı boş bir mavi kutu olarak
       ekranda kalır. Kilit açılana kadar onu gizliyoruz: hem yanıltıcı
       olmaktan çıkar, hem de kilit zaten kendi cam yüzeyini gösterir. */
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('hidden')) splash.style.opacity = '0';

    setTimeout(() => { if (el.pw) el.pw.focus(); }, 60);
}

function zkHideLock() {
    const el = zkEls();
    if (!el.overlay) return;
    el.overlay.classList.remove('active');
    el.overlay.style.opacity = '0';
    el.overlay.style.pointerEvents = 'none';
    el.overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    /* Kilit kapandı: açılış ekranı artık startSplashLoader() tarafından
       sürüleceği için görünürlüğünü geri veriyoruz. zkShowLock() yalnızca
       İLK açılışta onu gizliyordu; yeniden kilitlemede zaten gizliydi. */
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('hidden')) splash.style.opacity = '';

    /* Parola alanları RAM'de kalmasın diye boşaltılır. */
    if (el.pw) el.pw.value = '';
    if (el.pw2) el.pw2.value = '';
}

function zkLockError(msg) {
    const el = zkEls();
    if (el.error) el.error.textContent = msg;
    if (el.pw) { el.pw.value = ''; el.pw.focus(); }
    const card = document.getElementById('zk-lock-card');
    if (!card || typeof card.animate !== 'function') return;
    card.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' },
         { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' },
         { transform: 'translateX(0)' }],
        { duration: 260, easing: 'ease-in-out' }
    );
}

/* Kurulum: parolayı doğrular, salt + meta üretir, kontrol kaydını yazar ve
   diskteki DÜZ METİN eski kayıtları şifreli biçime çevirir (migrate). */
async function zkSetupVault(password) {
    const salt = zkRandomB64(16);
    const rootBits = await zkDeriveRootBits(password, salt);
    zkRootBits = rootBits;

    await zkFillPlainCache(rootBits, true);

    const check = await zkEncryptString(rootBits, ZK_CHECK_TEXT, ZK_RECORD_INFO);
    localStorage.setItem(ZK_CHECK_KEY, check);
    localStorage.setItem(ZK_META_KEY, JSON.stringify({
        v: 1, algo: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iters: ZK_PBKDF2_ITERS,
        salt: salt, created: new Date().toISOString()
    }));

    /* Bu cihazda bir daha sorulmasın: otomatik açma kimliği yazılır. */
    await zkArmAutoUnlock(rootBits);
}

/* Kilit açma: paroladan anahtar türetilir ve kontrol kaydı çözülür. AES-GCM
   doğrulaması başarısızsa HİÇBİR veri okunmaz → "Hatalı Parola". */
async function zkUnlockVault(password) {
    let meta;
    try { meta = JSON.parse(localStorage.getItem(ZK_META_KEY)); } catch (e) { meta = null; }
    if (!meta || !meta.salt) throw new Error('zk:no-vault');

    const rootBits = await zkDeriveRootBits(password, meta.salt);
    const check = localStorage.getItem(ZK_CHECK_KEY);
    if (!check) throw new Error('zk:no-check');

    /* AES-GCM doğrulaması başarısızsa tarayıcı OperationError fırlatır. Bu
       bizim "hatalı parola" durumumuz; kullanıcıya görünmeyen ham mesajı
       (OperationError) kendi kodumuzla değiştiriyoruz. */
    try {
        await zkDecryptString(rootBits, check, ZK_RECORD_INFO);
    } catch (e) {
        throw new Error('zk:wrong-password');
    }

    zkRootBits = rootBits;
    await zkFillPlainCache(rootBits, false);
    /* Bu cihazda bir daha sorulmasın: otomatik açma kimliği (tazelenerek) yazılır. */
    await zkArmAutoUnlock(rootBits);
}

/* ==========================================================================
   OTOMATİK AÇILIŞ ("BU CİHAZDA BENİ HATIRLA")
   --------------------------------------------------------------------------
   Amaç: master parola bir kez girildikten sonra aynı tarayıcıda uygulama
   her açılışta TEKRAR SORULMASIN. Veri hâlâ AES-256-GCM ile şifreli durur.

   Nasıl çalışır: kilit her açıldığında rootBits, IndexedDB'de tutulan
   CİHAZ ANAHTARI ile şifrelenip localStorage'a yazılır (ZK_AUTO_KEY).
   Cihaz anahtarını tarayıcı non-extractable üretir: ham bitleri asla
   JavaScript'e/disk verilmez, yalnızca bu tarayıcı profili içinde
   çözme/şifreleme için kullanılabilir. Açılışta kayıt çözülür ve sonuç
   ZK_CHECK_KEY kontrol kaydıyla DOĞRULANIR — parola akışındaki ile aynı
   kriptografik güvence; yanlış/bozuk kimlik sessizce düşürülür.

   Sınırları (bilinçli kabul): aynı bilgisayarda aynı tarayıcı profiline
   erişebilen biri otomatik açılan oturumu kullanabilir. Tam koruma için
   üst bardaki "Kilitle" düğmesi kimliği siler; sonraki açılış yine
   parola sorar. IndexedDB silinir/kullanılamaz olursa yine parola
   ekranına dönülür, hiçbir veri etkilenmez.
   ========================================================================== */
const ZK_AUTO_KEY = 'yaser_v10_zk_autologin';

function zkAutoUnlockArmed() {
    try { return !!localStorage.getItem(ZK_AUTO_KEY); } catch (e) { return false; }
}

function zkIdbOpen() {
    return new Promise(function (resolve, reject) {
        if (!window.indexedDB) { reject(new Error('zk:no-idb')); return; }
        const req = indexedDB.open('yaser_zk', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('keys'); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error('zk:idb-open')); };
        req.onblocked = function () { reject(new Error('zk:idb-blocked')); };
    });
}
function zkIdbGet(db) {
    return new Promise(function (resolve, reject) {
        const rq = db.transaction('keys', 'readonly').objectStore('keys').get('device-key');
        rq.onsuccess = function () { resolve(rq.result || null); };
        rq.onerror = function () { reject(rq.error || new Error('zk:idb-get')); };
    });
}
function zkIdbPut(db, val) {
    return new Promise(function (resolve, reject) {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put(val, 'device-key');
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('zk:idb-put')); };
    });
}

/* Cihaz anahtarı: non-extractable AES-GCM anahtarı, yalnızca IndexedDB'de yaşar. */
async function zkGetDeviceKey() {
    const db = await zkIdbOpen();
    try {
        let key = await zkIdbGet(db);
        if (!key) {
            key = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            await zkIdbPut(db, key);
        }
        return key;
    } finally {
        try { db.close(); } catch (e) { /* yoksay */ }
    }
}

/* rootBits'i cihaz anahtarıyla sarıp diske yazar. Herhangi bir adım
   başarısız olursa kimlik sessizce düşürülür → kullanıcı parolayla açar. */
async function zkArmAutoUnlock(rootBits) {
    try {
        const devKey = await zkGetDeviceKey();
        const iv = zkRandomB64(12);
        const ct = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: zkUnB64(iv) }, devKey, rootBits);
        localStorage.setItem(ZK_AUTO_KEY, JSON.stringify({ v: 1, iv: iv, data: zkB64(ct) }));
    } catch (e) {
        try { localStorage.removeItem(ZK_AUTO_KEY); } catch (e2) { /* yoksay */ }
    }
}

/* Açılışta otomatik açmayı dener. Başarılıysa oturumu açar ve true döner;
   kimlik yoksa/çözülemezse false döner (çağıran parola ekranını gösterir). */
async function zkTryAutoUnlock() {
    let blob = null;
    try { blob = JSON.parse(localStorage.getItem(ZK_AUTO_KEY)); } catch (e) { blob = null; }
    if (!blob || blob.v !== 1 || !blob.iv || !blob.data) return false;
    try {
        const devKey = await zkGetDeviceKey();
        const bits = new Uint8Array(await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: zkUnB64(blob.iv) }, devKey, zkUnB64(blob.data)));
        /* Kriptografik doğrulama: bu bitler gerçekten doğru anahtar mı? */
        const check = localStorage.getItem(ZK_CHECK_KEY);
        if (!check) return false;
        await zkDecryptString(bits, check, ZK_RECORD_INFO);
        zkRootBits = bits;
        await zkFillPlainCache(bits, false);
        return true;
    } catch (e) {
        /* Cihaz anahtarı yeniden üretilmiş / kayıt bozuk: kimliği düşür,
           oturum izlerini de temizle ve parola ekranına bırak. */
        zkRootBits = null;
        zkPlainCache = new Map();
        try { localStorage.removeItem(ZK_AUTO_KEY); } catch (e2) { /* yoksay */ }
        return false;
    }
}

/* Kullanıcının "Kilitle" isteği: RAM'deki anahtar ve düz metinler düşürülür.
   Yazma zincirleri beklenmez; kilitliyken _zkWrite zaten diske yazmaz. */
function lockApp() {
    try { if (typeof saveAllData === 'function' && zkRootBits) saveAllData(); } catch (e) { /* yoksay */ }
    zkRootBits = null;
    zkPlainCache = new Map();
    zkCipherCache.clear();
    /* Elle kilitlendi: cihazdaki otomatik açma kimliği de düşürülmeli, yoksa
       kilit sonraki açılışta kendiliğinden açılırdı. Kullanıcı parolayı bir
       kez daha girdiğinde kimlik yeniden yazılır. */
    try { localStorage.removeItem(ZK_AUTO_KEY); } catch (e) { /* yoksay */ }
    zkShowLock('unlock');
}

/* Uygulama açılışı: Web Crypto yoksa şifreleme YOK sayılır ve uygulama
   eskisi gibi açılır (konsola uyarı düşer) — kullanıcı kilitlenmez.
   Kasa varsa ÖNCE bu cihazdaki otomatik açma kimliği denenir; yalnızca

/* ==========================================================================
   ÇALIŞMA MODU DEPOSU — PUBLIC İÇİN ŞİFRESİZ YEREL KATMAN
   --------------------------------------------------------------------------
   Public (yerel) mod parola sormadan çalıştığı için ZK kilit ekranı bu modda
   gösterilmez. Yerel depo iki biçimde olabilir:

   · ŞİFRELİ (eski ZK kasası): kayıtlar zk1v1. ön eki taşır ve parolasız
     okunamaz. Bu kayıtların üzerine şifresiz yazı yazmak veriyi yok edeceği
     için wmPlainWrite KASAYI KORUR: kasa kayıtlıyken hiç yazmaz.
   · ŞİFRESİZ (public yerel depo): anahtarlar düz JSON/metin. Public mod
     burada çalışır; kasa bir kez göç edildikten sonra Private mod da aynı
     havuzu kullanır (bulut = Upstash, yerel = bu depo).

   Açılışta zkBootWorkModeGate() karar verir: kasa yoksa parolasız açılır;
   kasa varsa otomatik açma mümkünse veriler BİR KEZ şifresiz depoya göç
   ettirilir (kasa düşürülür), mümkün değilse eski parola ekranı gösterilir.
   ========================================================================== */

const ZK_PREFIX_LOCAL = 'zk1v1.';   /* ZK kayıt ön eki (yerel kopya) */

/* Bu cihazda şifreli kasa kurulu mu? */
function wmHasEncryptedVault() {
    try { return !!localStorage.getItem(ZK_META_KEY); } catch (e) { return false; }
}

/* Şifresiz depoda en az bir veri anahtarı var mı? */
function wmHasPlainData() {
    try {
        for (const key of ZK_DATA_KEYS) {
            if (localStorage.getItem(key) !== null) return true;
        }
    } catch (e) { /* yoksay */ }
    return false;
}

/* Public mod yerel yazması. Şifreli kasa varken ASLA yazmaz (kasa korunur). */
function wmPlainWrite(key, text) {
    if (wmHasEncryptedVault()) return;
    try { localStorage.setItem(key, String(text)); } catch (e) { /* yoksay */ }
}

/* Public mod yerel okuması: yalnızca şifresiz kayıtlar. */
function wmPlainRead(key) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null || String(raw).indexOf(ZK_PREFIX_LOCAL) === 0) return null;
        return raw;
    } catch (e) { return null; }
}

/* Şifresiz depoyu RAM önbelleğine doldurur (public mod veri kaynağı). */
function wmFillPublicCache() {
    const cache = new Map();
    for (const key of ZK_DATA_KEYS) {
        cache.set(key, wmPlainRead(key));
    }
    return cache;
}

/* Oturum göçü: otomatik açılmış (zkPlainCache dolu) bir kasadaki TÜM düz
   metinler şifresiz depoya yazılır, ardından kasa kayıtları düşürülür.
   Böylece sonraki açılışlar parolasız devam eder; veri kaybı olmaz. */
function wmMigrateVaultToPublicFromSession() {
    try {
        zkPlainCache.forEach(function (value, key) {
            try { localStorage.setItem(key, String(value)); } catch (e) { /* yoksay */ }
        });
        try { localStorage.removeItem(ZK_META_KEY); } catch (e) { /* yoksay */ }
        try { localStorage.removeItem(ZK_CHECK_KEY); } catch (e) { /* yoksay */ }
        try { localStorage.removeItem(ZK_AUTO_KEY); } catch (e) { /* yoksay */ }
        zkRootBits = null;
        return Promise.resolve(true);
    } catch (e) {
        return Promise.resolve(false);
    }
}

/* zkBoot'un ÇALIŞMA MODU kapısı: public modda kilit ekranını atlar.
   · Kasa yok → şifresiz depoyu cache'e doldur, parolasız aç.
   · Kasa var + otomatik açma → bir kez şifresiz depoya göç et, parolasız aç.
   · Kasa var, otomatik açma yok → eski parola ekranı (legacy yol). */
function zkBootWorkModeGate() {
    if (!wmHasEncryptedVault()) {
        zkPlainCache = wmFillPublicCache();
        return Promise.resolve();
    }
    return zkTryAutoUnlock().then(function (unlocked) {
        if (unlocked) {
            return wmMigrateVaultToPublicFromSession().then(function () {
                zkPlainCache = wmFillPublicCache();
            });
        }
        zkShowLock('unlock');
        const el = zkEls();
        if (!el.form) return;
        return zkWaitUnlockForm();
    });
}


function zkBoot() {
    const el = zkEls();
    if (!zkCryptoAvailable()) {
        console.warn('[zk] Bu tarayıcı Web Crypto API sunmuyor; şifreleme kapalı.');
        return Promise.resolve();
    }

    /* İlk kurulum: kasa yok → doğrudan parola belirleme ekranı. */
    if (!zkHasVault()) {
        zkShowLock('setup');
        if (!el.form) return Promise.resolve();
        return zkWaitUnlockForm();
    }

    /* Kasa var: otomatik açma denenir; olmadıysa klasik parola ekranı. */
    return zkTryAutoUnlock().then(function (unlocked) {
        if (unlocked) return;
        zkShowLock('unlock');
        if (!el.form) return;
        return zkWaitUnlockForm();
    });
}

/* Parola formunun submit'ini bekler; kilit açılınca çözülür. (Eski zkBoot
   gövdesi, davranış birebir korunarak otomatik açma yolu için ayrıldı.) */
function zkWaitUnlockForm() {
    const el = zkEls();
    return new Promise(function (resolve) {
        let settled = false;
        const done = function () {
            if (settled) return;
            settled = true;
            zkHideLock();
            const pending = zkUnlockPending; zkUnlockPending = null;
            if (typeof pending === 'function') { try { pending(); } catch (e) { /* yoksay */ } }
            resolve();
        };
        zkUnlockPending = done;

        el.form.addEventListener('submit', async function (ev) {
            ev.preventDefault();
            const pass = (el.pw && el.pw.value) || '';
            if (!pass) { zkLockError('Lütfen Master Parola girin.'); return; }
            if (el.submit) el.submit.disabled = true;
            const isSetup = zkMode === 'setup';
            if (el.error) el.error.textContent = isSetup ? 'Parola türetiliyor…' : 'Şifre çözülüyor…';
            try {
                if (isSetup) {
                    if (pass.length < 6) throw new Error('zk:short');
                    if (!el.pw2 || el.pw2.value !== pass) throw new Error('zk:mismatch');
                    await zkSetupVault(pass);
                } else {
                    await zkUnlockVault(pass);
                }
                /* done() yalnızca İLK açılışta kilit ekranını kapatır (o
                   anda çözülmüş bir Promise vardır). Yeniden kilitleyip
                   kilidi açtığımızda söz çözülmüş olduğundan ekranı doğrudan
                   kapatmamız gerekir. */
                zkHideLock();
                done();
            } catch (err) {
                zkRootBits = null;
                const msg = (err && err.message) || '';
                if (msg === 'zk:short') zkLockError('Parola en az 6 karakter olmalı.');
                else if (msg === 'zk:mismatch') zkLockError('Parolalar eşleşmiyor.');
                else if (msg === 'zk:no-vault' || msg === 'zk:no-check') zkLockError('Kasa kaydı bozuk görünüyor.');
                else zkLockError('Hatalı Parola.');
            } finally {
                if (el.submit) el.submit.disabled = false;
            }
        });
    });
}
/* ==========================================================================
   MASTER PAROLA YÖNETİMİ — değiştirme, güç ölçümü, kilitleme
   --------------------------------------------------------------------------
   Parola değiştirmenin tek güvenli yolu şudur: TÜM kayıtları eski anahtarla
   çöz, hepsini RAM'de tut, hepsini yeni anahtarla yeniden şifrele. Kısmi
   bir değişim, bazı kayıtların eski bazılarının yeni parolayla şifreli
   kalmasına ve verinin kalıcı olarak okunamaz hâle gelmesine yol açar.

   Bu yüzden akış "önce diske dokunma" ilkesiyle çalışır:
     1. Mevcut parola doğrulanır (kontrol kaydı çözülerek).
     2. Yeni parola + yeni salt ile yeni kök anahtar türetilir.
     3. Eski anahtarla çözülmüş RAM cache'i yeni anahtarla YENİDEN yazılır.
     4. En son meta ve kontrol kaydı değiştirilir.
   Adım 3 başarısız olursa adım 4 hiç çalışmaz → kasa tutarlı kalır.
   ========================================================================== */

/* Parola gücünü 0-4 arası bir puana çevirir. Bu bir entropi ölçümü değil,
   bilgilendirici bir tahmindir; amacı kullanıcıyı zayıf seçimden
   alıkoyup 8+ karakterli karma parolaya yönlendirmektir. */
function zkPasswordScore(pw) {
    const p = String(pw || '');
    if (!p) return { score: 0, label: '—', color: 'var(--txt-muted)', hint: 'En az 6 karakter; büyük/küçük harf, rakam ve simge karışımı gücü artırır.' };
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[a-zçğıöşü]/.test(p) && /[A-ZÇĞİÖŞÜ]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(p)) score++;
    /* Uzun ama tek türden parolaya (ör. "aaaaaaaa") tam puan verme. */
    if (score >= 4 && !(/[a-zçğıöşü]/i.test(p) && /[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p))) score = 3;
    /* Beş ölçüt de tutarsa 4'ü aşamaz — map dizisi 0..4 arasında. */
    if (score > 4) score = 4;

    const map = [
        { label: 'Çok zayıf', color: 'var(--color-rose)', hint: 'Tek türden karakterlerden oluşuyor; kolayca tahmin edilir.' },
        { label: 'Zayıf',      color: 'var(--color-rose)', hint: 'En az 6 karakter ve birkaç farklı türde karakter içeriyor.' },
        { label: 'Orta',       color: 'var(--color-amber)', hint: 'Daha uzun ve karışık bir parola seçin.' },
        { label: 'İyi',        color: 'var(--color-primary)', hint: 'Güçlü. Yine de bir parola kasasında saklayın.' },
        { label: 'Çok iyi',    color: 'var(--color-emerald)', hint: 'Güçlü bir parola. Not aldığınızdan emin olun.' }
    ];
    return { score: score, label: map[score].label, color: map[score].color, hint: map[score].hint };
}

/* Güç çubuğunu canlı güncelle (yeni parola alanına yazarken). */
function updateZkStrengthMeter() {
    const input = document.getElementById('zk-new-password');
    const bar = document.getElementById('zk-strength-bar');
    const label = document.getElementById('zk-strength-label');
    const hint = document.getElementById('zk-strength-hint');
    if (!input || !bar || !label) return;

    const r = zkPasswordScore(input.value);
    bar.style.width = (r.score / 4 * 100) + '%';
    bar.style.background = r.color;
    label.textContent = r.score === 0 ? '—' : r.label;
    label.style.color = r.color;
    if (hint) hint.textContent = r.hint;
}

/* Güvenlik sekmesi açıldığında kasa durumunu gösterir. */
function loadSecuritySettingsForm() {
    const title = document.getElementById('zk-status-title');
    const detail = document.getElementById('zk-status-detail');
    const icon = document.getElementById('zk-status-icon');
    const cur = document.getElementById('zk-current-password');
    if (cur) cur.value = '';

    if (!zkCryptoAvailable()) {
        if (title) title.textContent = 'Şifreleme kullanılamıyor';
        if (detail) detail.textContent = 'Bu tarayıcı Web Crypto API desteklemiyor. Sayfa https:// veya localhost üzerinden açılmalı.';
        if (icon) { icon.className = 'fa-solid fa-triangle-exclamation'; icon.style.color = 'var(--color-rose)'; }
        return;
    }
    if (!zkHasVault()) {
        if (title) title.textContent = 'Henüz parola belirlenmedi';
        if (detail) detail.textContent = 'Kasa boş. Veriler şu anda şifresiz saklanıyor; ilk açılışta parola belirlenecek.';
        if (icon) { icon.className = 'fa-solid fa-unlock-keyhole'; icon.style.color = 'var(--color-amber)'; }
        return;
    }

    let meta = null;
    try { meta = JSON.parse(localStorage.getItem(ZK_META_KEY)); } catch (e) { meta = null; }
    const created = meta && meta.created ? new Date(meta.created).toLocaleDateString('tr-TR') : null;
    if (title) title.textContent = 'Şifreleme etkin';
    if (detail) detail.textContent = (meta ? (meta.algo || 'AES-256-GCM') + ' · ' + (meta.kdf || 'PBKDF2-SHA256') + ' · ' + (meta.iters || ZK_PBKDF2_ITERS).toLocaleString('tr-TR') + ' iterasyon' : '')
        + (created ? ' · kurulum: ' + created : '')
        + ' · otomatik açılış: ' + (zkAutoUnlockArmed() ? 'etkin ("Kilitle" ile kapatılır)' : 'kapalı');
    if (icon) { icon.className = 'fa-solid fa-lock'; icon.style.color = 'var(--color-emerald)'; }

    updateZkStrengthMeter();
}

function zkSecurityFeedback(msg, color) {
    const el = document.getElementById('zk-change-feedback');
    if (!el) return;
    el.textContent = msg;
    el.style.color = color || 'var(--txt-muted)';
    if (msg) setTimeout(function () { if (el.textContent === msg) el.textContent = ''; }, 4200);
}

/* ŞİFRELENMİŞ YEDEĞİN TAŞINABİLİRLİĞİ — kritik kural:
   Yedek dosyası, KENDİ kasa tuzunu (meta.salt) da içinde taşır. Çünkü
   içe aktaran cihazın kendi kasa tuzu farklıdır ve o tuzdan türetilen
   anahtar yedeği açamaz. Bu yüzden içe aktarma, parolayı DOSYANIN taşıdığı
   tuzdan türetir; cihazın kendi kasa tuzu hiçbir işe yaramaz. */
function zkReadVaultSalt() {
    try {
        const meta = JSON.parse(localStorage.getItem(ZK_META_KEY));
        return (meta && meta.salt) ? meta.salt : null;
    } catch (e) { return null; }
}

/* ==========================================================================
   GITHUB ŞİFRELİ VERİ DEPOLAMA (SEÇENEK A) — saf statik site
   --------------------------------------------------------------------------
   Veri GitHub'da TEK bir dosyada, şifreli olarak durur:
     https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>

   NEDEN TOKEN YOK: Tarayıcı bir erişim anahtarını localStorage'da tutsaydı
   o cihaza erişen biri veriyi sessizce EZEBİLİRDİ. Bu yüzden "Yükle"
   düğmesi dosyayı İNDİRİR; kullanıcı github.com'a girip dosyayı kendi
   eliyle yükler. Tarayıcıda hiçbir gizli anahtar saklanmaz — saldırı
   yüzeyi yoktur.

   DÜZEN (veri kaybını önlemek için — bu sıra BOZULMAZ):
     · Cihazda veri YOKSA  → GitHub'tan çek (ilk kurulum / yeni bilgisayar)
     · Cihazda veri VARSA  → KENDİ verisiyle aç, GitHub'a HİÇ DOKUNMAZ
     · "Yükle"             → açık kullanıcı eylemi, dosyayı indirir
     · İki taraf farklıysa → sor, sessizce üstüne yazma
   ========================================================================== */
const ZK_GH_CONFIG_KEY = 'yaser_v10_github_cfg';
const ZK_GH_STATE_KEY  = 'yaser_v10_github_state';
const ZK_GH_DEFAULT    = { owner: '', repo: '', branch: 'main', path: 'yaser-veri.zk.json' };

/* Nesne anahtar sırasına göre kararlı metne çevirir: aynı veri her zaman
   aynı fingerprint'i üretsin diye. Aksi halde JSON.stringify sırası
   değişince "değişiklik yok" sanılır. */
function zkCanonical(v) {
    if (Array.isArray(v)) return '[' + v.map(zkCanonical).join(',') + ']';
    if (v && typeof v === 'object') {
        return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + zkCanonical(v[k])).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
}

/* İçeriğin kısa parmak izi. ŞİFRELENMİŞ metnin değil: her yazımda rastgele
   IV kullanıldığı için aynı veri iki kez şifrelendiğinde farklı görünür.
   Bu yüzden düz veriden hesaplanır ve şifreli dosyanın İÇİNE yazılır. */
async function zkFingerprint(obj) {
    const bytes = new TextEncoder().encode(zkCanonical(obj));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/* GitHub'a gidecek veri kümesi (localStorage anahtarlarıyla birebir örtüşür). */
function zkCollectPayload() {
    return {
        jobs: jobs, activeJobIds: activeJobIds, notes: notes, noteTopics: noteTopics,
        tasks: tasks, files: files, quickNotes: quickNotes, stickyNotes: stickyNotes,
        weeklyGoal: weeklyGoal, settings: settings, customHeaderTitles: customHeaderTitles,
        dashLayout: loadDashLayout()
    };
}

/* Şifreli GitHub dosyasını üretir. vaultSalt dosyada taşınır; böylece
   başka bir cihaz, KENDİ kasa tuzunu bilmeden yalnızca parola ile açar. */
async function zkBuildRemoteEnvelope() {
    const salt = zkReadVaultSalt();
    if (!salt) throw new Error('zk:no-vault');
    const payload = zkCollectPayload();
    const contentHash = await zkFingerprint(payload);
    const plain = JSON.stringify({
        type: 'yaser-v10-encrypted-backup',
        contentHash: contentHash,
        payload: payload
    });
    const cipher = await zkEncryptString(zkRootBits, plain, ZK_EXPORT_INFO);
    return {
        type: 'yaser-v10-encrypted-backup',
        kdf: 'PBKDF2-SHA256',
        iters: ZK_PBKDF2_ITERS,
        vaultSalt: salt,
        contentHash: contentHash,
        cipher: cipher,
        uploadedAt: new Date().toISOString()
    };
}

function zkGetGhConfig() {
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem(ZK_GH_CONFIG_KEY)) || {}; } catch (e) { cfg = {}; }
    return {
        owner: String(cfg.owner || ZK_GH_DEFAULT.owner).trim(),
        repo: String(cfg.repo || ZK_GH_DEFAULT.repo).trim(),
        branch: String(cfg.branch || ZK_GH_DEFAULT.branch).trim(),
        path: String(cfg.path || ZK_GH_DEFAULT.path).trim().replace(/^\/+/, '')
    };
}

function zkSaveGhConfig(cfg) {
    try { localStorage.setItem(ZK_GH_CONFIG_KEY, JSON.stringify(cfg)); } catch (e) { /* kota */ }
}

function zkGetGhState() {
    try { return JSON.parse(localStorage.getItem(ZK_GH_STATE_KEY)) || {}; } catch (e) { return {}; }
}

function zkSaveGhState(st) {
    try { localStorage.setItem(ZK_GH_STATE_KEY, JSON.stringify(st)); } catch (e) { /* kota */ }
}

function zkGhConfigured() {
    const c = zkGetGhConfig();
    return !!(c.owner && c.repo && c.path);
}

function zkGhRawUrl(cfg) {
    const c = cfg || zkGetGhConfig();
    return 'https://raw.githubusercontent.com/' + encodeURIComponent(c.owner) + '/' +
           encodeURIComponent(c.repo) + '/' + encodeURIComponent(c.branch) + '/' +
           c.path.split('/').map(encodeURIComponent).join('/');
}

/* Bu cihazda veri var mı? "Veri yoksa GitHub'tan çek" kuralının girdisi. */
function zkHasLocalData() {
    for (const key of ZK_DATA_KEYS) {
        if (zkPlainCache.has(key)) return true;
    }
    return false;
}

/* GitHub'daki dosyayı indirir ve ŞİFRELEMEYİZ — sadece zarfı okuruz.
   Böylece "sunucuda ne var?" sorusunun cevabını parolaya ihtiyaç duymadan
   da görebiliriz (dosyada yazan contentHash ve uploadedAt düz metindir).
   Not: GitHub'da private repo kullanılırsa raw adresi 404 döner; bu durum
   kullanıcıya "erişilemiyor" olarak bildirilir, sessizce geçilmez. */
async function zkFetchRemoteEnvelope(cfg) {
    const url = zkGhRawUrl(cfg);
    let res;
    try {
        res = await fetch(url, { cache: 'no-store' });
    } catch (e) {
        throw new Error('zk:gh-unreachable');
    }
    if (res.status === 404) return null;                       /* henüz yüklenmemiş */
    if (!res.ok) throw new Error('zk:gh-http-' + res.status);
    let env;
    try { env = JSON.parse(await res.text()); }
    catch (e) { throw new Error('zk:gh-bad-json'); }
    if (!env || typeof env.cipher !== 'string') throw new Error('zk:gh-not-a-vault');
    return env;
}

/* Dosyayı parolayla açar. Parola, dosyanın taşıdığı tuzdan türetilir —
   cihazın kendi tuzu değil (bkz. "TAŞINABİLİRLİĞİ" notu). */
async function zkOpenRemoteEnvelope(env, password) {
    if (!env.vaultSalt) throw new Error('zk:gh-no-salt');
    const bits = await zkDeriveRootBits(password, env.vaultSalt);
    let plain;
    try { plain = await zkDecryptString(bits, env.cipher, ZK_EXPORT_INFO); }
    catch (e) { throw new Error('zk:wrong-password'); }
    let opened;
    try { opened = JSON.parse(plain); } catch (e) { throw new Error('zk:gh-bad-payload'); }
    if (!opened || !opened.payload) throw new Error('zk:gh-bad-payload');
    return opened;   /* { contentHash, payload } */
}

/* Açılışta çalışan karar motoru — "veri kaybını önleme" kurallarının
   TEK uygulama noktası. Buraya başka bir yol eklenirse kural bozulur. */
async function zkSyncOnStartup() {
    if (!zkGhConfigured() || !zkRootBits) return { action: 'none', reason: 'config' };

    let env;
    try { env = await zkFetchRemoteEnvelope(); }
    catch (e) {
        return { action: 'error', reason: (e && e.message) || 'gh' };
    }

    const state = zkGetGhState();
    const st = zkSaveGhState.bind(null);

    /* GitHub'da henüz dosya yok → kullanıcı ilk kez yükleme yapacak. */
    if (!env) return { action: 'none', reason: 'remote-empty', remoteEmpty: true };

    const localHash = await zkFingerprint(zkCollectPayload());
    const remoteHash = env.contentHash || null;

    /* Kural 2: cihazda veri varsa KENDİ verisiyle açılır. İlk kurulumda
       state.lastSyncedHash boş olduğu için bu yol "ilk yükleme" sayılır. */
    if (zkHasLocalData() && state.lastSyncedHash) {
        if (remoteHash && remoteHash !== state.lastSyncedHash) {
            /* Kural 4: iki taraf farklılaşmış. Üstüne yazılmaz, bildirilir. */
            return {
                action: 'diverged',
                remoteHash: remoteHash,
                localHash: localHash,
                localHashChanged: localHash !== state.lastSyncedHash,
                remoteUploadedAt: env.uploadedAt || null
            };
        }
        return { action: 'kept-local', remoteUploadedAt: env.uploadedAt || null };
    }

    /* Kural 1: cihazda veri yok (yeni bilgisayar / ilk kurulum) → çek.
       Bu durumda uyarı yok; ama dosya başka bir parolayla şifreliyse
       çözülemez ve kullanıcıya durum açıkça bildirilir. */
    return {
        action: 'needs-fetch',
        env: env,
        remoteUploadedAt: env.uploadedAt || null,
        canTryLocalPassword: true
    };
}

/* --- KULLANICI EYLEMLERİ ------------------------------------------------- */

/* "Şifreli Yedekle": şifreli dosyayı ÜRETİP İNDİRİR. GitHub'a göndermez —
   tarayıcının yazma yetkisi yok ve olması da istemiyoruz (token gerekirdi).
   Kullanıcı dosyayı github.com'a kendi eliyle yükler. */
async function uploadToGithub() {
    if (!zkRootBits) { lockApp(); return; }
    if (!zkGhConfigured()) {
        alert('Önce GitHub deposunu tanımlayın (owner / repo / dosya yolu).');
        return;
    }
    const cfg = zkGetGhConfig();
    let env;
    try {
        env = await zkBuildRemoteEnvelope();
    } catch (e) {
        alert('Yükleme hazırlanamadı: ' + ((e && e.message) || 'bilinmeyen hata'));
        return;
    }

    /* Üstüne yazma uyarısı: GitHub'da farklı bir içerik varsa sor. */
    try {
        const remote = await zkFetchRemoteEnvelope(cfg);
        if (remote && remote.contentHash && remote.contentHash !== env.contentHash) {
            const localChanged = (zkGetGhState().lastSyncedHash !== env.contentHash);
            const warn =
                'GitHub\'da farklı bir sürüm var.\n\n' +
                'Bu cihazdaki son yüklemeye göre:\n' +
                '• Bu bilgisayarda değişiklik ' + (localChanged ? 'VAR' : 'yok') + '\n' +
                '• GitHub\'daki sürüm farklı\n\n' +
                'Devam ederseniz GitHub\'daki sürümü bu bilgisayardaki\n' +
                'verilerle DEĞİŞTİRİRSİNİZ. GitHub\'daki veri kaybolur.\n\n' +
                'Onaylıyor musunuz?';
            if (!confirm(warn)) return;
        }
    } catch (e) { /* GitHub okunamıyorsa yine de dosyayı verelim */ }

    _zkDownloadJSON(env, 'yaser-veri.zk.json');

    /* Dosyayı indirdi: artık bu cihazdaki veri "yüklenmiş" sayılır.
       Böylece bir sonraki açılışta iki tarafın farklı görünmesi normaldir. */
    zkSaveGhState({ lastSyncedHash: env.contentHash, lastUploadedAt: env.uploadedAt });

    setTimeout(function () {
        alert('Şifreli veri dosyası indirildi: yaser-veri.zk.json\n\n' +
              'Şimdi github.com → ' + cfg.owner + '/' + cfg.repo + ' → ' + cfg.branch +
              ' klasörüne gidip bu dosyayı yükleyin (aynı adla değiştirin).\n\n' +
              'Dosya şifrelidir; parolayı bilmeyen açamaz.');
    }, 400);
}

/* "GitHub'dan Yükle": cihazdaki veriyi değiştirmeden önce İZİN İSTER.
   Kural 1'in elle tetiklenmiş hâli; açılışta otomatik çalışan yolun aynısı. */
async function fetchFromGithub() {
    if (!zkRootBits) { lockApp(); return; }
    if (!zkGhConfigured()) { alert('Önce GitHub deposunu tanımlayın.'); return; }

    let env;
    try { env = await zkFetchRemoteEnvelope(); }
    catch (e) {
        alert('GitHub\'dan okunamadı: ' + ghErrorText(e));
        return;
    }
    if (!env) { alert('GitHub\'da henüz veri dosyası yok. Önce "Yükle" ile dosyayı indirip yükleyin.'); return; }

    const localHash = await zkFingerprint(zkCollectPayload());
    if (zkHasLocalData() && localHash !== (zkGetGhState().lastSyncedHash || '')) {
        if (!confirm('Bu bilgisayarda son yüklemeye göre değişiklik var.\n\n' +
                     'GitHub\'daki sürümü indirmek bu değişiklikleri\n' +
                     'SİLMEK demektir. Devam edilsin mi?')) return;
    }

    const pw = await zkAskPassword("GitHub'daki şifreli veriyi açmak için Master Parola:\n(Dosyayı yükleyen cihazın parolası)");
    if (pw === null) return;
    let opened;
    try { opened = await zkOpenRemoteEnvelope(env, pw); }
    catch (e) {
        alert(ghErrorText(e));
        return;
    }
    _applyBackupObject(opened.payload);
    await Promise.all(Array.from(_zkWriteChains.values()));
    zkSaveGhState({ lastSyncedHash: opened.contentHash || env.contentHash, lastUploadedAt: env.uploadedAt || null });
    loadSecuritySettingsForm();
    refreshAllViews();
    if (activeView === 'home') renderCurrentView();
    alert('GitHub verisi yüklendi.');
}

function ghErrorText(e) {
    const m = (e && e.message) || '';
    if (m === 'zk:wrong-password') return 'Hatalı Parola: veri açılamadı.';
    if (m === 'zk:gh-unreachable') return 'Bağlantı kurulamadı (internet yok?).';
    if (m === 'zk:gh-no-salt') return 'Bu dosya kasa tuzunu içermiyor (eski sürümden).';
    if (m === 'zk:gh-bad-json' || m === 'zk:gh-not-a-vault' || m === 'zk:gh-bad-payload') return 'Dosya okunamadı veya beklenen biçimde değil.';
    if (m.indexOf('zk:gh-http-404') === 0) return 'Depo veya dosya bulunamadı. (Private repo ise doğrudan adres çalışmaz.)';
    if (m.indexOf('zk:gh-http-') === 0) return 'GitHub hata verdi: ' + m.replace('zk:gh-http-', 'HTTP ');
    return m || 'Bilinmeyen hata.';
}

/* Parola sorucu — Electron UYUMLU.
   window.prompt() masaüstü uygulamasında hiç çalışmaz (hata fırlatır);
   bu yüzden GitHub akışları kendi modal penceremizi kullanır. Tarayıcıda
   da aynı pencere kullanılır ki davranış her yerde aynı olsun.
   Döner: girilen metin ya da iptal için null. */
function zkAskPassword(message) {
    return new Promise(function (resolve) {
        const old = document.getElementById('zk-ask-pw-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'zk-ask-pw-overlay';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:100001; display:flex; align-items:center; justify-content:center;' +
            'background:rgba(2,6,23,0.62); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);';

        const card = document.createElement('div');
        card.style.cssText = 'width:min(400px, calc(100vw - 40px)); background:var(--surface-1, #0f172a); border:var(--edge-subtle, 1px solid rgba(148,163,184,0.25));' +
            'border-radius:16px; padding:22px; box-shadow:0 24px 64px rgba(0,0,0,0.45); color:var(--txt-main, #e2e8f0);' +
            "font-family:inherit;";

        const title = document.createElement('div');
        title.textContent = 'Master Parola';
        title.style.cssText = 'font-weight:700; font-size:15px; margin-bottom:8px;';

        const desc = document.createElement('div');
        desc.textContent = message;
        desc.style.cssText = 'font-size:12.5px; line-height:1.55; color:var(--txt-muted, #94a3b8); margin-bottom:14px; white-space:pre-line;';

        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = 'Master Parola';
        input.style.cssText = 'width:100%; box-sizing:border-box; padding:10px 12px; border-radius:10px; font-size:14px;' +
            'border:1px solid rgba(148,163,184,0.35); background:var(--surface-2, #1e293b); color:inherit; outline:none;';
        input.autocomplete = 'off';

        const err = document.createElement('div');
        err.style.cssText = 'font-size:11.5px; color:#f43f5e; margin-top:6px; min-height:14px;';

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; margin-top:14px;';

        const btnCancel = document.createElement('button');
        btnCancel.textContent = 'İptal';
        btnCancel.style.cssText = 'padding:8px 14px; border-radius:10px; border:1px solid rgba(148,163,184,0.35);' +
            'background:transparent; color:inherit; cursor:pointer; font-size:13px;';

        const btnOk = document.createElement('button');
        btnOk.textContent = 'Tamam';
        btnOk.style.cssText = 'padding:8px 16px; border-radius:10px; border:none; cursor:pointer; font-size:13px; font-weight:600;' +
            'background:var(--color-primary, #3b82f6); color:#fff;';

        function close(val) {
            document.removeEventListener('keydown', onKey, true);
            overlay.remove();
            resolve(val);
        }
        function submit() {
            const v = input.value;
            if (!v) { err.textContent = 'Parola boş olamaz.'; input.focus(); return; }
            close(v);
        }
        function onKey(ev) {
            if (ev.key === 'Escape') { ev.stopPropagation(); close(null); }
            else if (ev.key === 'Enter' && document.activeElement === input) { ev.preventDefault(); submit(); }
        }

        btnOk.addEventListener('click', submit);
        btnCancel.addEventListener('click', function () { close(null); });
        document.addEventListener('keydown', onKey, true);
        overlay.addEventListener('mousedown', function (ev) { if (ev.target === overlay) close(null); });

        row.appendChild(btnCancel);
        row.appendChild(btnOk);
        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(input);
        card.appendChild(err);
        card.appendChild(row);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        setTimeout(function () { input.focus(); }, 50);
    });
}

/* --- GÜVENLİK PANELİ: GITHUB BÖLÜMÜ --------------------------------------- */
function loadGithubSettingsForm() {
    const c = zkGetGhConfig();
    const s = zkGetGhState();
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    set('zk-gh-owner', c.owner);
    set('zk-gh-repo', c.repo);
    set('zk-gh-branch', c.branch);
    set('zk-gh-path', c.path);

    const st = document.getElementById('zk-gh-status');
    if (!st) return;
    const uploaded = s.lastUploadedAt ? new Date(s.lastUploadedAt) : null;
    const lines = [];
    lines.push('Depo: ' + (zkGhConfigured() ? (c.owner + '/' + c.repo + ' @ ' + c.branch) : 'tanımlı değil'));
    if (uploaded) lines.push('Son yükleme: ' + uploaded.toLocaleString('tr-TR'));
    else lines.push('Son yükleme: henüz yok');
    st.textContent = lines.join(' · ');
}

function saveGithubSettings() {
    const get = (id, fb) => { const e = document.getElementById(id); return e && e.value.trim() ? e.value.trim() : fb; };
    const cfg = {
        owner: get('zk-gh-owner', ''),
        repo: get('zk-gh-repo', ''),
        branch: get('zk-gh-branch', 'main'),
        path: get('zk-gh-path', ZK_GH_DEFAULT.path)
    };
    zkSaveGhConfig(cfg);
    zkSecurityFeedback('Depo tanımlandı.', 'var(--color-emerald)');
    loadGithubSettingsForm();
}

/* Açılışta GitHub kararını uygular. Kural sırası BURADA da tek yerde durur. */
async function zkApplyStartupSync() {
    if (!zkGhConfigured() || !zkRootBits) return;
    let decision;
    try { decision = await zkSyncOnStartup(); }
    catch (e) { return; }

    if (decision.action === 'diverged') {
        /* Kural 4: iki taraf farklılaşmış. Üstüne yazılmaz; kullanıcı
           bilgilendirilir ve kararı kendisi verir. */
        setTimeout(function () {
            alert('GitHub\'daki veri ile bu bilgisayardaki veri farklılaşmış.\n\n' +
                  '• Bu bilgisayarda son yüklemeye göre değişiklik: ' +
                  (decision.localHashChanged ? 'VAR' : 'yok') + '\n' +
                  '• GitHub\'daki sürüm: ' +
                  (decision.remoteUploadedAt ? new Date(decision.remoteUploadedAt).toLocaleString('tr-TR') : 'bilinmiyor') + '\n\n' +
                  'Hiçbir veri otomatik olarak değiştirilmedi.\n' +
                  'Ayarlar → Güvenlik bölümünden "GitHub\'dan Yükle" veya\n' +
                  '"Şifreli Yedekle" ile kararı verebilirsiniz.');
        }, 900);
        return;
    }

    if (decision.action === 'needs-fetch') {
        /* Kural 1: bu cihazda veri yok → GitHub'taki sürüm indirilir. */
        const pw = await zkAskPassword('Bu bilgisayarda veri yok.\nGitHub\'daki şifreli veriyi açmak için Master Parola:\n(Veriyi yükleyen cihazdaki parola)');
        if (pw === null) { zkSaveGhState({ lastSyncedHash: null, lastUploadedAt: null }); return; }
        let opened;
        try { opened = await zkOpenRemoteEnvelope(decision.env, pw); }
        catch (e) {
            alert('GitHub verisi alınamadı: ' + ghErrorText(e) + '\n\n' +
                  'Bu bilgisayar boş kalıyor; kendi verinizi buraya yazabilirsiniz.\n' +
                  'Sonradan Ayarlar → Güvenlik → "GitHub\'dan Yükle" ile tekrar deneyin.');
            return;
        }
        _applyBackupObject(opened.payload);
        await Promise.all(Array.from(_zkWriteChains.values()));
        zkSaveGhState({ lastSyncedHash: opened.contentHash || decision.env.contentHash, lastUploadedAt: decision.env.uploadedAt || null });
        refreshAllViews();
        if (activeView === 'home') renderCurrentView();
        return;
    }

    /* kept-local / remote-empty / none → hiçbir şey değiştirilmez. */
}

/* Parolayı değiştirir: TÜM kayıtları yeni anahtarla yeniden şifreler.
   Bkz. dosya içindeki "MASTER PAROLA YÖNETİMİ" başlığındaki sıra
   açıklaması — bu işlem atomiktir, yarıda kalan bir kasa bırakmaz. */
async function changeMasterPassword() {
    const cur = document.getElementById('zk-current-password');
    const np1 = document.getElementById('zk-new-password');
    const np2 = document.getElementById('zk-new-password2');
    const btn = document.getElementById('zk-change-btn');

    const oldPw = cur ? cur.value : '';
    const newPw = np1 ? np1.value : '';
    if (!oldPw) { zkSecurityFeedback('Mevcut parolanızı girin.', 'var(--color-rose)'); if (cur) cur.focus(); return; }
    if (!newPw) { zkSecurityFeedback('Yeni parolanızı girin.', 'var(--color-rose)'); if (np1) np1.focus(); return; }
    if (newPw.length < 6) { zkSecurityFeedback('Yeni parola en az 6 karakter olmalı.', 'var(--color-rose)'); return; }
    if (!np2 || newPw !== np2.value) { zkSecurityFeedback('Yeni parolalar eşleşmiyor.', 'var(--color-rose)'); return; }
    if (newPw === oldPw) { zkSecurityFeedback('Yeni parola eskisiyle aynı olamaz.', 'var(--color-amber)'); return; }
    if (!zkHasVault()) { zkSecurityFeedback('Kasa boş; önce bir parola belirleyin.', 'var(--color-rose)'); return; }

    if (btn) btn.disabled = true;
    zkSecurityFeedback('Yeni anahtar türetiliyor…', 'var(--txt-muted)');

    /* 0) Diskteki tüm şifreli kayıtları ESKİ anahtarla RAM'e al. Kullanıcının
       görmediği bir kayıt (ör. henüz render edilmemiş panel) olsa bile hepsi
       buraya gelir; yeniden şifreleme bütün kapsayıcıyı kapsar. */
    const oldBits = zkRootBits;
    let plainSnapshot;
    try {
        plainSnapshot = await zkFillPlainCache(oldBits, false);
    } catch (err) {
        zkSecurityFeedback('Kasa okunamadı: ' + (err && err.message ? err.message : 'bilinmeyen hata'), 'var(--color-rose)');
        if (btn) btn.disabled = false;
        return;
    }

    try {
        /* 1) Mevcut parolayı doğrula: kontrol kaydı eski anahtarla çözülür. */
        await zkUnlockVault(oldPw);

        /* 2) Yeni tuz + yeni kök anahtar. */
        const newSalt = zkRandomB64(16);
        const newBits = await zkDeriveRootBits(newPw, newSalt);

        /* 3) Yeni anahtarı ETKİNLEŞTİR ve tüm kayıtları yeniden yaz.
            _zkWrite şifreleme + setItem yaparken zkRootBits'i okur; bu yüzden
            atama yazma başlamadan yapılmalı. */
        zkRootBits = newBits;
        for (const key of ZK_DATA_KEYS) {
            const plain = plainSnapshot.get(key);
            if (plain === undefined) continue;
            const cipher = await zkEncryptString(newBits, plain, ZK_RECORD_INFO);
            localStorage.setItem(key, cipher);
            zkCipherCache.set(key, cipher);
            _lastWritten.set(key, plain);
        }

        /* 4) Kontrol kaydını ve meta verisini YENİ anahtarla yaz. */
        const check = await zkEncryptString(newBits, ZK_CHECK_TEXT, ZK_RECORD_INFO);
        localStorage.setItem(ZK_CHECK_KEY, check);
        localStorage.setItem(ZK_META_KEY, JSON.stringify({
            v: 1, algo: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iters: ZK_PBKDF2_ITERS,
            salt: newSalt, created: new Date().toISOString(),
            rotatedAt: new Date().toISOString()
        }));

        /* 5) Yazma kuyruklarını temizle: eski anahtarla bekleyen bir yazma
           kalmışsa yeni parolayla çözülemez ve veri bozulur. */
        _zkWriteChains.clear();

        /* 6) Cihazdaki otomatik açma kimliği YENİ anahtarla tazelenir; aksi
           hâlde sonraki açılışta eski kimlik geçersiz sayılır ve parola
           yeniden sorulurdu. */
        await zkArmAutoUnlock(newBits);

        zkSecurityFeedback('Parolanız değiştirildi.', 'var(--color-emerald)');
        loadSecuritySettingsForm();
        if (cur) cur.value = '';
        if (np1) np1.value = '';
        if (np2) np2.value = '';
    } catch (err) {
        /* Beklenmeyen hata: eski anahtarı geri koyup kapsayıcıya dokunmadan
           çıkıyoruz. Yarıda kalmış bir kasa, hiç kalmamış bir kasadan iyidir. */
        zkRootBits = oldBits;
        const m = (err && err.message) || '';
        if (m === 'zk:wrong-password') zkSecurityFeedback('Mevcut parola hatalı.', 'var(--color-rose)');
        else if (m === 'zk:undecryptable') zkSecurityFeedback('Kasa kaydı okunamadı (bazı veriler eski parolayla şifrelenmiş olabilir).', 'var(--color-rose)');
        else zkSecurityFeedback('Parola değiştirilemedi: ' + (m || 'bilinmeyen hata'), 'var(--color-rose)');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function loadAllData() {
    /* VERİ KAYNAK ARTık _zkRead(): diske yazılan metin ŞİFRELİDİR; düz metin
       yalnızca RAM cache'inde durur (bkz. zkFillPlainCache). _lastWritten
       önbelleği de düz metinle doldurulur; yazma atlama karşılaştırması
       yine _zkWrite içinde yapılır. */
    ['yaser_v10_jobs', 'yaser_v10_active_jobs', 'yaser_v10_notes', 'yaser_v10_note_topics',
     'yaser_v10_note_boards_cleared',
     'yaser_v10_tasks', 'yaser_v10_files', 'yaser_v10_quick_notes', 'yaser_v10_sticky_notes',
     'yaser_v10_weekly_goal', 'yaser_v10_settings', 'yaser_v10_header_titles'
    ].forEach(k => _lastWritten.set(k, _zkRead(k)));

    const storedJobs = _zkRead('yaser_v10_jobs');
    if (storedJobs && storedJobs !== '[]') { jobs = JSON.parse(storedJobs); }
    else {
        /* Demo kayıt kimliği burada üretilir: initialJobsData içinde "id" yoktur.
           Böylece demo veri hiçbir zaman sabit bir kimlik taşımaz ve kullanıcının
           gerçek kayıtlarıyla çakışamaz. */
        jobs = sanitizeRecordIds(initialJobsData.map(j => ({ ...j })), 'job');
        /* NOT: Burada saveAllData() ÇAĞRILMAZ. Aktif liste (activeJobIds) henüz
           atanmadı; erken kaydedilirse boş bir "[]" yazılır ve demo kaydı aktif
             listeye hiç girmez. Kayıt, activeJobIds atandıktan SONRA yapılır. */
    }

    const rawActive = _zkRead('yaser_v10_active_jobs');
    /* Eski sürümde varsayılan aktif liste sabit bir kimliğe bağlıydı; o kimlik
       artık yok. Bunun yerine ilk kayıt seçilir, böylece demo kullanıcıya bir
       örnek satır gösterir ve tutarsız bir aktif listesi kalmaz. */
    let parsedActive = rawActive ? JSON.parse(rawActive).map(String) : (jobs[0] ? [String(jobs[0].id)] : []);

    const validJobIds = jobs.map(j => String(j.id));
    activeJobIds = parsedActive.filter(id => validJobIds.includes(String(id)));

    /* Demo kayıt bu satırda ilk kez diske yazılır: artık hem jobs hem de
       activeJobIds tutarlıdır, ikisi de geçerli kimlikler içerir. */
    if (!storedJobs) {
        saveAllData();
    }

    notes = JSON.parse(_zkRead('yaser_v10_notes')) || [{ id: 'note_1', date: '2026-09-01', title: 'Revize Notu', tag: 'Önemli', color: 'amber', body: 'Detaylar incelenecek.' }];
    noteTopics = JSON.parse(_zkRead('yaser_v10_note_topics')) || [];
    /* "Tüm panolar silindi" bayrağı: kayıtta pano kalmadığı an true olur, böylece
       şablon panolar sayfa yenilendiğinde geri gelmez. */
    noteBoardsAllCleared = _zkRead('yaser_v10_note_boards_cleared') === '1';
    tasks = JSON.parse(_zkRead('yaser_v10_tasks')) || [
        { id: 'task_0', date: '2026-09-18', createdDate: '2026-09-18', emoji: '⚡', text: 'Revize CD hazırlandı acil ihaleye gönderilmesi gerekiyor.', completed: false }
    ];
    /* Görev tarih anlamları ayrıldı (bkz. "date vs createdDate" notu): eski
       kayıtlarda createdDate yoktur; o zaman orijinal yazılma tarihi = kendi
       günü kabul edilir ve geriye dönük uyum sağlanır. Bu normalizasyon her açılışta
       çalışır, dolayısıyla yeni alan eski kayıtlara da bir kez yazılır. */
    normalizeTaskDates(tasks);
    files = JSON.parse(_zkRead('yaser_v10_files')) || [{ id: 'file_1', title: 'Proje Arşivi Klasörü', path: 'C:/Projeler/2026' }];
    quickNotes = JSON.parse(_zkRead('yaser_v10_quick_notes')) || ["Afet konutları yazışmaları kontrol edilecek."];
    stickyNotes = JSON.parse(_zkRead('yaser_v10_sticky_notes')) || ["Rapor hazırlanacak"];
    weeklyGoal = JSON.parse(_zkRead('yaser_v10_weekly_goal')) || { Pazartesi: 5, Salı: 6, Çarşamba: 4, Perşembe: 5, Cuma: 2 };
    loadCustomListColumns();
    
    const storedSettings = JSON.parse(_zkRead('yaser_v10_settings'));
    let rawSettings = storedSettings ? storedSettings : defaultDropdownSettings;
    
    if (storedSettings) {
        Object.keys(defaultDropdownSettings).forEach(key => {
            if (!rawSettings[key]) {
                rawSettings[key] = defaultDropdownSettings[key];
            }
        });
    }

    settings = {};
    Object.keys(rawSettings).forEach(k => {
        if (k === 'tur') {
            settings[k] = rawSettings[k]; 
        } else {
            settings[k] = sortAlphabetically(rawSettings[k]);
        }
    });

    const storedHeaders = JSON.parse(_zkRead('yaser_v10_header_titles'));
    customHeaderTitles = storedHeaders ? storedHeaders : defaultHeaderTitles;
    Object.keys(defaultHeaderTitles).forEach(k => {
        if (!customHeaderTitles[k]) customHeaderTitles[k] = defaultHeaderTitles[k];
    });
    
    saveAllData();
    applyDynamicHeaderTitles();
}

/* PERF: saveAllData() 11 ayrı anahtarı JSON.stringify + localStorage.setItem
   ile yeniden yazıyordu. Bu fonksiyon neredeyse her kullanıcı eyleminde
   (not ekleme, görev değiştirme, filtre, sütun düzenleme) çağrıldığı ve
   `jobs` dizisi büyüdükçe JSON.stringify maliyeti arttığı için yazma
   maliyeti her tıklamada 11 katına çıkıyordu.

   Buradaki tek iyileştirme: bir anahtarın serileştirilmiş metni, localStorage'a
   son yazılandığı metinle BİREBİR aynıysa setItem atlanır. Yazılacak veri
   aynı olduğu için bu atlamanın hiçbir gözlenebilir farkı yoktur; ama
   örneğin yalnızca bir not değiştiğinde 11 yazma yerine 1 yazma yapılır.

   Önbellek, sayfa yüklendiğinde mevcut değerlerle doldurulur; böylece ilk
   kayıtta da doğru karşılaştırma yapılır. */
const _lastWritten = new Map();

function _setStoredValue(key, value) {
    /* Atlamanın ölçütü artık düz metin DEĞİL, RAM cache'idir: aynı düz metin
       ikinci kez yazılacaksa şifreleme + setItem hiç yapılmaz. Yeni metin
       şifrelenir ve diske YALNIZCA ciphertext bırakılır. */
    const text = String(value);
    if (_lastWritten.get(key) === text) return;
    _lastWritten.set(key, text);
    _zkWrite(key, text);
}

function saveAllData() {
    _setStoredValue('yaser_v10_jobs', JSON.stringify(jobs));
    _setStoredValue('yaser_v10_active_jobs', JSON.stringify(activeJobIds.map(String)));
    _setStoredValue('yaser_v10_notes', JSON.stringify(notes));
    _setStoredValue('yaser_v10_note_topics', JSON.stringify(noteTopics));
    _setStoredValue('yaser_v10_note_boards_cleared', noteBoardsAllCleared ? '1' : '0');
    _setStoredValue('yaser_v10_tasks', JSON.stringify(tasks));
    _setStoredValue('yaser_v10_files', JSON.stringify(files));
    _setStoredValue('yaser_v10_quick_notes', JSON.stringify(quickNotes));
    _setStoredValue('yaser_v10_sticky_notes', JSON.stringify(stickyNotes));
    _setStoredValue('yaser_v10_weekly_goal', JSON.stringify(weeklyGoal));
    _setStoredValue('yaser_v10_settings', JSON.stringify(settings));
    _setStoredValue('yaser_v10_header_titles', JSON.stringify(customHeaderTitles));
}

/* ==========================================================================
   ÇOKLU SEKME SENKRONİZASYONU (cross-tab) — BÖLÜM 1/2: tanımlar
   --------------------------------------------------------------------------
   Tarayıcı davranışı (kritik):
     · 'storage' olayı yalnızca BAŞKA sekmedeki bir yazma için tetiklenir;
       aynı sekmedeki setItem() bu olayı ASLA üretmez. Bu yüzden "kendi
       yazdığımızı geri yükleyip geri yazma" döngüsü doğal olarak oluşmaz.
     · Sekme arka plandayken olay TETİKLENMEZ. Bu yüzden olay anında değil,
       sekme tekrar görünür olduğunda uygulanır (bkz. visibilitychange).

   İKİ KORUMA KATMANI:
     1) Kullanıcı bir şeyi düzenliyorsa (modal açık / alana odaklı) veri
        yeniden yüklenmez; olay askıya alınır ve çıkışta bir kez uygulanır.
        Aksi halde kullanıcının yarım bıraktığı form ekranda sıfırlanırdı.
     2) Yalnızca anahtarın metni GERÇEKTEN değiştiyse arayüz tazelenir;
        her render odağı ve kaydırma konumunu kaybettirirdi.
   ========================================================================== */

/* Uygulama verisini tutan anahtarlar. Tema, screensaver, geri alma gibi
   sunum/oturum anahtarları bilinçli olarak dışarıda bırakıldı. */
const CROSS_TAB_SYNC_KEYS = new Set([
    'yaser_v10_jobs',
    'yaser_v10_active_jobs',
    'yaser_v10_notes',
    'yaser_v10_note_topics',
    'yaser_v10_note_boards_cleared',
    'yaser_v10_tasks',
    'yaser_v10_files',
    'yaser_v10_quick_notes',
    'yaser_v10_sticky_notes',
    'yaser_v10_weekly_goal',
    'yaser_v10_settings',
    'yaser_v10_header_titles'
]);

/* Sıralı uygulama: refreshAllViews() yeniden render tetiklediği için, aynı
   anda gelen çok sayıda olayda render'ların iç içe geçmesini engeller. */
let _crossTabApplying = false;
const _crossTabPending = new Map();

/* Kullanıcı bu anda bir şeyi düzenliyor mu? True ise tazeleme ertelenir. */
function _isUserEditing() {
    /* Açık modal (iş kaydı, not, sütun seçim...) ekranda kullanıcıya ait
       yarım bir form vardır; render onu bozar. */
    if (document.querySelector('.modal-overlay.active')) return true;

    const el = document.activeElement;
    if (!el) return false;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    if (el.isContentEditable) return true;
    /* contenteditable henüz odaklanmamış olsa bile (pano başlığı gibi satır içi
       düzenleme) düzenleme modunda olabilir. */
    if (el.closest && el.closest('[contenteditable="true"]')) return true;
    return false;
}

async function _applyCrossTabChanges() {
    _crossTabApplying = true;
    try {
        /* Kayıtlar artık ŞİFRELİ olduğu için önce RAM cache'i tazelemek
           gerekir: _zkRead() diski değil cache'i okur. Çözüm başarısızsa
           (başka sekmede farklı master parola) mevcut veri korunur. */
        const refreshed = await zkRefreshPlainCache();
        if (!refreshed) { _crossTabPending.clear(); return; }

        /* loadAllData() en sonda saveAllData() çağırır. Bu bir döngü DEĞİLDİR:
           _setStoredValue yalnızca metni değişen anahtarı yazar, üstelik yazma
           işlemi zaten yalnızca DIĞER sekmelerde 'storage' üretir. */
        loadAllData();

        if (_crossTabPending.size > 0) {
            refreshAllViews();
            /* refreshAllViews() 'home' görünümünü listelemez (dashboard paneli
               orada ayrı çizilir); bu yüzden ana ekran ayrıca tazelenir. */
            if (activeView === 'home') renderCurrentView();
        }
        _crossTabPending.clear();
    } catch (err) {
        /* Bozuk/yarım kalmış bir değer diğer sekmede istisna atmasın. */
        console.warn('[cross-tab] Veri tazelemesi başarısız:', err);
        _crossTabPending.clear();
    } finally {
        _crossTabApplying = false;
    }
}

/* Sekme görünür olduğunda biriken değişiklikleri uygula: kullanıcı o sırada
   modalını kapatmış ya da alandan çıkmış olabilir, ertelenen tazeleme artık
   güvenlidir. */
document.addEventListener('visibilitychange', () => {
    if (document.hidden || _crossTabApplying) return;
    if (_crossTabPending.size === 0) return;
    if (_isUserEditing()) return;
    _applyCrossTabChanges();
});

window.addEventListener('storage', (e) => {
    /* localStorage.clear() sonrası e.key null gelir; yine de anahtar adına
       bakılır çünkü olay metnin değil anahtarın kimliğiyle gelir. */
    if (!e.key || !CROSS_TAB_SYNC_KEYS.has(e.key)) return;
    if (e.storageArea && e.storageArea !== window.localStorage) return;

    /* Gerçekten bir şey değişti mi? Artık karşılaştırma ŞİFRELENMİŞ metinle
       yapılır: aynı düz metin her yazımda farklı ciphertext üretir, ama bu
       sekmenin son yazdığı ciphertext'i (zkCipherCache) biliriz; başka bir
       sekmeden gelen metin ondan farklıysa değişiklik vardır. */
    const cachedCipher = zkCipherCache.get(e.key);
    if (e.newValue === null || e.newValue !== cachedCipher) {
        _crossTabPending.set(e.key, e.newValue);
    }

    /* Kullanıcı düzenliyorsa dokunma; visibilitychange'de uygulanacak. */
    if (_crossTabApplying) return;
    if (_isUserEditing()) return;
    if (_crossTabPending.size === 0) return;

    _applyCrossTabChanges();
});

function applyDynamicHeaderTitles() {
    /* PERF: Eski hâl, her anahtar için ayrı bir querySelectorAll ile TÜM belgeyi
       tarıyordu (17 anahtar = 17 tam belge taraması). Artık tüm eşleşen hücreler
       TEK sorguda toplanıyor, ardından her hücrenin sınıf listesi üzerinden
       anahtarı kesin (tam sınıf) eşleştirmesi yapılıyor.

       Sınıf LİSTESİ üzerinden eşleştirmek önemli: yalnızca className içinde
       'indexOf' ile aramak 'dynamic-col-tur' ile 'dynamic-col-turu' gibi
       anahtarları birbirine karıştırabilirdi. */
    const cells = document.querySelectorAll('[class*="dynamic-col-"]');
    for (let i = 0; i < cells.length; i++) {
        const el = cells[i];
        const classList = el.classList;

        for (const key in customHeaderTitles) {
            if (!classList.contains('dynamic-col-' + key)) continue;

            const titleVal = customHeaderTitles[key] || defaultHeaderTitles[key];
            if (key === 'projeTuru') {
                /* Liste başlıkları iki satıra ayrılmış olsun (KATEGORİ / PROTOKOL).
                   Form panelindeki etiket ise tek satır kalmalı — bu yüzden
                   yalnızca .th-two-line işaretli liste başlıkları hedeflenir. */
                if (classList.contains('th-two-line')) {
                    el.innerHTML = 'KATEGORİ<br>/ PROTOKOL';
                } else {
                    el.textContent = 'KATEGORİ / PROTOKOL';
                }
            } else {
                el.innerText = titleVal;
            }
            break;
        }
    }
}

function exportDataJSON() {
    /* DASH_LAYOUT_KEY kayıtlıysa onu da yedeğe koy: panel düzeni böylece
       "Yedek İndir" dosyasıyla başka tarayıcıya da taşınır. */
    const backupObj = { jobs, activeJobIds, notes, tasks, files, quickNotes, stickyNotes, weeklyGoal, settings, customHeaderTitles, dashLayout: loadDashLayout(), exportDate: new Date().toISOString() };
    _zkDownloadJSON(backupObj, 'EtutProje_Yedek_' + new Date().toISOString().split('T')[0] + '.json');
}

/* --- ŞİFRELİ YEDEK (AES-256-GCM) --------------------------------------------
   Aynı JSON nesnesi, master paroladan türetilen anahtarla şifrelenip .zk.json
   uzantısıyla indirilir. Parolayı bilmeyen biri dosyayı açamaz. */
async function exportEncryptedJSON() {
    if (!zkRootBits) { lockApp(); return; }
    const backupObj = { jobs, activeJobIds, notes, noteTopics, tasks, files, quickNotes, stickyNotes, weeklyGoal, settings, customHeaderTitles, dashLayout: loadDashLayout(), exportDate: new Date().toISOString() };
    const plain = JSON.stringify({ type: 'yaser-v10-encrypted-backup', payload: backupObj }, null, 2);
    const cipher = await zkEncryptString(zkRootBits, plain, ZK_EXPORT_INFO);
    /* vaultSalt OLMAZSA dosya başka cihazda açılamaz: anahtar türetimi bu
       tuza bağlıdır. Bu yüzden kasayı açan tuz dosyayla birlikte taşınır. */
    const salt = zkReadVaultSalt();
    if (!salt) { alert('Hata: kasa tuzu okunamadı; şifreli yedek oluşturulamadı.'); return; }
    _zkDownloadJSON(
        { type: 'yaser-v10-encrypted-backup', kdf: 'PBKDF2-SHA256', iters: ZK_PBKDF2_ITERS, vaultSalt: salt, cipher: cipher, exportDate: new Date().toISOString() },
        'EtutProje_Sifreli_Yedek_' + new Date().toISOString().split('T')[0] + '.zk.json');
}

/* İndirilen .zk.json yedeğini açar: master parola sorulur, dosya o parolayla
   AES-GCM çözülür. Çözüm başarısızsa HİÇBİR veri uygulanmaz. */
function importEncryptedJSON(file) {
    const reader = new FileReader();
    reader.onload = async function (evt) {
        try {
            const env = JSON.parse(evt.target.result);
            if (!env || typeof env.cipher !== 'string') { alert('Hata: Bu dosya şifreli bir yedek değil.'); return; }

            /* Anahtar türetimi DOSYANIN taşıdığı tuzdan yapılır. Cihazın kendi
               kasa tuzu farklıdır ve onunla bu dosya açılamaz — bu yüzden
               vaultSalt yoksa dosya eski sürümden kalmış ve açılamaz. */
            if (!env.vaultSalt) {
                alert('Hata: Bu şifreli yedek kasa tuzunu içermiyor (eski sürümden).\n' +
                      'Yedek dosyanızı güncel sürümle yeniden oluşturun.');
                return;
            }

            const pw = await zkAskPassword('Şifreli yedeği açmak için Master Parola:\n(Bu, yedeği ALAN cihazdaki Master Parola olmalıdır.)');
            if (pw === null) return;

            let fileBits;
            try {
                fileBits = await zkDeriveRootBits(pw, env.vaultSalt);
            } catch (e) {
                alert('Hata: parola türetilemedi.');
                return;
            }

            let plain = null;
            try {
                plain = await zkDecryptString(fileBits, env.cipher, ZK_EXPORT_INFO);
            } catch (err) {
                alert('Hatalı Parola: şifreli yedek açılamadı.');
                return;
            }
            let opened = null;
            try { opened = JSON.parse(plain); } catch (err) { alert('Hata: çözülen yedek okunamadı.'); return; }
            const payload = opened && opened.payload ? opened.payload : null;
            if (!payload) { alert('Hata: yedek içeriği tanınmadı.'); return; }

            /* Bu cihazda kasa YOKSA: yedeğin parolası bu cihazın da parolası
               olur. Böylece "ilk açılışta parola belirle" ekranı gelmeden,
               doğrudan yedekle başlamak mümkün olur. */
            if (!zkHasVault()) {
                if (!confirm('Bu cihazda henüz bir Master Parola belirlenmemiş.\n\n' +
                             'Yedekteki parola bu cihazın parolası olarak da kullanılacak.\n' +
                             'Devam edilsin mi? (Farklı bir parola istiyorsanız İptal deyip\n' +
                             'Ayarlar > Güvenlik panelinden parolayı sonradan değiştirin.)')) return;
                try {
                    await zkSetupVault(pw);
                } catch (e) {
                    alert('Hata: bu cihaz için kasa oluşturulamadı.');
                    return;
                }
            }

            /* _applyBackupObject → saveAllData() her kaydı CİHAZIN KENDİ
               anahtarıyla yeniden şifreler. Yedek farklı bir parolayla
               şifrelenmiş olsa bile sonuç bu cihazda tutarlı kalır. */
            _applyBackupObject(payload);
            await Promise.all(Array.from(_zkWriteChains.values()));
            alert('Şifreli yedek başarıyla yüklendi!');
        } catch (err) { alert('Hata: ' + err.message); }
    };
    reader.readAsText(file);
}

/* Yedek nesnesini uygular; hem düz JSON hem şifreli yedek bu yolu paylaşır. */
function _applyBackupObject(data) {
    /* Yedek dosya kullanıcı kontrolünde olsa da kayıt kimlikleri 20+ onclick
       özniteliğine doğrudan gömülüyor. Gelen kimlikler burada normalize
       edilir: geçerli olan korunur, geçersiz ya da yinelenen yenisiyle
       değiştirilir. Kayıt verisi kaybolmaz. */
    jobs = sanitizeRecordIds(data.jobs, 'job');
    if (data.activeJobIds) activeJobIds = data.activeJobIds.map(String);
    if (data.notes) notes = sanitizeRecordIds(data.notes, 'note');
    if (data.noteTopics) noteTopics = data.noteTopics;
    if (data.tasks) { tasks = sanitizeRecordIds(data.tasks, 'task'); normalizeTaskDates(tasks); }
    if (data.files) files = sanitizeRecordIds(data.files, 'file');
    if (data.quickNotes) quickNotes = data.quickNotes;
    if (data.stickyNotes) stickyNotes = data.stickyNotes;
    if (data.weeklyGoal) weeklyGoal = data.weeklyGoal;
    if (data.customHeaderTitles) customHeaderTitles = data.customHeaderTitles;
    /* Panel düzeni de yedekte taşınıyorsa geri yükle ve ekrana uygula.
       sanitizeDashLayout geçersiz veriyi null döndürür → bozuk bir dosya
       mevcut düzeni bozmaz. */
    if (data.dashLayout) {
        applyDashLayoutRatios(sanitizeDashLayout(data.dashLayout));
        try { saveDashLayout(); } catch (err) { /* kota / private mod */ }
        layoutDashGrid();
    }
    if (data.settings) {
        settings = {};
        Object.keys(defaultDropdownSettings).forEach(k => {
            if (!data.settings[k]) data.settings[k] = defaultDropdownSettings[k];
        });
        Object.keys(data.settings).forEach(k => {
            if (k === 'tur') settings[k] = data.settings[k];
            else settings[k] = sortAlphabetically(data.settings[k]);
        });
    }

    const validJobIds = jobs.map(j => String(j.id));
    activeJobIds = activeJobIds.filter(id => validJobIds.includes(String(id)));

    saveAllData();
    applyDynamicHeaderTitles();
    renderCurrentView();
}

function _zkDownloadJSON(obj, filename) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", filename);
    document.body.appendChild(dlAnchor); dlAnchor.click(); dlAnchor.remove();
}

function importDataJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    /* Aynı dosya seçici hem düz .json yedeğini hem şifreli .zk.json yedeğini
       kabul eder: dosya içeriğine bakılır, uzantıya değil. */
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (data.type === "FeatureCollection" || data.features) {
                geojsonData = data;
                renderD3Map();
                alert("Harita GeoJSON sınır verisi başarıyla yüklendi!");
                return;
            }
            /* ŞİFRELENMİŞ YEDEK: parola sorulur, çözülür, sonra normal yol.
               Kilitliyken de çalışmalıdır — kullanıcı yeni bir cihazda önce
               yedeği yükleyip parolayı buradan belirleyebilir. */
            if (data && typeof data.cipher === 'string') {
                importEncryptedJSON(file);
                return;
            }
            if (data.jobs && Array.isArray(data.jobs)) {
                _applyBackupObject(data);
                alert("Sistem yedek verileri başarıyla yüklendi!");
            } else { alert("Hata: Tanınmayan veya geçersiz JSON formatı."); }
        } catch (err) { alert("Hata: " + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
}

/* ==========================================================================
   D3.JS TURKEY MAP ENGINE
   ========================================================================== */
function initD3TurkeyMap() {
    const svgEl = document.getElementById('turkey-map-svg');
    if (!svgEl) return;

    mapSvg = d3.select("#turkey-map-svg");
    mapSvg.selectAll("*").remove();

    mapG = mapSvg.append("g");

    mapZoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            mapG.attr("transform", event.transform);
            /* Etiket taban boyutu 10px; zoom ile ters orantılı ölçeklenir,
               alt sınır 5.5px. Etiket artık kontursuz/glow'suz düz beyaz
               olduğundan stroke-width ölçeklemesi kaldırıldı — inline
               stroke-width yazmak CSS'teki `stroke: none`ı ezip geri
               çiziyordu. Uydu modu kendi koyu konturunu CSS'ten verir. */
            mapG.selectAll(".map-city-label")
                .style("font-size", `${Math.max(5.5, 10 / event.transform.k)}px`);
            /* Odak modunda seçili il 2.4–6× yakınlaştırıldığı için 10/k kuralı
               etiketi okunamaz (1.7px) yapardı. Alt sınırı seçime yükseltiyoruz:
               diğer iller küçük ve silik kalır, seçili il adı okunur. */
            if (selectedMapCity) {
                const kFocus = event.transform.k;
                mapG.selectAll(".map-city-label")
                    .style("font-size", function () {
                        const n = (d3.select(this).datum().properties || {});
                        const nm = n.name || n.NAME_1 || "";
                        const min = nm === selectedMapCity ? 11 : 6.5;
                        return `${Math.max(min, 10 / kFocus)}px`;
                    });
            }
            /* Ekstrüzyon kaldırıldı: yalnızca sınır çizgisi zoom'da ekran
               sabit 2.4px kalır → yakınlaştırınca kehribar sınır incelip
               kaybolmaz (etiketle aynı mantık). */
            const k = event.transform.k;
            mapG.selectAll(".map-city-overlay")
                .style("stroke-width", `${Math.max(1.2, 2.4 / k)}px`);
            mapG.selectAll(".map-district-border")
                .style("stroke-width", `${Math.max(0.18, 0.5 / k)}px`);
            /* Seçili ilçe mührü de ekran sabit 1.8px kalır; ilçe sınırları il
               sınırından daha sıkışık olduğu için incelip kaybolmasın. */
            mapG.selectAll(".map-district-overlay")
                .style("stroke-width", `${Math.max(0.9, 1.8 / k)}px`);
            mapG.selectAll(".map-city-path.city-selected")
                .style("stroke-width", `${Math.max(0.6, 1.2 / k)}px`);
        });

    mapSvg.call(mapZoom);

    /* Kayıtlı uydu tercihini uygula (toggle edene kadar sessiz) */
    loadSatellitePreference();

    d3.json("https://raw.githubusercontent.com/alpers/Turkey-Maps-GeoJSON/master/tr-cities.json")
        .then(data => {
            geojsonData = data;
            renderMapTypeFilters();
            renderD3Map();
            /* İl verisi geldi → il→ilçe eşlemesi artık kurulabilir.
               İlçe verisi de paralel çekilmeye başlar (opsiyonel katman). */
            loadDistrictBoundaries();
        })
        .catch(err => {
            d3.json("https://cdn.jsdelivr.net/gh/alpers/Turkey-Maps-GeoJSON@master/tr-cities.json")
                .then(data => {
                    geojsonData = data;
                    renderMapTypeFilters();
                    renderD3Map();
                })
                .catch(() => {
                    createFallbackVectorMap();
                });
        });

    /* KOMŞU KARA ALANLARI (Yunanistan, Bulgaristan, Gürcistan, Ermenistan, Azerbaycan, İran, Irak, Suriye, Kıbrıs, Rusya)
       Dekoratif ve nötr: mat gri, tıklanamaz; il poligonlarıyla aynı projeksiyonu paylaşır. */
    d3.json("https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json")
        .then(worldData => {
            if (worldData && worldData.features && worldData.features.length) {
                neighborGeoData = worldData;
                if (activeView === 'home' && geojsonData) renderD3Map();
            }
        })
        .catch(() => { /* Komşu katman opsiyoneldir; yüklenemezse harita aynen çalışır */ });
}

function initMapResizeObserver() {
    const wrapper = document.getElementById('map-wrapper-container');
    if (!wrapper) return;

    /* PERF: ResizeObserver panel sürüklemesi sırasında kare kare tetiklenir;
       her tetiklemede tam renderD3Map (~25ms) koşmak kuyruğu büyütür ve
       sürüklemeyi takılı hissettirir. İstekler tek bir karede birleştirilir:
       bir kare içinde en fazla BİR render yapılır, kalan tetiklemeler atlanır. */
    let pending = false;
    let lastW = 0, lastH = 0;

    mapResizeObserver = new ResizeObserver(entries => {
        if (activeView !== 'home' || !geojsonData) return;

        const box = entries[entries.length - 1].contentRect;
        const w = Math.round(box.width), h = Math.round(box.height);
        /* Boyut değişmediyse render'ın hiçbir anlamı yok (özellikle uydu tile
           geçişleri gibi iç değişikliklerde boş iş yapılmasın). */
        if (w === lastW && h === lastH) return;
        lastW = w; lastH = h;

        if (pending) return;
        pending = true;
        window.requestAnimationFrame(() => {
            pending = false;
            if (activeView === 'home' && geojsonData) renderD3Map();
        });
    });

    mapResizeObserver.observe(wrapper);
}

/* --- T-SPLITTER PANEL MOTORU (5 bağımsız eksen) -----------------------------
   5 panel mutlak konumlu "pinwheel" şemasındadır; her panel kendi sol-üst
   kenarına göre konumlanır ve 5 CSS değişkeniyle yönetilir:
     --px-main-v     = splitX   sol/sağ sütun GENELİ (harita | sağ kolon)
     --px-left-w     = splitX2  sol alt bandın SAĞ sınırı (Veri | Bugünkü)
     --px-deadline-w = splitX3  sol alt bandın İÇ sınırı (Deadline | Veri)
     --py-main-h     = splitY   üst/alt satır GENELİ
     --py-right-h    = splitY2  yalnız Bugünkü İşler'in yüksekliği
   Beş ayırıcı ve etki alanları:
     splitter-v              (ANA dikey) → splitX : sol/sağ sütunların genelini oransalar
     splitter-v-bottom-inner (iç dikey)  → splitX3: Deadline | Veri sınırını kaydırır
     splitter-v-bottom       (alt dikey)  → splitX2: Veri'nin sağ sınırını kaydırır
     splitter-h              (ANA yatay)  → splitY : üst/alt satırların genelini oransalar
     splitter-h-right        (sağ yatay)  → splitY2: yalnız Bugünkü İşler yüksekliği
   Çakışma garantisi: alt band soldan sağa "Deadline (sol=0) | Veri (sol=sx3+7)
   | Bugünkü (sol=sx2+7, sağ=0)" olarak üç ardışık dilime bölünür ve layoutDashGrid
   her zaman sx3 ≤ sx2−7 korur; dolayısıyla Veri'nin genişliği pozitiftir ve hiçbir
   panel diğerinin üzerine binmez. sy2 ise daima sy ≥ eşittir (aşağıdaki clamp),
   yani Bugünkü haritanın altında kalır. Böylece eksenler bağımsız sürüklenirken
   paneller birbirinin içine girmez.
   Sınırlar: her panel en az PANEL_MIN_W (250px) genişlik, PANEL_MIN_H (200px)
   yükseklik korur; konumlar piksel olarak tutulur, pencere boyutu değişince
   layoutDashGrid() aynı merkezlerle (min sınırlar içinde) yeniden yerleştirir.
   Harita, mevcut ResizeObserver sayesinde panel boyutu değiştiğinde kendiliğinden
   yeniden projeksiyonlanır (Leaflet invalidateSize eşdeğeri); sürükleme
   bırakıldığında da son durum için bir kez daha zorlanır. */
const PANEL_MIN_W = 250;
const PANEL_MIN_H = 200;
/* Panel ile ayırıcı arasındaki görsel boşluk. Hem CSS'teki "+7px" kaymalarıyla
   hem de tüm sürükleme kırpma hesaplarıyla aynı değeri kullanır; tek yerde
   tanımlı olması, iki tarafın zamanla ayrışmasını engeller. */
const DASH_SPLIT_GAP = 7;
/* ==========================================================================
   DÜZEN KALICI HALI — ORAN TABANLI ÖLÇEKLEME + KAYIT
   --------------------------------------------------------------------------
   Sorun: ayırıcılar konumu PİKSEL olarak tutuyordu. Kullanıcı bir kez
   ayar yapıp pencereyi büyütüp küçültünce paneller eski piksel değerlerinde
   kalıyor, yani kompozisyon bozuluyordu.

   Çözüm: her eksen için "kullanıcının istediği oran" (0..1) saklanır. Pencere
   boyutu değiştiğinde piksel değerler bu oranlarla yeniden hesaplanır:
   yeni_px = oran × yeni_W|yeni_H. Böylece paneller her boyutta aynı oranı
   korur, hiçbir zaman kaymaz ya da üst üste binmez.

   Kırpmadan ÖNCEki değerlerden oran alınır: böylece dar ekranda PANEL_MIN_W
   sınırına dayanan panel, ekran genişlediğinde kullanıcının gerçek oranına
   döner (kırpılmış değerin oranı kalıcılaşsaydı yerleşim kayardı).

   Oranlar iki yerden gelir:
     • localStorage (tarayıcıya kaydedilir, her açılışta geri yüklenir)
     • "Yedek İndir" JSON dosyası (başka tarayıcıya taşınabilir)
   ========================================================================== */
const DASH_LAYOUT_KEY = 'yaser_v10_dash_layout';
const DASH_RATIO_KEYS = ['x', 'x2', 'x3', 'y', 'y2'];
/* {x, x2, x3, y, y2} — hepsi 0..1 arası. null: kullanıcı henüz düzeni
   değiştirmedi, tema varsayılan oranları (CSS fallback'leri) kullanılır. */
let dashLayoutRatios = null;
/* Sürükleme sırasında oran→piksel dönüşümü yapılmaz. Aksi halde her karede
   layoutDashGrid() merkezleri kayıtlı oranla EZER ve sürükleme tutmazdı.
   Bayrak, merkezler doğrudan yazıldığı sürükleme boyunca açık kalır. */
let dashLayoutDragging = false;

/** Bir düzen nesnesini doğrular ve normalize eder; geçersizse null döner.
    Hem localStorage'dan gelen kayıt hem de "Yedek Yükle" ile gelen dosya
    bu kapıdan geçer → bozuk veri hiçbir koşulda panelleri bozmaz. */
function sanitizeDashLayout(r) {
    if (!r || typeof r !== 'object') return null;
    const out = {};
    for (const k of DASH_RATIO_KEYS) {
        const v = Number(r[k]);
        /* 0 ve 1 geçersiz: sıfır panel görünmez, 1 ise komşuyu ezerdi. */
        if (!Number.isFinite(v) || v <= 0 || v >= 1) return null;
        out[k] = v;
    }
    /* Eksenler arası mantık: x3 (Deadline|Veri sınırı) x2'nin (Veri'nin sağ
       sınırı) solunda kalmalı. Tersine bir kayıt varsa düzen çizilemez. */
    if (out.x3 > out.x2) return null;
    return out;
}

/** Kayıtlı düzen oranlarını okur; bozuk/geçersiz veri null döner. */
function loadDashLayout() {
    try {
        const raw = _zkRead(DASH_LAYOUT_KEY);
        if (!raw) return null;
        return sanitizeDashLayout(JSON.parse(raw));
    } catch (e) { return null; }
}

/** Düzen oranlarını localStorage'a yazar (private modda sessizce geçer). */
function saveDashLayout() {
    if (!dashLayoutRatios) return;
    try { _zkWrite(DASH_LAYOUT_KEY, JSON.stringify(dashLayoutRatios)); }
    catch (e) { /* kota dolu / private mod */ }
}

/** Oranları mevcut ızgaraya göre piksel merkezlere çevirip uygular.
    null verilirse tema varsayılanlarına (null) dönülür. */
function applyDashLayoutRatios(r) {
    dashLayoutRatios = r;
    const grid = document.getElementById('home-dashboard-grid');
    const W = grid ? grid.clientWidth : 0;
    const H = grid ? grid.clientHeight : 0;
    if (!r || W <= 0 || H <= 0) {
        dashSplitX = dashSplitX2 = dashSplitX3 = dashSplitY = dashSplitY2 = null;
        return;
    }
    dashSplitX  = r.x  * W;
    dashSplitX2 = r.x2 * W;
    dashSplitX3 = r.x3 * W;
    dashSplitY  = r.y  * H;
    dashSplitY2 = r.y2 * H;
}

/** Düzeni tema varsayılanlarına döndürür ve kaydı siler (ayırıcıya çift tık). */
function resetDashboardLayout() {
    try { _zkRemove(DASH_LAYOUT_KEY); } catch (e) { /* yoksay */ }
    applyDashLayoutRatios(null);
    layoutDashGrid();
}

/** Geçerli piksel merkezlerden oranları üretip kaydeder. Sürükleme
    bırakıldığında çağrılır: "kullanıcının istediği kompozisyon" oran olarak
    sabitlenir ve sonraki açılışlarda da her pencere boyutunda aynı oran
    kullanılır. */
function persistDashLayout() {
    const grid = document.getElementById('home-dashboard-grid');
    const W = grid ? grid.clientWidth : 0;
    const H = grid ? grid.clientHeight : 0;
    if (W <= 0 || H <= 0) return;
    /* Kırpılmış (geçerli) değerler merkezlerde duruyor; oranlar bunlardan
       alınır → kaydedilen oran her zaman EKRANA SIĞAN bir düzendir. */
    dashLayoutRatios = {
        x:  dashSplitX  / W,
        x2: dashSplitX2 / W,
        x3: dashSplitX3 / W,
        y:  dashSplitY  / H,
        y2: dashSplitY2 / H,
    };
    saveDashLayout();
}

/* Ekran payı değerleri (px). null iken CSS fallback'leri tema oranını verir. */
let dashSplitX = null;    /* splitX  — ANA dikey (harita | sağ kolon) */
let dashSplitX2 = null;   /* splitX2 — alt bölge dikey (Veri | Bugünkü) sağ sınırı */
let dashSplitX3 = null;   /* splitX3 — alt bölge iç dikey (Deadline | Veri) sınırı */
let dashSplitY = null;    /* splitY  — ANA yatay (üst satır | alt satır) */
let dashSplitY2 = null;   /* splitY2 — sağ bölge yatay (Aktif | Bugünkü) */
/* Alt bandın (Deadline|Veri|Bugünkü) o an geçerli minimum panel genişliği.
   Geniş ekranda PANEL_MIN_W (250), dar ekranda üçe bölünmüş değere düşer.
   layoutDashGrid hesaplar, CSS'e --band-min-w olarak yazar, sürükleme
   kırpma hesapları okur → CSS min-width ile JS kırpma aynı değeri kullanır. */
let dashBandMin = PANEL_MIN_W;

/* Ekran payı değerlerini CSS değişkenlerine yaz: grid içindeki tüm paneller ve
   ayırıcılar anında yeniden konumlanır. Değerler her eksende
   [PANEL_MIN, W|H - PANEL_MIN - 7] aralığına kırpılır; ayrıca sy2 ≥ sy
   korunur (aşağıdaki açıklama). Böylece hiçbir zaman panel kaybolmaz/taşmaz. */
function layoutDashGrid() {
    const grid = document.getElementById('home-dashboard-grid');
    if (!grid) return;
    const W = grid.clientWidth, H = grid.clientHeight;
    if (W <= 0 || H <= 0) return;

    const SPLIT = DASH_SPLIT_GAP; /* panel ile ayırıcı arasındaki görsel boşlük */

    /* ALT BAND minimum genişliği (normalize edilmiş): alt bantta artık ÜÇ panel
       var (Deadline | Veri | Bugünkü) ve üçü de bu bantta yan yana durur, yani
       bant 0..W aralığını paylaşır. Üçü birden PANEL_MIN_W'ye (250px) sığmayan
       dar ekranlarda (W < 3×250+2×7 = 764px) sabit taban kullanılırsa Veri
       paneli ezer ve tarayıcının min-width'i onu sağdaki panelin üstüne taşır.
       Bu yüzden taban, bant üç eşit panel alacak kadar daraldığında orantılı
       biçimde küçülür: (W − 2×SPLIT) / 3. Geniş ekranlarda bu değer 250'yi aşar
       ve PANEL_MIN_W'e kırpılır → mevcut davranış tam olarak korunur. */
    const bmMin = Math.min(PANEL_MIN_W, Math.floor((W - 2 * SPLIT) / 3));
    dashBandMin = bmMin;

    /* --- ORAN TABANLI ÖLÇEKLEME -------------------------------------------
       Kayıtlı düzen (dashLayoutRatios) varsa piksel merkezler ORAN olarak
       yeniden üretilir: px = oran × W|H. Kullanıcı bir kez ayar yapıp pencereyi
       büyütüp küçültünce paneller aynı oranı korur, yerleşim bozulmaz.
       Buradan sonraki tüm kırpma mantığı DEĞİŞMEZ.

       Sürükleme sırasında oranlar değil piksel merkezler güncellenir; oranlar
       sürükleme BİTİNCE (persistDashLayout) merkezlerden yeniden hesaplanır.
       Böylece sürükleme anında her karede yalnızca piksel oynar, oran yazımı
       (localStorage) tek seferde bırakma anında yapılır. */
    /* Kullanıcı hiç ayrılmadıysa bile oran temelli çalışalım: tema
       varsayılanları (52.3% / 50% vb.) orana çevrilip aşağıda kullanılır.
       Böylece "kayıt yok" durumunda da resize sırasında paneller oranını
       korur; davranış ilk açılışta birebir aynı kalır (0.52 ≈ 52.3% eşik
       değerleri tüm genişliklerde zaten geçerli olduğundan). */
    if (!dashLayoutRatios && !dashLayoutDragging) {
        dashLayoutRatios = { x: 0.52, x2: 0.52, x3: 0.52 * 0.58, y: 0.5, y2: 0.5 };
    }
    if (dashLayoutRatios && !dashLayoutDragging) {
        dashSplitX  = dashLayoutRatios.x  * W;
        dashSplitX2 = dashLayoutRatios.x2 * W;
        dashSplitX3 = dashLayoutRatios.x3 * W;
        dashSplitY  = dashLayoutRatios.y  * H;
        dashSplitY2 = dashLayoutRatios.y2 * H;
    }

    const sx  = Math.min(Math.max(dashSplitX  ?? W * 0.52, PANEL_MIN_W), W - PANEL_MIN_W - 7);
    /* sx2 YALNIZ alt bandın sağ sınırını belirler (#dash-panel-active üstte
       --px-main-v'i kullanır), dolayısıyla alt bandı üç panele sığdıracak
       şekilde daraltmak güvenlidir: taban = bmMin(Deadline) + SPLIT +
       bmMin(Veri). */
    const sx2 = Math.min(Math.max(dashSplitX2 ?? sx, 2 * bmMin + SPLIT), W - bmMin - SPLIT);
    /* Deadline | Veri iç ayırıcısı (sx3): sol alt bandın TAMAMINI DEĞİL, yalnız
       içindeki ilk panelin sol kenarı noktasıdır. Bu yüzden hem sol sınır olan
       bmMin'den, hem de sağdaki panelin de en az bmMin kalmasını garanti eden
       (sx2 − bmMin − SPLIT) üst sınırından kırpılır. Bu garanti, Veri panelinin
       genişliğini her zaman ≥ bmMin tutar → üç panel hiçbir zaman üst üste
       binmez, hiçbir zaman kaybolmaz. */
    const sx3 = Math.min(Math.max(dashSplitX3 ?? sx * 0.58, bmMin), Math.max(sx2 - bmMin - SPLIT, bmMin));
    const sy  = Math.min(Math.max(dashSplitY  ?? H * 0.5,   PANEL_MIN_H), H - PANEL_MIN_H - 7);
    /* sy2, hem "alt sınır H-MIN_H-7" hem de ÜST sınır "sy" ile sınırlıdır:
       Bugünkü paneli top = sy2+7 olduğundan sy2 < sy olsaydı haritanın (top=0,
       height=sy) sol-alt kısmının üzerine binerdi. sy2 ≥ sy garantisi
       "Bugünkü her zaman haritanın ALTINDA kalır" ve "Aktif'in alt kenarıyla
       (height=sy2) tam hizalı" demektir — yani sağ yatay ayırıcı yalnız sağ
       kolonu böler, sol alt (Deadline/Veri) panellerini hiç etkilemez. */
    const sy2 = Math.min(Math.max(dashSplitY2 ?? sy, sy), H - PANEL_MIN_H - 7);

    const st = grid.style;
    st.setProperty('--px-main-v',     sx  + 'px');
    st.setProperty('--px-left-w',     sx2 + 'px');
    st.setProperty('--px-deadline-w', sx3 + 'px');
    st.setProperty('--py-main-h',     sy  + 'px');
    st.setProperty('--py-right-h',    sy2 + 'px');
    /* CSS min-width ile JS kırpma aynı tabanı kullansın diye paylaşılır. */
    st.setProperty('--band-min-w',    bmMin + 'px');
    /* Kırpılmış (geçerli) değerleri merkezlere geri yaz → tutarlılık. */
    dashSplitX = sx; dashSplitX2 = sx2; dashSplitX3 = sx3; dashSplitY = sy; dashSplitY2 = sy2;
}

function initDashboardSplitters() {
    const grid = document.getElementById('home-dashboard-grid');
    const vSplit = document.getElementById('splitter-v');
    const vSplitB = document.getElementById('splitter-v-bottom');
    const vSplitBI = document.getElementById('splitter-v-bottom-inner');
    const hSplit = document.getElementById('splitter-h');
    const hSplitR = document.getElementById('splitter-h-right');
    if (!grid || !vSplit || !hSplit) return;

    /* Kayıtlı düzen (varsa) oranlardan gelir → aynı kompozisyon her açılışta
       ve her pencere boyutunda korunur. Kayıt yoksa null merkezler tema
       varsayılan oranlarına (CSS fallback) düşer. */
    applyDashLayoutRatios(loadDashLayout());
    layoutDashGrid();
    /* Pencere boyutu değişince aynı ORANLARLA (min sınırlar içinde)
       yeniden yerleştir → büyütüp küçültünce düzen bozulmaz. */
    window.addEventListener('resize', layoutDashGrid);

    /* Çift tık: ayarlanan düzeni temaya sıfırlar. */
    [vSplit, vSplitB, vSplitBI, hSplit, hSplitR].forEach(sp => {
        if (!sp) return;
        sp.addEventListener('dblclick', () => {
            resetDashboardLayout();
            if (activeView === 'home' && geojsonData && typeof renderD3Map === 'function') {
                window.requestAnimationFrame(() => renderD3Map());
            }
        });
    });

    /**
     * startDrag — bir ayırıcı için pointer-sürükleme akışı kurar.
     * @param {HTMLElement} splitter Sürüklenecek ayırıcı öğesi
     * @param {boolean} isRow  true: yatay (yükseklik), false: dikey (genişlik)
     * @param {(leftPx:number, topPx:number)=>void} apply
     *        İmleç koordinatını ilgili merkez değişkenine yazar.
     * @param {(rawLeftPx:number)=>number} [refine]
     *        Opsiyonel ek kırpma. Genel kırpma (PANEL_MIN_W…W−MIN−SPLIT)
     *        sonrasında çağrılır; komşu paneli ezmemek için gereken dar
     *        sınırları (ör. Deadline|Veri iç ayırıcısının splitX2'ye göre
     *        üst sınırı) burada eklenir.
     */
    const startDrag = (splitter, isRow, apply, refine, minW) => (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        try { splitter.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
        splitter.classList.add('dragging');
        document.body.classList.add('panel-resizing');
        if (isRow) document.body.classList.add('panel-resizing-row');
        /* Sürükleme boyunca oran→piksel dönüşümü devre dışı: merkezler
           doğrudan imleç konumundan yazılır. */
        dashLayoutDragging = true;

        const gridRect = grid.getBoundingClientRect();
        const SPLIT = DASH_SPLIT_GAP;

        const move = (ev) => {
            if (isRow) {
                if (gridRect.height <= PANEL_MIN_H * 2 + SPLIT) return;
                /* Yatay: imlecin Y konumu; paneller min yüksekliğin altına inmez. */
                const topPx = Math.min(Math.max(ev.clientY - gridRect.top, PANEL_MIN_H), gridRect.height - PANEL_MIN_H - SPLIT);
                apply(ev.clientX - gridRect.left, topPx);
            } else {
                /* Alt bandın üç paneli dar ekranda normalize edilmiş daha küçük
                   bir tabanı (dashBandMin) kullanır; o sürüklemelerde minW
                   onun değeridir. Üstteki iki panel her zaman PANEL_MIN_W. */
                const floor = (typeof minW === 'function') ? minW() : (typeof minW === 'number' ? minW : PANEL_MIN_W);
                if (gridRect.width <= floor * 2 + SPLIT) return;
                /* Dikey: imlecin X konumu; paneller min genişliğin altına inmez. */
                let leftPx = Math.min(Math.max(ev.clientX - gridRect.left, floor), gridRect.width - floor - SPLIT);
                if (typeof refine === 'function') leftPx = refine(leftPx);
                apply(leftPx, ev.clientY - gridRect.top);
            }
            layoutDashGrid();
        };
        const up = () => {
            splitter.classList.remove('dragging');
            document.body.classList.remove('panel-resizing', 'panel-resizing-row');
            splitter.removeEventListener('pointermove', move);
            splitter.removeEventListener('pointerup', up);
            splitter.removeEventListener('pointercancel', up);
            /* Sürükleme bitti: geçerli merkezleri orana çevirip KALICI kaydet.
               Bundan sonra pencere ne kadar değişirse değişsin aynı oranlar
               kullanılacak. Önce kilit açılır, sonra layoutDashGrid() bir kez
               daha çağrılıp render tazelenir. */
            dashLayoutDragging = false;
            persistDashLayout();
            layoutDashGrid();
            /* Sürükleme bitince haritayı son boyutla bir kez daha tazele.
               rAF ile bir kare bekleniyor: pointerup anında layout henüz
               okunmamış olabiliyor, ölçüm bir kare eski kalırdı. */
            if (activeView === 'home' && geojsonData && typeof renderD3Map === 'function') {
                window.requestAnimationFrame(() => renderD3Map());
            }
        };
        splitter.addEventListener('pointermove', move);
        splitter.addEventListener('pointerup', up);
        splitter.addEventListener('pointercancel', up);
    };

    /* ANA dikey: sol/sağ sütunların genelini oransalar. Sürükleme yalnız shiftX
       kadar kaydırır ve BAĞIMSIZ alt ayarı (splitX2 − splitX farkı) korur; yani
       kullanıcı "Veri panelini daralt" dediyse, ana dikey ayırıcı sürüklenirken
       o fark kaybolmaz, tüm sol/sağ oranı birlikte ölçeklenir. */
    vSplit.addEventListener('pointerdown', startDrag(vSplit, false,
        (leftPx) => {
            const shiftX = leftPx - dashSplitX;
            dashSplitX = leftPx;
            /* Alt band iki panel yerine üç panel barındırdığı için tabanı
               normalize edilmiş dashBandMin'dir (geniş ekranda 250). */
            dashSplitX2 = Math.max(dashSplitX + shiftX, dashBandMin * 2 + DASH_SPLIT_GAP);
            /* splitX3 (Deadline | Veri) da aynı kaydırma farkını korur → ana dikey
               ayırıcı sürüklenirken sol alt bandın iç oranı bozulmaz. */
            dashSplitX3 = Math.max(dashSplitX3 + shiftX, dashBandMin);
        }));
    /* Alt dikey (sol alt bandın SAĞ sınırı): Veri'nin sağ kenarını değiştirir —
       harita ve sağ kolon yerinde kalır. Deadline genişliği (splitX3) korunur,
       yalnız Veri ile Bugünkü arasındaki pay yeniden dağılır. */
    if (vSplitB) vSplitB.addEventListener('pointerdown', startDrag(vSplitB, false,
        (leftPx) => { dashSplitX2 = leftPx; }, null, () => dashBandMin));
    /* İç dikey (sol alt bandın İÇ sınırı): Deadline | Veri payını değiştirir.
       Veri paneli sıfıra sıkışmasın diye üst sınır splitX2'ye göre hesaplanır
       (Veri en az dashBandMin + SPLIT kalsın); bu yüzden startDrag'ın opsiyonel
       refine kancası kullanılır. */
    if (vSplitBI) vSplitBI.addEventListener('pointerdown', startDrag(vSplitBI, false,
        (leftPx) => { dashSplitX3 = leftPx; },
        (leftPx) => Math.min(leftPx, Math.max(dashSplitX2 - dashBandMin - DASH_SPLIT_GAP, dashBandMin)),
        () => dashBandMin));
    /* ANA yatay: üst/alt satırların genelini oransalar, bağımsız sağ ayarı
       (splitY2 − splitY farkı) koruyarak. */
    hSplit.addEventListener('pointerdown', startDrag(hSplit, true,
        (_px, topPx) => {
            const shiftY = topPx - dashSplitY;
            dashSplitY = topPx;
            dashSplitY2 = Math.max(dashSplitY + shiftY, dashSplitY);
        }));
    /* Sağ yatay: yalnız Bugünkü İşler (sağ alt) yüksekliğini değiştirir — sol
       üst (harita) ve sol alt (Veri) panelleri hiç etkilenmez. */
    if (hSplitR) hSplitR.addEventListener('pointerdown', startDrag(hSplitR, true,
        (_px, topPx) => { dashSplitY2 = topPx; }));
}

function renderMapTypeFilters() {
    const container = document.getElementById('map-type-filter-container');
    if (!container) return;
    
    const types = settings.tur || ["MSB", "EGM", "JGK", "-", "İDARE UYGULAMA", "KENTSEL", "TALEP"];
    const validTypes = types.filter(t => t !== '-');

    /* PERF: Her tür için ayrı `jobs.filter(...)` ile tüm iş listesi taranıyordu
       (tür sayısı × iş sayısı). Tek geçişte sayaç Map'i dolduruluyor. */
    const turCountMap = {};
    for (let i = 0; i < jobs.length; i++) {
        const tur = jobs[i].tur || '-';
        turCountMap[tur] = (turCountMap[tur] || 0) + 1;
    }

    let htmlBuffer = validTypes.map(t => {
        const isActive = activeMapTypeFilter === t;
        const count = turCountMap[t] || 0;
        return `
            <button class="map-type-filter-btn ${isActive ? 'active' : ''}" onclick="setMapTypeFilter('${escapeJsAttr(t)}')">
                <span>${escapeHtml(t)}</span>
                <span style="opacity:0.8; font-size:10px; font-weight:800;">(${count})</span>
            </button>
        `;
    }).join('');

    if (activeMapTypeFilter) {
        htmlBuffer += `
            <button class="map-type-filter-btn reset-btn" onclick="setMapTypeFilter(null)">
                <span><i class="fa-solid fa-xmark"></i> Sıfırla</span>
            </button>
        `;
    }

    container.innerHTML = htmlBuffer;
}

function setMapTypeFilter(type) {
    activeMapTypeFilter = type;
    renderMapTypeFilters();
    renderD3Map();
    if (selectedMapCity) {
        renderDrawerJobs(selectedMapCity);
    }
}

/* ==========================================================================
   İL ETİKETİ MÜREKKEBİ: zemine göre otomatik siyah / beyaz
   --------------------------------------------------------------------------
   SORUN: İl adları sabit beyazdı. Beyaz harf, açık zeminli her dolgunun
   üstünde kayboluyordu — choropleth'in düşük sayım ucu (#deebf7 civarı açık
   mavi), ısı bölgesi modunun kehribar/sar tonları (bilinen zemin: yalnızca
   uydu modunda koyu kontur vardı) ve tür süzgecinin açık hâli
   rgba(191,184,120,.85). Sabit tek renk bu üç yerde de okunmuyordu.

   ÇÖZÜM: Tema ya da mod değil, ZEMİN belirleyici. Her etiket kendi ilinin
   dolgu rengini (saydamlık uygulanmış hâliyle) harita zemininin üzerine
   düzleştirir, WCAG relative luminance ile açık ve koyu mürekkebin
   kontrastını hesaplar ve hangisi yüksekse onu seçer. Böylece harita
   paleti, filtreler, ısı bölgeleri veya tema değişse bile etiket her
   zaman okunur kalır; CSS'teki beyaz yalnızca JS hesabına girmeyen durumlar
   (ör. uydu görüntüsü) için yedek kalır.
   ========================================================================== */
/* Koyu zemin üstündeki mürekkep. Değer ÖLÇÜLMÜŞTÜR: d3.interpolateBlues
   rampının tamamı (0→1, 101 adım) + ısı bölgesi paleti + tür süzgeci
   altlığı tarandı. #0b1220 koyu lacivert, rampanın orta tonunda yalnızca
   4.35 kontrast verip AA'yı (4.5) geçemiyordu; saf siyah en kötü noktada
   4.64 veriyor. "Zemin rengine göre" mantığı sağlam kalsın diye mürekkep
   bu şekilde seçildi — dekoratif bir lacivert, ölçülebilir bir eşiği
   düşürüyordu. */
const MAP_LABEL_DARK_INK = '#000000';
const MAP_LABEL_LIGHT_INK = '#ffffff';

/* '#abc', '#aabbcc', '#aabbccdd', 'rgb()', 'rgba()' → [r, g, b, a(0..1)].
   Tanınmayan değerler fallback döner; çağıran yorumu kendi verir. */
function mapParseCssColor(value, fallback) {
    if (value === null || value === undefined) return fallback;
    const v = String(value).trim();
    if (!v) return fallback;
    if (v.charAt(0) === '#') {
        let h = v.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (h.length !== 6 && h.length !== 8) return fallback;
        return [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
            h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
        ];
    }
    const m = v.match(/rgba?\(([^)]+)\)/i);
    if (m) {
        const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
        if (parts.length >= 3 && parts.slice(0, 3).every(n => !Number.isNaN(n))) {
            return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
        }
    }
    return fallback;
}

/* WCAG 2.x relative luminance (sRGB → linear → ağırlıklı toplam) */
function mapRelativeLuminance(rgb) {
    const lin = rgb.slice(0, 3).map(v => {
        const s = Math.max(0, Math.min(255, v)) / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function mapContrastRatio(l1, l2) {
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
}

/* Yarı saydam dolguyu (fill + path opacity) altındaki harita zeminine basar */
function mapFlattenOn(fg, bg) {
    const a = Math.max(0, Math.min(1, fg[3]));
    return [
        fg[0] * a + bg[0] * (1 - a),
        fg[1] * a + bg[1] * (1 - a),
        fg[2] * a + bg[2] * (1 - a)
    ];
}

/* fill: css rengi, opacity: path'in opacity özniteliği, bgRgb: harita zemin rgb */
function mapLabelInk(fill, opacity, bgRgb) {
    const bg = bgRgb || [0x39, 0x46, 0x5a];
    const fg = mapParseCssColor(fill, [0x0f, 0x17, 0x2a, 1]);
    const o = (opacity === null || opacity === undefined || Number.isNaN(Number(opacity)))
        ? 1 : Math.max(0, Math.min(1, Number(opacity)));
    const bgLuminance = mapRelativeLuminance(mapFlattenOn([fg[0], fg[1], fg[2], fg[3] * o], bg));
    const lightLuminance = mapRelativeLuminance([255, 255, 255]);
    const darkLuminance = mapRelativeLuminance(mapParseCssColor(MAP_LABEL_DARK_INK, [0, 0, 0, 1]));
    return mapContrastRatio(bgLuminance, lightLuminance) >= mapContrastRatio(bgLuminance, darkLuminance)
        ? MAP_LABEL_LIGHT_INK
        : MAP_LABEL_DARK_INK;
}

function renderD3Map() {
    if (!geojsonData || !mapG) return;

    const wrapper = document.getElementById('map-wrapper-container');
    const width = wrapper ? wrapper.clientWidth : 800;
    const height = wrapper ? wrapper.clientHeight : 380;

    if (width <= 0 || height <= 0) return;

    mapSvg.attr("viewBox", `0 0 ${width} ${height}`);

    const padding = 12;
    const projection = d3.geoMercator().fitExtent([[padding, padding], [width - padding, height - padding]], geojsonData);
    const pathGenerator = d3.geoPath().projection(projection);

    mapG.selectAll("*").remove();

    const cityCountMap = {};
    const cityFilteredCountMap = {};

    jobs.forEach(j => {
        if (j.il) {
            const cName = j.il.trim();
            cityCountMap[cName] = (cityCountMap[cName] || 0) + 1;
            
            if (activeMapTypeFilter && (j.tur || '-') === activeMapTypeFilter) {
                cityFilteredCountMap[cName] = (cityFilteredCountMap[cName] || 0) + 1;
            }
        }
    });

    const maxCount = Math.max(1, ...Object.values(cityCountMap));

    const colorScale = d3.scaleSequential()
        .domain([0, maxCount])
        .interpolator(d3.interpolateBlues);

    const tooltip = d3.select("#map-tooltip");

    /* --- İl dolgusu ve saydamlığı TEK YERDE hesaplanır ---------------------
       Etiket mürekkebi de aynı değerlere bakıyor (aşağıdaki mapLabelInk
       çağrısı); iki hesabı ayrı yazmak "etiket rengi dolgudan eski kalır"
       hatasına açıktı. Sonuçlar feature → {fill, opacity} haritasında
       biriktirilir. */
    const featurePaint = new Map();
    const paintOf = (d, fill, opacity) => {
        featurePaint.set(d, { fill, opacity });
        return fill;
    };
    const opacityOf = (d, opacity) => {
        const p = featurePaint.get(d);
        if (p) p.opacity = opacity;
        return opacity;
    };
    const fillOf = d => {
        const cityName = d.properties.name || d.properties.NAME_1 || "";
        const totalCount = cityCountMap[cityName] || 0;
        const filterCount = cityFilteredCountMap[cityName] || 0;

        if (heatZonesActive) {
            const zone = getCityHeatZone(cityName);
            return zone ? zone.color : "#0f172a";
        }

        if (activeMapTypeFilter) {
            return filterCount > 0 ? "rgba(191, 184, 120, 0.85)" : "#0f172a";
        }

        return totalCount > 0 ? colorScale(totalCount) : "#0f172a";
    };
    const opacityFor = d => {
        if (heatZonesActive) {
            const zone = getCityHeatZone(d.properties.name || d.properties.NAME_1 || "");
            return zone ? 1 : 0.55;
        }
        if (!activeMapTypeFilter) return 1;
        const cityName = d.properties.name || d.properties.NAME_1 || "";
        return (cityFilteredCountMap[cityName] || 0) > 0 ? 1 : 0.8;
    };

    mapG.selectAll("path")
        .data(geojsonData.features)
        .enter()
        .append("path")
        .attr("class", d => {
            const cityName = d.properties.name || d.properties.NAME_1 || "";
            const isFilteredActive = activeMapTypeFilter && (cityFilteredCountMap[cityName] || 0) > 0;
            const isSelected = selectedMapCity && cityName === selectedMapCity;
            return `map-city-path ${isFilteredActive ? 'highlighted-filter' : ''} ${isSelected ? 'city-selected' : ''}`;
        })
        .attr("d", pathGenerator)
        .attr("fill", d => paintOf(d, fillOf(d), opacityFor(d)))
        .attr("opacity", d => opacityOf(d, opacityFor(d)))
        /* Uydu modunda il sınırları parlak ve belirgin kalır (SVG üstü stroke);
           iç dolgu yarı saydama çekilir → dağlar, denizler ve arazi detayları süzülür */
        .attr("stroke-width", () => (satelliteModeActive ? 1.5 : null))
        .attr("fill-opacity", () => (satelliteModeActive ? 0.45 : null))
        /* FX: ısı bölgesi açılışında iller merkezden dışa dalga şeklinde renklenir */
        .each(function(d) {
            if (!heatZonesActive) return;
            const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduceMotion) return;
            const [cx, cy] = pathGenerator.centroid(d);
            const dist = Math.hypot(cx - width / 2, cy - height / 2);
            const maxDist = Math.hypot(width / 2, height / 2) || 1;
            d3.select(this).transition()
                .delay(Math.round((dist / maxDist) * 420))
                .duration(500)
                .attr("fill-opacity", 0.25)
                .transition()
                .duration(420)
                .attr("fill-opacity", 1);
        })
        .on("mouseover", (event, d) => {
            const cityName = d.properties.name || d.properties.NAME_1 || "İl";
            /* PERF: Eskiden her hover'da tüm jobs dizisi filtreleniyordu
               (81 il × O(n) tarama). cityCountMap / cityFilteredCountMap
               renderD3Map başında zaten kuruldu; sayaçlar oradan okunur. */
            const totalCount = cityCountMap[cityName] || 0;
            const filteredCount = cityFilteredCountMap[cityName] || 0;
            const zone = heatZonesActive ? getCityHeatZone(cityName) : null;

            tooltip.style("display", "block")
                .html(`
                    <div class="zone-tooltip-head">
                        <h4 style="margin:0;">${escapeHtml(cityName)}</h4>
                        ${zone ? getZoneTooltipBadgeHtml(zone) : ''}
                    </div>
                    <div style="margin-top:5px;"><strong>Toplam Proje:</strong> ${totalCount} Adet</div>
                    ${activeMapTypeFilter ? `<div style="color:#bfb878;"><strong>Tür (${escapeHtml(activeMapTypeFilter)}):</strong> ${filteredCount} Adet</div>` : ''}
                    ${zone ? `<div class="zone-tooltip-notes">${getZoneNotesListHtml(zone, true)}</div>` : ''}
                `);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.clientX + 12) + "px")
                   .style("top", (event.clientY + 12) + "px");
        })
        .on("mouseleave", () => {
            tooltip.style("display", "none");
        })
        .on("click", (event, d) => {
            const cityName = d.properties.name || d.properties.NAME_1 || "";
            const prevCity = selectedMapCity;
            if (cityName) {
                /* Seçili il vurgusu: tıklanan il kehribar pulse + 3B ekstrüzyon alır ve
                   renderD3Map class'ı yeniden hesaplarken vurguyu korur. */
                selectedMapCity = cityName;
                /* İL DEĞİŞTİYSE ilçe seçimi düşer: eski ilin ilçesi yeni ilin
                   üstünde mühürlenmiş kalmasın. Aynı il yeniden tıklandıysa
                   seçim korunur (kullanıcı ilçeyi değiştirmek istemiyor olabilir). */
                if (prevCity !== cityName) selectedMapDistrict = null;
                mapG.selectAll(".map-city-path")
                    .classed('city-selected', function () {
                        const el = d3.select(this).datum() || {};
                        const n = el.properties ? (el.properties.name || el.properties.NAME_1 || "") : "";
                        return n === cityName;
                    });
                /* Kehribar pulse overlay'ini de tazele: önceki seçimin overlay'i
                   kalkar, yeni ilinki en üste çizilir (komşular örtemez). */
                refreshSelectedCityOverlay();
                openDashboardDrawerForCity(cityName);
            }
        });

    /* --- KOMŞU KARA ALANLARI: illerin ALTINA itilir (insert), tıklanamaz/nötr --- */
    if (neighborGeoData && neighborGeoData.features) {
        mapG.insert("g", ".map-city-path")
            .attr("class", "map-neighbors-layer")
            .selectAll("path")
            .data(neighborGeoData.features.filter(d => {
                const nName = (d.properties && (d.properties.name || d.properties.NAME_1)) || "";
                return NEIGHBOR_LANDMASSES.has(mapAsciiFold(nName));
            }))
            .enter()
            .append("path")
            .attr("class", "map-neighbor-land")
            .attr("d", pathGenerator)
            .attr("pointer-events", "none");
    }

    /* --- KIYI VURGUSU: denize kıyısı olan illere hafif cyan ışıma (dekoratif) --- */
    mapG.append("g")
        .attr("class", "map-coast-glow-layer")
        .selectAll("path")
        .data(geojsonData.features.filter(d => {
            const cName = (d.properties && (d.properties.name || d.properties.NAME_1)) || "";
            return COASTAL_PROVINCES.has(mapAsciiFold(cName));
        }))
        .enter()
        .append("path")
        .attr("class", "map-coast-glow-path")
        .attr("d", pathGenerator)
        .attr("pointer-events", "none");

    /* Uydu modunda zemin, hesaplanabilir bir CSS rengi değil: altlık raster
       görüntü ve poligonlar `fill-opacity: .45` ile yarı saydam. Dolguya
       bakarak karar vermek burada yanlış olurdu (opak varsayım, ortadaki
       mavilerde siyah mürekkebi seçiyordu). Bu modda tahmin yerine
       bilinen çözüme güvenilir: beyaz dolgu + koyu kontur (CSS kuralı). */
    const labelInk = satelliteModeActive
        ? () => MAP_LABEL_LIGHT_INK
        : d => {
            const paint = featurePaint.get(d);
            const b = mapParseCssColor(
                getComputedStyle(wrapper).getPropertyValue('--map-wrapper-bg'),
                [0x39, 0x46, 0x5a]
            ).slice(0, 3);
            return mapLabelInk(paint ? paint.fill : null, paint ? paint.opacity : 1, b);
        };

    mapG.selectAll("text")
        .data(geojsonData.features)
        .enter()
        .append("text")
        .attr("class", "map-city-label")
        /* Mürekkep INLINE STYLE olarak yazılıyor, `fill` özniteliği olarak
           değil: SVG'de bir CSS kuralı (`.map-city-label { fill: #fff }`)
           presentation attribute'ını da ezer. Yani attribute'a yazılan
           renk sessizce yutulurdu. Inline style her şeyi yener; uydu
           modundaki koyu kontur kuralı yalnızca `stroke`'a dokunduğu için
           bu değişiklik onu bozmaz. */
        .style("fill", d => {
            return labelInk(d);
        })
        .attr("transform", d => {
            const centroid = pathGenerator.centroid(d);
            return `translate(${centroid[0]}, ${centroid[1]})`;
        })
        .text(d => d.properties.name || d.properties.NAME_1 || "");

    /* --- SEÇİLİ İL OVERLAY: kehribar pulse, TÜM katmanların üstünde ---
       Etiketlerden sonra eklenir: glow etiketin altına kalır, isim okunur kalır. */
    renderSelectedCityOverlay(pathGenerator);

    /* --- İLÇE SINIRLARI: seçili ilin ilçe kontürleri ---
       Projeksiyon bu render'da yeniden kuruldu; _activeMapProjection güncellenir
       ve ilçe yolları aynı projeksiyonla yeniden çizilir. Seçim yoksa katman düşer. */
    _activeMapProjection = projection;
    renderDistrictBorders(selectedMapCity);

    updateSatelliteTilesAfterRender(width, height);

    updateMapLegendMode();

    /* Odak modu: render, seçili il seçiliyse blur + yakınlaştırmayı yeniden
       uygular (mapG her çizimde sıfırlandığı için bu kritik). Odak yokken
       transform'a dokunulmaz — kullanıcının kendi pan/zoom'u korunur. */
    if (selectedMapCity) {
        applyMapFocusDim(selectedMapCity);
        renderCityHoloChart(selectedMapCity);
        /* Projeksiyon fitExtent ile yeni genişliğe göre kurulduğu için eski
           transform artık kaymış olabilir; sessizce (geçişsiz) tazelenir.
           Panel sürüklemesi sırasında saniyede onlarca render geldiği için
           burada geçiş başlatmak haritayı titrettirirdi. */
        const t = computeCityFocusTransform(selectedMapCity, width, height);
        if (t) {
            mapFocusTransform = t;
            mapSvg.call(mapZoom.transform, t);
        }
    } else if (!isMapZoomed()) {
        resetMapZoom();
    }
}

/* ==========================================================================
   SEÇİLİ İL OVERLAY — kehribar pulse
   --------------------------------------------------------------------------
   Neden ayrı katman? Pulse doğrudan map-city-path üzerindeyken, GeoJSON'da
   seçili ilden SONRA gelen komşu illerin dolgusu ve 0.8px sınırı kehribar
   2.4px stroke'unun yarısını kapatıyordu. Sonuç: sınır bazı illerde neredeyse
   hiç, bazılarında parçalı görünüyordu. Aynı geometrinin bir kopyası tüm
   poligonlardan sonra çizilince hiçbir komşu onu örtemez → her ilde kesintisiz.

   Seçim değişince, görünüm yeniden render olunca veya filtre değişince
   çağrılır; eski overlay her seferinde düşürülüp yeniden kurulur (sızıntı yok).
   ========================================================================== */
function renderSelectedCityOverlay(pathGenerator) {
    if (!mapG) return;

    let feature = null;
    if (selectedMapCity && geojsonData && geojsonData.features) {
        feature = geojsonData.features.find(d => {
            const n = (d.properties && (d.properties.name || d.properties.NAME_1)) || "";
            return n === selectedMapCity;
        }) || null;
    }

    /* 3B ekstrüzyon kaldırıldı (kullanıcı isteği) — seçim yalnızca aşağıdaki
       kontur overlay'i ile gösterilir. */

    /* d3 data-join: seçim yoksa tek elemanlı boş küme verilir → eski overlay
       otomatik silinir (katman birikmesi olmaz), seçim varsa enter() ile
       DOM'a bağlanır. Kısmi seçimde mevcut path güncellenir, yeniden kurulmaz. */
    mapG.selectAll("path.map-city-overlay")
        .data(feature ? [feature] : [])
        .join(
            enter => enter.append("path")
                .attr("class", "map-city-overlay")
                .attr("d", pathGenerator),
            update => update.attr("d", pathGenerator)
        );
}

/* -------------------------------------------------------------------------- */
/* 3B İL EKSTRÜZYONU KALDIRILDI (kullanıcı isteği). renderCityExtrusion ve
   EXTRUDE_LAYERS silindi; seçili il artık yalnızca .map-city-overlay konturu
   ile vurgulanır. clearMapCitySelection ve refreshSelectedCityOverlay'deki
   eski katman temizlikleri geriye dönük uyumluluk için korundu — DOM'da
   kalmış eski katmanlar varsa da silinir. */
/* -------------------------------------------------------------------------- */

/* ==========================================================================
   İLÇE SINIRLARI — seçili ilin içindeki ilçe kontürleri
   --------------------------------------------------------------------------
   VERİ: geoBoundaries gbOpen/TUR/ADM2 (999 ilçe, ODbL — OpenStreetMap
   türevi açık veri). Dosya ~3.9MB simplified GeoJSON. github.com/raw
   adresi Git LFS'i çözer; raw.githubusercontent ise yalnızca LFS
   işaretçisi döndürür (ölçüldü: 132 bayt) — bu yüzden LFS ÇÖZEN adres
   kullanılır ve jsDelivr yedek olarak yazılmaz (jsDelivr LFS'i çözmez).

   İL İLİŞKİSİ: ADM2 kayıtlarında hangi ile ait olduğu YAZMAZ (yalnızca
   shapeName: "Elbeyli" gibi). Bu yüzden il-veri yüklendikten SONRA her
   ilin centroid'i d3.geoContains ile ilçe poligonlarına karşı test edilir
   ve districtOf{} haritası bir kez kurulur. 999 ilçe × 81 il testi,
   d3.geoContains'un uygulanışı itibarıyla kabaca ~200-400ms — bir kez.

   KULLANIM: Bir il seçilince o ilin ilçeleri .map-district-border olarak
   çizilir (renderDistrictBorders). Seçim kalkınca katman düşer.
   ========================================================================== */
let districtGeoData = null;                 /* geoBoundaries ADM2 FeatureCollection */
let districtOfProvince = null;              /* { "Adana": [feature, ...], ... } */
let districtIndexBuildInProgress = false;

const DISTRICT_DATA_SOURCES = [
    /* NOT (ölçülmüş): raw.githubusercontent bu dosyada yalnızca Git LFS
       işaretçisi döndürür (132 bayt); github.com/raw adresi LFS'i çözer
       ancak tarayıcıdan CORS engeline takılır. Bu yüzden birincil kaynak
       LFS medya adresi; github.com/raw yalnızca CORS engeli olmayan
       ortamlar (ör. file:// dışı sunucu) için yedekte kalır. */
    "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/TUR/ADM2/geoBoundaries-TUR-ADM2_simplified.geojson",
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM2/geoBoundaries-TUR-ADM2_simplified.geojson"
];

function loadDistrictBoundaries() {
    if (districtGeoData || districtIndexBuildInProgress) return;
    districtIndexBuildInProgress = true;

    const trySource = (i) => {
        if (i >= DISTRICT_DATA_SOURCES.length) {
            districtIndexBuildInProgress = false;
            return; /* ilçe katmanı opsiyoneldir; yüklenemezse harita aynen çalışır */
        }
        d3.json(DISTRICT_DATA_SOURCES[i])
            .then(data => {
                if (!data || !data.features || !data.features.length) throw new Error("boş veri");
                districtGeoData = data;
                districtIndexBuildInProgress = false;
                buildDistrictIndex();
                /* Harita açık ve bir il seçiliyse ilçeleri hemen göster. */
                if (selectedMapCity && mapG) renderDistrictBorders(selectedMapCity);
            })
            .catch(() => trySource(i + 1));
    };
    trySource(0);
}

/* İl→ilçe eşlemesini kur: her ilin centroid'i hangi ADM2 poligonunun
   içindeyse o ilçeyi o ile ata.

   DİKKAT (ölçülmüş hata): d3.geoContains BURADA KULLANILAMAZ. geoBoundaries
   ADM2 poligonlarının sarım yönü (winding order) d3'ün küresel kuralına ters:
   d3.geoArea her ilçeyi ~12.566 sr = TÜM DÜNYA yüzeyi olarak ölçüyor ve
   geoContains her nokta için true döndürüyor (ölçüm: her ile 972 ilçe
   atandı). d3geoContains antimeridian/küresel sarım kurallarına uyar; bu
   veri uymuyor. Bu yüzden klasik düzlem ray-casting kullanılır — d3'ün
   projeksiyonu da düzlemde çiziyor, birebir tutarlıdır. */
function pointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > lat) !== (yj > lat)) &&
            (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}
function pointInGeometry(lon, lat, geom) {
    if (!geom) return false;
    if (geom.type === "Polygon") {
        /* Dış halka içinde + deliklerde DEĞİL. */
        if (!pointInRing(lon, lat, geom.coordinates[0])) return false;
        for (let h = 1; h < geom.coordinates.length; h++) {
            if (pointInRing(lon, lat, geom.coordinates[h])) return false;
        }
        return true;
    }
    if (geom.type === "MultiPolygon") {
        return geom.coordinates.some(poly => {
            if (!pointInRing(lon, lat, poly[0])) return false;
            for (let h = 1; h < poly.length; h++) {
                if (pointInRing(lon, lat, poly[h])) return false;
            }
            return true;
        });
    }
    return false;
}

/* İl→ilçe eşlemesi: YÖN ÖNEMLİ (ölçülmüş hata). İlk denemedeİL centroid'ini
   ilçe poligonlarına karşı test ettim — bir NOKTA yalnızca TEK ilçeye düşer,
   bu yüzden her ile 1 ilçe atanmıştı (80/973). Doğrusu tersi: HER İLÇENİN
   kendi ağırlık merkezi hangi il poligonunun içindeyse, ilçeyi o ile ata.

   İlçe centroid'i için d3.geoCentroid KULLANILAMAZ (sarım yönü bozuk veri,
   merkez Pasifik'e düşüyordu); klasik shoelace ağırlık merkezi kullanılır.
   İl poligonuna karşı test yine pointInGeometry (düzlem ray-casting) ile
   yapılır — il verisi d3 ile doğru render ediliyor ama güvenlik için tek
   yöntem kullanılır. Hız: önce il bbox ön eleme (çoğu nokta 1-3 il görür),
   sonra ray-casting → 973 ilçe < 100ms. */

function planarCentroidOfGeometry(geom) {
    /* En büyük dış halkanın shoelace centroid'i. MultiPolygon'da en büyük
       parça seçilir (ada/ilçe parçaları ana gövdeyi değiştirmemeli). */
    let bestRing = null, bestArea = 0;
    const polys = geom.type === "Polygon" ? [geom.coordinates] :
                  geom.type === "MultiPolygon" ? geom.coordinates : [];
    polys.forEach(poly => {
        const ring = poly[0];
        let a = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
        }
        a /= 2;
        if (Math.abs(a) > bestArea) { bestArea = Math.abs(a); bestRing = ring; }
    });
    if (!bestRing || bestArea === 0) return null;
    let cx = 0, cy = 0;
    for (let i = 0, j = bestRing.length - 1; i < bestRing.length; j = i++) {
        const cross = bestRing[j][0] * bestRing[i][1] - bestRing[i][0] * bestRing[j][1];
        cx += (bestRing[j][0] + bestRing[i][0]) * cross;
        cy += (bestRing[j][1] + bestRing[i][1]) * cross;
    }
    const area6 = bestArea * 6;
    return [cx / area6, cy / area6];
}

function geometryBBox(geom) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const polys = geom.type === "Polygon" ? [geom.coordinates] :
                  geom.type === "MultiPolygon" ? geom.coordinates : [];
    polys.forEach(poly => poly[0].forEach(pt => {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
    }));
    return [minX, minY, maxX, maxY];
}

function buildDistrictIndex() {
    if (!districtGeoData || !geojsonData || !geojsonData.features) return;
    const map = {};
    const provinces = geojsonData.features.map(p => ({
        name: (p.properties && (p.properties.name || p.properties.NAME_1)) || "",
        geom: p.geometry,
        bbox: geometryBBox(p.geometry)
    })).filter(p => p.name);

    provinces.forEach(p => { map[p.name] = []; });

    const unassigned = [];
    districtGeoData.features.forEach(d => {
        const c = planarCentroidOfGeometry(d.geometry);
        if (!c) return;
        /* bbox ön eleme: yalnızca merkezini kapsayan illeri tam test et. */
        const candidates = provinces.filter(p =>
            c[0] >= p.bbox[0] && c[0] <= p.bbox[2] &&
            c[1] >= p.bbox[1] && c[1] <= p.bbox[3]);
        const hit = candidates.find(p => pointInGeometry(c[0], c[1], p.geom));
        if (hit) map[hit.name].push(d);
        else unassigned.push(d);
    });

    /* Merkezi hiçbir il poligonuna düşmeyen ilçeler (sınır sınırası, ada
       parçası vb.): en yakın il bbox merkezine ata — katman yine doğru
       bölgede çizilir ve ilçe sahipsiz kalmaz. */
    if (unassigned.length) {
        unassigned.forEach(d => {
            const c = planarCentroidOfGeometry(d.geometry);
            let best = null, bestD = Infinity;
            provinces.forEach(p => {
                const bc = [(p.bbox[0] + p.bbox[2]) / 2, (p.bbox[1] + p.bbox[3]) / 2];
                const dist = (bc[0] - c[0]) ** 2 + (bc[1] - c[1]) ** 2;
                if (dist < bestD) { bestD = dist; best = p; }
            });
            if (best) map[best.name].push(d);
        });
    }

    districtOfProvince = map;
}

/* Seçili ilin ilçe kontürlerini çizer. districtOfProvince henüz kurulmadıysa
   sessizce çıkar — veri geldiğinde loadDistrictBoundaries yeniden çağırır. */
function renderDistrictBorders(provinceName) {
    if (!mapG) return;
    if (!provinceName || !districtOfProvince) {
        clearDistrictLayers();
        return;
    }
    const list = districtOfProvince[provinceName] || [];
    const path = d3.geoPath().projection(currentMapProjection());

    mapG.selectAll("path.map-district-border")
        .data(list)
        .join(
            enter => enter.append("path")
                .attr("class", "map-district-border")
                .attr("d", path),
            update => update.attr("d", path),
            exit => exit.remove()
        );

    /* Tıklama şeridi görünür konturun ÜSTÜNE gelir ama saydam olduğu için
       görseli değiştirmez; sadece hedef alanı büyütür. */
    mapG.selectAll("path.map-district-hit")
        .data(list)
        .join(
            enter => enter.append("path")
                .attr("class", "map-district-hit")
                .attr("d", path)
                .on("mouseover", districtHoverOn)
                .on("mouseleave", districtHoverOff)
                .on("click", districtClickOn),
            update => update.attr("d", path),
            exit => exit.remove()
        );

    renderDistrictSelection();
}

/* Seçili ilçenin mührü. Ayrı katman: seçim değişince TÜM ilçe konturlarını
   yeniden çizmeye gerek kalmadan yalnızca bir path güncellenir. */
function renderDistrictSelection() {
    if (!mapG) return;
    const feat = selectedMapDistrict
        ? districtFeatureByName(selectedMapCity, selectedMapDistrict)
        : null;
    const path = d3.geoPath().projection(currentMapProjection());
    mapG.selectAll("path.map-district-overlay")
        .data(feat ? [feat] : [])
        .join(
            enter => enter.append("path")
                .attr("class", "map-district-overlay")
                .attr("d", path),
            update => update.attr("d", path)
        );
}

/* İlçe katmanlarını tamamen kaldırır (il seçimi bitti / veri yok). */
function clearDistrictLayers() {
    if (!mapG) return;
    mapG.selectAll("path.map-district-border").remove();
    mapG.selectAll("path.map-district-hit").remove();
    mapG.selectAll("path.map-district-overlay").remove();
}

/* ==========================================================================
   İLÇE SEÇİMİ — durum, ad eşleme ve tıklama/hover mantığı
   --------------------------------------------------------------------------
   selectedMapDistrict her zaman "o an seçili ilin ilçesi"; başka il seçilince
   KESİNLİKLE null olur (eski ilin ilçesi yanlış ilin üstünde asılı kalmak
   bugündü). Tek yazma noktası setSelectedMapDistrict().

   AD EŞLEME: geoBoundaries ADM2 alanı shapeName bazen Türkçe karakterleri
   sadeleştirmiş olabiliyor (örn. "Selcuklu"). Bu yüzden karşılaştırma iki
   kademelidir: önce birebir, sonra ASCII katlanmış denklik. Böylece haritada
   seçilen ilçe ile kayıttaki elle yazılmış ilçe adı da eşleşir.
   ========================================================================== */
let selectedMapDistrict = null;   /* seçili ilin ilçe adı (geoBoundaries shapeName) */

function setSelectedMapDistrict(cityName, districtName) {
    selectedMapDistrict = (districtName && cityName && selectedMapCity === cityName) ? districtName : null;
    renderDistrictSelection();
    renderDrawerDistrictBar();
}

/* geoBoundaries ADM2 alan adı: shapeName birincil, diğerleri yedek. */
function districtNameOf(feature) {
    const p = feature && feature.properties;
    return (p && (p.shapeName || p.name || p.NAME_2 || p.NAME_1)) || "";
}

/* Karşılaştırma anahtarı: Türkçe/aksan normalize + ayraçları sadeleştir.
   "Beyşehir 2" ≈ "beyşehir" gibi varyantları da yakalar. */
function districtMatchKey(s) {
    return mapAsciiFold(String(s == null ? '' : s))
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/* İlçe adı → feature. Önce birebir, sonra ASCII katlanmış denklik. */
function districtFeatureByName(cityName, districtName) {
    const list = (districtOfProvince && districtOfProvince[cityName]) || [];
    if (!list.length) return null;
    const exact = list.find(f => districtNameOf(f) === districtName);
    if (exact) return exact;
    const key = districtMatchKey(districtName);
    if (!key) return null;
    return list.find(f => districtMatchKey(districtNameOf(f)) === key) || null;
}

/* İş kaydının bir ilçeye ait olup olmadığı: il BİREBİR eşleşmeli, ilçe
   ASCII katlanmış denklikle. Boş ilçe "tüm il" demektir. */
/* İş kaydının bir ilçeye ait olup olmadığı: il BİREBİR eşleşmeli, ilçe
   ASCII katlanmış denklikle. Boş ilçe "tüm il" demektir.

   İL EŞLEME NOTU: mapAsciiFold tabanlıdır, bu yüzden "Afyonkarahisar"
   ile "Afyon" burada zaten eşleşmez — o yüzden kayıt tarafı resmî form adını
   taşır, harita tarafı "Afyon" der. districtMapKeyOf bu köprüyü kurar. */
/* İL ANAHTARINI ÇÖZER — takma ad VEYA büyük/küçük harf farkı.
   İki ayrı boşluk vardı (ikisi de ölçülerek düzeltildi):
     1. CITY_NAME_ALIASES tamamen küçük harfli: {afyon:'afyonkarahisar'},
        dropdown ise "Afyonkarahisar" der → karşılaştırma katlanmalı.
     2. districtOfProvince'in anahtarları İL GEOJSON'UNUN yazımıdır: "Afyon"
        (baş harf büyük). Dönen "afyon" alias'ı bu nesnede YOKTUR.
   Bu yüzden: alias'ı bul, sonra districtOfProvince'te gerçek anahtarı ara
   (katlanmış). districtOfProvince null ise alias'ın kendisi döner. */
function districtMapKeyOf(cityName) {
    const key = mapAsciiFold(cityName).trim();
    let aliasMatch = null;
    for (const alias of Object.keys(CITY_NAME_ALIASES || {})) {
        if (mapAsciiFold(CITY_NAME_ALIASES[alias]).trim() === key) { aliasMatch = alias; break; }
    }
    const candidates = aliasMatch ? [aliasMatch, cityName] : [cityName];
    if (districtOfProvince) {
        const actual = Object.keys(districtOfProvince).find(k => candidates.some(c => mapAsciiFold(k).trim() === mapAsciiFold(c).trim()));
        if (actual) return actual;
    }
    return aliasMatch || cityName || '';
}

function jobMatchesDistrict(job, cityName, districtName) {
    if (!job || !job.il) return false;
    /* İKİ TARAF DA aynı harita anahtarına indirgenmeli. Ölçülen hata: kayıt
       "Afyonkarahisar", harita anahtarı "Afyon"; tek tarafı çözmek eşleşmeyi
       bozuyordu (Afyon işleri hiçbir ilçeye bağlanamıyordu). */
    if (districtMapKeyOf(job.il) !== districtMapKeyOf(cityName)) return false;
    if (!districtName) return true;
    return districtMatchKey(job.ilce) === districtMatchKey(districtName);
}

/* İlçe tıklaması: harita zaten bir il seçili olduğu için (ilçe konturları
   yalnızca seçili ilin üstünde çizilir) burada il seçimini TAZELEMEK gerekmez;
   yalnızca mühür değişir ve çekmecedeki ilçe filtresi güncellenir. Çekmece
   kapalıysa AÇILMAZ — kullanıcı haritadan gezinirken panelin zorla açılması
   rahatsız eder. */
function districtClickOn(event, d) {
    event.stopPropagation();
    const districtName = districtNameOf(d);
    if (!districtName || !selectedMapCity) return;
    if (selectedMapDistrict === districtName) return;
    setSelectedMapDistrict(selectedMapCity, districtName);
    renderDrawerJobs(selectedMapCity);
}

/* Hover: görünür konturu kalınlaştırır ve ilçenin iş sayısını tooltip'te
   gösterir.

   İKİ UYGULAMA NOTU:
     • d3'nin `.siblings()` YOKTUR (ölçüldü: TypeError). Kardeş border
       path'lerine ulaşmak için ortak ebeveyn (mapG) üzerinden seçilir.
     • `tooltip` değişkeni renderD3Map'in İÇİNDE const olarak tanımlıdır, bu
       fonksiyonlara görünmez. Bu yüzden her seferinde DOM'dan taze seçilir. */
function districtHoverOn(event, d) {
    const cityName = selectedMapCity;
    const districtName = districtNameOf(d);
    if (!cityName || !districtName) return;
    markDistrictHover(d, true);

    const total = jobs.filter(j => jobMatchesDistrict(j, cityName, districtName)).length;
    d3.select("#map-tooltip").style("display", "block")
        .html(`
            <div class="zone-tooltip-head">
                <h4 style="margin:0;">${escapeHtml(districtName)}</h4>
            </div>
            <div style="color:var(--txt-muted); margin-top:2px; font-size:11.5px;">${escapeHtml(cityName)} ilçesi</div>
            <div style="margin-top:5px;"><strong>Toplam Proje:</strong> ${total} Adet</div>
            <div style="color:#7dd3fc; margin-top:4px; font-size:11px;"><i class="fa-solid fa-arrow-pointer"></i> Seçmek için tıkla</div>
        `);
}

function districtHoverOff() {
    if (!mapG) return;
    mapG.selectAll("path.map-district-border").classed("is-hover", false);
    d3.select("#map-tooltip").style("display", "none");
}

/* Verilen ilçenin görünür konturuna (veya istenirse tüm konturlara) hover
   sınıfını uygular. districtMatchKey ile eşleştirilir: hit ve border
   path'leri aynı listeden geldiği için isim normalde birebir tutar, ama
   MultiPolygon parçalarında aynı ilçe adı birden çok path'te bulunabilir. */
function markDistrictHover(d, on) {
    if (!mapG) return;
    const districtName = districtNameOf(d);
    const key = districtMatchKey(districtName);
    mapG.selectAll("path.map-district-border")
        .classed("is-hover", function () {
            return on && districtMatchKey(districtNameOf(d3.select(this).datum())) === key;
        });
}

/* Aktif projeksiyonu döndürür: renderD3Map her çağrıda projection'ı yeniden
   kurar; ilçe yolları da AYNI projeksiyonu kullanmalı ki illerle çakışsın.
   currentMapProjection null ise (harita hiç çizilmediyse) fitExtent ile
   görünümden bağımsız bir tane üretir. */
let _activeMapProjection = null;
function currentMapProjection() {
    if (_activeMapProjection) return _activeMapProjection;
    const wrapper = document.getElementById('map-wrapper-container');
    const width = wrapper ? wrapper.clientWidth : 800;
    const height = wrapper ? wrapper.clientHeight : 380;
    return d3.geoMercator().fitExtent([[12, 12], [width - 12, height - 12]], geojsonData || {type: "FeatureCollection", features: []});
}

/* Seçim değişti ama harita yeniden çizilmediyse (ör. sadece class güncellendiği
   akışlar) overlay'i tazelemek için dışarıdan çağrılabilir; renderD3Map yolunda
   zaten renderSelectedCityOverlay çalıştığı için bu bir yedek kapıdır. */
function refreshSelectedCityOverlay() {
    if (!geojsonData || !mapG) return;
    /* Seçim boşsa overlay de kalkmalı. Burada erken dönmek eski kehribar
       sınırı ekranda bırakırdı; temizlik her zaman yapılır. */
    if (!selectedMapCity) {
        mapG.selectAll("path.map-city-overlay").remove();
        mapG.selectAll("g.map-city-extrude-layer").remove();
        return;
    }
    const wrapper = document.getElementById('map-wrapper-container');
    const width = wrapper ? wrapper.clientWidth : 800;
    const height = wrapper ? wrapper.clientHeight : 380;
    if (width <= 0 || height <= 0) return;
    const padding = 12;
    const projection = d3.geoMercator().fitExtent([[padding, padding], [width - padding, height - padding]], geojsonData);
    _activeMapProjection = projection;
    renderSelectedCityOverlay(d3.geoPath().projection(projection));
    /* İlçe katmanı da aynı projeksiyonla tazelenir: tıklama akışı (path click →
       refreshSelectedCityOverlay → openDashboardDrawerForCity) renderD3Map'ten
       GEÇMEZ; ilçeler yalnızca renderD3Map'te çizilseydi tıklamada görünmezdi
       (ölçülmüş hata: Van seçiminde districtPaths=0). */
    renderDistrictBorders(selectedMapCity);
}

/* --------------------------------------------------------------------------
   Zoom durumu tek kaynaktan okunur: "g" üzerindeki transform'dan k=1 ve
   translate=0 olmadığı sürece kullanıcı yakınlaştırmış/pan etmiştir demektir.
   renderD3Map bunu sıfırlamaz; sadece AÇIKÇA istendiğinde sıfırlanır.
   -------------------------------------------------------------------------- */
function isMapZoomed() {
    if (!mapG) return false;
    const t = mapG.attr("transform");
    if (!t) return false;
    const m = /scale\(([-\d.e]+)\)/.exec(t);
    if (!m || Math.abs(parseFloat(m[1]) - 1) > 0.001) return true;
    const tr = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(t);
    if (tr && (Math.abs(parseFloat(tr[1])) > 0.5 || Math.abs(parseFloat(tr[2])) > 0.5)) return true;
    return false;
}

function resetMapZoom() {
    if (!mapSvg || !mapZoom || !geojsonData) return;

    /* Odak modu aktifken bu düğme "odaktan çık" demektir: yalnız zoom'u
       sıfırlamak bulanık çevreyi ve hologramı ekranda bırakırdı. */
    if (mapFocusTransform) {
        closeMapFocusMode();
        return;
    }

    const wrapper = document.getElementById('map-wrapper-container');
    const width = wrapper ? wrapper.clientWidth : 800;
    const height = wrapper ? wrapper.clientHeight : 380;

    if (width === 0 || height === 0) return;

    /* PERF: Aynı transform zaten aktifse hiçbir şey yapma. Eskiden bu
       fonksiyon renderD3Map'ın sonunda HER çağrıda 400ms'lik transition
       başlatıyordu; panel sürüklemesi (ResizeObserver) sırasında saniyede
       onlarca kez tetiklenince geçişler üst üste biniyor, kullanıcının
       zoom/pan'i sıfırlanıyor ve düğme animasyonu takılıyordu.
       Artık yalnız gerçekten bozulmuşsa ve kimse geçiş başlatmamışsa
       yumuşak sıfırlama yapılır; aktif geçiş varsa kesilmez (yok sayılır). */
    if (!isMapZoomed()) return;
    if (mapSvg.node().__transition) {
        const ids = Object.keys(mapSvg.node().__transition);
        if (ids.length) return; /* bir geçiş zaten uçuşta → dokunma */
    }

    mapSvg.transition().duration(400).call(
        mapZoom.transform,
        d3.zoomIdentity
    );
}

/* 3B WEBGL HARİTA MOTORU TAMAMEN KALDIRILDI ---------------------------------
   Three.js tabanlı 3B harita denemesinden vazgeçildi; motor, düğmesi,
   canvas/status/hint DOM'u ve tüm yardımcı fonksiyonları silindi.
   İhtiyaç hâlinde yedekten geri alınabilir:
   index.snapshot-20261012-before-cleanup.html */

function zoomMap(factor) {
    if (mapSvg && mapZoom) mapSvg.transition().duration(300).call(mapZoom.scaleBy, factor);
}

/* ==========================================================================
   İL ODAK MODU + HOLOGRAFİK TÜR GRAFİĞİ
   --------------------------------------------------------------------------
   Akış: bir ile tıklanınca openDashboardDrawerForCity → focusCityOnMap.
   1) Harita o ile yakınlaşır (geometri ortalanır, k en fazla 6×).
   2) Seçili il dışındaki her katman .map-focus-dim alır → CSS blur + solukluk.
   3) Sağ altta holografik tür grafiği belirir.

   Neden ayrı bir "focus" durumu? renderD3Map her çağrıldığında mapG'yi boşaltıp
   yeniden kurar (panel sürüklemesi sırasında saniyede onlarca kez). Blur'u
   render'ın içine yazsaydık her yeniden çizimde sınıflar düşerdi. Bu yüzden
   odak, DOM'da değil durumda (selectedMapCity + mapFocusTransform) tutulur ve
   her render sonrasında yeniden UYGULANIR.

   mapFocusTransform: d3.zoomIdentity. Projeksiyon renderD3Map içinde yeniden
   kurulduğu için (fitExtent yeni genişliğe göre) transform eski kareye göre
   hesaplanmış olur; bu yüzden focusCityOnMap her render sonunda yeniden
   çağrılır ve transform yeni geometriye göre tazelenir.
   ========================================================================== */
let mapFocusTransform = null;   /* d3.zoomIdentity | null */
let mapFocusTimer = null;       /* focus geçiş animasyonu iptali */

/* Tür → renk. Deterministik hash: türün sırası listede değişse de rengi sabit
   kalır (aynı tür her açılışta aynı rengi alır, kullanıcı yön bulur). */
const HOLO_TYPE_PALETTE = [
    '#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185',
    '#22d3ee', '#f472b6', '#a3e635', '#f97316', '#818cf8',
    '#2dd4bf', '#e879f9'
];

function holoTypeColor(type) {
    const s = String(type || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return HOLO_TYPE_PALETTE[h % HOLO_TYPE_PALETTE.length];
}

/* Seçili ilin tür dağılımını tek geçişte hesaplar. Tür listesi settings.tur'dan
   gelir (aynı kaynak renderMapTypeFilters ile) → grafik ile sol kenar çubuğu
   daima aynı tür kümesini gösterir. */
function collectCityTypeBreakdown(cityName) {
    const configured = settings.tur || ["MSB", "EGM", "JGK", "-", "İDARE UYGULAMA", "KENTSEL", "TALEP"];
    const order = configured.filter(t => t !== '-');
    const counts = {};
    jobs.forEach(j => {
        if (!j.il || j.il.trim() !== cityName) return;
        const tur = j.tur || '-';
        if (tur === '-') return;         /* türü olmayan işler grafikte yer almaz */
        counts[tur] = (counts[tur] || 0) + 1;
    });
    /* Listede olmayan türler (sonradan eklenmiş olabilir) sona eklenir. */
    Object.keys(counts).forEach(t => { if (!order.includes(t)) order.push(t); });
    const rows = order
        .map(t => ({ type: t, count: counts[t] || 0 }))
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count);
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { rows, total };
}

/* Holografik grafiği kurar. Boş ilde "kayıt yok" mesajı gösterir. */
function renderCityHoloChart(cityName) {
    const el = document.getElementById('map-holo');
    if (!el) return;
    if (!cityName) {
        el.classList.remove('is-open');
        el.innerHTML = '';
        el.dataset.city = '';
        return;
    }

    /* AYNI İL İÇİN TEKRAR ÇAĞRI → DOM'U KURMA, yalnızca aktif tür işaretini
       tazele. Neden: renderD3Map her çizimde bu fonksiyonu çağırıyor ve ayrıca
       bir tür süzgeci tıklaması da çağırıyor. innerHTML ile yeniden kurmak,
       tıklanan satır düğümünü DOM'dan koparıyordu; global "harita dışına
       tıkla → çekmeceyi kapat" kontrolü bu kopmuş düğümü artık kapsayamıyor
       ve hedefi bulamayınca çekmece + odak yanlışlıkla kapanıyordu.
       Koşullu güncelleme aynı zamanda daha az DOM işidir. */
    if (el.dataset.city === cityName) {
        el.querySelectorAll('.map-holo-row').forEach(row => {
            const t = row.dataset.tur;
            row.classList.toggle('is-filter-active', activeMapTypeFilter === t);
        });
        el.classList.add('is-open');
        return;
    }

    const { rows, total } = collectCityTypeBreakdown(cityName);
    const maxCount = rows.length ? rows[0].count : 0;

    const rowsHtml = rows.length
        ? rows.map(r => {
            const pct = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
            const activeCls = activeMapTypeFilter === r.type ? ' is-filter-active' : '';
            return `
                <div class="map-holo-row${activeCls}" data-tur="${escapeJsAttr(r.type)}" style="--hc:${holoTypeColor(r.type)}"
                     onclick="setMapTypeFilter('${escapeJsAttr(r.type)}')"
                     title="${escapeHtml(r.type)}: ${r.count} iş — türe göre filtrele">
                    <span class="map-holo-name">${escapeHtml(r.type)}</span>
                    <span class="map-holo-val">${r.count}</span>
                    <span class="map-holo-track"><span class="map-holo-bar" data-pct="${pct.toFixed(1)}"></span></span>
                </div>`;
        }).join('')
        : `<div class="map-holo-empty">Bu il için türü belirtilmiş iş kaydı yok.</div>`;

    el.innerHTML = `
        <div class="map-holo-head">
            <span class="map-holo-city">${escapeHtml(cityName)}</span>
            <span class="map-holo-total">${total} İŞ</span>
            <button class="map-holo-close" onclick="closeMapFocusMode()" title="Odak modunu kapat" aria-label="Kapat">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        ${rowsHtml}
        <div class="map-holo-foot">Tür Dağılımı</div>`;

    el.classList.add('is-open');
    el.dataset.city = cityName;

    /* Bar genişlikleri DOM'a yazıldıktan SONRA uygulanır: aksi halde geçiş
       başlamaz ve tüm barlar 0'dan bir anda zıplardı (hologram hissi bozulur). */
    requestAnimationFrame(() => {
        el.querySelectorAll('.map-holo-bar').forEach(bar => {
            bar.style.width = `${bar.dataset.pct}%`;
        });
    });
}

/* Seçili ili haritada yakınlaştırır ve çevresini bulanıklaştırır.
   Yakınlaştırma k'sı sabit bir üst sınıra (6) kırpılır ve transform
   ekranın ortasına göre hesaplanır; böylece Konya gibi büyük iller de
   haritadan taşmaz, küçük iller (Iğdır) de görünür kalır. */
function focusCityOnMap(cityName) {
    if (!mapSvg || !mapZoom || !geojsonData || !mapG) return;

    /* 1) Katmanları bulanıklaştır: seçili il dışındaki her yol ve etiket soluk. */
    applyMapFocusDim(cityName);

    /* 2) Holografik tür grafiğini (yeniden) kur. */
    renderCityHoloChart(cityName);

    /* 2.5) İLÇE KATMANI: tüm seçim akışları (harita tıklaması, istatistik
       satırı, çekmece) buraya uğrar; projeksiyon günceldir. Statik çizim
       zoom transition'ından bağımsızdır — önce çizilir, odak sonra yumuşar. */
    renderDistrictBorders(cityName);

    if (!cityName) { mapFocusTransform = null; return; }

    const wrapper = document.getElementById('map-wrapper-container');
    const width = wrapper ? wrapper.clientWidth : 800;
    const height = wrapper ? wrapper.clientHeight : 380;
    const t = computeCityFocusTransform(cityName, width, height);
    if (!t) return;

    mapFocusTransform = t;

    /* Geçiş çalışırken başka bir il seçilirse eskiyi iptal et. */
    if (mapFocusTimer) { clearTimeout(mapFocusTimer); mapFocusTimer = null; }
    mapSvg.interrupt();
    mapSvg.transition().duration(650).ease(d3.easeCubicOut).call(mapZoom.transform, t);
}

/* Bir il için ekran-merkezli odak transform'u hesaplar. renderD3Map ile BİREBİR
   aynı projeksiyonu (fitExtent + padding) yeniden kurar; centroid bu karede
   geçerli olduğu için transform yeni render'da da doğru oturur.
   Geometri yoksa / ölçü sıfırsa null döner (çağıran taraf dokunmaz). */
function computeCityFocusTransform(cityName, width, height) {
    if (!geojsonData || !cityName) return null;
    if (!(width > 0) || !(height > 0)) return null;

    const feature = geojsonData.features.find(d => {
        const n = (d.properties && (d.properties.name || d.properties.NAME_1)) || "";
        return n === cityName;
    });
    if (!feature) return null;

    const padding = 12;
    const projection = d3.geoMercator().fitExtent([[padding, padding], [width - padding, height - padding]], geojsonData);
    const centroid = d3.geoPath().projection(projection).centroid(feature);
    if (!centroid || !isFinite(centroid[0]) || !isFinite(centroid[1])) return null;

    /* Hedef k: illerin en büyüğü (Ankara/İzmir) haritaya sığacak kadar büyük,
       en küçüğü (Iğdır) okunur kalacak kadar büyük. 6 güvenli bir tavan. */
    const targetK = Math.min(6, Math.max(2.4, Math.min(width, height) / 260));
    return d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(targetK)
        .translate(-centroid[0], -centroid[1]);
}

/* Blur uygulaması: durumdan türetilir, DOM'dan değil. renderD3Map her çizimde
   sınıfları sıfırladığı için bu her render sonrasında yeniden çağrılır. */
function applyMapFocusDim(cityName) {
    if (!mapG) return;
    const focus = cityName || null;
    mapG.selectAll(".map-city-path")
        .classed("map-focus-dim", d => {
            const n = (d.properties && (d.properties.name || d.properties.NAME_1)) || "";
            return !!focus && n !== focus;
        });
    mapG.selectAll(".map-city-label")
        .classed("map-focus-dim", d => {
            const n = (d.properties && (d.properties.name || d.properties.NAME_1)) || "";
            return !!focus && n !== focus;
        });
    /* Komşu ülke kara alanları ve kıyı ışıması da geri planda kalmalı. */
    mapG.selectAll(".map-neighbors-layer, .map-coast-glow-layer")
        .classed("map-focus-dim", !!focus);
    /* Uydu tile katmanı varsa o da bulanıklaşır. */
    mapG.selectAll(".map-tiles-g")
        .classed("map-focus-dim", !!focus);
}

/* Odak modunu tümüyle kapatır: zoom sıfırlanır, blur kalkar, grafik kapanır. */
function closeMapFocusMode() {
    mapFocusTransform = null;
    applyMapFocusDim(null);
    renderCityHoloChart(null);
    if (mapSvg && mapZoom && geojsonData) {
        mapSvg.interrupt();
        mapSvg.transition().duration(520).ease(d3.easeCubicOut).call(mapZoom.transform, d3.zoomIdentity);
    }
}

/* Seçim yapıldığında hemen çağrılır. */
function openDashboardDrawerForCity(cityName) {
    if (activeView !== 'home') return;
    selectedMapCity = cityName;
    document.getElementById('drawer-city-title').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${escapeHtml(cityName)} Projeleri`;
    renderDrawerJobs(cityName);
    _applyStaggerIndex(document.getElementById('drawer-jobs-body'));
    document.getElementById('dashboard-drawer').classList.add('open');
    /* YENİ İL SEÇİLDİ → önceki ilçe seçimi düşer. setSelectedMapDistrict
       bu koşulu zaten uygular (city eşleşmezse null yapar), ama burada
       doğrudan temizlik daha açık: eski ilin ilçesi asılı kalmasın. */
    setSelectedMapDistrict(cityName, null);
    renderDrawerDistrictBar();
    /* Çekmece açıldıktan SONRA harita odaklanır: çekmce açılışı paneli
       reflow ettirebiliyor, önce çalıştırırsak yanlış genişliğe göre ölçeriz. */
    requestAnimationFrame(() => focusCityOnMap(cityName));
}

/* Harita seçimi dört ayrı yerde tutulur: selectedMapCity (değişken),
   .map-city-path.city-selected (dolgu + ince kehribar sınır),
   path.map-city-overlay (üstteki 2.4px pulse) ve
   g.map-city-extrude-layer (3B yan duvar + taban gölgesi). Hepsi birlikte
   kurulur, hepsi birlikte SİLİNMELİ; tek birini bırakmak panel kapanınca
   haritada "hâlâ seçili" gibi görünen bir blok bırakır.
   Odak modu (bulanık çevre + grafik + zoom) da aynı anda temizlenir. */
function clearMapCitySelection() {
    selectedMapCity = null;
    /* Kullanıcı kendi zoom/pan'ını yapmış olabilir; sıfırlamadan önce durumu
       not et, çünkü renderD3Map odak kapalıyken resetMapZoom'u tetikler. */
    const wasFocus = !!mapFocusTransform;
    mapFocusTransform = null;
    if (mapG) {
        mapG.selectAll(".map-city-path").classed('city-selected', false);
        /* stroke-width zoom handler'ı satır içi style yazmıştı; temizlikte
           o inline değer de düşmeli, yoksa CSS tabanlı genişlik geri gelmez. */
        mapG.selectAll(".map-city-path").style("stroke-width", null);
        mapG.selectAll("path.map-city-overlay").remove();
        mapG.selectAll("g.map-city-extrude-layer").remove();
        /* İLÇE KATMANI: il seçimi bitti → ilçe seçimi de biter, kontürler düşer. */
        selectedMapDistrict = null;
        clearDistrictLayers();
        renderDrawerDistrictBar();
    }
    applyMapFocusDim(null);
    renderCityHoloChart(null);
    if (wasFocus && mapSvg && mapZoom && geojsonData) {
        mapSvg.interrupt();
        mapSvg.transition().duration(520).ease(d3.easeCubicOut).call(mapZoom.transform, d3.zoomIdentity);
    }
}

function closeDashboardDrawer() {
    const drawer = document.getElementById('dashboard-drawer');
    if (drawer) drawer.classList.remove('open');
    /* Çekmece kapanınca seçim de biter: aksi halde kehribar pulse + 3B blok
       ekranda kalır ve hangi ilin açık olduğu görünmez. */
    clearMapCitySelection();
}

/* ==========================================================================
   ŞEHİR ÖZETİ — DİNAMİK METRİK HESAPLARI
   --------------------------------------------------------------------------
   Haritadan bir il seçilince çekmecenin üstünde gösterilen özet şeridinin
   verisini üretir. Saf fonksiyon: DOM'a dokunmaz, yalnızca nesne döndürür.

   VERİ KAYNAKLARI (var olan şema):
     · ihale_bedeli → "45.500.000 TL" gibi metin → parseTrNumber
     · insaat_alani  → "18851" gibi metin        → parseTrNumber
     · asama         → getStatusBadgeClass ile kurumsal aşama rozeti
     · start_date/end_date → computeDeadlineProgress üzerinden süre durumu

   İKİ KURAL:
     1) ALAN GEÇERLİLİĞİ: isValidAreaForStats() kullanılır; birim fiyat esaslı
        işlerde alan kasıtlı 0'dır ve toplama GİRİLMEZ (0'ı katlamak yanlış
        m² göstergesidir). Geçerli alanı olan kayıt sayısı ayrıca yazılır.
     2) AŞAMA SAYIMI: getStatusBadgeClass() tek kaynak olarak korunur; böylece
        çekmece rozetleri tablolarla/özet panellerle aynı renk ve sınıf
        eşleşmesini kullanır.
   ========================================================================== */
function computeCitySummary(cityJobs) {
    const sum = { totalBedel: 0, bedelKayit: 0, totalAlan: 0, alanKayit: 0 };
    const asama = { proje: 0, ihale: 0, yapim: 0, bekleme: 0, iptal: 0, bitti: 0 };
    let overdueCount = 0;
    let nearest = null; /* {daysLeft, end_date} */

    (cityJobs || []).forEach(j => {
        const bedel = parseTrNumber(j.ihale_bedeli);
        if (bedel !== null && bedel > 0) { sum.totalBedel += bedel; sum.bedelKayit++; }

        if (isValidAreaForStats(j)) {
            sum.totalAlan += parseTrNumber(j.insaat_alani);
            sum.alanKayit++;
        }

        const cls = getStatusBadgeClass(j.asama);
        if (cls === 'status-proje') asama.proje++;
        else if (cls === 'status-ihale') asama.ihale++;
        else if (cls === 'status-yapim') asama.yapim++;
        else if (cls === 'status-bekleme') asama.bekleme++;
        else if (cls === 'status-iptal') asama.iptal++;
        else if (cls === 'status-bitti') asama.bitti++;

        /* Zaman: yalnız "Proje" aşamasındaki işlerde anlamlı (mevcut kural). */
        const p = computeDeadlineProgress(j);
        if (!p.ok) return;
        if (p.overdue) overdueCount++;
        /* En yakın teslim = en küçük pozitif kalan gün. Gecikmiş işler
           "yaklaşan" sayılmaz; onlar overdue sayacında ayrı raporlanır. */
        if (p.daysLeft >= 0 && (nearest === null || p.daysLeft < nearest.daysLeft)) {
            nearest = { daysLeft: p.daysLeft, end_date: j.end_date };
        }
    });

    return {
        totalBedel: sum.totalBedel, bedelKayit: sum.bedelKayit,
        totalAlan: sum.totalAlan, alanKayit: sum.alanKayit,
        asama: asama, overdueCount: overdueCount, nearest: nearest
    };
}
/** Tek bir iş kartının bedel/alan rozetlerini üretir (saf HTML). */
function buildJobMetricChips(j) {
    const bedel = parseTrNumber(j.ihale_bedeli);
    const alan = isValidAreaForStats(j) ? parseTrNumber(j.insaat_alani) : null;

    const bedelChip = (bedel !== null && bedel > 0)
        ? `<span class="drawer-job-metric"><i class="fa-solid fa-coins"></i>${formatTrNumber(bedel, 0)} ₺</span>`
        : `<span class="drawer-job-metric is-empty"><i class="fa-solid fa-coins"></i>Bedel yok</span>`;

    const alanChip = (alan !== null && alan > 0)
        ? `<span class="drawer-job-metric"><i class="fa-solid fa-ruler-combined"></i>${formatTrNumber(alan, 0)} m²</span>`
        : `<span class="drawer-job-metric is-empty"><i class="fa-solid fa-ruler-combined"></i>Alan yok</span>`;

    return `<div class="drawer-job-metrics">${bedelChip}${alanChip}</div>`;
}

/** computeCitySummary çıktısını çekmecenin üst şeridine basar (saf HTML üretir). */
function buildCitySummaryHtml(s) {
    const bedelTxt = s.bedelKayit > 0 ? formatTrNumber(s.totalBedel, 0) : '—';
    const alanTxt = s.alanKayit > 0 ? formatTrNumber(s.totalAlan, 0) : '—';

    /* Ortalama birim fiyat yalnız her iki toplam da geçerliyse anlamlıdır;
       birim fiyat esaslı işlerde alan 0 olduğu için bölme hatası olurdu. */
    const birimFiyat = (s.alanKayit > 0 && s.totalBedel > 0)
        ? formatTrNumber(s.totalBedel / s.totalAlan, 0) : null;

    /* Aşama rozetleri: yalnız sıfırdan farklı olanlar gösterilir. */
    const stageDefs = [
        { key: 'proje',   label: 'Proje',   bg: 'var(--badge-proje-bg)',   fg: 'var(--badge-proje-txt)',   bd: 'var(--badge-proje-border)' },
        { key: 'ihale',   label: 'İhale',   bg: 'var(--badge-ihale-bg)',   fg: 'var(--badge-ihale-txt)',   bd: 'var(--badge-ihale-border)' },
        { key: 'yapim',   label: 'Yapım',   bg: 'var(--badge-yapim-bg)',   fg: 'var(--badge-yapim-txt)',   bd: 'var(--badge-yapim-border)' },
        { key: 'bekleme', label: 'Bekleme', bg: 'var(--badge-bekleme-bg)', fg: 'var(--badge-bekleme-txt)', bd: 'var(--badge-bekleme-border)' },
        { key: 'iptal',   label: 'İptal',   bg: 'var(--badge-iptal-bg)',   fg: 'var(--badge-iptal-txt)',   bd: 'var(--badge-iptal-border)' },
        { key: 'bitti',   label: 'Bitti',   bg: 'var(--badge-bitti-bg)',   fg: 'var(--badge-bitti-txt)',   bd: 'var(--badge-bitti-border)' }
    ];
    const stageChips = stageDefs
        .filter(d => s.asama[d.key] > 0)
        .map(d => `<span class="drawer-stage-chip" style="background:${d.bg}; color:${d.fg}; border:1px solid ${d.bd};">${d.label} <b>${s.asama[d.key]}</b></span>`)
        .join('');

    /* Zaman satırı: gecikme uyarısı > yaklaşan teslim > tarih yok. */
    let deadlineLine;
    if (s.overdueCount > 0) {
        deadlineLine = `<div class="drawer-deadline-line is-overdue">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span><span class="dd-count">${s.overdueCount}</span> işte süre aşımı var</span>
        </div>`;
    } else if (s.nearest) {
        const gun = s.nearest.daysLeft;
        const warnCls = gun <= 30 ? ' is-warn' : '';
        deadlineLine = `<div class="drawer-deadline-line${warnCls}">
            <i class="fa-solid fa-clock"></i>
            <span>En yakın teslim: <span class="dd-count">${formatDeadlineDate(s.nearest.end_date)}</span> (${gun} gün)</span>
        </div>`;
    } else {
        deadlineLine = `<div class="drawer-deadline-line">
            <i class="fa-solid fa-circle-info"></i>
            <span>Aşama "Proje" olan ve tarih girilmiş iş bulunmuyor</span>
        </div>`;
    }

    return `<div class="drawer-kpi-strip">
        <div class="drawer-kpi-row">
            <div class="drawer-kpi-card">
                <span class="drawer-kpi-label"><i class="fa-solid fa-coins"></i> Toplam İhale Bedeli</span>
                <span class="drawer-kpi-value">${bedelTxt}<span style="font-size:10px; font-weight:700;"> ₺</span></span>
                <span class="drawer-kpi-sub">${s.bedelKayit} kayıtta</span>
            </div>
            <div class="drawer-kpi-card">
                <span class="drawer-kpi-label"><i class="fa-solid fa-ruler-combined"></i> Toplam İnşaat Alanı</span>
                <span class="drawer-kpi-value">${alanTxt}<span style="font-size:10px; font-weight:700;"> m²</span></span>
                <span class="drawer-kpi-sub">${birimFiyat ? 'Birim fiyat ₺' + birimFiyat : s.alanKayit + ' kayıtta'}</span>
            </div>
        </div>
        ${stageChips ? `<div class="drawer-stage-bar">${stageChips}</div>` : ''}
        ${deadlineLine}
    </div>`;
}

/* Çekmecenin üstündeki ilçe şeridi: seçili ilçenin adı, o ilçedeki iş
   sayısı, "tüm il"e dönme ve o ilçeye yeni iş kaydı açma kısayolu.
   Şerit doğrudan drawer-header'ın ALTINA enjekte edilir; çekmecenin kendi
   gövdesi (drawer-jobs-body) yalnızca iş listesini barındırır, böylece ilçe
   filtresi listeden bağımsız yaşar ve liste yeniden çizilince kaybolmaz. */
function renderDrawerDistrictBar() {
    const bar = document.getElementById('drawer-district-bar');
    if (!bar) return;
    /* İL SEÇİMİ YOK → bar gizlenir. selectedMapCity kontrolü metin
       güncellemesinden ÖNCE gelmeli: eski hâlde il seçimi kalkınca erken
       dönüyor ve bar ekranda kalıyordu (görünür ama boş şerit). */
    if (!selectedMapCity || !selectedMapDistrict) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';

    /* YALNIZCA METİN GÜNCELLENİR, innerHTML DEĞİL.
       Ölçülen hata: butonların onclick'i bar'ı yeniden kurduğunda (eski hâl)
       butonun kendisi DOM'dan KOPYOR. Tıklama olayı çekmece dışındaki global
       listener'a ulaştığında e.target artık drawer.contains() için false
       dönüyor → çekmece kendi düğmesine tıklanınca kapanıyordu. Statik
       iskelet + metin güncellemesi bu sorunu kökten bitirir (ve her seçimde
       DOM yeniden kurulmaz). */
    const total = jobs.filter(j => jobMatchesDistrict(j, selectedMapCity, selectedMapDistrict)).length;
    const nameEl = document.getElementById('ddb-district-name');
    const metaEl = document.getElementById('ddb-district-meta');
    if (nameEl) nameEl.textContent = selectedMapDistrict + ' İlçesi';
    if (metaEl) metaEl.textContent = selectedMapCity + ' • ' + total + ' kayıtlı iş';
}

function clearMapDistrictSelection() {
    if (!selectedMapCity) return;
    setSelectedMapDistrict(selectedMapCity, null);
    renderDrawerJobs(selectedMapCity);
}

/* "Bu ilçeye iş ekle": modalı hazırlayıp İl ve İlçe alanlarını seçili ilçe
   ile doldurur. Kullanıcı haritada gezinirken tek tıkla doğru ilçeye
   kayıt açabilir — formun İlçe alanı bu akışta da harita verisiyle eşleşir. */
function openJobModalForDistrict() {
    if (!selectedMapCity || !selectedMapDistrict) return;
    openJobModal();
    const ilSelect = document.getElementById('form-il');
    if (ilSelect) ilSelect.value = selectedMapCity;
    const ilceInput = document.getElementById('form-ilce');
    if (ilceInput) ilceInput.value = selectedMapDistrict;
    /* İl değiştiği için ilçe listesi ve ısı bölgesi bulutu tazelenmeli. */
    populateDistrictDropdown();
    updateJobZoneCloud();
}

function renderDrawerJobs(cityName) {
    const container = document.getElementById('drawer-jobs-body');
    let cityJobs = jobs.filter(j => j.il && j.il.trim().toLowerCase() === cityName.toLowerCase());

    if (activeMapTypeFilter) {
        cityJobs = cityJobs.filter(j => (j.tur || '-') === activeMapTypeFilter);
    }

    /* İLÇE FİLTRESİ: haritada bir ilçe seçiliyse liste o ilçeye iner. İlçe
       seçili değilse davranış birebir eskisi gibi (tüm il). */
    if (selectedMapDistrict) {
        cityJobs = cityJobs.filter(j => jobMatchesDistrict(j, cityName, selectedMapDistrict));
    }

    if (cityJobs.length === 0) {
        container.innerHTML = `<div style="color:var(--txt-muted); font-size:13.2px; text-align:center; margin-top:20px;"><strong>${escapeHtml(cityName)}</strong> ilinde ${selectedMapDistrict ? `<b>${escapeHtml(selectedMapDistrict)}</b> ilçesinde` : ''} ${activeMapTypeFilter ? `<b>${escapeHtml(activeMapTypeFilter)}</b> türüne ait` : ''} kayıtlı iş bulunamadı.</div>`;
        return;
    }

    /* Özet şeridi: hesaplanan finansal/operasyonel metrikler en üstte. */
    const summary = computeCitySummary(cityJobs);

    const targetConfigs = [
        { key: "Proje", title: "Projedeki İşler", emoji: "🟢", color: "var(--badge-proje-txt)", borderColor: "#10b981" },
        { key: "İhale", title: "İhaledeki İşler", emoji: "🔵", color: "var(--badge-ihale-txt)", borderColor: "#3b82f6" },
        { key: "Yapım", title: "Yapımdaki İşler", emoji: "⚪", color: "var(--badge-yapim-txt)", borderColor: "#94a3b8" },
        { key: "Bekleme", title: "Beklemedeki İşler", emoji: "🟡", color: "var(--badge-bekleme-txt)", borderColor: "#f59e0b" },
        { key: "İptal", title: "İptal Edilen İşler", emoji: "🔴", color: "var(--badge-iptal-txt)", borderColor: "#f43f5e" }
    ];

    const processedJobIds = new Set();
    /* Özet şeridi listenin başına sabitlenir (flex-shrink:0 CSS ile). */
    let htmlBuffer = buildCitySummaryHtml(summary);

    targetConfigs.forEach(config => {
        const matchingJobs = cityJobs.filter(j => {
            const asamaText = (j.asama || '').toLocaleLowerCase('tr-TR');
            const keyText = config.key.toLocaleLowerCase('tr-TR');
            return asamaText.includes(keyText);
        });

        if (matchingJobs.length > 0) {
            matchingJobs.forEach(j => processedJobIds.add(j.id));

            htmlBuffer += `
                <div class="drawer-status-group">
                    <div class="drawer-status-title" style="background: rgba(255,255,255,0.05); color: ${config.color}; border-left: 3px solid ${config.borderColor};">
                        <span>${config.emoji} ${config.title}</span>
                        <span>(${matchingJobs.length})</span>
                    </div>
                    ${matchingJobs.map(j => `
                        <div class="drawer-job-item" style="border-left: 3px solid ${config.borderColor};" onclick="viewJobDetail('${j.id}')">
                            <div class="drawer-job-emoji">${config.emoji}</div>
                            <div class="drawer-job-info">
                                <div class="drawer-job-title">${escapeHtml(j.is_tanimi)}</div>
                                <div class="drawer-job-subtext">Kategori/Protokol: ${escapeHtml(j.section || '250Bin')} • Tür: ${escapeHtml(j.tur || '-')} • Aşama: ${escapeHtml(j.asama || config.title)}</div>
                                ${buildJobMetricChips(j)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    });

    const otherJobs = cityJobs.filter(j => !processedJobIds.has(j.id));
    if (otherJobs.length > 0) {
        htmlBuffer += `
            <div class="drawer-status-group">
                <div class="drawer-status-title" style="background: rgba(255,255,255,0.05); color: var(--txt-sub); border-left: 3px solid var(--surface-border-strong);">
                    <span>⚪ Diğer / Biten İşler</span>
                    <span>(${otherJobs.length})</span>
                </div>
                ${otherJobs.map(j => `
                    <div class="drawer-job-item" style="border-left: 3px solid var(--surface-border-strong);" onclick="viewJobDetail('${j.id}')">
                        <div class="drawer-job-emoji">⚪</div>
                        <div class="drawer-job-info">
                            <div class="drawer-job-title">${escapeHtml(j.is_tanimi)}</div>
                            <div class="drawer-job-subtext">Kategori/Protokol: ${escapeHtml(j.section || '250Bin')} • Tür: ${escapeHtml(j.tur || '-')} • Aşama: ${escapeHtml(j.asama || 'Bitti')}</div>
                            ${buildJobMetricChips(j)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = htmlBuffer;
}

/* ==========================================================================
   İSTATİSTİK EKRANI (view-stats)
   Tüm aggregation'lar tek geçişte (collectStatsData) toplanır; KPI kartlarıyla
   birebir aynı eşleşme kuralları kullanılır: türler için kesin EGM/JGK/MSB
   eşleşmesi + DİĞER, aşamalar için KPI_ASAMA_ALL ilk-eşleşme tablosu.
   Grafikler harici kütüphanesiz saf CSS ile çizilir; inline onclick yalnızca
   il satırlarında statsOpenCity çağrısı için kullanılır (il adı escape'li).
   Panel açılışında grafik animasyonları statsAnimateOnOpen() ile tetiklenir
   (bar genişleme, donut dönüşü, kolon yükselmesi, sayaç animasyonu);
   prefers-reduced-motion açıkken animasyonlar atlanır.
   ========================================================================== */
const STATS_YEAR_START = 2016;
const STATS_OUTLIER_DAYS = 3650; /* İhale→Sözleşme aykırılık eşiği (10+ yıl) */

/* ==========================================================================
   İSTATİSTİK FİLTRE DURUMU (statsFilter)
   Paneldeki tüm kartlar TEK bir filtre kümesini paylaşır: arama metni,
   seçili yıl, seçili aşama ve "yalnız eksik verili işler" anahtarı.
   Filtre değiştiğinde veri kümesi yeniden hesaplanır ve tüm grafikler
   baştan çizilir; böylece kartlar birbirinden bağımsız değil, TEK bir
   görünümün parçası olur.
   Durum `statsFilter` içinde tutulur, çünkü renderStatisticsView her çağrıda
   yeniden kurulur; DOM yeniden basıldığında filtre kaybolmasın.
   ========================================================================== */
const statsFilter = {
    q: '',
    year: null,      /* sözleşme yılı; null = tüm yıllar */
    asama: null,     /* aşama etiketi; null = tüm aşamalar */
    onlyGaps: false  /* yalnız eksik verili işler */
};

/** Bir iş kaydının metin kutusundaki aramayı karşılayıp karşılamadığını söyler.
    Yalnızca GÖSTERİLECEK alanlar taranır (iş adı, il, yüklenici, aşama, tür);
    kullanıcı "bedel" yazınca sayısal alanlarda eşleşme beklemez. */
function statsJobMatchesQuery(job, q) {
    if (!q) return true;
    const haystack = [job.is_tanimi, job.il, job.ilce, job.yuklenici, job.asama, job.tur, job.section]
        .map(v => (v == null ? '' : String(v)).toLocaleLowerCase('tr-TR')).join(' ');
    /* Türkçe'ye duyarlı arama: "İ" için "i", "I" için "ı" eşleşmelerini de
       yakalamak adına iki biçimde normalize edip karşılaştırır. */
    const norm = s => s.replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/Ş/g, 's').replace(/Ğ/g, 'g').replace(/Ü/g, 'u').replace(/Ö/g, 'o').replace(/Ç/g, 'c');
    const nq = norm(q.toLocaleLowerCase('tr-TR'));
    return norm(haystack).includes(nq);
}

/** Bir iş kaydının "eksik veri" anahtarını açıp açmayacağını belirler.
    Eksik = ihale bedeli, inşaat alanı veya sözleşme tarihinden en az biri boş.
    Bu üç alan panelin sayısal grafiklerini beslediği için boş olan işler
    o grafiklerde görünmez; kullanıcı tam olarak bunları arayabilmelidir. */
function statsJobHasGaps(job) {
    const cost = parseTrNumber(job.ihale_bedeli);
    const area = parseTrNumber(job.insaat_alani);
    return (cost === null || cost <= 0) || (area === null || area <= 0) || !parseFlexibleDate(job.sozlesme_tarihi);
}

/** Etkin filtre kümesini döndürür — boş filtrede TÜM kayıtlar.
    `skipYear` yıl filtresini atlar; yıl grafiğinin kendisi o yıl filtresinden
    ETKİLENMEMELİ: kullanıcı 2020'yi seçtiğinde şeritte yalnız 2020 ve yanında
    boş sütunlar görürse "neden yükseliyor" sorusunu cevaplayamaz. */
function statsApplyFilter(srcJobs, skipYear) {
    const f = statsFilter;
    const q = f.q.trim();
    /* Yıl seçimi sözleşme tarihine göre yapılır; geçersiz/boş tarih hiçbir
       yıla ait değildir, bu yüzden yıl filtresi açıkken o işler elenir. */
    return (srcJobs || jobs).filter(j => {
        if (!skipYear && f.year !== null) {
            const t = parseFlexibleDate(j.sozlesme_tarihi);
            if (t === null || new Date(t).getUTCFullYear() !== f.year) return false;
        }
        if (f.asama !== null) {
            const asamaLower = (j.asama || '').toLocaleLowerCase('tr-TR');
            if (!asamaLower.includes(f.asama.toLocaleLowerCase('tr-TR'))) return false;
        }
        if (f.onlyGaps && !statsJobHasGaps(j)) return false;
        return statsJobMatchesQuery(j, q);
    });
}

/** Filtre değişti: durumu yaz, tüm paneli yeniden çiz, URL/odak korunur. */
function statsSetFilter(patch) {
    Object.assign(statsFilter, patch);
    renderStatisticsView();
}

/** Filtreleri tek tuşla temizler (araç çubuğundaki "Temizle"). */
function statsClearFilter() {
    statsFilter.q = '';
    statsFilter.year = null;
    statsFilter.asama = null;
    statsFilter.onlyGaps = false;
    renderStatisticsView();
}

/** Yıl kolonuna tıklandı: aynı yıl seçiliyse seçimi kaldırır. */
function statsToggleYear(year) {
    statsSetFilter({ year: statsFilter.year === year ? null : year });
}

/** Araç çubuğu arama kutusuna yazar (bilgisayar klavyesinden). */
function statsSetQuery(q) {
    statsSetFilter({ q: q });
}

function collectStatsData() {
    const D = {
        total: jobs.length,
        ilSayisi: 0, ilBilinmeyen: 0,
        toplamAlan: 0, alanKayit: 0, toplamBedel: 0, bedelKayit: 0,
        /* Ortalama m² birim fiyatı: yalnız alanı VE bedeli > 0 olan kayıtlardan
           hesaplanır. 0 m² (birim fiyat esaslı) işler dışarıda kalır. */
        m2Price: computeAverageM2Price(jobs),
        /* 0 m² yazan (birim fiyat esaslı) kayıt sayısı — ayak notlarında
           "neden toplam alana girmiyor" sorusunu yanıtlar. */
        alanSifirKayit: 0,
        turCounts: { EGM: 0, JGK: 0, MSB: 0, DIGER: 0 },
        asamaCounts: {}, asamaBilinmeyen: 0,
        yearCounts: {}, yearMin: 0, yearMax: 0,
        avgDays: null, avgUsed: 0, avgOutlier: 0, avgInvalid: 0, avgNegatif: 0
    };
    KPI_ASAMA_ALL.forEach(a => { D.asamaCounts[a] = 0; });
    const ilCounts = {};
    const costPairs = [];
    const areaPairs = [];
    const timeDiffs = [];
    const nowYear = new Date().getUTCFullYear();
    const yearStart = Math.min(STATS_YEAR_START, nowYear);
    /* Tüm aggregation'lar FİLTRELENMİŞ küme üzerinden yapılır. jobs.length
       yalnızca "hiç kayıt yok" durumunu ve kayıt sayısı rozetlerini besler;
       grafiklerin içeriği her zaman bu küme üzerinden hesaplanır. */
    const scoped = statsApplyFilter(jobs);
    D.filtered = scoped.length;
    /* Yıl sayımları yıl filtresinden BAĞIMSIZ tutulur: şerit, seçili yılın
       bağlamını (geçen yıla göre artış/düşüş) korumalıdır. Diğer filtreler
       (arama, aşama, eksik veri) yıl grafiğine de uygulanır. */
    const yearScope = statsApplyFilter(jobs, true);
    const yearCounts = {};
    yearScope.forEach(j => {
        const t = parseFlexibleDate(j.sozlesme_tarihi);
        if (t === null) return;
        const y = new Date(t).getUTCFullYear();
        yearCounts[y] = (yearCounts[y] || 0) + 1;
        if (D.yearMin === 0 || y < D.yearMin) D.yearMin = y;
        if (y > D.yearMax) D.yearMax = y;
    });
    D.yearCounts = yearCounts;
    scoped.forEach(j => {
        /* İl dağılımı (harita paneliyle aynı kural: boş il sayılmaz) */
        if (j.il && String(j.il).trim()) ilCounts[String(j.il).trim()] = (ilCounts[String(j.il).trim()] || 0) + 1;
        else D.ilBilinmeyen++;
        /* Tür kırılımı: updateGlobalKpiSubstats ile birebir */
        const tv = (j.tur || '').trim();
        if (tv === 'EGM') D.turCounts.EGM++;
        else if (tv === 'JGK') D.turCounts.JGK++;
        else if (tv === 'MSB') D.turCounts.MSB++;
        else D.turCounts.DIGER++;
        /* Aşama: KPI_ASAMA_ALL ilk eşleşme kazanır */
        const asamaLower = (j.asama || '').toLocaleLowerCase('tr-TR');
        let matched = false;
        for (let k = 0; k < KPI_ASAMA_ALL.length; k++) {
            const keyText = KPI_ASAMA_ALL[k].toLocaleLowerCase('tr-TR');
            if (asamaLower === keyText || asamaLower.includes(keyText)) { D.asamaCounts[KPI_ASAMA_ALL[k]]++; matched = true; break; }
        }
        if (!matched) D.asamaBilinmeyen++;
        /* Alan + bedel: parseTrNumber "45.500.000 TL" -> 45500000
           Alan kuralı isValidAreaForStats ile TEK YERDEN gelir: 0 m² (birim
           fiyat esaslı iş) toplam alana ve sıralamaya girmez. */
        const area = parseTrNumber(j.insaat_alani);
        if (isValidAreaForStats(j)) { D.toplamAlan += area; D.alanKayit++; if (j.is_tanimi) areaPairs.push({ id: j.id, n: j.is_tanimi, il: j.il || '', y: j.yuklenici || '', v: area }); }
        else if (area === 0) D.alanSifirKayit++;
        const cost = parseTrNumber(j.ihale_bedeli);
        if (cost !== null && cost > 0) { D.toplamBedel += cost; D.bedelKayit++; if (j.is_tanimi) costPairs.push({ id: j.id, n: j.is_tanimi, il: j.il || '', y: j.yuklenici || '', v: cost }); }
        /* Sözleşme yılı sayımı yukarıdaki yearScope döngüsünde yapıldı; burada
           tekrarlanmaz (yıl filtresi açıkken şerit bozulurdu). */
        /* İhale→Sözleşme süresi (harita paneliyle aynı aykırılık kuralları) */
        if (j.ihale_tarihi && j.sozlesme_tarihi) {
            const t1 = parseFlexibleDate(j.ihale_tarihi);
            const t2 = parseFlexibleDate(j.sozlesme_tarihi);
            if (t1 === null || t2 === null) D.avgInvalid++;
            else {
                const diff = Math.round((t2 - t1) / 86400000);
                if (diff < 0) D.avgNegatif++;
                else if (diff > STATS_OUTLIER_DAYS) D.avgOutlier++;
                else timeDiffs.push(diff);
            }
        }
    });
    D.ilTop10 = Object.keys(ilCounts).map(k => ({ name: k, count: ilCounts[k] }))
        .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name, 'tr')).slice(0, 10);
    D.ilSayisi = Object.keys(ilCounts).length;
    /* REVIZE: ilk 3 -> ilk 10. Bedel ve alan listeleri 10 sıraya çıkarıldı. */
    D.top10Bedel = costPairs.sort((a, b) => b.v - a.v).slice(0, 10);
    D.top10Alan = areaPairs.sort((a, b) => b.v - a.v).slice(0, 10);
    /* YENİ GRAFİK VERİLERİ:
       - yukleniciTop10 : en çok iş alan ilk 10 yüklenici (iş sayısı + toplam bedel)
       - sectionCounts  : kategori/protokol dağılımı (donut için)
       - bedelBruckets  : ihale bedeli aralıkları (histogram) */
    const yukleniciAgg = {};
    const sectionAgg = {};
    const bedelBruckets = [0, 0, 0, 0, 0]; /* 0-10M, 10-50M, 50-100M, 100-500M, 500M+ */
    scoped.forEach(j => {
        const yk = (j.yuklenici || '').trim();
        if (yk) {
            if (!yukleniciAgg[yk]) yukleniciAgg[yk] = { n: yk, count: 0, bedel: 0 };
            yukleniciAgg[yk].count++;
            const bedel = parseTrNumber(j.ihale_bedeli);
            if (bedel !== null && bedel > 0) yukleniciAgg[yk].bedel += bedel;
        }
        const sec = (j.section || '').trim() || 'Belirtilmemiş';
        sectionAgg[sec] = (sectionAgg[sec] || 0) + 1;
        const bedel2 = parseTrNumber(j.ihale_bedeli);
        if (bedel2 !== null && bedel2 > 0) {
            if (bedel2 < 10e6) bedelBruckets[0]++;
            else if (bedel2 < 50e6) bedelBruckets[1]++;
            else if (bedel2 < 100e6) bedelBruckets[2]++;
            else if (bedel2 < 500e6) bedelBruckets[3]++;
            else bedelBruckets[4]++;
        }
    });
    D.yukleniciTop10 = Object.values(yukleniciAgg)
        .sort((a, b) => (b.count - a.count) || a.n.localeCompare(b.n, 'tr')).slice(0, 10);
    D.yukleniciBilinmeyen = scoped.filter(j => !(j.yuklenici || '').trim()).length;
    D.sectionCounts = Object.keys(sectionAgg).map(k => ({ name: k, value: sectionAgg[k] }))
        .sort((a, b) => b.value - a.value);
    D.bedelBruckets = bedelBruckets;
    if (timeDiffs.length) { D.avgUsed = timeDiffs.length; D.avgDays = Math.round(timeDiffs.reduce((s, d) => s + d, 0) / timeDiffs.length); }
    D.avgTotal = D.avgUsed + D.avgOutlier + D.avgNegatif + D.avgInvalid;
    D.yearKeys = [];
    /* Şerit bugüne sabitlenir: verideki ileri tarihli hatalı yıllar (örn. 2031)
       grafiği uzatamaz; bunlar yearOutOfStrip'te sayılır.
       Yıl filtresi açıkken şerit O YILI daima içerir: aksi hâlde kullanıcı
       seçtiği yılı kendi grafiğinden kaybolmuş görürdü. */
    const stripEnd = Math.max(yearStart, Math.min(D.yearMax, nowYear));
    for (let y = yearStart; y <= stripEnd; y++) D.yearKeys.push(y);
    D.yearOutOfStrip = Object.keys(D.yearCounts).filter(y => +y < yearStart || +y > nowYear).length;
    /* Yıllık % değişim (grafiği "neden yükseliyor" sorusunu kendi kendine
       cevaplar). Bir önceki yılın verisi yoksa karşılaştırma yapılmaz. */
    D.yearYoy = {};
    D.yearKeys.forEach(y => {
        const prev = D.yearCounts[y - 1] || 0;
        const cur = D.yearCounts[y] || 0;
        D.yearYoy[y] = prev > 0 ? Math.round((cur - prev) / prev * 100) : null;
    });
    return D;
}

/* Ortak bar satırı üreticisi. Satırda YALNIZ iş adı + çubuk + değer vardır:
   alt bilgi satırı (il, yüklenici, pay) kaldırılmıştır; ayrıntı tooltip'te ve
   iş kartında bulunur. jobId verilirse satır iş detayını açar. */
function statsBarRow(title, label, valText, w, grad, jobId) {
    const clickable = jobId !== null && jobId !== undefined;
    return `<div class="stats-bar-item${clickable ? ' is-click' : ''}" title="${escapeHtml(title)}"${clickable ? ` role="button" tabindex="0" onclick="viewJobDetail('${escapeJsAttr(String(jobId))}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewJobDetail('${escapeJsAttr(String(jobId))}');}"` : ''}>
            <div class="stats-bar-meta"><span class="stats-bar-name">${escapeHtml(label)}</span></div>
            <div class="stats-bar-track"><div class="stats-bar-fill" data-w="${w}" style="width:0%; background:${grad};"><span>${valText}</span></div></div>
            <span class="stats-bar-val">${valText}</span></div>`;
}

function renderStatisticsView() {
    const grid = document.getElementById('stats-grid');
    if (!grid) return;
    const chip = document.getElementById('stats-total-chip');
    const intro = document.getElementById('stats-intro');
    if (!jobs.length) {
        if (chip) chip.innerHTML = '<i class="fa-solid fa-database"></i> Kayıt yok';
        if (intro) intro.innerHTML = 'Henüz iş kaydı yok. <strong>Tüm İşler</strong> ekranından kayıt ekleyin; istatistikler otomatik hesaplanır.';
        grid.innerHTML = '';
        return;
    }
    const D = collectStatsData();
    /* Filtre açıkken özet de FİLTRELENMİŞ kümeyi anlatır; aksi hâlde araç
       çubuğu "12 / 337 iş" derken özet hâlâ 337'yi gösterirdi. */
    const scopedOn = D.filtered !== D.total;
    const lider = D.ilTop10[0];
    const liderText = lider ? `İşlerin <strong>%${Math.round(lider.count / D.filtered * 100)}</strong>'i <strong>${escapeHtml(lider.name)}</strong>'de yoğunlaşıyor` : 'Kayıtlarda il bilgisi bulunmuyor';
    if (chip) chip.innerHTML = `<i class="fa-solid fa-database"></i> ${scopedOn ? `${D.filtered} / ${D.total}` : D.total} kayıt • ${D.ilSayisi} il`;
    if (intro) intro.innerHTML = `${scopedOn ? `<strong>${D.filtered}</strong> / ${D.total} iş kaydı` : `${D.total} iş kaydı`}: ${liderText}; toplam sözleşme bedeli <strong>${formatTrNumber(D.toplamBedel, 0)} TL</strong>, toplam inşaat alanı <strong>${formatTrNumber(D.toplamAlan, 0)} m²</strong>.` + (D.yearOutOfStrip ? ` <span title="2016 öncesi veya ileri tarihli sözleşme yılları yıl grafiğine sığmadı">(${D.yearOutOfStrip} kaydın sözleşme yılı grafik aralığı dışında)</span>` : '');
    let html = '';
    /* ARAÇ ÇUBUĞU: tek satırda arama, yıl, aşama ve "yalnız eksik veri"
       anahtarı. Hepsi statsFilter'a yazıp tüm paneli yeniden çizer. */
    const gapCount = jobs.filter(statsJobHasGaps).length;
    const f = statsFilter;
    const yearsAll = Object.keys(D.yearCounts).map(Number).filter(y => y >= STATS_YEAR_START && y <= new Date().getUTCFullYear());
    html += `<div class="stats-toolbar">
        <span class="stats-tool-field"><i class="fa-solid fa-magnifying-glass"></i><input type="search" id="stats-search" class="stats-tool-input" placeholder="İş adı, il, yüklenici..." value="${escapeHtml(f.q)}" autocomplete="off"></span>
        <select id="stats-year" class="stats-tool-select" onchange="statsSetFilter({ year: this.value ? Number(this.value) : null })">
            <option value="">Tüm yıllar</option>
            ${yearsAll.sort((a, b) => b - a).map(y => `<option value="${y}"${f.year === y ? ' selected' : ''}>${y}</option>`).join('')}
        </select>
        <select id="stats-asama" class="stats-tool-select" onchange="statsSetFilter({ asama: this.value || null })">
            <option value="">Tüm aşamalar</option>
            ${KPI_ASAMA_ALL.map(a => `<option value="${escapeHtml(a)}"${f.asama === a ? ' selected' : ''}>${escapeHtml(a)}</option>`).join('')}
        </select>
        <button type="button" class="stats-tool-btn${f.onlyGaps ? ' is-on' : ''}" onclick="statsSetFilter({ onlyGaps: !statsFilter.onlyGaps })" title="Bedeli, alanı veya sözleşme tarihi eksik işleri göster"><i class="fa-solid fa-triangle-exclamation"></i> Eksik veri${gapCount ? ` (${gapCount})` : ''}</button>
        <button type="button" class="stats-tool-btn" onclick="statsClearFilter()" title="Tüm filtreleri temizle"><i class="fa-solid fa-rotate-left"></i> Temizle</button>
        <span class="stats-tool-count"><b>${D.filtered}</b> / ${D.total} iş gösteriliyor</span>
    </div>`;
    /* Etkin filtre etiketleri: tek tıkla kaldırılır. */
    const chips = [];
    if (f.q.trim()) chips.push(`<button type="button" class="stats-chip" onclick="statsSetFilter({ q: '' })"><i class="fa-solid fa-magnifying-glass"></i> "${escapeHtml(f.q.trim())}" <i class="fa-solid fa-xmark"></i></button>`);
    if (f.year !== null) chips.push(`<button type="button" class="stats-chip" onclick="statsToggleYear(${f.year})"><i class="fa-solid fa-calendar-days"></i> ${f.year} <i class="fa-solid fa-xmark"></i></button>`);
    if (f.asama) chips.push(`<button type="button" class="stats-chip" onclick="statsSetFilter({ asama: null })"><i class="fa-solid fa-timeline"></i> ${escapeHtml(f.asama)} <i class="fa-solid fa-xmark"></i></button>`);
    if (f.onlyGaps) chips.push(`<button type="button" class="stats-chip" onclick="statsSetFilter({ onlyGaps: false })"><i class="fa-solid fa-triangle-exclamation"></i> Eksik veri <i class="fa-solid fa-xmark"></i></button>`);
    if (chips.length) html += `<div class="stats-chip-row">${chips.join('')}</div>`;

    /* KART 1: EN ÇOK İŞ YAPILAN İLK 10 İL (satıra tıklayınca haritada o il açılır) */
    const ilMax = D.ilTop10.length ? D.ilTop10[0].count : 0;
    /* İl satırı haritayı açar; alt bilgi satırı yok (yalnız il adı + çubuk). */
    const ilRows = D.ilTop10.map(r => {
        const w = ilMax ? Math.max(4, Math.round(r.count / ilMax * 100)) : 0;
        const pay = D.filtered ? (r.count / D.filtered * 100).toFixed(1) : '0';
        return `<div class="stats-bar-item is-click" title="${escapeHtml(r.name)}: ${r.count} iş (%${pay}) — tıkla, haritada gör" role="button" tabindex="0" onclick="statsOpenCity('${escapeJsAttr(r.name)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();statsOpenCity('${escapeJsAttr(r.name)}');}">
            <div class="stats-bar-meta"><span class="stats-bar-name">${escapeHtml(r.name)}</span></div>
            <div class="stats-bar-track"><div class="stats-bar-fill" data-w="${w}" style="width:0%; background:linear-gradient(90deg, var(--color-primary), var(--color-cyan));"><span>${r.count}</span></div></div>
            <span class="stats-bar-val" data-count="${r.count}">${r.count}</span></div>`;
    }).join('');
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-ranking-star" style="color:var(--color-primary);"></i> En Çok İş Yapılan İller</span><span class="stats-card-sub">${D.ilSayisi} il • ilk 10</span></div>
        <div class="stats-bars">${D.ilTop10.length ? ilRows : '<span class="stats-empty">Kayıtlarda il bilgisi girilmemiş.</span>'}</div>
        <span class="stats-foot"><i class="fa-solid fa-circle-info"></i> Haritadaki yoğunlukla aynı kaynak${D.ilBilinmeyen ? `; <b>${D.ilBilinmeyen}</b> kayıtta il boş` : ''}. Satıra tıklayınca il haritada açılır.</span></div>`;
    /* KART 2+3: EN YÜKSEK BEDEL / EN BÜYÜK ALAN (REVIZE: ilk 3 -> ilk 10).
       data-w hedef genişliği taşır; açılışta statsAnimateOnOpen bar'ları
       0'dan hedefe animasyonla büyütür. */
    /* Bedel/alan listeleri: satırda YALNIZ iş adı + çubuk + birim. İl ve yüklenici
       bilgisi tooltip'te ve tıklanınca açılan iş kartında. */
    const buildTop10 = (pairs, fmt, grad, birim) => pairs.length ? pairs.map(r => statsBarRow(
        `${r.n} — ${fmt(r.v)} ${birim}${r.il ? ' • ' + r.il : ''}${r.y ? ' • ' + r.y : ''} (tıkla: iş kartı)`,
        r.n, fmt(r.v),
        Math.max(4, Math.round(r.v / pairs[0].v * 100)),
        grad, r.id
    )).join('') : '<span class="stats-empty">Bu alanda veri girilmiş kayıt yok.</span>';
    const top10Payi = (top10, toplam) => toplam ? (top10.reduce((s, r) => s + r.v, 0) / toplam * 100).toFixed(1) : '0';
    /* Yüzdeler daima FİLTRELENMİŞ kümeye göre hesaplanır; aksi hâlde filtre
       açıkken "ilk 10 iş toplam bedelin %38'i" gibi kendi kendisiyle çelişen
       bir pay gösterilirdi. */
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-sack-dollar" style="color:var(--color-emerald);"></i> En Yüksek İhale Bedelli İşler</span><span class="stats-card-sub">ilk 10 • toplam ${formatTrNumber(D.toplamBedel, 0)} TL</span></div>
        <div class="stats-bars">${buildTop10(D.top10Bedel, v => formatTrNumber(v, 0), 'linear-gradient(90deg, var(--color-emerald), #34d399)', '₺')}</div>
        <span class="stats-foot">İlk 10 iş toplam bedelin <b>%${top10Payi(D.top10Bedel, D.toplamBedel)}'</b>ini taşıyor (${D.bedelKayit} kayıtta bedel girilmiş).</span></div>`;
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-vector-square" style="color:var(--color-rose);"></i> En Büyük İnşaat Alanlı İşler</span><span class="stats-card-sub">ilk 10 • toplam ${formatTrNumber(D.toplamAlan, 0)} m²</span></div>
        <div class="stats-bars">${buildTop10(D.top10Alan, v => formatTrNumber(v, 0), 'linear-gradient(90deg, var(--color-rose), #fb7185)', 'm²')}</div>
        <span class="stats-foot">İlk 10 iş toplam alanın <b>%${top10Payi(D.top10Alan, D.toplamAlan)}'</b>ini kapsıyor (${D.alanKayit} kayıtta alan girilmiş)${D.alanSifirKayit ? `; <b>${D.alanSifirKayit}</b> birim fiyat işi (0 m²) alan toplamına dahil edilmedi` : ''}.</span></div>`;

    /* ORTALAMA m² BİRİM FİYATI: bedel/alan. 0 m²'li (birim fiyat esaslı) işler
       hesaba katılmaz — aksi hâlde ortalamayı aşağı çekerdi. Ayak notında
       kaç kaydın neden dışarıda kaldığı açıkça belirtilir. */
    const M = D.m2Price;
    const m2Body = M.avg === null
        ? '<span class="stats-empty">Alanı ve bedeli birlikte girilmiş kayıt bulunamadı.</span>'
        : `<div style="display:flex; align-items:baseline; gap:8px;">
               <span style="font-size:22px; font-weight:800; color:var(--txt-main);">${formatTrNumber(M.avg, 0)} <small style="font-size:12px; font-weight:700; color:var(--txt-muted);">TL/m²</small></span>
           </div>
           <span class="stats-foot">Toplam <b>${formatTrNumber(M.totalCost, 0)} TL</b> / <b>${formatTrNumber(M.totalArea, 0)} m²</b> (${M.used} kayıt)${M.skippedZeroArea ? `; <b>${M.skippedZeroArea}</b> birim fiyat işi (0 m²) hesaba katılmadı` : ''}${M.skippedNoCost ? `, <b>${M.skippedNoCost}</b> kayıtta bedel yok` : ''}.</span>`;
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-calculator" style="color:var(--color-primary);"></i> Ortalama m² Birim Fiyatı</span><span class="stats-card-sub">geçerli ${M.used} kayıt</span></div>
        ${m2Body}</div>`;
    /* KART 4: AŞAMA DAĞILIMI (DONUT) */
    const asamaItems = KPI_ASAMA_ALL.map((a, i) => ({ name: a, value: D.asamaCounts[a], color: ['var(--color-cyan)', 'var(--color-amber)', 'var(--color-emerald)', 'var(--color-violet)', 'var(--color-rose)', 'var(--color-primary)'][i % 6] }));
    const asamaTop = asamaItems.slice().sort((a, b) => b.value - a.value)[0];
    /* Lejant üreticisi. `filterable` yalnız Aşama Dağılımı'nda true olur: o
       zaman satır tıklanabilir ve o aşamaya filtreler (aktif aşama işaretlenir).
       Tür ve Kategori lejantları düz satır kalır — onlar için filtre alanı yok,
       işlevsiz bir tıklama iması yanıltıcı olurdu. */
const donutLegend = (items, filterable, activeName) => items.map(it => {
        const attrs = filterable
            ? ` class="stats-legend-row is-click${activeName === it.name ? ' is-active' : ''}" role="button" tabindex="0" title="${escapeHtml(it.name)}: ${it.value} iş — tıkla: bu aşamaya filtrele" onclick="statsSetFilter({ asama: statsFilter.asama === '${escapeJsAttr(it.name)}' ? null : '${escapeJsAttr(it.name)}' })" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();statsSetFilter({ asama: statsFilter.asama === '${escapeJsAttr(it.name)}' ? null : '${escapeJsAttr(it.name)}' });}"`
            : ` class="stats-legend-row" title="${escapeHtml(it.name)}: ${it.value} iş"`;
        return `<div${attrs}><span class="stats-legend-swatch" style="background:${it.color};"></span><span class="stats-legend-name">${escapeHtml(it.name)}</span><span class="stats-legend-val">${it.value} • %${D.filtered ? Math.round(it.value / D.filtered * 100) : 0}</span></div>`;
    }).join('');
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-timeline" style="color:var(--color-cyan);"></i> Aşama Dağılımı</span><span class="stats-card-sub">${asamaTop && asamaTop.value ? 'en yoğun: ' + escapeHtml(asamaTop.name) : '-'}</span></div>
        <div class="stats-split-grid">
            <div class="stats-donut stats-anim-donut" style="background:${statsDonutGradient(asamaItems.map(it => ({ ...it, total: D.filtered })))};"><div class="stats-donut-center"><b data-count="${D.filtered}">${D.filtered}</b><span>iş</span></div></div>
            <div class="stats-legend">${donutLegend(asamaItems, true, statsFilter.asama || '')}${D.asamaBilinmeyen ? `<div class="stats-legend-row" title="Tanınmayan aşama etiketleri"><span class="stats-legend-swatch" style="background:rgba(148,163,184,0.4);"></span><span class="stats-legend-name">Diğer/Tanınmayan</span><span class="stats-legend-val">${D.asamaBilinmeyen}</span></div>` : ''}</div>
        </div></div>`;
    /* KART 5: TÜR KIRILIMI (DONUT — KPI ile aynı kurallar) */
    const turItems = [
        { name: 'EGM', value: D.turCounts.EGM, color: 'var(--color-primary)' },
        { name: 'JGK', value: D.turCounts.JGK, color: 'var(--color-cyan)' },
        { name: 'MSB', value: D.turCounts.MSB, color: 'var(--color-violet)' },
        { name: 'DİĞER', value: D.turCounts.DIGER, color: 'var(--color-amber)' }
    ];
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-layer-group" style="color:var(--color-violet);"></i> Tür Kırılımı</span><span class="stats-card-sub">KPI kartıyla aynı eşleşme</span></div>
        <div class="stats-split-grid">
            <div class="stats-donut stats-anim-donut" style="background:${statsDonutGradient(turItems.map(it => ({ ...it, total: D.filtered })))};"><div class="stats-donut-center"><b data-count="${D.filtered}">${D.filtered}</b><span>iş</span></div></div>
            <div class="stats-legend">${donutLegend(turItems, false, '')}</div>
        </div></div>`;
    /* KART 6: SÖZLEŞME YILLARI (2016+ kolon grafiği; harita şeridiyle aynı aralık).
       data-h hedef yüksekliği taşır; açılışta kolonlar alttan yükselir. */
    const yMax = Math.max(1, ...D.yearKeys.map(y => D.yearCounts[y] || 0));
    /* Her kolon tıklanabilir: o yılı filtreler. Üstünde bir önceki yıla göre
       % değişim rozeti durur — grafiğin "neden yükseliyor" sorusunu
       cevaplamak için ayrı bir bakışa gerek bırakmaz. */
    const yearCols = D.yearKeys.map(y => {
        const c = D.yearCounts[y] || 0;
        const h = c ? Math.max(6, Math.round(c / yMax * 90)) : 4;
        const yoy = D.yearYoy[y];
        const yoyBadge = yoy === null ? '' :
            `<span class="stats-yoy ${yoy > 0 ? 'up' : yoy < 0 ? 'down' : 'flat'}">${yoy > 0 ? '+' : ''}${yoy}%</span>`;
        const active = statsFilter.year === y;
        return `<div class="stats-year-col is-click${c === 0 ? ' is-zero' : ''}${active ? ' is-active' : ''}" role="button" tabindex="0" onclick="statsToggleYear(${y})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();statsToggleYear(${y});}" title="${y}: ${c} sözleşme${yoy === null ? '' : ` (geçen yıla göre ${yoy > 0 ? '+' : ''}${yoy}%)`} — tıkla: ${active ? 'filtreyi kaldır' : 'bu yıla filtrele'}">
            <div class="stats-year-bar" data-h="${h}" style="height:6px;"><span>${c}</span></div>
            <span class="stats-year-lab">${y}</span>${yoyBadge}</div>`;
    }).join('');
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-calendar-days" style="color:var(--color-cyan);"></i> Sözleşme Yılları</span><span class="stats-card-sub">${STATS_YEAR_START} - ${D.yearKeys[D.yearKeys.length - 1] || STATS_YEAR_START}</span></div>
        <div class="stats-year-strip">${yearCols}</div>
        <span class="stats-foot">${D.yearOutOfStrip ? `<b>${D.yearOutOfStrip}</b> kaydın sözleşme yılı grafik aralığı dışında (2016 öncesi/ileri tarih).` : 'Grafik, harita altındaki yıl şeridiyle aynı aralığı gösterir.'}</span></div>`;
    /* KART 7 (YENİ): EN ÇOK İŞ ALAN YÜKLENİCİLER (ilk 10, animasyonlu bar) */
    const yMaxCount = D.yukleniciTop10.length ? D.yukleniciTop10[0].count : 0;
    /* Yüklenici adı zaten tek satırdır; alt bilgi (iş sayısı/bedel) çubuğun
       yanındaki değere ve tooltip'e taşındı. */
    const yukleniciRows = D.yukleniciTop10.map(r => statsBarRow(
        `${r.n}: ${r.count} iş${r.bedel ? ' • toplam ' + formatTrNumber(r.bedel, 0) + ' TL' : ''}`,
        r.n, r.count,
        yMaxCount ? Math.max(4, Math.round(r.count / yMaxCount * 100)) : 0,
        'linear-gradient(90deg, var(--color-violet), #c084fc)', null
    )).join('');
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-helmet-safety" style="color:var(--color-violet);"></i> En Çok İş Alan Yükleniciler</span><span class="stats-card-sub">ilk 10 • iş sayısına göre</span></div>
        <div class="stats-bars">${D.yukleniciTop10.length ? yukleniciRows : '<span class="stats-empty">Kayıtlarda yüklenici bilgisi girilmemiş.</span>'}</div>
        <span class="stats-foot">${D.yukleniciBilinmeyen ? `<b>${D.yukleniciBilinmeyen}</b> kayıtta yüklenici boş. ` : ''}${D.yukleniciTop10.length ? `İlk 10 yüklenici <b>${D.yukleniciTop10.reduce((s, r) => s + r.count, 0)}</b> iş üstlenmiş.` : ''}</span></div>`;
    /* KART 8 (YENİ): İHALE BEDELİ DAĞILIMI (histogram kolonları, animasyonlu) */
    const bedelLabels = ['0-10M', '10-50M', '50-100M', '100-500M', '500M+'];
    const bedelMax = Math.max(1, ...D.bedelBruckets);
    const bedelCols = D.bedelBruckets.map((c, i) => {
        const h = c ? Math.max(6, Math.round(c / bedelMax * 90)) : 4;
        return `<div class="stats-year-col${c === 0 ? ' is-zero' : ''}" title="${bedelLabels[i]} TL: ${c} iş"><div class="stats-year-bar stats-bedel-bar" data-h="${h}" style="height:6px;"><span>${c}</span></div><span class="stats-year-lab">${bedelLabels[i]}</span></div>`;
    }).join('');
    const bedelTotal = D.bedelBruckets.reduce((s, c) => s + c, 0);
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-chart-simple" style="color:var(--color-amber);"></i> İhale Bedeli Dağılımı</span><span class="stats-card-sub">${bedelTotal} kayıt • TL</span></div>
        <div class="stats-year-strip">${bedelCols}</div>
        <span class="stats-foot">Bedel girilmiş <b>${bedelTotal}</b> iş, beş aralığa bölündü.${bedelTotal > 0 ? ` En yoğun aralık: <b>${bedelLabels[D.bedelBruckets.indexOf(bedelMax)]}</b>.` : ''}</span></div>`;
    /* KART 9 (YENİ): KATEGORİ / PROTOKOL DAĞILIMI (donut, animasyonlu) */
    const secPalette = ['var(--color-primary)', 'var(--color-cyan)', 'var(--color-emerald)', 'var(--color-amber)', 'var(--color-rose)', 'var(--color-violet)'];
    const secItems = D.sectionCounts.slice(0, 6).map((s, i) => ({ name: s.name, value: s.value, color: secPalette[i % secPalette.length] }));
    const secTotal = D.sectionCounts.reduce((s, r) => s + r.value, 0);
    const secOthers = D.sectionCounts.slice(6).reduce((s, r) => s + r.value, 0);
    if (secOthers > 0) secItems.push({ name: 'Diğer', value: secOthers, color: 'rgba(148,163,184,0.45)' });
    html += `<div class="stats-card">
        <div class="stats-card-head"><span class="stats-card-title"><i class="fa-solid fa-layer-group" style="color:var(--color-cyan);"></i> Kategori / Protokol Dağılımı</span><span class="stats-card-sub">${D.sectionCounts.length} kategori</span></div>
        <div class="stats-split-grid">
            <div class="stats-donut stats-anim-donut" style="background:${statsDonutGradient(secItems.map(it => ({ ...it, total: secTotal })))};"><div class="stats-donut-center"><b data-count="${secTotal}">${secTotal}</b><span>iş</span></div></div>
            <div class="stats-legend">${donutLegend(secItems, false, '')}</div>
        </div></div>`;
    /* KART 10: İHALE→SÖZLEŞME SÜRESİ */
    html += buildTimingCard(D);
    grid.innerHTML = html;
    /* Arama kutusu her render'da yeniden basıldığı için (aynı DOM düğümü
       korunarak yazılırsa odak korunur) yalnızca bir kez bağlanır. */
    const search = document.getElementById('stats-search');
    if (search && !search.dataset.wired) {
        search.dataset.wired = '1';
        /* 'input' yerine 'input' + gecikmeli yeniden çizim: her tuş vuruşunda
           337 kayıt taranması pahalı olsa da bu ölçekte sorunsuz; yine de
           odak/caret konumunu korumak için değer doğrudan atanır. */
        search.addEventListener('input', e => {
            const pos = e.target.selectionStart;
            statsFilter.q = e.target.value;
            renderStatisticsView();
            const next = document.getElementById('stats-search');
            if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch (err) { /* type=search bazı tarayıcılarda reddeder */ } }
        });
    }
    /* Açılış animasyonu: DOM'a basıldıktan hemen sonra tetiklenir. */
    statsAnimateOnOpen(grid);
}

/* ==========================================================================
   İSTATİSTİK AÇILIŞ ANİMASYONLARI (statsAnimateOnOpen)
   Panel her açıldığında grafikler hareketle girer:
     - Bar'lar      : genişlik 0 -> data-w (%), kademeli gecikme
     - Kolonlar     : yükseklik -> data-h (px), kademeli gecikme (yıl + bedel)
     - Donut'lar    : dönerek + ölçeklenerek görünür (CSS keyframe)
     - Sayaçlar     : [data-count] hedefine 0'dan easeOutCubic ile sayar
   prefers-reduced-motion: reduce ise tüm değerler anında hedefe ayarlanır.
   ========================================================================== */
function statsAnimateOnOpen(rootEl) {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fills = rootEl.querySelectorAll('.stats-bar-fill[data-w]');
    const bars = rootEl.querySelectorAll('.stats-year-bar[data-h]');
    const donuts = rootEl.querySelectorAll('.stats-anim-donut');
    const counters = rootEl.querySelectorAll('[data-count]');
    if (reduceMotion) {
        fills.forEach(el => { el.style.width = el.dataset.w + '%'; });
        bars.forEach(el => { el.style.height = el.dataset.h + 'px'; });
        counters.forEach(el => { el.textContent = Number(el.dataset.count).toLocaleString('tr-TR'); });
        donuts.forEach(el => el.classList.remove('stats-anim-donut'));
        return;
    }
    fills.forEach((el, i) => {
        el.style.transition = 'none';
        requestAnimationFrame(() => {
            el.style.transition = 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1) ' + Math.min(i * 70, 700) + 'ms';
            el.style.width = el.dataset.w + '%';
        });
    });
    bars.forEach((el, i) => {
        el.style.transition = 'none';
        requestAnimationFrame(() => {
            el.style.transition = 'height 0.8s cubic-bezier(0.22, 1, 0.36, 1) ' + Math.min(i * 60, 650) + 'ms';
            el.style.height = el.dataset.h + 'px';
        });
    });
    donuts.forEach((el, i) => {
        el.classList.add('donut-spin-in');
        el.style.animationDelay = (i * 120) + 'ms';
        el.addEventListener('animationend', () => { el.classList.remove('donut-spin-in'); el.style.animationDelay = ''; }, { once: true });
    });
    counters.forEach(el => {
        const target = Number(el.dataset.count) || 0;
        if (!target) { el.textContent = '0'; return; }
        const duration = 1100;
        const start = performance.now();
        const step = now => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
            el.textContent = Math.round(target * eased).toLocaleString('tr-TR');
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}

/* Donut dilimleri: conic-gradient durakları üretir. 0'lı kategoriler atlanır;
   hepsi 0 ise nötr gri ring döner. */
function statsDonutGradient(items) {
    const visible = items.filter(it => it.value > 0 && it.total > 0);
    if (!visible.length) return 'conic-gradient(rgba(148,163,184,0.25) 0deg 360deg)';
    let acc = 0;
    const stops = visible.map(it => {
        const from = (acc / it.total) * 360;
        acc += it.value;
        const to = (acc / it.total) * 360;
        return `${it.color} ${from.toFixed(2)}deg ${to.toFixed(2)}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
}

/* İhale→Sözleşme kartı: ortalama + yıllık ölçek çubuğu; aykırı/negatif/okunamayan
   kayıtlar ortalamaya girmez, ayak notunda sayılır (harita kartıyla aynı eşik).
   NOT: head kasıtlı olarak .stats-card-head'i AÇIK bırakır; alt başlık span'i
   yazıldıktan sonraki </div> onu kapatır. Kart dengesi bu şablonla korunur. */
function buildTimingCard(D) {
    const head = `
        <div class="stats-card-head">
            <span class="stats-card-title"><i class="fa-solid fa-clock-rotate-left" style="color:var(--color-emerald);"></i> İhale → Sözleşme Süresi</span>`;
    if (D.avgDays === null) {
        return `
        <div class="stats-card">
            ${head}
            <span class="stats-card-sub">hesaplanamadı</span>
            </div>
            <span class="stats-empty">İhale + sözleşme tarihi girilmiş kayıt bulunamadı.</span>
        </div>`;
    }
    const pct = Math.min(100, Math.round(D.avgDays / 365 * 100));
    const sorunlu = D.avgOutlier + D.avgNegatif + D.avgInvalid;
    return `
        <div class="stats-card">
            ${head}
            <span class="stats-card-sub">${D.avgUsed} kayıt kullanıldı${sorunlu ? `, ${sorunlu} dışarıda` : ''}</span>
            </div>
            <div style="display:flex; align-items:baseline; gap:8px;">
                <span style="font-size:22px; font-weight:800; color:var(--txt-main);">${D.avgDays} gün</span>
                <span style="font-size:10.5px; font-weight:600; color:var(--txt-muted);">ortalama (~${(D.avgDays / 30.44).toFixed(1)} ay)</span>
            </div>
            <div class="stats-hbar" title="Bir yıla (365 gün) oranla görsel ölçek"><span style="width:${pct}%;"></span></div>
            <span class="stats-foot">Ortalamaya giren: <b>${D.avgUsed}</b> kayıt${D.avgOutlier ? `; dışarıda: <b>${D.avgOutlier}</b> aykırı (10+ yıl)` : ''}${D.avgNegatif ? `, <b>${D.avgNegatif}</b> negatif` : ''}${D.avgInvalid ? `, <b>${D.avgInvalid}</b> okunamadı` : ''}. Şüphelileri konsolda <b>diagIhaleSozlesme()</b> ile listeleyebilirsiniz.</span>
        </div>`;
}

/* İl satırına tıklanınca dashboard'a dönülür ve haritadaki il paneli açılır
   (mevcut akış yeniden kullanılır; yeni mekanizma eklenmez). */
function statsOpenCity(cityName) {
    navigateTo('home');
    setTimeout(() => { openDashboardDrawerForCity(cityName); }, 120);
}

/* TANILAMA ARACI: Tarayıcı konsolunda `diagIhaleSozlesme()` çalıştırılır.
   Tüm kayıtların ihale→sözleşme tarih çiftlerini denetler ve sorunluları
   kategorilere ayırıp tablo halinde basar:
     - AYKIRI   : fark 10+ yıl (neredeyse her zaman veri giriş hatası)
     - NEGATİF  : sözleşme tarihi ihaleden önce yazılmış
     - OKUNAMADI: tarih metni tanınan hiçbir biçime uymuyor
   Sorun çıkarmayan en büyük 10 fark da "kontrol listesi" olarak verilir. */
function diagIhaleSozlesme() {
    const rows = [];
    const DAY = 86400000;
    let okCount = 0;
    jobs.forEach(j => {
        const t1 = j.ihale_tarihi ? parseFlexibleDate(j.ihale_tarihi) : null;
        const t2 = j.sozlesme_tarihi ? parseFlexibleDate(j.sozlesme_tarihi) : null;
        const base = {
            id: j.id,
            is_tanimi: (j.is_tanimi || '-').slice(0, 50),
            il: j.il || '-',
            ihale_ham: j.ihale_tarihi || '',
            sozlesme_ham: j.sozlesme_tarihi || ''
        };
        if (!j.ihale_tarihi && !j.sozlesme_tarihi) return; /* tarih hiç girilmemiş */
        if (t1 === null || t2 === null) {
            rows.push({ DURUM: 'OKUNAMADI', ...base });
        } else {
            const diff = Math.round((t2 - t1) / DAY);
            if (diff < 0) rows.push({ DURUM: 'NEGATİF', ...base, fark_gun: diff });
            else if (diff > 3650) rows.push({ DURUM: 'AYKIRI (>10yıl)', ...base, fark_gun: diff });
            else okCount++;
        }
    });

    /* Çıktı bilinçli çağrıya bağlı: bu araç yalnızca kullanıcı konsoldan
       çalıştırdığında (ya da uygulama içinden çağrıldığında) konsola yazar.
       Uygulama hiçbir yerde kendiliğinden çağırmadığı için normal kullanımda
       konsolu kirletmez; istatistik ekranındaki "konsolda listeleyebilirsiniz"
       yönlendirmesi de geçerli kalır. */
    console.log(`%c[İhale-Sözleşme Tanılama]`, 'font-weight:bold; color:#38bdf8;');
    console.log(`Toplam ${jobs.length} kayıt tarandı; ${okCount} tanesi sağlıklı.`);

    if (rows.length === 0) {
        console.log('%cSorunlu kayıt bulunamadı.', 'color:#22c55e;');
    } else {
        console.log(`%c${rows.length} sorunlu kayıt bulundu:`, 'color:#f59e0b; font-weight:bold;');
        console.table(rows);
        console.log('%cDüzeltme önerisi: "Tüm İşler" listesinden ilgili kaydı açıp İHALE SONRASI bölümündeki tarihleri düzeltin. Kayıt düzeltildikten sonra bu komutu yeniden çalıştırıp temizlendiğini doğrulayın.', 'color:#9bb8d2;');
    }

    /* Sağlık kontrolü: eşik altındaki en büyük 10 fark (sınırda kalanlar gözden geçirilir) */
    const topDiffs = jobs
        .map(j => {
            const t1 = parseFlexibleDate(j.ihale_tarihi);
            const t2 = parseFlexibleDate(j.sozlesme_tarihi);
            return (t1 !== null && t2 !== null) ? { j, diff: Math.round((t2 - t1) / DAY) } : null;
        })
        .filter(x => x && x.diff >= 0)
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 10)
        .map(x => ({
            is_tanimi: (x.j.is_tanimi || '-').slice(0, 50),
            il: x.j.il || '-',
            ihale: x.j.ihale_tarihi,
            sozlesme: x.j.sozlesme_tarihi,
            fark_gun: x.diff
        }));
    console.log('%cEşik altındaki en büyük 10 fark (gözden geçirme listesi):', 'font-weight:bold;');
    console.table(topDiffs);
    return { sorunlu: rows, enBuyukFarklar: topDiffs };
}
/* diagIhaleSozlesme konsoldan erişilebilsin (module scope'a gömülü olabilir). */
window.diagIhaleSozlesme = diagIhaleSozlesme;

function createFallbackVectorMap() {
    mapG.selectAll("*").remove();
    const wrapper = document.getElementById('map-wrapper-container');
    const width = wrapper ? wrapper.clientWidth : 800;
    const height = wrapper ? wrapper.clientHeight : 380;

    mapG.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent");

    mapG.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2 - 10)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--txt-sub)")
        .attr("font-size", "13.2px")
        .attr("font-weight", "600")
        .text("Dış harita verisi yüklenemedi. 'Yedek Yükle' butonu ile tr-cities.json yükleyebilirsiniz.");
}

function updateMapColors() {
    if (geojsonData) renderD3Map();
}

/* ==========================================================================
   UYDU / TOPOĞRAFYA KATMANI (Satellite Tile Layer — Leaflet'siz, d3-SVG uyumlu)
   --------------------------------------------------------------------------
   - Esri World Imagery (ücretsiz, anahtar gerektirmez) birincil kaynak; yüklenemezse
     Esri World Topo, o da başarısız olursa OSM standart dokusuna düşer. Tümü
     başarısız olursa katman sessizce boş kalır ve vektör harita aynen çalışır.
   - Tile gridi, haritayla BİREBİR AYNI d3.geoMercator projeksiyonundan elde edilen
     piksel çerçevesine oturtulur ve mapG (d3 zoom grubu) içine, illerin ALTINA
     SVG <image> olarak çizilir; böylece pan/zoom sırasında vektör illerle senkron kalır.
   ========================================================================== */
const SATELLITE_STORAGE_KEY = 'yaser_v10_map_satellite_mode';

const SATELLITE_TILE_SOURCES = [
    { id: 'esri-world-imagery',
      url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}` },
    { id: 'esri-world-topo',
      url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}` },
    { id: 'osm-standard',
      url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png` }
];

function toggleSatelliteMode() {
    satelliteModeActive = !satelliteModeActive;
    try { localStorage.setItem(SATELLITE_STORAGE_KEY, JSON.stringify(satelliteModeActive)); }
    catch (e) { /* depolama kullanılamıyorsa tercih yalnızca bu oturumluk hatırlanır */ }
    if (geojsonData && activeView === 'home') renderD3Map();
    else updateSatelliteButtonState();
}

function loadSatellitePreference() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(SATELLITE_STORAGE_KEY)); }
    catch (e) { stored = null; }
    satelliteModeActive = stored === true;
    updateSatelliteButtonState();
}

function updateSatelliteButtonState() {
    const btn = document.getElementById('satellite-toggle-btn');
    if (btn) btn.classList.toggle('satellite-active', satelliteModeActive);
    const wrapper = document.getElementById('map-wrapper-container');
    if (wrapper) wrapper.classList.toggle('satellite-active', satelliteModeActive);
}

/* Web Mercator'ın kutuplardaki sonsuzluk tuzağını standart 85.05° ile kırpar;
   dönen çerçeve, 256px tile gridinin SVG piksel uzayındaki (x, y, boyut) karşılığıdır. */
function getSatelliteWorldFrame(projection) {
    const worldTopLeft = projection([0, 85.05112878]);
    const worldBottomRight = projection([360, -85.05112878]);
    if (!worldTopLeft || !worldBottomRight ||
        !Number.isFinite(worldTopLeft[0]) || !Number.isFinite(worldTopLeft[1]) ||
        !Number.isFinite(worldBottomRight[0]) || !Number.isFinite(worldBottomRight[1])) return null;
    return {
        x: worldTopLeft[0],
        y: worldTopLeft[1],
        size: Math.max(worldBottomRight[0] - worldTopLeft[0], worldBottomRight[1] - worldTopLeft[1])
    };
}

/* d3.geoMercator 512px tabanlıdır; OSM/Esri 256px tabanlı zoom ölçeğine çevrilir.
   Türkiye tam görünümde tipik olarak 3-4 seviyesi çıkar. z=0 (tek dünya tile'ı) bu
   grid kaydırmasıyla hizalanamaz → minimum 1 kilidi. */
function getSatelliteZoomLevel(worldSizePx) {
    return Math.max(1, Math.min(18, Math.round(Math.log2(Math.max(worldSizePx, 1) / 256))));
}

function clearSatelliteTiles() {
    if (mapG) mapG.selectAll('g.map-tiles-g').remove();
}

/* Tek bir kaynak için tile gridini çizer. Kapsanan tüm kritik tile'lar yüklenirse
   resolve(true); kritik (görünür alandaki) herhangi biri hata verirse resolve(false)
   döner ve sıradaki yedek kaynak denenir. */
function drawSatelliteTilesWithSource(frame, zoomLevel, source, visibleWidth, visibleHeight) {
    return new Promise(resolve => {
        const tilesG = mapG.insert('g', ':first-child')
            .attr('class', 'map-tiles-g')
            .attr('pointer-events', 'none');

        const n = Math.pow(2, zoomLevel);
        const tileSize = frame.size / n;

        /* Görünür SVG alanı + 1 tile pay: pan'de kenar boşluğu kalmasın */
        const minX = -tileSize, minY = -tileSize;
        const maxX = visibleWidth + tileSize, maxY = visibleHeight + tileSize;

        const colMin = Math.max(0, Math.floor((minX - frame.x) / tileSize));
        const colMax = Math.min(n - 1, Math.floor((maxX - frame.x) / tileSize));
        const rowMin = Math.max(0, Math.floor((minY - frame.y) / tileSize));
        const rowMax = Math.min(n - 1, Math.floor((maxY - frame.y) / tileSize));

        if (colMax < colMin || rowMax < rowMin) { resolve(true); return; }

        const tileJobs = [];
        for (let row = rowMin; row <= rowMax; row++) {
            for (let col = colMin; col <= colMax; col++) tileJobs.push({ col, row });
        }

        let remaining = tileJobs.length;
        let criticalFailure = false;
        const settle = ok => {
            remaining -= 1;
            if (!ok) criticalFailure = true;
            if (remaining === 0) resolve(!criticalFailure);
        };

        tileJobs.forEach(t => {
            /* OSM/Esri tile X indeksi lon -180'den başlar; grid col 0 ise lon 0'dadır → n/2 kaydır.
               (Canlı doğrulama: Ankara z=4 → x=9). Y ekseni doğrudan hizalı (satır 0 = 85.05°N). */
            const sourceX = (t.col + n / 2) % n;
            const img = tilesG.append('image')
                .attr('x', frame.x + t.col * tileSize)
                .attr('y', frame.y + t.row * tileSize)
                /* 0.6px taşma: tile dikişlerindeki ince çizgi artefaktını kapatır */
                .attr('width', tileSize + 0.6)
                .attr('height', tileSize + 0.6)
                .attr('preserveAspectRatio', 'none');
            const imgNode = img.node();
            let settledNow = false;
            const done = ok => {
                if (settledNow) return;
                settledNow = true;
                if (!ok) { img.remove(); settle(false); }
                else { imgNode.classList.add('tile-loaded'); settle(true); }
            };
            imgNode.onload = () => done(true);
            imgNode.onerror = () => done(false);
            img.attr('href', source.url(zoomLevel, sourceX, t.row));
        });
    });
}

/* renderD3Map'in sonunda çağrılır: uydu modu açıksa görünen gridi (yeniden) çizer. */
function updateSatelliteTilesAfterRender(width, height) {
    clearSatelliteTiles();
    updateSatelliteButtonState();
    if (!satelliteModeActive || !geojsonData || !mapG) return;

    const padding = 12;
    const projection = d3.geoMercator()
        .fitExtent([[padding, padding], [width - padding, height - padding]], geojsonData);
    const frame = getSatelliteWorldFrame(projection);
    if (!frame || frame.size <= 0) return;

    const zoomLevel = getSatelliteZoomLevel(frame.size);

    const trySource = idx => {
        if (idx >= SATELLITE_TILE_SOURCES.length) return; /* tüm kaynaklar başarısız: katman sessizce boş kalır, vektör harita aynen çalışır */
        drawSatelliteTilesWithSource(frame, zoomLevel, SATELLITE_TILE_SOURCES[idx], width, height)
            .then(ok => { if (!ok) trySource(idx + 1); });
    };
    trySource(0);
}

/* ==========================================================================
   EXCEL EXPORT & IMPORT
   ========================================================================== */
function exportDataExcel() {
    const dataRows = jobs.map(j => {
        const timelineStr = (j.timeline || []).map((t, idx) => `[Sıra ${j.timeline.length - idx}]: ${t.text}`).join(' | ');
        return {
            "Sistem ID (Değiştirmeyin)": j.id || '',
            "Kategori / Protokol": j.section || '250Bin',
            "Tür": j.tur || '-',
            "Protokol": j.protokol || '-',
            "İl": j.il || '',
            "İlçe": j.ilce || '',
            "İş Tanımı": j.is_tanimi || '',
            "Klasör Bağlantısı": j.folder_path || '',
            "Avan / Uygulama": j.avan_uygolama || '-',
            "Proje Müşaviri": j.proje || '',
            "Toplam İnşaat Alanı (m²)": formatTrNumber(parseTrNumber(j.insaat_alani), 2),
            "Proje Alt Yüklenici": j.alt_yuklenici || '',
            "Kentsel ve Emlak Yazısı": j.digerDaire || '',
            "İhale Yazısı": j.ihale_yazisi || '',
            "Aşama": j.asama || 'Yapım',
            "İhale Tarihi": j.ihale_tarihi || '',
            "Sözleşme Tarihi": j.sozlesme_tarihi || '',
            "İhale Bedeli": formatTrNumber(parseTrNumber(j.ihale_bedeli), 2),
            "İnşaat Müşaviri": j.insaat_musaviri || '-',
            "Yüklenici": j.yuklenici || '',
            "Önemli Notlar": j.important_notes || '',
            "Tarihçe": timelineStr
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "İş Listesi");
    XLSX.writeFile(workbook, `EtutProje_Is_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function importDataExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (!jsonData || jsonData.length === 0) {
                alert("Excel dosyasında okunabilir veri bulunamadı.");
                return;
            }

            let updatedCount = 0;
            let addedCount = 0;
            let skippedCount = 0;

            jsonData.forEach(row => {
                const excelId = String(row["Sistem ID (Değiştirmeyin)"] || row["Sistem ID"] || row["ID"] || "").trim();
                const is_tanimi = String(row["İş Tanımı"] || "").trim();
                const il = String(row["İl"] || "").trim();
                const ilce = String(row["İlçe"] || "").trim();

                if (!is_tanimi && !il) {
                    skippedCount++;
                    return;
                }

                const timelineRaw = row["Tarihçe"] || '';
                const timelineArr = [];
                if (timelineRaw) {
                    const entries = String(timelineRaw).split('|');
                    entries.forEach(ent => {
                        let text = ent.replace(/^\[Sıra \d+\]:\s*/, '').trim();
                        if (text) timelineArr.push({ text: text });
                    });
                }

                let existingJobIndex = -1;

                if (excelId) {
                    existingJobIndex = jobs.findIndex(j => String(j.id) === excelId);
                }
                
                if (existingJobIndex === -1 && is_tanimi && il) {
                    existingJobIndex = jobs.findIndex(j => 
                        String(j.is_tanimi).trim().toLowerCase() === is_tanimi.toLowerCase() &&
                        String(j.il).trim().toLowerCase() === il.toLowerCase() &&
                        String(j.ilce).trim().toLowerCase() === ilce.toLowerCase()
                    );
                }

                const jobData = {
                    section: row["Kategori / Protokol"] || row["Proje Türü"] || '250Bin',
                    tur: row["Tür"] || '-',
                    protokol: row["Protokol"] || '-',
                    kapsam: "AFET",
                    il: il,
                    ilce: ilce,
                    is_tanimi: is_tanimi,
                    folder_path: row["Klasör Bağlantısı"] || row["Klasör Yolu"] || '',
                    avan_uygolama: row["Avan / Uygulama"] || '-',
                    proje: row["Proje Müşaviri"] || '-',
                    insaat_alani: row["Toplam İnşaat Alanı (m²)"] || row["İnşaat Alanı"] || '',
                    alt_yuklenici: row["Proje Alt Yüklenici"] || row["Alt Yüklenici"] || '-',
                    digerDaire: row["Kentsel ve Emlak Yazısı"] || row["Diğer Daireler"] || '',
                    ihale_yazisi: row["İhale Yazısı"] || '',
                    asama: row["Aşama"] || 'Yapım',
                    insaat_musaviri: row["İnşaat Müşaviri"] || '-',
                    important_notes: row["Önemli Notlar"] || '',
                    ihale_tarihi: row["İhale Tarihi"] || '',
                    sozlesme_tarihi: row["Sözleşme Tarihi"] || '',
                    ihale_bedeli: row["İhale Bedeli"] || '',
                    yuklenici: row["Yüklenici"] || '',
                    timeline: timelineArr
                };

                if (existingJobIndex !== -1) {
                    jobs[existingJobIndex] = {
                        ...jobs[existingJobIndex],
                        ...jobData,
                        id: jobs[existingJobIndex].id
                    };
                    updatedCount++;
                } else {
                    const newJob = {
                        ...jobData,
                        /* Excel'deki "Sistem ID" hücresi kullanıcı kontrolünde olsa da bu kimlik
                           doğrudan onclick özniteliklerine gömülür. Geçerli bir
                           kimlik deseni tutmuyorsa (tırnak, backslash, boşluk vb.)
                           üretilmiş kimlik kullanılır. */
                        id: excelId ? safeRecordId(excelId, 'job') : makeRecordId('job'),
                        experts: { mimari: "-", statik: "-", elektrik: "-", mekanik: "-", altyapi: "-", peyzaj: "-", zemin: "-", plankote: "-" }
                    };
                    jobs.unshift(newJob);
                    addedCount++;
                }
            });

            saveAllData();
            renderCurrentView();
            
            alert(`İçe Aktarım Tamamlandı!\n\n• ${updatedCount} adet mevcut iş güncellendi.\n• ${addedCount} adet yeni iş eklendi.\n• ${skippedCount} adet boş satır atlandı.`);
            e.target.value = '';
        } catch (err) { 
            alert("Excel okunurken hata oluştu: " + err.message); 
        }
    };
    reader.readAsArrayBuffer(file);
}

/* ------------------------------------------------------------------
   GLOBAL ARAMA MOTORU — Çoklu Kelime (AND) Mantığı
   ------------------------------------------------------------------
   1) normalizeSearchText: Türkçe locale uyumlu küçük harfe çevirme.
      toLocaleLowerCase('tr-TR') kullanılır; bu yüzden "I" -> "ı" ve
      "İ" -> "i" olur. Ardından normalize('NFD') ile aksanlı harfler
      (ş, ğ, ö, ü, ç) Latin karşılıklarına indirgenir. Böylece kullanıcı
      "SAMSUN", "samsun" veya "Samsun" yazsa aynı sonuç bulunur.
   2) getSearchTokens: sorguyu boşluklara bölüp terim listesine çevirir.
   3) matchesAllSearchTokens: AND mantığı — her terim bulunmalıdır.
   4) getJobSearchHaystack: kaydın taranabilir tüm alanlarını TEK bir
      metin hâline getirir (il/ilçe, iş tanımı, kategori/protoköl,
      müşavir, alt yüklenici, aşama, timeline notları vb.).
   5) jobMatchesSearch: merkezî eşleşme; tüm tablolar bunu kullanır.
   ------------------------------------------------------------------ */

/* Türkçe harfleri (İ, I, ı, Ş, ş, Ğ, ğ, Ü, ü, Ö, ö, Ç, ç) Latin
   karşılıklarına indirger ve locale duyarlı küçük harfe çevirir. */
function normalizeSearchText(text) {
    let s = String(text == null ? '' : text);
    // Önce locale uyumlu küçük harf: "I" -> "ı", "İ" -> "i" olur.
    if (typeof s.toLocaleLowerCase === 'function') s = s.toLocaleLowerCase('tr-TR');
    else s = s.toLowerCase();
    // Aksanlı harfleri indirge (ş->s, ğ->g, ö->o, ü->u, ç->c, â->a).
    if (typeof s.normalize === 'function') {
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return s
        .replace(/ı/g, 'i').replace(/İ/g, 'i')
        .replace(/ş/g, 's').replace(/Ş/g, 's')
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/Ü/g, 'u')
        .replace(/ö/g, 'o').replace(/Ö/g, 'o')
        .replace(/ç/g, 'c').replace(/Ç/g, 'c')
        .replace(/\s+/g, ' ')
        .trim();
}

/* Sorguyu boşluklara bölüp normalize edilmiş TERİM listesine çevirir.
   "  Samsun   500  " -> ["samsun", "500"]. Boş terimler atılır. */
function getSearchTokens(query) {
    return normalizeSearchText(query)
        .split(' ')
        .map(t => t.trim())
        .filter(Boolean);
}

/* Tek bir terimin, normalize edilmiş metinde geçip geçmediği.
   İki farklı kural uygulanır:

   1) HARFSEL terim -> alt dize eşleşmesi. "konut" araması "Konut Yapı
      Projesi"ni bulmalıdır; bu yüzden harfsel terimlerde kısmi eşleşme
      kabul edilir.

   2) SAYISAL terim -> SAYI SINIRI şart. Aksi halde alt dize eşleşmesi
      kaba bir yanlış pozitif üretir: "1" araması "12.05" içinde de
      geçerdi. Bunun yerine metindeki tam sayı blokları taranır ve
      sorgu terimi ya tam olarak eşitlenir ya da (en az 2 haneli ise)
      bloğun BAŞINDAN bir öneki olur. Böylece yazarken "12" yazan
      kullanıcı "12.05"i bulur, "1" yazan kullanıcı her şeyi bulmaz. */
function haystackContainsToken(hay, token) {
    if (!/^\d+$/.test(token)) return hay.indexOf(token) !== -1;
    if (hay.indexOf(token) === -1) return false; // hizli eleme
    const numberBlocks = hay.match(/\d+(?:\.\d+)*/g) || [];
    for (let i = 0; i < numberBlocks.length; i++) {
        const block = numberBlocks[i];
        if (block === token) return true;
        if (token.length >= 2 && block.indexOf(token) === 0) return true;
    }
    return false;
}

/* AND mantığı: normalize edilmiş metin içinde TERİM listesinin tamamı
   var mı? Kelime sırası önemsizdir — "500 samsun" ile "samsun 500"
   aynı kaydı bulur. */
function matchesAllSearchTokens(haystackNormalized, tokens) {
    if (!tokens || !tokens.length) return true;
    const hay = haystackNormalized || '';
    for (let i = 0; i < tokens.length; i++) {
        if (!haystackContainsToken(hay, tokens[i])) return false;
    }
    return true;
}

/* Arama kapsamı: iş kayıtları, notlar ve günlük görevler. Kullanıcı not
   veya görev yazarken aradıysa ilgili panoya kendiliğinden geçilir; yazarken
   ekran değiştirmek rahatsız edici olurdu, bu yüzden yalnızca ARAMA YAPILIRKEN
   (yani gerçekten eşleşen içerik varsa veya kutu boşaltıldığında) geçiş yapılır. */
const SEARCHABLE_VIEWS = ['projects', 'active-jobs', 'missing-info', 'custom-list', 'messages', 'tasks'];

/* Sorgunun normalize edilmiş terim listesi. handleGlobalSearch her
   çalıştığında güncellenir; filtreleyen tüm fonksiyonlar buradan okur. */
let globalSearchTokens = [];
let globalSearchDebounceTimer = null;

/* Arama kutusuna yazılan her tuş vuruşunda tabloyu yeniden çizmek
   yerine 250ms beklenir (debounce). Hızlı yazarken gereksiz render
   yapılmaz. Kutuyu boşaltmak (silme tuşu) anında uygulanır, çünkü
   kullanıcı filtreyi kaldırmak istediğini açıkça belirtmiştir. */
function handleGlobalSearch(query) {
    const isClearing = !String(query == null ? '' : query).trim();
    if (globalSearchDebounceTimer) {
        clearTimeout(globalSearchDebounceTimer);
        globalSearchDebounceTimer = null;
    }
    if (!isClearing) {
        globalSearchDebounceTimer = setTimeout(() => {
            globalSearchDebounceTimer = null;
            applyGlobalSearch(query);
        }, 250);
        return;
    }
    applyGlobalSearch(query);
}

/* Asıl arama uygulaması (debounce geciktikten sonra çalışır). */
function applyGlobalSearch(query) {
    globalSearchQuery = normalizeSearchText(query);
    globalSearchTokens = getSearchTokens(query);

    // Arama kutusunun "aktif filtre" görünümü: dolu olduğunda kutu vurgulanır.
    const searchWrap = document.querySelector('.topbar-search');
    if (searchWrap) searchWrap.classList.toggle('has-query', !!globalSearchQuery);

    const wasSearchable = SEARCHABLE_VIEWS.indexOf(activeView) !== -1;

    // Arama kutusuna yazarken ekranın kendiliğinden değişmesi rahatsız
    // edici olurdu. Bu yüzden yönlendirme sadece başka bir ekrandayken
    // yapılır ve yalnızca not/görevde gerçekten eşleşme varsa onlara gidilir.
    if (!wasSearchable) {
        if (globalSearchQuery && hasNoteSearchMatch()) navigateTo('messages');
        else if (globalSearchQuery && hasTaskSearchMatch()) navigateTo('tasks');
        else navigateTo('projects');
    }

    renderSearchableView();
}

function renderSearchableView() {
    if (activeView === 'active-jobs') renderActiveJobsTable();
    else if (activeView === 'missing-info') renderMissingInfoTable();
    else if (activeView === 'custom-list') renderCustomListTable();
    else if (activeView === 'messages') renderNotes();
    else if (activeView === 'tasks') renderDailyTasks();
    else renderProjectsTable();
}

function getNotePlainText(note) {
    /* Gövde artık HTML tutabilir; aramada etiketler ve biçimlendirme
       görünmemeli. Geçici bir div kurup innerText almak en güvenlisi,
       çünkü sanitizeNoteHtml zaten script/olay özniteliklerini temizliyor. */
    if (!note || !note.body) return '';
    const probe = document.createElement('div');
    probe.innerHTML = sanitizeNoteHtml(note.body);
    return (probe.textContent || '').replace(/\s+/g, ' ').trim();
}

function getNoteSearchHaystack(note) {
    return normalizeSearchText([
        note.title || '',
        note.tag || '',
        note.date || '',
        getNotePlainText(note)
    ].join(' '));
}

function getNotesMatchingSearch() {
    if (!globalSearchTokens || !globalSearchTokens.length) return notes;
    return notes.filter(n => matchesAllSearchTokens(getNoteSearchHaystack(n), globalSearchTokens));
}

function hasNoteSearchMatch() { return getNotesMatchingSearch().length > 0; }

function getTasksMatchingSearch() {
    if (!globalSearchTokens || !globalSearchTokens.length) return tasks;
    return tasks.filter(t => matchesAllSearchTokens(
        normalizeSearchText(`${t.text || ''} ${t.date || ''} ${t.emoji || ''}`),
        globalSearchTokens
    ));
}

function hasTaskSearchMatch() { return getTasksMatchingSearch().length > 0; }

/* İŞ KAYDI ARAMA ALANI — tek kaynak. Önce her alan normalize edilip
   araya boşluk konur; sonra normalize edilmiş terim listesiyle AND
   eşleşmesi yapılır. Eskiden alanlar tek tek yazılıyordu (4 ayrı yerde)
   ve "asama" bazı tablolarda aranmıyordu, timeline notları hiçbir
   yerde aranmıyordu. Şimdi tek listeden beslenir. */
function getJobSearchHaystack(job) {
    if (!job) return '';
    const timelineText = (job.timeline || [])
        .map(t => (t && t.text) ? t.text : '')
        .join(' ');
    return normalizeSearchText([
        job.il || '', job.ilce || '',
        job.is_tanimi || '', job.proje || '', job.alt_yuklenici || '',
        job.tur || '', job.asama || '', job.section || '',
        job.tarih || '', job.birim || '', job.telefon || '',
        timelineText
    ].join(' '));
}

/* Merkezî eşleşme: tüm iş kaydı tabloları bu fonksiyonu kullanır.
   Koruma terim listesine bakar, ham sorguya değil: normalizasyon
   sonrası boş kalan bir sorgu (örn. sadece "  " veya "!!!") tüm
   kayıtları geçirmeli, hiçbirini elememeli. */
function jobMatchesSearch(job) {
    if (!globalSearchTokens || !globalSearchTokens.length) return true;
    return matchesAllSearchTokens(getJobSearchHaystack(job), globalSearchTokens);
}

/* TÜM İŞLER: filtreleri temizler ve tür listesini sıralı geçişle açıp kapatır. */
function clearGlobalSearch() {
    globalSearchQuery = '';
    /* Terim listesi de temizlenmeli: clearGlobalSearch, handleGlobalSearch
       dışında da çağrılıyor (filtre sıfırlama, tür değiştirme vb.) ve
       eski terimler kalsaydı boş listede filtre uygulanırdı. */
    globalSearchTokens = [];
    /* Bekleyen debounce varsa iptal edilir; aksi halde kutu temiz
       yazıldıktan 250ms sonra eski sorgu tekrar uygulanırdı. */
    if (globalSearchDebounceTimer) {
        clearTimeout(globalSearchDebounceTimer);
        globalSearchDebounceTimer = null;
    }
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) searchInput.value = '';
    const searchWrap = document.querySelector('.topbar-search');
    if (searchWrap) searchWrap.classList.remove('has-query');
}

function navigateToProjectsAll() {
    selectedExcelFilters = {};
    clearGlobalSearch();

    isTurSublistExpanded = !isTurSublistExpanded;
    navigateTo('projects');
    renderProjectsTable();
    renderSidebarTurSublist(true);
}

function navigateToProjectsByTur(turVal) {
    if (!turVal) {
        delete selectedExcelFilters['tur'];
    } else {
        selectedExcelFilters['tur'] = turVal;
    }
    isTurSublistExpanded = true;
    navigateTo('projects');
    renderProjectsTable();
    renderSidebarTurSublist();
}

/* ==========================================================================
   PANEL AÇIKLAMA KATMANI
   --------------------------------------------------------------------------
   Yeni kullanıcı (ya da panoyu tanımayan bir meslektaş) uygulamayı ilk kez
   açtığında her ekranın NE İŞE YARADIĞINI bilmelidir. Bu katman, her view
   başlığının hemen altına kısa bir açıklama bandı yerleştirir.

   Neden ayrı bir katman: HTML'i elle düzenlemek yerine tek bir tablodan
   beslenir, böylece yeni panel eklendiğinde buraya tek satır eklemek yeterlidir.
   Metinler Türkçedir ve panelin gerçek davranışını anlatır.

   Kapatma davranışı: kullanıcı bir kez kapatırsa tercihi localStorage'da
   saklanır ve o oturumda tekrar açılmaz — rehber, sürekli yer kaplamasın.
   ========================================================================== */
const PANEL_GUIDE = {
    'home': {
        title: 'Ana Sayfa — Genel Bakış',
        text: 'KPI kartları (toplam/aktif iş, bugünkü işler, yapım), Türkiye haritası ve dört canlı panel burada toplanır. Haritadaki bir ile tıklamak o ilin işlerini sağ drawer\'da açar; KPI çiplerine tıklamak tabloyu ilgili türe süzgeçler.'
    },
    'active-jobs': {
        title: 'Aktif İş Listesi — Takipteki işler',
        text: 'Yalnızca "Aktif İşler" listesine eklediğiniz işler. Üstteki araçlar ile süzgeçleyebilir, Excel\'e aktarabilir veya yeni kayıt ekleyebilirsiniz. Satırdaki göz/kalem/çöp ikonları detay, düzenleme ve silme işlemleridir.'
    },
    'projects': {
        title: 'Tüm İşler — Ana kayıt listesi',
        text: 'Uygulamanın ana veri tablosu. Tüm işler burada listelenir; tür, il, aşama, protokol gibi alanlara göre süzgeçlenebilir. "Excel Dışa Aktar" ile tüm liste indirilebilir.'
    },
    'custom-list': {
        title: 'Özel İş Listesi — Seçtiğiniz kolonlar',
        text: 'Kendi kriterlerinize göre bir liste görünümü oluşturursunuz. Hangi kolonların görüneceğini, sırasını ve genişliğini siz belirlersiniz; liste tercihiniz tarayıcınızda saklanır.'
    },
    'missing-info': {
        title: 'Veri Tamamlama — Eksik alanlar',
        text: 'Kayıtlarda boş bırakılmış zorunlu alanları listeler. Bu ekran sayesinde hiçbir iş yarım kalmaz; satırdaki kırmızı işaretler hangi alanın eksik olduğunu gösterir.'
    },
    'messages': {
        title: 'Notlar & Mesajlar — Pano düzeni',
        text: 'Bilgi, Önemli, Toplantı, Karar ve İhale Öncesi başlıklı panolar. Kartları sürükleyerek panolar arası taşıyabilir, düzenleyebilir veya silebilirsiniz.'
    },
    'tasks': {
        title: 'Bugünkü İşler — Günlük görev listesi',
        text: 'Günlük yapılacak işler. Tarih başlıklarına göre gruplanır; önceki günden tamamlanmamış önemli görevler otomatik olarak bugüne taşınır. Yıldız ile öncelik verirsiniz.'
    },
    'stats': {
        title: 'İstatistik — Veri görselleştirme',
        text: 'İl, tür, aşama ve yıl bazında dağılım grafikleri. Grafiklerin çoğu tıklanabilir: il grafiğine tıklayınca harita o ile açılır.'
    },
    'files': {
        title: 'Dosyalar — Yerel klasör bağlantıları',
        text: 'Sık kullandığınız proje klasörlerine kısayol tanımlarsınız. Uygulama dosyanın İÇERİĞİNİ okumaz; yalnızca yol adresi saklanır ve tıklandığında sistemde açılır.'
    },
    'settings': {
        title: 'Ayarlar — Görünüm ve veri',
        text: 'Renk paleti, profil bilgileri, panel düzeni ve geri sayım ayarları. "Yedek İndir" ile tüm verinizi JSON olarak indirebilir, "Yedek Yükle" ile geri yükleyebilirsiniz.'
    }
};

const PANEL_GUIDE_KEY = 'yaser_v10_panel_guide_hidden';

function renderPanelGuide(viewId) {
    const info = PANEL_GUIDE[viewId];
    const el = document.getElementById('view-' + viewId);
    if (!info || !el) return;

    let box = document.getElementById('panel-guide-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'panel-guide-box';
        box.className = 'panel-guide';
        box.setAttribute('role', 'note');
        document.body.appendChild(box);
    }

    let hidden = false;
    try { hidden = localStorage.getItem(PANEL_GUIDE_KEY) === '1'; } catch (e) { /* private mod */ }
    box.style.display = hidden ? 'none' : 'flex';
    box.dataset.view = viewId;

    /* İçerik her seferde yeniden yazılır; XSS için metin DÜZ yazılır, innerHTML
       kullanılmaz. Panel açıklamaları sabit tanımlar olsa da burada kullanıcı
       metnine açılan her noktada aynı kural geçerli. */
    box.textContent = '';

    const label = document.createElement('span');
    label.className = 'panel-guide-label';
    label.textContent = info.title;

    const body = document.createElement('span');
    body.className = 'panel-guide-text';
    body.textContent = info.text;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'panel-guide-close';
    close.setAttribute('aria-label', 'Panel açıklamasını gizle');
    close.textContent = '×';
    close.onclick = function () {
        box.style.display = 'none';
        try { localStorage.setItem(PANEL_GUIDE_KEY, '1'); } catch (e) { /* yoksay */ }
    };

    box.appendChild(label);
    box.appendChild(body);
    box.appendChild(close);
}

function navigateTo(targetView) {
    renderPanelGuide(targetView);
    /* Mobilde bir ekrana geçiş menüyü kapatsın: aksi hâlde yeni ekran 264px
       çekmecenin altında kalır ve görünmez olur. */
    if (isMobileNavOpen()) closeMobileNav();
    if (targetView !== 'home') {
        closeDashboardDrawer();
    }

    if (activeView === targetView && document.getElementById('view-' + targetView).classList.contains('active')) {
        return;
    }

    const currentEl = document.getElementById('view-' + activeView);
    const nextEl = document.getElementById('view-' + targetView);

    if (!nextEl) return;

    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + targetView);
    if (navItem) navItem.classList.add('active');

    if (currentEl) {
        /* FX: giden ekrana kisa bir cikis ver. .active ONCE kaldirilir, sonra
           playFxViewExit() cikis sinifini ekler. Sira onemlidir: .active
           kurali fxViewEnter uyguladigi icin, cikis sinifi ancak .active
           kalktiktan sonra anlamli olur. */
        currentEl.classList.remove('active');
        if (typeof playFxViewExit === 'function') {
            playFxViewExit(currentEl);
        }
    }

    activeView = targetView;
    renderCurrentView();

    nextEl.classList.add('active');
    updateMenuIndicator();

    if (targetView === 'home') {
        setTimeout(() => {
            if (geojsonData) {
                renderD3Map();
            }
        }, 50);
    }
}

function navigateToSettingsTab(tabName) {
    navigateTo('settings');
    switchSettingsTab(tabName);
}

function switchSettingsTab(tabName) {
    const colorsContent = document.getElementById('settings-tab-colors-content');
    const listsContent = document.getElementById('settings-tab-lists-content');
    const saverContent = document.getElementById('settings-tab-screensaver-content');
    const countdownContent = document.getElementById('settings-tab-countdown-content');
    const profileContent = document.getElementById('settings-tab-profile-content');
    const securityContent = document.getElementById('settings-tab-security-content');
    const aboutContent = document.getElementById('settings-tab-about-content');
    const btnColors = document.getElementById('tab-btn-colors');
    const btnLists = document.getElementById('tab-btn-lists');
    const btnSaver = document.getElementById('tab-btn-screensaver');
    const btnCountdown = document.getElementById('tab-btn-countdown');
    const btnProfile = document.getElementById('tab-btn-profile');
    const btnSecurity = document.getElementById('tab-btn-security');
    const btnAbout = document.getElementById('tab-btn-about');

    if (!colorsContent || !listsContent || !saverContent) return;

    colorsContent.style.display = 'none';
    listsContent.style.display = 'none';
    saverContent.style.display = 'none';
    if (countdownContent) countdownContent.style.display = 'none';
    /* NOT: Her eklenen sekmenin içeriği de burada kapatılmalı. Kapatılmayan
       sekme bir kez açılıp sonra başka sekmeye geçilince gizlenmeden ekranda
       kalıyor ve iki panel birden açık görünüyordu. */
    if (profileContent) profileContent.style.display = 'none';
    if (securityContent) securityContent.style.display = 'none';
    if (aboutContent) aboutContent.style.display = 'none';
    btnColors.classList.remove('active');
    btnLists.classList.remove('active');
    if (btnSaver) btnSaver.classList.remove('active');
    if (btnCountdown) btnCountdown.classList.remove('active');
    if (btnProfile) btnProfile.classList.remove('active');
    if (btnSecurity) btnSecurity.classList.remove('active');
    if (btnAbout) btnAbout.classList.remove('active');

    if (tabName === 'colors') {
        colorsContent.style.display = 'flex';
        btnColors.classList.add('active');
    } else if (tabName === 'profile') {
        if (profileContent) profileContent.style.display = 'flex';
        if (btnProfile) btnProfile.classList.add('active');
        loadProfileSettingsForm();
    } else if (tabName === 'security') {
        if (securityContent) securityContent.style.display = 'flex';
        if (btnSecurity) btnSecurity.classList.add('active');
        loadSecuritySettingsForm();
        loadGithubSettingsForm();
    } else if (tabName === 'about') {
        if (aboutContent) aboutContent.style.display = 'flex';
        if (btnAbout) btnAbout.classList.add('active');
        renderAboutVersion();
    } else if (tabName === 'screensaver') {
        saverContent.style.display = 'flex';
        if (btnSaver) btnSaver.classList.add('active');
    } else if (tabName === 'countdown') {
        if (countdownContent) countdownContent.style.display = 'flex';
        if (btnCountdown) btnCountdown.classList.add('active');
        loadCountdownSettingsForm();
    } else {
        listsContent.style.display = 'block';
        btnLists.classList.add('active');
    }
}

/* SOL MENÜDEKİ "TÜR" LİSTESİNİ RENDER ETME */
function renderSidebarTurSublist(animateOpen = false) {
    const container = document.getElementById('sidebar-tur-sublist');
    const projectsNav = document.getElementById('nav-projects');
    if (!container || !projectsNav) return;

    const turList = settings.tur || ["MSB", "EGM", "JGK", "-", "İDARE UYGULAMA", "KENTSEL", "TALEP"];
    const activeTurFilter = selectedExcelFilters['tur'];

    /* Tür başına proje sayısı (sistem genelinde, filtrelerden bağımsız) */
    const turCountMap = {};
    jobs.forEach(j => {
        const key = (j.tur || '-');
        turCountMap[key] = (turCountMap[key] || 0) + 1;
    });

    projectsNav.classList.toggle('tur-list-expanded', isTurSublistExpanded);
    projectsNav.setAttribute('aria-expanded', String(isTurSublistExpanded));

    if (animateOpen && isTurSublistExpanded) container.classList.remove('expanded');

    container.innerHTML = turList.map(tVal => {
        const isActive = activeView === 'projects' && activeTurFilter === tVal;
        const turCount = turCountMap[tVal] || 0;
        return `
            <li class="sub-menu-item ${isActive ? 'active' : ''}" onclick="navigateToProjectsByTur('${escapeJsAttr(tVal)}')">
                <i class="fa-solid fa-angle-right" aria-hidden="true"></i>
                <span>${escapeHtml(tVal)}</span>
                <span class="sub-menu-count">${turCount}</span>
            </li>
        `;
    }).join('');

    if (isTurSublistExpanded) {
        if (animateOpen) {
            /* Sadece Tüm İşler tıklamasında satırları sırayla görünür yap. */
            requestAnimationFrame(() => {
                if (isTurSublistExpanded) container.classList.add('expanded');
            });
        } else {
            container.classList.add('expanded');
        }
    } else {
        container.classList.remove('expanded');
    }
}

function updateGlobalCounts() {
    /* PERF: Eski hâli `activeJobIds.map(String)` + her iş için `includes()`
       ile geçiyordu, yani O(iş × aktif iş) tarama yapılıyordu; artık Set
       üzerinden O(1) üyelik. Aynı şekilde yalnızca SAYISI gereken filtreler
       (aktif iş, eksik bilgi, tamamlanan) artık dizi üretmiyor, tek döngüde
       sayaç toplanıyor. Hesaplanan değerler birebir aynıdır. */
    const activeIdSet = new Set(activeJobIds.map(String));

    let validActiveCount = 0;
    let completedJobsCount = 0;
    let missingInfoCount = 0;

    /* KPI kart 4 (YAPIM) ana sayacı: aşama kırılımı, KPI_ASAMA_ALL eşleşme
       tablosuyla (updateGlobalKpiSubstats ile birebir aynı) burada toplanır.
       "İhale (yapım sürecinde)" gibi bileşik etiketler ilk eşleşen aşamaya
       gider; böylece ana sayaç ile çip kırılımı asla ayrışmaz. */
    const asamaCounts = {};
    KPI_ASAMA_ALL.forEach(key => { asamaCounts[key] = 0; });
    let asamaUnrecognizedCount = 0;

    for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i];
        if (activeIdSet.has(String(j.id))) validActiveCount++;

        const asamaText = (j.asama || '').toLocaleLowerCase('tr-TR');
        if (asamaText.includes('bitti') || asamaText.includes('tamamlanan')) completedJobsCount++;

        let matchedAsamaKey = null;
        for (let k = 0; k < KPI_ASAMA_ALL.length; k++) {
            const keyText = KPI_ASAMA_ALL[k].toLocaleLowerCase('tr-TR');
            if (asamaText === keyText || asamaText.includes(keyText)) { matchedAsamaKey = KPI_ASAMA_ALL[k]; break; }
        }
        if (matchedAsamaKey) asamaCounts[matchedAsamaKey]++; else asamaUnrecognizedCount++;

        if (checkJobMissingInfo(j)) missingInfoCount++;
    }

    const todayTasksCount = tasks.reduce((sum, t) => sum + (t.completed ? 0 : 1), 0);

    /* PERF: Aynı id 6 kez sorgulanıyordu (12 getElementById çağrısı).
       Tek seferde alınıp yeniden kullanılıyor. */
    const navCountMessages = document.getElementById('nav-count-messages');
    const navCountTasks = document.getElementById('nav-count-tasks');
    const navCountProjects = document.getElementById('nav-count-projects');
    const navCountActiveJobs = document.getElementById('nav-count-active-jobs');
    const navCountMissingInfo = document.getElementById('nav-count-missing-info');
    const navCountFiles = document.getElementById('nav-count-files');

    if (navCountMessages) navCountMessages.innerText = notes.length;
    if (navCountTasks) navCountTasks.innerText = todayTasksCount;
    if (navCountProjects) navCountProjects.innerText = jobs.length;
    if (navCountActiveJobs) navCountActiveJobs.innerText = validActiveCount;
    if (navCountMissingInfo) navCountMissingInfo.innerText = missingInfoCount;
    if (navCountFiles) navCountFiles.innerText = files.length;

    animateCountUp('home-kpi-total', jobs.length);
    animateCountUp('home-kpi-active', validActiveCount);
    animateCountUp('home-kpi-today', todayTasksCount);
    /* KART 4 artık YAPIM: ana sayaç "bitti" değil "Yapım" aşamasını gösterir. */
    animateCountUp('home-kpi-biten', asamaCounts['Yapım']);

    /* KPI kartlarının alt-istatistik çipleri (tür/aşama kırılımları, yüzde
       payları, matematik doğrulaması ve toast uyarıları dahil). */
    updateGlobalKpiSubstats({ total: jobs.length, active: validActiveCount, today: todayTasksCount, done: completedJobsCount });

    /* Ana ekran 2x2 panellerini de tazele: updateGlobalCounts her veri
       değişiminde (görev işaretle/sil/ekle, aktif iş seç/çıkar, undo,
       gece devri) çağrıldığı için tek noktadan tutarlılık sağlanır. */
    if (typeof renderDashActivePanel === 'function') renderDashActivePanel();
    if (typeof renderDashDataPanel === 'function') renderDashDataPanel();
    if (typeof renderDashDeadlinePanel === 'function') renderDashDeadlinePanel();
    if (typeof renderDashTodayPanel === 'function') renderDashTodayPanel();

    renderTickerBar();
}

function animateCountUp(elementId, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const target = Number(targetValue) || 0;
    const from = Number(el.dataset.countValue || 0);
    el.dataset.countValue = String(target);

    if (el.dataset.countRaf) cancelAnimationFrame(Number(el.dataset.countRaf));
    if (from === target) {
        el.innerText = target;
        /* FX: deger degismediyse bile hane yapisini hedefte tut (bkz. step). */
        if (el.dataset.fxDigits === '1') syncFxDigitRoll(el);
        return;
    }

    /* KPI kartında bir kez oynayan shine sweep */
    const card = el.closest('.kpi-card');
    if (card) {
        card.classList.remove('kpi-shine');
        void card.offsetWidth; /* animasyonu yeniden tetiklemek için reflow */
        card.classList.add('kpi-shine');
    }

    const duration = 800;
    const startedAt = performance.now();
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
        el.innerText = target;
        return;
    }

    const step = (now) => {
        const p = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(2, -10 * p); /* easeOutExpo */
        const shown = Math.round(from + (target - from) * eased);
        /* FX: .fx-digit yapisı kuruluysa innerText YAZMA. innerText yazimi
           hane span'lerini siler ve sayma boyunca deger gorunmez olur
           (olculmus hata: 800ms boyunca KPI bos kaldi). Bunun yerine
           applyFxDigitText() yalnizca DEGERI degisen haneleri gunceller;
           her karede yalnizca 1-3 span.textContent yazilir. */
        if (el.dataset.fxDigits === '1') {
            applyFxDigitText(el, String(shown));
            if (p < 1) {
                el.dataset.countRaf = String(requestAnimationFrame(step));
            } else {
                delete el.dataset.countRaf;
                syncFxDigitRoll(el);
            }
            return;
        }
        el.innerText = shown;
        if (p < 1) {
            el.dataset.countRaf = String(requestAnimationFrame(step));
        } else {
            el.innerText = target;
            delete el.dataset.countRaf;
        }
    };
    el.dataset.countRaf = String(requestAnimationFrame(step));
}

/* KPI alt-istatistik sabitleri: kart chip kümelerini tek yerden yönetir.
   Kural: her kartın kırılımı kartın ana sayacıyla toplanabilir olmalı
   (EGM+JGK+MSB+DİĞER = TOPLAM İŞ gibi). Aşama sayaçları "includes" ile
   eşlenir çünkü kayıtlarda "İhale (yapım sürecinde)" gibi uzun etiketler var. */
const KPI_TUR_CHIPS = [
    { label: 'EGM', dot: '#3b82f6' },
    { label: 'JGK', dot: '#22c55e' },
    { label: 'MSB', dot: '#f59e0b' },
    { label: 'DİĞER', dot: '#94a3b8', others: true }
];
const KPI_ASAMA_CHIPS = [
    { label: 'Proje', dot: '#10b981' },
    { label: 'İhale', dot: '#3b82f6' }
];
/* KART 4 (YAPIM) tür çipleri KPI_TUR_CHIPS'i paylaşır; eski KPI_ASAMA_BARS
   (Yapım/Beklemede/İptal/Bitti çipleri) kart 4 tür kırılımına dönüşünce
   kaldırıldı. Aşama anahtar listesi burada, tek yerde yaşar: */
const KPI_ASAMA_ALL = ['Proje', 'İhale', 'Yapım', 'Beklemede', 'İptal', 'Bitti'];

function updateGlobalKpiSubstats(mainCounts) {
    /* Null-safe ana sayaçlar: veri henüz yüklenmemişse 0 gösterilir. */
    const total = Number(mainCounts && mainCounts.total) || 0;
    const active = Number(mainCounts && mainCounts.active) || 0;
    const today = Number(mainCounts && mainCounts.today) || 0;
    const done = Number(mainCounts && mainCounts.done) || 0;

    /* Tek geçişte tür + aşama kırılımları (EGM/JGK/MSB birebir, geri kalan
       her şey DİĞER; "-" ve tanımsız türler dahil → toplam değişmezi korunur).
       Aşamalar includes ile esnek eşlenir ("İhale (talep)" gibi uzun etiketler
       kayıplara karışmaz). PERF: filtre başına ayrı jobs.filter yerine tek döngü. */
    const activeIdSet = new Set(activeJobIds.map(String));
    const turCounts = { EGM: 0, JGK: 0, MSB: 0, DIGER: 0 };
    const asamaAllCounts = {};
    KPI_ASAMA_ALL.forEach(a => { asamaAllCounts[a] = 0; });
    let asamaUnrecognized = 0;

    for (let i = 0; jobs && i < jobs.length; i++) {
        const j = jobs[i];
        if (!j) continue;

        const turVal = (j.tur || '').trim();
        if (turVal === 'EGM') turCounts.EGM++;
        else if (turVal === 'JGK') turCounts.JGK++;
        else if (turVal === 'MSB') turCounts.MSB++;
        else turCounts.DIGER++;

        /* İlk eşleşme kazanır: "İhale (yapım sürecinde)" gibi bileşik etiketler
           yalnızca İhale'ye sayılır, Yapım'a çift sayılmaz. Hiçbiri eşleşmezse
           kayıt "Diğer" kovasına düşer → aşama toplamı her zaman total'e ulaşır. */
        const asamaLower = (j.asama || '').toLocaleLowerCase('tr-TR');
        let matchedAsama = false;
        for (let k = 0; k < KPI_ASAMA_ALL.length; k++) {
            const keyText = KPI_ASAMA_ALL[k].toLocaleLowerCase('tr-TR');
            if (asamaLower === keyText || asamaLower.includes(keyText)) {
                asamaAllCounts[KPI_ASAMA_ALL[k]]++;
                matchedAsama = true;
                break;
            }
        }
        if (!matchedAsama) asamaUnrecognized++;
    }

    /* Bugünün görev kırılımı: tamamlananlar + ⚡/⭐ öncelik işaretçileri.
       Ana sayaç (today) tamamlanmamışları sayar; çip yüzdesi için taban
       olarak tamamlanan dahil geniş toplam kullanılır. */
    let todayDone = 0;
    let todayImportant = 0;
    for (let i = 0; tasks && i < tasks.length; i++) {
        const t = tasks[i];
        if (!t || !isTaskDayToday(t.date)) continue;
        if (t.completed) { todayDone++; continue; }
        if (t.emoji === '⚡' || t.emoji === '⭐') todayImportant++;
    }

    /* --- DOĞRULAMA: matematik değişmezleri -------------------------------
       1) EGM+JGK+MSB+DİĞER === jobs.length (TOPLAM İŞ)
       2) (Proje+İhale+Yapım+Beklemede+İptal+Bitti+Diğer) === jobs.length
          "Diğer" kovası tanınmayan aşamaları taşar; toplam yine total'e ulaşır. */
    const turSum = turCounts.EGM + turCounts.JGK + turCounts.MSB + turCounts.DIGER;
    let asamaSum = asamaUnrecognized;
    KPI_ASAMA_ALL.forEach(a => { asamaSum += asamaAllCounts[a]; });
    const validationWarnings = [];
    if (turSum !== total) validationWarnings.push(`Tür kırılımı (${turSum}) TOPLAM İŞ (${total}) ile tutarsız.`);
    if (asamaSum !== total) validationWarnings.push(`Aşama kırılımı (${asamaSum}) TOPLAM İŞ (${total}) ile tutarsız.`);

    /* Aktif işlerin aşama kırılımı (AKTİF kartı Proje/İhale çipleri için). */
    const activeAsamaCounts = { 'Proje': 0, 'İhale': 0 };
    activeIdSet.forEach(idStr => {
        const j = jobs.find(job => String(job.id) === idStr);
        if (!j) return;
        const asamaLower = (j.asama || '').toLocaleLowerCase('tr-TR');
        KPI_ASAMA_CHIPS.forEach(cfg => {
            const keyText = cfg.label.toLocaleLowerCase('tr-TR');
            if (asamaLower === keyText || asamaLower.includes(keyText)) activeAsamaCounts[cfg.label]++;
        });
    });

    /* --- KART 1: TOPLAM İŞ → tür kırılımı (EGM/JGK/MSB/DİĞER) --- */
    renderKpiChipRow('kpi-substats-total', KPI_TUR_CHIPS.map(cfg => ({
        label: cfg.label,
        value: cfg.others ? turCounts.DIGER : (turCounts[cfg.label] || 0),
        pctBase: total,
        dot: cfg.dot,
        tip: cfg.others
            ? 'EGM, JGK ve MSB dışındaki tüm türler (İDARE UYGULAMA, KENTSEL, TALEP, tanımsız türler dahil)'
            : `Türü ${cfg.label} olan tüm işler`,
        action: () => kpiChipFilterTur(cfg.others ? 'DİĞER' : cfg.label)
    })));

    /* --- KART 2: AKTİF İŞLER → aktif işlerin Proje/İhale kırılımı --- */
    renderKpiChipRow('kpi-substats-active', KPI_ASAMA_CHIPS.map(cfg => ({
        label: cfg.label,
        value: activeAsamaCounts[cfg.label] || 0,
        pctBase: active,
        dot: cfg.dot,
        tip: `Aktif odak listesinde aşaması ${cfg.label} olan işler`,
        action: () => kpiChipFilterAsama(cfg.label)
    })));

    /* --- KART 3: BUGÜNÜN İŞLERİ → tamamlanan + öncelik işaretçileri --- */
    renderKpiChipRow('kpi-substats-today', [
        {
            label: 'Tamamlanan', value: todayDone, pctBase: (today + todayDone), dot: '#22c55e',
            tip: 'Bugünün görev listesinde işaretlenmiş (bitmiş) görevler',
            action: () => navigateTo('tasks')
        },
        {
            label: '⚡ Öncelik', value: todayImportant, pctBase: today, dot: '#f43f5e',
            tip: 'Bugünün ⚡/⭐ işaretli görevleri (öncelikli işler)',
            action: () => navigateTo('tasks')
        }
    ]);

    /* --- KART 4 (YAPIM): Yapım aşamasındaki işlerin EGM/JGK/MSB/DİĞER kırılımı.
       Eşleşme, ana sayaçla (updateGlobalCounts → asamaCounts) birebir aynı
       KPI_ASAMA_ALL tablosu üzerinden yapılır; böylece kart ana sayacı ile
       çip toplamı her zaman eşittir (EGM+JGK+MSB+DİĞER = Yapım sayısı). --- */
    const yapimTurCounts = { EGM: 0, JGK: 0, MSB: 0, DIGER: 0 };
    for (let i = 0; jobs && i < jobs.length; i++) {
        const j = jobs[i];
        if (!j) continue;
        const asamaLower = (j.asama || '').toLocaleLowerCase('tr-TR');
        let isYapim = false;
        for (let k = 0; k < KPI_ASAMA_ALL.length; k++) {
            const keyText = KPI_ASAMA_ALL[k].toLocaleLowerCase('tr-TR');
            if (asamaLower === keyText || asamaLower.includes(keyText)) { isYapim = (KPI_ASAMA_ALL[k] === 'Yapım'); break; }
        }
        if (!isYapim) continue;
        const turVal = (j.tur || '').trim();
        if (turVal === 'EGM') yapimTurCounts.EGM++;
        else if (turVal === 'JGK') yapimTurCounts.JGK++;
        else if (turVal === 'MSB') yapimTurCounts.MSB++;
        else yapimTurCounts.DIGER++;
    }

    renderKpiChipRow('kpi-substats-biten', KPI_TUR_CHIPS.map(cfg => ({
        label: cfg.label,
        value: cfg.others ? yapimTurCounts.DIGER : (yapimTurCounts[cfg.label] || 0),
        pctBase: asamaAllCounts['Yapım'] || 0,
        dot: cfg.dot,
        tip: cfg.others
            ? 'Yapım aşamasında olup EGM/JGK/MSB dışı türde (İDARE UYGULAMA, KENTSEL, TALEP, tanımsız dahil) olan işler'
            : `Yapım aşamasındaki, türü ${cfg.label} olan işler`,
        action: () => kpiChipFilterYapimTur(cfg.others ? null : cfg.label)
    })), { activeKey: 'Yapım', activeMatch: 'turFilter' });

    /* Badge'ler canlı veriyle güncellenir (skeleton görünümü biter).
       yapim: kart 4 rozetinin yüzde tabanı (Yapım/Toplam). */
    updateKpiBadges({ total, active, today, done, yapim: asamaAllCounts['Yapım'] || 0 });

/* Sayaç doğrulama uyarısı yalnızca oturum başına BİR kez konsola yazılır;
   updateGlobalCounts her veri değişiminde çalıştığından aynı uyarı üst üste
   pörflemesin (konsol birikintisi). Toast tarafında da aynı tek-sefer kuralı. */
if (validationWarnings.length > 0) {
    if (!window.__kpiValidationWarned) {
        window.__kpiValidationWarned = true;
        console.warn('[KPI doğrulama]', validationWarnings.join(' | '));
        /* Toast yalnızca oturum başına bir kez: updateGlobalCounts her veri
           değişiminde çalıştığından aynı uyarı üst üste pörfülerdi. */
        if (!window.__kpiValidationToastShown) {
            window.__kpiValidationToastShown = true;
            if (typeof showToast === 'function') showToast('KPI doğrulama uyarısı: ' + validationWarnings.join(' '), 'warning');
        }
    }
}
}

function updateKpiBadges(mainCounts) {
    /* Kart 4 rozeti artık YAPIM: yüzde tabanı Yapım/Toplam (eski hali
       tamamlandı/Toplam idi). done yüzdesi hâlâ hesaplanıp saklanır; başka
       bir yerde gerekirse window.__kpiDonePct üzerinden okunabilir. */
    const pctYapim = mainCounts.total > 0 ? Math.round((Number(mainCounts.yapim) / mainCounts.total) * 100) : 0;
    const pctDone = mainCounts.total > 0 ? Math.round((mainCounts.done / mainCounts.total) * 100) : 0;
    window.__kpiDonePct = pctDone;
    const badgeDefs = [
        { id: 'home-kpi-total-badge', text: `${mainCounts.total} kayıt` },
        { id: 'home-kpi-active-badge', text: `${mainCounts.active} odak iş` },
        { id: 'home-kpi-today-badge', text: `${mainCounts.today} görev` },
        { id: 'home-kpi-biten-badge', text: `%${pctYapim} yapımda` }
    ];
    badgeDefs.forEach(def => {
        const el = document.getElementById(def.id);
        if (el) el.textContent = def.text;
    });
}

/* Chip satırını çizer. chips: [{label, value, pctBase, dot, tip, action}].
   Tıklama aksiyonları inline onclick ile serileştirilmez; her chip'e
   data-kpi-action-idx verilir ve tıklama satır düzeyinde TEK dinleyiciyle
   kayıt defterindeki (kpiChipActionRegistry) aksiyona yönlendirilir.
   Böylece veri değerleri asla HTML özniteliğine kod olarak gömülmez. */
const kpiChipActionRegistry = new Map();

function renderKpiChipRow(containerId, chips, opts) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const options = opts || {};
    const sumValues = chips.reduce((s, c) => s + (Number(c.value) || 0), 0);
    container.classList.remove('kpi-loading');

    if (sumValues === 0) {
        container.innerHTML = '<span style="font-size:9.6px; font-weight:700; opacity:0.5; letter-spacing:0.3px;">Henüz veri yok</span>';
        kpiChipActionRegistry.delete(containerId);
        return;
    }

    /* Aktif durum: harita tür filtresi veya tablo aşama filtresiyle eşleşen çipler vurgulanır.
       activeMatch: 'mapTur' (varsayılan) harita tür filtresine, 'turFilter' ise tablonun
       Excel tür filtresine bakar (YAPIM kartındaki tür çipleri bunu kullanır). */
    const activeTur = (typeof activeMapTypeFilter === 'string' && activeMapTypeFilter !== '-') ? activeMapTypeFilter : null;
    const activeTurFilter = (typeof selectedExcelFilters['tur'] === 'string') ? selectedExcelFilters['tur'] : null;
    const activeAsama = (typeof selectedExcelFilters['asama'] === 'string') ? selectedExcelFilters['asama'] : null;
    const matchTurFilter = options.activeMatch === 'turFilter';

    const actions = [];
    const html = chips.map((c, idx) => {
        const value = Number(c.value) || 0;
        const base = Number(c.pctBase) || 0;
        const pct = base > 0 ? Math.round((value / base) * 100) : 0;
        const labelStr = String(c.label);
        const isEmpty = value === 0 && !options.alwaysClickable;
        const isActive = (options.activeKey === labelStr)
            || (matchTurFilter ? (activeTurFilter === labelStr) : (activeTur === labelStr))
            || (activeAsama === labelStr);
        actions[idx] = isEmpty ? null : (c.action || null);
        const tipText = `${String(c.tip || labelStr)} — ${value} kayıt${base > 0 ? `, payı %${pct}` : ''}`;
        return `
            <button type="button" class="kpi-chip${isEmpty ? ' kpi-chip-empty' : ''}${isActive ? ' kpi-chip-active' : ''}"
                    data-kpi-row="${containerId}" data-kpi-action-idx="${idx}"
                    data-kpi-tip="${escapeHtml(tipText)}">
                <span class="kpi-chip-dot" style="background:${c.dot}; color:${c.dot};"></span>
                <span class="kpi-chip-count">${value}</span>
                <span class="kpi-chip-label">${escapeHtml(labelStr)}</span>
                ${base > 0 ? `<span class="kpi-chip-pct">%${pct}</span>` : ''}
            </button>`;
    }).join('');

    kpiChipActionRegistry.set(containerId, actions);
    container.innerHTML = html;

    /* Mini dağılım çubuğu (yalnızca istenirse): segment genişlikleri
       yüzdesel paylarla orantılı; aktif anahtar segmenti vurgulanır. */
    if (options.activeKey) {
        const bar = document.createElement('span');
        bar.className = 'kpi-chip-bar';
        bar.innerHTML = chips.map(c => {
            const value = Number(c.value) || 0;
            const base = Number(c.pctBase) || 0;
            const pct = base > 0 ? (value / base) * 100 : 0;
            const isDone = options.activeKey === String(c.label);
            return `<span class="kpi-chip-bar-seg${isDone ? ' seg-done' : ''}" style="flex:0 0 ${pct}%; background:${c.dot};" title="${escapeHtml(String(c.label))}: ${value}"></span>`;
        }).join('');
        container.appendChild(bar);
    }
}

/* Chip tıklamaları: satır başına tek delege dinleyici (initKpiChipInteractions
   ile bağlanır). Boş çipler (kpi-chip-empty) tıklamayı yok sayar. */
function handleKpiChipClick(event) {
    const chip = event.target.closest('.kpi-chip');
    if (!chip || chip.classList.contains('kpi-chip-empty')) return;
    /* Kartın onclick navigasyonunu (örn. navigateToProjectsAll) söndür:
       chip tıklaması yalnızca kendi filtresini sürmelidir. */
    event.stopPropagation();
    const rowId = chip.getAttribute('data-kpi-row');
    const idx = Number(chip.getAttribute('data-kpi-action-idx'));
    const actions = kpiChipActionRegistry.get(rowId);
    const action = actions ? actions[idx] : null;
    if (typeof action === 'function') action();
}

function initKpiChipInteractions() {
    ['kpi-substats-total', 'kpi-substats-active', 'kpi-substats-today', 'kpi-substats-biten'].forEach(rowId => {
        const row = document.getElementById(rowId);
        if (!row || row.dataset.kpiBound === '1') return;
        row.dataset.kpiBound = '1';
        row.addEventListener('click', handleKpiChipClick);
    });
    initKpiChipTooltips();
}

/* ÇİP → ÇAPRAZ FİLTRE KÖPRÜSÜ: chip tıklaması harita tür filtresi state'ini
   (activeMapTypeFilter) sürer; setMapTypeFilter haritayı, sol süzgeç panelini
   ve açık şehir çekmecesini zaten tazeler. Böylece tek state kaynağı üzerinden
   harita + listeler birlikte filtrelenir. Aşama çipleri ise "Tüm İşler"
   tablosunun Excel aşama filtresini (selectedExcelFilters['asama']) sürer. */
function kpiChipFilterTur(chipLabel) {
    if (!chipLabel) return;
    if (chipLabel === 'DİĞER') {
        if (typeof showToast === 'function') showToast('DİĞER birleşik bir kümedir; haritadan İDARE UYGULAMA, KENTSEL veya TALEP türlerinden birini seçebilirsiniz.', 'info');
        return;
    }
    /* Zaten seçiliyse tekrar tıklamak filtreyi temizler (toggle). */
    const target = (activeMapTypeFilter === chipLabel) ? null : chipLabel;
    setMapTypeFilter(target);
    if (typeof showToast === 'function') showToast(target ? `Harita + listeler "${target}" türüne göre filtrelendi.` : 'Tür filtresi sıfırlandı.', 'info');
}

/* YAPIM kartının tür çipleri → "Tüm İşler" tablosunun Excel tür filtresini
   (selectedExcelFilters['tur']) sürer; EGM/JGK/MSB birebir filtrelenir.
   DİĞER (null) birleşik bir küme olduğu için yalnızca bilgi toast'ı verilir —
   harita kartındaki DİĞER davranışıyla aynı. Tabloda türsüz kayıtlar '-' ile
   listelendiğinden getProjectsExcelFilteredJobs eşleşmesi ((j.tur || '-'))
   ile uyumludur. */
function kpiChipFilterYapimTur(chipLabel) {
    if (!chipLabel) {
        if (typeof showToast === 'function') showToast('DİĞER birleşik bir kümedir; tablodan İDARE UYGULAMA, KENTSEL veya TALEP türlerinden birini seçebilirsiniz.', 'info');
        return;
    }
    /* Zaten seçiliyse tekrar tıklamak filtreyi temizler (toggle). */
    const target = (selectedExcelFilters['tur'] === chipLabel) ? null : chipLabel;
    if (target) selectedExcelFilters['tur'] = target; else delete selectedExcelFilters['tur'];
    navigateTo('projects');
    renderProjectsTable();
    renderSidebarTurSublist();
    if (typeof showToast === 'function') showToast(target ? `"Tüm İşler" tablosu "${target}" türüne göre filtrelendi.` : 'Tür filtresi sıfırlandı.', 'info');
}

/* mikro tooltip: tek element, fare konumuna göre konumlanır; viewport taşmaları
   kenara yaslanarak engellenir. Dokunmatik cihazlarda devre dışıdır. */
function initKpiChipTooltips() {
    const tip = document.getElementById('kpi-chip-tip');
    if (!tip || tip.dataset.kpiTipBound === '1') return;
    tip.dataset.kpiTipBound = '1';

    const coarsePointer = window.matchMedia && window.matchMedia('(hover: none)').matches;

    document.addEventListener('mouseover', e => {
        const chip = e.target.closest('.kpi-chip');
        if (!chip || coarsePointer) return;
        tip.textContent = chip.getAttribute('data-kpi-tip') || '';
        tip.classList.add('kpi-tip-show');
    });
    document.addEventListener('mouseout', e => {
        if (!e.target.closest || !e.target.closest('.kpi-chip')) return;
        tip.classList.remove('kpi-tip-show');
    });
    document.addEventListener('mousemove', e => {
        if (!tip.classList.contains('kpi-tip-show')) return;
        const pad = 12;
        let x = e.clientX + pad;
        let y = e.clientY + pad;
        const rect = tip.getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - pad;
        if (y + rect.height > window.innerHeight - 8) y = e.clientY - rect.height - pad;
        tip.style.left = Math.max(8, x) + 'px';
        tip.style.top = Math.max(8, y) + 'px';
    });
}

/* MENÜ İNDİKATÖRÜ: aktif menü item'ının soluna kayan ışık çubuğu */
function updateMenuIndicator() {
    const indicator = document.getElementById('menu-indicator');
    const activeItem = document.querySelector('.menu-item.active');
    if (!indicator || !activeItem) {
        if (indicator) indicator.style.opacity = '0';
        return;
    }

    const menu = document.querySelector('.sidebar-menu');
    if (!menu) return;

    const menuRect = menu.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    indicator.style.opacity = '1';
    indicator.style.height = itemRect.height + 'px';
    indicator.style.transform = 'translateY(' + (itemRect.top - menuRect.top) + 'px)';
}

/* ESKI FX: MENU HALO - KALDIRILDI (bkz. CSS 10.3 notu).
   Aktif kalemin arkasina kayan ikinci bir mavi katman ekliyordu; aktif kalem
   zaten mavi dolgulu oldugu icin iki hareket ust uste biniyor ve secim
   "takilmis" gibi hissediliyordu. Yerine: secim aninda olur, yalnizca kenar
   huzmesiyle (fxMenuItemSettle) belli edilir. Bkz. CSS 10.3. */

/* FX: VIEW EXIT - giden ekrana kisa bir cikis verir.
   CSS tarafinda .fx-view-exit kendi display:flex degerini ve kendi
   animasyonunu tasir; bu yuzden burada .active EKLENMEZ (eklenirse .active
   kurali fxViewEnter'i uygular ve cikis hicbir zaman tetiklenmez).
   navigateTo() .active'i kaldirdiktan SONRA bunu cagirir. */
function playFxViewExit(el) {
    if (!el) return;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    el.classList.add('fx-view-exit');
    const cleanup = () => {
        el.classList.remove('fx-view-exit');
        el.removeEventListener('animationend', cleanup);
    };
    el.addEventListener('animationend', cleanup);
    /* Guvenlik agi: animasyon hicbir sekilde tetiklenmezse (sekme gizli,
       display:none, vb.) sinif 400ms sonra yine de temizlenir. Aksi halde
       gizli view uzerinde .fx-view-exit birikerek display:flex kalir ve
       ekranlarda ust uste binme olur. */
    setTimeout(cleanup, 400);
}

/* GLOBAL RIPPLE: tıklama noktasından yayılan cyan halka */
function initFxRipple() {
    document.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;

        const trigger = e.target.closest('.btn, .btn-icon, .map-btn, .menu-item, .map-type-filter-btn, .sub-menu-item');
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2.2;
        const ripple = document.createElement('span');
        ripple.className = 'fx-ripple';
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        trigger.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
    });
}

/* FX: CURSOR GLOW - fareyi takip eden yumusak radyal isik.
   NOT: burada bilerek left/top YAZILMAZ; sadece transform yazilir. left/top
   degistirmek her karede layout tetikler; transform sadece compositor'u
   uyarir. Ayrica mousemove saniyede yuzlerce kez tetiklenebildigi icin
   islem rAF karesine sikistirilir (throttle) - boylece olay basina en fazla
   bir stil yazimi olur. */
function initFxCursorGlow() {
    const glow = document.getElementById('fx-cursor-glow');
    if (!glow) return;

    /* Hareket azaltma tercihi olan kullanicida bu efekt calismaz. Kural CSS'te
       de var (.fx-cursor-glow display:none); buradaki kontrol gereksiz boyama
       yapmamayi de engelliyor. */
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    let queued = false;
    let x = 0, y = 0;

    const paint = () => {
        queued = false;
        glow.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    };

    window.addEventListener('mousemove', (e) => {
        x = e.clientX;
        y = e.clientY;
        glow.classList.add('is-on');
        if (queued) return;
        queued = true;
        requestAnimationFrame(paint);
    }, { passive: true });

    /* Imlec pencereyi terk edince isik donup kalmasin; 300ms sonra solar. */
    document.addEventListener('mouseleave', () => {
        glow.classList.remove('is-on');
    });
    window.addEventListener('blur', () => {
        glow.classList.remove('is-on');
    });
}

/* FX: SURFACE SHEEN - .kpi-card ve .widget-card ustune isil parlama.
   Bu iki yuzeyde her iki pseudo-element slotu da dolu (::before cam
   yansimasi, ::after kpi shine / widget kenarlik huzmesi). Yeni bir pseudo
   eklemek mevcut efekti EZDI; bu yuzden eklenen bir <span> kullanilir.
   Yalnizca HENUZ eklenmemis kartlara eklenir: uygulama kartlari render
   sirasinda yeniden kurar (kpi degeri degisince vb.), bu yuzden her
   DOM'a bakan bir MutationObserver yerine, ekleme aninda bir kez kon trol
   edilir ve "data-fx-sheen" isaretiyle tekrar eklenmesi engellenir. */
function initFxSurfaceSheen() {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll('.kpi-card, .widget-card');
    targets.forEach(card => {
        if (reduceMotion) return;
        if (card.dataset.fxSheen === '1') return;
        card.dataset.fxSheen = '1';
        const sheen = document.createElement('span');
        sheen.className = 'fx-sheen';
        sheen.setAttribute('aria-hidden', 'true');
        card.appendChild(sheen);
    });
}

/* FX: TABLE ROW SHEEN - tablo satirlarina kayan isik seridi.
   <tr> elementine CSS ::before/::after eklenemez (tablo yerlesimi bunlari
   render etmez), bu yuzden satir icine bir <span> konur.
   Satirlar her render'da innerHTML ile yeniden kurulur; bu yuzden bu
   fonksiyon renderCurrentView() sonunda cagrilir. Idempotenttir. */
function initFxTableRows() {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const rows = document.querySelectorAll('tr.table-row-hover');
    rows.forEach(row => {
        if (row.dataset.fxRow === '1') return;
        /* Satirin ilk hucresi "anchor" olarak kullanilir: span, ilk hucrenin
           icine konur ve CSS ile sola yaslanir. Boylece tr icindeki hucre
           duzeni (tablo-layout) bozulmaz - span hücre disina tasmaz. */
        const anchor = row.querySelector('td');
        if (!anchor) return;
        row.dataset.fxRow = '1';
        const sheen = document.createElement('span');
        sheen.className = 'fx-row-sheen';
        sheen.setAttribute('aria-hidden', 'true');
        anchor.appendChild(sheen);
    });
}

/* FX: DIGIT ROLL - .kpi-value icindeki sayiyi hane hane dondurur.
   animateCountUp() sayma islemini zaten yapiyor ve hedef degeri
   el.dataset.countValue icinde tutuyor. Bu fonksiyon o degeri okuyup
   DOM'u hane span'lerine cevirir; animateCountUp kendi innerText yazma
   koduna DOKUNULMAZ (aksi halde her karede tüm yapi yeniden kurulur).
   Bunun yerine: kurulum bir kez yapilir, sonra animateCountUp bittiginde
   hedef deger bu yapinin uzerine uygulanir (syncFxDigitRoll). */
function initFxDigitRoll() {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const values = document.querySelectorAll('.kpi-value');
    values.forEach(el => {
        if (reduceMotion) return;
        if (el.dataset.fxDigits === '1') return;
        el.dataset.fxDigits = '1';
        el.classList.add('fx-digits');
        /* Mevcut (muhtemelen 0) degerden baslat. */
        el.innerHTML = '';
        const start = el.dataset.countValue || '0';
        String(start).split('').forEach(ch => {
            const d = document.createElement('span');
            d.className = 'fx-digit';
            d.textContent = ch;
            el.appendChild(d);
        });
    });
}

/* Hedef degere gore hane yapisini gunceller; yukselen haneler yukselir.
   animateCountUp bittikten SONRA cagrilir (asagida bkz. patch). */
function syncFxDigitRoll(el) {
    if (!el || el.dataset.fxDigits !== '1') return;
    const target = String(el.dataset.countValue || '0');
    /* Uzunluk degistiyse (ornegin 9 -> 10) yapiyi yeniden kur. */
    if (el.querySelectorAll('.fx-digit').length !== target.length) {
        el.innerHTML = '';
        target.split('').forEach(ch => {
            const d = document.createElement('span');
            d.className = 'fx-digit';
            d.textContent = ch;
            el.appendChild(d);
        });
        el.dataset.fxPrev = target;
        return;
    }
    const prev = el.dataset.fxPrev || '';
    const rising = !prev || Number(target) >= Number(prev);
    target.split('').forEach((ch, i) => {
        const d = el.querySelectorAll('.fx-digit')[i];
        if (!d || d.textContent === ch) return;
        d.textContent = ch;
        d.classList.remove('is-up', 'is-down');
        void d.offsetWidth; /* reflow: animasyonu yeniden tetikler */
        d.classList.add(rising ? 'is-up' : 'is-down');
    });
    el.dataset.fxPrev = target;
}

/* Sayma animasyonu SIRASINDA her karede cagrilir (animateCountUp.step).
   Yalnizca DEGERI degisen hanelerin textContent'i yazilir - boylece DOM
   yapisı korunur ve hane span'leri her karede yeniden kurulmaz.
   Animasyon YOK: sayma zaten hareketi veriyor; her hane 60fps'de
   yeniden yazilsaydi kesintisiz ama kasıtlı olarak duruk bir geri sayım
   gorunurdu (Awwwards tipi "flip" sayaclar). */
function applyFxDigitText(el, text) {
    const str = String(text);
    let digits = el.querySelectorAll('.fx-digit');
    /* Hane sayisi degistiyse yapıyı yeniden kur (ornegin 9 -> 10). */
    if (digits.length !== str.length) {
        el.innerHTML = '';
        str.split('').forEach(ch => {
            const d = document.createElement('span');
            d.className = 'fx-digit';
            d.textContent = ch;
            el.appendChild(d);
        });
        return;
    }
    for (let i = 0; i < digits.length; i++) {
        if (digits[i].textContent !== str[i]) digits[i].textContent = str[i];
    }
}

/* --- BUGÜNKÜ ODAK İLETİLERİ: BİLDİRİM POPOVER'İ ---------------------------
   ÖNCEKİ HALİ: içerik sürekli kayan bir şeride (marquee) yazılıyordu ve
   #ticker-content-box dolduruluyordu. Bu, görev gereği kaldırıldı.
   ŞİMDİ: aynı veri (tamamlanmamış + ⚡/⭐ işaretli görevler) üst sağdaki zil
   düğmesine bağlı cam popover'da STATİK bir liste olarak gösterilir.
   Fonksiyon adı korunur çünkü refreshAllViews() (satır ~14323) burayı çağırır;
   yalnızca gövdesi hedef konumu ve çıktıyı değiştirir. */
function renderTickerBar() {
    const pop = document.getElementById('notif-popover');
    if (!pop) return;

    const importantTasks = tasks.filter(t => !t.completed && (t.emoji === '⚡' || t.emoji === '⭐'));

    /* Kayan metin yerine düz liste: satırlar okunur, üstünden aşmaz. */
    const rows = importantTasks.length
        ? importantTasks.map(t => `
            <div class="notif-item">
                <span class="notif-item-emoji">${t.emoji || '⚡'}</span>
                <div class="notif-item-body">
                    <span class="notif-item-date">${escapeHtml(t.date || 'Bugün')}</span>
                    <span class="notif-item-text">${escapeHtml(t.text)}</span>
                </div>
            </div>`).join('')
        : `<div class="notif-empty"><i class="fa-solid fa-mug-hot"></i><span>Şu an için önemli veya acil görev bulunmuyor.</span></div>`;

    pop.innerHTML = `
        <div class="notif-head">
            <span class="notif-head-title"><i class="fa-solid fa-bullhorn"></i> Bugünkü Odak İletiler</span>
            ${importantTasks.length ? `<span class="notif-count">${importantTasks.length}</span>` : ''}
        </div>
        <div class="notif-list">${rows}</div>
        <div class="notif-foot">Önemli ve acil işaretli görevleriniz</div>`;

    /* Kırmızı nokta yalnızca gerçekten bildirim varken görünür. */
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = importantTasks.length ? 'block' : 'none';
}

/* Popover'ı aç/kapa. Dışarı tıklayınca ve Escape'te kapanır. */
function toggleNotifPopover(event) {
    const pop = document.getElementById('notif-popover');
    const btn = document.getElementById('notif-btn');
    if (!pop || !btn) return;
    const isOpen = pop.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (event) event.stopPropagation();
}
function closeNotifPopover() {
    const pop = document.getElementById('notif-popover');
    const btn = document.getElementById('notif-btn');
    if (pop) pop.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}
/* Popover <body> seviyesinde olduğu için "panelin içine tıklandı mı" kontrolü
   doğrudan closest() ile yapılır; zil düğmesinin kendi tıklaması da istisna. */
document.addEventListener('click', (e) => {
    const pop = document.getElementById('notif-popover');
    if (!pop || !pop.classList.contains('open')) return;
    if (e.target.closest('#notif-popover') || e.target.closest('#notif-btn')) return;
    closeNotifPopover();
});
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeNotifPopover();
    const delModal = document.getElementById('security-delete-modal');
    if (delModal && delModal.classList.contains('active')) closeSecurityDeleteModal();
});

function renderCurrentView() {
    updateGlobalCounts();
    applyDynamicHeaderTitles();
    renderSidebarTurSublist();

    if (activeView === 'home') {
        renderD3Map();
        renderMapTypeFilters();
    }
    else if (activeView === 'messages') renderNotes();
    else if (activeView === 'tasks') renderDailyTasks();
    else if (activeView === 'projects') renderProjectsTable();
    else if (activeView === 'active-jobs') renderActiveJobsTable();
    else if (activeView === 'custom-list') renderCustomListTable();
    else if (activeView === 'missing-info') renderMissingInfoTable();
    else if (activeView === 'files') renderFiles();
    else if (activeView === 'stats') renderStatisticsView();
    else if (activeView === 'settings') renderSettingsPage();

    /* Ana ekran panelleri (aktif işler / veri tamamlama / bugünkü işler):
       yalnızca home görünümündeyken çizilir. */
    if (activeView === 'home') {
        renderDashActivePanel();
        renderDashDataPanel();
        renderDashDeadlinePanel();
        renderDashTodayPanel();
    }

    /* FX: Yeniden cizilen kartlara isil parlama (fx-sheen) tekrar eklenir.
       Kartlar innerHTML ile yeniden kuruldugu icin onceki span kaybolur; bu
       cagri onu geri getirir. initFxSurfaceSheen() idempotenttir (data-fx-sheen
       isaretiyle bir kez ekler), bu yuzden her render'da cagrilmasi guvenlidir. */
    initFxSurfaceSheen();
    /* FX: ayni sekilde tablo satirlari ve KPI haneleri da yeniden kurulur. */
    initFxTableRows();
    initFxDigitRoll();
}

function populateFormDropdowns() {
    const fillSelect = (id, list, defaultLabel = null, isTurList = false) => {
        const el = document.getElementById(id); if (!el) return;
        
        let htmlBuffer = defaultLabel ? `<option value="">${defaultLabel}</option>` : '';
        const sortedList = isTurList ? list : sortAlphabetically(list);
        
        htmlBuffer += sortedList.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
        el.innerHTML = htmlBuffer;
    };

    fillSelect('form-section', settings.projeTuru);
    fillSelect('form-tur', settings.tur, null, true);
    fillSelect('form-protokol', settings.protokol);
    fillSelect('form-asama', settings.asama);
    fillSelect('form-avan-uygolama', settings.avanUygulama);
    fillSelect('form-proje', settings.projeMusaviri);
    fillSelect('form-alt-yuklenici', settings.altYuklenici);
    fillSelect('form-insaat-musaviri', settings.insaatMusaviri);

    fillSelect('expert-mimari', settings.mimari);
    fillSelect('expert-statik', settings.statik);
    fillSelect('expert-mekanik', settings.mekanik);
    fillSelect('expert-elektrik', settings.elektrik);
    fillSelect('expert-altyapi', settings.altyapi);
    fillSelect('expert-peyzaj', settings.peyzaj);
    fillSelect('expert-zemin', settings.zemin);
    fillSelect('expert-plankote', settings.plankote);
}

function openJobModal(id = null) {
    populateFormDropdowns();
    populateCityDropdown();
    applyDynamicHeaderTitles();
    tempTimeline = [];
    editingTimelineIdx = null;

    if (id !== null && id !== undefined && id !== '') {
        const targetIdStr = String(id);
        const j = jobs.find(x => String(x.id) === targetIdStr);
        if (j) {
            document.getElementById('form-job-id').value = j.id;
            document.getElementById('form-section').value = j.section || '250Bin';
            if (document.getElementById('form-tur')) document.getElementById('form-tur').value = j.tur || '-';
            document.getElementById('form-protokol').value = j.protokol || '-';
            document.getElementById('form-asama').value = j.asama || 'Yapım';
            document.getElementById('form-avan-uygolama').value = j.avan_uygolama || '-';
            document.getElementById('form-il').value = j.il || '';
            /* İl atandıktan SONRA ilçe listesi kurulur: datalist seçili ilin
               harita ilçeleriyle dolsun, eski kaydın değeri de korunsun. */
            populateDistrictDropdown();
            document.getElementById('form-ilce').value = j.ilce || '';
            document.getElementById('form-is-tanimi').value = j.is_tanimi || '';
            /* Muafiyet işareti: eski kayıtlarda alan yok → false (muaf değil),
               yani mevcut davranış birebir korunur. */
            document.getElementById('form-skip-data-completion').checked = isSkipDataCompletion(j);
            document.getElementById('form-folder-path').value = j.folder_path || '';
            document.getElementById('form-proje').value = j.proje || '-';
            document.getElementById('form-insaat-alani').value = j.insaat_alani || '';
            formatNumberFieldValue(document.getElementById('form-insaat-alani'), false);
            document.getElementById('form-alt-yuklenici').value = j.alt_yuklenici || '-';
            document.getElementById('form-diger-daire').value = j.digerDaire || '';
            document.getElementById('form-ihale-yazisi').value = j.ihale_yazisi || '';
            
            document.getElementById('form-ihale-tarihi').value = j.ihale_tarihi || '';
            document.getElementById('form-sozlesme-tarihi').value = j.sozlesme_tarihi || '';
            document.getElementById('form-start-date').value = j.start_date || '';
            document.getElementById('form-end-date').value = j.end_date || '';
            document.getElementById('form-ihale-bedeli').value = j.ihale_bedeli || '';
            formatNumberFieldValue(document.getElementById('form-ihale-bedeli'), false);
            document.getElementById('form-insaat-musaviri').value = j.insaat_musaviri || '-';
            document.getElementById('form-yuklenici').value = j.yuklenici || '';
            document.getElementById('form-important-notes').value = j.important_notes || '';

            const ex = j.experts || {};
            if (document.getElementById('expert-mimari')) document.getElementById('expert-mimari').value = ex.mimari || '-';
            if (document.getElementById('expert-statik')) document.getElementById('expert-statik').value = ex.statik || '-';
            if (document.getElementById('expert-mekanik')) document.getElementById('expert-mekanik').value = ex.mekanik || '-';
            if (document.getElementById('expert-elektrik')) document.getElementById('expert-elektrik').value = ex.elektrik || '-';
            if (document.getElementById('expert-altyapi')) document.getElementById('expert-altyapi').value = ex.altyapi || '-';
            if (document.getElementById('expert-peyzaj')) document.getElementById('expert-peyzaj').value = ex.peyzaj || '-';
            if (document.getElementById('expert-zemin')) document.getElementById('expert-zemin').value = ex.zemin || '-';
            if (document.getElementById('expert-plankote')) document.getElementById('expert-plankote').value = ex.plankote || '-';

            tempTimeline = j.timeline ? JSON.parse(JSON.stringify(j.timeline)) : [];
        }
    } else {
        document.getElementById('form-job-id').value = '';
        if (document.getElementById('form-tur')) document.getElementById('form-tur').value = '-';
        document.getElementById('form-is-tanimi').value = '';
        document.getElementById('form-skip-data-completion').checked = false;
        document.getElementById('form-folder-path').value = '';
        document.getElementById('form-insaat-alani').value = '';
        syncNumberFieldSuffix(document.getElementById('form-insaat-alani'));
        document.getElementById('form-ilce').value = '';
        document.getElementById('form-diger-daire').value = '';
        document.getElementById('form-ihale-yazisi').value = '';
        document.getElementById('form-ihale-tarihi').value = '';
        document.getElementById('form-sozlesme-tarihi').value = '';
        document.getElementById('form-start-date').value = '';
        document.getElementById('form-end-date').value = '';
        document.getElementById('form-ihale-bedeli').value = '';
        syncNumberFieldSuffix(document.getElementById('form-ihale-bedeli'));
        document.getElementById('form-yuklenici').value = '';
        document.getElementById('form-important-notes').value = '';
        document.getElementById('form-il').value = '';
    }
    renderFormTimeline();
    updateJobZoneCloud();
    /* Aşama "Proje" değilse başlangıç/teslim alanları gizlenir; modal açılırken
       görünürlük burada yeniden hesaplanır. */
    updateDeadlineFieldsVisibility();
    document.getElementById('job-modal').classList.add('active');
}

function closeJobModal() { document.getElementById('job-modal').classList.remove('active'); }

function addTimelineEntry() {
    const textInput = document.getElementById('form-new-timeline-text');
    const importantInput = document.getElementById('form-new-timeline-important');
    const text = textInput.value.trim();
    if (!text) return;

    tempTimeline.unshift({ text, important: Boolean(importantInput && importantInput.checked) });
    textInput.value = '';
    if (importantInput) importantInput.checked = false;
    renderFormTimeline();
}

function moveTimelineEntry(idx, direction) {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= tempTimeline.length) return;
    
    const temp = tempTimeline[idx];
    tempTimeline[idx] = tempTimeline[targetIdx];
    tempTimeline[targetIdx] = temp;
    
    renderFormTimeline();
}

function renderFormTimeline() {
    const container = document.getElementById('form-timeline-list');
    if (!tempTimeline || tempTimeline.length === 0) {
        container.innerHTML = '<div style="font-size:11.5px; color:var(--txt-muted); padding:4px; text-align:center;">Henüz gelişme eklenmedi.</div>';
        return;
    }

    const totalCount = tempTimeline.length;

    container.innerHTML = tempTimeline.map((t, idx) => {
        const sequenceNum = totalCount - idx;

        const importantClass = t.important ? ' is-important' : '';
        const importantMarker = t.important ? '<i class="fa-solid fa-triangle-exclamation timeline-important-marker" title="Önemli not"></i>' : '';

        if (editingTimelineIdx === idx) {
            return `
                <div class="timeline-item${importantClass}">
                    <span class="timeline-num">${sequenceNum}</span>
                    ${importantMarker}
                    <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                        <textarea id="edit-timeline-text-${idx}" class="form-control" rows="2" style="font-size:11.5px; line-height:1.18; padding:2px 4px;">${escapeHtml(t.text)}</textarea>
                        <label style="display:flex; align-items:center; gap:4px; margin:0; color:var(--color-amber); font-size:10.5px; font-weight:700; text-transform:none; letter-spacing:0; white-space:normal;"><input type="checkbox" id="edit-timeline-important-${idx}" ${t.important ? 'checked' : ''} style="accent-color:var(--color-amber);"> Önemli not</label>
                    </div>
                    <div class="timeline-actions" style="display:flex; gap:2px;">
                        <button type="button" class="btn-icon" style="background:var(--color-emerald); color:white; width:22px; height:22px;" onclick="saveTimelineEdit(${idx})"><i class="fa-solid fa-check"></i></button>
                        <button type="button" class="btn-icon" style="width:22px; height:22px;" onclick="cancelTimelineEdit()"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="timeline-item${importantClass}">
                    <span class="timeline-num">${sequenceNum}</span>
                    ${importantMarker}
                    <div class="timeline-content-clickable" title="Düzenlemek için tıklayın" onclick="startTimelineEdit(${idx})">${escapeHtml(t.text)}</div>
                    <div class="timeline-actions" style="display:flex; gap:2px;">
                        <button type="button" class="btn-icon" style="width:22px; height:22px;" title="Yukarı Taşı" onclick="moveTimelineEntry(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                        <button type="button" class="btn-icon" style="width:22px; height:22px;" title="Aşağı Taşı" onclick="moveTimelineEntry(${idx}, 1)" ${idx === totalCount - 1 ? 'disabled style="opacity:0.3;"' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                        <button type="button" class="btn-icon delete" style="width:22px; height:22px;" title="Sil" onclick="deleteTimelineEntry(${idx})"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `;
        }
    }).join('');
}

function startTimelineEdit(idx) { editingTimelineIdx = idx; renderFormTimeline(); }
function cancelTimelineEdit() { editingTimelineIdx = null; renderFormTimeline(); }
function saveTimelineEdit(idx) {
    const newText = document.getElementById(`edit-timeline-text-${idx}`).value.trim();
    const importantInput = document.getElementById(`edit-timeline-important-${idx}`);
    if (newText) {
        tempTimeline[idx].text = newText;
        tempTimeline[idx].important = Boolean(importantInput && importantInput.checked);
    }
    editingTimelineIdx = null;
    renderFormTimeline();
}
function deleteTimelineEntry(idx) {
    tempTimeline.splice(idx, 1);
    renderFormTimeline();
}

function saveJob() {
    /* Haritadaki ilçe sınırlarıyla bağ: girilen ilçe adı seçilen ilin
       harita listesinde yoksa kullanıcıya sorulur (kayıt engellenmez). */
    if (!warnIfDistrictNotOnMap()) return;
    const id = document.getElementById('form-job-id').value;
    const data = {
        id: id ? String(id) : ('job_' + Date.now()),
        section: document.getElementById('form-section').value,
        tur: document.getElementById('form-tur') ? document.getElementById('form-tur').value : '-',
        protokol: document.getElementById('form-protokol').value,
        asama: document.getElementById('form-asama').value,
        avan_uygolama: document.getElementById('form-avan-uygolama').value,
        kapsam: "AFET",
        il: document.getElementById('form-il').value,
        ilce: document.getElementById('form-ilce').value,
        is_tanimi: document.getElementById('form-is-tanimi').value,
        /* Veri Tamamlama muafiyeti. Boolean olarak yazılır (undefined değil) →
           kayıt şeması her satırda tutarlı kalır; false = mevcut davranış. */
        skipDataCompletion: Boolean(document.getElementById('form-skip-data-completion').checked),
        folder_path: document.getElementById('form-folder-path').value,
        proje: document.getElementById('form-proje').value,
        insaat_alani: normalizeNumberFieldValue('form-insaat-alani'),
        alt_yuklenici: document.getElementById('form-alt-yuklenici').value,
        digerDaire: document.getElementById('form-diger-daire').value,
        ihale_yazisi: document.getElementById('form-ihale-yazisi').value,
        ihale_tarihi: document.getElementById('form-ihale-tarihi').value,
        sozlesme_tarihi: document.getElementById('form-sozlesme-tarihi').value,
        ihale_bedeli: normalizeNumberFieldValue('form-ihale-bedeli'),
        insaat_musaviri: document.getElementById('form-insaat-musaviri').value,
        yuklenici: document.getElementById('form-yuklenici').value,
        important_notes: document.getElementById('form-important-notes').value,
        /* Başlangıç/Teslim tarihleri: yalnız "Proje" aşamasında anlamlıdır.
           Diğer aşamalarda boş string olarak yazılır (undefined DEĞİL) → veri
           modeli şeması her kayıtta aynı kalır, eski kayıtlarla uyumludur. */
        start_date: isJobDeadlineActive() ? document.getElementById('form-start-date').value : '',
        end_date: isJobDeadlineActive() ? document.getElementById('form-end-date').value : '',
        timeline: tempTimeline,
        experts: {
            mimari: document.getElementById('expert-mimari').value,
            statik: document.getElementById('expert-statik').value,
            mekanik: document.getElementById('expert-mekanik').value,
            elektrik: document.getElementById('expert-elektrik').value,
            altyapi: document.getElementById('expert-altyapi').value,
            peyzaj: document.getElementById('expert-peyzaj').value,
            zemin: document.getElementById('expert-zemin').value,
            plankote: document.getElementById('expert-plankote').value
        }
    };

    if (id) { 
        const idx = jobs.findIndex(x => String(x.id) === String(id)); 
        if(idx !== -1) jobs[idx] = data; else jobs.push(data);
    } else { jobs.unshift(data); }

    saveAllData(); 
    closeJobModal();
    if (activeView === 'active-jobs') renderActiveJobsTable();
    else if (activeView === 'custom-list') renderCustomListTable();
    else if (activeView === 'missing-info') renderMissingInfoTable();
    else { navigateTo('projects'); renderProjectsTable(); }
}

function openSelectActiveJobModal() {
    document.getElementById('select-job-search-input').value = '';
    renderSelectJobList('');
    document.getElementById('select-active-job-modal').classList.add('active');
    _staggerModalBody('select-active-job-modal');
}
function closeSelectActiveJobModal() { document.getElementById('select-active-job-modal').classList.remove('active'); }

function renderSelectJobList(query = '') {
    const container = document.getElementById('select-job-list-container');
    const q = query.toLowerCase().trim();
    
    let filteredJobs = jobs.filter(j => {
        const fullTxt = `${j.is_tanimi} ${j.il} ${j.ilce} ${j.section || ''} ${j.tur || ''}`.toLowerCase();
        if (q && !fullTxt.includes(q)) return false;
        return true;
    });

    if (filteredJobs.length === 0) {
        container.innerHTML = '<div style="color:var(--txt-muted); font-size:13.2px; text-align:center; padding:8px;">Eşleşen iş bulunamadı.</div>';
        return;
    }

    container.innerHTML = filteredJobs.map(j => {
        const strId = String(j.id);
        const isSelected = activeJobIds.map(String).includes(strId);
        return `
            <div class="select-job-item">
                <div style="flex:1; padding-right:8px;">
                    <strong style="font-size:13.8px; color:var(--txt-main); font-weight:600; display:block; line-height:1.2;">${escapeHtml(j.is_tanimi)}</strong>
                    <small style="color:var(--txt-sub); font-size:12px; font-weight:500;">${escapeHtml(j.il)} / ${escapeHtml(j.ilce)} | ${escapeHtml(j.section || '250Bin')} • Tür: ${escapeHtml(j.tur || '-')}</small>
                </div>
                <div>
                    ${isSelected ? `
                        <button class="btn btn-secondary" style="font-size:11px; height:24px; color:var(--color-rose); border-color:rgba(244, 63, 94, 0.3);" onclick="toggleActiveJob('${strId}')"><i class="fa-solid fa-minus"></i> Çıkar</button>
                    ` : `
                        <button class="btn btn-primary" style="font-size:11px; height:24px;" onclick="toggleActiveJob('${strId}')"><i class="fa-solid fa-plus"></i> Ekle</button>
                    `}
                </div>
            </div>`;
    }).join('');
    _applyStaggerIndex(document.getElementById('select-job-list-container'));
}

function toggleActiveJob(jobId) {
    const targetId = String(jobId);
    const exists = activeJobIds.map(String).includes(targetId);
    if (exists) { activeJobIds = activeJobIds.filter(id => String(id) !== targetId); } 
    else { activeJobIds.push(targetId); }
    saveAllData(); updateGlobalCounts(); renderSelectJobList(document.getElementById('select-job-search-input').value);
    if (activeView === 'active-jobs') renderActiveJobsTable();
}
function removeActiveJob(jobId) {
    const targetId = String(jobId); activeJobIds = activeJobIds.filter(id => String(id) !== targetId);
    saveAllData(); renderActiveJobsTable(); updateGlobalCounts();
}

/* Satır sınıfını üretir: rozetle aynı renk ailesinden şerit rengi seçer.
   getStatusBadgeClass() 'status-ihale' döndürdüğü için şerit sınıfı da
   'strip-ihale' olur; iki isim ayrılmaz, tek yerden türetilir. */
function getRowStripeClass(asama) {
    return 'row-status-stripe strip-' + getStatusBadgeClass(asama).replace(/^status-/, '');
}

function getStatusBadgeClass(asama) {
    const txt = (asama || '').toLocaleLowerCase('tr-TR').trim();
    if (txt.includes('proje')) return 'status-proje';
    if (txt.includes('ihale')) return 'status-ihale';
    if (txt.includes('yapım') || txt.includes('yapim')) return 'status-yapim';
    if (txt.includes('beklem') || txt.includes('bekliyor')) return 'status-bekleme';
    if (txt.includes('iptal')) return 'status-iptal';
    if (txt.includes('bitti') || txt.includes('tamam')) return 'status-bitti';
    return 'status-proje';
}

/* --- VERİ TAMAMLAMA MUAFİYET BAYRAĞI (skipDataCompletion) ------------------
   Kullanıcı, bir iş kaydının eksik alanlarının Veri Tamamlama panelinde
   GÖSTERİLMESİNİ istediğinde işaretler. Bu bayrak:
     • İş kaydının kendisine `skipDataCompletion: true/false` olarak yazılır.
     • Eksik alan listesi (getMissingInfoDetails) boş döner → o kayıt
       Veri Tamamlama panelinde, ilgili tablolarda ve uyarı rozetlerinde
       GİBİ görünmez.
   ESKİ KAYIT UYUMU: alan sonradan eklendiği için eski kayıtlarda YOKTUR.
   `undefined`/null/false → muaf DEĞİLDİR (yani mevcut davranış korunur); yalnız
   açıkça `true` olan kayıt muaftır. Bu yüzden geçmiş veri hiçbir şekilde
   kendiliğinden listelerden kaybolmaz. */
function isSkipDataCompletion(j) {
    return Boolean(j && j.skipDataCompletion === true);
}

function getMissingInfoDetails(j) {
    /* Muafiyet bayrağı en başta: işaretli kayıt hiçbir koşulda eksik sayılmaz. */
    if (isSkipDataCompletion(j)) return [];
    const asamaTxt = (j.asama || '').toLocaleLowerCase('tr-TR').trim();
    const missing = [];

    if (asamaTxt.includes('yapım') || asamaTxt.includes('yapim')) {
        if (!j.ihale_tarihi || !j.ihale_tarihi.trim()) missing.push('İhale Tarihi');
        if (!j.sozlesme_tarihi || !j.sozlesme_tarihi.trim()) missing.push('Sözleşme Tarihi');
        /* İnşaat alanı: "0" BİR EKSİKLİK DEĞİLDİR. Birim fiyat esaslı
           işlerde alan bilinmediği için kasıtlı olarak 0 girilir ve bu
           durum istatistiklerde de geçerli sayılır (bkz. isValidAreaForStats).
           Eski davranışta yalnızca boş/formatlanmamış değer eksik sayılırdı;
           sayısal 0 da o koşulla zaten geçiyordu, burada bilinçli olarak
           yorumu belgeledik. */
        if (!j.insaat_alani || !String(j.insaat_alani).trim()) missing.push('İnşaat Alanı (m²)');
        if (!j.ihale_bedeli || !j.ihale_bedeli.trim()) missing.push('İhale Bedeli');
        if (!j.yuklenici || !j.yuklenici.trim()) missing.push('İnşaat Yüklenicisi');
    }

    if (asamaTxt.includes('ihale')) {
        if (!j.digerDaire || !j.digerDaire.trim()) missing.push('Kentsel/Emlak Yazısı');
    }

    return missing;
}

function checkJobMissingInfo(j) {
    return getMissingInfoDetails(j).length > 0;
}

/* Aşama sütunundaki uyarı yalnızca timeline içinde işaretlenmiş önemli not varsa gösterilir. */
function hasImportantTimelineNote(job) {
    return Array.isArray(job.timeline) && job.timeline.some(entry => Boolean(entry && entry.important));
}

/* DÜZELTİLDİ: TABLODA HER SATIR BİRİNCİDEN BAŞLAYARAK NUMARALANDIRILIR */
function renderActiveJobsTable() {
    const tbody = document.getElementById('active-jobs-table-body'); 
    if (!tbody) return;
    
    const strActiveIds = activeJobIds.map(String);
    const activeList = jobs.filter(j => strActiveIds.includes(String(j.id)));
    const activeVisible = globalSearchQuery
        ? activeList.filter(j => jobMatchesSearch(j))
        : activeList;

    if (document.getElementById('nav-count-active-jobs')) { 
        document.getElementById('nav-count-active-jobs').innerText = activeList.length; 
    }

    if (activeList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--txt-muted); padding:8px;">Henüz aktif iş seçilmedi. Sağ üstteki <strong>"Aktif İş Ekle"</strong> butonunu kullanarak iş ekleyebilirsiniz.</td></tr>`;
        return;
    }

    if (activeVisible.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--txt-muted); padding:8px;">Aramanızla eşleşen aktif iş kaydı bulunamadı.</td></tr>`;
        return;
    }

    const htmlBuffer = activeVisible.map((j, index) => {
        const lastTimeline = (j.timeline && j.timeline.length > 0) ? j.timeline[0].text : '-';
        const badgeClass = getStatusBadgeClass(j.asama);
        const isMissingInfo = checkJobMissingInfo(j);
        
        return `
            <tr class="table-row-hover ${getRowStripeClass(j.asama)}" onclick="openJobModal('${j.id}')" data-job-id="${j.id}">
                <td class="col-number-cell">${index + 1}</td>
                <td><span class="tag" style="background:rgba(59,130,246,0.15); color:var(--color-primary);">${escapeHtml(j.section || '250Bin')}</span></td>
                <td><span class="tag" style="background:rgba(139,92,246,0.15); color:var(--color-violet);">${escapeHtml(j.tur || '-')}</span></td>
                <td class="col-il-ilce-cell"><strong style="color:var(--txt-main); font-weight:700;">${escapeHtml(j.il)}</strong><br><small style="color:var(--txt-muted); font-weight:500;">${escapeHtml(j.ilce)}</small></td>
                <td><strong>${escapeHtml(j.is_tanimi)}</strong></td>
                <td><strong style="color:var(--txt-main); font-weight:600;">${escapeHtml(j.proje)}</strong><br><small style="color:var(--txt-muted); font-weight:500;">${escapeHtml(j.alt_yuklenici)}</small></td>
                <td>
                    <span class="stage-status-wrap">
                        <span class="status-badge ${badgeClass}">
                            ${escapeHtml(j.asama)}
                            ${isMissingInfo ? '<span class="missing-info-pulse" title="Uyarı: Eksik Bilgi Mevcut!"></span>' : ''}
                        </span>
                        ${hasImportantTimelineNote(j) ? '<span class="stage-alert-pulse" title="Timeline içinde önemli not var"><i class="fa-solid fa-exclamation"></i></span>' : ''}
                    </span>
                </td>
                <td><small style="color:var(--txt-sub); font-weight:500;">${j.timeline && j.timeline[0] && j.timeline[0].important ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-amber); margin-right:4px;" title="Önemli not"></i>' : ''}${escapeHtml(lastTimeline)}</small></td>
                <td onclick="event.stopPropagation();">
                    <div class="action-btns" style="justify-content:center;">
                        <button class="btn-icon" title="Detay" onclick="event.stopPropagation(); viewJobDetail('${j.id}')"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-icon" title="Düzenle" onclick="event.stopPropagation(); openJobModal('${j.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon" title="Dış Form Linki Kopyala" onclick="event.stopPropagation(); copyGuestFormLink('${j.id}')"><i class="fa-solid fa-link"></i></button>
                        <button class="btn-icon delete" title="Aktif Listeden Çıkar" onclick="event.stopPropagation(); removeActiveJob('${j.id}')"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    tbody.innerHTML = htmlBuffer;
    _applyStaggerIndex(tbody, 20);
}

/* ==========================================================================
   ÖZEL İŞ LİSTESİ — SEÇİLEBİLİR & YER DEĞİŞTİRİLEBİLİR SÜTUNLAR
   ========================================================================== */
const CUSTOM_LIST_KEY = 'yaser_v10_custom_list_columns';

/* Sütun kataloğu: key = iş kaydındaki veri alanı, group = seçim modalındaki çerçeve.
   'header' = varsayılan başlık; 'customHeader' varsa kullanıcı başlıklarından okunur. */
const CUSTOM_LIST_COLUMN_CATALOG = [
    { key: 'section',        header: 'KATAGORİ / PROTOKOL', customHeader: 'projeTuru',   group: 'project' },
    { key: 'tur',            header: 'TÜR',                   customHeader: 'tur',          group: 'project' },
    { key: 'protokol',       header: 'PROTOKOL',              customHeader: 'protokol',     group: 'project' },
    { key: 'il',             header: 'İL',                    group: 'project' },
    { key: 'ilce',           header: 'İLÇE',                  group: 'project' },
    { key: 'asama',          header: 'AŞAMA',                 customHeader: 'asama',        group: 'project' },
    { key: 'alt_yuklenici',  header: 'ALT YÜKLENİCİ',         group: 'project' },
    { key: 'ihale_tarihi',   header: 'İHALE TARİHİ',          group: 'tender' },
    { key: 'sozlesme_tarihi',header: 'SÖZLEŞME TARİHİ',       group: 'tender' },
    { key: 'insaat_alani',   header: 'İNŞAAT ALANI (M²)',     group: 'tender' },
    { key: 'ihale_bedeli',   header: 'İHALE BEDELİ (TL)',     group: 'tender' },
    { key: 'yuklenici',      header: 'İNŞAAT YÜKLENİCİSİ',    group: 'tender' },
    { key: 'mimari',         header: 'MİMARİ',                customHeader: 'mimari',       group: 'experts', source: 'experts' },
    { key: 'statik',         header: 'STATİK',                customHeader: 'statik',       group: 'experts', source: 'experts' },
    { key: 'mekanik',        header: 'MEKANİK',               customHeader: 'mekanik',      group: 'experts', source: 'experts' },
    { key: 'elektrik',       header: 'ELEKTRİK',              customHeader: 'elektrik',     group: 'experts', source: 'experts' },
    { key: 'altyapi',        header: 'ALTYAPI',               customHeader: 'altyapi',      group: 'experts', source: 'experts' },
    { key: 'peyzaj',         header: 'PEYZAJ',                customHeader: 'peyzaj',       group: 'experts', source: 'experts' },
    { key: 'zemin',          header: 'ZEMİN',                 customHeader: 'zemin',        group: 'experts', source: 'experts' }
];

function getCustomColumnHeader(col) {
    if (col.customHeader && customHeaderTitles && customHeaderTitles[col.customHeader]) {
        return customHeaderTitles[col.customHeader];
    }
    return col.header;
}

/* Sadece katalogdaki geçerli anahtarları korur, tekrarları temizler. */
function sanitizeCustomColumnKeys(keys) {
    if (!Array.isArray(keys)) return [];
    const valid = new Set(CUSTOM_LIST_COLUMN_CATALOG.map(c => c.key));
    const seen = new Set();
    const out = [];
    keys.forEach(k => {
        const key = String(k);
        if (valid.has(key) && !seen.has(key)) { seen.add(key); out.push(key); }
    });
    return out;
}

function loadCustomListColumns() {
    let stored = [];
    try { stored = JSON.parse(_zkRead(CUSTOM_LIST_KEY)) || []; }
    catch (e) { stored = []; }
    customListColumns = sanitizeCustomColumnKeys(stored);
}

function saveCustomListColumns() {
    _zkWrite(CUSTOM_LIST_KEY, JSON.stringify(customListColumns));
}

function openCustomColumnModal() {
    customListPickerSelection = customListColumns.slice();
    renderCustomColumnPicker();
    document.getElementById('custom-column-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCustomColumnModal() {
    document.getElementById('custom-column-modal').classList.remove('active');
    document.body.style.overflow = '';
}

function renderCustomColumnPicker() {
    const groups = [
        { id: 'custom-col-picker-project', group: 'project' },
        { id: 'custom-col-picker-tender',  group: 'tender' },
        { id: 'custom-col-picker-experts', group: 'experts' }
    ];
    groups.forEach(({ id, group }) => {
        const container = document.getElementById(id);
        if (!container) return;
        container.innerHTML = CUSTOM_LIST_COLUMN_CATALOG
            .filter(c => c.group === group)
            .map(c => {
                const label = getCustomColumnHeader(c);
                const selected = customListPickerSelection.includes(c.key);
                return `
                    <div class="custom-col-pick${selected ? ' selected' : ''}" data-key="${c.key}"
                         onclick="toggleCustomColumnPick('${c.key}')"
                         title="${escapeHtml(label)}">
                        <span class="pick-box"><i class="fa-solid fa-check"></i></span>
                        <span class="pick-label">${escapeHtml(label)}</span>
                    </div>`;
            }).join('');
    });
    const countEl = document.getElementById('custom-col-modal-count');
    if (countEl) countEl.textContent = customListPickerSelection.length;
}

function toggleCustomColumnPick(key) {
    const idx = customListPickerSelection.indexOf(key);
    if (idx >= 0) customListPickerSelection.splice(idx, 1);
    else customListPickerSelection.push(key);
    renderCustomColumnPicker();
}

function selectAllCustomColumns() {
    customListPickerSelection = CUSTOM_LIST_COLUMN_CATALOG.map(c => c.key);
    renderCustomColumnPicker();
}

function applyCustomColumnSelection() {
    /* Katalog sırasına göre sırala — taşıma butonları bu sırayı korur. */
    const picked = new Set(customListPickerSelection);
    customListColumns = CUSTOM_LIST_COLUMN_CATALOG
        .map(c => c.key)
        .filter(key => picked.has(key));
    saveCustomListColumns();
    closeCustomColumnModal();
    renderCustomListTable();
}

/* Sütunu sola/sağa taşır. idx = sütun sırası, dir = -1 (sola) | +1 (sağa) */
function moveCustomColumn(idx, dir) {
    const target = idx + dir;
    if (idx < 0 || idx >= customListColumns.length) return;
    if (target < 0 || target >= customListColumns.length) return;
    const arr = customListColumns;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    saveCustomListColumns();
    renderCustomListTable();
}

function getCustomColumnValue(job, col) {
    let raw;
    if (col.source === 'experts') {
        raw = (job.experts || {})[col.key];
    } else {
        raw = job[col.key];
    }
    const text = (raw === undefined || raw === null) ? '' : String(raw).trim();
    return text === '' || text === '-' ? '-' : escapeHtml(text);
}

const CUSTOM_LIST_EXPERT_KEYS = ['mimari', 'statik', 'mekanik', 'elektrik', 'altyapi', 'peyzaj', 'zemin'];

/* Sütun başlığındaki filtre ikonu yalnız kendi sütununu etkiler (Excel'deki gibi). */
let customListFilters = {};
let customListOpenFilter = null;

/* Bir iş kaydının sütun anahtarına karşılık gelen ham (escape edilmemiş) değeri. */
function getCustomColumnRawValue(job, col) {
    const raw = col.source === 'experts' ? (job.experts || {})[col.key] : job[col.key];
    const text = (raw === undefined || raw === null) ? '' : String(raw).trim();
    return text === '' ? '-' : text;
}

/* Filtreleri uygulanmış iş listesi. */
function getCustomListFilteredJobs() {
    let list = jobs;
    if (globalSearchQuery) {
        list = list.filter(j => jobMatchesSearch(j));
    }
    const entries = Object.entries(customListFilters);
    if (entries.length === 0) return list;
    return list.filter(j => {
        return entries.every(([key, val]) => {
            const col = CUSTOM_LIST_COLUMN_CATALOG.find(c => c.key === key);
            if (!col) return true;
            return getCustomColumnRawValue(j, col) === val;
        });
    });
}

function toggleCustomListFilterMenu(e, columnKey) {
    e.stopPropagation();
    const dropdown = document.getElementById(`cl-dropdown-${columnKey}`);
    if (!dropdown) return;
    const isActive = dropdown.classList.contains('active');
    closeCustomListFilterMenus();
    if (!isActive) { populateCustomListFilterOptions(columnKey); dropdown.classList.add('active'); customListOpenFilter = columnKey; }
}

function closeCustomListFilterMenus() {
    document.querySelectorAll('.cl-filter-dropdown').forEach(d => d.classList.remove('active'));
    customListOpenFilter = null;
}

function populateCustomListFilterOptions(columnKey) {
    const dropdown = document.getElementById(`cl-dropdown-${columnKey}`);
    if (!dropdown) return;
    const col = CUSTOM_LIST_COLUMN_CATALOG.find(c => c.key === columnKey);
    if (!col) return;

    const values = new Set();
    jobs.forEach(j => values.add(getCustomColumnRawValue(j, col)));

    const activeVal = customListFilters[columnKey];
    let html = `<div class="excel-filter-item ${!activeVal ? 'active' : ''}" onclick="applyCustomListFilter('${columnKey}', '')"><i class="fa-solid fa-list-ul"></i> (Tümünü Göster)</div>`;
    html += sortAlphabetically(Array.from(values)).map(val =>
        `<div class="excel-filter-item ${activeVal === val ? 'active' : ''}" onclick="applyCustomListFilter('${escapeJsAttr(columnKey)}', '${escapeJsAttr(val)}')"><i class="fa-solid fa-check" style="opacity:${activeVal === val ? 1 : 0.2}"></i> ${escapeHtml(val)}</div>`
    ).join('');
    dropdown.innerHTML = html;
}

function applyCustomListFilter(columnKey, value) {
    if (!value) delete customListFilters[columnKey];
    else customListFilters[columnKey] = value;
    closeCustomListFilterMenus();
    renderCustomListTable();
}

function clearCustomListFilters(e) {
    if (e) e.stopPropagation();
    customListFilters = {};
    closeCustomListFilterMenus();
    renderCustomListTable();
}

/* Etkin filtreleri "Sütun: Değer" biçiminde özetler. */
function getCustomFilterSummaryText() {
    const parts = Object.entries(customListFilters).map(([key, val]) => {
        const col = CUSTOM_LIST_COLUMN_CATALOG.find(c => c.key === key);
        return col ? `${getCustomColumnHeader(col)}: ${val}` : val;
    });
    return parts.join('  |  ');
}

/* Görünen listeyi, seçili sütunlarla birebir aynı sırada Excel'e aktarır. */
function exportCustomListExcel() {
    const cols = customListColumns
        .map(key => CUSTOM_LIST_COLUMN_CATALOG.find(c => c.key === key))
        .filter(Boolean);

    if (cols.length === 0) {
        alert('Önce en az bir sütun seçmelisiniz.\n\nListede görmek istediğiniz sütunları "Sütunları Seç" butonundan seçebilirsiniz.');
        return;
    }

    const list = getCustomListFilteredJobs();
    if (list.length === 0) {
        alert('Listede dışa aktarılacak kayıt bulunmuyor.');
        return;
    }

    const dataRows = list.map((j, index) => {
        const row = { "No": index + 1, "İş Tanımı": j.is_tanimi || '' };
        cols.forEach(c => {
            let val = getCustomColumnRawValue(j, c);
            /* Excel'de "-" yerine boş görünsün. */
            if (val === '-') val = '';
            row[getCustomColumnHeader(c)] = val;
        });
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Özel İş Listesi");
    XLSX.writeFile(workbook, `Ozel_Is_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function renderCustomListTable() {
    const head = document.getElementById('custom-list-head');
    const tbody = document.getElementById('custom-list-table-body');
    if (!head || !tbody) return;

    const cols = customListColumns
        .map(key => CUSTOM_LIST_COLUMN_CATALOG.find(c => c.key === key))
        .filter(Boolean);

    const countEl = document.getElementById('custom-list-col-count');
    if (countEl) countEl.textContent = cols.length;

    if (document.getElementById('nav-count-custom-list')) {
        document.getElementById('nav-count-custom-list').innerText = jobs.length;
    }

    const totalCols = cols.length + 3; // No + İŞ TANIMI + İŞLEMLER

    if (cols.length === 0) {
        head.innerHTML = '';
        tbody.innerHTML = `
            <tr><td colspan="${totalCols}">
                <div class="cl-empty-hint">
                    <i class="fa-solid fa-table-columns cl-empty-icon"></i>
                    <h4>Henüz sütun seçilmedi</h4>
                    <p>Listede görmek istediğiniz sütunları seçmek için sağ üstteki
                       <strong>"Sütunları Seç"</strong> butonunu kullanın.</p>
                </div>
            </td></tr>`;
        updateCustomFilterSummary();
        return;
    }

    const colHeads = cols.map((c, i) => `
        <th class="cl-col-head" style="position:relative;">
            <span class="cl-move-group">
                <button class="cl-move-btn" title="Sola taşı" ${i === 0 ? 'disabled' : ''} onclick="moveCustomColumn(${i}, -1)"><i class="fa-solid fa-chevron-left"></i></button>
                <button class="cl-move-btn" title="Sağa taşı" ${i === cols.length - 1 ? 'disabled' : ''} onclick="moveCustomColumn(${i}, 1)"><i class="fa-solid fa-chevron-right"></i></button>
            </span>
            <span class="cl-col-title" onclick="toggleCustomListFilterMenu(event, '${escapeJsAttr(c.key)}')" title="Filtrelemek için tıklayın">${escapeHtml(getCustomColumnHeader(c))}</span>
            <span class="cl-filter-trigger ${customListFilters[c.key] ? 'has-filter' : ''}" onclick="toggleCustomListFilterMenu(event, '${escapeJsAttr(c.key)}')" title="Filtrele"><i class="fa-solid fa-filter"></i></span>
            <div class="cl-filter-dropdown" id="cl-dropdown-${c.key}"></div>
        </th>`).join('');

    head.innerHTML = `<tr>
        <th class="col-number-cell">#</th>
        <th>İŞ TANIMI</th>
        ${colHeads}
        <th class="col-actions-cell">İŞLEMLER</th>
    </tr>`;

    const list = getCustomListFilteredJobs();

    const bodyRows = list.map((j, index) => {
        const cells = cols.map(c => {
            const val = getCustomColumnValue(j, c);
            if (c.key === 'asama') {
                const isMissing = checkJobMissingInfo(j);
                return `<td class="cl-nowrap-cell"><span class="status-badge ${getStatusBadgeClass(j.asama)}">${val}${isMissing ? '<span class="missing-info-pulse" title="Uyarı: Eksik Bilgi Mevcut!"></span>' : ''}</span></td>`;
            }
            if (CUSTOM_LIST_EXPERT_KEYS.includes(c.key)) {
                return `<td class="cl-nowrap-cell"><small style="color:var(--txt-sub); font-weight:500;">${val}</small></td>`;
            }
            /* Kısa alanlar (il, ilçe, tür vb.) sarmasın; uzun metin alanları sarmalansın. */
            const wrapKeys = ['is_tanimi', 'protokol', 'alt_yuklenici', 'section'];
            const cellClass = wrapKeys.includes(c.key) ? 'cl-wrap-cell' : 'cl-nowrap-cell';
            return `<td class="${cellClass}">${val}</td>`;
        }).join('');

        return `
            <tr class="table-row-hover ${getRowStripeClass(j.asama)}" onclick="openJobModal('${j.id}')" data-job-id="${j.id}">
                <td class="col-number-cell">${index + 1}</td>
                <td class="cl-wrap-cell"><strong>${escapeHtml(j.is_tanimi || '-')}</strong></td>
                ${cells}
                <td class="col-actions-cell" onclick="event.stopPropagation();">
                    <div class="action-btns" style="justify-content:center;">
                        <button class="btn-icon" title="Detay" onclick="event.stopPropagation(); viewJobDetail('${j.id}')"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-icon" title="Düzenle" onclick="event.stopPropagation(); openJobModal('${j.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon" title="Dış Form Linki Kopyala" onclick="event.stopPropagation(); copyGuestFormLink('${j.id}')"><i class="fa-solid fa-link"></i></button>
                        <button class="btn-icon delete" title="Sil" onclick="event.stopPropagation(); deleteJob('${j.id}')"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    let emptyMsg = 'Kayıtlı iş bulunmuyor.';
    if (Object.keys(customListFilters).length) emptyMsg = 'Seçili filtrelere uyan kayıt bulunmuyor.';
    else if (globalSearchQuery) emptyMsg = 'Aramanızla eşleşen kayıt bulunamadı.';
    tbody.innerHTML = bodyRows || `<tr><td colspan="${totalCols}" style="text-align:center; color:var(--txt-muted); padding:8px;">${emptyMsg}</td></tr>`;
    _applyStaggerIndex(tbody, 20);
    updateCustomFilterSummary();
}

/* Etkin filtre sayısını ve özetini toolbar'da gösterir. */
function updateCustomFilterSummary() {
    const summary = document.getElementById('cl-filter-summary');
    const textEl = document.getElementById('cl-filter-summary-text');
    if (!summary || !textEl) return;
    const count = Object.keys(customListFilters).length;
    if (count === 0) {
        summary.classList.remove('visible');
        textEl.textContent = '';
    } else {
        summary.classList.add('visible');
        const list = getCustomListFilteredJobs();
        textEl.textContent = `${getCustomFilterSummaryText()}  →  ${list.length} kayıt`;
    }
}

/* DÜZELTİLDİ: TABLODA HER SATIR BİRİNCİDEN BAŞLAYARAK NUMARALANDIRILIR */
function renderMissingInfoTable() {
    const tbody = document.getElementById('missing-info-table-body');
    const countSpan = document.getElementById('missing-info-summary-count');
    if (!tbody) return;

    const missingList = jobs.filter(j => checkJobMissingInfo(j));
    if (countSpan) countSpan.innerText = `${missingList.length} İş Kaydında Eksik Veri Bulundu`;

    const missingVisible = globalSearchQuery
        ? missingList.filter(j => jobMatchesSearch(j))
        : missingList;

    if (missingList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--color-emerald); padding:12px; font-weight:700;"><i class="fa-solid fa-circle-check" style="font-size:14px; margin-bottom:2px; display:block;"></i>Tebrikler! Sistemdeki tüm projelerin veri kayıtları eksiksiz.</td></tr>`;
        return;
    }

    if (missingVisible.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--txt-muted); padding:12px;">Aramanızla eşleşen eksik bilgi kaydı bulunamadı.</td></tr>`;
        return;
    }

    const htmlBuffer = missingVisible.map((j, index) => {
        const missingDetails = getMissingInfoDetails(j);
        const badgeClass = getStatusBadgeClass(j.asama);

        return `
            <tr class="table-row-hover ${getRowStripeClass(j.asama)}" onclick="openJobModal('${j.id}')" data-job-id="${j.id}">
                <td class="col-number-cell">${index + 1}</td>
                <td><span class="tag" style="background:rgba(59,130,246,0.15); color:var(--color-primary);">${escapeHtml(j.section || '250Bin')}</span></td>
                <td class="col-il-ilce-cell"><strong style="color:var(--txt-main); font-weight:700;">${escapeHtml(j.il)}</strong><br><small style="color:var(--txt-muted); font-weight:500;">${escapeHtml(j.ilce)}</small></td>
                <td><strong>${escapeHtml(j.is_tanimi)}</strong></td>
                <td><span class="stage-status-wrap"><span class="status-badge ${badgeClass}">${escapeHtml(j.asama)}</span>${hasImportantTimelineNote(j) ? '<span class="stage-alert-pulse" title="Timeline içinde önemli not var"><i class="fa-solid fa-exclamation"></i></span>' : ''}</span></td>
                <td>
                    <div style="display:flex; flex-wrap:wrap; gap:2px;">
                        ${missingDetails.map(m => `<span class="tag" style="background:rgba(244, 63, 94, 0.18); color:var(--color-rose); border:1px solid rgba(244, 63, 94, 0.3); height:18px; font-size:10.5px;"><i class="fa-solid fa-circle-exclamation" style="font-size:9.5px; margin-right:2px;"></i>${escapeHtml(m)}</span>`).join('')}
                    </div>
                </td>
                <td onclick="event.stopPropagation();">
                    <div class="action-btns" style="justify-content:center;">
                        <button class="btn btn-primary" style="height:24px; padding:0 8px; font-size:11px;" onclick="event.stopPropagation(); openJobModal('${j.id}')"><i class="fa-solid fa-wrench"></i> Tamamla</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = htmlBuffer;
    _applyStaggerIndex(tbody, 20);
}

function viewJobDetail(id) {
    const j = jobs.find(x => String(x.id) === String(id));
    if (!j) return;
    const ex = j.experts || {};
    const totalCount = j.timeline ? j.timeline.length : 0;
    const timelineHtml = (j.timeline || []).map((t, idx) => `<div class="timeline-item${t.important ? ' is-important' : ''}"><span class="timeline-num">${totalCount - idx}</span>${t.important ? '<i class="fa-solid fa-triangle-exclamation timeline-important-marker" title="Önemli not"></i>' : ''}<span class="timeline-detail-content" style="white-space:pre-wrap; flex:1;">${escapeHtml(t.text)}</span></div>`).join('') || '<div style="font-size:12.5px; color:var(--txt-muted);">Henüz not eklenmedi.</div>';

    document.getElementById('detail-modal-body').innerHTML = `
        <h2 style="font-size:16.8px; font-weight:800; color:var(--txt-main);">${escapeHtml(j.is_tanimi)}</h2>
        <p style="color:var(--color-primary); font-weight:700; font-size:13.8px; margin-top:2px;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(j.il)} / ${escapeHtml(j.ilce)}</p>
        <br>
        <p style="font-size:13.2px; color:var(--txt-main);"><strong>${customHeaderTitles.projeTuru || 'KATEGORİ / PROTOKOL'}:</strong> ${escapeHtml(j.section || '250Bin')} | <strong>${customHeaderTitles.tur || 'TÜR'}:</strong> ${escapeHtml(j.tur || '-')} | <strong>${customHeaderTitles.protokol || 'PROTOKOL'}:</strong> ${escapeHtml(j.protokol || '-')} | <strong>${customHeaderTitles.avanUygulama || 'AVAN / UYGULAMA'}:</strong> ${escapeHtml(j.avan_uygolama || '-')}</p>
        <p style="font-size:13.2px; color:var(--txt-main);"><strong>${customHeaderTitles.projeMusaviri || 'PROJE MÜŞAVİRİ'}:</strong> ${escapeHtml(j.proje)} | <strong>İnşaat Alanı:</strong> ${escapeHtml(j.insaat_alani || '-')}</p>
        <p style="font-size:13.2px; color:var(--txt-main);"><strong>${customHeaderTitles.altYuklenici || 'ALT YÜKLENİCİ'}:</strong> ${escapeHtml(j.alt_yuklenici)} | <strong>Kentsel ve Emlak Yazısı:</strong> ${escapeHtml(j.digerDaire || '-')}</p>
        <p style="font-size:13.2px; color:var(--txt-main);"><strong>${customHeaderTitles.asama || 'AŞAMA'}:</strong> ${escapeHtml(j.asama)} | <strong>İhale Tarihi:</strong> ${escapeHtml(j.ihale_tarihi || '-')}</p>
        <p style="font-size:13.2px; color:var(--txt-main);"><strong>Sözleşme Tarihi:</strong> ${escapeHtml(j.sozlesme_tarihi || '-')} | <strong>İhale Bedeli:</strong> ${escapeHtml(j.ihale_bedeli || '-')}</p>
        <p style="font-size:13.2px; color:var(--txt-main);"><strong>${customHeaderTitles.insaatMusaviri || 'İNŞAAT MÜŞAVİRİ'}:</strong> ${escapeHtml(j.insaat_musaviri || '-')} | <strong>İnşaat Yüklenicisi:</strong> ${escapeHtml(j.yuklenici || '-')}</p>
        ${j.folder_path ? `
        <div style="margin-top:6px;">
            <button class="btn btn-secondary" style="width:100%; border-color:var(--color-cyan); color:var(--color-cyan); font-size:12.5px;" onclick="openFolderPath('${escapeJsAttr(j.folder_path)}')">
                <i class="fa-solid fa-folder-open"></i> Proje Klasörünü Windows'ta Aç (${escapeHtml(j.folder_path)})
            </button>
        </div>
        ` : ''}
        <br>
        <div style="background:var(--input-bg); border:1px solid var(--surface-border); padding:8px 10px; border-radius:6px;">
            <strong style="color:var(--color-primary); font-size:13.2px;">UZMAN KADROSU:</strong><br>
            <small style="font-size:12px; color:var(--txt-sub); font-weight:500;">
                • ${customHeaderTitles.mimari || 'MİMARİ'}: ${ex.mimari || '-'} | • ${customHeaderTitles.statik || 'STATİK'}: ${ex.statik || '-'} | • ${customHeaderTitles.mekanik || 'MEKANİK'}: ${ex.mekanik || '-'}<br>
                • ${customHeaderTitles.elektrik || 'ELEKTRİK'}: ${ex.elektrik || '-'} | • ${customHeaderTitles.altyapi || 'ALTYAPI'}: ${ex.altyapi || '-'} | • ${customHeaderTitles.peyzaj || 'PEYZAJ'}: ${ex.peyzaj || '-'}<br>
                • ${customHeaderTitles.zemin || 'ZEMİN'}: ${ex.zemin || '-'} | • ${customHeaderTitles.plankote || 'PLANKOTE'}: ${ex.plankote || '-'}
            </small>
        </div>
        ${j.important_notes ? `
        <br>
        <div style="background:rgba(245, 158, 11, 0.1); border:1px solid var(--color-amber); padding:8px 10px; border-radius:6px;">
            <strong style="color:var(--color-amber); font-size:13.2px;"><i class="fa-solid fa-note-sticky"></i> ÖNEMLİ NOTLAR:</strong><br>
            <p style="font-size:13.2px; color:var(--txt-main); margin-top:2px; white-space:pre-wrap;">${escapeHtml(j.important_notes)}</p>
        </div>
        ` : ''}
        <br>
        <strong style="font-size:13.8px; color:var(--txt-main);">Gelişme Tarihçesi (Timeline):</strong>
        <div class="timeline-container" style="margin-top:4px;">${timelineHtml}</div>`;
    document.getElementById('detail-modal').classList.add('active');
}
function closeDetailModal() { document.getElementById('detail-modal').classList.remove('active'); }

/* --- ZENGİN METİN: not editörü ------------------------------------------------
   Not gövdesi artık HTML tutuyor. Kayıt sırasında yalnızca izin verilen etiket ve
   stil öznitelikleri bırakılır; script, olay işleyicisi ve javascript: bağlantıları
   temizlenir. Kartta gösterilirken de aynı temizleme uygulanır, böylece eski düz
   metinli notlar da sorunsuz açılır. */
const NOTE_EDITOR_ALLOWED_TAGS = ['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P', 'DIV', 'H3', 'H4', 'UL', 'OL', 'LI', 'SPAN', 'FONT', 'MARK'];

function sanitizeNoteHtml(html) {
    const raw = String(html || '');
    if (!raw.trim()) return '';
    // Eski notlar düz metin olarak saklanmıştı; satır sonları görünür kalsın.
    if (!/<\s*[a-z][\s\S]*>/i.test(raw)) return escapeHtml(raw).replace(/\r?\n/g, '<br>');

    const template = document.createElement('template');
    template.innerHTML = raw;
    const nodes = [...template.content.querySelectorAll('*')];

    nodes.forEach(node => {
        if (!NOTE_EDITOR_ALLOWED_TAGS.includes(node.tagName)) {
            node.replaceWith(...node.childNodes);
            return;
        }
        [...node.attributes].forEach(attr => {
            const name = attr.name.toLowerCase();
            const value = attr.value;
            if (name === 'color' || name === 'bgcolor' || name === 'face') {
                const safe = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ||
                             /^[a-z]+$/i.test(value.trim());
                if (!safe) node.removeAttribute(attr.name);
                return;
            }
            if (name === 'style') {
                const style = value
                    .split(';')
                    .map(rule => rule.trim())
                    .filter(rule => /^(color|background-color|background|font-weight|font-style|text-decoration|text-align|line-height)\s*:/i.test(rule))
                    .map(rule => rule.replace(/expression|url|@import|javascript:/gi, ''))
                    .join('; ');
                if (style) node.setAttribute('style', style); else node.removeAttribute('style');
                return;
            }
            node.removeAttribute(attr.name);
        });
    });

    return template.innerHTML;
}

function getNoteEditorElement() { return document.getElementById('form-note-body'); }

function setNoteEditorHtml(html) {
    const editor = getNoteEditorElement();
    if (editor) editor.innerHTML = sanitizeNoteHtml(html);
}

function getNoteEditorText() {
    const editor = getNoteEditorElement();
    if (!editor) return '';
    return (editor.innerText || '').replace(/\u00a0/g, ' ').trim();
}

function getNoteEditorHtml() {
    const editor = getNoteEditorElement();
    if (!editor) return '';
    return sanitizeNoteHtml(editor.innerHTML).trim();
}

function syncNoteToolbarState() {
    const editor = getNoteEditorElement();
    if (!editor) return;
    editor.querySelectorAll('.ntb-btn[data-cmd]').forEach(btn => {
        const cmd = btn.dataset.cmd;
        if (cmd !== 'bold' && cmd !== 'italic' && cmd !== 'underline') return;
        let active = false;
        try { active = document.queryCommandState(cmd); } catch (err) { active = false; }
        btn.classList.toggle('active', active);
    });
}

function execNoteEditorCommand(btn) {
    const editor = getNoteEditorElement();
    if (!editor) return;
    const cmd = btn.dataset.cmd;
    const arg = btn.dataset.arg || null;
    editor.focus();
    if (cmd === 'hiliteColor') document.execCommand('styleWithCSS', false, true);
    try {
        if (cmd === 'formatBlock') {
            const block = (document.queryCommandValue('formatBlock') || '').toLowerCase();
            document.execCommand('formatBlock', false, block === arg ? 'p' : arg);
        } else {
            document.execCommand(cmd, false, arg);
        }
    } catch (err) { /* desteklenmeyen komut: sessizce geç */ }
    syncNoteToolbarState();
}

function initNoteRichEditor() {
    const editor = getNoteEditorElement();
    if (!editor || editor.dataset.richReady === '1') return;
    editor.dataset.richReady = '1';

    const toolbar = editor.closest('.note-editor-group')?.querySelector('.note-rich-toolbar');
    if (toolbar) {
        toolbar.addEventListener('mousedown', event => {
            if (event.target.closest('.ntb-color')) return; // renk seçici odak kaybettirmesin
            event.preventDefault();
        });
        toolbar.querySelectorAll('.ntb-btn[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => execNoteEditorCommand(btn));
        });
    }

    const colorInput = document.getElementById('note-text-color');
    const swatch = document.getElementById('note-text-color-swatch');
    if (colorInput) {
        colorInput.addEventListener('input', () => {
            if (swatch) swatch.style.background = colorInput.value;
            editor.focus();
            try { document.execCommand('foreColor', false, colorInput.value); } catch (err) { /* yoksay */ }
        });
    }

    editor.addEventListener('keyup', syncNoteToolbarState);
    editor.addEventListener('mouseup', syncNoteToolbarState);
    editor.addEventListener('focus', syncNoteToolbarState);

    editor.addEventListener('keydown', event => {
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key === 's') { event.preventDefault(); saveNote(); return; }
        const map = { b: 'bold', i: 'italic', u: 'underline' };
        if (!map[key]) return;
        event.preventDefault();
        try { document.execCommand(map[key], false, null); } catch (err) { /* yoksay */ }
        syncNoteToolbarState();
    });

    editor.addEventListener('paste', event => {
        const html = event.clipboardData ? event.clipboardData.getData('text/html') : '';
        if (!html) return;
        event.preventDefault();
        const plain = event.clipboardData.getData('text/plain');
        document.execCommand('insertHTML', false, html ? sanitizeNoteHtml(html) : escapeHtml(plain).replace(/\r?\n/g, '<br>'));
    });
}

function openNoteModal(id = null) {
    if (id) {
        const n = notes.find(x => String(x.id) === String(id));
        document.getElementById('note-modal-title').innerText = "Notu Düzenle";
        document.getElementById('form-note-id').value = n.id;
        document.getElementById('form-note-date').value = n.date;
        document.getElementById('form-note-title').value = n.title;
        document.getElementById('form-note-tag').value = n.tag;
        document.getElementById('form-note-color').value = n.color || 'default';
        setNoteEditorHtml(n.body);
    } else {
        document.getElementById('note-modal-title').innerText = "Yeni Not Ekle";
        document.getElementById('form-note-id').value = '';
        document.getElementById('form-note-date').value = taskDateKey();
        document.getElementById('form-note-title').value = '';
        document.getElementById('form-note-tag').value = 'Bilgi';
        document.getElementById('form-note-color').value = 'default';
        setNoteEditorHtml('');
    }
    syncNoteToolbarState();
    document.getElementById('note-modal').classList.add('active');
    _staggerModalBody('note-modal');
}
function closeNoteModal() { document.getElementById('note-modal').classList.remove('active'); }

function saveNote() {
    const id = document.getElementById('form-note-id').value;
    const title = document.getElementById('form-note-title').value.trim();
    const date = document.getElementById('form-note-date').value;
    const tag = document.getElementById('form-note-tag').value.trim() || 'Bilgi';
    const color = document.getElementById('form-note-color').value;
    const body = getNoteEditorHtml();

    if (!title || !getNoteEditorText()) return;
    if (id) pushUndoState('Not düzenleme'); // yalnızca mevcut notun üzerine yazıyorsak
    if (id) {
        const n = notes.find(x => String(x.id) === String(id));
        if(n) { n.title = title; n.date = date; n.tag = tag; n.color = color; n.body = body; }
    } else {
        notes.unshift({ id: 'note_' + Date.now(), title, date, tag, color, body });
        /* Kullanıcı tüm panoları silmiş olsa bile yeni not eklediğinde not
           görünür olmalıdır: panoların tümü silinmiş işareti kaldırılır ve
           notun konusu (pano) listeye geri eklenir. */
        if (noteBoardsAllCleared) {
            noteBoardsAllCleared = false;
            if (!(noteTopics || []).some(t => String(t).trim().toLowerCase() === tag.toLowerCase())) {
                noteTopics = [...(noteTopics || []), tag];
            }
        }
    }
    saveAllData(); renderNotes(); closeNoteModal();
}
function deleteNote(id) { pushUndoState('Not silme'); notes = notes.filter(n => String(n.id) !== String(id)); saveAllData(); renderNotes(); }

function closeAllExcelFilterDropdowns() { document.querySelectorAll('.excel-filter-dropdown').forEach(d => d.classList.remove('active')); }

function toggleExcelFilterMenu(e, columnKey) {
    e.stopPropagation();
    const targetDropdown = document.getElementById(`dropdown-filter-${columnKey}`);
    const isActive = targetDropdown.classList.contains('active');
    closeAllExcelFilterDropdowns();
    if (!isActive) { populateExcelFilterOptions(columnKey); targetDropdown.classList.add('active'); }
}

function populateExcelFilterOptions(columnKey) {
    const dropdown = document.getElementById(`dropdown-filter-${columnKey}`); 
    const uniqueValues = new Set();

    if (columnKey === 'tur') {
        const settingsTypes = settings.tur || ["MSB", "EGM", "JGK", "-", "İDARE UYGULAMA", "KENTSEL", "TALEP"];
        settingsTypes.forEach(t => uniqueValues.add(t));
    }

    jobs.forEach(j => {
        if (columnKey === 'section') {
            if (j.section) uniqueValues.add(j.section.trim());
        } else if (columnKey === 'tur') {
            if (j.tur) uniqueValues.add(j.tur.trim());
        } else if (columnKey === 'il') {
            if (j.il) uniqueValues.add(j.il.trim());
        } else if (columnKey === 'is_tanimi') {
            if (j.is_tanimi) uniqueValues.add(j.is_tanimi.trim());
        } else if (columnKey === 'proje') {
            if (j.proje && j.proje !== '-') uniqueValues.add(j.proje.trim());
            if (j.alt_yuklenici && j.alt_yuklenici !== '-') uniqueValues.add(j.alt_yuklenici.trim());
        } else if (columnKey === 'asama') {
            if (j.asama) uniqueValues.add(j.asama.trim());
        } else if (columnKey === 'last_timeline') {
            const val = (j.timeline && j.timeline.length > 0) ? j.timeline[0].text : '-';
            if (val) uniqueValues.add(val.trim());
        }
    });

    const activeFilterVal = selectedExcelFilters[columnKey];
    let htmlBuffer = `<div class="excel-filter-item ${!activeFilterVal ? 'active' : ''}" onclick="applyExcelFilter('${columnKey}', '')"><i class="fa-solid fa-list-ul"></i> (Tümünü Göster)</div>`;
    
    const sortedVals = columnKey === 'tur' ? Array.from(uniqueValues) : sortAlphabetically(Array.from(uniqueValues));
    htmlBuffer += sortedVals.map(val => 
        `<div class="excel-filter-item ${activeFilterVal === val ? 'active' : ''}" onclick="applyExcelFilter('${escapeJsAttr(columnKey)}', '${escapeJsAttr(val)}')"><i class="fa-solid fa-check" style="opacity:${activeFilterVal === val ? 1 : 0.2}"></i> ${escapeHtml(val)}</div>`
    ).join('');

    dropdown.innerHTML = htmlBuffer;
}

function applyExcelFilter(columnKey, value) {
    if (!value) delete selectedExcelFilters[columnKey]; else selectedExcelFilters[columnKey] = value;
    closeAllExcelFilterDropdowns(); renderProjectsTable(); renderSidebarTurSublist();
}

function resetExcelFilters() {
    selectedExcelFilters = {};
    clearGlobalSearch();

    renderProjectsTable();
    renderSidebarTurSublist();
}

/* DÜZELTİLDİ: SIRA NUMARASI SÜTUNU DAHİL EDİLEREK LİSTELEME APAYRI HALE GETİRİLDİ */
function renderProjectsTable() {
    const tbody = document.getElementById('projects-table-body'); 
    if (!tbody) return;

    let filtered = jobs.filter(j => {
        if (!jobMatchesSearch(j)) return false;
        if (selectedExcelFilters['section'] && (j.section || '250Bin') !== selectedExcelFilters['section']) return false;
        if (selectedExcelFilters['tur'] && (j.tur || '-') !== selectedExcelFilters['tur']) return false;
        if (selectedExcelFilters['il'] && (j.il || '').trim() !== selectedExcelFilters['il']) return false;
        if (selectedExcelFilters['is_tanimi'] && j.is_tanimi !== selectedExcelFilters['is_tanimi']) return false;
        
        if (selectedExcelFilters['proje']) {
            const targetVal = selectedExcelFilters['proje'];
            const matchMusavir = (j.proje || '').trim() === targetVal;
            const matchYuklenici = (j.alt_yuklenici || '').trim() === targetVal;
            if (!matchMusavir && !matchYuklenici) return false;
        }

        if (selectedExcelFilters['asama'] && j.asama !== selectedExcelFilters['asama']) return false;
        if (selectedExcelFilters['last_timeline']) {
            const lastText = (j.timeline && j.timeline.length > 0) ? j.timeline[0].text : '-';
            if (lastText !== selectedExcelFilters['last_timeline']) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--txt-muted); padding:10px;">Görüntülenecek iş kaydı bulunamadı.</td></tr>`; 
        return;
    }

    const htmlBuffer = filtered.map((j, index) => {
        const lastTimeline = (j.timeline && j.timeline.length > 0) ? j.timeline[0].text : '-';
        const badgeClass = getStatusBadgeClass(j.asama);
        const isMissingInfo = checkJobMissingInfo(j);
        
        return `
            <tr class="table-row-hover ${getRowStripeClass(j.asama)}" onclick="openJobModal('${j.id}')" data-job-id="${j.id}">
                <td class="col-number-cell">${index + 1}</td>
                <td><span class="tag" style="background:rgba(59,130,246,0.15); color:var(--color-primary);">${escapeHtml(j.section || '250Bin')}</span></td>
                <td><span class="tag" style="background:rgba(139,92,246,0.15); color:var(--color-violet);">${escapeHtml(j.tur || '-')}</span></td>
                <td class="col-il-ilce-cell"><strong style="color:var(--txt-main); font-weight:700;">${escapeHtml(j.il)}</strong><br><small style="color:var(--txt-muted); font-weight:500;">${escapeHtml(j.ilce)}</small></td>
                <td><strong>${escapeHtml(j.is_tanimi)}</strong></td>
                <td><strong style="color:var(--txt-main); font-weight:600;">${escapeHtml(j.proje)}</strong><br><small style="color:var(--txt-muted); font-weight:500;">${escapeHtml(j.alt_yuklenici)}</small></td>
                <td>
                    <span class="stage-status-wrap">
                        <span class="status-badge ${badgeClass}">
                            ${escapeHtml(j.asama)}
                            ${isMissingInfo ? '<span class="missing-info-pulse" title="Uyarı: Eksik Bilgi Mevcut!"></span>' : ''}
                        </span>
                        ${hasImportantTimelineNote(j) ? '<span class="stage-alert-pulse" title="Timeline içinde önemli not var"><i class="fa-solid fa-exclamation"></i></span>' : ''}
                    </span>
                </td>
                <td><small style="color:var(--txt-sub); font-weight:500;">${j.timeline && j.timeline[0] && j.timeline[0].important ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-amber); margin-right:4px;" title="Önemli not"></i>' : ''}${escapeHtml(lastTimeline)}</small></td>
                <td onclick="event.stopPropagation();">
                    <div class="action-btns" style="justify-content:center;">
                        <button class="btn-icon" title="Detay" onclick="event.stopPropagation(); viewJobDetail('${j.id}')"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-icon" title="Düzenle" onclick="event.stopPropagation(); openJobModal('${j.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon" title="Dış Form Linki Kopyala" onclick="event.stopPropagation(); copyGuestFormLink('${j.id}')"><i class="fa-solid fa-link"></i></button>
                        <button class="btn-icon delete" title="Sil" onclick="event.stopPropagation(); openSecurityDeleteModal('${j.id}')"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    tbody.innerHTML = htmlBuffer;
    _applyStaggerIndex(tbody, 20);

    const tooltip = document.getElementById('experts-hover-tooltip');
    tbody.querySelectorAll('.table-row-hover').forEach(row => {
        row.addEventListener('mouseenter', (e) => {
            const id = row.getAttribute('data-job-id'); const j = jobs.find(x => String(x.id) === String(id)); if (!j) return;
            const ex = j.experts || {};
            tooltip.innerHTML = `<strong>Proje Sorumlu Kadrosu:</strong>• ${customHeaderTitles.mimari || 'MİMARİ'}: ${ex.mimari || '-'}<br>• ${customHeaderTitles.statik || 'STATİK'}: ${ex.statik || '-'}<br>• ${customHeaderTitles.mekanik || 'MEKANİK'}: ${ex.mekanik || '-'}<br>• ${customHeaderTitles.elektrik || 'ELEKTRİK'}: ${ex.elektrik || '-'}<br>• ${customHeaderTitles.altyapi || 'ALTYAPI'}: ${ex.altyapi || '-'}<br>• ${customHeaderTitles.peyzaj || 'PEYZAJ'}: ${ex.peyzaj || '-'}`;
            tooltip.style.display = 'block';
        });
        row.addEventListener('mousemove', (e) => { tooltip.style.left = (e.clientX + 12) + 'px'; tooltip.style.top = (e.clientY + 12) + 'px'; });
        row.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });
}

/* --- GÜVENLİ SİLME: BASILI TUT (HOLD TO DELETE) --------------------------
   ÖNCEKİ HALİ: #security-delete-input içine "12345" yazılması gerekiyordu.
   GÖREV GEREĞİ bu doğrulama kaldırıldı. Yerine buton 2 saniyede dolar;
   yalnızca tamamen dolunca silme çalışır. Fonksiyon adları korunur, çağıran
   satırlar (openSecurityDeleteModal / openSecurityDeleteBoardModal) değişmez.

   SÜRE 2 SANİYE ve butonun üstünde yazmaz: dolma efekti zaten süreyi
   gösteriyor, ayrıca etiket yazmak hem gereksiz hem de animasyon
   bitmeden yanlış bilgi verir. */
function openSecurityDeleteModal(jobId) {
    deleteTargetJobId = jobId;
    deleteTargetType = 'job';
    const job = jobs.find(j => String(j.id) === String(jobId));
    const desc = document.getElementById('security-delete-desc');
    if (desc) desc.textContent = `"${job ? (job.is_tanimi || 'Bu iş kaydı') : 'Bu iş kaydı'}" silinecek. Yanlışlıkla silmeyi önlemek için aşağıdaki butonu basılı tutun.`;
    _resetHoldButton();
    document.getElementById('security-delete-modal').classList.add('active');
}

/* Pano silme: aynı hold-onay akışı, metin hedef pano adına göre kurulur. */
function openSecurityDeleteBoardModal(topic) {
    const clean = String(topic || '').trim();
    if (!clean) return;
    deleteTargetJobId = null;
    deleteTargetType = 'board';
    deleteTargetBoardTopic = clean;
    const desc = document.getElementById('security-delete-desc');
    if (desc) desc.textContent = `"${clean}" panosu ve içindeki tüm notlar silinecek. Yanlışlıkla silmeyi önlemek için aşağıdaki butonu basılı tutun.`;
    _resetHoldButton();
    document.getElementById('security-delete-modal').classList.add('active');
}

function closeSecurityDeleteModal() {
    deleteTargetJobId = null;
    deleteTargetType = null;
    deleteTargetBoardTopic = null;
    _resetHoldButton();
    document.getElementById('security-delete-modal').classList.remove('active');
}

/* --- HOLD TO DELETE MOTORU ----------------------------------------------
   pointerdown  → .holding (CSS dolgu animasyonunu başlatır)
   pointerup/leave/cancel → .holding kaldırılır, dolgu sıfırlanır
   Süre dolunca → .hold-done + _completeHoldDelete() tetiklenir
   NOT: pointerup dinleyicisi WINDOW'a bağlanır; kullanıcı butondan çok
   uzağa sürükleyip bıraksa bile dolgu durur ve işlem iptal edilir.

   SÜRE CSS'TEN OKUNUR (--hold-duration, varsayılan 2s). Tek kaynak
   sayesinde CSS animasyonu ile JS zamanlayıcısı asla ayrışamaz; süreyi
   değiştirmek için tek bir yeri düzenlemek yeterlidir. */
function _holdDurationMs() {
    const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--hold-duration').trim();
    const m = /^([0-9.]+)(ms|s)$/.exec(raw);
    if (!m) return 2000;
    return parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1);
}
let _holdTimer = null;
let _holdDone = false;

function _resetHoldButton() {
    const btn = document.getElementById('security-hold-btn');
    if (btn) btn.classList.remove('holding', 'hold-done');
    if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
    _holdDone = false;
}

function _startHold() {
    const btn = document.getElementById('security-hold-btn');
    if (!btn || _holdDone) return;
    btn.classList.add('holding');
    if (_holdTimer) clearTimeout(_holdTimer);
    _holdTimer = setTimeout(_completeHoldDelete, _holdDurationMs());
}

function _cancelHold() {
    const btn = document.getElementById('security-hold-btn');
    if (btn) btn.classList.remove('holding');
    if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
}

function _completeHoldDelete() {
    const btn = document.getElementById('security-hold-btn');
    if (!btn || _holdDone) return;
    _holdDone = true;
    _holdTimer = null;
    btn.classList.remove('holding');
    btn.classList.add('hold-done');

    /* Hedefi oku, modalı kapat, silmeyi yap. */
    const type = deleteTargetType;
    const jobId = deleteTargetJobId;
    const topic = deleteTargetBoardTopic;
    closeSecurityDeleteModal();

    if (type === 'board' && topic) {
        removeNoteTopicColumn(topic);
    } else if (type === 'job' && jobId) {
        deleteJob(jobId);
    }
}

/* Motoru bir kez, uygulama açılışında bağla. */
function initHoldToDelete() {
    const btn = document.getElementById('security-hold-btn');
    if (!btn || btn.dataset.holdBound === '1') return;
    btn.dataset.holdBound = '1';
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        _startHold();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
        btn.addEventListener(evt, _cancelHold);
    });
    /* Pencere genelinde bırakma: buton dışına kaydırılınca da iptal et. */
    window.addEventListener('pointerup', _cancelHold);
    window.addEventListener('pointercancel', _cancelHold);
    /* Klavye erişilebilirliği: Space/Enter basılı tutulduğunda da çalışır. */
    btn.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); _startHold(); }
    });
    btn.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') _cancelHold();
    });
}

/* --- TOAST BİLDİRİMİ --------------------------------------------------------
   Dosyada daha önce yalnızca `typeof showToast === 'function'` korumalı
   çağrılar vardı, tanımı yoktu. Bu uygulama kendi elementini ve stillerini
   bir kez oluşturur; korumalı çağrılar artık gerçek bildirim üretir.

   GÖREV 3: showToast(message, type, action) — üçüncü argüman opsiyonel bir
   { label, onClick } çiftidir. Verilirse toast'ın sağında "Geri Al" düğmesi
   çıkar. Çağıran mevcut iki argümanlı çağrılar (yüzlerce satır) ETKİLENMEZ. */
function showToast(message, type, action) {
    let wrap = document.getElementById('app-toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'app-toast-wrap';
        document.body.appendChild(wrap);
    }
    if (!document.getElementById('app-toast-style')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'app-toast-style';
        styleTag.textContent = [
            '#app-toast-wrap { position: fixed; bottom: 18px; right: 18px; display: flex; flex-direction: column; gap: 8px; z-index: 4000; pointer-events: none; }',
            '.app-toast { pointer-events: auto; max-width: 420px; padding: 10px 14px; border-radius: var(--radius-md, 10px);',
            '  background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(14px); color: #F8FAFC; font-size: 12.6px; font-weight: 600;',
            '  border: 1px solid var(--surface-border-strong, #334155); border-left-width: 3px; box-shadow: 0 12px 30px rgba(0,0,0,0.45);',
            '  animation: appToastIn 0.22s cubic-bezier(0.16, 1, 0.3, 1); }',
            '.app-toast.toast-success { border-left-color: #22c55e; }',
            '.app-toast.toast-error { border-left-color: #f43f5e; }',
            '.app-toast.toast-warning { border-left-color: #f59e0b; }',
            '.app-toast.toast-info { border-left-color: #3b82f6; }',
            '.app-toast.app-toast-hide { animation: appToastOut 0.25s ease forwards; }',
            '[data-theme="light"] .app-toast { background: rgba(242, 248, 248, 0.97); color: #26555c; box-shadow: 0 10px 24px rgba(8, 47, 54, 0.2); }',
            '@keyframes appToastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }',
            '@keyframes appToastOut { to { opacity: 0; transform: translateY(8px); } }',
            '@media (prefers-reduced-motion: reduce) { .app-toast { animation: none; } .app-toast.app-toast-hide { animation: none; opacity: 0; } }'
        ].join('\n');
        document.head.appendChild(styleTag);
    }

    const toast = document.createElement('div');
    toast.className = 'app-toast toast-' + (type || 'info');
    /* Metin ve aksiyon ayrı kutu olarak konur: aksiyon flex ile sağa yaslanır,
       metin kısalmaz. Metin her zaman textContent ile yazılır (innerHTML değil)
       — kullanıcı verisi HTML'e dönüşemez. */
    const textSpan = document.createElement('span');
    textSpan.className = 'app-toast-text';
    textSpan.textContent = String(message || '');
    toast.appendChild(textSpan);

    if (action && action.label && typeof action.onClick === 'function') {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'app-toast-action';
        actionBtn.textContent = String(action.label);
        actionBtn.addEventListener('click', () => {
            /* Aksiyona basınca toast'u hemen kapat: işlem gerçekleşti,
               bildirimin ekranda asılı kalması gerekmez. */
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            action.onClick();
        });
        toast.appendChild(actionBtn);
    }
    wrap.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('app-toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3400);
}

/* --- GERİ AL MEKANİZMASI ---------------------------------------------------
   pushUndoState() bir işlemden HEMEN ÖNCE çağrılır ve mevcut verinin kopyasını
   yığına koyar. undoLastChange() yığından son kaydı alıp veriyi eski haline
   döndürür. Kopyalama JSON üzerinden yapılır, böylece yığında tutulan kayıt
   sonradan yapılan değişikliklerden etkilenmez. */
function captureUndoState() {
    return {
        jobs: JSON.parse(JSON.stringify(jobs)),
        activeJobIds: JSON.parse(JSON.stringify(activeJobIds)),
        notes: JSON.parse(JSON.stringify(notes)),
        noteTopics: JSON.parse(JSON.stringify(noteTopics)),
        noteBoardsAllCleared: noteBoardsAllCleared,
        tasks: JSON.parse(JSON.stringify(tasks)),
        files: JSON.parse(JSON.stringify(files))
    };
}

function pushUndoState(label) {
    undoStack.push({ label: label || 'İşlem', state: captureUndoState() });
    if (undoStack.length > UNDO_STACK_LIMIT) undoStack.shift();
    updateUndoIndicator();
}

function undoLastChange() {
    const entry = undoStack.pop();
    if (!entry) { updateUndoIndicator(); return; }

    jobs = entry.state.jobs;
    activeJobIds = entry.state.activeJobIds;
    notes = entry.state.notes;
    noteTopics = entry.state.noteTopics;
    /* Geri al, "tüm panolar silinmiş" durumunu da eski haline döndürür. */
    noteBoardsAllCleared = !!entry.state.noteBoardsAllCleared;
    tasks = entry.state.tasks;
    files = entry.state.files;

    saveAllData();
    refreshAllViews();
    updateUndoIndicator();
    if (typeof showToast === 'function') showToast(entry.label + ' geri alındı.', 'info');
    else alert(entry.label + ' geri alındı.');
}

function updateUndoIndicator() {
    const btn = document.getElementById('undo-btn');
    if (!btn) return;
    const last = undoStack[undoStack.length - 1];
    btn.disabled = !last;
    btn.title = last ? (last.label + ' — geri al (Ctrl+Z)') : 'Geri alınacak işlem yok';
    const label = btn.querySelector('.undo-btn-label');
    if (label) label.textContent = last ? last.label : 'Geri Al';
}

/* Hangi ekrandaysak o ekranı ve sayıları tazeler; geri alma sonrası
   farklı tablolarda bayat veri kalmaması için merkezi nokta. */
function refreshAllViews() {
    updateGlobalCounts();
    applyDynamicHeaderTitles();
    renderTickerBar();
    if (activeView === 'messages') renderNotes();
    if (activeView === 'tasks') renderDailyTasks();
    if (activeView === 'files') renderFiles();
    if (activeView === 'stats') renderStatisticsView();
    if (activeView === 'custom-list') renderCustomListTable();
    if (activeView === 'missing-info') renderMissingInfoTable();
    if (activeView === 'active-jobs') renderActiveJobsTable();
    if (activeView === 'projects') renderProjectsTable();
    if (activeView === 'settings') renderSettingsPage();
}

function deleteJob(id) {
    const job = jobs.find(j => String(j.id) === String(id));
    const label = job ? (job.is_tanimi || 'İş kaydı') : 'İş kaydı';
    pushUndoState('İş silme');
    jobs = jobs.filter(j => String(j.id) !== String(id)); activeJobIds = activeJobIds.filter(aId => String(aId) !== String(id));
    saveAllData(); updateGlobalCounts(); renderProjectsTable();
    if (activeView === 'custom-list') renderCustomListTable();
    if (activeView === 'active-jobs') renderActiveJobsTable();
    /* GÖREV 3: Soft delete — kayıt hemen silinir, kullanıcıya geri alma
       bildirimi sunulur. Geri al işlemi mevcut undo yığınından son kaydı alır,
       yani ayrı bir kopya tutulmaz. */
    if (typeof showToast === 'function') {
        showToast('İş kaydı silindi: ' + label, 'success', { label: 'Geri Al', onClick: undoLastChange });
    }
}

/* DİNAMİK LİSTE AYARLARI SAYFASI MASONRY RENDER MANTIĞI */

/* Masonry düzendeki liste kartlarına sırayla atanan renkler. Kartların sol
   şeridi ve başlık rengi bu paletten beslenir. */
const SETTING_CARD_COLORS = ['#3b82f6', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];

function renderSettingsPage() {
    const container = document.getElementById('settings-grid-container'); 
    if (!container) return;

    let htmlBuffer = '';
    
    Object.keys(settings).forEach((key, cardIdx) => {
        const sortedItems = key === 'tur' ? settings[key] : sortAlphabetically(settings[key]);
        const displayTitle = customHeaderTitles[key] || key.toUpperCase();
        /* Kart rengi sıraya göre atanır: aynı listedeki kart her render'da aynı
           rengi alır, böylece "TÜR" listesinin kartı her zaman aynı yerde aynı
           renkte durur. Liste eklenip çıkarılırsa sıra kayabilir; bu kabul
           edilebilir, çünkü renk kimlik değil ayırıcıdır. */
        const cardColor = SETTING_CARD_COLORS[cardIdx % SETTING_CARD_COLORS.length];

        const chips = sortedItems.map((item, idx) => `
            <span class="setting-chip">
                <span>${escapeHtml(item)}</span>
                <span class="setting-chip-actions">
                    <i class="fa-solid fa-pen" title="Düzenle" onclick="editSettingItem('${key}', ${idx})"></i>
                    <i class="fa-solid fa-xmark" title="Sil" onclick="removeSettingItem('${key}', ${idx})"></i>
                </span>
            </span>
        `).join('');

        htmlBuffer += `
            <div class="setting-card" style="--card-c:${cardColor};">
                <div class="setting-card-header">
                    <h4><i class="fa-solid fa-list-check"></i> ${escapeHtml(displayTitle)}</h4>
                    <div class="setting-card-header-actions">
                        <button type="button" class="btn-edit-title" onclick="editHeaderTitle('${key}')" title="Başlığı Revize Et">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </div>
                <div class="setting-list">${chips}</div>
                <div style="display:flex; gap:4px; margin-top: auto; position:relative; z-index:2; padding-top:4px;">
                    <input type="text" id="setting-input-${key}" class="form-control" placeholder="Yeni eleman ekle..." onkeypress="if(event.key==='Enter') addSettingItem('${key}')">
                    <button class="btn btn-primary" onclick="addSettingItem('${key}')"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>`;
    });

    container.innerHTML = htmlBuffer;
}

function editHeaderTitle(key) {
    const currentTitle = customHeaderTitles[key] || key.toUpperCase();
    const newTitle = prompt(`"${currentTitle}" başlığını revize edin:`, currentTitle);
    if (newTitle !== null && newTitle.trim() !== '') {
        customHeaderTitles[key] = newTitle.trim();
        saveAllData();
        applyDynamicHeaderTitles();
        renderSettingsPage();
    }
}

function addSettingItem(key) {
    const input = document.getElementById(`setting-input-${key}`); const val = input.value.trim(); if (!val) return;
    if (!settings[key]) settings[key] = [];
    settings[key].push(val); 
    if (key !== 'tur') settings[key] = sortAlphabetically(settings[key]); 
    saveAllData(); renderSettingsPage(); renderSidebarTurSublist();
}

function editSettingItem(key, idx) {
    const oldVal = settings[key][idx]; const newVal = prompt(`"${oldVal}" seçeneğini revize edin:`, oldVal);
    if (newVal === null || newVal.trim() === '' || newVal.trim() === oldVal) return;
    const updatedVal = newVal.trim(); settings[key][idx] = updatedVal; 
    if (key !== 'tur') settings[key] = sortAlphabetically(settings[key]);

    jobs.forEach(j => {
        if (key === 'projeTuru' && j.section === oldVal) j.section = updatedVal;
        if (key === 'tur' && j.tur === oldVal) j.tur = updatedVal;
        if (key === 'protokol' && j.protokol === oldVal) j.protokol = updatedVal;
        if (key === 'asama' && j.asama === oldVal) j.asama = updatedVal;
        if (key === 'avanUygulama' && j.avan_uygolama === oldVal) j.avan_uygolama = updatedVal;
        if (key === 'projeMusaviri' && j.proje === oldVal) j.proje = updatedVal;
        if (key === 'altYuklenici' && j.alt_yuklenici === oldVal) j.alt_yuklenici = updatedVal;
        if (key === 'insaatMusaviri' && j.insaat_musaviri === oldVal) j.insaat_musaviri = updatedVal;
        if (j.experts) { Object.keys(j.experts).forEach(expKey => { if (j.experts[expKey] === oldVal) j.experts[expKey] = updatedVal; }); }
    });
    saveAllData(); renderSettingsPage(); renderSidebarTurSublist();
}

function removeSettingItem(key, idx) { 
    settings[key].splice(idx, 1); 
    if (key !== 'tur') settings[key] = sortAlphabetically(settings[key]); 
    saveAllData(); renderSettingsPage(); renderSidebarTurSublist();
}

function populateCityDropdown() {
    const select = document.getElementById('form-il'); 
    if (!select) return;
    
    const sortedCities = sortAlphabetically(turkeyCities);
    select.innerHTML = sortedCities.map(c => `<option value="${c}">${c}</option>`).join('');

    /* İl seçili olduğu için ilçe listesi de ilk açılışta kurulur; modal
       düzenleme modunda aşağıdaki openJobModal'da ayrıca tazelenir. */
    populateDistrictDropdown();
    updateJobZoneCloud();
}

/* --------------------------------------------------------------------------
   İLÇE ALANI ← HARİTA VERİSİ
   --------------------------------------------------------------------------
   Kaynak: haritada çizilen ilçe sınırlarının GÖRÜNTÜLENDİĞÜ aynı veri
   (districtOfProvince / geoBoundaries ADM2). Yani formdaki ilçe listesi ile
   haritadaki tıklanabilir ilçeler aynı kaynaktan gelir — iki ayrı liste
   tutulmadığı için "haritada var ama formda yok" durumu oluşamaz.

   NEDEN <select> DEĞİL DE <input list=...> (datalist)?
     • Harita verisi UZAKTAN ve ASENKRON yüklenir (~3.9MB). <select> olsaydı
       veri gelene kadar ya boş kalır ya da geçici bir liste gösterilirdi;
       kullanıcının o anda yazdığı ilçe adı da kaybolabilirdi.
     • Datalist: veri gelene kadar alan normal serbest metin (ESKİ kayıtlardaki
       elle yazılmış ilçe adları her zaman korunur), geldikten sonra listeden
       seçilebilir. Yani ileri/geri uyumluluk bozulmaz, veri kaybı olmaz.

   Yine de veri yüklendikten sonra girilen bir ilçe adı listede yoksa
   form KAYDETMEDEN ÖNCE uyarır; böylece haritaya bağlanamayan yazım
   farkında olunur. */
function populateDistrictDropdown() {
    const datalist = document.getElementById('form-ilce-options');
    const ilSelect = document.getElementById('form-il');
    if (!datalist || !ilSelect) return;

    /* Form adı → harita anahtarı: "Afyonkarahisar" → "Afyon" (CITY_NAME_ALIASES).
       districtMapKeyOf bunu katlanmış karşılaştırmayla yapar; ayrıntı ve
       ölçülmüş gerekçe orada. */
    const cityName = districtMapKeyOf(ilSelect.value);
    const list = (cityName && districtOfProvince && districtOfProvince[cityName]) || [];
    /* Aynı ada sahip ilçe kayıtları (MultiPolygon parçaları) tekilleştirilir. */
    const seen = new Set();
    const names = [];
    list.forEach(f => {
        const n = districtNameOf(f);
        if (!n || seen.has(n)) return;
        seen.add(n);
        names.push(n);
    });
    names.sort((a, b) => String(a).localeCompare(String(b), 'tr', { sensitivity: 'base' }));

    datalist.innerHTML = names.map(n => `<option value="${escapeHtml(n)}"></option>`).join('');

    /* Placeholder, ilin ilçe verisi yüklendiyse "seç veya yaz", değilse
       "ilçe verisi yükleniyor" der; kullanıcı neden boş liste gördüğünü bilir. */
    const input = document.getElementById('form-ilce');
    if (input) input.placeholder = !cityName ? 'Önce il seçin'
        : (list.length ? 'Listeden seç veya yaz' : 'İlçe listesi yükleniyor…');
}

/* Kaydetmeden önce doğrulama: girilen ilçe, seçili ilin harita listesinde
   eşleşiyor mu? Eşleşmiyorsa kullanıcı bilgilendirilir (kayıt yine de
   engellenmez — veri kaybı yaratmamak ve eski serbest metin alışkanlığını
   bozmamak bilinçli tercihtir). */
function warnIfDistrictNotOnMap() {
    const ilSelect = document.getElementById('form-il');
    const ilceInput = document.getElementById('form-ilce');
    if (!ilSelect || !ilceInput) return true;
    const cityName = ilSelect.value;
    const entered = (ilceInput.value || '').trim();
    if (!cityName || !entered) return true;
    if (!districtOfProvince) return true;              /* veri yüklenmedi, uyarma */
    /* "Afyonkarahisar" form adı, haritada "Afyon" anahtarıdır. */
    const mapKey = districtMapKeyOf(cityName);
    const list = districtOfProvince[mapKey] || [];
    if (!list.length) return true;                      /* il eşleşmedi, uyarma */
    if (districtFeatureByName(mapKey, entered)) return true;
    return confirm(
        `"${entered}" adlı ilçe, ${cityName} için haritadaki ilçe sınırlarında bulunamadı.\n\n` +
        `Listeye yakın bir isimle devam etmek ister misiniz? (İptal = listeye dön)`
    );
}

/* --- PROJE BAŞLANGIÇ / TESLİM TARİHLERİ -------------------------------------
   Veri modeli: her iş kaydında `start_date` ve `end_date` alanları bulunur ve
   tipik olarak "YYYY-MM-DD" biçimindedir. Bu ikisi, işin "Proje" aşamasında
   süresini tanımlar; Dashboard'un Deadline panelinde görselleştirilir.

   GİYİLEBİLİRLİK SÖZLEŞMESİ (ileri/geri uyum):
     • Alanlar sonradan eklendiği için ESKİ kayıtlarda YOKTUR. Bu yüzden
       okurken her zaman normalize edilir (null → boş string) ve hiçbir akış
       alanı silmez; yalnız aşama "Proje" değilse boş string yazar.
     • Tarihler zorunlu DEĞİLDİR: biri eksikse panel o işi "bar" göstermeden
       listelemez (gürültü üretmemek için), veri kaybolmaz.

   AŞAMA KOŞULU: Başlangıç/Teslim tarihleri yalnız aşaması "Proje" olan işler
   için anlamlıdır; formda da yalnız o durumda görünür/aktif olur. Aşama
   listesi kullanıcı tarafından Ayarlar'dan genişletilebildiği için eşleşme
   büyük/küçük harf duyarsız yapılır. */
const DEADLINE_STAGE = 'Proje';

/** Kayıt düzeyinde: bu iş "Proje" aşamasında mı? */
function isProjectStageJob(job) {
    return String((job && job.asama) || '').trim().toLocaleLowerCase('tr-TR') === DEADLINE_STAGE.toLocaleLowerCase('tr-TR');
}

/** Form düzeyinde: şu an seçili aşama "Proje" mi? (kayda bakmadan) */
function isJobDeadlineActive() {
    const sel = document.getElementById('form-asama');
    if (!sel) return false;
    return String(sel.value || '').trim().toLocaleLowerCase('tr-TR') === DEADLINE_STAGE.toLocaleLowerCase('tr-TR');
}

/** "YYYY-MM-DD" → Date (yerel saat, gün doğrulaması ile). Geçersizse null. */
function parseIsoDate(value) {
    if (typeof value !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(y, mo - 1, d);
    /* new Date(2026,1,30) Mart 2'ye taşınır; böyle "taşma" günleri reddedip
       gerçek takvim günü olmayan girdileri geçersiz sayıyoruz. */
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
}

/** İki "YYYY-MM-DD" arasındaki TAKVİM gün farkı (saat etkisiz, yaz saati yok).
    Başlangıç > bitiş ise negatif döner. */
function diffDaysBetween(fromIso, toIso) {
    const a = parseIsoDate(fromIso), b = parseIsoDate(toIso);
    if (!a || !b) return null;
    /* MS_PER_DAY ile bölmek güvenli: her iki Date de YEREL saatte gece 00:00'a
       normalize edildiği için yaz saati kayması farkı bozmaz. */
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Bugünün "YYYY-MM-DD" anahtarı (YEREL saat — taskDateKey ile aynı mantık). */
function todayIsoKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Deadline ilerleme verisini üretir — saf fonksiyon, DOM'a dokunmaz.
 * @returns {{ok:boolean, reason?:string, pct?:number, daysLeft?:number,
 *            overdue?:boolean, totalDays?:number, elapsedDays?:number}}
 *   ok=false ise çubuk çizilmez (eksik/geçersiz tarih).
 */
function computeDeadlineProgress(job) {
    const start = job && job.start_date;
    const end = job && job.end_date;
    if (!isProjectStageJob(job)) return { ok: false, reason: 'Aşama "Proje" değil' };
    if (!parseIsoDate(start)) return { ok: false, reason: 'Başlangıç tarihi eksik' };
    if (!parseIsoDate(end)) return { ok: false, reason: 'Teslim tarihi eksik' };

    const total = diffDaysBetween(start, end);
    /* Süre sıfır veya negatifse (teslim başlangıçtan önce/aynı gün) yüzde
       anlamsızdır; panel bu işi bar'sız listelemek yerine "tanımsız" sayar. */
    if (!total || total <= 0) return { ok: false, reason: 'Teslim, başlangıçtan sonra değil', totalDays: total };

    const elapsed = diffDaysBetween(start, todayIsoKey());
    const daysLeft = diffDaysBetween(todayIsoKey(), end);
    /* İlerleme yüzdesi = (bugün − başlangıç) / (teslim − başlangıç) × 100.
       Gece yarısı/yaz saati etkisizdir; değer 0–100 aralığına kırpılır
       (henüz başlamadıysa 0, süresi dolmuşsa 100). */
    let pct = (elapsed / total) * 100;
    pct = Math.min(100, Math.max(0, pct));
    return { ok: true, pct: pct, daysLeft: daysLeft, overdue: daysLeft < 0, totalDays: total, elapsedDays: elapsed };
}

/**
 * İlerleme yüzdesine göre bar rengini seçer (dinamik uyarı mantığı):
 *   < 60        → birincil mavi (rahat)
 *   60–79       → amber (dikkat)
 *   80–100      → amber + NABIZ animasyonu (uyarı; süre dolmak üzere)
 *   gecikmiş    → kırmızı (teslim tarihi geçti)
 * Süre dolmuş (%100) ama HENÜZ geçmemiş durum da uyarı sayılır; renk yeşile
 * dönmez çünkü "bitti" değil, "son gün" demektir.
 */
function deadlineTone(progress) {
    if (!progress || !progress.ok) return { cssVar: 'var(--color-primary)', warn: false, overdue: false };
    if (progress.overdue) return { cssVar: 'var(--color-rose)', warn: false, overdue: true };
    const pct = progress.pct;
    if (pct >= 80) return { cssVar: 'var(--color-amber)', warn: true, overdue: false };
    if (pct >= 60) return { cssVar: 'var(--color-amber)', warn: false, overdue: false };
    return { cssVar: 'var(--color-primary)', warn: false, overdue: false };
}

/** Teslim tarihini DD.MM.YYYY olarak okunur biçimde döndürür. */
function formatDeadlineDate(iso) {
    const d = parseIsoDate(iso);
    if (!d) return '—';
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** "Kalan Gün: X gün" metnini üretir (gecikmişse "Gecikti: X gün"). */
function deadlineRemainingText(progress) {
    if (!progress || !progress.ok || progress.daysLeft === undefined || progress.daysLeft === null) return '';
    const d = progress.daysLeft;
    if (d < 0) return `Gecikti: ${Math.abs(d)} gün`;
    if (d === 0) return 'Kalan Gün: Bugün';
    return `Kalan Gün: ${d} gün`;
}

/**
 * Başlangıç/Teslim alanlarının görünürlüğünü günceller.
 * Aşama "Proje" DEĞİLSE → blok tamamen gizlenir (display:none).
 * Aşama "Proje" İSE     → blok görünür ve alanlar aktif (disabled=false).
 * İpucu satırında ayrıca toplam süre ve teslime kalan gün canlı gösterilir.
 */
function updateDeadlineFieldsVisibility() {
    const box = document.getElementById('form-deadline-box');
    if (!box) return;
    const active = isJobDeadlineActive();
    box.style.display = active ? '' : 'none';
    const startEl = document.getElementById('form-start-date');
    const endEl = document.getElementById('form-end-date');
    [startEl, endEl].forEach(el => { if (el) el.disabled = !active; });
    if (!active) return;

    const hint = document.getElementById('form-deadline-hint');
    if (!hint || !startEl || !endEl) return;
    const total = diffDaysBetween(startEl.value, endEl.value);
    if (startEl.value && endEl.value && total !== null && total <= 0) {
        hint.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-amber);"></i> <b>Teslim tarihi başlangıçtan sonra olmalıdır.</b> Süre hesaplanamıyor.';
        return;
    }
    if (total && total > 0) {
        const left = diffDaysBetween(todayIsoKey(), endEl.value);
        const leftTxt = left === null ? ''
            : left < 0 ? ` — <b style="color:var(--color-rose);">${Math.abs(left)} gün gecikti</b>`
            : left === 0 ? ' — teslim <b>bugün</b>'
            : ` — teslime <b>${left} gün</b> kaldı`;
        hint.innerHTML = `<i class="fa-solid fa-circle-info"></i> Süre: <b>${total} gün</b>${leftTxt}. Dashboard'daki <b>Deadline</b> panelinde gösterilir.`;
        return;
    }
    hint.innerHTML = '<i class="fa-solid fa-circle-info"></i> Bu tarihler yalnız <b>Proje</b> aşamasında tutulur ve Dashboard\'daki <b>Deadline</b> panelinde süre dolumu olarak gösterilir.';
}

/* İŞ MODALI — İle göre otomatik ısı bölgesi bilgi bulutu */
function updateJobZoneCloud() {
    const container = document.getElementById('job-zone-cloud-container');
    if (!container) return;

    const ilSelect = document.getElementById('form-il');
    const city = ilSelect ? ilSelect.value : '';
    const zone = getCityHeatZone(city);

    if (!city) {
        container.innerHTML = '';
        return;
    }

    if (!zone) {
        container.innerHTML = `
            <div class="job-zone-cloud" style="--zone-c:#94a3b8; --zone-tint:rgba(148, 163, 184, 0.10);">
                <div class="zone-cloud-head">
                    <span class="zone-tooltip-badge" style="background:#94a3b8;"><i class="fa-solid fa-circle-question"></i> Bölge Bilinmiyor</span>
                    <span class="zone-cloud-city"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(city)}</span>
                </div>
                <div class="zone-note-row">
                    <i class="fa-solid fa-circle-info" style="color:#94a3b8;"></i>
                    <span>Bu il için tanımlı bir ısı bölgesi bulunmuyor; cam seçimi ve yalıtım kalınlıkları <b>TS 825</b> / <b>BEP-TR</b> hesaplarına göre belirlenir.</span>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="job-zone-cloud" style="--zone-c:${zone.color}; --zone-tint:${zone.tint};">
            <div class="zone-cloud-head">
                <span class="zone-tooltip-badge" style="background:${zone.color};"><i class="fa-solid ${zone.icon}"></i> ${escapeHtml(zone.label)}</span>
                <span class="zone-cloud-city"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(city)}</span>
            </div>
            ${getZoneNotesListHtml(zone, false)}
        </div>
    `;
}

/* NOTLAR VE KARARLAR — KONU BAZLI KANBAN PANOSU

   NOT: bg alanı artık 'var(--note-card-bg)' olarak CSS değişkenine bağlı.
   ÖLÇÜLEN HATA: kartın <div> satır içi stili `background:${accent.bg}`
   yazıyordu; varsayılan accent'te bu 'transparent' idi ve bu SATIR İÇİ
   değer, kartın CSS zeminini (.note-card-box / gündüz modu beyaz kart)
   eziyordu — gündüzde kart arka planı saydam kalıyor, metin boşluğun
   içinde görünmüyordu. Artık renk seçimi koda değil CSS'e aittir; tema
   değişince kart zemini doğru değere döner. */
function getNoteAccent(c) {
    const accents = {
        blue: { hex: '#3b82f6', bg: 'var(--note-card-bg)' },
        purple: { hex: '#8b5cf6', bg: 'var(--note-card-bg)' },
        emerald: { hex: '#10b981', bg: 'var(--note-card-bg)' },
        amber: { hex: '#f59e0b', bg: 'var(--note-card-bg)' },
        gray: { hex: '#94a3b8', bg: 'var(--note-card-bg)' },
        default: { hex: 'var(--color-primary)', bg: 'var(--note-card-bg)' }
    };
    return accents[c] || accents.default;
}

const DEFAULT_NOTE_TOPIC_COLUMNS = ['Bilgi', 'Önemli', 'Toplantı', 'Karar'];

/* Tüm panolar silindi mi? Bu bayrak localStorage'a yazılır.
   Neden gerekli: getNoteTopics() liste boşken şablon panoları geri getirir.
   Bayrak olmadan kullanıcı son pano silip geri döndüğünde panolar "sihirli"
   bir şekilde geri belirirdi — yani "tüm panolar silinebilir" kuralı tutmazdı.
   Yeni pano eklenince bayrak sıfırlanır. */
let noteBoardsAllCleared = false;

function getNoteTopics() {
    if (noteBoardsAllCleared) return [];
    const boardTopics = (noteTopics || []).map(t => String(t || '').trim()).filter(Boolean);
    const dynamicTopics = notes.map(n => (n.tag || 'Bilgi').trim() || 'Bilgi');
    const base = boardTopics.length ? boardTopics : DEFAULT_NOTE_TOPIC_COLUMNS;
    return [...new Set([...base, ...dynamicTopics])];
}

/* --- PANO (ESKİ ADIYLA SÜTUN) YÖNETİMİ --------------------------------
   Arayüzdeki her "sütun" ifadesi artık "pano"; davranış değişmedi, yalnızca
   kullanıcının gördüğü dil ve pano mimarisi güncellendi. */

/* Kullanıcı bir pano başlığını düzenleyip odaktan çıkınca çalışır:
   boş bırakılırsa eski hali geri yüklenir, geçerli bir ad yazılırsa o
   panodaki tüm notların tag'i yeni başlığa taşınır ve localStorage'a yazılır. */
function commitNoteTopicRename(oldTopic, newTopicRaw) {
    const newTopic = String(newTopicRaw || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    const oldClean = String(oldTopic || '');
    if (!newTopic) { renderNotes(); return; }
    if (newTopic === oldClean) return;
    if (getNoteTopics().some(t => t.toLowerCase() === newTopic.toLowerCase())) { renderNotes(); return; }
    pushUndoState('Pano adı değişikliği');
    if (!(noteTopics || []).length) noteTopics = [...getNoteTopics()];
    noteTopics = noteTopics.map(t => (t === oldClean ? newTopic : t));
    notes.forEach(n => { if (((n.tag || 'Bilgi').trim() || 'Bilgi') === oldClean) n.tag = newTopic; });
    saveAllData(); renderNotes();
}

/* Yeni pano HER ZAMMAN en sağa eklenir: liste sonuna push edilir, sonra pano
   rayı o panoya kadar yumuşak kaydırılır. */
function addNoteTopicColumn() {
    const existing = getNoteTopics();
    let name = 'Yeni Pano';
    let counter = 2;
    while (existing.some(t => t.toLowerCase() === name.toLowerCase())) { name = 'Yeni Pano ' + counter; counter++; }
    if (!(noteTopics || []).length) noteTopics = [...getNoteTopics()];
    noteTopics.push(name);
    /* Yeni pano eklendi → "hepsi silinmiş" durumu biter. */
    noteBoardsAllCleared = false;
    saveAllData(); renderNotes();
    const board = document.getElementById('notes-grid');
    const titleEl = board ? [...board.querySelectorAll('.note-topic-title')].find(el => el.textContent.trim() === name) : null;
    if (titleEl) {
        titleEl.focus();
        const range = document.createRange();
        range.selectNodeContents(titleEl);
        const selection = window.getSelection();
        if (selection) { selection.removeAllRanges(); selection.addRange(range); }
    }
    scrollNoteBoardToColumn(name);
}

/* Güvenlik kodu doğrulaması, bu fonksiyonu çağırır: pano silinmeden önce
   hedef, gerçekten var olan bir pano adı mı diye doğrulanır. */
function canRemoveNoteTopicColumn(topic) {
    const clean = String(topic || '').trim();
    if (!clean) return false;
    return getNoteTopics().some(t => t.toLowerCase() === clean.toLowerCase());
}

/* PANO SİLME — tüm panolar (varsayılan şablonlar dahil) silinebilir ve
   pano içindeki notlar da pano ile birlikte gider.
   ÖNEMLİ: Silme, listenin KENDİSİ üzerinde çalışır. Eski davranışta liste
   boşalınca getNoteTopics() varsayılan şablonları geri getiriyordu; bu yüzden
   son pano silinemiyordu. Artık kayıtta '[]' saklandığı için silinen pano
   kalıcı olarak gider, geri gelmez. */
function removeNoteTopicColumn(topic) {
    const clean = String(topic || '').trim();
    if (!canRemoveNoteTopicColumn(clean)) return;
    const count = notes.filter(n => ((n.tag || 'Bilgi').trim() || 'Bilgi') === clean).length;

    pushUndoState('Pano silme');
    /* HATA DÜZELTMESİ (ölçülmüş): noteTopics boşken (kullanıcı hiç özel pano
       eklememişse) ekrandaki panolar getNoteTopics()'un VARSAYILAN ŞABLON
       yedeğinden gelir. Bu durumda aşağıdaki filter boş diziyi filtrelediği
       için silme hiçbir şey yapmıyordu — şifre kabul edilir, modal kapanır,
       ama pano yerinde dururdu. commitNoteTopicRename ve addNoteTopicColumn
       zaten aynı durumu "mutasyondan önce listeyi tohumla" pattern'i ile
       çözer; silme fonksiyonunda bu satır eksikti. */
    if (!(noteTopics || []).length) noteTopics = [...getNoteTopics()];
    noteTopics = noteTopics.filter(t => String(t || '').trim().toLowerCase() !== clean.toLowerCase());
    notes = notes.filter(n => ((n.tag || 'Bilgi').trim() || 'Bilgi') !== clean);
    /* Liste gerçekten boşaldıysa şablon panoların sessizce geri gelmemesi
       için bayrağı kaldır. DİKKAT: bu kontrol ARTIK tohumlanmış gerçek liste
       üzerinden yapılır — eskiden getNoteTopics().length'e bakıyordu; o ise
       boş listede şablonları geri getirdiği için bayrak asla set edilmiyor
       ve son pano silinip yeniden ortaya çıkıyordu. */
    if (!noteTopics.length) noteBoardsAllCleared = true;
    saveAllData(); renderNotes();

    const message = count
        ? `"${clean}" panosu ve içindeki ${count} not silindi.`
        : `"${clean}" panosu silindi.`;
    /* GÖREV 3: pano silmesi de geri alınabilir bildirimle kapanır. */
    if (typeof showToast === 'function') {
        showToast(message, 'success', { label: 'Geri Al', onClick: undoLastChange });
    }
    else alert(message);
}

/* Tek bir terim için, kaynak metinde Türkçe harfleri de kapsayan bir
   regex üretir. Arama katmanı metni normalize EDİLMİŞ (ş->s) hâlde
   karşılaştırır; vurgulama iska kaynak metne uygulanır. Bu yüzden
   "samsun" terimi "Samsun"u, "SAHİL" terimi "sahil"i de bulmalıdır. */
function buildSearchTokenPattern(token) {
    /* Türkçe'de büyük/küçük harf çiftleri tek harften farklıdır:
       'I'.toLowerCase() -> 'ı' iken 'İ'.toLowerCase() -> 'i'. Vurgulamada
       bu yüzden i/ı/İ/I dörtlüsü tek sınıfta birleştirilir. */
    const TURKISH_CLASSES = {
        'i': 'iıİI', 's': 'sşŞ', 'g': 'gğĞ', 'u': 'uüÜ',
        'o': 'oöÖ', 'c': 'cçÇ'
    };
    let out = '';
    for (const ch of String(token)) {
        if (TURKISH_CLASSES[ch]) {
            out += '[' + TURKISH_CLASSES[ch] + ']';
        } else {
            out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(out, 'gi');
}

/* Düz metin alanlarda arama terimini işaretler. Önce kaçırma yapıldığı için
   <mark> eklemek güvenli; kullanıcı metninde geçen bir HTML etiketi de
   kaçırılmış halde aranır. Not gövdesi gibi HTML tutan alanlarda bu
   fonksiyon KULLANILMAZ, çünkü yapısal etiketleri bozabilir.
   NOT: Her terim KENDİ AYRI vurgulanır. Eskiden tüm sorgu ("samsun 500")
   tek parça olarak aranıyordu; çok terimli aramada bu dizi hiçbir kayıtta
   arka arkaya bulunmadığı için HİÇBİR eşleşme işaretlenmiyordu. */
function highlightSearchMatch(text) {
    const safe = escapeHtml(text);
    if (!globalSearchTokens || !globalSearchTokens.length) return safe;
    let out = safe;
    globalSearchTokens.forEach(token => {
        if (!token) return;
        let pattern;
        try {
            pattern = buildSearchTokenPattern(token);
        } catch (e) {
            return;
        }
        out = out.replace(pattern, m => `<mark class="search-hit">${m}</mark>`);
    });
    return out;
}

/* Not başlığı ve görev metni için ortak vurgulayıcı. */
function highlightNoteTitle(title) { return highlightSearchMatch(title); }

function renderNotes() {
    const container = document.getElementById('notes-grid');
    if (!container) return;

    const searching = !!globalSearchQuery;
    const matchingIds = new Set(getNotesMatchingSearch().map(n => String(n.id)));

    if (searching && matchingIds.size === 0) {
        container.innerHTML = '<div class="note-search-empty">Aramanızla eşleşen not bulunamadı.</div>';
        const options = document.getElementById('note-topic-options');
        if (options) options.innerHTML = getNoteTopics().map(t => `<option value="${escapeHtml(t)}"></option>`).join('');
        return;
    }

    const topics = getNoteTopics().filter(topic => {
        if (!searching) return true;
        return notes.some(n => matchingIds.has(String(n.id)) && ((n.tag || 'Bilgi').trim() || 'Bilgi') === topic);
    });

    /* Panoların tamamı silinmişse boş bir ray yerine açıklayıcı alan gösterilir;
       "Yeni Pano" butonu zaten görünür durumda, böylece kullanıcı çıkmaz
       sokuna düşmez. */
    if (!topics.length) {
        container.innerHTML = `<div class="note-board-empty">
            <i class="fa-solid fa-table-columns"></i>
            <span>${searching ? 'Eşleşen notun panosu yok.' : 'Henüz pano yok. Sağdaki “Yeni Pano” ile başla.'}</span>
        </div>`;
        const options = document.getElementById('note-topic-options');
        if (options) options.innerHTML = getNoteTopics().map(t => `<option value="${escapeHtml(t)}"></option>`).join('');
        return;
    }

    container.innerHTML = topics.map(topic => {
        const topicNotes = notes.filter(n => ((n.tag || 'Bilgi').trim() || 'Bilgi') === topic && (!searching || matchingIds.has(String(n.id))));

        /* "is-oldest" işareti KONUMA göre değil TARİHE göre verilir. Sıralamayı
           burada tarihe çevirseydik kullanıcının sürükle-bırak ile verdiği
           elle sıra her render'da bozulurdu; oysa notlar taşınabilir bir pano
           nesnesi. Bu yüzden dizi sırası korunur, en eski kart tarih karşılaştırmasıyla bulunur. */
        const oldestDate = topicNotes.reduce((min, n) => {
            const d = String(n.date || '');
            return (!min || (d && d < min)) ? d : min;
        }, '');
        const cards = topicNotes.map(n => {
            const accent = getNoteAccent(n.color);
            const isOldest = !!n.date && n.date === oldestDate;
            return `<div class="note-card-box${isOldest ? ' is-oldest' : ''}" data-id="${n.id}" style="border-left:3.5px solid ${accent.hex};background:${accent.bg};--note-title-color:${accent.hex};">
                <div class="note-card-timeline" aria-hidden="true"><span class="note-card-timeline-dot"></span></div>
                <div class="note-card-header-drag" draggable="true" title="Kartı panolar arasında veya sıralamak için sürükleyin">
                    <span style="font-size:11.5px;color:var(--txt-muted);font-weight:600;"><i class="fa-solid fa-grip-vertical" style="margin-right:4px;opacity:0.6;"></i>${escapeHtml(n.date || '-')}</span>
                    <span class="tag" style="background:rgba(139,92,246,0.2);color:var(--color-violet);font-size:10.5px;">${escapeHtml(topic)}</span>
                </div>
                <strong class="note-card-title">${highlightNoteTitle(n.title)}</strong>
                <p class="note-card-body">${sanitizeNoteHtml(n.body)}</p>
                <div style="margin-top:auto;display:flex;justify-content:flex-end;gap:4px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);">
                    <button class="btn-icon" title="Düzenle" onclick="openNoteModal('${n.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon delete" title="Sil" onclick="deleteNote('${n.id}')"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>`;
        }).join('') || `<div class="note-topic-empty"><i class="fa-solid fa-arrow-down-long"></i><span>Kartı bu panoya sürükleyin</span></div>`;

        const isDefaultTopic = DEFAULT_NOTE_TOPIC_COLUMNS.includes(topic);
        /* Başlık öznitelikleri arama sırasında kaldırılır (aşağıda açıklandı).
           İç içe template literal yazmamak için önce burada birleştirilir. */
        const editHint = ' title="' + escapeHtml(topic) + ' — Başlığı düzenlemek için tıklayın (Enter: kaydet, Esc: iptal)"';
        const titleAttrs = searching ? '' : ' contenteditable="true" spellcheck="false"' + editHint;
        /* Arama sürerken pano başlığı düzenleme ve pano silme gizlenir: ekranda
           görünen panolar yalnızca eşleşen notların panoları olduğu için bu
           iki işlem yanlış panoyu hedefleme riski taşır ve veri kaybettirir. */
        /* Silme butonu HER panoda görünür (varsayılan şablonlar dahil) ve
           doğrudan güvenlik kodlu silme modalını açar. */
        const removeBtn = searching ? '' :
            `<button class="btn-icon delete note-topic-remove-btn" data-topic="${escapeHtml(topic)}" title="${isDefaultTopic ? 'Varsayılan' : 'Özel'} panoyu güvenlik kodla sil (pano + notlar)"><i class="fa-solid fa-trash-can"></i></button>`;
        return `<section class="note-topic-column" data-topic="${escapeHtml(topic)}">
            <div class="note-topic-column-header" draggable="true" title="Pano başlığını tutup sağa sola sürükleyerek sırasını değiştirin">
                <span style="display:inline-flex;align-items:center;min-width:0;">
                    <i class="fa-solid fa-grip-vertical note-topic-grip" aria-hidden="true"></i><i class="fa-solid fa-layer-group note-topic-icon" style="margin-right:5px;flex-shrink:0;"></i><span class="note-topic-title"${titleAttrs} data-topic="${escapeHtml(topic)}">${escapeHtml(topic)}</span>
                </span>
                <span class="note-topic-header-actions">
                    ${removeBtn}
                    <span class="note-topic-count">${topicNotes.length}</span>
                </span>
            </div>
            <div class="note-topic-list" data-topic="${escapeHtml(topic)}">${cards}</div>
        </section>`;
    }).join('');

    const topicOptions = document.getElementById('note-topic-options');
    if (topicOptions) topicOptions.innerHTML = getNoteTopics().map(t => `<option value="${escapeHtml(t)}"></option>`).join('');

    container.querySelectorAll('.note-topic-title').forEach(titleEl => {
        /* Başlık hem düzenlenebilir metin alanı hem de pano taşıma
           tutamacının parçası. Metne tıklanıp yazılacaksa HTML5 sürükleme
           başlamamalı; yalnızca yazı seçimi ve düzenleme çalışmalı. */
        titleEl.addEventListener('mousedown', event => event.preventDefault());
        titleEl.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); titleEl.blur(); }
            else if (event.key === 'Escape') { titleEl.textContent = titleEl.dataset.topic; titleEl.blur(); }
        });
        titleEl.addEventListener('blur', () => commitNoteTopicRename(titleEl.dataset.topic, titleEl.textContent));
    });
    container.querySelectorAll('.note-topic-remove-btn').forEach(btn => {
        /* pointerdown engellenir: aksi hâlde yatay pano sürükleme dinleyicisi
           butonu "sürükleme başlangıcı" sanıp panoyu kaydırmaya çalışır. */
        btn.addEventListener('pointerdown', event => event.preventDefault());
        btn.addEventListener('mousedown', event => event.stopPropagation());
        btn.addEventListener('click', event => {
            event.stopPropagation();
            openSecurityDeleteBoardModal(btn.dataset.topic);
        });
    });

    _applyStaggerIndex(document.getElementById('notes-grid').querySelectorAll('.note-topic-list'), 12);
    initNoteDragAndDrop();
    initNoteBoardColumnDrag();
    bindNoteColumnHeaderDrag();
    initNoteBoardPanning();
}

function persistNoteBoardOrder() {
    const board = document.getElementById('notes-grid');
    const orderedIds = [];
    board.querySelectorAll('.note-topic-list').forEach(list => {
        list.querySelectorAll('.note-card-box').forEach(card => {
            const note = notes.find(n => String(n.id) === String(card.dataset.id));
            if (note) { note.tag = list.dataset.topic; orderedIds.push(String(note.id)); }
        });
    });
    if (orderedIds.length === notes.length) {
        notes = orderedIds.map(id => notes.find(n => String(n.id) === id)).filter(Boolean);
        saveAllData();
    }
}

/* Not kartının taşınması, veriyi sadece bırakma anında değiştirir. Bu yüzden
   geri al kaydının TAŞIMA ÖNCESİ hali tutulmalı: sürükleme başlarken hem
   kart sırası hem de verinin kopyası alınır, bırakmada karşılaştırılır.
   Hiçbir şey değişmediyse (kart kendi yerine bırakıldı) geçmişe yazılmaz. */
function snapshotNoteBoard() {
    const board = document.getElementById('notes-grid');
    if (!board) return null;
    const order = [];
    board.querySelectorAll('.note-topic-list').forEach(list => {
        list.querySelectorAll('.note-card-box').forEach(card => {
            order.push(String(card.dataset.id) + '@' + list.dataset.topic);
        });
    });
    return { order, state: captureUndoState() };
}

function commitNoteMoveIfChanged(before) {
    const after = snapshotNoteBoard();
    if (!before || !after || before.order.join('|') === after.order.join('|')) return;
    pushUndoEntry('Not taşıma', before.state);
}

/* pushUndoState'ın etiket + hazır durum alan biçimi. */
function pushUndoEntry(label, state) {
    undoStack.push({ label: label, state: state });
    if (undoStack.length > UNDO_STACK_LIMIT) undoStack.shift();
    updateUndoIndicator();
}


function initNoteDragAndDrop() {
    const board = document.getElementById('notes-grid');
    if (!board) return;

    /* Arama sürerken panonun yalnızca eşleşen kartları gösteriliyor.
       Sürükleme bu durumda hem kafa karıştırıcı hem de veri kaybettirici
       olurdu: persistNoteBoardOrder() DOM'daki tüm notları sırayla yazdığı için
       görünmeyen notlar listeden düşerdi. Bu yüzden arama varken sürükleme kurulmaz. */
    if (globalSearchQuery) return;

    let draggedCard = null;
    let preDragSnapshot = null;
    const placeholder = document.createElement('div');
    placeholder.className = 'note-drop-placeholder';

    board.querySelectorAll('.note-card-box').forEach(card => {
        const handle = card.querySelector('.note-card-header-drag');
        if (!handle) return;
        handle.addEventListener('dragstart', event => {
            draggedCard = card;
            preDragSnapshot = snapshotNoteBoard();
            card.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', card.dataset.id);
            placeholder.style.height = `${card.offsetHeight}px`;
            setTimeout(() => card.after(placeholder), 0);
        });
        handle.addEventListener('dragend', () => {
            if (draggedCard) draggedCard.classList.remove('dragging');
            board.querySelectorAll('.note-topic-list').forEach(list => list.classList.remove('is-drag-over'));
            if (placeholder.parentNode) placeholder.remove();
            commitNoteMoveIfChanged(preDragSnapshot);
            persistNoteBoardOrder();
            draggedCard = null;
            preDragSnapshot = null;
            renderNotes();
        });
    });

    board.querySelectorAll('.note-topic-list').forEach(list => {
        list.addEventListener('dragover', event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            list.classList.add('is-drag-over');
            const cards = [...list.querySelectorAll('.note-card-box:not(.dragging)')];
            const nextCard = cards.find(item => event.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2);
            if (nextCard) list.insertBefore(placeholder, nextCard);
            else list.appendChild(placeholder);
        });
        list.addEventListener('dragleave', event => {
            if (!list.contains(event.relatedTarget)) list.classList.remove('is-drag-over');
        });
        list.addEventListener('drop', event => {
            event.preventDefault();
            list.classList.remove('is-drag-over');
            if (!draggedCard) return;
            if (placeholder.parentNode === list) list.insertBefore(draggedCard, placeholder);
            else list.appendChild(draggedCard);
        });
    });
}

/* --- PANO BAŞLIĞINDAN YATAY TAŞIMA --------------------------------------
   Panolar bir flex ray üzerinde durur. Sütunun kendisi "notes" dizisine
   değil, pano adlarının tutulduğu noteTopics dizisine yazılır; bu yüzden
   taşıma sonrası yalnızca bu dizinin sırası değişir, notlara dokunulmaz.

   İki ayrı sürükleme aynı anda çalışmasın diye başlık, kart sürükleme
   tutamacından (.note-card-header-drag) tamamen ayrıdır; ray kaydırma da
   başlıkta başlamaz (bkz. initNoteBoardPanning içindeki isInteractive). */
function initNoteBoardColumnDrag() {
    const board = document.getElementById('notes-grid');
    if (!board) return;

    /* renderNotes her çağrıldığında sütunları yeniden kurar. Ray öğesinin
       KENDİSİ korunur (içeriği değişir), dolayısıyla bu fonksiyon ilk
       kurulumdan sonra yeniden bağlanmamalı — yoksa ray dinleyicileri her
       render'da birikir ve bir sürükleme N kez tetiklenir. Aynı koruma
       initNoteBoardPanning'de de var. */
    if (board.dataset.columnDragBound === '1') return;
    board.dataset.columnDragBound = '1';

    /* Taşınan sütun, sürükleme öncesi sıra ve yer tutucu ray seviyesinde
       yaşar: sürükleme başlığın üstünden çıkıp rayın boşluğuna girdiğinde
       de devam etmelidir. */
    let draggedColumn = null;
    let beforeOrder = null;
    const placeholder = document.createElement('div');
    placeholder.className = 'note-column-drop-placeholder';

    function currentOrder() {
        return [...board.querySelectorAll('.note-topic-column')].map(col => col.dataset.topic);
    }

    /* Panolar yan yana durduğu için sıralama YATAY konuma göre yapılır:
       imleç bir panonun sol yarısından soldaysa o panodan ÖNCE, değilse
       sonrakinden önce yerleşir. */
    function movePlaceholder(clientX) {
        const columns = [...board.querySelectorAll('.note-topic-column')]
            .filter(col => col !== draggedColumn);
        const before = columns.find(col => {
            const rect = col.getBoundingClientRect();
            return clientX < rect.left + rect.width / 2;
        });
        if (before) board.insertBefore(placeholder, before);
        else if (columns.length) board.insertBefore(placeholder, columns[columns.length - 1].nextSibling);
        else board.appendChild(placeholder);
    }

    /* Bırakma tamamen başlığın dragend olayında sonuçlanır; böylece
       bırakılmayan bırakmalarda da (Escape, kutu dışına çıkış) sıra
       temizlenir. Burada yalnızca ray üzerindeki her konum geçerli bir
       hedef yapılır ve tarayıcının varsayılan davranışı engellenir. */
    board.addEventListener('dragover', event => {
        if (!draggedColumn) return;
        /* Kart sürüklemesi sırasında bu olay da tetiklenir; yalnızca pano
           başlığından başlayan taşımada devreye girer. */
        if (event.target && event.target.closest && event.target.closest('.note-card-header-drag')) return;
        event.preventDefault();
        try { event.dataTransfer.dropEffect = 'move'; } catch (err) { /* yoksay */ }
        movePlaceholder(event.clientX);
    });

    board.addEventListener('drop', event => {
        if (!draggedColumn) return;
        event.preventDefault();
    });

    /* Sürükleme başlığın dragend olayında sonuçlanır: bırakma, iptal veya
       fare pencerenin dışına çıkma durumlarında da sıra temizlenir. */
    function finalizeColumnDrag() {
        if (!draggedColumn) return;
        /* Yer tutucu hedef konumda bekliyor; taşınan sütun onun yerine geçer. */
        if (placeholder.parentNode) board.insertBefore(draggedColumn, placeholder);
        placeholder.remove();
        draggedColumn.classList.remove('is-column-dragging');
        board.classList.remove('is-column-panning');

        /* Geri alma kaydı, sıra değiştirilmeden ÖNCE alınır. Sıralama kontrolü
           DOM üzerinden yapılır ve henüz kalıcı değildir; bu yüzden kayıt
           önce alınabilir. */
        const didChange = !!beforeOrder && didColumnOrderChange(beforeOrder);
        if (didChange) pushUndoState('Pano taşıma');
        persistNoteBoardColumnOrder();

        draggedColumn = null;
        beforeOrder = null;
        /* Yalnızca gerçekten yer değiştirdiyse yeniden çiz: render, pano
           başlığının düzenlenebilirliğini ve sürükleme tutamaklarını tazeler. */
        if (didChange) renderNotes();
    }

    /* Başlık dinleyicileri sütunlara bağlanır; sütunlar her render'da yeniden
       kurulduğu için bu bağlama renderNotes içinden, her seferinde tazelenir.
       Ortak durum (draggedColumn, placeholder) ray seviyesinde kaldığı için
       iki fonksiyon ayrı ayrı çalışsa da aynı sürükleme üzerinde iş görür. */
    board._noteColumnDrag = {
        begin(column, event) {
            /* Arama sürerken pano listesi kısmen render edilir; o sırayı
               kaydetmek görünmeyen panoları listeden silerdi. */
            if (globalSearchQuery) { event.preventDefault(); return false; }
            draggedColumn = column;
            beforeOrder = currentOrder();
            try {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', column.dataset.topic);
            } catch (err) { /* bazı tarayıcılar setData istemez */ }
            column.classList.add('is-column-dragging');
            placeholder.style.width = `${column.offsetWidth}px`;
            placeholder.style.height = `${column.offsetHeight}px`;
            board.classList.add('is-column-panning');
            return true;
        },
        end: finalizeColumnDrag
    };

    /* Bazı tarayıcılarda sürükleme, dragend'in hedefi değiştirilmiş bir alt
       öğede sonlanabilir; ray seviyesinde bir dragend her halükârda taşımayı
       kapatır (çift tetiklemeden kaçınmak için finalizeColumnDrag, durum
       temizlendikten sonra ikinci çağrıda erken çıkar). */
    board.addEventListener('dragend', () => finalizeColumnDrag());
}

/* Sütun başlıklarına taşıma dinleyicilerini bağlar. renderNotes her
   çağrıldığında sütunları yeniden kurduğu için buraya bağlanır. */
function bindNoteColumnHeaderDrag() {
    const board = document.getElementById('notes-grid');
    if (!board || !board._noteColumnDrag) return;

    board.querySelectorAll('.note-topic-column').forEach(column => {
        const header = column.querySelector('.note-topic-column-header');
        if (!header) return;

        header.addEventListener('dragstart', event => {
            board._noteColumnDrag.begin(column, event);
        });
        header.addEventListener('dragend', () => board._noteColumnDrag.end());
    });
}

/* --- TRELLO TARZI YATAY SÜRÜKLEME (DRAG-TO-SCROLL) -----------------------
   Panolar yatay bir ray üzerinde durduğu için kullanıcı boş bir yere basılı
   tutup çektiğinde tüm pano kaymalıdır. Buradaki kritik ayrım:

     • Başlangıç anında henüz panoya SÜRÜKLENMEDİĞİMİZ belli değildir —
       kullanıcı butona, metne veya karta tıklamak da olabilir. Bu yüzden
       "pan" modu ancak imleç eşik mesafesini (THRESHOLD) aşınca açılır.
     • Aşılmayan küçük hareketler (tıklama, düzenlenebilir başlığa yazma)
       panoyu kaydırmaz, tıklamayı da engellemez.
     • Buton, form alanı, düzenlenebilir başlık ve seçilebilir metin üzerinde
       sürükleme hiç başlamaz: bunların kendi tıklama davranışı korunur.
     • HTML5 kart sürükle-bırak (dragstart/dragover/drop) DOM API'siyle
       çalışır ve bu mousedown dinleyicisiyle çakışmaz; buna rağmen eşik
       kontrolü kart sürüklemesini de yanlışlıkla engellemez.
   */
const NOTE_BOARD_PAN_THRESHOLD = 5;   // px — bunu aşmadan pan moduna girilmez
const NOTE_BOARD_PAN_EDGE = 12;       // px — kenara yaklaşınca kaydırma hızlanır

/* Sürükleme başlarken alınan sırayla, bırakma anındaki sıra aynı mı?
   Aynıysa hiçbir şey değişmemiştir: geri alma yazılmaz, pano yeniden
   çizilmez (gereksiz titremeyi ve odağı kaybetmeyi önler). */
function didColumnOrderChange(before) {
    const board = document.getElementById('notes-grid');
    if (!board || !before || !before.length) return false;
    const after = [...board.querySelectorAll('.note-topic-column')]
        .map(col => col.dataset.topic);
    if (after.length !== before.length) return false;
    return after.some((topic, i) => topic !== before[i]);
}

/* --- PANO SIRASINI KALICI OLARAK YAZ -----------------------------------
   Panoların sırası noteTopics dizisinde tutulur ve getNoteTopics() bunu
   render sırasında olduğu gibi kullanır. Bu yüzden sürükleme sonrası dizi
   yeni sırayla güncellenip kaydedilir; pano adı değişmeden yeri değişir. */
function persistNoteBoardColumnOrder() {
    const board = document.getElementById('notes-grid');
    if (!board) return false;
    const ordered = [...board.querySelectorAll('.note-topic-column')]
        .map(col => col.dataset.topic)
        .filter(Boolean);
    if (!ordered.length) return false;

    /* Arama sürerken yalnızca EŞLEŞEN notların panoları render edilir; bu
       sıradan kayıt yapılırsa görünmeyen panolar listeden düşerdi. */
    if (globalSearchQuery) return false;

    const current = getNoteTopics();
    const sameMembers = ordered.length === current.length && ordered.every(t => current.includes(t));
    if (sameMembers && ordered.every((t, i) => t === current[i])) return false;

    /* Panolar listeye hiç yazılmamışsa (ilk açılışta şablonlar gelir) sıralama
       boşa gitmesin diye mevcut listeyi tamamlarız. */
    if (!(noteTopics || []).length) noteTopics = [...current];
    const merged = [...ordered];
    /* Adı listede olmayan pano varsa (örn. notu olan ama listeye eklenmemiş)
       sona eklenir; aksi hâlde getNoteTopics() o panoyu kayıttan düşürür. */
    current.forEach(t => { if (!merged.includes(t)) merged.push(t); });
    noteTopics = merged;
    saveAllData();
    return true;
}

function initNoteBoardPanning() {
    const board = document.getElementById('notes-grid');
    if (!board || board.dataset.panBound === '1') return;
    board.dataset.panBound = '1';

    let panning = false;      // eşik aşıldı mı
    let armed = false;        // mousedown basıldı, henüz karar verilmedi
    let startX = 0, startY = 0, startScroll = 0;

    /* Bu hedefin üzerinde pano sürüklenmemeli: kullanıcı kendi kontrolüne
       (buton, metin alanı, düzenlenebilir pano başlığı, seçilebilir not
       metni) tıklamak istiyor olabilir. */
    function isInteractive(target) {
        if (!target || !target.closest) return false;
        if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return true;
        /* Not gövdesi seçilebilir metindir; seçim yapmak pano kaydırmayı bozar. */
        if (target.closest('.note-card-body')) return true;
        /* Kart sürükleme tutamacı: HTML5 dragstart kendi eşiğini kullanır.
           Burada pan başlarsa iki sürükleme aynı anda çalışır ve kart
           bırakıldığında pano da kaymış olur. */
        if (target.closest('.note-card-header-drag')) return true;
        /* Pano başlığı KENDİ sürükleme tutamacıdır: HTML5 dragstart'i var.
           Burada pan başlarsa pano başlığından sürükleme imleci çalışmaz ve
           taşıma yerine ray kayar. */
        if (target.closest('.note-topic-column-header')) return true;
        return false;
    }

    board.addEventListener('mousedown', event => {
        /* Yalnızca sol (ana) tuş; sağ tuş menüsü ve orta tuş native scroll
           davranışına dokunulmadan geçsin. */
        if (event.button !== 0) return;
        if (isInteractive(event.target)) return;

        armed = true;
        panning = false;
        startX = event.clientX;
        startY = event.clientY;
        startScroll = board.scrollLeft;
    });

    board.addEventListener('mousemove', event => {
        if (!armed) return;

        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        if (!panning) {
            /* Eşiğe kadar SADECE yatay baskın hareketi sayılır. Kullanıcı
               dikey kaydırma yapıyorsa (iç listeyi geziyorsa) pano kaymaz. */
            if (Math.abs(dx) < NOTE_BOARD_PAN_THRESHOLD) return;
            if (Math.abs(dy) > Math.abs(dx)) { armed = false; return; }
            panning = true;
            board.classList.add('is-panning');
        }

        /* Kenara yaklaştıkça hızlanma: Trello'daki "hassaslık" hissi. */
        let delta = dx;
        const rect = board.getBoundingClientRect();
        const overLeft = startX - rect.left < NOTE_BOARD_PAN_EDGE;
        const overRight = rect.right - event.clientX < NOTE_BOARD_PAN_EDGE;
        if (overLeft || overRight) delta *= 1.4;

        board.scrollLeft = startScroll - delta;
        /* Yatay hareket başladı: tarayıcının kendi metin seçimini engelle. */
        event.preventDefault();
    });

    function endPan() {
        if (panning) board.classList.remove('is-panning');
        armed = false;
        panning = false;
    }
    board.addEventListener('mouseup', endPan);
    /* Fare pencerenin dışına çıkıp geri gelirse "yapışkan" sürükleme olmasın. */
    board.addEventListener('mouseleave', endPan);
    document.addEventListener('mouseup', endPan);
}

/* Yeni pano eklendiğinde pano rayı o panoyu tam hizaya getirir. */
function scrollNoteBoardToColumn(topic) {
    const board = document.getElementById('notes-grid');
    if (!board) return;
    const target = [...board.querySelectorAll('.note-topic-column')]
        .find(col => col.dataset.topic === topic);
    if (!target) return;
    try {
        board.scrollTo({ left: target.offsetLeft - board.offsetLeft, behavior: 'smooth' });
    } catch (e) {
        board.scrollLeft = target.offsetLeft - board.offsetLeft;
    }
}

function openFileModal(id = null) {
    if (id) {
        const f = files.find(x => String(x.id) === String(id));
        document.getElementById('file-modal-title').innerText = "Klasör/Bağlantı Düzenle";
        document.getElementById('form-file-id').value = f.id;
        document.getElementById('form-file-title').value = f.title;
        document.getElementById('form-file-path').value = f.path;
    } else {
        document.getElementById('file-modal-title').innerText = "Yeni Klasör / Bağlantı Ekle";
        document.getElementById('form-file-id').value = '';
        document.getElementById('form-file-title').value = '';
        document.getElementById('form-file-path').value = '';
    }
    document.getElementById('file-modal').classList.add('active');
    _staggerModalBody('file-modal');
}
function closeFileModal() { document.getElementById('file-modal').classList.remove('active'); }

function saveFileEntry() {
    const id = document.getElementById('form-file-id').value;
    const title = document.getElementById('form-file-title').value.trim();
    const path = document.getElementById('form-file-path').value.trim();
    if (!title || !path) return;
    if (id) {
        const f = files.find(x => String(x.id) === String(id));
        if(f) { f.title = title; f.path = path; }
    } else { files.unshift({ id: 'file_' + Date.now(), title, path }); }
    saveAllData(); renderFiles(); closeFileModal();
}
function deleteFileEntry(id) { pushUndoState('Klasör bağlantısı silme'); files = files.filter(f => String(f.id) !== String(id)); saveAllData(); renderFiles(); }

function openFolderPath(path) {
    if (!path || !path.trim()) {
        alert("Lütfen geçerli bir klasör yolu giriniz.");
        return;
    }
    
    let targetPath = path.trim().replace(/^["']+|["']+$/g, '').trim();

    // --- Masaüstü uygulaması (Electron): Explorer/varsayılan uygulama ile aç ---
    if (window.electronAPI && typeof window.electronAPI.openPath === 'function') {
        if (/^https?:\/\//i.test(targetPath)) {
            window.electronAPI.openExternal(targetPath);
            return;
        }
        let desktopPath = targetPath.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, '').trim();
        if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(desktopPath)) {
            window.electronAPI.openExternal('http://' + desktopPath);
            return;
        }
        if (!desktopPath) {
            alert("Lütfen geçerli bir klasör yolu giriniz.");
            return;
        }
        window.electronAPI.openPath(desktopPath).then((r) => {
            if (r && r.error) alert("Klasör açılamadı:\n" + r.error);
        });
        return;
    }

    // --- Internet adresleri (Google Drive / OneDrive / SharePoint) ---
    if (/^https?:\/\//i.test(targetPath)) {
        window.open(targetPath, '_blank', 'noopener');
        return;
    }

    // --- Yerel yol ---
    let localPath = targetPath.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, '').trim();

    // Yerel sunucu adresi (http://localhost:8080/...) ise tarayicida ac
    if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(localPath)) {
        window.open('http://' + localPath, '_blank', 'noopener');
        return;
    }

    if (!localPath) {
        alert("Lütfen geçerli bir klasör yolu giriniz.");
        return;
    }

    // Protokol kurulu degilse kullaniciya yol goster
    const warnTimer = setTimeout(() => {
        alert(
            "Klasör açılamadı.\n\n" +
            "'sepetc://' protokolü kayıtlı görünmüyor.\n" +
            "start.bat dosyasını bir kez çalıştırıp tekrar deneyin."
        );
    }, 2500);

    try {
        // Yolu URL-encoded gonder: sepetc://C%3A%2FProjeler%2F06_Ankara
        window.location.href = 'sepetc://' + encodeURIComponent(localPath);
        window.setTimeout(() => clearTimeout(warnTimer), 1000);
    } catch (err) {
        clearTimeout(warnTimer);
        alert("Klasör açılamadı: " + err.message);
    }
}

function renderFiles() {
    const container = document.getElementById('files-grid');
    if (!container) return;

    if (!files || files.length === 0) { 
        container.innerHTML = '<div style="color:var(--txt-muted); font-size:13.2px;">Henüz bir kayıtlı dosya/klasör bulunmuyor.</div>'; 
        return; 
    }

    container.innerHTML = files.map(f => `
        <div class="file-card-box">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <strong class="file-card-title" onclick="openFolderPath('${escapeJsAttr(f.path)}')">
                    <i class="fa-solid fa-folder-closed" style="color:var(--color-cyan); margin-right:4px;"></i> ${escapeHtml(f.title)}
                </strong>
                <div style="display:flex; gap:4px;">
                    <button class="btn-icon" title="Düzenle" onclick="openFileModal('${f.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon delete" title="Sil" onclick="deleteFileEntry('${f.id}')"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
            <div class="file-card-path">${escapeHtml(f.path)}</div>
            <button class="btn btn-secondary" style="font-size:11.5px; height:26px; margin-top:4px;" onclick="openFolderPath('${escapeJsAttr(f.path)}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> Klasörü / Bağlantıyı Aç</button>
        </div>`).join('');
    _applyStaggerIndex(document.getElementById('files-grid'));
}

/* ---- Günlük görevler: ruh hali merdiveni + tarih gruplama yardımcıları ----
   Kullanıcı isteği: liste bir "time line omurgası" üzerine otursun ve her gün
   kendi emoji mührünü tassın — ilk gün güler yüz, sonra düz yüz, sonra üzgün,
   en zorlu günlerde ağlayan yüz. Merdiven bugüne göre hizalanır: dün "great",
   bugün "ok", yarın "low", miadı geçmiş "hard". Tarih temizlenince grup
   tarihe göre deterministik olarak yeniden hizalanır, veri değişmez. */
const TASK_MOOD_LADDER = {
    great: { emoji: '😀', code: '1f600', name: 'Grinning face' },
    ok:    { emoji: '😐', code: '1f610', name: 'Neutral face' },
    low:   { emoji: '🙁', code: '1f641', name: 'Slightly frowning face' },
    hard:  { emoji: '😢', code: '1f622', name: 'Crying face' }
};

/* Konfeti/kutlama efekti tamamen kaldırıldı: gün kutlaması ve gülümseme
   pop animasyonu artık yok. Görev tamamlama yalnızca checkbox +
   strike-through ile belli olur. */
function getTaskMoodForDate(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    if (!dateStr) return TASK_MOOD_LADDER.ok;
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return TASK_MOOD_LADDER.ok;
    const target = new Date(parts[0], parts[1] - 1, parts[2]);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target - today) / dayMs);
    if (diff < 0) return TASK_MOOD_LADDER.hard;
    if (diff === 0) return TASK_MOOD_LADDER.ok;
    if (diff === 1) return TASK_MOOD_LADDER.great;
    return TASK_MOOD_LADDER.low;
}

function formatTaskDayLabel(dateStr) {
    if (!dateStr) return 'Tarihsiz';
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return escapeHtml(dateStr);
    const labels = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return `${d.getDate()} ${labels[d.getDay()]}`;
}

function isTaskDayToday(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = String(dateStr || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return false;
    const target = new Date(parts[0], parts[1] - 1, parts[2]);
    target.setHours(0, 0, 0, 0);
    return target.getTime() === today.getTime();
}

function groupTasksByDay(taskList) {
    const groups = [];
    const index = new Map();
    taskList.forEach(t => {
        const key = t.date || '';
        if (!index.has(key)) {
            const mood = getTaskMoodForDate(key);
            index.set(key, {
                key,
                moodKey: Object.keys(TASK_MOOD_LADDER).find(k => TASK_MOOD_LADDER[k] === mood) || 'ok',
                mood,
                items: []
            });
            groups.push(index.get(key));
        }
        index.get(key).items.push(t);
    });
    /* Günler en yeniden en eskiye sıralanır: bugün (örn. cumartesi) listenin
       en üstünde, dün ve öncesi altında. Tarihsiz grup en sona düşer. */
    groups.sort((x, y) => (y.key || '0000-00-00').localeCompare(x.key || '0000-00-00'));
    return groups;
}

/* Seri (streak) hesabi: yalnizca mevcut gorev verisinden turetilir, ekstra
   kayit gerektirmez. "Basarili gun" = o tarihteki tum gorevler tamamlanmis.
   Arastirmada kirilan serinin motivasyonu dustugu goruldugu icin hesap
   affedicidir: gorev girilmeyen gunler seriyi kirmez. */
function computeTaskStreak() {
    const byDay = new Map();
    (tasks || []).forEach(t => {
        const k = t.date || '';
        if (!k) return;
        if (!byDay.has(k)) byDay.set(k, { total: 0, done: 0 });
        const d = byDay.get(k);
        d.total++;
        if (t.completed) d.done++;
    });
    const okDays = new Set();
    byDay.forEach((v, k) => { if (v.total > 0 && v.done === v.total) okDays.add(k); });
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayKey = fmt(new Date());
    let current = 0;
    if (okDays.has(todayKey)) current++;
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - 1);
    while (okDays.has(fmt(cursor))) { current++; cursor.setDate(cursor.getDate() - 1); }
    const todayStat = byDay.get(todayKey) || { total: 0, done: 0 };
    return { current, todayTotal: todayStat.total, todayDone: todayStat.done, todayComplete: todayStat.total > 0 && todayStat.done === todayStat.total };
}

function updateStreakChip() {
    const chip = document.getElementById('todo-streak-chip');
    if (!chip) return;
    const s = computeTaskStreak();
    const countEl = document.getElementById('todo-streak-count');
    if (countEl) countEl.textContent = s.current > 0 ? `${s.current} gün seri` : 'seri yok';
    chip.classList.toggle('is-hot', s.current > 0);
    /* Kayip kacinmasi durtusu: seri varsa ve bugun henuz bitmediyse nazik uyari. */
    chip.classList.toggle('is-at-risk', s.current > 0 && !s.todayComplete);
    chip.title = s.current > 0
        ? (s.todayComplete ? 'Harika! Bugün de tamamlandı, seri devam ediyor.' : `Seri devam etsin: bugünün ${s.todayTotal - s.todayDone} görevini tamamla!`)
        : 'Üst üste tamamlanan günler serini oluşturur. Bir günün tüm görevlerini bitirerek başla!';
}

function renderDailyTasks() {
    const container = document.getElementById('todo-list-container');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div style="color:var(--txt-muted); font-size:13.2px; text-align:center; padding:10px;">Bugün için kayıtlı görev yok.</div>';
        return;
    }

    const visible = getTasksMatchingSearch();
    if (globalSearchQuery && visible.length === 0) {
        container.innerHTML = `<div style="color:var(--txt-muted); font-size:13.2px; text-align:center; padding:10px;">Aramanızla eşleşen görev bulunamadı.</div>`;
        return;
    }

    /* "Klasik timeline" (demo şablonu): merkezde dikey çizgi, her günün
       düğümü çizgi üzerinde (animasyonlu emoji + ilerleme halkası), günün
       kartı dönüşümlü sağa/sola üçgen okla bağlanır. Renk durumu: bugün
       yeşil (aktif), tamamlanmış gri, bekleyen kırmızımsı. */
    const groups = groupTasksByDay(visible);
    container.className = 'todo-list is-tl';
    container.innerHTML = groups.map((g, gi) => {
        const isToday = isTaskDayToday(g.key);
        const isDone = g.items.length > 0 && g.items.every(x => x.completed);
        const stateCls = isToday ? 'st-active' : (isDone ? 'st-done' : 'st-pending');
        /* Bugünün kartı, kayan ışık (border beam) efektini alır. Efekt
           yalnızca .tl-card::after üzerinden çizilir; kartın oku
           (.tl-card::before) bu yüzden bozulmaz. */
        const todayCls = isToday ? ' st-today' : '';
        /* Çember (düğüm) durumu: hepsi yapıldıysa YEŞİL + yeşil pulse; yapılmamış
           iş var ama önemli yapılmamış yoksa SARI pulse; önemli (⚡/⭐) yapılmamış
           görev varsa KIRMIZI pulse. */
        const hasImportantPending = g.items.some(x => !x.completed && isImportantTask(x));
        const pulseCls = isDone ? ' np-done' : (hasImportantPending ? ' np-important' : ' np-normal');
        const sideCls = (gi % 2 === 0) ? 'side-r' : 'side-l';
        const moodMeta = isDone ? TASK_MOOD_LADDER.great : g.mood;
        const doneCount = g.items.filter(x => x.completed).length;
        /* Ilerleme halkasi: dolu kisim = tamamlanan orani (hedef gradyani). */
        const ringP = g.items.length ? doneCount / g.items.length : 0;
        const RING_C = (2 * Math.PI * 21).toFixed(1);
        const ringOff = (2 * Math.PI * 21 * (1 - ringP)).toFixed(1);
        const items = g.items.map(t => {
            const isImportant = isImportantTask(t);
            return `
                    <div class="todo-item ${t.completed ? 'completed row-done' : ''} ${isImportant ? 'priority-important' : ''}" draggable="true" data-task-id="${t.id}" title="Başka bir güne taşımak için sürükleyin">
                        <div class="todo-checkbox" onclick="toggleTaskStatus('${t.id}')">
                            <i class="fa-solid fa-check"></i>
                        </div>
                        <span class="todo-emoji-tag" title="Görevin ilk yazıldığı tarih: ${escapeHtml(formatTaskWrittenDateLabel(getTaskWrittenDate(t)))}">${t.emoji || '📌'} ${escapeHtml(formatTaskWrittenDateLabel(getTaskWrittenDate(t)))}</span>
                        <span class="todo-text" style="flex:1;"><span class="strike">${highlightSearchMatch(t.text)}</span></span>
                        <div style="display:flex; gap:4px;">
                            <button class="btn-icon" title="Düzenle" onclick="startEditTask('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-icon delete" title="Sil" onclick="deleteTask('${t.id}')"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                `;
        }).join('');
        return `
            <div class="tl-group ${stateCls} ${sideCls}" data-mood="${g.moodKey}">
                <div class="tl-node${isDone ? ' is-complete' : ''}${pulseCls}" title="${escapeHtml(g.key ? 'Güne ait tüm görevleri işaretle / temizle' : 'Görev listesi')}" onclick="handleDayEmojiClick('${escapeJsAttr(g.key || 'none')}')">
                    <div class="todo-day-anim" data-lottie="${moodMeta.code}"><span class="fallback">${moodMeta.emoji}</span></div>
                    <svg class="tl-ring" viewBox="0 0 48 48" aria-hidden="true"><circle class="ring-track" cx="24" cy="24" r="21"></circle><circle class="ring-progress" cx="24" cy="24" r="21" style="stroke-dasharray:${RING_C}; stroke-dashoffset:${ringOff};"></circle></svg>
                </div>
                <div class="tl-card${todayCls}">
                    <div class="tl-head">
                        <span class="tl-day-badge${isToday ? ' is-today' : ''}">${formatTaskDayLabel(g.key)}</span>
                        <span class="tl-count">${doneCount}/${g.items.length} görev</span>
                        <span class="tl-head-spacer"></span>
                    </div>
                    <div class="tl-tasks" data-day="${escapeHtml(g.key)}">${items}</div>
                </div>
            </div>
        `;
    }).join('');
    updateStreakChip();
    mountDayLottieEmojis(document);
}

/* Noto animasyonlu emoji (Lottie) baglayicisi: container icindeki
   [data-lottie] kutularina Google'in resmi animasyonlarini yukler.
   Yuzler kendileri hareket eder (goz kirpir, nefes alir) ama yerlerinde
   sabit durur — donme/sallanma yok, bas dondurmez. Kitaplik yuklenmediyse
   veya animasyon indirilemezse kutuya dokunulmaz; icindeki duz emoji
   (fallback) gorunur kalir. Ayni emoji tek kez indirilip paylasilir. */
const _dayLottieCache = new Map();
const _dayLottiePending = new Map();

function fetchDayLottieJson(code) {
    if (_dayLottieCache.has(code)) return Promise.resolve(_dayLottieCache.get(code));
    if (_dayLottiePending.has(code)) return _dayLottiePending.get(code);
    const p = fetch(`https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/lottie.json`)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(json => { _dayLottieCache.set(code, json); _dayLottiePending.delete(code); return json; })
        .catch(() => { _dayLottiePending.delete(code); return null; });
    _dayLottiePending.set(code, p);
    return p;
}

function mountDayLottieEmojis(container) {
    if (!container || typeof lottie === 'undefined' || typeof fetch === 'undefined') return;
    container.querySelectorAll('.todo-day-anim[data-lottie]').forEach(box => {
        if (box.dataset.lottieMounted) return;
        box.dataset.lottieMounted = '1';
        const code = box.dataset.lottie;
        fetchDayLottieJson(code).then(json => {
            if (!json || !box.isConnected) return;
            try {
                lottie.loadAnimation({ container: box, renderer: 'svg', loop: true, autoplay: true, animationData: json });
                box.classList.add('has-anim');
            } catch (e) { /* sessizce duz emojide kal */ }
        });
    });
}

/* Gün mührüne (emojiye) tıklanınca o gün toplu işaretlenir: hepsi bitmemişse
   tüm görevler tamamlanır, hepsi bitmişse işaretleri kaldırılıp gün yeniden
   "yaşanacak" hale gelir. Tek undo kaydı ile geri alınır. */
function handleDayEmojiClick(dayKeyRaw) {
    const dayKey = dayKeyRaw === 'none' ? '' : dayKeyRaw;
    const dayTasks = tasks.filter(x => (x.date || '') === dayKey);
    if (dayTasks.length === 0) return;
    const allDone = dayTasks.every(x => x.completed);
    pushUndoState(allDone ? 'Günü işaretten kaldırma' : 'Günü tamamlama');
    dayTasks.forEach(x => { x.completed = !allDone; });
    saveAllData();
    renderDailyTasks();
    updateGlobalCounts();
}

function handleTaskKeyPress(e) {
    if (e.key === 'Enter') addOrUpdateTask();
}

function addOrUpdateTask() {
    const date = document.getElementById('todo-input-date').value;
    const emoji = document.getElementById('todo-input-emoji').value;
    const textInput = document.getElementById('todo-input-text');
    const text = textInput.value.trim();

    if (!text) return;

    if (editingTaskId) {
        const t = tasks.find(x => String(x.id) === String(editingTaskId));
        if (t) {
            t.date = date;
            t.emoji = emoji;
            t.text = text;
        }
        editingTaskId = null;
    } else {
        tasks.unshift({
            id: 'task_' + Date.now(),
            date,
            emoji,
            text,
            completed: false
        });
    }

    textInput.value = '';
    saveAllData();
    renderDailyTasks();
    updateGlobalCounts();
}

function startEditTask(id) {
    const t = tasks.find(x => String(x.id) === String(id));
    if (!t) return;
    editingTaskId = t.id;
    if (t.date) document.getElementById('todo-input-date').value = t.date;
    if (t.emoji) document.getElementById('todo-input-emoji').value = t.emoji;
    document.getElementById('todo-input-text').value = t.text;
    document.getElementById('todo-input-text').focus();
}

function toggleTaskStatus(id) {
    const t = tasks.find(x => String(x.id) === String(id));
    if (t) {
        pushUndoState('Görev durumu');
        t.completed = !t.completed;
        saveAllData();
        renderDailyTasks();
        updateGlobalCounts();
    }
}

function deleteTask(id) {
    pushUndoState('Görev silme');
    tasks = tasks.filter(x => String(x.id) !== String(id));
    saveAllData();
    renderDailyTasks();
    updateGlobalCounts();
}

function clearCompletedTasks() {
    pushUndoState('Tamamlananları temizleme');
    tasks = tasks.filter(x => !x.completed);
    saveAllData();
    renderDailyTasks();
    updateGlobalCounts();
}

/* --- Günler arası görev taşıma (sürükle-bırak) -----------------------------
   Kullanıcı bir görev satırını tutup başka bir günün görev kutusuna
   bıraktığında görevin tarihi değişir; undo ile geri alınabilir. HTML5
   Drag&Drop API: dragstart ile satır kimliği yakalanır, tl-tasks
   kutularının üstünde data-day hedef günü verir. Dinleyiciler
   delege edildiği için render sonrası yeniden bağlamaya gerek yoktur. */
let _draggingTaskId = null;

function initTaskDayDragDrop() {
    const container = document.getElementById('todo-list-container');
    if (!container || container.dataset.ddBound === '1') return;
    container.dataset.ddBound = '1';

    container.addEventListener('dragstart', e => {
        const row = e.target.closest('.todo-item[data-task-id]');
        if (!row) return;
        _draggingTaskId = row.dataset.taskId;
        row.classList.add('dragging');
        try { e.dataTransfer.setData('text/plain', _draggingTaskId); } catch (err) { /* bazı tarayıcılar setData istemez */ }
        e.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragend', () => {
        _draggingTaskId = null;
        container.querySelectorAll('.todo-item.dragging').forEach(el => el.classList.remove('dragging'));
        container.querySelectorAll('.tl-tasks.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
    });

    container.addEventListener('dragover', e => {
        const list = e.target.closest('.tl-tasks[data-day]');
        if (!list || !_draggingTaskId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.querySelectorAll('.tl-tasks.is-drag-over').forEach(el => { if (el !== list) el.classList.remove('is-drag-over'); });
        list.classList.add('is-drag-over');
    });

    container.addEventListener('drop', e => {
        const list = e.target.closest('.tl-tasks[data-day]');
        if (!list || !_draggingTaskId) return;
        e.preventDefault();
        list.classList.remove('is-drag-over');
        const id = _draggingTaskId;
        const targetDay = list.dataset.day || '';
        _draggingTaskId = null;
        moveTaskToDay(id, targetDay);
    });
}

function moveTaskToDay(taskId, targetDay) {
    const t = tasks.find(x => String(x.id) === String(taskId));
    if (!t) return;
    const currentDay = t.date || '';
    if (currentDay === targetDay) return;
    pushUndoState('Görevi başka güne taşıma');
    t.date = targetDay;
    saveAllData();
    renderDailyTasks();
    updateGlobalCounts();
}

/* Önemli görev: yüksek öncelik (⚡, eski veriler) veya önemli (⭐) etiketli
   görevler. Çemberin kırmızı pulse kararı bu tanımı kullanır; gece yarısı
   devri ise yalnızca ⭐ rozetli işleri taşır (o fonksiyonda ayrı kontrol). */
function isImportantTask(task) {
    return !!task && (task.emoji === '⚡' || task.emoji === '⭐');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* onclick="fn('...')" icinde guvenli kullanilacak deger uretir.
   Sirasiyla: JS kaçislari (\\ ve '), sonra HTML oznitelik kaçislari.
   Boylece O'Brien gibi yollar onclick degerini bozmaz. */
function escapeJsAttr(str) {
    if (str === null || str === undefined) return '';
    return escapeHtml(String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

/* ==========================================================================
   KAYIT KİMLİĞİ (record id) GÜÇLENDİRME
   --------------------------------------------------------------------------
   Kayıt kimlikleri (j.id, t.id, n.id, f.id) 20'den fazla onclick
   özniteliğine doğrudan gömülüyor. Kimlikler uygulama içinde üretiliyor
   (job_<time>_<rand>, note_<time>, task_<time>) ama İKİ dış yol var:

     1. Excel içe aktarma  — "Sistem ID" hücresi olduğu gibi kimlik oluyor.
     2. Yedek JSON içe aktarma — data.jobs içindeki id alanı doğrulanmadan
        doğrudan atanıyor.

   Her ikisi de kullanıcı kontrolünde olsa da (kendi dosyasını içe aktarıyor)
   buradaki amaç BÜTÜNLÜK ve tahmin edilebilirlik: kimliğe tırnak, backslash
   ya da HTML kapanış etiketi benzeri bir dizi girmesin.

   NOT: Bu yorum bloğunda bilerek bir kapanış script etiketi YAZILMAZ.
   HTML parser, bir script bloğunun içinde gördüğü ilk kapanış etiketini
   gerçek kapanış sanar ve betiği tam orada keser.

   safeRecordId() bir değerin güvenli kimlik olup olmadığını DENETLER; geçerli
   değilse yeni bir kimlik üretir. Bozuk kaydın kimliği değişir ama kayıt
   kaybolmaz — veri korunur, yalnızca kimlik normalize edilir.
   ========================================================================== */

/* Güvenli kimlik: harf, rakam, _ ve - dışında hiçbir karakter içermez.
   Bu karakter seti hiçbir kaçış veya HTML bağlamı için sorun çıkarmaz. */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/* Uygulama içinde üretilen benzersiz kimlik. */
function makeRecordId(prefix) {
    return String(prefix || 'rec') + '_' + Date.now().toString(36) + '_' +
           Math.random().toString(36).slice(2, 8);
}

/* Değer geçerli bir kayıt kimliğiyse aynen döner; değilse yeni bir tane
   üretir. Kullanıcının girdiği ID'yi korumaya çalışır ama güvenli değilse
   reddeder — sessizce yutulmaz, yeni kimlik atanır. */
function safeRecordId(value, prefix) {
    if (value === null || value === undefined) return makeRecordId(prefix);
    const s = String(value).trim();
    if (SAFE_ID_RE.test(s)) return s;
    return makeRecordId(prefix);
}

/* Bir dizi içindeki tüm kayıtların id'sini güvenli hale getirir.
   Import noktalarında tek çağrıyla tüm listeyi korur. */
function sanitizeRecordIds(list, prefix) {
    if (!Array.isArray(list)) return list;
    const seen = new Set();
    list.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const safe = safeRecordId(item.id, prefix);
        /* Çakışma varsa yeniden üret: yinelenen id, iki kaydı birbirine
           bağlar ve birinin açılması yanlış kaydı gösterir. */
        if (seen.has(safe)) {
            item.id = makeRecordId(prefix);
        } else {
            item.id = safe;
        }
        seen.add(item.id);
    });
    return list;
}
/* --- Görev tarih yardımcıları ------------------------------------------------
   normalizeTaskDates(list): listedeki her göreve `createdDate` alanını garanti
   eder. Eski kayıtlarda alan yoksa `date` kopyalanır; geçersiz/boş `date`
   için bugünün anahtarı kullanılır. Idempotenttir (var olan createdDate'a
   dokunmaz), bu yüzden her açılışta ve her JSON içe aktarmada güvenle çağrılabilir.
   getTaskWrittenDate(task): görevin ORIJINAL yazılma tarihi (createdDate,
   yoksa date, yoksa bugün). Sabit okunur — hiçbir akışta değiştirilmez. */
function taskDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function normalizeTaskDates(list) {
    const todayKey = taskDateKey();
    (list || []).forEach(t => {
        if (!t) return;
        if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) t.date = todayKey;
        if (typeof t.createdDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.createdDate)) t.createdDate = t.date;
    });
}
function getTaskWrittenDate(task) {
    if (!task) return taskDateKey();
    const d = task.createdDate;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    if (typeof task.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.date)) return task.date;
    return taskDateKey();
}
/* Görev kartındaki tarih etiketi: ISO biçimini korur (2026-10-02 gibi), çünkü
   kart içinde kısa "7 Pazar" değil tam gün bilgisi aranır. Geçersiz/boş değer
   için "Tarihsiz" yazar. Çıktı escapeHtml'den geçer. */
function formatTaskWrittenDateLabel(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return 'Tarihsiz';
    return String(dateStr);
}

/* --- Görev tarih anlamları: `date` vs `createdDate` --------------------------
   Artık İKİ ayrı tarih vardır ve karıştırılmamalıdır:
     • t.date        → GÖREVİN GÜNÜ. Gruplama, sıralama, zaman çizgisi kutusu,
                       sürükle-bırak hedefi, streak hesabı ve gece devrinin
                       taşıma hedefi BU ALANI kullanır. Değişebilir (kullanıcı
                       görevi başka güne sürükleyebilir).
     • t.createdDate → ORIJINAL YAZILMA TARIHİ. Hiçbir akış tarafından
                       değiştirilmez; sabit "ilk yazıldığı gün" bilgisidir.
                       Dashboard'daki "X gündür bekliyor" metni ve günlük
                       görev kartındaki tarih etiketi BU ALANI okur.
   Geçmiş veri uyumu: createdDate yoksa date kopyalanır (eski kayıtların yazılma
   tarihi = kendi günü). Böylece geçmişte devirle bugüne taşınmış ⭐ görevlerde
   orijinal gün bilgisi kayıp olsa da createdDate ataması bir daha taşımaya
   izin vermez (damga + t.date >= todayKey koruması). */

/* --- ⭐ Önemli görevlerde "geçmişte sıkışma" kuralı (TEK UYGULAMA NOKTASI)
   Kural: YAPILMAMIŞ bir ⭐ Önemli görevin günü geçmişte kalmaz. Görev bugüne
   taşınır; ⚡/📌 görevler kendi gününde kalır, tamamlananlar taşınmaz.

   Kural iki yerden çağrılır:
     1) runMidnightTaskRollover → gece 00:00'da (günde en fazla 1 kez)
     2) renderDashTodayPanel   → her panel çiziminde (TELAFİ)

   Neden telafi gerekiyor: günlük devir bir kez çalışır ve damgasını (stamp)
   yazar. Kullanıcı o günün içinde ⭐ görevi BİLİNÇLİ olarak dün tarihine
   çekerse (Görevler ekranındaki tarih alanı veya sürükle-bırak), o günün
   devir bütçesi harcanmış olduğu için görev bir daha taşınmaz ve
   "Bugünkü İşler" panelinde hiç görünmezdi. Telafi bu boşluğu kapatır ve
   "dünden kalan önemli işler her zaman yansır" kuralını kalıcı kılar.

   İDEMPOTENTTİR: taşınan görevlerin tarihi bugün olduğu için ikinci çağrıdan
   itibaren filtre boş döner; aynı görev asla iki kez sayılmaz.

   createdDate BİLEREK değiştirilmez: görev bugüne taşınır ama orijinal yazılma
   günü korunur; "X gündür bekliyor" metni ve günlük görev kartındaki tarih
   etiketi bu sayede ezilmez. */
/* Bugün (2026-10-10 gibi) otomatik olarak taşınan ⭐ görevlerin id'leri.
   Böylece aynı görev hem gece devri hem panel telafisi tarafından iki kez
   sayılmaz; ayrıca kullanıcı taşımayı geri alırsa görev eski gününde kalır
   ve render sırasında yeniden taşınmaz. Uygulama yeniden açıldığında liste
   sıfırlanır ve gece deviri zaten damgasını yazmış olduğu için telafi
   görevi bir kez daha taşır — yani kayıt kalıcı bir kısıt değil, yalnızca
   aynı oturum içindeki çift taşımayı ve geri almayı bozmayı önler. */
const _carriedImportantIds = new Set();

function carryOverdueImportantTasks() {
    const todayKey = taskDateKey();
    const carried = (tasks || []).filter(t =>
        t && !t.completed && t.emoji === '⭐' &&
        typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
        t.date < todayKey &&
        /* Bugün zaten otomatik taşınmış görev tekrar taşınmaz: geri al (Ctrl+Z)
           yapıldığında görev eski gününe döner ve telafi onu anında yeniden
           taşıyarak geri alma işlemini görünmez kılardı. */
        !_carriedImportantIds.has(t.id)
    );
    if (carried.length === 0) return 0;
    carried.forEach(t => { t.date = todayKey; _carriedImportantIds.add(t.id); });
    return carried.length;
}

/* --- Gece yarısı (00:00) otomatik gün devri --------------------------------
   Kural: yalnızca "⭐ Önemli" rozetli ve YAPILMAMIŞ görevler, tarihi geçmiş
   günlerde kaldıysa gece 00:00'da otomatik olarak yeni güne (bugüne) taşınır
   (bkz. carryOverdueImportantTasks). ⚡/📌 gibi diğer tüm işler kendi
   gününde kalır. Tamamlanmış görevler de asla taşınmaz. Veri telafisi günde
   en fazla bir kez yapılır (yaser_v10_task_rollover_day damgası ile). Sayfa
   gece boyunca açıksa 00:00'a hizalanmış zamanlayıcı değişimi anında yakalar;
   kapalıydıysa ilk açılışta eksik telafi edilir. Taşıma sonrası yumuşak bir
   bildirim gösterilir (panelde toast yok, alert geceye yakışmaz). */
function runMidnightTaskRollover(showNotice) {
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const now = new Date();
    const todayKey = fmt(now);
    let stamp = null;
    try { stamp = localStorage.getItem('yaser_v10_task_rollover_day'); } catch (e) { /* depo kapalıysa damgasız devam */ }
    if (stamp === todayKey) return 0;

    const movedCount = carryOverdueImportantTasks();
    try { localStorage.setItem('yaser_v10_task_rollover_day', todayKey); } catch (e) { /* damga yazılamazsa bir dahaki açılışta tekrar denenir (idempotent) */ }
    if (movedCount > 0 && typeof pushUndoState === 'function') {
        pushUndoState(`Gece devri: ${movedCount} görev bugüne taşındı`);
        saveAllData();
        renderDailyTasks();
        updateGlobalCounts();
        if (showNotice) showTaskRolloverNotice(movedCount);
    }
    return movedCount;
}

/* Gece yarısı izleyicisi: 30 sn'lik kalıcı döngü yerine, gece yarısına HİZALANMIŞ
   tek zamanlayıcı: her tikte kendini ertesi 00:00'a +1 sn payla re-programlar.
   Böylece günde 2880 boş uyanma yerine yalnızca gün değişiminde 1 kez çalışır
   (CPU/pil dostu). Sekme arka plandayken timer gecikse bile sekme dönüşünde
   visibilitychange ile gün karşılaştırması anında yapılır. */
let _midnightTimerId = null;
let _midnightLastDate = null;
function _checkMidnightRollover() {
    const today = new Date().toDateString();
    if (_midnightLastDate === null) { _midnightLastDate = today; return; }
    if (today !== _midnightLastDate) {
        _midnightLastDate = today;
        runMidnightTaskRollover(true);
    }
}
function _scheduleNextMidnightCheck() {
    if (_midnightTimerId) clearTimeout(_midnightTimerId);
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 500);
    _midnightTimerId = setTimeout(() => { _checkMidnightRollover(); _scheduleNextMidnightCheck(); }, Math.max(1000, nextMidnight - now));
}
function startMidnightTaskWatcher() {
    _checkMidnightRollover();
    _scheduleNextMidnightCheck();
    if (!window.__midnightVisBound) {
        window.__midnightVisBound = true;
        document.addEventListener('visibilitychange', () => { if (!document.hidden) _checkMidnightRollover(); });
    }
}

/* Devir bildirimi: sağ altta belirir, 8 sn sonra kendiliğinden kapanır. */
function showTaskRolloverNotice(count) {
    document.querySelectorAll('.task-rollover-notice').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'task-rollover-notice';
    el.title = 'Tıklayınca kapanır';
    el.innerHTML = `<i class="fa-solid fa-moon"></i><span>${count} ⭐ önemli görev yeni güne otomatik taşındı</span>`;
    el.addEventListener('click', () => {
        el.classList.add('is-leaving');
        setTimeout(() => el.remove(), 360);
    });
    document.body.appendChild(el);
    setTimeout(() => {
        if (!el.isConnected) return;
        el.classList.add('is-leaving');
        setTimeout(() => el.remove(), 360);
    }, 8000);
}
/* ==========================================================================
   HOME 2x2 DASHBOARD PANELLERİ — VERİ MOTORU
   --------------------------------------------------------------------------
   Mevcut veri kaynaklarını (jobs, activeJobIds, tasks, getMissingInfoDetails)
   okur; ana ekrandaki dört paneli besler. Durum rozetleri getStatusBadgeClass()
   ile aynı kurumsal paleti kullanır (mb-* sınıfları).
   ========================================================================== */
function getMiniBadgeClass(asama) {
    return 'mb-' + getStatusBadgeClass(asama).replace(/^status-/, '');
}

function renderDashActivePanel() {
    const rowsEl = document.getElementById('dash-active-rows');
    if (!rowsEl) return;

    /* --- Başlık özet istatistikleri: "8 İş | 4 Proje %50 | 3 İhale %38 ..." ---
       Sayımlar mevcut getStatusBadgeClass() eşlemesi üzerinden yapılır; aşaması
       Proje/İhale/Yapım dışında olan işler özet rozetlerinde sayılmaz. */
    const totalEl = document.getElementById('das-total-count');
    const chipProje = document.getElementById('das-chip-proje');
    const chipIhale = document.getElementById('das-chip-ihale');
    const chipYapim = document.getElementById('das-chip-yapim');

    const strActiveIds = activeJobIds.map(String);
    const activeList = jobs.filter(j => strActiveIds.includes(String(j.id)));

    let nProje = 0, nIhale = 0, nYapim = 0;
    activeList.forEach(j => {
        const cls = getStatusBadgeClass(j.asama);
        if (cls === 'status-proje') nProje++;
        else if (cls === 'status-ihale') nIhale++;
        else if (cls === 'status-yapim') nYapim++;
    });
    const pct = (n) => (activeList.length > 0 ? Math.round((n / activeList.length) * 100) : 0);
    if (totalEl) totalEl.textContent = String(activeList.length);
    const setChip = (el, n) => {
        if (!el) return;
        el.hidden = (n === 0);
        if (n > 0) el.innerHTML = n + ' ' + el.dataset.label + ' <span class="das-pct">%' + pct(n) + '</span>';
    };
    setChip(chipProje, nProje);
    setChip(chipIhale, nIhale);
    setChip(chipYapim, nYapim);

    if (activeList.length === 0) {
        rowsEl.innerHTML = '<div class="dash-empty"><i class="fa-solid fa-bolt"></i><span>Aktif iş seçilmedi. Sağ üstteki + ile iş ekleyin.</span></div>';
        return;
    }

    /* Aşama önceliği: Proje > İhale > Yapım; diğer aşamalar listenin sonunda kalır.
       Aynı öncelikteki işler mevcut sıralarını korur (kararsız sort bozulmaz). */
    const stageRank = (asama) => {
        const cls = getStatusBadgeClass(asama);
        if (cls === 'status-proje') return 0;
        if (cls === 'status-ihale') return 1;
        if (cls === 'status-yapim') return 2;
        return 3;
    };
    const sortedList = activeList.slice().sort((a, b) => stageRank(a.asama) - stageRank(b.asama));

    rowsEl.innerHTML = sortedList.map(j => {
        const isMissing = checkJobMissingInfo(j);
        /* Altındaki "il / ilçe • son timeline notu" bilgi satırı (.aj-sub)
           kaldırıldı; iş adı uzun olduğunda ikinci satıra kendiliğinden sarar.
           Satıra tıklamak iş kaydı düzenleme modalını açar. */
        return `
        <div class="aj-row" onclick="openJobModal('${j.id}')" title="${escapeJsAttr(j.is_tanimi)}">
            <div class="aj-main">
                <span class="aj-name">${escapeHtml(j.is_tanimi)}</span>
            </div>
            <div class="aj-status">
                <span class="mini-badge ${getMiniBadgeClass(j.asama)}">${escapeHtml(j.asama)}${isMissing ? ' <i class="fa-solid fa-circle-exclamation" title="Eksik bilgi var"></i>' : ''}</span>
            </div>
            <div class="aj-actions" onclick="event.stopPropagation();">
                <!-- Göz (Detay) butonu kaldırıldı: kayda tıklamak zaten iş kaydının
                     düzenleme modalını açıyor, ayrı bir detay butonu gereksizdi.
                     Satırın tamamı tıklanabilir olduğu için kısayol korunur. -->
                <button class="btn-icon delete" title="Aktif Listeden Çıkar" onclick="event.stopPropagation(); removeActiveJob('${j.id}')"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>`;
    }).join('');
}
/* --- VERİ TAMAMLAMA PANELİ: eksik bilgili işlerin listesi -------------------
   Her satır bir iş kaydıdır; eksik alanlar kırmızı etiketlerle gösterilir.
   Satıra tıklayınca doğrudan iş kaydı düzenleme modalı açılır; özet görünüm
   ve "N alan" sayacı kaldırıldı çünkü ikisi de aynı modalı açıyordu. --- */
function renderDashDataPanel() {
    const rowsEl = document.getElementById('dash-dc-rows');
    const chipEl = document.getElementById('dash-missing-chip');

    /* Kayıt başına eksik alan sayısı (tek geçiş). */
    const withMissing = [];
    jobs.forEach(j => {
        const details = getMissingInfoDetails(j);
        if (details.length > 0) withMissing.push({ job: j, details });
    });
    if (chipEl) chipEl.textContent = withMissing.length + ' eksik';
    if (!rowsEl) return;

    if (withMissing.length === 0) {
        rowsEl.innerHTML = '<div class="dash-empty"><i class="fa-solid fa-circle-check" style="color:var(--color-emerald); opacity:1;"></i><span>Tüm kayıtlar eksiksiz.</span></div>';
        return;
    }

    /* En çok eksik alanı olan işler en üstte. */
    withMissing.sort((a, b) => b.details.length - a.details.length);
    rowsEl.innerHTML = withMissing.map(item => {
        const j = item.job;
        /* En fazla 2 eksik alan etiketi gösterilir, kalanı "+N" olarak kısaltılır (tam liste title'da). */
        const shown = item.details.slice(0, 2);
        const hidden = item.details.length - shown.length;
        const tags = shown.map(d => `<span class="dc-tag"><i class="fa-solid fa-circle-exclamation"></i>${escapeHtml(d)}</span>`).join('')
            + (hidden > 0 ? `<span class="dc-tag dc-tag-more">+${hidden}</span>` : '');
        /* Satıra tıklamak artık iş ÖZETİ değil, doğrudan iş kaydı düzenleme
           modalını açar (openJobModal) — kullanıcı eksik alanı orada görüp
           doldurur. Bu yüzden hem "N alan" sayacı hem de anahtar (wrench)
           simgesi kaldırıldı: ikisi de aynı işi yapıyordu. */
        return `
        <div class="dc-row" onclick="openJobModal('${j.id}')" title="${escapeJsAttr(item.details.join(' • '))}">
            <div class="dc-main">
                <span class="dc-name">${escapeHtml(j.is_tanimi)}</span>
            </div>
            <div class="dc-badges">${tags}</div>
        </div>`;
    }).join('');
}
/* --- DEADLINE PANELİ: Proje aşamasındaki işlerin süre dolumu --------------
   Panel yalnız `start_date` VE `end_date` dolu, aşaması "Proje" olan işleri
   gösterir; eksik tarihli kayıtlar kasıtlı olarak listelenmez (veri kaybolmaz,
   yalnız çubuk çizilmez). Sıralama: en yakın teslim tarihi en üstte — yani
   acil olan "göze çarpar". Kart tıklanınca iş kaydı düzenleme modalı açılır. */
function renderDashDeadlinePanel() {
    const rowsEl = document.getElementById('dash-deadline-rows');
    const chipEl = document.getElementById('dash-deadline-chip');
    if (!rowsEl) return;

    /* Tek geçişte hem filtrele hem veri topla (PERF: her render'da bir kez). */
    const items = [];
    jobs.forEach(j => {
        if (!isProjectStageJob(j)) return;
        const progress = computeDeadlineProgress(j);
        if (!progress.ok) return;
        items.push({ job: j, progress: progress });
    });

    if (chipEl) {
        chipEl.textContent = items.length + (items.length === 1 ? ' proje' : ' proje');
        chipEl.style.display = items.length ? '' : 'none';
    }

    if (items.length === 0) {
        rowsEl.innerHTML = '<div class="dash-empty"><i class="fa-solid fa-hourglass-half"></i><span>Takvim tarihi girilmiş <b>Proje</b> aşamasında iş yok.<br><small style="opacity:.7">İş kaydında aşama “Proje” iken başlangıç ve teslim tarihlerini doldurun.</small></span></div>';
        return;
    }

    /* Acil olan önce: teslim tarihi en yakın olan (kalan gün en az) en üstte.
       Gecikmişler zaten en üstte çünkü daysLeft negatif; sonra en yakın gelecek. */
    items.sort((a, b) => a.progress.daysLeft - b.progress.daysLeft);

    rowsEl.innerHTML = items.map(({ job, progress }) => {
        const tone = deadlineTone(progress);
        const pctText = Math.round(progress.pct);
        const remaining = deadlineRemainingText(progress);
        const cls = ['dl-row', tone.warn ? 'is-warn' : '', tone.overdue ? 'dl-overdue' : ''].filter(Boolean).join(' ');
        const stateIcon = tone.overdue ? 'fa-triangle-exclamation' : tone.warn ? 'fa-bolt' : 'fa-clock';
        /* title ile tam bağlam: başlangıç, teslim, toplam süre ve geçen gün. */
        const title = `Başlangıç: ${formatDeadlineDate(job.start_date)} • Teslim: ${formatDeadlineDate(job.end_date)} • Süre: ${progress.totalDays} gün • Geçen: ${Math.max(0, progress.elapsedDays)} gün`;
        return `
        <div class="${cls}" style="--tone:${tone.cssVar}; --pct:${pctText}%;" onclick="openJobModal('${job.id}')" title="${escapeJsAttr(title)}">
            <div class="dl-head">
                <span class="dl-name">${escapeHtml(job.is_tanimi)}</span>
                <span class="dl-badge"><i class="fa-solid ${stateIcon}"></i>${escapeHtml(remaining)}</span>
            </div>
            <div class="dl-meta">
                <span class="dl-pct">İlerleme: <b>%${pctText}</b>${tone.overdue ? ' • <span class="dl-row-note">süre aşıldı</span>' : ''}</span>
                <span class="dl-due"><i class="fa-solid fa-flag"></i> Teslim: ${escapeHtml(formatDeadlineDate(job.end_date))}</span>
            </div>
            <div class="dl-track"><div class="dl-fill"></div></div>
        </div>`;
    }).join('');
}

/* --- BUGÜNKÜ İŞLER PANELİ: panel-yerel arama + hızlı görev ekleme --- */
let dashTodayQuery = '';
function handleDashTodaySearch(q) {
    dashTodayQuery = String(q || '').toLocaleLowerCase('tr-TR').trim();
    renderDashTodayPanel();
}
function renderDashTodayPanel() {
    const rowsEl = document.getElementById('dash-today-rows');
    const dateInput = document.getElementById('dash-todo-input-date');
    if (!rowsEl) return;
    if (dateInput && !dateInput.value) dateInput.value = taskDateKey();

    const todayKey = taskDateKey();
    let list = tasks.filter(t => (t.date || '') === todayKey);
    /* Dünden (ve daha eski günlerden) kalan YAPILMAMIŞ ⭐ Önemli görevler
       otomatik olarak bugüne taşınır (bkz. carryOverdueImportantTasks).
       Gece 00:00 devri bunu bir kez yapar; bu TELAFİ, o devir çalışmadan
       önce geçmiş bir güne bağlı kalmış görevleri de kurtarır. Böylece
       "dünden kalan önemli işler" kuralı panelde her zaman geçerli olur. */
    const carriedCount = carryOverdueImportantTasks();
    if (carriedCount > 0) {
        saveAllData();
        list = tasks.filter(t => (t.date || '') === todayKey);
    }
    if (dashTodayQuery) list = list.filter(t => (t.text || '').toLocaleLowerCase('tr-TR').includes(dashTodayQuery));

    if (list.length === 0) {
        rowsEl.innerHTML = `<div class="dash-empty"><i class="fa-solid fa-mug-hot"></i><span>${dashTodayQuery ? 'Aramanızla eşleşen görev yok.' : 'Bugün için görev yok. Üstteki alandan ekleyin.'}</span></div>`;
        return;
    }

    /* Dinamik bekleme süresi: görevin İLK YAZILDIĞI sabit tarih (createdDate) ile
       bugün arasındaki takvim günü farkı hesaplanır (saat etkisiz; gece 00:00
       devri t.date'yi güncellese bile createdDate sabit kalır).
       Metin kuralları: 0 gün → "Bugün", 1 gün → "1 gündür bekliyor",
       2+ gün → "X gündür bekliyor" (hafta birimi YOK; süre gün olarak yazılır).
       Geçersiz/boş tarih → "Bugün". Tamamlanan görevde "Bitti" gösterilir. */
    const dayDiffTr = (dateKey) => {
        if (!dateKey) return 0;
        const parts = String(dateKey).split('-');
        if (parts.length !== 3) return 0;
        const created = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (isNaN(created.getTime())) return 0;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.round((today.getTime() - created.getTime()) / 86400000);
    };
    const waitPhraseTr = (dateKey) => {
        const days = Math.max(0, dayDiffTr(dateKey));
        if (days <= 0) return 'Bugün';
        if (days === 1) return '1 gündür bekliyor';
        return days + ' gündür bekliyor';
    };
    rowsEl.innerHTML = list.map(t => {
        const doneCls = t.completed ? ' done' : '';
        const waitText = t.completed ? 'Bitti' : waitPhraseTr(getTaskWrittenDate(t));
        const waitCls = (!t.completed && waitText !== 'Bugün') ? ' warn' : '';
        return `
        <div class="dt-row${doneCls}">
            <div class="dt-check" onclick="toggleTaskStatus('${t.id}')" title="${t.completed ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}"><i class="fa-solid fa-check"></i></div>
            <div class="dt-text"><span class="dt-name">${t.emoji || '📌'} ${escapeHtml(t.text)}</span></div>
            <span class="dt-wait${waitCls}" title="${t.completed ? 'Görev tamamlandı' : 'Görevin yazıldığı tarihten bu yana geçen süre'}"><i class="fa-regular fa-clock"></i>${waitText}</span>
            <div class="dt-actions">
                <button class="btn-icon" title="Düzenle (görevler ekranında)" onclick="startEditDashTask('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon delete" title="Sil" onclick="deleteTask('${t.id}')"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>`;
    }).join('');
}
function addDashTask() {
    const date = document.getElementById('dash-todo-input-date').value;
    const emoji = document.getElementById('dash-todo-input-emoji').value;
    const textInput = document.getElementById('dash-todo-input-text');
    const text = textInput.value.trim();
    if (!text) { if (typeof showToast === 'function') showToast('Görev metni boş olamaz.', 'warn'); return; }
    tasks.unshift({ id: 'task_' + Date.now(), date, emoji, text, completed: false });
    textInput.value = '';
    saveAllData();
    renderDashTodayPanel();
    updateGlobalCounts();
}
function startEditDashTask(id) {
    /* Paneldeki kalem ikonu görevi, görevler ekranındaki form editörüne taşır. */
    startEditTask(id);
    navigateTo('tasks');
}

/* --- PROFİL POPOVER: tıkla aç/kapa, dış tıkta kapan, canlı istatistikler --- */
function toggleProfilePopover(event) {
    const card = document.getElementById('user-profile-card');
    if (!card) return;
    const isOpen = card.classList.toggle('open');
    card.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
        /* Açılış anında istatistikler ve profil alanları güncellenir. */
        applyProfileToDom();
        const jobsEl = document.getElementById('profile-stat-jobs');
        const activeEl = document.getElementById('profile-stat-active');
        if (jobsEl) jobsEl.textContent = String(jobs.length);
        if (activeEl) activeEl.textContent = String(activeJobIds.length);
        const themeEl = document.getElementById('profile-stat-theme');
        if (themeEl) themeEl.textContent = (document.documentElement.getAttribute('data-theme') === 'light') ? 'Gündüz' : 'Gece';
    }
    if (event) event.stopPropagation();
}
document.addEventListener('click', (e) => {
    const card = document.getElementById('user-profile-card');
    if (card && card.classList.contains('open') && !card.contains(e.target)) {
        card.classList.remove('open');
        card.setAttribute('aria-expanded', 'false');
    }
});



/* ==========================================================================
   ÇALIŞMA MODU — PUBLIC (YEREL) / PRIVATE (BULUT / YÖNETİCİ)
   --------------------------------------------------------------------------
   İki mod vardır:

   · PUBLIC (varsayılan): Uygulama parola sormadan açılır; tüm eklemeler/
     güncellemeler/silmeler YALNIZCA yerel depoda (localStorage) tutulur.
     /api/data'ya HİÇBİR yazma isteği gönderilmez; bulut okuması ve periyodik
     senkron da hiç çalışmaz (bulut tamamen kapalı).

   · PRIVATE: Master Parola ile girilir. Girişte parola sunucuda /api/data
     üzerinden doğrulanır (POST { action:'verify' } → 200/403) ve oturum
     boyunca yalnızca RAM'de tutulur; her toplu bulut yazımında
     X-Master-Password başlığıyla iletilir. Private moddayken saveAllData
     senkronu buluta yazar, buluttan gelen güncellemeler periyodik çekilir.

   PUBLIC → PRIVATE geçişte yerel veriler diske yazılıp bulut köprüsü ancak
   parola doğrulandıktan sonra açılır; böylece yerel değişiklikler asla
   yanlışlıkla buluta sızmaz.
   ========================================================================== */

const WORK_MODE_STORAGE_KEY = 'yaser_v10_work_mode';   /* 'public' | 'private' */

let workMode = 'public';            /* aktif çalışma modu (RAM) */
let workModeMasterPassword = '';    /* yalnızca Private oturumu boyunca RAM'de */
let workModeBridgeInstalled = false;

function isWorkModePrivate() {
    return workMode === 'private';
}

function isWorkModePublic() {
    return workMode === 'public';
}

/* Public modda toplu bulut yazımını global emniyet kilidiyle de engeller:
   pushCloudJobs, { jobs:[...] } toplu SET isteğinin tek kapısıdır. */
function installWorkModeBridge() {
    if (workModeBridgeInstalled) return;
    const target = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (typeof target.pushCloudJobs !== 'function') return;
    const original = target.pushCloudJobs;
    target.pushCloudJobs = function () {
        if (!isWorkModePrivate()) {
            console.info('[mode] Public (yerel) modda bulut yazımı atlandı (pushCloudJobs engellendi).');
            return Promise.reject(new Error('mode:public-no-cloud'));
        }
        return original.apply(this, arguments);
    };
    target.pushCloudJobs.__modeHooked = true;
    workModeBridgeInstalled = true;
}

/* Kalıcı mod tercihi: uygulama bir sonraki açılışta bu modda başlar. */
function readStoredWorkMode() {
    try {
        const v = localStorage.getItem(WORK_MODE_STORAGE_KEY);
        return (v === 'private') ? 'private' : 'public';
    } catch (e) {
        return 'public';
    }
}

function storeWorkMode(mode) {
    try { localStorage.setItem(WORK_MODE_STORAGE_KEY, mode); } catch (e) { /* yoksay */ }
}

/* --- Topbar rozeti -------------------------------------------------------- */
function updateWorkModeBadge() {
    const badge = document.getElementById('work-mode-badge');
    if (!badge) return;
    const isPrivate = isWorkModePrivate();
    badge.classList.toggle('wm-private', isPrivate);
    badge.classList.toggle('wm-public', !isPrivate);
    badge.title = isPrivate
        ? 'Private Mod: Buluta bağlı (yönetici). Değişiklikler Upstash bulutuna yazılır.'
        : 'Public Mod: Yerel çalışma. Bulut kapalı; değişiklikler yalnızca bu tarayıcıda saklanır.';
    const textEl = badge.querySelector('.wm-badge-text');
    const iconEl = badge.querySelector('.wm-badge-icon');
    if (iconEl) iconEl.className = isPrivate ? 'fa-solid fa-lock wm-badge-icon' : 'fa-solid fa-lock-open wm-badge-icon';
    if (textEl) textEl.textContent = isPrivate ? 'Bulut Bağlı (Private)' : 'Yerel Mod (Public — Bulut Kapalı)';
}


/* --- Private giriş modalı -------------------------------------------------- */
function showWorkModeModal() {
    const modal = document.getElementById('work-mode-modal');
    if (!modal) return;
    /* Mevcut mod işaretlenir; parola alanı yalnızca Private için açılır. */
    modal.querySelectorAll('.wm-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.mode === workMode);
    });
    const pwWrap = document.getElementById('wm-password-wrap');
    if (pwWrap) pwWrap.style.display = isWorkModePrivate() ? 'flex' : 'none';
    const pwInput = document.getElementById('wm-password-input');
    const err = document.getElementById('wm-error');
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    if (pwInput) pwInput.value = '';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { if (pwInput && isWorkModePrivate()) pwInput.focus(); }, 80);
}

function closeWorkModeModal() {
    const modal = document.getElementById('work-mode-modal');
    if (modal) modal.classList.remove('active');
    const pwInput = document.getElementById('wm-password-input');
    if (pwInput) pwInput.value = '';
    document.body.style.overflow = '';
}

/* Rozet tıklanınca mod seçim modalı açılır/kapatılır. */
function toggleWorkModeModal() {
    const modal = document.getElementById('work-mode-modal');
    if (modal && modal.classList.contains('active')) closeWorkModeModal();
    else showWorkModeModal();
}

/* Modal içindeki mod kartına tıklanınca: seçim işaretlenir, parola alanı
   yalnızca Private için görünür olur. */
function selectWorkModeOption(mode, ev) {
    const card = (ev && ev.currentTarget) ? ev.currentTarget : null;
    const opt = card && card.closest ? card.closest('.wm-option') : null;
    document.querySelectorAll('#work-mode-modal .wm-option').forEach(o => o.classList.remove('selected'));
    if (opt) opt.classList.add('selected');
    else {
        document.querySelectorAll('#work-mode-modal .wm-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.mode === mode);
        });
    }
    const pwWrap = document.getElementById('wm-password-wrap');
    if (pwWrap) pwWrap.style.display = (mode === 'private') ? 'flex' : 'none';
    const err = document.getElementById('wm-error');
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    const pwInput = document.getElementById('wm-password-input');
    if (mode === 'private' && pwInput) setTimeout(() => pwInput.focus(), 60);
}

function showWorkModeError(msg) {
    const err = document.getElementById('wm-error');
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
}


/* Private girişte parolanın bulut tarafından doğrulanması. */
function verifyMasterPasswordWithCloud(password) {
    return fetch(CLOUD_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', masterPassword: password })
    }).then(r => {
        if (r.status === 403) {
            const err = new Error('wrong-password');
            err.httpStatus = 403;
            throw err;
        }
        if (!r.ok) {
            const err = new Error('HTTP ' + r.status);
            err.httpStatus = r.status;
            throw err;
        }
        return r.json();
    }).then(payload => {
        if (!payload || payload.ok !== true) throw new Error('verify-failed');
        return true;
    });
}

/* Modalın "Devam Et" düğmesi: seçilen moda göre giriş yapar. */
function applySelectedWorkMode() {
    const modal = document.getElementById('work-mode-modal');
    const selectedOpt = modal ? modal.querySelector('.wm-option.selected') : null;
    const mode = (selectedOpt && selectedOpt.dataset.mode) || workMode;

    if (mode === 'public') {
        enterPublicWorkMode(true);
        closeWorkModeModal();
        return;
    }

    const pwInput = document.getElementById('wm-password-input');
    const password = (pwInput && pwInput.value) || '';
    if (!password) {
        showWorkModeError('Lütfen Master Parola girin.');
        if (pwInput) pwInput.focus();
        return;
    }

    const btn = document.getElementById('wm-continue-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Doğrulanıyor…'; }

    verifyMasterPasswordWithCloud(password)
        .then(() => {
            workModeMasterPassword = password;   /* yalnızca RAM'de tutulur */
            return enterPrivateWorkMode();
        })
        .then(() => { closeWorkModeModal(); })
        .catch(err => {
            if (err && err.httpStatus === 403) showWorkModeError('Hatalı Master Parola. Erişim reddedildi (403).');
            else showWorkModeError('Doğrulama başarısız: ' + ((err && err.message) || 'bağlantı hatası'));
            if (typeof console !== 'undefined' && console.warn) console.warn('[mode] Private giriş doğrulaması başarısız:', err);
        })
        .finally(() => {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Devam Et'; }
        });
}

/* Enter tuşu parola alanında Devam Et'i tetikler. */
function handleWorkModePasswordKeydown(ev) {
    if (ev && ev.key === 'Enter') {
        ev.preventDefault();
        applySelectedWorkMode();
    }
}


/* --- Mod geçişleri ---------------------------------------------------------- */

/* ==========================================================================
   PRIVATE OTURUM GİZLİLİĞİ — YEREL DEPO TEMİZLİĞİ
   --------------------------------------------------------------------------
   Private (bulut/yönetici) oturumu boyunca yaser_v10_* verileri yerel depoya
   da yazılır (saveAllData). Private'dan çıkışta (Public'e geçiş, sekme/
   pencere kapanışı) bu yerel izler TAMAMEN silinir; böylece ardından Public
   modda açılan biri önceki Private oturumuna ait hiçbir iş kaydı görmez ve
   Public tamamen sıfır/izole bir depoyla başlar. Verilerin asıl kopyası
   Upstash bulutundadır; sonraki Private girişte buluttan geri yüklenir.
   ========================================================================== */

/* Private oturumun yerel depoya bıraktığı TÜM veri anahtarlarını siler.
   Şifreli kasa hâlâ kuruluysa hiçbir şeye dokunmaz (kasa korunur).
   Sunum/oturum anahtarları (tema, geri sayım...) bilinçli olarak korunur. */
function wmPurgePrivateLocalData() {
    if (wmHasEncryptedVault()) return 0;   /* şifreli kasaya asla dokunma */
    let removed = 0;
    try {
        ZK_DATA_KEYS.forEach(function (key) {
            try { localStorage.removeItem(key); removed++; } catch (e) { /* yoksay */ }
        });
        try { localStorage.removeItem(CLOUD_SYNC_STORAGE_FLAG); } catch (e) { /* yoksay */ }
    } catch (e) { /* yoksay */ }
    if (typeof console !== 'undefined' && console.info) {
        console.info('[mode] Private oturum yerel verisi temizlendi (' + removed + ' anahtar).');
    }
    return removed;
}

/* RAM'deki tüm oturum verisini sıfırlar: Private oturumunun hafızadaki izi
   kalmasın; geri alma yığını da boşaltılır. */
function wmResetSessionState() {
    jobs = [];
    activeJobIds = [];
    notes = [];
    noteTopics = [];
    noteBoardsAllCleared = false;
    tasks = [];
    files = [];
    quickNotes = [];
    stickyNotes = [];
    weeklyGoal = { Pazartesi: 0, Salı: 0, Çarşamba: 0, Perşembe: 0, Cuma: 0 };
    undoStack = [];
    /* KRITIK: RAM veri onbellekleri de bosaltilmalidir; aksi halde hemen
       arkasindan calisan loadAllData() private verisini onbellekten geri
       yukler ve gorev normalizasyonu diske geri yazar (sizma). */
    zkPlainCache = new Map();
    if (typeof zkCipherCache !== 'undefined' && zkCipherCache && zkCipherCache.clear) zkCipherCache.clear();
    if (typeof _lastWritten !== 'undefined' && _lastWritten && _lastWritten.clear) _lastWritten.clear();
    if (typeof updateUndoIndicator === 'function') updateUndoIndicator();
}

/* PUBLIC moda geç: bulut timer'ını durdur, parolayı düşür, yerel veriyi
   yeniden yükle (Private oturumundan geliyorsak). */
function enterPublicWorkMode(refreshUi) {
    const wasPrivate = isWorkModePrivate();
    workMode = 'public';
    workModeMasterPassword = '';
    storeWorkMode('public');

    /* Emniyet kilidi: pushCloudJobs Public modda yazım reddeder. */
    installWorkModeBridge();

    /* Private oturuma ait bulut timer'ı durdurulur. */
    if (typeof cloudSyncTimerId !== 'undefined' && cloudSyncTimerId) {
        clearInterval(cloudSyncTimerId);
        cloudSyncTimerId = null;
    }

    if (wasPrivate) {
        /* RAM'deki oturum verisi yerel depoya yazılır; yerel veriler
           yeniden yüklenip arayüz tazelenir. */
        /* Gizlilik: Private oturumunun yerel izleri ve RAM kopyasi silinir;
           Public tamamen sifir/izole bir depoyla baslar. */
        if (typeof wmPurgePrivateLocalData === 'function') wmPurgePrivateLocalData();
        if (typeof wmResetSessionState === 'function') wmResetSessionState();
        if (typeof loadAllData === 'function') loadAllData();
        if (typeof refreshAllViews === 'function') refreshAllViews();
        if (typeof renderCurrentView === 'function') renderCurrentView();
        if (typeof showToast === 'function') showToast('Yerel Mod (Public) açıldı: bulut kapalı, değişiklikler yalnızca bu tarayıcıda saklanır.', 'info');
    }

    updateWorkModeBadge();
}

/* PRIVATE moda geç: bulut köprüsü açılır, bulut verisi çekilir ve periyodik
   iki yönlü senkron başlar. Parola doğrulaması BİTTİKTEN SONRA çağrılmalıdır
   (applySelectedWorkMode içinde). */
function enterPrivateWorkMode() {
    workMode = 'private';
    storeWorkMode('private');

    installWorkModeBridge();

    /* saveAllData → bulut köprüsü (parola X-Master-Password ile taşınır). */
    if (typeof hookSaveAllDataForCloudSync === 'function') hookSaveAllDataForCloudSync();

    /* Bulut verisi YENIDEN cekilip RAM'e yuklenir (purge sonrasi bos depodan
       degil, Upstash'ten). */
    /* Bulut verisini çek + periyodik izleyiciyi başlat. */
    if (typeof initCloudSyncWatcher === 'function') initCloudSyncWatcher();

    if (typeof showToast === 'function') showToast('Bulut Bağlandı (Private): değişiklikler artık Upstash bulutuna yazılıyor.', 'success');

    updateWorkModeBadge();
    return Promise.resolve();
}

/* Sekme/pencere kapanışı: Private oturumu aktifse yerel depodaki tüm izler
   silinir. Aynı tarayıcıda hemen ardından açılan Public oturum (veya
   misafir formu) önceki Private iş kayıtlarını ASLA göremez. Veriler
   Upstash bulutunda güvende olduğundan veri kaybı yaşanmaz.
   Not: 'unload' kullanılır çünkü 'pagehide'/'visibilitychange' bazı senaryolarda
   ( işlem sonrası kapatma) tetiklenmeden süre bitebilir; kaldırma/yenileme
   akışlarında da purge idempotent olduğu için çift çalışması zararsızdır. */
window.addEventListener('beforeunload', function () {
    if (typeof isWorkModePrivate === 'function' && isWorkModePrivate()) {
        try { if (typeof wmPurgePrivateLocalData === 'function') wmPurgePrivateLocalData(); } catch (e) { /* yoksay */ }
    }
});
window.addEventListener('unload', function () {
    if (typeof isWorkModePrivate === 'function' && isWorkModePrivate()) {
        try { if (typeof wmPurgePrivateLocalData === 'function') wmPurgePrivateLocalData(); } catch (e) { /* yoksay */ }
    }
});

/* Açılışta çalışır: mod köprüsünü kurar, rozeti günceller. Kayıtlı tercih
   'private' olsa bile parola RAM'de olmadığından oturum public başlar;
   kullanıcı rozetten Private'ı seçip parolasını girer. *//* Açılışta çalışır: mod köprüsünü kurar, rozeti günceller. Kayıtlı tercih
   'private' olsa bile parola RAM'de olmadığından oturum public başlar;
   kullanıcı rozetten Private'ı seçip parolasını girer. */
function initWorkMode() {
    const stored = readStoredWorkMode();
    /* Beklenmeyen kapanma: kalan tercih 'private' ise cikista purge firsati
       bulunamamis demektir; kalmis olabilecek son izler burada silinir. */
    if (stored === 'private' && typeof wmPurgePrivateLocalData === 'function') {
        wmPurgePrivateLocalData();
        storeWorkMode('public');   /* tek seferlik temizlik; tekrar etmesin */
    }
    workMode = 'public';
    workModeMasterPassword = '';
    if (stored === 'private' && typeof console !== 'undefined' && console.info) {
        console.info('[mode] Kayıtlı tercih Private; parola doğrulaması için rozet kullanılabilir.');
    }
    installWorkModeBridge();
    updateWorkModeBadge();
}


/* ==========================================================================
   GUEST FORM MODE — KISITLI DIŞ FORM GÖRÜNÜMÜ
   --------------------------------------------------------------------------
   URL:  ?mode=guest_form&job=JOB_ID
   Bu modda sayfa YALNIZCA tek amaçla çalışır: linkteki iş kaydının
   "İş Kaydı Ekle / Düzenle" formunu tam ekran bağımsız olarak göstermek.

   VERİ SIZDIRMA KORUMASI (sıfır sızma hedefi):
   - initGuestFormMode(), bootAfterUnlock()'ın EN BAŞINDA çağrılır; guest
     moddaysa loadAllData() DAHA ÇAĞRILMADAN mod aktifleşir ve boot zinciri
     kesilir → localStorage'daki hiçbir yaser_v10_* verisi RAM'e yüklenmez,
     hiçbir panel/harita çizilmez, hiçbir zamanlayıcı başlamaz.
   - Ek savunma olarak ana uygulama elemanları DOM'dan fiziksel olarak
     remove() edilir; yalnızca #job-modal ve gereken arka plan katmanları
     bırakılır. ZK kilit katmanı (#zk-lock-overlay) de kaldırılır.
   ========================================================================== */

const GUEST_MODE_URL_PARAM  = 'mode';
const GUEST_MODE_URL_VALUE  = 'guest_form';
const GUEST_JOB_URL_PARAM   = 'job';
const CLOUD_API_ENDPOINT    = '/api/data';

function isGuestFormMode() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get(GUEST_MODE_URL_PARAM) === GUEST_MODE_URL_VALUE;
    } catch (e) {
        return false;
    }
}

function getGuestJobIdFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get(GUEST_JOB_URL_PARAM) || '';
    } catch (e) {
        return '';
    }
}

/* Guest modda body'ye sınıf yazar; CSS guest yerleşimini bu sınıfla kurar. */
function applyGuestModeClass() {
    document.body.classList.add('guest-form-mode');
}

/* Ana uygulama iskeletini DOM'dan kaldırır: sidebar, topbar, tüm paneller,
   splash, ekran koruyucu, ZK kilit katmanı ve diğer overlay'ler. */
function stripAppDomForGuestMode() {
    const removeIds = [
        'app-layout', 'splash-screen', 'screensaver-overlay', 'dashboard-drawer',
        'notif-popover', 'zk-lock-overlay', 'app-toast-wrap',
        'map-holo', 'experts-hover-tooltip'
    ];
    removeIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    /* ID ile yakalanamayan katmanlar: tüm modal overlay'leri içinden yalnızca
       job-modal DIŞINDAKİLER kaldırılır. */
    Array.prototype.forEach.call(document.querySelectorAll('.modal-overlay'), function (ov) {
        if (ov.id !== 'job-modal' && ov.parentNode) ov.parentNode.removeChild(ov);
    });
    /* Sarmalayıcılar her kurulumda ID'li değildir; class ile de temizlenir. */
    Array.prototype.forEach.call(document.querySelectorAll('.app-layout, .main-wrapper, .sidebar'), function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
    });
}

let guestModeActivated = false;

/* Guest modda boot zincirini KESER: normal panel hiç başlatılmaz.
   Dönüş true ise çağıran taraf (DOMContentLoaded / bootAfterUnlock)
   akışı sürdürmez. Idempotent: ikinci çağrıda tekrar tetiklenmez. */
function initGuestFormMode() {
    if (!isGuestFormMode()) return false;
    if (guestModeActivated) return true;
    guestModeActivated = true;

    applyGuestModeClass();

    /* Gizlilik savunma katmani: beklenmeyen bir kapanmada (çökme, güç
       kesintisi) purge firseti bulunamamis olabilir; kalmis private izleri
       guest form da gorebilir. Temizlik guest akisindan once yapilir. */
    try {
        const kalanMod = readStoredWorkMode();
        if (kalanMod === 'private') {
            if (typeof wmPurgePrivateLocalData === 'function') wmPurgePrivateLocalData();
            storeWorkMode('public');
        }
    } catch (e) { /* yoksay */ }

    /* Splash ve kilit katmanı guest formu KAPATMASIN: hemen kaldır. */
    stripAppDomForGuestMode();

    /* Bağımsız guest akışını başlat, normal akışı çalıştırma. */
    bootGuestFormFlow();
    return true;
}

/* Bağımsız guest akışı: buluttan iş verisini çek, formu doldur, kaydet. */
function bootGuestFormFlow() {
    const jobId = getGuestJobIdFromUrl();

    if (!jobId) {
        showGuestBlockingScreen('Geçersiz bağlantı', 'Bu bağlantıda iş kaydı bilgisi bulunamadı. Lütfen yöneticinizin paylaştığı güncel bağlantıyı kullanın.');
        return;
    }

    /* Form dropdown'ları: yalnızca seçim listeleri için varsayılan
       ayarlarla doldurulur (localStorage verisi OKUNMAZ). */
    try { populateGuestDropdowns(); } catch (e) { /* form yine de görünür kalır */ }

    loadGuestJobFromCloud(jobId);
}

/* Guest dropdown'ları: settings listesi localStorage'dan DEĞİL,
   varsayılan dropdown tanımlarından (defaultDropdownSettings) kurulur. */
function populateGuestDropdowns() {
    const fill = (id, list) => {
        const el = document.getElementById(id);
        if (!el || !Array.isArray(list)) return;
        el.innerHTML = list.map(v => `<option value="${escapeHtml(String(v))}">${escapeHtml(String(v))}</option>`).join('');
    };
    const dd = (typeof defaultDropdownSettings === 'object' && defaultDropdownSettings) ? defaultDropdownSettings : {};
    fill('form-section', dd.projeTuru || dd.section);
    fill('form-tur', dd.tur);
    fill('form-protokol', dd.protokol);
    fill('form-asama', dd.asama);
    fill('form-avan-uygolama', dd.avanUygulama);
    fill('form-proje', dd.projeMusaviri);
    fill('form-alt-yuklenici', dd.altYuklenici);
    fill('form-insaat-musaviri', dd.insaatMusaviri);
    ['mimari','statik','mekanik','elektrik','altyapi','peyzaj','zemin','plankote'].forEach(k => {
        fill('expert-' + k, dd[k] || dd.experts);
    });
    fillIlDropdownForGuest();
}

/* İl listesi: D3 harita verisi guest modda yüklenmez; gömülü statik 81 il
   listesi kullanılır (harita modülüne bağımlılık yok, ek istek yok). */
function fillIlDropdownForGuest() {
    const el = document.getElementById('form-il');
    if (!el) return;
    const TR_ILLER = ['Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kırıkkale','Kırklareli','Kırşehir','Kilis','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Şanlıurfa','Şırnak','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak'];
    el.innerHTML = '<option value=""></option>' + TR_ILLER.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

/* Guest formu etrafında tam ekran yarı saydam katman; mesaj / yükleniyor /
   onay ekranı bu katmanda gösterilir (Liquid Glass dilinde). */
function showGuestBlockingScreen(title, message, variant) {
    let overlay = document.getElementById('guest-block-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'guest-block-overlay';
        overlay.className = 'guest-block-overlay';
        overlay.innerHTML = [
            '<div class="guest-block-card">',
            '    <div class="guest-block-icon"><i class="fa-solid fa-file-pen"></i></div>',
            '    <div class="guest-block-title" id="guest-block-title"></div>',
            '    <div class="guest-block-message" id="guest-block-message"></div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
    }
    const t = document.getElementById('guest-block-title');
    const m = document.getElementById('guest-block-message');
    if (t) t.textContent = title || '';
    if (m) m.textContent = message || '';
    overlay.classList.remove('is-success', 'is-error');
    if (variant === 'success') overlay.classList.add('is-success');
    if (variant === 'error') overlay.classList.add('is-error');
    overlay.classList.add('visible');
    return overlay;
}

function hideGuestBlockingScreen() {
    const overlay = document.getElementById('guest-block-overlay');
    if (overlay) overlay.classList.remove('visible');
}

/* Buluttan yalnızca ilgili işi bulup formu doldurur. Tüm dizi RAM'e alınsa
   bile ekrana YALNIZCA hedef kayıt yansıtılır; diğer kayıtlar hiçbir panele
   yazılmaz (sayfada panel zaten yok). */
function loadGuestJobFromCloud(jobId) {
    const jobIdStr = String(jobId || '');
    if (!jobIdStr) return;
    showGuestBlockingScreen('Yükleniyor', 'İş kaydı buluttan alınıyor...', 'loading');

    fetch(`${CLOUD_API_ENDPOINT}?t=${encodeURIComponent(Date.now())}`, { cache: 'no-store' })
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(payload => {
            hideGuestBlockingScreen();
            const list = (payload && Array.isArray(payload.jobs)) ? payload.jobs : [];
            const job = list.find(j => j && String(j.id) === jobIdStr);
            if (!job) {
                showGuestBlockingScreen('Kayıt bulunamadı', 'İstediğiniz iş kaydı bulutta bulunamadı. Lütfen yöneticinizle iletişime geçin.', 'error');
                return;
            }
            openJobModalForGuest(job);
        })
        .catch(err => {
            hideGuestBlockingScreen();
            showGuestBlockingScreen('Bağlantı hatası', 'İş kaydı şu anda alınamadı. İnternet bağlantınızı kontrol edip sayfayı yenileyin.', 'error');
            if (typeof console !== 'undefined' && console.warn) console.warn('[guest] bulut yükleme hatası:', err);
        });
}

/* Guest form doldurma: openJobModal ile aynı alan haritası, ama veri
   kaynağı buluttan gelen TEK iş nesnesi. */
function openJobModalForGuest(job) {
    const j = job || {};
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v === undefined || v === null) ? '' : String(v); };

    document.getElementById('job-modal').classList.add('active');
    document.body.classList.add('guest-modal-open');

    const titleEl = document.getElementById('job-modal-title');
    if (titleEl) titleEl.textContent = 'İş Kaydı Güncelle — Dış Form';

    setVal('form-job-id', j.id || '');
    setVal('form-section', j.section || '250Bin');
    setVal('form-tur', j.tur || '-');
    setVal('form-protokol', j.protokol || '-');
    setVal('form-asama', j.asama || 'Yapım');
    setVal('form-avan-uygolama', j.avan_uygolama || '-');
    setVal('form-il', j.il || '');
    setVal('form-ilce', j.ilce || '');
    setVal('form-is-tanimi', j.is_tanimi || '');
    const skipEl = document.getElementById('form-skip-data-completion');
    if (skipEl) skipEl.checked = Boolean(j.skipDataCompletion);
    setVal('form-folder-path', j.folder_path || '');
    setVal('form-proje', j.proje || '-');
    setVal('form-insaat-alani', j.insaat_alani || '');
    setVal('form-alt-yuklenici', j.alt_yuklenici || '-');
    setVal('form-diger-daire', j.digerDaire || '');
    setVal('form-ihale-yazisi', j.ihale_yazisi || '');
    setVal('form-ihale-tarihi', j.ihale_tarihi || '');
    setVal('form-sozlesme-tarihi', j.sozlesme_tarihi || '');
    setVal('form-start-date', j.start_date || '');
    setVal('form-end-date', j.end_date || '');
    setVal('form-ihale-bedeli', j.ihale_bedeli || '');
    if (typeof formatNumberFieldValue === 'function') {
        try { formatNumberFieldValue(document.getElementById('form-insaat-alani'), false); } catch (e) {}
        try { formatNumberFieldValue(document.getElementById('form-ihale-bedeli'), false); } catch (e) {}
    }
    setVal('form-insaat-musaviri', j.insaat_musaviri || '-');
    setVal('form-yuklenici', j.yuklenici || '');
    setVal('form-important-notes', j.important_notes || '');

    const ex = j.experts || {};
    ['mimari','statik','mekanik','elektrik','altyapi','peyzaj','zemin','plankote'].forEach(k => {
        const el = document.getElementById('expert-' + k);
        if (el) el.value = ex[k] || '-';
    });

    /* Timeline: kaydın kendi gelişme tarihçesi (yalnızca bu işe ait). */
    tempTimeline = Array.isArray(j.timeline) ? JSON.parse(JSON.stringify(j.timeline)) : [];
    if (typeof renderFormTimeline === 'function') renderFormTimeline();

    /* Başlangıç/teslim alanlarının görünürlüğü aşamaya bağlıdır. */
    if (typeof updateDeadlineFieldsVisibility === 'function') updateDeadlineFieldsVisibility();
}

/* Guest Kaydet: formu saveJob ile aynı şemada toparlar, LocalStorage'a
   HİÇ yazmaz, doğrudan bulut API'sine POST eder. */
function saveGuestJobToCloud() {
    const jobId = document.getElementById('form-job-id').value;
    if (!jobId) {
        showGuestBlockingScreen('Hata', 'İş kimliği bulunamadı, kayıt gönderilemedi.', 'error');
        return;
    }

    /* saveJob ile birebir aynı alan şeması (yaser_v10_jobs düzeni korunur). */
    const data = {
        id: String(jobId),
        section: document.getElementById('form-section').value,
        tur: document.getElementById('form-tur') ? document.getElementById('form-tur').value : '-',
        protokol: document.getElementById('form-protokol').value,
        asama: document.getElementById('form-asama').value,
        avan_uygolama: document.getElementById('form-avan-uygolama').value,
        kapsam: "AFET",
        il: document.getElementById('form-il').value,
        ilce: document.getElementById('form-ilce').value,
        is_tanimi: document.getElementById('form-is-tanimi').value,
        skipDataCompletion: Boolean(document.getElementById('form-skip-data-completion').checked),
        folder_path: document.getElementById('form-folder-path').value,
        proje: document.getElementById('form-proje').value,
        insaat_alani: typeof normalizeNumberFieldValue === 'function' ? normalizeNumberFieldValue('form-insaat-alani') : document.getElementById('form-insaat-alani').value,
        alt_yuklenici: document.getElementById('form-alt-yuklenici').value,
        digerDaire: document.getElementById('form-diger-daire').value,
        ihale_yazisi: document.getElementById('form-ihale-yazisi').value,
        ihale_tarihi: document.getElementById('form-ihale-tarihi').value,
        sozlesme_tarihi: document.getElementById('form-sozlesme-tarihi').value,
        ihale_bedeli: typeof normalizeNumberFieldValue === 'function' ? normalizeNumberFieldValue('form-ihale-bedeli') : document.getElementById('form-ihale-bedeli').value,
        insaat_musaviri: document.getElementById('form-insaat-musaviri').value,
        yuklenici: document.getElementById('form-yuklenici').value,
        important_notes: document.getElementById('form-important-notes').value,
        start_date: (typeof isJobDeadlineActive === 'function' && isJobDeadlineActive()) ? document.getElementById('form-start-date').value : '',
        end_date: (typeof isJobDeadlineActive === 'function' && isJobDeadlineActive()) ? document.getElementById('form-end-date').value : '',
        timeline: tempTimeline,
        experts: {
            mimari: document.getElementById('expert-mimari').value,
            statik: document.getElementById('expert-statik').value,
            mekanik: document.getElementById('expert-mekanik').value,
            elektrik: document.getElementById('expert-elektrik').value,
            altyapi: document.getElementById('expert-altyapi').value,
            peyzaj: document.getElementById('expert-peyzaj').value,
            zemin: document.getElementById('expert-zemin').value,
            plankote: document.getElementById('expert-plankote').value
        },
        guest_updated_at: new Date().toISOString()
    };

    const saveBtn = document.getElementById('guest-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-spin"></i> Buluta gönderiliyor...'; }

    fetch(CLOUD_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: data })
    })
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(() => {
            /* Cam efektli onay ekranı + form kilidi. */
            showGuestBlockingScreen('Kayıt başarıyla iletildi, teşekkürler.', 'Girdiğiniz bilgiler yöneticiye ulaştı. Bu sayfayı artık kapatabilirsiniz.', 'success');
            lockGuestFormAfterSave();
        })
        .catch(err => {
            if (typeof showToast === 'function') showToast('Kayıt gönderilemedi: ' + (err && err.message ? err.message : 'bağlantı hatası'), 'error');
            const retryNote = document.getElementById('guest-retry-note');
            if (retryNote) { retryNote.style.display = 'block'; }
        })
        .finally(() => {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Buluta Kaydet'; }
        });
}

/* Onaydan sonra form alanlarını kilitler; kullanıcı ekranı kapatabilir
   ama yeniden gönderemez (yenileme gerektirir). */
function lockGuestFormAfterSave() {
    const modal = document.getElementById('job-modal');
    if (!modal) return;
    modal.querySelectorAll('input, select, textarea, button').forEach(el => {
        if (el.id === 'guest-close-btn') return;
        el.disabled = true;
    });
    modal.classList.add('guest-locked');
    const closeBtn = document.getElementById('guest-close-btn');
    if (closeBtn) closeBtn.style.display = 'inline-flex';
}

/* Guest X butonu: sayfayı kapatamaz (tarayıcı güvenliği); onay/kilit
   durumundaysa formu bırakır, değilse bilgilendirme gösterir. */
function handleGuestCloseClick() {
    const modal = document.getElementById('job-modal');
    if (modal && modal.classList.contains('guest-locked')) {
        modal.classList.remove('active');
        return;
    }
    showToast('Devam etmek için formu doldurup "Buluta Kaydet"e basın.', 'info');
}

/* Yönetici panelinden kısıtlı dış form bağlantısı üretir. */
function copyGuestFormLink(jobId) {
    const idStr = String(jobId || '');
    if (!idStr) return;
    try {
        const base = window.location.origin + window.location.pathname;
        const link = `${base}?mode=guest_form&job=${encodeURIComponent(idStr)}`;
        const applyUi = () => {
            if (typeof showToast === 'function') showToast('Dış form bağlantısı panoya kopyalandı', 'success');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(applyUi).catch(() => {
                window.prompt('Bağlantı kopyalanamadı, elle kopyalayın:', link);
            });
        } else {
            window.prompt('Bağlantı kopyalanamadı, elle kopyalayın:', link);
        }
    } catch (e) {
        window.prompt('Bağlantı:', `${window.location.origin}${window.location.pathname}?mode=guest_form&job=${encodeURIComponent(idStr)}`);
    }
}


/* ==========================================================================
   BULUT SENKRONİZASYONU — YÖNETİCİ PANELİ /api/data KÖPRÜSÜ
   --------------------------------------------------------------------------
   Yönetici paneli açıldığında ve ardından periyodik olarak buluttaki
   yaser_v10_jobs dizisi çekilir; yerel jobs[] ile ID bazlı birleştirilir.

   ÇAKIŞMA KURALLARI (yerel veri ASLA kaybolmaz):
   - Bulutta olup yerelde olmayan kayıt → yerle eklenir (başka cihaz/guest).
   - Her iki tarafta da olan ve guest_updated_at damgası taşıyan kayıt →
     yalnızca bulut sürümü DAHA YENİYSE güncellenir.
   - Yerelde olup bulutta olmayan kayıt → yerelde kalır (silme yayılmaz).
   - Yerelde düzenlenip saveAllData() ile yazılan her jobs[] dizisi arka
     planda buluta da yazılır (tam senkron).
   ========================================================================== */

const CLOUD_SYNC_INTERVAL_MS  = 60000;   /* periyodik kontrol: 60 sn */
const CLOUD_SYNC_STORAGE_FLAG = 'yaser_v10_cloud_sync_at';

let cloudSyncTimerId = null;
let cloudSyncInFlight = false;
let cloudSyncEnabled = true;

function guestStampMs(job) {
    if (!job || !job.guest_updated_at) return 0;
    const t = Date.parse(job.guest_updated_at);
    return Number.isFinite(t) ? t : 0;
}

function fetchCloudJobs() {
    return fetch(`${CLOUD_API_ENDPOINT}?t=${encodeURIComponent(Date.now())}`, { cache: 'no-store' })
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(payload => {
            if (!payload || !payload.ok || !Array.isArray(payload.jobs)) {
                throw new Error((payload && payload.error) || 'Bulut yanıtı geçersiz.');
            }
            return payload.jobs;
        });
}

function pushCloudJobs(jobsArray) {
    const wmHeaders = { 'Content-Type': 'application/json' };
    if (typeof isWorkModePrivate === 'function' && isWorkModePrivate() && typeof workModeMasterPassword !== 'undefined' && workModeMasterPassword) { wmHeaders['X-Master-Password'] = workModeMasterPassword; }
    return fetch(CLOUD_API_ENDPOINT, {
        method: 'POST',
        headers: wmHeaders,
        body: JSON.stringify({ jobs: jobsArray })
    }).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    });
}

/* Bulut → yerel birleştirme. return: { added, updated } */
function mergeCloudJobsIntoLocal(cloudJobs) {
    let added = 0;
    let updated = 0;
    if (!Array.isArray(cloudJobs) || typeof jobs === 'undefined' || !Array.isArray(jobs)) return { added, updated };

    cloudJobs.forEach(cj => {
        if (!cj || cj.id === undefined || cj.id === null) return;
        const idx = jobs.findIndex(x => String(x.id) === String(cj.id));
        if (idx === -1) {
            jobs.push(cj);
            added++;
        } else {
            const stamp = guestStampMs(cj);
            /* Guest damgası yoksa bulut kaydı yerelin ÜZERİNE yazılmaz:
               yöneticinin yerel düzenlemeleri korunur. */
            if (stamp > 0 && stamp > guestStampMs(jobs[idx])) {
                jobs[idx] = cj;
                updated++;
            }
        }
    });

    if (added || updated) saveAllData();
    return { added, updated };
}

/* Yerel → bulut tam senkron (sessiz). */
function syncJobsToCloud(reasonLabel) {
    if (typeof isWorkModePrivate === 'function' && !isWorkModePrivate()) return Promise.resolve(false);
    if (!cloudSyncEnabled || typeof jobs === 'undefined' || !Array.isArray(jobs)) return Promise.resolve(false);
    return pushCloudJobs(jobs)
        .then(() => {
            try { localStorage.setItem(CLOUD_SYNC_STORAGE_FLAG, String(Date.now())); } catch (e) {}
            return true;
        })
        .catch(err => {
            if (typeof console !== 'undefined' && console.warn) console.warn('[cloud] gönderim başarısız (' + (reasonLabel || 'genel') + '):', err);
            return false;
        });
}

/* Bulut → yerel kontrol; panel açılışında ve periyodik çağrılır. */
function syncJobsFromCloud(showToastOnMerge) {
    if (typeof isWorkModePrivate === 'function' && !isWorkModePrivate()) return Promise.resolve();
    if (!cloudSyncEnabled || cloudSyncInFlight) return Promise.resolve();
    cloudSyncInFlight = true;
    return fetchCloudJobs()
        .then(cloudJobs => {
            const res = mergeCloudJobsIntoLocal(cloudJobs);
            try { localStorage.setItem(CLOUD_SYNC_STORAGE_FLAG, String(Date.now())); } catch (e) {}
            if ((res.added || res.updated)) {
                if (typeof renderCurrentView === 'function') renderCurrentView();
                if (showToastOnMerge && typeof showToast === 'function') {
                    showToast(`Bulut güncellemesi alındı: ${res.added} yeni, ${res.updated} güncellenen kayıt`, 'success');
                }
            }
        })
        .catch(err => {
            if (typeof console !== 'undefined' && console.warn) console.warn('[cloud] kontrol başarısız:', err);
        })
        .finally(() => { cloudSyncInFlight = false; });
}

/* Panel açılışında bir kez + periyodik zamanlayıcıyı kurar. */
function initCloudSyncWatcher() {
    if (!cloudSyncEnabled) return;

    syncJobsFromCloud(true);

    if (cloudSyncTimerId) clearInterval(cloudSyncTimerId);
    cloudSyncTimerId = setInterval(() => {
        /* Birleştirme ID bazlı ve idempotent; görünüm ne olursa olsun zararsız. */
        syncJobsFromCloud(true);
    }, CLOUD_SYNC_INTERVAL_MS);
}

/* saveAllData'yı sarmalar: her yerel kayıtta bulut da güncellenir.
   globalThis üzerinden bağlanır; fonksiyon global kapsamda tanımlıdır. */
function hookSaveAllDataForCloudSync() {
    const target = (typeof globalThis !== 'undefined') ? globalThis : window;
    if (typeof target.saveAllData === 'function' && !target.saveAllData.__cloudHooked) {
        const original = target.saveAllData;
        target.saveAllData = function () {
            const result = original.apply(this, arguments);
            syncJobsToCloud('saveAllData');
            return result;
        };
        target.saveAllData.__cloudHooked = true;
    }
}
