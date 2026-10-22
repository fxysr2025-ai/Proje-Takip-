/* ==========================================================================
   VERCEL SERVERLESS FUNCTION — /api/data  (dosya: /api/data.js)
   --------------------------------------------------------------------------
   AMAÇ
   Guest Form Mode akışında dış paylaşımlı formdan gelen iş kaydı güncellemesi
   ile yönetici panelinin bulut senkronizasyonunu yönetir.

   DEPOLAMA
   Upstash Redis REST API (HTTP tabanlı; serverless'ta bağlantı havuzu
   gerektirmediği için standart redis client yerine REST tercih edilir).
   Gerekli environment değişkenleri (Vercel > Project > Settings > Environment Variables):
     UPSTASH_REDIS_REST_URL    ör. https://xxxx.upstash.io
     UPSTASH_REDIS_REST_TOKEN  REST token (yazma yetkili)

   VERİ ŞEMASI (DEĞİŞTİRME — mevcut uygulama düzeniyle birebir):
   Anahtar: "yaser_v10_jobs"  →  Değer: jobs[] dizisinin JSON'u.
   GET  → { ok:true, jobs:[...] }     (anahtar yoksa { ok:true, jobs:[] })
   POST → gövde: { jobs:[...] }  ya da  { job:{...} }
           - job gönderilirse sunucu, mevcut dizideki eş ID'li kaydı günceller,
             yoksa ekler (upsert) ve TÜM diziyi döndürür.
           - jobs gönderilirse dizi aynen yazılır (yönetici tam senkronu).
   CORS: dış form aynı origin'de çalışır; yine de kısıtlı CORS başlıkları
   eklenir (ileride ayrı domain'den erişim gerekirse hazır olur).
   ========================================================================== */

const JOBS_KEY = 'yaser_v10_jobs';

/* Upstash REST URL'i sondaki eğik çizgiye karşı normalize edilir. */
function getRedisUrl() {
    const raw = process.env.UPSTASH_REDIS_REST_URL || '';
    return raw.replace(/\/+$/, '');
}

function redisConfigured() {
    return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/* Upstash REST komut çağrısı: GET <url>/<command>/<arg>
   Anahtar/değer path içinde taşındığı için URL-encode zorunludur. */
async function redisCommand(command, arg) {
    const url = `${getRedisUrl()}/${command}/${encodeURIComponent(arg)}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
    });
    if (!res.ok) {
        throw new Error(`Upstash REST ${command} başarısız (HTTP ${res.status})`);
    }
    const json = await res.json();
    if (json && json.error) {
        throw new Error(`Upstash REST ${command} hatası: ${json.error}`);
    }
    return json.result;
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    if (!redisConfigured()) {
        sendJson(res, 503, { ok: false, error: 'Bulut depo yapılandırılmadı (UPSTASH_REDIS_REST_URL / TOKEN eksik).' });
        return;
    }

    try {
        /* ---------------- GET: tüm jobs dizisini döndür ---------------- */
        if (req.method === 'GET') {
            const raw = await redisCommand('get', JOBS_KEY);
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

            if (!incomingJob && !incomingJobs) {
                sendJson(res, 400, { ok: false, error: 'Geçersiz gövde: { job:{...} } ya da { jobs:[...] } bekleniyor.' });
                return;
            }

            const current = parseStoredJobs(await redisCommand('get', JOBS_KEY));
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

            await redisCommand('set', `${JOBS_KEY}\n${JSON.stringify(next)}`);

            sendJson(res, 200, { ok: true, jobs: next, count: next.length });
            return;
        }

        sendJson(res, 405, { ok: false, error: 'Yalnızca GET ve POST desteklenir.' });
    } catch (err) {
        sendJson(res, 500, { ok: false, error: (err && err.message) || 'Bilinmeyen sunucu hatası.' });
    }
};
