/* ==========================================================================
   VERCEL SERVERLESS FUNCTION — /api/data  (dosya: /api/data.js)
   --------------------------------------------------------------------------
   AMAÇ
   Guest Form Mode akışında dış paylaşımlı formdan gelen iş kaydı güncellemesi
   ile yönetici panelinin bulut senkronizasyonunu yönetir.

   DEPOLAMA
   Upstash Redis REST API (HTTP tabanlı; serverless'ta bağlantı havuzu
   gerektirmemesi için standart redis client yerine REST tercih edilir).
   Environment değişkenleri (Vercel > Project > Settings > Environment Variables)
   — Upstash marka değişkenleri VEYA Vercel KV / Marketplace entegrasyonunun
   ürettiği eşdeğer değişkenler kabul edilir (fallback zinciri):
     URL:   UPSTASH_REDIS_REST_URL | KV_REST_API_URL | STORAGE_REST_API_URL
     TOKEN: UPSTASH_REDIS_REST_TOKEN | KV_REST_API_TOKEN | STORAGE_REST_API_TOKEN
   Hiçbiri bulunamazsa API 503 döner ve eksik olan değişken adlarını
   Vercel fonksiyon loguna console.error ile yazar.

   VERİ ŞEMASI (DEĞİŞTİRME — mevcut uygulama düzeniyle birebir):
   Anahtar: "yaser_v10_jobs"  →  Değer: jobs[] dizisinin JSON'u.
   GET  → { ok:true, jobs:[...] }     (anahtar yoksa { ok:true, jobs:[] })
   POST → gövde: { jobs:[...] }  ya da  { job:{...} }
           - job gönderilirse sunucu, mevcut dizideki eş ID'li kaydı günceller,
             yoksa ekler (upsert) ve TÜM diziyi döndürür.
           - jobs gönderilirse dizi aynen yazılır (yönetici tam senkronu).
             Bu TOPLU yazım Master Parola ile YETKİLİDİR: parola
             X-Master-Password başlığı ya da gövdede masterPassword alanı
             olarak iletilir; eksik/hatalıysa 403 Forbidden döner.
   CORS: dış form aynı origin'de çalışır; yine de kısıtlı CORS başlıkları
   eklenir (ileride ayrı domain'den erişim gerekirse hazır olur).
   ========================================================================== */

const crypto = require('crypto');

/* --- TOTP (RFC 6238) — GOOGLE AUTHENTICATOR DOĞRULAMA ----------------------
   Node.js yerleşik 'crypto' modülüyle çalışır; harici npm paketi GEREKTİRMEZ.
   · HMAC-SHA1, 30 saniyelik adım, 6 haneli kod.
   · Saat sapması toleransı: geriye/ileriye 1 adım (±30 sn) penceresi.
   · Gizli anahtar Vercel ortam değişkeninden okunur: TOTP_SECRET (Base32).
   Private mod girişi İKİ GEÇERLİ KİMLİK kabul eder: uzun Master Parola
   VEYA Authenticator'daki 6 haneli kod. Kodlar kısa ömürlü olduğundan
   yalnızca GİRİŞTE kullanılır; toplu bulut yazımı (jobs SET) için sunucu,
   girişte süreli imzalı bir oturum belirteci (HMAC-SHA256, timing-safe
   doğrulamalı) üretir — parola/kod istekler arasında tekrar taşınmaz. */
const TOTP_STEP_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;   /* ±1 adım = ±30 saniye */

const TOTP_SECRET_ENV_CANDIDATES = ['TOTP_SECRET', 'GOOGLE_AUTHENTICATOR_SECRET'];

function resolveTotpSecret() {
    for (const name of TOTP_SECRET_ENV_CANDIDATES) {
        const val = process.env[name];
        if (val && String(val).trim()) return String(val).trim();
    }
    return '';
}

function totpSecretConfigured() {
    return Boolean(resolveTotpSecret());
}

