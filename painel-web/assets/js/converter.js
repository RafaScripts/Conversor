/* =========================================================================
   converter.js — Motor de conversão de arquivos → Markdown acessível
   - PDF: extrai texto (PDF.js), detecta títulos, blocos de código, tabelas,
     listas e páginas sem camada de texto (sinalizadas para descrição).
   - CSV: vira tabela Markdown.
   - Imagem: vira item com descrição a ser preenchida (marcada [REVER]).
   Tudo no navegador; nada é enviado a servidores.
   ========================================================================= */
(function (global) {
  "use strict";

  var FONT_MONO = /mono|courier|consolas|menlo|sfmono|source code|dejavu sans mono/i;

  // ---- Detecção de linguagem de código ----
  function detectLanguage(text) {
    if (/\b(public|private|protected)\s+(class|void|static|interface)\b|\bSystem\.out\b|\bpackage\s+[\w.]+\b|\bextends\b|\bimport\s+java\.|\bpublic\s+\w+\s*\(|\bsuper\s*\(|\bclass\s+\w+/.test(text)) return "java";
    if (/^\s*def\s+\w+\s*\(|^\s*import\s+\w+|print\s*\(/.test(text)) return "python";
    if (/^\s*#include\s*[<"]|int\s+main\s*\(|printf\s*\(/.test(text)) return "c";
    return "text";
  }

  function looksLikeCode(line) {
    var t = line.trim();
    if (!t) return false;
    if (/^[{}]\s*$/.test(t)) return true;
    if (/[{};]$/.test(t) && /[\w\)\]"']/.test(t)) return true;
    if (/^\s*(public|private|protected|class|void|static|int|double|String|boolean|char|if|else|for|while|return|import|package|extends|implements|new|throw|try|catch|finally|def|print|System\.out)\b/.test(t)) return true;
    if (/^\s*(\/\/|\/\*|\*|\*\/)/.test(t)) return true;
    if (/^\s*@\w+/.test(t)) return true;
    return false;
  }

  // ---- PDF: extrair e estruturar ----
  async function convertPdf(arrayBuffer, onProgress) {
    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var out = [];
    var total = pdf.numPages;
    var pendingRev = [];

    for (var p = 1; p <= total; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      if (onProgress) onProgress(Math.round(((p - 1) / total) * 100));

      var items = content.items || [];
      var hasText = items.some(function (it) { return (it.str || "").trim().length > 0; });

      // Página sem camada de texto → sinalizar imagem/OCR
      if (!hasText) {
        out.push("\n\n**Página " + p + " — conteúdo em imagem, sem camada de texto.** [REVER: imagem na página " + p + ", descrição pendente]");
        pendingRev.push("página " + p + " (imagem sem texto)");
        continue;
      }

      var lines = groupIntoLines(items);
      out.push(structureLines(lines, p, pendingRev));
    }

    var markdown = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    // primeiro título do documento vira H1 (título principal)
    markdown = markdown.replace(/^## /, "# ");
    return { markdown: markdown, pendingRev: pendingRev };
  }

  function groupIntoLines(items) {
    var arr = items.filter(function (it) { return (it.str || "").trim().length > 0; });
    var yTol = 3;
    // agrupa por y (ordenando do topo para baixo)
    var buckets = [];
    arr.forEach(function (it) {
      var y = it.transform ? it.transform[5] : 0;
      var h = it.height || 10;
      var found = null;
      for (var b = 0; b < buckets.length; b++) {
        if (Math.abs(buckets[b].y - y) <= yTol) { found = buckets[b]; break; }
      }
      if (!found) { found = { y: y, h: h, items: [] }; buckets.push(found); }
      found.h = Math.max(found.h, h);
      found.items.push(it);
    });
    buckets.sort(function (a, b) { return b.y - a.y; });
    return buckets.map(function (bk) {
      bk.items.sort(function (a, b) {
        var ax = a.transform ? a.transform[4] : 0;
        var bx = b.transform ? b.transform[4] : 0;
        return ax - bx;
      });
      var text = bk.items.map(function (it) { return it.str; }).join(" ");
      var mono = bk.items.some(function (it) {
        return FONT_MONO.test(it.fontName || "");
      });
      var fontSize = bk.h || 10;
      var xs = bk.items.map(function (it) { return it.transform ? it.transform[4] : 0; });
      return { text: text, mono: mono, fontSize: fontSize, xs: xs, y: bk.y };
    });
  }

  function structureLines(lines, pageNo, pendingRev) {
    var out = [];
    var i = 0;
    var bodyFont = median(lines.map(function (l) { return l.fontSize; }));

    function isMetaLabel(t) {
      return /^(CURSO|MODALIDADE|MÓDULO|PERÍODO|DISCIPLINA|CLASSE|DOCENTE)[A-ZÀ-Ú\/ ]*:/.test(t);
    }

    // remove espaço antes de pontuação/fechamento (artefato da camada de texto do PDF)
    function normalizePunct(s) {
      return s.replace(/ +([,.;:!?)\]])/g, "$1");
    }

    function isQuestionStem(t) {
      return /^\d{1,2}\.\s+[A-ZÀ-Ú]/.test(t);
    }

    // Emite rótulo(s) de metadados; separa rótulos que foram agrupados na mesma linha
    function pushMeta(text) {
      var re = /(CURSO|MODALIDADE|MÓDULO|PERÍODO|DISCIPLINA|CLASSE|DOCENTE)[A-ZÀ-Ú\/ ]*:/g;
      var idx = [];
      var m;
      while ((m = re.exec(text)) !== null) idx.push(m.index);
      if (!idx.length) { out.push("- " + text); return; }
      for (var k = 0; k < idx.length; k++) {
        var start = idx[k];
        var end = (k + 1 < idx.length) ? idx[k + 1] : text.length;
        var seg = text.slice(start, end).trim();
        var colon = seg.indexOf(":");
        var label = seg.slice(0, colon).replace(/\s+$/, "") + ":";
        var valor = normalizePunct(seg.slice(colon + 1).trim());
        out.push("- **" + label + "** " + valor);
      }
    }

    while (i < lines.length) {
      var L = lines[i];
      var t = L.text.trim();

      // 0) número de linha de editor (ex.: "01") — artefato, descarta
      if (/^\d{1,3}$/.test(t)) { i++; continue; }

      // 1) metadados de cabeçalho (CURSO:, DOCENTE: etc.)
      if (isMetaLabel(t)) { pushMeta(t); i++; continue; }

      // 2) alternativa de múltipla escolha (a–e)
      if (/^[a-e][\)\.]\s+/i.test(t)) {
        if (!/[{}]/.test(t)) {
          var letra = t.charAt(0).toLowerCase();
          var item = t.replace(/^[a-e][\)\.]\s+/i, "").trim();
          i++;
          // junta linhas de continuação (prosa quebrada pela largura da página)
          while (i < lines.length) {
            var n = lines[i].text.trim();
            if (!n) { i++; continue; }
            if (/^\d{1,3}$/.test(n)) { i++; continue; }
            if (/^[a-e][\)\.]\s+/i.test(n)) break;
            if (/^\d{1,2}[\)\.]\s/.test(n)) break;
            if (isMetaLabel(n)) break;
            if (/^[-•·‣▪]/.test(n)) break;
            item += " " + normalizePunct(n.replace(/^\d{1,3}\s+/, ""));
            i++;
          }
          out.push("- **" + letra + ")** " + normalizePunct(item));
          continue;
        }
        // alternativa que é código (ex.: construtores) → cai no bloco de código abaixo
      }

      // 3) marcadores de lista
      if (/^[-•·‣▪]/.test(t)) {
        out.push("- " + normalizePunct(t.replace(/^[-•·‣▪]\s*/, "").replace(/^\d{1,3}\s+/, "")));
        i++;
        continue;
      }

      // 4) item de lista numerada curta (ex.: "1.")
      if (/^\d+\.\s/.test(t) && t.length < 8) {
        out.push("1. " + t.replace(/^\d+\.\s*/, ""));
        i++;
        continue;
      }

      // 5) bloco de código: linhas consecutivas que parecem código, com merge por chaves
      if (looksLikeCode(t)) {
        var block = [];
        var brace = 0;
        while (i < lines.length) {
          var lt = lines[i].text.trim();
          if (/^\d{1,3}$/.test(lt)) { block.push(""); i++; continue; }
          if (!lt) { block.push(""); i++; continue; }
          if (!looksLikeCode(lt)) break;
          if (block.length && brace <= 0 && /^[a-e][\)\.]\s+/i.test(lt)) break;
          lt = lt.replace(/^\d{1,3}\s+/, "");
          block.push(lt);
          brace += (lt.match(/\{/g) || []).length - (lt.match(/\}/g) || []).length;
          i++;
        }
        while (block.length && block[block.length - 1].trim() === "") block.pop();
        while (block.length && block[0].trim() === "") block.shift();
        if (block.length) {
          var codeText = block.join("\n").replace(/\n{2,}/g, "\n\n");
          var lang = detectLanguage(codeText);
          out.push("");
          out.push("```" + lang);
          out.push(codeText);
          out.push("```");
        }
        continue;
      }

      // 6) tabela: várias linhas seguidas com colunas alinhadas
      if (i + 1 < lines.length && looksLikeTableRow(L) && looksLikeTableRow(lines[i + 1])) {
        var rows = [];
        while (i < lines.length && looksLikeTableRow(lines[i])) { rows.push(lines[i]); i++; }
        out.push("");
        out.push(renderTableMarkdown(rows));
        continue;
      }

      // 7) título provável: fonte maior que o corpo
      if (L.fontSize > bodyFont * 1.18 && t.length < 90) {
        out.push("## " + t);
        i++;
        continue;
      }

      // 8) início de questão (ex.: "1. Considere...")
      if (isQuestionStem(t)) {
        var num = t.match(/^\d{1,2}/)[0];
        out.push("**" + num + ".** " + normalizePunct(t.replace(/^\d{1,2}\.\s+/, "")));
        i++;
        continue;
      }

      // 9) parágrafo
      out.push(normalizePunct(t));
      i++;
    }
    return out.join("\n");
  }

  function median(nums) {
    var s = nums.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length ? s[m] : 10;
  }

  function looksLikeTableRow(line) {
    // linha com >= 2 "colunas" separadas por espaços largos OU contendo '|'
    if (/\|/.test(line.text)) return true;
    var gaps = countWideGaps(line.xs);
    return gaps >= 2;
  }

  function countWideGaps(xs) {
    if (!xs || xs.length < 2) return 0;
    var gaps = 0;
    for (var k = 1; k < xs.length; k++) {
      if (xs[k] - xs[k - 1] > 40) gaps++;
    }
    return gaps;
  }

  function renderTableMarkdown(rows) {
    var cells = rows.map(function (r) {
      return r.text.split(/\s{2,}|\t/).map(function (c) { return c.trim(); }).filter(Boolean);
    });
    var cols = Math.max.apply(null, cells.map(function (c) { return c.length; }));
    var out = [];
    cells.forEach(function (row, idx) {
      while (row.length < cols) row.push("");
      out.push("| " + row.join(" | ") + " |");
      if (idx === 0) out.push("| " + row.map(function () { return "---"; }).join(" | ") + " |");
    });
    return out.join("\n");
  }

  // ---- CSV → tabela Markdown ----
  function convertCsv(text) {
    var rows = text.split(/\r?\n/).filter(function (r) { return r.trim(); });
    function parseRow(line) {
      var out = [];
      var cur = "";
      var inQ = false;
      for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (c === "," && !inQ) { out.push(cur); cur = ""; }
        else if (c === ";" && !inQ && line.indexOf(",") === -1) { out.push(cur); cur = ""; }
        else cur += c;
      }
      out.push(cur);
      return out;
    }
    var table = rows.map(parseRow);
    if (!table.length) return "";
    var cols = Math.max.apply(null, table.map(function (r) { return r.length; }));
    var md = [];
    table.forEach(function (row, idx) {
      while (row.length < cols) row.push("");
      md.push("| " + row.map(function (c) { return c.replace(/\|/g, "\\|").trim(); }).join(" | ") + " |");
      if (idx === 0) md.push("| " + row.map(function () { return "---"; }).join(" | ") + " |");
    });
    return md.join("\n");
  }

  // ---- Imagem → item com descrição pendente ----
  function convertImage(nomeArquivo, dataUrl) {
    var markdown = "![Imagem: " + nomeArquivo + " — [REVER: descrição da imagem pendente, explique o conteúdo visual] ](" + dataUrl + ")\n";
    return { markdown: markdown, pendingRev: [nomeArquivo + " (descrição de imagem pendente)"] };
  }

  global.Conversor = {
    convertPdf: convertPdf,
    convertCsv: convertCsv,
    convertImage: convertImage,
    detectLanguage: detectLanguage
  };
})(window);