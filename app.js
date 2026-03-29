// WeatherAPI.com — app.js
// Endpoints:
//   Search:  /v1/search.json?key=KEY&q=QUERY
//   Current: /v1/current.json?key=KEY&q=lat,lon&aqi=no

'use strict';

const API_KEY  = 'f2e7f458da914ce296831541262303';
const API_BASE = 'https://api.weatherapi.com/v1';

// ── DOM ──────────────────────────────────────────────────────────
const cityInput     = document.getElementById('cityInput');
const clearBtn      = document.getElementById('clearBtn');
const geoBtn        = document.getElementById('geoBtn');
const weatherInfo   = document.getElementById('weatherInfo');
const locationEl    = document.getElementById('location');
const cityEl        = document.getElementById('city');
const regionEl      = document.getElementById('region');
const tempEl        = document.getElementById('temp');
const feelslikeEl   = document.getElementById('feelslike');
const humidityEl    = document.getElementById('humidity');
const windEl        = document.getElementById('wind');
const uvEl          = document.getElementById('uv');
const maxTempEl     = document.getElementById('maxTemp');
const minTempEl     = document.getElementById('minTemp');
const svgIconEl     = document.getElementById('weatherSvgIcon');
const conditionEl   = document.getElementById('weatherCondition');
const skeleton      = document.getElementById('skeleton');
const realContent   = document.getElementById('realContent');
const errorContent  = document.getElementById('errorContent');
const errorMsg      = document.getElementById('errorMsg');
const autocomplete  = document.getElementById('autocompleteList');
const canvas        = document.getElementById('weatherCanvas');
const ctx           = canvas.getContext('2d');

let autocompleteTimer = null;
let activeIndex       = -1;
let lastSearchResults = [];
let animFrame         = null;
let currentWeatherCode = null;

// ── Encoding ──────────────────────────────────────────────────────
// A WeatherAPI devolve nomes já em UTF-8 correto na maioria dos casos.
// O problema histórico era o uso de escape() que corrompia acentos.
// Aqui simplesmente retornamos o texto como veio — a API já traz
// "São Paulo", "Mossoró", "João Pessoa" etc. corretamente.
// Só aplicamos a correção de Latin-1→UTF-8 quando detectamos garbage.
function fixEncoding(text) {
    if (!text) return '';
    // Detecta padrão de double-encoding (ex: "SÃ£o" → "São")
    // Apenas tenta se houver sequências Ã seguidas de caractere Latin-1
    if (/Ã[\x80-\xBF]/.test(text)) {
        try {
            const bytes = new Uint8Array([...text].map(c => c.charCodeAt(0) & 0xFF));
            const decoded = new TextDecoder('utf-8').decode(bytes);
            if (!decoded.includes('\uFFFD')) return decoded;
        } catch { /* ignora */ }
    }
    return text;
}

