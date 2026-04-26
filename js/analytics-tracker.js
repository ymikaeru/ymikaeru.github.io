// Analytics tracker — fire-and-forget visit log to Supabase.
// Writes to public.landing_visits (caminho_da_felicidade project).
// Public anon inserts are allowed by RLS; reads are admin-only.

(function () {
    const SUPABASE_URL = 'https://succhmnbajvbpmoqrktq.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y2NobW5iYWp2YnBtb3Fya3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjY3MDgsImV4cCI6MjA5MjA0MjcwOH0.humCcLYpnnnapkLtLOeb9ZVo5EZWoWw6ItNo0WVY3DY';
    const STORAGE_KEY = 'cmu_landing_anon_id';
    const SESSION_KEY = 'cmu_landing_visit_logged';

    function getAnonId() {
        try {
            let id = localStorage.getItem(STORAGE_KEY);
            if (!id) {
                id = (crypto?.randomUUID?.() || _uuidFallback());
                localStorage.setItem(STORAGE_KEY, id);
            }
            return id;
        } catch (e) {
            return _uuidFallback();
        }
    }

    function _uuidFallback() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function logVisit() {
        try {
            if (sessionStorage.getItem(SESSION_KEY)) return;
            sessionStorage.setItem(SESSION_KEY, '1');
        } catch (e) { /* sessionStorage disabled — log anyway */ }

        const body = {
            anon_id: getAnonId(),
            path: location.pathname + location.search,
            referrer: document.referrer || null,
            user_agent: navigator.userAgent?.slice(0, 500) || null,
            lang: navigator.language || null,
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };

        fetch(`${SUPABASE_URL}/rest/v1/landing_visits`, {
            method: 'POST',
            mode: 'cors',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(body)
        }).then(async r => {
            if (!r.ok) {
                const txt = await r.text().catch(() => '');
                console.warn('[analytics] insert failed', r.status, txt);
            } else {
                console.debug('[analytics] visit logged');
            }
        }).catch(err => console.warn('[analytics] network error', err));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', logVisit, { once: true });
    } else {
        logVisit();
    }
})();
