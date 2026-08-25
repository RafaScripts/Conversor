/* =========================================================================
   app.js — Lógica do painel: abas, upload, fila, conversão, visualização,
   histórico persistente (localStorage) e materiais de exemplo.
   ========================================================================= */
(function () {
  "use strict";

  var CHAVE_HISTORICO = "lp2-materiais-acessiveis:historico:v1";

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    statusGlobal: $("statusGlobal"), statusGlobalTexto: $("statusGlobalTexto"),
    dropZone: $("dropZone"), inputArquivos: $("inputArquivos"), uploadErro: $("uploadErro"),
    btnSelecionar: $("btnSelecionar"), btnProcessar: $("btnProcessar"), btnLimparFila: $("btnLimparFila"),
    filaLista: $("filaLista"), filaVazia: $("filaVazia"), filaCont: $("filaCont"),
    resultadoVazio: $("resultadoVazio"), resultadoPainel: $("resultadoPainel"),
    resultadoTitulo: $("resultadoTitulo"), resultadoMeta: $("resultadoMeta"),
    btnSalvar: $("btnSalvar"), btnBaixar: $("btnBaixar"),
    rtabPre: $("rtabPre"), rtabMd: $("rtabMd"), painelPre: $("painelPre"), painelMd: $("painelMd"),
    editorMd: $("editorMd"), documentoPre: $("documentoPre"),
    tabelaHistorico: $("tabelaHistorico"), historicoCorpo: $("historicoCorpo"),
    historicoVazio: $("historicoVazio"), historicoTotal: $("historicoTotal"), btnLimparHistorico: $("btnLimparHistorico"),
    exemplosLista: $("exemplosLista"),
    aviso: $("aviso"), formUpload: $("formUpload")
  };

  var fila = [];        // { id, nome, tipo, file, status, progresso, erro }
  var emProcessamento = false;
  var ultimoResultado = null; // { nome, tipo, markdown, meta }
  var historico = carregarHistorico();

  // ---------- utilidades ----------
  function aviso(msg, tipo) {
    el.aviso.innerHTML = "";
    var t = document.createElement("span");
    t.className = "aviso-tipo";
    t.textContent = tipo === "erro" ? "Algo deu errado" : tipo === "sucesso" ? "Concluído" : "Aviso";
    el.aviso.appendChild(t);
    el.aviso.appendChild(document.createTextNode(msg));
    el.aviso.hidden = false;
    clearTimeout(aviso._t);
    aviso._t = setTimeout(function () { el.aviso.hidden = true; }, 5200);
  }

  function statusGlobal(texto, classe) {
    el.statusGlobalTexto.textContent = texto;
    el.statusGlobal.classList.remove("trabalhando", "erro");
    if (classe) el.statusGlobal.classList.add(classe);
  }

  function formatarData(iso) {
    try {
      return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch (e) { return iso; }
  }

  function slugify(nome) {
    return nome
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "material";
  }

  // ---------- abas ----------
  var abas = document.querySelectorAll(".aba[data-aba]");
  abas.forEach(function (aba) {
    aba.addEventListener("click", function () {
      var nome = aba.getAttribute("data-aba");
      abas.forEach(function (a) { a.classList.toggle("ativa", a === aba); });
      var views = { converter: $("view-converter"), historico: $("view-historico"), exemplos: $("view-exemplos"), sobre: $("view-sobre") };
      Object.keys(views).forEach(function (k) { views[k].hidden = k !== nome; views[k].classList.toggle("ativa", k === nome); });
      if (nome === "historico") renderizarHistorico();
      if (nome === "exemplos") renderizarExemplos();
    });
  });

  // ---------- upload ----------
  function aceitarArquivos(fileList) {
    var aceitos = [];
    Array.prototype.forEach.call(fileList || [], function (f) {
      var tipo = tipoDeArquivo(f);
      if (!tipo) {
        el.uploadErro.textContent = "Formato não suportado: " + f.name + ". Use PDF, PNG, JPG, JPEG ou CSV.";
        return;
      }
      aceitos.push({ id: "f" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), nome: f.name, tipo: tipo, file: f, status: "aguardando", progresso: 0, erro: null });
    });
    if (aceitos.length) {
      fila = fila.concat(aceitos);
      el.uploadErro.textContent = "";
      renderizarFila();
      statusGlobal(aceitos.length + (aceitos.length > 1 ? " arquivos adicionados à fila." : " arquivo adicionado à fila."), "");
    }
  }

  function tipoDeArquivo(f) {
    var n = (f.name || "").toLowerCase();
    if (/\.pdf$/.test(n)) return "pdf";
    if (/\.(png|jpe?g)$/.test(n)) return "imagem";
    if (/\.csv$/.test(n)) return "csv";
    return null;
  }

  el.dropZone.addEventListener("click", function () { el.inputArquivos.click(); });
  el.dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.inputArquivos.click(); }
  });
  el.inputArquivos.addEventListener("change", function () { aceitarArquivos(el.inputArquivos.files); el.inputArquivos.value = ""; });
  el.btnSelecionar.addEventListener("click", function () { el.inputArquivos.click(); });

  ["dragenter", "dragover"].forEach(function (ev) {
    el.dropZone.addEventListener(ev, function (e) { e.preventDefault(); el.dropZone.classList.add("arrastando"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    el.dropZone.addEventListener(ev, function (e) { e.preventDefault(); el.dropZone.classList.remove("arrastando"); });
  });
  el.dropZone.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files) aceitarArquivos(e.dataTransfer.files);
  });

  el.btnLimparFila.addEventListener("click", function () {
    var restantes = fila.filter(function (i) { return i.status === "convertendo"; });
    if (restantes.length) { aviso("Aguarde a conversão em andamento terminar para limpar a fila.", "aviso"); return; }
    fila = [];
    renderizarFila();
  });

  function removerDaFila(id) {
    var item = fila.find(function (i) { return i.id === id; });
    if (!item || item.status === "convertendo") return;
    fila = fila.filter(function (i) { return i.id !== id; });
    renderizarFila();
  }

  window.removerDaFila = removerDaFila;

  function renderizarFila() {
    el.filaCont.textContent = "(" + fila.filter(function (i) { return i.status !== "concluido" && i.status !== "erro"; }).length + ")";
    el.filaVazia.hidden = fila.length > 0;
    el.btnProcessar.disabled = fila.length === 0 || emProcessamento;
    el.btnLimparFila.disabled = fila.length === 0 || emProcessamento;
    el.filaLista.innerHTML = "";
    fila.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "fila-item";
      var rotuloStatus =
        item.status === "aguardando" ? "Aguardando" :
        item.status === "convertendo" ? "Convertendo… " + item.progresso + "%" :
        item.status === "concluido" ? "Concluído" : "Erro: " + (item.erro || "desconhecido");
      li.innerHTML =
        '<span class="f-ico" aria-hidden="true">' + iconeTipo(item.tipo) + "</span>" +
        '<span class="f-info"><span class="f-nome">' + escapeHtml(item.nome) + "</span>" +
        '<span class="f-status">' + rotuloStatus + "</span>" +
        (item.status === "convertendo" ? '<span class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + item.progresso + '"><span style="width:' + item.progresso + '%"></span></span>' : "") +
        "</span>" +
        '<button type="button" class="f-remover" aria-label="Remover ' + escapeHtml(item.nome) + '" data-remover="' + item.id + '">✕</button>';
      var btnRem = li.querySelector("[data-remover]");
      if (btnRem && (item.status === "aguardando" || item.status === "erro")) btnRem.disabled = false;
      el.filaLista.appendChild(li);
    });
  }

  function iconeTipo(t) {
    if (t === "pdf") return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6M9 9h1"/></svg>';
    if (t === "csv") return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M9 5v14"/></svg>';
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="1.6"/><path d="M5 19l5-5 3 3 4-4 3 3"/></svg>';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------- processamento da fila ----------
  el.btnProcessar.addEventListener("click", function () { processarFila(); });

  async function processarFila() {
    if (emProcessamento) return;
    emProcessamento = true;
    renderizarFila();
    statusGlobal("Convertendo materiais…", "trabalhando");

    var pendente = fila.filter(function (i) { return i.status === "aguardando" || i.status === "erro"; });
    for (var k = 0; k < pendente.length; k++) {
      var item = pendente[k];
      try {
        item.status = "convertendo";
        item.progresso = 2;
        renderizarFila();
        var resultado;
        if (item.tipo === "pdf") {
          resultado = await Conversor.convertPdf(await item.file.arrayBuffer(), function (pct) {
            item.progresso = Math.max(3, Math.min(96, Math.round(pct * 0.9 + 5)));
            renderizarFila();
          });
          item.progresso = 100;
        } else if (item.tipo === "csv") {
          var txt = await item.file.text();
          var mdTabela = Conversor.convertCsv(txt);
          var cab = "# Tabela: " + item.nome + "\n\nTabela extraída do arquivo CSV enviado:\n\n";
          resultado = { markdown: cab + mdTabela, pendingRev: [] };
        } else {
          var dataUrl = await lerComoDataUrl(item.file);
          resultado = Conversor.convertImage(item.nome, dataUrl);
        }
        item.status = "concluido";
        item.progresso = 100;
        mostrarResultado(item, resultado);
        statusGlobal("Conversão de \u201c" + item.nome + "\u201d concluída.", "");
      } catch (e) {
        item.status = "erro";
        item.erro = (e && e.message) ? e.message : "Falha ao processar o arquivo";
        statusGlobal("Erro ao converter \u201c" + item.nome + "\u201d.", "erro");
      }
      renderizarFila();
    }
    emProcessamento = false;
    renderizarFila();
    if (!fila.some(function (i) { return i.status === "aguardando" || i.status === "erro" || i.status === "convertendo"; })) {
      statusGlobal("Fila processada. " + fila.filter(function (i) { return i.status === "concluido"; }).length + " conversão(ões) concluída(s).", "");
    }
  }

  function lerComoDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error("Não foi possível ler a imagem.")); };
      r.readAsDataURL(file);
    });
  }

  // ---------- resultado ----------
  function mostrarResultado(item, resultado) {
    var md = resultado.markdown || "";
    var nTabelas = (md.match(/^\|/gm) || []).length > 0 ? (md.match(/^\|/gm) || []).length - 1 : 0;
    var nCodigos = (md.match(/^```/gm) || []).length / 2;
    var nRev = (resultado.pendingRev || []).length;

    ultimoResultado = { nome: item.nome, tipo: item.tipo, markdown: md, meta: {
      caracteres: md.length, tabelas: Math.max(0, nTabelas), codigos: nCodigos, revisoes: nRev
    } };

    el.resultadoVazio.hidden = true;
    el.resultadoPainel.hidden = false;
    el.resultadoTitulo.textContent = item.nome;
    var metas = [];
    metas.push(md.length + " caracteres");
    if (nCodigos > 0) metas.push(nCodigos + " bloco(s) de código");
    if (nTabelas > 0) metas.push(nTabelas + " linha(s) de tabela");
    if (nRev > 0) metas.push(nRev + " pendência(s) de revisão");
    el.resultadoMeta.textContent = metas.join(" · ");
    el.editorMd.value = md;
    el.documentoPre.innerHTML = window.MarkdownRender.render(md);
    el.btnBaixar.disabled = false;
    mostrarAbaResultado("pre");
  }

  function mostrarAbaResultado(qual) {
    var pre = qual === "pre";
    el.rtabPre.classList.toggle("ativa", pre);
    el.rtabMd.classList.toggle("ativa", !pre);
    el.rtabPre.setAttribute("aria-selected", pre ? "true" : "false");
    el.rtabMd.setAttribute("aria-selected", pre ? "false" : "true");
    el.painelPre.hidden = !pre;
    el.painelMd.hidden = pre;
  }

  el.rtabPre.addEventListener("click", function () { mostrarAbaResultado("pre"); });
  el.rtabMd.addEventListener("click", function () { mostrarAbaResultado("md"); });

  el.editorMd.addEventListener("input", function () {
    if (ultimoResultado) ultimoResultado.markdown = el.editorMd.value;
  });

  el.btnSalvar.addEventListener("click", function () {
    if (!ultimoResultado) return;
    var mdAtual = el.editorMd.value;
    var pendRevisao = /REVER\s*:/i.test(mdAtual) ? 1 : 0;
    var rec = {
      id: "h" + Date.now(),
      nome: ultimoResultado.nome,
      tipo: ultimoResultado.tipo,
      data: new Date().toISOString(),
      status: pendRevisao ? "pendente" : "concluido",
      tamanho: mdAtual.length,
      markdown: mdAtual
    };
    historico.unshift(rec);
    salvarHistorico();
    aviso("Material salvo no histórico" + (pendRevisao ? " com pendências de revisão." : "."), "sucesso");
    renderizarHistorico();
  });

  el.btnBaixar.addEventListener("click", function () {
    if (!ultimoResultado) return;
    baixarMd(ultimoResultado.nome, el.editorMd.value);
  });

  function baixarMd(nome, conteudo) {
    var blob = new Blob([conteudo], { type: "text/markdown;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = slugify(nome) + "-acessivel.md";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 300);
  }

  // ---------- histórico ----------
  function carregarHistorico() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_HISTORICO) || "[]");
    } catch (e) { return []; }
  }
  function salvarHistorico() {
    try { localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico)); }
    catch (e) { aviso("Não foi possível salvar o histórico neste navegador (armazenamento cheio?).", "aviso"); }
  }

  function renderizarHistorico() {
    el.historicoTotal.textContent = historico.length + (historico.length === 1 ? " conversão salva" : " conversões salvas");
    el.historicoVazio.hidden = historico.length > 0;
    el.tabelaHistorico.hidden = historico.length === 0;
    el.historicoCorpo.innerHTML = "";
    historico.forEach(function (rec) {
      var tr = document.createElement("tr");
      var rotulo =
        rec.status === "concluido" ? '<span class="pill concluido">concluído</span>' :
        rec.status === "pendente" ? '<span class="pill pendente">com revisão pendente</span>' :
        '<span class="pill erro">' + escapeHtml(rec.status || "erro") + "</span>";
      tr.innerHTML =
        "<td><strong>" + escapeHtml(rec.nome) + "</strong></td>" +
        "<td>" + (rec.tipo || "—") + "</td>" +
        "<td>" + formatarData(rec.data) + "</td>" +
        "<td>" + rotulo + "</td>" +
        '<td><button type="button" class="btn-link btn" data-abrir="' + rec.id + '">Abrir</button> <button type="button" class="btn-link btn" data-baixar="' + rec.id + '">Baixar</button> <button type="button" class="btn-link btn btn-perigo" data-excluir="' + rec.id + '">Excluir</button></td>';
      el.historicoCorpo.appendChild(tr);
    });
  }

  el.historicoCorpo.addEventListener("click", function (e) {
    var alvo = e.target.closest("[data-abrir], [data-baixar], [data-excluir]");
    if (!alvo) return;
    var id = alvo.getAttribute("data-abrir") || alvo.getAttribute("data-baixar") || alvo.getAttribute("data-excluir");
    var rec = historico.find(function (h) { return h.id === id; });
    if (!rec) return;
    if (alvo.hasAttribute("data-abrir")) {
      // vai para a aba Converter e mostra o material no visualizador
      document.querySelector('.aba[data-aba="converter"]').click();
      ultimoResultado = { nome: rec.nome, tipo: rec.tipo, markdown: rec.markdown, meta: { caracteres: rec.markdown.length } };
      el.resultadoVazio.hidden = true;
      el.resultadoPainel.hidden = false;
      el.resultadoTitulo.textContent = rec.nome;
      el.resultadoMeta.textContent = rec.markdown.length + " caracteres · do histórico";
      el.editorMd.value = rec.markdown;
      el.documentoPre.innerHTML = window.MarkdownRender.render(rec.markdown);
      el.btnBaixar.disabled = false;
      mostrarAbaResultado("pre");
      aviso("Material aberto no visualizador.", "sucesso");
    } else if (alvo.hasAttribute("data-baixar")) {
      baixarMd(rec.nome, rec.markdown);
    } else {
      if (confirm("Excluir \u201c" + rec.nome + "\u201d do histórico?")) {
        historico = historico.filter(function (h) { return h.id !== id; });
        salvarHistorico();
        renderizarHistorico();
      }
    }
  });

  el.btnLimparHistorico.addEventListener("click", function () {
    if (!historico.length) return;
    if (confirm("Apagar todo o histórico de conversões deste dispositivo?")) {
      historico = [];
      salvarHistorico();
      renderizarHistorico();
      aviso("Histórico limpo.", "sucesso");
    }
  });

  // ---------- exemplos ----------
  function renderizarExemplos() {
    if (!window.MATERIAIS_EXEMPLO || !window.MATERIAIS_EXEMPLO.length) {
      el.exemplosLista.innerHTML = "<li class=\"exemplo-card\"><p>Materiais de exemplo indisponíveis.</p></li>";
      return;
    }
    el.exemplosLista.innerHTML = "";
    window.MATERIAIS_EXEMPLO.forEach(function (m, idx) {
      var li = document.createElement("li");
      li.className = "exemplo-card";
      li.setAttribute("data-od-id", "exemplo-" + (idx + 1));
      li.innerHTML =
        "<h2>" + escapeHtml(m.titulo) + "</h2>" +
        "<p>" + escapeHtml(m.descricao) + "</p>" +
        '<div class="ex-acoes">' +
        '<button type="button" class="btn" data-exemplo="' + idx + '" data-aca="ler">Ler no visualizador</button> ' +
        '<button type="button" class="btn btn-link" data-exemplo="' + idx + '" data-aca="baixar">Baixar .md</button>' +
        "</div>";
      el.exemplosLista.appendChild(li);
    });
  }

  el.exemplosLista.addEventListener("click", function (e) {
    var alvo = e.target.closest("[data-exemplo]");
    if (!alvo) return;
    var m = window.MATERIAIS_EXEMPLO[parseInt(alvo.getAttribute("data-exemplo"), 10)];
    if (!m) return;
    if (alvo.getAttribute("data-aca") === "baixar") {
      baixarMd(m.slug + ".md", m.conteudo);
    } else {
      document.querySelector('.aba[data-aba="converter"]').click();
      ultimoResultado = { nome: m.titulo, tipo: "md", markdown: m.conteudo, meta: { caracteres: m.conteudo.length } };
      el.resultadoVazio.hidden = true;
      el.resultadoPainel.hidden = false;
      el.resultadoTitulo.textContent = m.titulo;
      el.resultadoMeta.textContent = m.conteudo.length + " caracteres · material de exemplo";
      el.editorMd.value = m.conteudo;
      el.documentoPre.innerHTML = window.MarkdownRender.render(m.conteudo);
      el.btnBaixar.disabled = false;
      mostrarAbaResultado("pre");
    }
  });

  // ---------- init ----------
  function init() {
    renderizarFila();
    renderizarHistorico();
  }
  init();
})();