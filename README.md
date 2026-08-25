# Materiais Acessíveis — Pacote completo

Pacote com os materiais didáticos convertidos para **Markdown acessível** (leitor de tela) e o **painel web** que faz a conversão.

## Estrutura

```
Materiais-Acessiveis/
├── materiais/          ← 6 arquivos Markdown prontos para uso (entrega principal)
│   ├── lista-01.md               (versão limpa e fiel ao PDF — 24/08/2026)
│   ├── lista-01-correcoes.md     (registro das correções da conversão anterior)
│   ├── lista-02-acessivel.md
│   ├── notas-poo-i-acessivel.md
│   ├── notas-poo-ii-acessivel.md
│   └── notas-excecoes-acessivel.md
└── painel-web/         ← o painel completo (documento original / página web)
    ├── index.html      (abra este arquivo no navegador)
    ├── assets/         (css, js, PDF.js)
    ├── amostras/       (mesmas conversões, versões de exemplo do painel)
    ├── nginx.conf
    └── README.md       (guia de uso e modificação do painel)
```

## Como usar

**Materiais (Markdown):** abra qualquer arquivo da pasta `materiais/` em um editor
de texto, Typora, VS Code ou qualquer visualizador de Markdown. Eles são texto
puro — funcionam perfeitamente com leitores de tela (NVDA/JAWS no Windows,
VoiceOver no Mac/iOS). Tabelas são tabelas reais, blocos de código têm
linguagem identificada (`java`) e as figuras/diagramas têm descrição textual.

**Painel web:** abra `painel-web/index.html` em um navegador (Chrome, Edge,
Firefox). Tudo roda localmente, sem internet: arraste um PDF e ele converte
para Markdown acessível no navegador, com histórico salvo no próprio
computador (localStorage). Veja o `README.md` dentro de `painel-web/` para
detalhes de uso e modificação.

## Sobre o conteúdo

- Origem: PDFs da disciplina **Linguagem de Programação II** (Bacharelado em
  Sistemas de Informação, 3º período, 2026.2), docente Alexandro dos Santos Silva.
- Conversão: 5 materiais revisados (13 tabelas, 148 blocos de código,
  5 descrições de figura) + Lista 01 regerada em versão limpa e verificada
  palavra a palavra contra o PDF.
- Fidelidade: o texto preserva a grafia original dos PDFs; nenhum conteúdo
  foi inventado. As descrições de diagramas são as revisadas e validadas.