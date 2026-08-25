# Leitor de Materiais Acessíveis — Painel PDF → Markdown inclusivo

Painel web que recebe materiais didáticos (notas de aula, provas, listas de exercícios, tabelas e imagens — em geral em PDF) e os converte em **Markdown acessível para pessoas com deficiência visual**:

- **Texto fiel**: títulos, parágrafos, listas e notas preservados em português.
- **Tabelas semânticas**: extraídas como tabelas Markdown reais, legíveis por leitor de tela.
- **Imagens/diagramas descritos**: cada figura ganha descrição textual do conteúdo visual (feita por quem prepara o material ou incluída nas conversões de exemplo).
- **Código em blocos descritivos**: trechos de código (ex.: Java) extraídos com indicação de linguagem e comentários didáticos.

## Como abrir / rodar

1. **Opção A — preview hospedado**: o painel é um site estático; após a publicação, basta abrir a URL do preview no navegador.
2. **Opção B — local**: abra `index.html` diretamente no navegador (ou sirva a pasta com `python3 -m http.server 8000` e acesse `http://localhost:8000`). Todo o processamento é no navegador; nenhum arquivo sai do dispositivo.

## Fluxo de uso

1. **Converter** — arraste (ou selecione) PDFs, imagens (PNG/JPG) ou tabelas (CSV). Os arquivos entram na fila.
2. Pressione **Iniciar conversão da fila** e acompanhe o progresso de cada item.
3. O resultado abre no visualizador: **Pré-visualização** (renderizada) e **Markdown fonte** (editável). Itens ambíguos aparecem marcados como `[REVER: …]` (ex.: descrição de imagem pendente) — edite e complete.
4. **Salvar no histórico** grava a versão revisada neste dispositivo (localStorage). **Baixar .md** gera o arquivo.
5. **Histórico** lista todas as conversões salvas (arquivo original, tipo, data, status, ações abrir/baixar/excluir).
6. **Materiais de exemplo** — as versões acessíveis dos 5 PDFs de entrega inicial (Lista 01, Lista 02, Notas Aula 01 Parte I e II, Notas Aula 02), prontas para leitura e download.

## Estrutura de arquivos

```
index.html                 → painel (SPA)
assets/css/styles.css      → visual "Leitura Otimizada" (Information Architects)
assets/js/app.js           → abas, fila, histórico, visualizador
assets/js/converter.js     → motor PDF→Markdown (texto, código, tabelas, imagens)
assets/js/markdown.js      → renderizador Markdown→HTML semântico (sem dependências)
assets/js/samples.js       → materiais de exemplo embutidos (5 conversões validadas)
assets/vendor/pdf.min.js   → mecanismo PDF.js (local, sem CDN)
assets/vendor/pdf.worker.min.js
amostras/*.md              → os 5 materiais convertidos, em arquivos .md
nginx.conf                 → configuração do ambiente estático (porta 9000)
README.md                  → este arquivo
```

## Guia de modificação

| O que você quer mudar | Onde |
|---|---|
| Textos da interface (botões, títulos, avisos) | `index.html` (conteúdo) e `assets/js/app.js` (mensagens dinâmicas) |
| Cores, fontes, espaçamento | `assets/css/styles.css` — variáveis em `:root` (`--accent`, `--bg`, `--font-body`…) |
| Regras do motor de conversão (detecção de código/tabelas) | `assets/js/converter.js` |
| Renderização do Markdown | `assets/js/markdown.js` |
| Materiais de exemplo | `assets/js/samples.js` (conteúdo) — os `.md` originais ficam em `amostras/` |
| Limite de formatos aceitos | `index.html` (atributo `accept` do input) e `tipoDeArquivo()` em `app.js` |

## Qualidade coberta

- **Estados**: fila vazia, carregando/conversão com barra de progresso, sucesso, erro com mensagem e ação, resultado sem conversão ainda.
- **Validação**: formato de arquivo validado no upload (PDF/PNG/JPG/CSV); aviso claro para formatos não suportados.
- **Histórico**: persistente (localStorage), com abrir/baixar/excluir e limpar tudo.
- **Responsivo**: desktop (duas colunas) e mobile (empilhado); tabelas com rolagem horizontal quando necessário.
- **Acessibilidade do material**: hierarquia de títulos, tabelas com `th scope`, descrições de figura, blocos de código com linguagem, marcadores `[REVER]` para pendências.
- **Privacidade/performance**: processamento 100% local (PDF.js embutido, sem CDN), histórico no dispositivo.

## Limitações conhecidas

- PDF escaneado **sem camada de texto** não gera texto automaticamente: a página é sinalizada para descrição/OCR manual.
- A descrição de figuras cobre o conteúdo visual (não é transcrição letra a letra de textos dentro de imagens).
- Conversões automáticas ambíguas (tabelas complexas, imagens) exigem revisão pontual — por isso existe o passo de edição antes de salvar.