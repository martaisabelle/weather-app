# WeatherApp

![Screenshot](assets/screenshot.png)

Aplicação web de clima com geolocalização automática, busca global de cidades e animações contextuais.

**Demo:** [weather-app-eight-ashen-97.vercel.app](https://weather-app-eight-ashen-97.vercel.app/)

## Sobre o projeto

Criei esta aplicação para praticar consumo de APIs REST com JavaScript puro. O que começou como um exercício simples evoluiu para um projeto com busca inteligente, ícones climáticos SVG customizados e animações em canvas — tudo sem frameworks.

## Funcionalidades

- **Geolocalização automática** — detecta a cidade do usuário via HTML5 Geolocation API
- **Botão de relocalização** — permite retornar à localização atual a qualquer momento
- **Busca global com autocomplete** — sugere cidades em tempo real com debounce de 260ms; aceita nomes em português ou inglês
- **Busca bilíngue** — termos em português ("Coreia do Sul", "Alemanha", "São Paulo") são traduzidos e buscados em paralelo na API para garantir resultados corretos
- **Navegação por teclado** — autocomplete navegável com ↑ ↓ Enter Escape
- **Ícones SVG inline** — 14 condições climáticas cobertas com ícones vetoriais próprios: ensolarado, noite clara, nublado, neblina, chuvisco, chuva, chuva forte, tempestade, granizo, neve, vento e mais
- **Canvas contextual** — animação sutil no fundo do card muda conforme o clima: chuva cai, neve flutua, estrelas piscam à noite, partículas de sol no dia limpo, flash de relâmpago em tempestades
- **Dados exibidos:** temperatura (°C), sensação térmica, condição climática, cidade, região, umidade, velocidade do vento e índice UV
- **Skeleton loading** — placeholder animado ocupa o espaço correto enquanto os dados chegam
- **Design responsivo** — funciona em mobile, tablet e desktop
- **Acessibilidade** — `aria-live`, `aria-label`, `role="listbox"`, `prefers-reduced-motion`

## O que aprendi

- Consumir e encadear múltiplas chamadas a uma API REST (busca → resultado → clima por coordenadas)
- Fazer buscas em paralelo com `Promise.all` para melhorar cobertura sem aumentar latência
- Corrigir problemas de encoding UTF-8 / Latin-1 sem depender de funções deprecated (`escape()`)
- Desenhar e animar elementos em `<canvas>` com controle de FPS e pausa por visibilidade
- Criar ícones SVG do zero para representar condições climáticas
- Implementar debounce, navegação por teclado e UX de autocomplete sem bibliotecas
- Fazer deploy em produção com Vercel

## Stack
| Camada | Tecnologia |
|---|---|
| Markup | HTML5 semântico |
| Estilo | CSS3 — glassmorphism, variáveis CSS, animações |
| Lógica | Vanilla JavaScript (ES2022) |
| API | [WeatherAPI.com](https://www.weatherapi.com/) — endpoints `/search` e `/current` |
| Fontes | Google Fonts — DM Serif Display + DM Sans |
| Deploy | Vercel |

Sem frameworks, sem bundlers, sem dependências de terceiros em runtime.

## Como rodar localmente

```bash
git clone https://github.com/seu-usuario/weather-app.git
cd weather-app
# Abra index.html no navegador — não precisa de servidor
open index.html
```

> A API key já está no código para facilitar testes. Em produção, o ideal é movê-la para uma variável de ambiente com um proxy serverless.

Feito por **Marta Isabelle**