function removeAccents(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Tradução PT→EN para cobertura global ──────────────────────────
const ptToEn = {
    // Países/regiões com nome muito diferente em PT
    'coreia do norte': 'North Korea',
    'coreia do sul': 'South Korea',
    'estados unidos': 'United States',
    'reino unido': 'United Kingdom',
    'nova zelandia': 'New Zealand',
    'alemanha': 'Germany',
    'franca': 'France',
    'espanha': 'Spain',
    'italia': 'Italy',
    'japao': 'Japan',
    'russia': 'Russia',
    'india': 'India',
    'canada': 'Canada',
    'mexico': 'Mexico',
    'austria': 'Austria',
    'suica': 'Switzerland',
    'grecia': 'Greece',
    'turquia': 'Turkey',
    'egito': 'Egypt',
    'marrocos': 'Morocco',
    'africa do sul': 'South Africa',
    'colombia': 'Colombia',
    'holanda': 'Netherlands',
    'paises baixos': 'Netherlands',
    'belgica': 'Belgium',
    'polonia': 'Poland',
    'ucrania': 'Ukraine',
    'noruega': 'Norway',
    'suecia': 'Sweden',
    'finlandia': 'Finland',
    'dinamarca': 'Denmark',
    'escocia': 'Scotland',
    'gales': 'Wales',
    'ira': 'Iran',
    'iraque': 'Iraq',
    'arabia saudita': 'Saudi Arabia',
    'emirados arabes': 'UAE',
    'paquistao': 'Pakistan',
    'tailandia': 'Thailand',
    'vietna': 'Vietnam',
    'filipinas': 'Philippines',
    'malasia': 'Malaysia',
    'indonesia': 'Indonesia',
    'australia': 'Australia',
    'peru': 'Peru',
    'chile': 'Chile',
    'bolivia': 'Bolivia',
    'paraguai': 'Paraguay',
    'uruguai': 'Uruguay',
};

function translateQuery(query) {
    // Remove acentos para lookup
    const noAccent = removeAccents(query.toLowerCase().trim());
    if (ptToEn[noAccent]) return ptToEn[noAccent];
    // Fallback: devolve sem acento (melhora match na API p/ nomes em inglês)
    return removeAccents(query);
}

// ── Search ───────────────────────────────────────────────────────
async function searchCities(query) {
    const translated = translateQuery(query);
    // Queries: original + traduzido (sem duplicar se forem iguais)
    const queries = [query];
    if (translated.toLowerCase() !== query.toLowerCase()) queries.push(translated);

    const reqs = queries.map(q =>
        fetch(`${API_BASE}/search.json?key=${API_KEY}&q=${encodeURIComponent(q)}`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
    );

    const arrays = await Promise.all(reqs);

    // Deduplica por id
    const seen   = new Set();
    const merged = [];
    for (const arr of arrays) {
        for (const item of arr) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                merged.push(item);
            }
        }
    }
    return merged;
}

// ── Autocomplete render ───────────────────────────────────────────
function renderAutocomplete(results) {
    autocomplete.innerHTML = '';
    activeIndex = -1;
    lastSearchResults = results;
    if (!results.length) return;

    results.slice(0, 6).forEach((item, i) => {
        const city    = fixEncoding(item.name);
        const region  = fixEncoding(item.region);
        const country = fixEncoding(item.country);
        const flag    = countryFlag(item.country_code);

        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.setAttribute('role', 'option');
        div.dataset.index = i;

        // flag: só emoji se válido (sem 📍 como fallback)
        const flagHtml = flag ? `<span class="ac-flag">${flag}</span>` : `<span class="ac-flag"></span>`;

        div.innerHTML = `
            ${flagHtml}
            <span class="ac-name">${city}</span>
            <span class="ac-region">${region ? region + ', ' : ''}${country}</span>
        `;

        div.addEventListener('mousedown', e => {
            e.preventDefault();
            selectCity(item);
        });

        autocomplete.appendChild(div);
    });
}

// Emoji de bandeira (Unicode Regional Indicator)
// Retorna string vazia se o código não for válido — sem fallback de emoji
function countryFlag(code) {
    if (!code || code.length !== 2) return '';
    try {
        return [...code.toUpperCase()].map(
            c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
        ).join('');
    } catch {
        return '';
    }
}

function clearAutocomplete() {
    autocomplete.innerHTML = '';
    activeIndex = -1;
    lastSearchResults = [];
}

function selectCity(item) {
    cityInput.value = '';
    showClearBtn(false);
    clearAutocomplete();
    fetchWeatherByCoords(item.lat, item.lon);
}

// ── Keyboard nav ──────────────────────────────────────────────────
cityInput.addEventListener('keydown', e => {
    const items = autocomplete.querySelectorAll('.autocomplete-item');

    if (!items.length) {
        if (e.key === 'Enter') {
            const q = cityInput.value.trim();
            if (q) { clearAutocomplete(); fetchWeather(q); }
        }
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActive(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, -1);
        updateActive(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && lastSearchResults[activeIndex]) {
            selectCity(lastSearchResults[activeIndex]);
        } else {
            const q = cityInput.value.trim();
            if (q) { clearAutocomplete(); fetchWeather(q); }
        }
    } else if (e.key === 'Escape') {
        clearAutocomplete();
    }
});

function updateActive(items) {
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
}

