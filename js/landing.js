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
  // Estações brasileiras — cada uma cobre 3 meses (a ordem define a posição
  // 0/1/2 do mês dentro da estação, usada pela rotação anti-repetição).
  // ------------------------------------------------------------
  const ESTACOES = [
    { key: 'verao',     kigo: 'Verão',     meses: [12, 1, 2] },
    { key: 'outono',    kigo: 'Outono',    meses: [3, 4, 5] },
    { key: 'inverno',   kigo: 'Inverno',   meses: [6, 7, 8] },
    { key: 'primavera', kigo: 'Primavera', meses: [9, 10, 11] }
  ];

  function estacaoDoMes(mes1 /* 1..12 */) {
    const est = ESTACOES.find(s => s.meses.includes(mes1)) || null;
    const pos = est ? est.meses.indexOf(mes1) : 0;
    return { est, pos };
  }

  // "Ano da estação": no verão, dezembro abre o ciclo que continua em jan/fev do
  // ano seguinte. Fazendo dez usar o próprio ano e jan/fev usarem (ano-1), os
  // três meses compartilham o mesmo k → trio consecutivo dez→jan→fev sem repetir.
  function anoDaEstacao(est, mes1, ano) {
    if (est && est.key === 'verao' && mes1 !== 12) return ano - 1;
    return ano;
  }

  // Escolhe 1 poema do pool da estação garantindo 3 DISTINTOS por trimestre (um
  // por mês, posições 0/1/2) e avançando o trio +3 a cada ano — determinístico,
  // sem precisar guardar histórico. Requer pool com ≥3 poemas p/ nunca repetir.
  function escolherDoPool(pool, mes1, ano) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    const { est, pos } = estacaoDoMes(mes1);
    const k = anoDaEstacao(est, mes1, ano);
    const n = pool.length;
    const off = (((k * 3) % n) + n) % n;
    return pool[(off + pos) % n];
  }

  // ------------------------------------------------------------
  // Poema do mês
  // ------------------------------------------------------------
  function poemaDoMes(mesIndex /* 0..11 */) {
    const mes1 = mesIndex + 1;
    const { est } = estacaoDoMes(mes1);
    // 1) Pool curado no admin (public.landing_config.season_pools), se existir.
    const pools = estado.seasonPools;
    if (pools && est && Array.isArray(pools[est.key]) && pools[est.key].length) {
      const p = escolherDoPool(pools[est.key], mes1, estado.ano);
      if (p) return p;
    }
    // 2) Fallback: TODAS_POESIAS agrupado por estação (mesma regra anti-repetição).
    if (est) {
      const fb = (window.TODAS_POESIAS || []).filter(p => p.kigo === est.kigo);
      if (fb.length) return escolherDoPool(fb, mes1, estado.ano);
    }
    // 3) Último recurso: filtro antigo por meses.
    const cand = (window.TODAS_POESIAS || [])
      .filter(p => Array.isArray(p.meses) && p.meses.includes(mes1));
    if (!cand.length) return null;
    return cand[(estado.ano * 13 + mes1) % cand.length];
  }

  // Pools sazonais curados no admin. Query própria (separada do poema fixo) para
  // ser resiliente: se a coluna season_pools ainda não existir, só desativa os
  // pools — o poema fixo e a rotação de fallback seguem funcionando.
  async function carregarSeasonPools() {
    try {
      const { data, error } = await window.supabase
        .from('landing_config')
        .select('season_pools')
        .eq('id', 1)
        .maybeSingle();
      if (error || !data || !data.season_pools) return null;
      return data.season_pools; // jsonb já chega como objeto
    } catch (e) {
      return null;
    }
  }

  // Poema fixo escolhido no admin (public.landing_config id=1). Quando ativo e
  // com algum texto, substitui a rotação automática por mês. Resiliente: se as
  // colunas ainda não existirem ou der erro, retorna null e a landing volta à
  // rotação normal. Mesmo padrão de carregarSkinComunicados().
  async function carregarPoemaManual() {
    try {
      const { data, error } = await window.supabase
        .from('landing_config')
        .select('poema_ativo, poema_titulo, poema_original, poema_romaji, poema_translation, poema_autor')
        .eq('id', 1)
        .maybeSingle();
      if (error || !data || !data.poema_ativo) return null;
      const titulo      = (data.poema_titulo || '').trim();
      const original    = (data.poema_original || '').trim();
      const romaji       = (data.poema_romaji || '').trim();
      const translation = (data.poema_translation || '').trim();
      const autor       = (data.poema_autor || '').trim();
      if (!original && !romaji && !translation) return null;
      return { titulo, original, romaji, translation, autor };
    } catch (e) {
      return null;
    }
  }

  // ------------------------------------------------------------
  // Skeleton e revelação de conteúdo
  // ------------------------------------------------------------
  function fileirasCalendario(n) {
    return Array.from({ length: n }, () => `
      <div class="skel-row">
        <div class="skel"></div>
        <div class="skel"></div>
        <div class="skel"></div>
      </div>`).join('');
  }

  function skeletonCalendario() {
    const wrap = document.querySelector('#calendario');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="skel-cal-head">
        <div class="skel skel-cal-btn"></div>
        <div class="skel skel-cal-mes"></div>
        <div class="skel skel-cal-btn"></div>
      </div>
      <div class="skel-2col">
        <div class="skel-col">${fileirasCalendario(15)}</div>
        <div class="skel-col">${fileirasCalendario(16)}</div>
      </div>`;
  }

  function skeletonPoema() {
    const painel = document.querySelector('#poema-painel');
    if (!painel) return;
    painel.hidden = false;
    painel.innerHTML = `
      <div class="skel-poema">
        <div class="skel"></div>
        <div class="skel"></div>
        <div class="skel"></div>
        <div class="skel"></div>
        <div class="skel"></div>
      </div>`;
  }

  function revelarConteudo(el, html, aposInserir) {
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.innerHTML = html;
    if (aposInserir) aposInserir();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'opacity .35s ease';
      el.style.opacity = '1';
    }));
  }

  // Cabeçalho do poema. Com "autor" (linha de cima, vinda do admin) usa o layout
  // em destaque: kicker dourado + título serifado da coleção. Sem autor, cai no
  // eyebrow discreto — igual ao "Yama to Mizu" da rotação por mês. A parte entre
  // parênteses (kanji) fica sempre mais leve, em Noto Serif JP.
  function cabecalhoPoemaHTML(poema) {
    const titulo = (poema.titulo && poema.titulo.trim()) || 'Poemas "Yama to Mizu" (山と水)';
    const autor = poema.autor && poema.autor.trim();
    const m = titulo.match(/^(.*?)\s*(\([^)]*\))\s*$/);
    const tituloHTML = m
      ? `${escapar(m[1])} <span class="poema-titulo-kanji">${escapar(m[2])}</span>`
      : escapar(titulo);
    if (autor) {
      return `<div class="poema-kicker">${escapar(autor)}</div>
        <div class="poema-titulo">${tituloHTML}</div>`;
    }
    return `<div class="poema-titulo poema-titulo--eyebrow">${tituloHTML}</div>`;
  }

  // Romaji e tradução podem ter quebras de linha intencionais (definidas no
  // admin): cada \n vira <br>. Escapa antes — renderização segura.
  function multilinhaHTML(texto) {
    return escapar(texto || '').replace(/\n+/g, '<br>');
  }

  function renderPoema(poema) {
    const painel = document.querySelector('#poema-painel');
    if (!painel) return;
    if (!poema) {
      painel.hidden = true;
      return;
    }
    painel.hidden = false;
    revelarConteudo(painel, `
      <div class="poema-header">
        ${cabecalhoPoemaHTML(poema)}
      </div>
      <div class="poema-corpo">
        <div class="poema-jp">
          <div class="poema-vertical" aria-hidden="true">${escapar(poema.original || '')}</div>
          <p class="poema-romaji"><em>${multilinhaHTML(poema.romaji)}</em></p>
        </div>
        <p class="poema-traducao">${multilinhaHTML(poema.translation)}</p>
      </div>
    `);
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
          <span class="cal-evento-nome">${escapar(e.title)}</span>
          ${e.description ? `<span class="cal-evento-hora">${escapar(e.description)}</span>` : ''}
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

    revelarConteudo(wrap, `
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
    `, () => {
      wrap.querySelectorAll('.cal-nav').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = Number(btn.dataset.dir);
          estado.mes += dir;
          if (estado.mes < 0) { estado.mes = 11; estado.ano -= 1; }
          if (estado.mes > 11) { estado.mes = 0; estado.ano += 1; }
          atualizar();
        });
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
  // Dados de acesso — difusões e casa de Johrei
  // ------------------------------------------------------------
  async function carregarDadosAcesso() {
    const painel = document.querySelector('#acesso-painel');
    if (!painel) return;
    try {
      const { data, error } = await window.supabase
        .from('access_info')
        .select('category, nome, endereco, telefone, dias, horario, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const registros = data || [];
      if (!registros.length) return;

      function cardHTML(r) {
        const tel = r.telefone ? r.telefone.replace(/\D/g, '') : null;
        return `
          <div class="acesso-card">
            ${r.nome ? `<div class="acesso-nome">${escapar(r.nome)}</div>` : ''}
            ${r.endereco ? `
              <div class="acesso-detalhe">
                <span class="acesso-detalhe-label">Endereço</span>
                <span class="acesso-detalhe-valor">${escapar(r.endereco)}</span>
              </div>` : ''}
            ${r.dias ? `
              <div class="acesso-detalhe">
                <span class="acesso-detalhe-label">Dias</span>
                <span class="acesso-detalhe-valor">${escapar(r.dias)}</span>
              </div>` : ''}
            ${r.horario ? `
              <div class="acesso-detalhe">
                <span class="acesso-detalhe-label">Horário</span>
                <span class="acesso-detalhe-valor">${escapar(r.horario)}</span>
              </div>` : ''}
            ${r.telefone ? `
              <div class="acesso-detalhe">
                <span class="acesso-detalhe-label">Telefone</span>
                <a class="acesso-detalhe-valor" href="tel:+55${tel}">${escapar(r.telefone)}</a>
              </div>` : ''}
          </div>`;
      }

      const grupos = {};
      registros.forEach(r => {
        const cat = r.category || 'Outros';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(r);
      });

      const isSede = cat => /sede/i.test(cat);
      const sedeCards = Object.entries(grupos)
        .filter(([c]) => isSede(c))
        .flatMap(([, rs]) => rs)
        .map(cardHTML).join('');
      const outrosCards = Object.entries(grupos)
        .filter(([c]) => !isSede(c))
        .flatMap(([, rs]) => rs)
        .map(cardHTML).join('');
      const outrosGrupos = outrosCards ? `
          <div class="acesso-grupo">
            <div class="acesso-grupo-titulo">Regionais, Difusões e Núcleos do Johrei</div>
            <div class="acesso-grupo-cards">${outrosCards}</div>
          </div>` : '';

      const html = `
        <div class="acesso-header">
          <span class="acesso-kigo">Acesso</span>
        </div>
        <div class="acesso-layout">
          ${sedeCards ? `<div class="acesso-sede">${sedeCards}</div>` : ''}
          ${outrosGrupos ? `<div class="acesso-outros">${outrosGrupos}</div>` : ''}
        </div>`;

      painel.hidden = false;
      revelarConteudo(painel, html);
    } catch (e) {
      console.warn('[landing] falha ao carregar dados de acesso:', e);
    }
  }

  // ------------------------------------------------------------
  // Comunicados
  // ------------------------------------------------------------
  function ocultarComunicados(painel) {
    painel.hidden = true;
    painel.style.display = 'none';
    painel.innerHTML = '';
  }

  async function carregarComunicados() {
    const painel = document.querySelector('#comunicados-painel');
    if (!painel) return;
    ocultarComunicados(painel);
    try {
      const { data, error } = await window.supabase
        .from('announcements')
        .select('title, body, published_at')
        .eq('is_active', true)
        .order('published_at', { ascending: false });
      if (error) throw error;
      const ativos = (data || []).filter(c => (c.title && c.title.trim()) || (c.body && c.body.trim()));
      if (!ativos.length) return;
      const skin = await carregarSkinComunicados();
      const solo = ativos.length === 1;
      painel.hidden = false;
      painel.style.display = '';
      // Skin global no painel (escolhido no admin). Com SÓ 1 comunicado, entra o
      // modo "solo": sem cabeçalho de seção — o item leva o eyebrow "Comunicado"
      // + hairline sob o título. Com vários, um cabeçalho "Comunicados" no topo
      // e os itens sem repetir o rótulo.
      painel.className = `comunicados-painel comunicados--${skin}${solo ? ' comunicados--solo' : ''}`;
      painel.innerHTML = `
        ${solo ? '' : '<h2 class="comunicados-titulo">Comunicados</h2>'}
        <div class="comunicados-lista">
          ${ativos.map(c => `
            <article class="comunicado-item">
              ${solo ? '<div class="comunicado-kicker">Comunicado</div>' : ''}
              <h3 class="comunicado-titulo">${escapar(c.title)}</h3>
              <div class="comunicado-body">${formatarBody(c.body)}</div>
            </article>
          `).join('')}
        </div>
      `;
    } catch (e) {
      console.warn('[landing] falha ao carregar comunicados:', e);
      ocultarComunicados(painel);
    }
  }

  // Skin global dos comunicados (a/b/c), de public.landing_config (id=1).
  // Resiliente: se a tabela/linha ainda não existe ou der erro, cai no 'c'.
  async function carregarSkinComunicados() {
    try {
      const { data, error } = await window.supabase
        .from('landing_config')
        .select('comunicados_skin')
        .eq('id', 1)
        .maybeSingle();
      if (error) return 'c';
      const s = data && data.comunicados_skin;
      return ['a', 'b', 'c'].includes(s) ? s : 'c';
    } catch (e) {
      return 'c';
    }
  }

  function formatarBody(texto) {
    // Escapa HTML, separa parágrafos por linha em branco e converte
    // **trecho** em negrito e *trecho* em itálico.
    return escapar(texto || '')
      .split(/\n{2,}/)
      .map(p => `<p>${aplicarFormatacao(p.replace(/\n/g, '<br>'))}</p>`)
      .join('');
  }

  // **trecho** -> <strong>trecho</strong>, *trecho* -> <em>trecho</em>
  // Aplicado SOMENTE depois de escapar(), então todo HTML do texto
  // já virou entidade; garantindo renderização segura.
  function aplicarFormatacao(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
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
    // Busca o poema fixo e os pools sazonais do admin uma vez e cacheia; nas
    // trocas de mês reusa.
    if (estado.poemaManual === undefined) {
      estado.poemaManual = await carregarPoemaManual();
    }
    if (estado.seasonPools === undefined) {
      estado.seasonPools = await carregarSeasonPools();
    }
    renderPoema(estado.poemaManual || poemaDoMes(estado.mes));
  }

  function inicializar() {
    skeletonCalendario();
    skeletonPoema();
    atualizar();
    carregarDadosAcesso();
    carregarComunicados();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
