/* =========================================================================
   markdown.js — Renderizador Markdown → HTML semântico
   Suporta: títulos, parágrafos, ênfase, código inline e em bloco, listas
   aninhadas, citações, tabelas, links, imagens e marcadores de revisão.
   Gera HTML semântico (tabelas com <th scope>, figuras com descrição).
   ========================================================================= */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Converte ênfase e código inline em um trecho de texto já escapado
  function inline(str) {
    var out = "";
    var i = 0;
    var n = str.length;
    var codeBuf = "";
    var inCode = false;
    while (i < n) {
      var ch = str[i];
      if (ch === "`") {
        if (!inCode) { inCode = true; codeBuf = ""; }
        else {
          inCode = false;
          out += "<code>" + escapeHtml(codeBuf) + "</code>";
          codeBuf = "";
        }
        i++;
        continue;
      }
      if (inCode) { codeBuf += ch; i++; continue; }

      if (ch === "[" ) {
        var m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(str.slice(i));
        if (m) {
          out += '<a href="' + escapeHtml(m[2]) + '">' + inline(m[1]) + "</a>";
          i += m[0].length;
          continue;
        }
      }
      if (ch === "!" ) {
        var mi = /^!\[([^\]]*)\]\(([^)\s]+)\)/.exec(str.slice(i));
        if (mi) {
          out += figMarker(mi[1], mi[2]);
          i += mi[0].length;
          continue;
        }
      }
      if (ch === "*" || ch === "_") {
        var delim = ch;
        var double = i + 1 < n && str[i + 1] === ch;
        var len = double ? 2 : 1;
        var close = str.indexOf(double ? ch + ch : ch, i + len);
        if (close > i + len) {
          var inner = str.slice(i + len, close);
          out += double ? "<strong>" + inline(inner) + "</strong>" : "<em>" + inline(inner) + "</em>";
          i = close + len;
          continue;
        }
      }
      out += escapeHtml(ch);
      i++;
    }
    if (inCode) out += "<code>" + escapeHtml(codeBuf) + "</code>";
    return out;
  }

  // Marcador de figura com descrição acessível (usado no Markdown gerado)
  function figMarker(alt, src) {
    var rever = /REVER/i.test(alt || "") || /REVER/i.test(src || "");
    var badge = rever ? '<span class="marcador-rever">revisão pendente</span> ' : "";
    var temImg = src && !/^\(/i.test(src) && src !== "descr" && src !== "";
    var img = temImg
      ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" />'
      : "";
    return (
      '<figure class="figura-acessivel">' +
      '<p class="fig-titulo">' + badge + escapeHtml(alt || "Figura") + "</p>" +
      (img ? img : "") +
      "</figure>"
    );
  }

  function renderTable(lines, i) {
    // lines[i] = cabeçalho | a | b |
    var header = lines[i];
    var sep = lines[i + 1] || "";
    var j = i + 2;
    var rows = [];
    while (j < lines.length && lines[j].trim().indexOf("|") === 0) { rows.push(lines[j]); j++; }
    var cells = function (line) {
      var s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
      return s.split("|").map(function (c) { return c.trim(); });
    };
    var headCells = cells(header);
    var thead = "<thead><tr>" + headCells.map(function (c) {
      return "<th scope=\"col\">" + inline(c) + "</th>";
    }).join("") + "</tr></thead>";
    var body = "<tbody>" + rows.map(function (r) {
      return "<tr>" + cells(r).map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
    }).join("") + "</tbody>";
    return { html: "<table>" + thead + body + "</table>", next: j };
  }

  function render(src) {
    var lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    var html = [];
    var i = 0;
    var listStack = []; // tipo: "ul" | "ol"
    var inBlock = false; // bloco de código

    function closeLists() {
      while (listStack.length) html.push("</" + listStack.pop() + ">");
    }

    while (i < lines.length) {
      var line = lines[i];
      var t = line.trim();

      // Bloco de código cercado
      if (/^```/.test(t)) {
        closeLists();
        inBlock = !inBlock;
        if (inBlock) {
          var lang = t.slice(3).trim() || "";
          html.push('<pre><code class="lang-' + escapeHtml(lang.replace(/[^\w-]/g, "")) + '">');
        } else {
          html.push("</code></pre>");
        }
        i++;
        continue;
      }
      if (inBlock) { html.push(escapeHtml(line)); i++; continue; }

      // Linha em branco → fecha listas abertas
      if (t === "") { closeLists(); i++; continue; }

      // Tabela
      if (t.indexOf("|") === 0 && i + 1 < lines.length && /^\|[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
        closeLists();
        var r = renderTable(lines, i);
        html.push(r.html);
        i = r.next;
        continue;
      }

      // Título
      var h = /^(#{1,4})\s+(.*)$/.exec(t);
      if (h) {
        closeLists();
        var level = h[1].length;
        html.push("<h" + level + ">" + inline(h[2]) + "</h" + level + ">");
        i++;
        continue;
      }

      // Linha horizontal
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t.replace(/\s/g, ""))) { closeLists(); html.push("<hr />"); i++; continue; }

      // Citação
      if (/^>\s?/.test(t)) {
        closeLists();
        html.push("<blockquote>" + inline(t.replace(/^>\s?/, "")) + "</blockquote>");
        i++;
        continue;
      }

      // Lista ordenada
      var ol = /^(\d+)\.\s+(.*)$/.exec(t);
      if (ol) {
        if (listStack[listStack.length - 1] !== "ol") {
          closeLists();
          html.push("<ol>");
          listStack.push("ol");
        }
        html.push("<li>" + inline(ol[2]) + "</li>");
        i++;
        continue;
      }

      // Lista não ordenada (com suporte a recuo para aninhamento)
      var ul = /^([ ]*)[-*+]\s+(.*)$/.exec(line);
      if (ul) {
        var indent = Math.floor(ul[1].length / 2);
        var want = indent + 1;
        while (listStack.length > want) { html.push("</" + listStack.pop() + ">"); }
        if (listStack.length < want) {
          while (listStack.length < want) { html.push("<ul>"); listStack.push("ul"); }
        }
        html.push("<li>" + inline(ul[2]) + "</li>");
        i++;
        continue;
      }

      // Imagem isolada
      var img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t);
      if (img) { closeLists(); html.push(figMarker(img[1], img[2])); i++; continue; }

      closeLists();
      html.push("<p>" + inline(t) + "</p>");
      i++;
    }
    closeLists();
    return html.join("\n");
  }

  global.MarkdownRender = { render: render };
})(window);