/* RFC 4648 Base32 çözücü (A-Z, 2-7, '=' dolgusu). Bozuk girdide null döner. */
function base32Decode(input) {
    if (typeof input !== 'string') return null;
    const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
    if (!clean.length) return null;
    let bits = 0;
    let value = 0;
    const out = [];
    for (let i = 0; i < clean.length; i++) {
        const idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(clean[i]);
        if (idx === -1) return null;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/* Belirli bir sayım adımı için 6 haneli HOTP/TOTP kodu (RFC 4226 kesme). */
function totpAt(secretBuf, counter) {
    const msg = Buffer.alloc(8);
    msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    msg.writeUInt32BE(counter >>> 0, 4);
    const digest = crypto.createHmac('sha1', secretBuf).update(msg).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const bin = ((digest[offset] & 0x7f) << 24)
        | ((digest[offset + 1] & 0xff) << 16)
        | ((digest[offset + 2] & 0xff) << 8)
        | (digest[offset + 3] & 0xff);
    return String(bin % 1000000).padStart(6, '0');
}

/* Sabit süreli string karşılaştırması (timing-safe). */
function safeEqualStr(a, b) {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/* Verilen kodun şu anki (±pencere) TOTP kodlarından biri olup olmadığı. */
function totpVerify(code, windowSteps) {
    if (!/^\d{6}$/.test(String(code || ''))) return false;
    const secretB32 = resolveTotpSecret();
    if (!secretB32) return false;
    const key = base32Decode(secretB32);
    if (!key || !key.length) return false;
    const step = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
    const w = (typeof windowSteps === 'number' && windowSteps >= 0) ? windowSteps : TOTP_WINDOW_STEPS;
    for (let i = -w; i <= w; i++) {
        if (safeEqualStr(String(code), totpAt(key, step + i))) return true;
    }
    return false;
}

/* --- SÜRELİ OTURUM BELİRTİCİ (stateless, serverless uyumlu) -----------------
   Girişte (parola VEYA TOTP) üretilir: exp.HMAC_imzası biçiminde. İmza anahtarı
   APP_MASTER_PASSWORD'dır; doğru imza bilinmeden üretilemez. Toplu yazımda
   X-Session-Token başlığıyla gelir, süresi ve imzası timing-safe doğrulanır. */
const SESSION_TOKEN_TTL_PASSWORD_MS = 12 * 60 * 60 * 1000;  /* parola girişi: 12 sa */
const SESSION_TOKEN_TTL_TOTP_MS     = 45 * 60 * 1000;       /* TOTP girişi: 45 dk */

function sessionTokenSignature(exp) {
    const sig = crypto.createHmac('sha256', resolveMasterPassword())
        .update('yaser-session:' + exp)
        .digest('base64');
    return sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createSessionToken(ttlMs) {
    const exp = Date.now() + (typeof ttlMs === 'number' ? ttlMs : SESSION_TOKEN_TTL_TOTP_MS);
    return exp + '.' + sessionTokenSignature(exp);
}

function sessionTokenValid(token) {
    if (!token || typeof token !== 'string') return false;
    const dotIdx = token.indexOf('.');
    if (dotIdx <= 0) return false;
    const exp = Number(token.slice(0, dotIdx));
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    return safeEqualStr(token.slice(dotIdx + 1), sessionTokenSignature(exp));
}

const JOBS_KEY = 'yaser_v10_jobs';

/* --- YÖNETİCİ (PRIVATE) YAZMA YETKİSİ --------------------------------------
   Toplu bulut yazımı (POST { jobs:[...] }, saveAllData senkronu) yalnızca
   Master Parola taşıyan isteklere açıktır. Parola istekte X-Master-Password
   başlığı YA DA gövdede { masterPassword: "..." } alanı olarak gelebilir.
   Beklenen parola Vercel ortam değişkeninden okunur (fallback zinciri):
     APP_MASTER_PASSWORD | YASER_MASTER_PASSWORD
   · Değişken tanımlıysa: parolasız / hatalı parolalı toplu yazım → 403.
   · Değişken TANIMLI DEĞİLSE: toplu yazım güvenlik gereği tamamen kapalıdır
     (503) — API parolasız asla açık kalmaz.
   Guest form akışı (POST { job:{...} }) ve GET bu kontrolün DIŞINDADIR.
   Karşılaştırma crypto.timingSafeEqual ile yapılır (zamanlama saldırısına
   karşı sabit süre). */
const MASTER_PASSWORD_ENV_CANDIDATES = ['APP_MASTER_PASSWORD', 'YASER_MASTER_PASSWORD'];

function resolveMasterPassword() {
    for (const name of MASTER_PASSWORD_ENV_CANDIDATES) {
        const val = process.env[name];
        if (val && String(val).trim()) return String(val).trim();
    }
    return '';
}

function masterPasswordConfigured() {
    return Boolean(resolveMasterPassword());
}

/* Yapılandırma eksikse Vercel fonksiyon loguna teşhis yazar. */
function logMissingMasterPassword() {
    console.error(
        '[/api/data] Toplu bulut yazımı (Private mod) için APP_MASTER_PASSWORD (veya YASER_MASTER_PASSWORD) ortam değişkeni tanımlı değil.' +
        ' Değişkeni Vercel > Project > Settings > Environment Variables bölümüne ekleyip yeniden dağıtın;' +
        ' tanımlı olana kadar toplu SET istekleri 503 ile reddedilir.'
    );
}

/* Sabit süreli parola karşılaştırması (timing-safe). */
function masterPasswordMatches(supplied) {
    const expected = resolveMasterPassword();
    if (!expected || typeof supplied !== 'string' || !supplied.length) return false;
    const a = Buffer.from(supplied, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/* --- ENV DEĞİŞKENİ ÇÖZÜMLEME (fallback zinciri) ----------------------------
   Upstash marka değişkenler VE Vercel KV / Marketplace entegrasyonlarının
   ürettiği eşdeğer adlar desteklenir. URL ve token AYNI zincirden eşleşmeli:
   farklı sağlayıcılardan karışım alınmaz (ör. Upstash URL + KV token). */
const URL_ENV_CANDIDATES   = ['UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL', 'STORAGE_REST_API_URL'];
const TOKEN_ENV_CANDIDATES = ['UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN', 'STORAGE_REST_API_TOKEN'];

/* Eşleşen ilk URL zinciri; token da aynı zincirde bulunmalı. */
function resolveRedisEnv() {
    for (const urlName of URL_ENV_CANDIDATES) {
        const urlVal = process.env[urlName];
        if (!urlVal || !String(urlVal).trim()) continue;
        const tokenName = TOKEN_ENV_CANDIDATES[URL_ENV_CANDIDATES.indexOf(urlName)];
        const tokenVal = process.env[tokenName];
        if (tokenVal && String(tokenVal).trim()) {
            return { urlName, tokenName, url: String(urlVal).trim().replace(/\/+$/, ''), token: String(tokenVal).trim() };
        }
    }
    return null;
}

function redisConfigured() {
    return Boolean(resolveRedisEnv());
}

/* Yapılandırma eksikse Vercel fonksiyon loguna detaylı teşhis yazar. */
function logMissingRedisEnv() {
    const foundUrls = URL_ENV_CANDIDATES.filter(n => process.env[n] && String(process.env[n]).trim());
    const foundTokens = TOKEN_ENV_CANDIDATES.filter(n => process.env[n] && String(process.env[n]).trim());
    console.error(
        '[/api/data] 503: Bulut depo yapılandırılmadı. Gerekli çift bulunamadı.' +
        ' Aranan URL değişkenleri: [' + URL_ENV_CANDIDATES.join(', ') + '] → bulunan: [' + (foundUrls.join(', ') || 'YOK') + '].' +
        ' Aranan TOKEN değişkenleri: [' + TOKEN_ENV_CANDIDATES.join(', ') + '] → bulunan: [' + (foundTokens.join(', ') || 'YOK') + '].' +
        ' Vercel > Project > Settings > Environment Variables bölümünden ör. UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN ekleyip yeniden dağıtın (deploy).'
    );
}

/* Upstash REST komut çağrısı — KOMUT DİZİSİ FORMATI (POST gövdeli).
   ---------------------------------------------------------------------
   NEDEN: Eski yöntem değeri URL path'e gömüyordu (/set/key\nvalue).
   Büyük jobs dizileri ve newline/özel karakterler URL'i geçersiz kılıp
   Upstash'ten HTTP 400 döndürüyordu. Standart ve güvenli yöntem:
     POST {UPSTASH_URL}
     Body: ["SET", "yaser_v10_jobs", "<json-string>"]
     Headers: Authorization Bearer + Content-Type application/json
   GET de aynı formatta gönderilir: ["GET", "yaser_v10_jobs"] */
async function redisCommandArgs(args) {
    const env = resolveRedisEnv();
    if (!env) {
        logMissingRedisEnv();
        throw new Error('Bulut depo yapılandırması eksik (env değişkenleri okunamadı).');
    }
    const res = await fetch(env.url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(args)
    });

    /* Hata gövdesi (text/json) okunur ve loglanır: Upstash'in 400/401/413
       gibi yanıtlarının gerçek nedeni konsolda görünür olur. */
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let errDetail = errText;
        try { errDetail = JSON.stringify(JSON.parse(errText)); } catch (e) { /* düz metin olarak bırak */ }
        console.error(
            `[/api/data] Upstash REST ${args[0]} hatası: HTTP ${res.status}` +
            (errDetail ? ` | yanıt gövdesi: ${errDetail.slice(0, 800)}` : ' | yanıt gövdesi boş')
        );
        throw new Error(`Upstash REST ${args[0]} başarısız (HTTP ${res.status})${errDetail ? ': ' + errDetail.slice(0, 200) : ''}`);
    }

    const json = await res.json().catch(() => null);
    if (json && json.error) {
        console.error(`[/api/data] Upstash REST ${args[0]} uygulama hatası:`, json.error);
        throw new Error(`Upstash REST ${args[0]} hatası: ${json.error}`);
    }
    return json ? json.result : null;
}

/* jobs[] dizisini Upstash SET değeri olarak güvenle serileştirir.
   Dairesel referans / BigInt gibi JSON'a dönüştürülemeyen yapılar
   temiz bir hata mesajıyla yakalanır; yarım veri yazılmaz. */
function serializeJobs(jobsArray) {
    if (!Array.isArray(jobsArray)) {
        throw new Error('serializeJobs: jobs dizisi değil (' + typeof jobsArray + ').');
    }
    try {
        const json = JSON.stringify(jobsArray);
        /* Upstash REST tek değer için ~1GB üst sınırına sahiptir; pratik eşik
           olarak 80MB'ta erken uyarı veririz (500'e düşmeden teşhis edilir). */
        const bytes = Buffer.byteLength(json, 'utf8');
        if (bytes > 80 * 1024 * 1024) {
            throw new Error('serializeJobs: yük çok büyük (' + Math.round(bytes / 1048576) + ' MB). Kayıt sayısını azaltın.');
        }
        return json;
    } catch (err) {
        throw new Error('jobs dizisi JSON\'a çevrilemedi (dairesel referans veya desteklenmeyen tip olabilir): ' + (err && err.message));
    }
}

/* Depodaki diziyi oku; bozuk/eksik veride güvenli boş dizi. */
function parseStoredJobs(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
    /* Kısıtlı CORS: same-origin akış için zararsız; farklı origin planlanırsa
       bilinçli olarak daraltılmalıdır. */
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Password, X-Session-Token, X-Totp-Code');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    /* ------------- POST { action:'verify' }: PRIVATE MOD PAROLA DOĞRULAMA -------------
       Private (yönetici) girişinde panel bu isteği gönderir. Redis'ten bağımsızdır:
       yalnızca APP_MASTER_PASSWORD env değeriyle karşılaştırma yapılır (timing-safe).
       200 → parola doğru; 403 → hatalı parola; 503 → sunucuda parola env'i yok. */
    if (req.method === 'POST') {
        let earlyBody = req.body;
        if (typeof earlyBody === 'string') {
            try { earlyBody = JSON.parse(earlyBody); } catch (err) { earlyBody = null; }
        }
        if (earlyBody && earlyBody.action === 'verify') {
            if (!masterPasswordConfigured()) {
                logMissingMasterPassword();
                sendJson(res, 503, { ok: false, error: 'Sunucuda APP_MASTER_PASSWORD (veya YASER_MASTER_PASSWORD) tanımlı değil; Private mod kullanılamıyor.' });
                return;
            }
            /* İKİ GEÇERLİ KİMLİK: uzun Master Parola VEYA Authenticator 6 haneli kod.
               6 rakamlı girdi TOTP olarak (±30 sn pencere), aksi hâlde parola
               olarak doğrulanır. Her iki yol da timing-safe karşılaştırma kullanır. */
            const supplied = String(earlyBody.masterPassword || '');
            const looksTotp = /^\d{6}$/.test(supplied);
            const totpReady = totpSecretConfigured();
            let ok = false;
            let via = '';
            if (looksTotp && totpReady) {
                if (totpVerify(supplied)) { ok = true; via = 'totp'; }
            } else if (!looksTotp && masterPasswordMatches(supplied)) {
                ok = true; via = 'password';
            } else if (totpReady) {
                if (totpVerify(supplied)) { ok = true; via = 'totp'; }
            }
            if (ok) {
                /* Başarılı girişte süreli oturum belirteci verilir: toplu bulut
                   yazımı bundan böyle parola yerine bu belirteçle yetkilendirilir. */
                const tokenTtl = looksTotp ? SESSION_TOKEN_TTL_TOTP_MS : SESSION_TOKEN_TTL_PASSWORD_MS;
                const sessionToken = createSessionToken(tokenTtl);
                sendJson(res, 200, { ok: true, mode: 'private', via: via, sessionToken: sessionToken, tokenTtlMs: tokenTtl });
            } else {
                console.warn('[/api/data] 403: Private mod doğrulaması başarısız (parola/TOTP).');
                sendJson(res, 403, { ok: false, error: 'Hatalı parola veya kod. Erişim reddedildi.' });
            }
            return;
        }
    }

    if (!redisConfigured()) {
        logMissingRedisEnv();
        sendJson(res, 503, { ok: false, error: 'Bulut depo yapılandırılmadı: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (veya KV_REST_API_URL / KV_REST_API_TOKEN) ortam değişkenleri tanımlı değil.' });
        return;
    }

    try {
        /* ------------ GET ?setup=totp: otpauth URI üretimi (yönetici) ---------
           Google Authenticator eşleştirmesi için. İstek Master Parola veya
           geçerli oturum belirteci taşımak ZORUNDADIR; TOTP gizli anahtarı
           ASLA yanıt içinde döndürülmez — yalnızca otpauth URI üretilir
           (Authenticator zaten URI üzerinden taranır). */
        if (req.method === 'GET') {
            const urlObj = new URL(req.url, 'http://localhost');
            if (urlObj.searchParams.get('setup') === 'totp') {
                const authPw = (req.headers && req.headers['x-master-password']) || '';
                const authTk = (req.headers && req.headers['x-session-token']) || '';
                const authed = masterPasswordMatches(String(authPw || '')) || sessionTokenValid(String(authTk || ''));
                if (!authed) {
                    sendJson(res, 403, { ok: false, error: 'Yetkisiz: otpauth URI yalnızca Master Parola veya geçerli oturum belirteciyle alınabilir.' });
                    return;
                }
                if (!totpSecretConfigured()) {
                    sendJson(res, 503, { ok: false, error: 'Sunucuda TOTP_SECRET (Base32) ortam değişkeni tanımlı değil.' });
                    return;
                }
                const uri = 'otpauth://totp/ProjeTakip:Admin?secret=' + encodeURIComponent(resolveTotpSecret())
                    + '&issuer=ProjeTakip&algorithm=SHA1&digits=6&period=30';
                sendJson(res, 200, { ok: true, otpauthUri: uri });
                return;
            }
            const raw = await redisCommandArgs(['GET', JOBS_KEY]);
            sendJson(res, 200, { ok: true, jobs: parseStoredJobs(raw) });
            return;
        }

        /* ---------------- POST: kaydet (upsert / tam senkron) ---------------- */
        if (req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (err) { body = null; }
            }

            const incomingJob = body && body.job && typeof body.job === 'object' ? body.job : null;
            const incomingJobs = body && Array.isArray(body.jobs) ? body.jobs : null;

            /* TOPLU YAZIM YETKİ KONTROLÜ (Private mod / yönetici tam senkronu):
               { jobs:[...] } gövdeli istekler yetki taşımak zorundadır. Yetki
               İKİ YOL: (a) verify'dan alınan süreli X-Session-Token (tercih
               edilen; parola/kod istekler arasında tekrar taşınmaz) veya
               (b) doğrudan Master Parola (X-Master-Password). Guest form
               akışı ({ job:{...} }) bu kontrolün DIŞINDADIR. */
            if (incomingJobs) {
                if (!masterPasswordConfigured()) {
                    logMissingMasterPassword();
                    sendJson(res, 503, {
                        ok: false,
                        error: 'Toplu bulut yazımı kapalı: sunucuda APP_MASTER_PASSWORD ortam değişkeni tanımlı değil. Private mod yönetici yazımı devre dışı.'
                    });
                    return;
                }
                const sessionToken = (req.headers && (req.headers['x-session-token'] || req.headers['X-Session-Token']))
                    || (body && typeof body.sessionToken === 'string' ? body.sessionToken : '');
                if (sessionToken && sessionTokenValid(String(sessionToken))) {
                    /* Süreli belirteç geçerli: yetki verildi. */
                } else {
                    const supplied = (req.headers && req.headers['x-master-password'])
                        || (body && typeof body.masterPassword === 'string' ? body.masterPassword : '');
                    if (!masterPasswordMatches(String(supplied || ''))) {
                        console.warn('[/api/data] 403: Toplu yazım reddedildi — geçerli oturum belirteci veya Master Parola yok.');
                        sendJson(res, 403, { ok: false, error: 'Yetkisiz istek: Oturum belirteci/Master Parola doğrulaması başarısız. Toplu bulut yazımı yalnızca Private (yönetici) modda yapılabilir.' });
                        return;
                    }
                }
            }

            if (!incomingJob && !incomingJobs) {
                sendJson(res, 400, { ok: false, error: 'Geçersiz gövde: { job:{...} } ya da { jobs:[...] } bekleniyor.' });
                return;
            }

            const current = parseStoredJobs(await redisCommandArgs(['GET', JOBS_KEY]));
            let next;

            if (incomingJobs) {
                /* Yönetici tam senkronu: dizi aynen yazılır. */
                next = incomingJobs;
            } else {
                /* Guest form güncellemesi: ID'ye göre upsert. Guest kaydı
                   saveJob() şemasıyla aynı tam nesneyi gönderir. */
                const guestId = String((incomingJob && incomingJob.id) || '');
                if (!guestId) {
                    sendJson(res, 400, { ok: false, error: 'İş kaydında id alanı zorunludur.' });
                    return;
                }
                const idx = current.findIndex(j => j && String(j.id) === guestId);
                next = current.slice();
                if (idx >= 0) next[idx] = incomingJob;
                else next.unshift(incomingJob);
            }

            /* Serileştirme ÖNCE yapılır: dairesel referans / aşırı büyük yük
               gibi sorunlar 500'e düşmeden yakalanır. */
            const serialized = serializeJobs(next);

            /* SET: komut dizisi formatı — değer URL'de değil, POST gövdesinde. */
            await redisCommandArgs(['SET', JOBS_KEY, serialized]);

            sendJson(res, 200, { ok: true, jobs: next, count: next.length });
            return;
        }

        sendJson(res, 405, { ok: false, error: 'Yalnızca GET ve POST desteklenir.' });
    } catch (err) {
        sendJson(res, 500, { ok: false, error: (err && err.message) || 'Bilinmeyen sunucu hatası.' });
    }
};
