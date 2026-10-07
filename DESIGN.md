# LIFE/MAINTENANCE — design foundation

Este documento fixa as decisões tomadas antes da implementação. Ele é a referência
para qualquer tela nova: se algo aqui não for respeitado, a tela não pertence ao produto.

---

## 1. Direção visual

**Metáfora:** a vida como um sistema físico que sofre desgaste e é restaurado por
manutenção. Nada é "tarefa"; tudo é *sistema* com um *ciclo*.

**Marca:** `LIFE/` — a barra é a assinatura. Toda a navegação é um caminho dentro do
"sistema de arquivos da vida": `LIFE/SYSTEM`, `LIFE/DIGITAL/`, `LIFE/LOG`.
A barra é sempre rosa (`--brand-hot`) e aparece no wordmark, nos títulos de categoria e
no prompt do terminal (`LIFE/ >`).

**Três assinaturas reconhecíveis sem logo:**

1. **A linha de desgaste** (`CycleIndicator`): `●────────◌`. Ponto cheio = último serviço,
   anel vazado = fim do ciclo. A linha cresce com o tempo e, a partir de ~45% do ciclo,
   começa a se fragmentar: lacunas, deslocamentos verticais, segmentos ausentes, um traço
   mais fino no trecho gasto e, depois do vencimento, partículas soltas além do anel.
   O desgaste é geometria determinística (seed = id do item), não animação contínua.
2. **A integridade do anel** (`StatusGlyph`): o estado é um anel que se rompe.
   STABLE = anel fechado · WATCH = abertura · ATTENTION = dois arcos · DUE = mira segmentada ·
   OVERDUE = fragmentos + "!" · CRITICAL = estilhaços em raios diferentes + núcleo pulsando.
   Forma, não cor, carrega a informação.
3. **O núcleo orbital** (`SystemHealth`): um organismo central (Three.js, com fallback SVG)
   orbitado pelas áreas da vida. Coeso e lento quando saudável; rachado, irregular e
   rosado quando há degradação.

**Composição:** sem grade de cards. Conteúdo nasce do fundo, ligado por *condutos*
(linhas verticais com ramificações curvas). Grupos são *blobs* orgânicos gerados por seed.
Texto faz parte da composição (número gigante sobreposto à órbita, rótulo vertical).
Bordas de sheets são curvas assimétricas que se deformam com a velocidade.

## 2. Tokens

Paleta derivada do Dracula, empurrada para um substrato mais profundo para a luz brilhar.

| Papel | Token | Valor |
|---|---|---|
| Fundo do app | `--bg` | `#1A1B23` |
| Superfície orgânica | `--surface` | `#262834` |
| Linhas estruturais | `--line` | `#44475A` |
| Texto | `--fg` / `--fg-3` / `--fg-4` | `#F8F8F2` / `#A2A6C4` / `#7A87BD` (AA) |
| Marca | `--brand` / `--brand-hot` | roxo `#BD93F9` / rosa `#FF79C6` |

**Estados** (sempre acompanhados de forma + texto):
STABLE verde · WATCH ciano · ATTENTION amarelo · DUE laranja · OVERDUE rosa · CRITICAL vermelho.

**Identidade de categoria** usa tons *pastéis* (`--id-violet`, `--id-sky`, …) para nunca
competir com a semântica de estado.

**Tipografia**
- `Martian Mono` (variável, peso **e largura**) — dados, rótulos, comandos. A largura
  tipográfica também codifica urgência: sistemas críticos ficam mais largos e pesados.
- `Syne` (variável) — títulos grandes e o número de saúde.
- Títulos display são **encaixados na medida**: cada linha dimensiona a fonte pelo próprio
  número de caracteres (classe `.fit`), então `MAINTENANCE` e `QUEUE/` formam um bloco
  justificado em qualquer largura, de 375px ao desktop — nunca quebram nem estouram.

## 3. Arquitetura de dados

