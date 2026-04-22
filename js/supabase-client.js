// Client Supabase público (anon key) para a landing CMU.
// Mesmo projeto usado pelo admin em mioshie_college_app/js/supabase-config.js.
// A anon key é pública por design — RLS no banco garante o isolamento.

const SUPABASE_URL = 'https://succhmnbajvbpmoqrktq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y2NobW5iYWp2YnBtb3Fya3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjY3MDgsImV4cCI6MjA5MjA0MjcwOH0.humCcLYpnnnapkLtLOeb9ZVo5EZWoWw6ItNo0WVY3DY';

// O SDK exposto via CDN registra `window.supabase` como o módulo.
// Reassinala `window.supabase` para a INSTÂNCIA do client (landing.js espera isso).
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
