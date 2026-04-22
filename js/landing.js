// Landing CMU — lógica do poema do mês, calendário vertical e comunicados.
// Requer: yamatomizu-data.js (TODAS_POESIAS, MESES_PT, DIAS_SEMANA, FERIADOS_BRASILEIROS)
//         supabase-client.js (window.supabase já inicializado)

(() => {
  const hoje = new Date();
  const estado = {
    mes: hoje.getMonth(),      // 0..11
    ano: hoje.getFullYear()
  };

  // ------------------------------------------------------------
  // Poema do mês
  // ------------------------------------------------------------
  function poemaDoMes(mesIndex /* 0..11 */) {
    const mes1 = mesIndex + 1;
    const candidatos = (window.TODAS_POESIAS || [])
      .filter(p => Array.isArray(p.meses) && p.meses.includes(mes1));
    if (!candidatos.length) return null;
    // Rotaciona por ano para não mostrar sempre o mesmo poema no mesmo mês
    const seed = estado.ano * 13 + mes1;
    return candidatos[seed % candidatos.length];
  }

  function dividirPoemaEm2(texto) {
    if (!texto) return ['', ''];
    const partes = texto.replace(/　/g, ' ').split(' ').filter(p => p.trim());
    const metade = Math.ceil(partes.length / 2);
    return [
      partes.slice(0, metade).join(''),
      partes.slice(metade).join('')
    ];
  }

  function renderPoema(poema) {
    const painel = document.querySelector('#poema-painel');
    if (!painel) return;
    if (!poema) {
      painel.hidden = true;
      return;
    }
    painel.hidden = false;
    const linhas = dividirPoemaEm2(poema.original);
    painel.innerHTML = `
      <div class="poema-vertical" aria-hidden="true">
        ${linhas.map(l => `<div class="poema-linha">${l}</div>`).join('')}
      </div>
      <p class="poema-romaji"><em>${poema.romaji || ''}</em></p>
      <p class="poema-traducao">${poema.translation || ''}</p>
    `;
  }

  // ------------------------------------------------------------
  // Calendário
  // ------------------------------------------------------------
  function primeiroDiaDoMes(ano, mes) { return new Date(ano, mes, 1).getDay(); }
  function diasNoMes(ano, mes) { return new Date(ano, mes + 1, 0).getDate(); }

  function renderCalendario(eventosPorDia) {
    const wrap = document.querySelector('#calendario');
    if (!wrap) return;
    const { mes, ano } = estado;
    const meses = window.MESES_PT || [];
    const diasKanji = window.DIAS_DA_SEMANA_COM_KANJI || [];
    const feriados = (window.FERIADOS_BRASILEIROS || {})[mes] || [];
    const feriadoDoDia = new Map(feriados.map(f => [f.dia, f.nome]));

    const total = diasNoMes(ano, mes);
    const offset = primeiroDiaDoMes(ano, mes);
    const hojeDia = (hoje.getFullYear() === ano && hoje.getMonth() === mes) ? hoje.getDate() : null;

    // Gera linha de dia
    function diaHTML(d) {
      const dow = new Date(ano, mes, d).getDay();
      const kanji = diasKanji[dow] || { jp: '', pt: '' };
      const feriado = feriadoDoDia.get(d);
      const ev = eventosPorDia.get(d);

      const classes = ['cal-dia'];
      if (dow === 0) classes.push('cal-domingo');
      if (dow === 6) classes.push('cal-sabado');
      if (feriado) classes.push('cal-feriado');
      if (d === hojeDia) classes.push('cal-hoje');

      const eventosHTML = ev ? ev.map(e => `
        <div class="cal-evento-chip">
          ${e.description ? `<span class="cal-evento-hora">${escapar(e.description)}</span>` : ''}
          <span class="cal-evento-nome">${escapar(e.title)}</span>
        </div>
      `).join('') : '';

      return `
        <div class="${classes.join(' ')}" ${feriado ? `title="${escapar(feriado)}"` : ''}>
          <span class="cal-num">${String(d).padStart(2, '0')}</span>
          <span class="cal-kanji">${kanji.jp}</span>
          <div class="cal-dia-eventos">${eventosHTML}</div>
        </div>
      `;
    }

    const metade = Math.ceil(total / 2);
    const col1 = Array.from({ length: metade }, (_, i) => diaHTML(i + 1)).join('');
    const col2 = Array.from({ length: total - metade }, (_, i) => diaHTML(metade + i + 1)).join('');

    wrap.innerHTML = `
      <header class="cal-header">
        <button class="cal-nav" data-dir="-1" aria-label="Mês anterior">‹</button>
        <div class="cal-mes-wrap">
          <div class="cal-ano">${ano}</div>
          <div class="cal-mes-nome">${(meses[mes] || '').toUpperCase()}</div>
        </div>
        <button class="cal-nav" data-dir="1" aria-label="Próximo mês">›</button>
      </header>
      <div class="cal-2col">
        <div class="cal-col">${col1}</div>
        <div class="cal-col">${col2}</div>
      </div>
    `;

    wrap.querySelectorAll('.cal-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = Number(btn.dataset.dir);
        estado.mes += dir;
        if (estado.mes < 0) { estado.mes = 11; estado.ano -= 1; }
        if (estado.mes > 11) { estado.mes = 0; estado.ano += 1; }
        atualizar();
      });
    });
  }

  async function carregarEventosDoMes() {
    const { mes, ano } = estado;
    const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    const fimDia = diasNoMes(ano, mes);
    const fim = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(fimDia).padStart(2, '0')}`;
    try {
      const { data, error } = await window.supabase
        .from('calendar_events')
        .select('date, title, description')
        .gte('date', inicio)
        .lte('date', fim)
        .order('date', { ascending: true });
      if (error) throw error;
      const mapa = new Map();
      (data || []).forEach(ev => {
        const dia = Number(ev.date.slice(8, 10));
        if (!mapa.has(dia)) mapa.set(dia, []);
        mapa.get(dia).push(ev);
      });
      return mapa;
    } catch (e) {
      console.warn('[landing] falha ao carregar eventos:', e);
      return new Map();
    }
  }

  // ------------------------------------------------------------
  // Comunicados
  // ------------------------------------------------------------
  async function carregarComunicados() {
    const painel = document.querySelector('#comunicados-painel');
    if (!painel) return;
    try {
      const { data, error } = await window.supabase
        .from('announcements')
        .select('title, body, published_at')
        .eq('is_active', true)
        .order('published_at', { ascending: false });
      if (error) throw error;
      if (!data || !data.length) {
        painel.hidden = true;
        return;
      }
      painel.hidden = false;
      painel.innerHTML = `
        <div class="comunicados-header">
          <span class="comunicados-kigo">Comunicados</span>
        </div>
        <div class="comunicados-lista">
          ${data.map(c => `
            <article class="comunicado-item">
              <header class="comunicado-item-header">
                <h3 class="comunicado-titulo">${escapar(c.title)}</h3>
                <time class="comunicado-data">${formatarData(c.published_at)}</time>
              </header>
              <div class="comunicado-body">${formatarBody(c.body)}</div>
            </article>
          `).join('')}
        </div>
      `;
    } catch (e) {
      console.warn('[landing] falha ao carregar comunicados:', e);
      painel.hidden = true;
    }
  }

  function formatarData(iso) {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return iso; }
  }

  function formatarBody(texto) {
    // Transforma quebras de linha em parágrafos, escapando HTML.
    return escapar(texto || '')
      .split(/\n{2,}/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function escapar(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ------------------------------------------------------------
  // Orquestração
  // ------------------------------------------------------------
  async function atualizar() {
    const eventos = await carregarEventosDoMes();
    renderCalendario(eventos);
    renderPoema(poemaDoMes(estado.mes));
  }

  function inicializar() {
    atualizar();
    carregarComunicados();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