```
IndexedDB (Dexie)            repositories/            services/ (puro, testável)
├─ maintenanceItems   ◄────  itemsRepository    ◄──  cycle.ts      (ciclo, estado, saúde)
├─ maintenanceLogs    ◄────  logsRepository          health.ts     (agregados, instabilidade)
├─ categories         ◄────  categoriesRepository    diagnosis.ts  (frase de diagnóstico)
└─ settings           ◄────  settingsRepository      backup.ts     (serialização/validação)
                              transfer.ts (export/import)
```

A UI nunca toca o Dexie diretamente: lê via `useLiveQuery` dentro do `SystemDataProvider`
e escreve via repositórios.

**Ciclo** (dias de calendário, local):

```
elapsedDays   = dias desde lastMaintenanceAt
cycleProgress = elapsedDays / recommendedIntervalDays
daysRemaining = max(0, intervalo − elapsed)
daysOverdue   = max(0, elapsed − intervalo)
```

| Estado | Regra |
|---|---|
| STABLE | progresso < 50% |
| WATCH | 50–75% |
| ATTENTION | 75–90% |
| DUE | ≥ 90% até o dia do vencimento |
| OVERDUE | passou do intervalo |
| CRITICAL | vencido **e** progresso ≥ limiar da criticidade (low 200%, medium 150%, high 125%, critical 110%) **e** ≥ 2 dias de atraso |

**Saúde** do item: `100·(1 − 0.4p²)` até o vencimento (60% no dia), depois decai
exponencialmente. **Saúde do sistema**: média ponderada pela criticidade (1 / 1.5 / 2.25 / 3).
Um item vencido puxa o número para baixo sem dominá-lo — o objetivo é manutenção
preventiva, não ansiedade.

## 4. Linguagem de motion

Regra: **nada aparece do nada.** Todo elemento entra *de algum lugar* — de uma linha, de
um ponto, de outro elemento, de uma máscara.

| Primitivo | Uso |
|---|---|
| **Scan line** (clip-path + linha) | troca de abas, boot, system check |
| **Dive / surface** (layoutId + clip circular) | entrar/sair de uma categoria |
| **Sprout** (pathLength + clip lateral) | itens nascem do conduto |
| **Rewind** (spring da linha para trás) | conclusão de manutenção |
| **Fold / dissolve** (clip + colapso de layout) | exclusão |
| **Tension edge** (velocidade → curvatura) | sheets e bordas orgânicas |

Springs nomeados em `src/motion/springs.ts` (`organic`, `snappy`, `elastic`, `sheet`…).
Animações infinitas: apenas o núcleo (pausado fora da tela), deriva orbital lenta,
glyphs OVERDUE/CRITICAL e o cursor. Tudo o resto é reativo a estado ou gesto.

Reduced motion: transforms/layout desligados via `MotionConfig`, boot pulado, núcleo
renderizado em quadro estático, keyframes CSS anulados. Nenhuma informação depende de
animação.

## 5. Estrutura de páginas

```
LIFE/SYSTEM        núcleo + órbita + diagnóstico + atenção + subsistemas   #/
LIFE/<CAT>/        organismo da categoria + campo gravitacional de itens    #/c/:id
LIFE/QUEUE         fila de manutenção por urgência, filtros e busca         #/queue
LIFE/LOG           timeline estilo git log + estatísticas                   #/log
LIFE/SETTINGS      backup, categorias, motion, núcleo, armazenamento        #/settings
overlays           ?item=:id (detalhe) · ?edit=:id|new (editor) · ⌘K (terminal)
```

Navegação mobile: trilho inferior com "notch" líquido que segue a aba ativa e o prompt
`>_` central (terminal). Desktop (≥1024px): o mesmo trilho vira abas de editor no topo.

## 6. Gestos

| Gesto | Efeito |
|---|---|
| Arrastar item → | a linha de desgaste é empurrada para trás; soltar após o limiar = SERVICE |
| Arrastar item ← | o item se estica; soltar = EDIT |
| Segurar item | leitura técnica aparece perto do dedo |
| Puxar a home para baixo | SYSTEM CHECK |
| Arrastar a órbita | gira o sistema com inércia |
| Arrastar o ponto da linha até a origem (detalhe) | reseta o ciclo |
| Arrastar a régua de intervalo (editor) | ajusta o ciclo com resistência física |
