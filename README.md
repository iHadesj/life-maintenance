# LIFE/MAINTENANCE

Um sistema de **manutenção preventiva da vida**. Não é um gerenciador de tarefas: cada coisa
que sofre desgaste é um *sistema* com um *ciclo*, e o app responde
**"o que está começando a precisar da minha atenção?"**.

React 19 + TypeScript · Vite 8 · Framer Motion 12 · Dexie (IndexedDB) · Three.js · PWA offline-first.
Otimizado para iPhone 11 instalado como app (414×896, safe areas, 60 fps).

> Decisões de design (direção visual, tokens, modelo de ciclo, linguagem de motion): [DESIGN.md](DESIGN.md)

---

## Rodando

```bash
npm install
npm run dev          # desenvolvimento (http://localhost:5173, exposto na rede)
npm run build        # typecheck + build de produção em dist/
npm run preview      # serve dist/ (o service worker só existe no build)
npm test             # testes unitários (ciclos, saúde, backup, busca, desgaste, terminal, repositórios)
npm run smoke        # e2e no build: emula iPhone 11, percorre os fluxos, testa offline e reduced motion
npm run smoke -- --browser=webkit   # o mesmo no motor do Safari
npm run assets       # regenera ícones, favicon e telas de abertura do iOS
```

O `smoke` serve `dist/` com um servidor estático simples (como um host de produção), grava
screenshots em `.smoke/` e falha se houver qualquer erro de console. Cobre: onboarding, editor,
import/export, mergulho em área, detalhe, serviço por botão e por gesto, segurar (HUD), puxar
(SYSTEM CHECK), remover, área personalizada, edição, terminal, reload **sem rede** pelo service
worker, larguras 375–1440 e reduced motion.
Na primeira vez: `npx playwright install chromium webkit`. No WebKit do Windows o Playwright não
emula toques sintéticos nem service worker + offline; esses dois passos rodam só no Chromium.

## Instalando no iPhone

Service workers exigem **HTTPS** (ou `localhost`). Pelo IP da rede local em `http://` o app abre,
mas não instala nem funciona offline.

1. Publique `dist/` em qualquer host estático com HTTPS (Netlify, Vercel, Cloudflare Pages…).
   Em subcaminho (ex.: GitHub Pages): `LM_BASE=/nome-do-repo/ npm run build`.
2. Abra a URL no **Safari** → Compartilhar → **Adicionar à Tela de Início**.
3. Abra pelo ícone: tela cheia, barra de status translúcida, splash próprio. Daí em diante funciona
   sem internet.

Instalado, o iOS não aplica o limite de 7 dias de armazenamento a sites; o app também pede
armazenamento persistente ao registrar o primeiro sistema.

## Usando

| Gesto / atalho | Efeito |
|---|---|
| Arrastar um sistema → | empurra o tempo para trás na linha de desgaste; soltar = **serviço registrado** (com desfazer) |
| Arrastar um sistema ← | o item se estica; soltar = editar |
| Segurar um sistema | leitura técnica ao lado do dedo |
| Tocar | abre o sistema; arrastar o "agora" da linha até a origem também registra o serviço |
| Puxar a tela SYSTEM para baixo | SYSTEM CHECK (recalcula os ciclos para hoje) |
| Arrastar a órbita | gira o sistema, com inércia |
| `>_` no trilho (tocar ou puxar para cima) · `⌘K` / `Ctrl K` | terminal |
| `/` · `n` | buscar · novo sistema (desktop) |

Terminal (autocomplete com `Tab`, aliases como `done`, `cd`, `ls`):

```
> add <nome>            > complete <sistema>     > open <área|sistema|página>
> search <texto>        > show overdue|attention|stable|all
> edit <sistema>        > export data            > import data
> system check          > new area               > motion system|full|reduced
```

## Dados e backup

- **IndexedDB é a fonte da verdade** (tabelas `maintenanceItems`, `maintenanceLogs`, `categories`,
  `settings`). Nada sai do aparelho; não há conta nem servidor.
- **Export JSON** (Settings ou `export data`): no iPhone abre a folha de compartilhamento
  (salvar em Arquivos, AirDrop…); no desktop baixa o arquivo. A data do último backup aparece em
  Settings — o próprio backup tem um ciclo de 30 dias e uma linha de desgaste.
- **Import JSON**: mostra uma prévia (contagens, registros inválidos que serão ignorados) e pede o
  modo — *merge* (acrescenta/atualiza, mantém a versão mais recente) ou *replace* (segurar para confirmar).
- Remover um sistema mantém seu histórico no log.

## Estrutura

```
src/
  app/            shell, roteador por hash, provedor de dados, estado de UI, frame de página
  components/     primitivos: StatusGlyph, CycleIndicator (linha de desgaste), Sheet, Choice,
                  HoldButton, SystemHeader, SystemNav, ConsoleToasts, DataHUD, PageTitle…
  features/
    system-health/   SystemHealth, OrbitMap, CoreView, CoreFallback, HealthReadout
    maintenance/     MaintenanceNode, MaintenanceStream, MaintenanceDetail, MaintenanceEditor,
                     IntervalRuler, ResetLine, ItemHistory, ações e coreografia de serviço
    categories/      CategoryOrganism, CategoryCluster, CategoryField, CategoryEditor
    timeline/        MaintenanceTimeline, MaintenanceEvent, LogStats
    command-palette/ gramática pura (commands.ts) + CommandPalette
    settings/        painéis, import, export
    onboarding/      BootSequence, FirstRun, Suggestions
  pages/          System, Category, Queue, Log, Settings
  db/             tipos de domínio e schema Dexie
  repositories/   única camada que toca o IndexedDB
  services/       lógica pura e testável: ciclo, saúde, diagnóstico, backup, busca, datas, haptics
  motion/         springs, transições de página, constantes de gesto
  three/          núcleo WebGL (singleton, carregado sob demanda) e shaders
  styles/         tokens.css (paleta semântica, tipografia, espaço, camadas) e global.css
tests/            vitest
scripts/          geração de assets e smoke test
```

## Desempenho e acessibilidade

- Three.js só existe na tela SYSTEM, é carregado depois do boot, roda com DPR ≤ 2 e ~5 mil
  triângulos, pausa fora da tela/em segundo plano e cai para o núcleo SVG se o WebGL falhar.
- Animações contínuas: deriva orbital, núcleo, glyphs de sistemas vencidos e o cursor — o resto
  reage a estado ou gesto, só com `transform`, `opacity` e `clip-path`.
- **Reduced motion** (sistema ou Settings): sem boot, transforms e layout instantâneos, núcleo em
  quadro estático, keyframes anulados. Estado sempre legível como forma + texto.
- HTML semântico, rótulos ARIA, navegação por teclado (radiogroups com setas, slider na régua,
  combobox no terminal, foco preso em diálogos, `Esc`), alvos de toque ≥ 44 px, região `aria-live`.

## Notas

- Haptics no iPhone usam o retorno nativo do switch do iOS 18+; versões anteriores ficam em silêncio.
- No WebKit **do Windows** (usado pelo `smoke --browser=webkit`) as fontes variáveis são
  rasterizadas na instância padrão — o layout é idêntico, mas o traço aparece fino. O Safari do
  iOS/macOS (CoreText) renderiza normalmente.
- A interface está em inglês (microcopy técnica do briefing).
