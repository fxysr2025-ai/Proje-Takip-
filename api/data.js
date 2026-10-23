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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Master-Password');

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
            if (masterPasswordMatches(String(earlyBody.masterPassword || ''))) {
                sendJson(res, 200, { ok: true, mode: 'private' });
            } else {
                console.warn('[/api/data] 403: Private mod parola doğrulaması başarısız (hatalı parola).');
                sendJson(res, 403, { ok: false, error: 'Hatalı Master Parola. Erişim reddedildi.' });
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
        /* ---------------- GET: tüm jobs dizisini döndür ---------------- */
        if (req.method === 'GET') {
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
               { jobs:[...] } gövdeli istekler Master Parola taşımak zorundadır.
               Guest form akışı ({ job:{...} }) bu kontrolün dışındadır. */
            if (incomingJobs) {
                if (!masterPasswordConfigured()) {
                    logMissingMasterPassword();
                    sendJson(res, 503, {
                        ok: false,
                        error: 'Toplu bulut yazımı kapalı: sunucuda APP_MASTER_PASSWORD ortam değişkeni tanımlı değil. Private mod yönetici yazımı devre dışı.'
                    });
                    return;
                }
                const supplied = (req.headers && req.headers['x-master-password'])
                    || (body && typeof body.masterPassword === 'string' ? body.masterPassword : '');
                if (!masterPasswordMatches(String(supplied || ''))) {
                    console.warn('[/api/data] 403: Toplu yazım reddedildi — Master Parola eksik veya hatalı.');
                    sendJson(res, 403, { ok: false, error: 'Yetkisiz istek: Master Parola doğrulaması başarısız. Toplu bulut yazımı yalnızca Private (yönetici) modda yapılabilir.' });
                    return;
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