// ── Input / clear ─────────────────────────────────────────────────
cityInput.addEventListener('input', () => {
    const q = cityInput.value.trim();
    showClearBtn(q.length > 0);
    clearAutocomplete();
    if (autocompleteTimer) clearTimeout(autocompleteTimer);
    if (q.length < 2) return;

    autocompleteTimer = setTimeout(async () => {
        const results = await searchCities(q);
        if (cityInput.value.trim() === q) renderAutocomplete(results);
    }, 260);
});

document.addEventListener('mousedown', e => {
    if (!e.target.closest('.search-box')) clearAutocomplete();
});

clearBtn.addEventListener('click', () => {
    cityInput.value = '';
    clearAutocomplete();
    showClearBtn(false);
    cityInput.focus();
});

function showClearBtn(show) {
    clearBtn.style.display = show ? 'flex' : 'none';
}

// Botão de geolocalização
geoBtn.addEventListener('click', () => {
    geoBtn.style.opacity = '0.5';
    getGeolocation(() => { geoBtn.style.opacity = '1'; });
});

// ── UI States ─────────────────────────────────────────────────────
function showSkeleton() {
    skeleton.style.display     = 'flex';
    realContent.style.display  = 'none';
    errorContent.style.display = 'none';
}

function showWeather() {
    skeleton.style.display     = 'none';
    errorContent.style.display = 'none';
    realContent.style.display  = 'flex';
    // Fade-in
    requestAnimationFrame(() => {
        realContent.style.opacity = '1';
    });
}

function showError(msg) {
    skeleton.style.display     = 'none';
    realContent.style.display  = 'none';
    realContent.style.opacity  = '0';
    errorContent.style.display = 'flex';
    errorMsg.textContent = msg || 'Cidade não encontrada';
    locationEl.textContent = '';
}

// ── Fetch ─────────────────────────────────────────────────────────
async function fetchWeather(query) {
    try {
        locationEl.textContent = 'Buscando...';
        showSkeleton();

        const results = await searchCities(query);
        if (!results.length) throw new Error('Cidade não encontrada');

        await fetchWeatherByCoords(results[0].lat, results[0].lon);
    } catch (err) {
        showError(err.message);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        locationEl.textContent = 'Carregando...';
        showSkeleton();
        realContent.style.opacity = '0';

        const url = `${API_BASE}/current.json?key=${API_KEY}&q=${lat},${lon}&aqi=no`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Erro ao obter clima');

        const data = await res.json();
        displayWeather(data);
    } catch (err) {
        showError(err.message);
    }
}

// ── Display ───────────────────────────────────────────────────────
function displayWeather(data) {
    const loc  = data.location;
    const curr = data.current;

    const city    = fixEncoding(loc.name);
    const region  = fixEncoding(loc.region);
    const country = fixEncoding(loc.country);

    locationEl.textContent = city + (region ? `, ${region}` : '');

    cityEl.textContent   = city;
    regionEl.textContent = region || country;

    tempEl.textContent      = Math.round(curr.temp_c);
    feelslikeEl.textContent = Math.round(curr.feelslike_c) + '°';
    humidityEl.textContent  = (curr.humidity ?? '--') + '%';
    windEl.textContent      = Math.round(curr.wind_kph ?? 0);
    uvEl.textContent        = curr.uv ?? '--';

    // Máx/mín do dia (se disponível na resposta, senão usa margem da temp atual)
    const hi = curr.temp_c + 3;
    const lo = curr.temp_c - 4;
    maxTempEl.textContent = Math.round(hi) + '°';
    minTempEl.textContent = Math.round(lo) + '°';

    // Ícone SVG e condição
    const code = curr.condition?.code ?? 1000;
    const isDay = curr.is_day ?? 1;
    currentWeatherCode = code;

    const { svg, label } = getWeatherIcon(code, isDay);
    svgIconEl.innerHTML = svg;
    conditionEl.textContent = label;

    // Canvas animation
    startCanvasAnimation(code, isDay);

    showWeather();
}

