# Brand assets — Pronutrition

Este diretório contém os arquivos oficiais de marca da Pronutrition,
fornecidos pelo departamento de Marketing. **Nenhum asset pode ser
recortado, redesenhado, vetorizado ou gerado artificialmente.**

Se um arquivo abaixo estiver ausente:
  1. Não crie um substituto visual.
  2. Sinalize a ausência no ticket correspondente.
  3. Aguarde o envio oficial pelo Marketing.

## Arquivos esperados

| Arquivo              | Uso                                                   | Fundo     |
|----------------------|-------------------------------------------------------|-----------|
| `logo-color.svg`     | Padrão em fundos claros (branco, surface-card, page)  | Claro     |
| `logo-white.svg`     | Sobreprimário em fundo brand roxo ou escuros          | Escuro    |
| `logo-mono.svg`      | Impressão monocromática, contraste máximo             | Qualquer  |
| `favicon.svg`        | Ícone de aba e PWA (quadrado, 1:1, variante color)   | N/A       |

## Regras de tratamento, respeitadas por `src/components/brand/Logo.tsx`

- Área de reserva: 25% da altura do logo em TODAS as direções. Nenhum
  elemento de interface pode invadir essa área.
- Proibido: `transform: rotate(...)`, `scale` não uniforme (x ≠ y),
  `filter: brightness/contrast/grayscale(...)`, `opacity < 1`,
  `box-shadow`, `text-shadow` ou qualquer efeito decorativo sobre o
  arquivo de marca.
- Proporção mantida sempre. `height` controla a altura do ativo;
  largura é `auto`.
- `alt` sempre exato: `"Pronutrition"`. Nunca vazio, nunca abreviado.

## Variantes

- **color** — default. Usa as cores oficiais da marca (roxo dominante).
  Aplicável em `bg-surface-page`, `bg-surface-card`, `bg-white`.
- **white** — versão em branco sólido. Aplicável apenas sobre
  `bg-brand` (#845AFA) ou superfícies com contraste equivalente.
- **mono** — versão preto/cinza de contraste máximo. Reservado para
  impressão ou layouts onde as cores da marca não podem ser aplicadas.