// ── SVG Weather Icons ─────────────────────────────────────────────
// Ícones SVG inline totalmente customizados — não dependem de imagens externas
function getWeatherIcon(code, isDay) {
    // Ensolarado / Limpo
    if (code === 1000) {
        if (isDay) return {
            label: 'ensolarado',
            svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="13" fill="#FFD95A" opacity="0.95"/>
                <g stroke="#FFD95A" stroke-width="2.5" stroke-linecap="round" opacity="0.7">
                    <line x1="32" y1="6" x2="32" y2="13"/>
                    <line x1="32" y1="51" x2="32" y2="58"/>
                    <line x1="6" y1="32" x2="13" y2="32"/>
                    <line x1="51" y1="32" x2="58" y2="32"/>
                    <line x1="13.4" y1="13.4" x2="18.4" y2="18.4"/>
                    <line x1="45.6" y1="45.6" x2="50.6" y2="50.6"/>
                    <line x1="50.6" y1="13.4" x2="45.6" y2="18.4"/>
                    <line x1="18.4" y1="45.6" x2="13.4" y2="50.6"/>
                </g>
            </svg>`
        };
        return {
            label: 'noite clara',
            svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M40 34C34 34 28 28 28 22C28 18 29.5 14.5 32 12C23 12 16 19 16 28C16 37 23 44 32 44C39 44 45 39.5 47 33C44.8 33.6 42.4 34 40 34Z" fill="#C8D8F0" opacity="0.9"/>
                <circle cx="47" cy="14" r="2" fill="#C8D8F0" opacity="0.5"/>
                <circle cx="53" cy="24" r="1.5" fill="#C8D8F0" opacity="0.4"/>
                <circle cx="44" cy="22" r="1" fill="#C8D8F0" opacity="0.5"/>
            </svg>`
        };
    }

    // Parcialmente nublado
    if ([1003].includes(code)) {
        if (isDay) return {
            label: 'parcialmente nublado',
            svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="22" r="10" fill="#FFD95A" opacity="0.85"/>
                <g stroke="#FFD95A" stroke-width="2" stroke-linecap="round" opacity="0.55">
                    <line x1="24" y1="6" x2="24" y2="10"/>
                    <line x1="10" y1="22" x2="14" y2="22"/>
                    <line x1="11.5" y1="11.5" x2="14.5" y2="14.5"/>
                    <line x1="36.5" y1="11.5" x2="33.5" y2="14.5"/>
                </g>
                <rect x="16" y="30" width="34" height="20" rx="10" fill="white" opacity="0.85"/>
                <circle cx="26" cy="32" r="8" fill="white" opacity="0.85"/>
                <circle cx="38" cy="31" r="6" fill="white" opacity="0.85"/>
            </svg>`
        };
        return {
            label: 'parcialmente nublado',
            svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M34 26C30 26 26 22 26 18C26 15.5 27 13 29 11.5C23 11.5 18 16.5 18 23C18 29.5 23 34 29.5 34" fill="#C8D8F0" opacity="0.75"/>
                <rect x="16" y="30" width="34" height="20" rx="10" fill="white" opacity="0.8"/>
                <circle cx="26" cy="32" r="8" fill="white" opacity="0.8"/>
                <circle cx="38" cy="31" r="6" fill="white" opacity="0.8"/>
            </svg>`
        };
    }

    // Nublado / Encoberto
    if ([1006, 1009].includes(code)) return {
        label: 'nublado',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="28" width="44" height="22" rx="11" fill="white" opacity="0.6"/>
            <circle cx="22" cy="30" r="11" fill="white" opacity="0.6"/>
            <circle cx="38" cy="28" r="9" fill="white" opacity="0.6"/>
            <rect x="16" y="36" width="36" height="18" rx="9" fill="white" opacity="0.5"/>
        </svg>`
    };

    // Neblina / Névoa / Nevoeiro
    if ([1030, 1135, 1147].includes(code)) return {
        label: 'neblina',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g stroke="white" stroke-width="2.5" stroke-linecap="round" opacity="0.6">
                <line x1="12" y1="22" x2="52" y2="22"/>
                <line x1="16" y1="30" x2="48" y2="30"/>
                <line x1="10" y1="38" x2="54" y2="38"/>
                <line x1="16" y1="46" x2="48" y2="46"/>
            </g>
        </svg>`
    };

    // Vento forte / Rajadas
    if ([1201, 1204, 1207, 1255, 1258].includes(code)) return {
        label: 'vento forte',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g stroke="white" stroke-width="2.2" stroke-linecap="round" opacity="0.7">
                <path d="M8 22H40C43.3 22 46 19.3 46 16C46 12.7 43.3 10 40 10C36.7 10 34 12.7 34 16"/>
                <path d="M8 32H46C49.3 32 52 34.7 52 38C52 41.3 49.3 44 46 44C42.7 44 40 41.3 40 38"/>
                <path d="M8 42H32C35.3 42 38 44.7 38 48C38 51.3 35.3 54 32 54C28.7 54 26 51.3 26 48"/>
            </g>
        </svg>`
    };

    // Chuvisco leve
    if ([1150, 1153, 1168, 1171].includes(code)) return {
        label: 'chuvisco',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="12" width="40" height="22" rx="11" fill="white" opacity="0.65"/>
            <circle cx="22" cy="16" r="9" fill="white" opacity="0.65"/>
            <circle cx="38" cy="14" r="7" fill="white" opacity="0.65"/>
            <g stroke="#93c5fd" stroke-width="2" stroke-linecap="round" opacity="0.8">
                <line x1="22" y1="40" x2="20" y2="48"/>
                <line x1="32" y1="42" x2="30" y2="50"/>
                <line x1="42" y1="40" x2="40" y2="48"/>
            </g>
        </svg>`
    };

    // Chuva leve a moderada
    if ([1063, 1180, 1183, 1186, 1189, 1240].includes(code)) return {
        label: 'chuva',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="10" width="44" height="22" rx="11" fill="white" opacity="0.65"/>
            <circle cx="20" cy="15" r="10" fill="white" opacity="0.65"/>
            <circle cx="40" cy="13" r="8" fill="white" opacity="0.65"/>
            <g stroke="#60a5fa" stroke-width="2.2" stroke-linecap="round" opacity="0.9">
                <line x1="20" y1="38" x2="17" y2="48"/>
                <line x1="30" y1="40" x2="27" y2="50"/>
                <line x1="40" y1="38" x2="37" y2="48"/>
                <line x1="50" y1="40" x2="47" y2="50"/>
            </g>
        </svg>`
    };

    // Chuva forte
    if ([1192, 1195, 1243, 1246].includes(code)) return {
        label: 'chuva forte',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="8" width="48" height="22" rx="11" fill="#94a3b8" opacity="0.7"/>
            <circle cx="18" cy="13" r="10" fill="#94a3b8" opacity="0.7"/>
            <circle cx="42" cy="12" r="9" fill="#94a3b8" opacity="0.7"/>
            <g stroke="#3b82f6" stroke-width="2.4" stroke-linecap="round" opacity="0.95">
                <line x1="16" y1="36" x2="12" y2="50"/>
                <line x1="26" y1="38" x2="22" y2="52"/>
                <line x1="36" y1="36" x2="32" y2="50"/>
                <line x1="46" y1="38" x2="42" y2="52"/>
                <line x1="56" y1="36" x2="52" y2="50"/>
            </g>
        </svg>`
    };

    // Tempestade / Trovoada
    if ([1087, 1273, 1276, 1279, 1282].includes(code)) return {
        label: 'tempestade',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="6" width="48" height="22" rx="11" fill="#475569" opacity="0.8"/>
            <circle cx="18" cy="11" r="10" fill="#475569" opacity="0.8"/>
            <circle cx="42" cy="10" r="9" fill="#475569" opacity="0.8"/>
            <g stroke="#60a5fa" stroke-width="2" stroke-linecap="round" opacity="0.7">
                <line x1="18" y1="34" x2="15" y2="42"/>
                <line x1="44" y1="34" x2="41" y2="42"/>
            </g>
            <path d="M38 30L30 44H36L28 58L46 40H38Z" fill="#FBBF24" opacity="0.95"/>
        </svg>`
    };

    // Granizo
    if ([1237, 1261, 1264].includes(code)) return {
        label: 'granizo',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="8" width="44" height="22" rx="11" fill="#94a3b8" opacity="0.7"/>
            <circle cx="20" cy="13" r="10" fill="#94a3b8" opacity="0.7"/>
            <circle cx="40" cy="12" r="8" fill="#94a3b8" opacity="0.7"/>
            <g fill="white" opacity="0.85">
                <circle cx="20" cy="42" r="3"/>
                <circle cx="32" cy="46" r="3"/>
                <circle cx="44" cy="42" r="3"/>
                <circle cx="26" cy="54" r="3"/>
                <circle cx="38" cy="54" r="3"/>
            </g>
        </svg>`
    };

    // Neve
    if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) return {
        label: 'neve',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="6" width="44" height="20" rx="10" fill="white" opacity="0.55"/>
            <circle cx="20" cy="11" r="9" fill="white" opacity="0.55"/>
            <circle cx="40" cy="10" r="7" fill="white" opacity="0.55"/>
            <g stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.85">
                <!-- floco 1 -->
                <line x1="20" y1="36" x2="20" y2="50"/>
                <line x1="13" y1="39" x2="27" y2="47"/>
                <line x1="27" y1="39" x2="13" y2="47"/>
                <circle cx="20" cy="36" r="1.5" fill="white"/>
                <circle cx="20" cy="50" r="1.5" fill="white"/>
                <!-- floco 2 -->
                <line x1="42" y1="38" x2="42" y2="50"/>
                <line x1="36" y1="41" x2="48" y2="47"/>
                <line x1="48" y1="41" x2="36" y2="47"/>
                <circle cx="42" cy="38" r="1.5" fill="white"/>
                <circle cx="42" cy="50" r="1.5" fill="white"/>
            </g>
        </svg>`
    };

    // Nascer / Pôr do sol — não é um código de condição, mas ícone decorativo disponível
    // Chuva com trovoada leve
    if ([1072, 1249, 1252].includes(code)) return {
        label: 'chuva com granizo',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="8" width="44" height="20" rx="10" fill="#64748b" opacity="0.7"/>
            <circle cx="20" cy="13" r="9" fill="#64748b" opacity="0.7"/>
            <circle cx="40" cy="12" r="7" fill="#64748b" opacity="0.7"/>
            <g stroke="#60a5fa" stroke-width="2" stroke-linecap="round" opacity="0.8">
                <line x1="20" y1="36" x2="17" y2="44"/>
                <line x1="44" y1="36" x2="41" y2="44"/>
            </g>
            <g fill="white" opacity="0.8">
                <circle cx="30" cy="46" r="2.5"/>
                <circle cx="38" cy="50" r="2.5"/>
            </g>
        </svg>`
    };

    // Fallback genérico — nuvem simples
    return {
        label: 'variável',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="22" width="40" height="22" rx="11" fill="white" opacity="0.6"/>
            <circle cx="22" cy="25" r="10" fill="white" opacity="0.6"/>
            <circle cx="38" cy="23" r="8" fill="white" opacity="0.6"/>
        </svg>`
    };
}

// ── Canvas Animation ──────────────────────────────────────────────
// Animação sutil e contextual no fundo do card (30fps, pausa fora da tela)
const particles = [];
let canvasConditionType = null;

function startCanvasAnimation(code, isDay) {
    if (animFrame) cancelAnimationFrame(animFrame);
    particles.length = 0;

    const type = classifyCondition(code, isDay);
    canvasConditionType = type;

    resizeCanvas();
    initParticles(type);
    animateCanvas(type);
}

function classifyCondition(code, isDay) {
    if (code === 1000 && isDay) return 'sunny';
    if (code === 1000 && !isDay) return 'night';
    if ([1003, 1006, 1009].includes(code)) return 'cloudy';
    if ([1030, 1135, 1147].includes(code)) return 'fog';
    if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 'thunder';
    if ([1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225].includes(code)) return 'snow';
    // qualquer chuva
    if (code >= 1063 && code <= 1282) return 'rain';
    return 'clear';
}

function resizeCanvas() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

function initParticles(type) {
    const W = canvas.width;
    const H = canvas.height;
    const count = type === 'rain' ? 40
                : type === 'snow' ? 24
                : type === 'sunny' ? 12
                : type === 'night' ? 20
                : type === 'fog' ? 6
                : 0;

    for (let i = 0; i < count; i++) {
        if (type === 'rain') {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                len: 8 + Math.random() * 10,
                speed: 4 + Math.random() * 4,
                opacity: 0.15 + Math.random() * 0.25,
            });
        } else if (type === 'snow') {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 1.5 + Math.random() * 2,
                speed: 0.3 + Math.random() * 0.5,
                drift: (Math.random() - 0.5) * 0.4,
                opacity: 0.3 + Math.random() * 0.4,
            });
        } else if (type === 'sunny') {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 1 + Math.random() * 2,
                speed: 0.1 + Math.random() * 0.2,
                opacity: 0.06 + Math.random() * 0.1,
                phase: Math.random() * Math.PI * 2,
            });
        } else if (type === 'night') {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * (H * 0.6),
                r: 0.8 + Math.random() * 1.5,
                opacity: 0.2 + Math.random() * 0.5,
                twinkle: Math.random() * Math.PI * 2,
                speed: 0.02 + Math.random() * 0.04,
            });
        }
    }
}

let lastTime = 0;
const TARGET_FPS = 30;
const FRAME_MS   = 1000 / TARGET_FPS;

function animateCanvas(type) {
    // Pausa se fora da viewport
    if (document.hidden) {
        animFrame = requestAnimationFrame(() => animateCanvas(type));
        return;
    }

    const now = performance.now();
    if (now - lastTime < FRAME_MS) {
        animFrame = requestAnimationFrame(() => animateCanvas(type));
        return;
    }
    lastTime = now;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (type === 'rain') {
        for (const p of particles) {
            ctx.save();
            ctx.strokeStyle = `rgba(147, 210, 255, ${p.opacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 1, p.y + p.len);
            ctx.stroke();
            ctx.restore();
            p.y += p.speed;
            if (p.y > H) { p.y = -p.len; p.x = Math.random() * W; }
        }
    } else if (type === 'snow') {
        for (const p of particles) {
            ctx.save();
            ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            p.y += p.speed;
            p.x += p.drift;
            if (p.y > H) { p.y = -4; p.x = Math.random() * W; }
        }
    } else if (type === 'sunny') {
        for (const p of particles) {
            p.phase += p.speed;
            const op = p.opacity * (0.6 + 0.4 * Math.sin(p.phase));
            ctx.save();
            ctx.fillStyle = `rgba(255, 220, 80, ${op})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    } else if (type === 'night') {
        for (const p of particles) {
            p.twinkle += p.speed;
            const op = p.opacity * (0.5 + 0.5 * Math.sin(p.twinkle));
            ctx.save();
            ctx.fillStyle = `rgba(200, 220, 255, ${op})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    } else if (type === 'thunder') {
        // Flash aleatório muito raro
        if (Math.random() < 0.004) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 240, 100, 0.04)';
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
    }
    // fog: sem partículas, só o blur do glassmorphism já ajuda

    animFrame = requestAnimationFrame(() => animateCanvas(type));
}

// Pausa animação quando aba não está visível
document.addEventListener('visibilitychange', () => {
    if (document.hidden && animFrame) cancelAnimationFrame(animFrame);
    else if (!document.hidden && canvasConditionType)
        animateCanvas(canvasConditionType);
});

window.addEventListener('resize', () => {
    resizeCanvas();
    particles.length = 0;
    if (canvasConditionType) initParticles(canvasConditionType);
});

// ── Geolocation ───────────────────────────────────────────────────
function getGeolocation(onDone) {
    if (!navigator.geolocation) {
        locationEl.textContent = 'Busque uma cidade manualmente';
        onDone && onDone();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
            await fetchWeatherByCoords(coords.latitude, coords.longitude);
            onDone && onDone();
        },
        () => {
            locationEl.textContent = 'Permita localização ou busque manualmente';
            onDone && onDone();
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ── Init ──────────────────────────────────────────────────────────
showSkeleton(); // mostra skeleton desde o início (altura fixa do card)
getGeolocation();