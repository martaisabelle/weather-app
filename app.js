// app.js
// Busca de cidades: WeatherAPI /v1/search.json (mantida — Open-Meteo não tem busca por nome)
// Clima atual:      Open-Meteo /v1/forecast    (gratuito, sem API key, WMO weather codes)

'use strict';

// Busca de cidades (WeatherAPI — só para o autocomplete)
const SEARCH_KEY  = 'f2e7f458da914ce296831541262303';
const SEARCH_BASE = 'https://api.weatherapi.com/v1';

// Clima (Open-Meteo) — sem API key
const METEO_BASE = 'https://api.open-meteo.com/v1';

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

let autocompleteTimer  = null;
let activeIndex        = -1;
let lastSearchResults  = [];
let animFrame          = null;
let canvasConditionType = null;

// ── Encoding ─────────────────────────────────────────────────────
function removeAccents(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// A WeatherAPI não armazena acentos em muitos nomes brasileiros.
// Este mapa corrige o nome exibido: "Sao Paulo" → "São Paulo".
// Chave: nome sem acento em lowercase. Valor: nome correto com acento.
const brNameFix = {
    'mossoro': 'Mossoró',
    'sao paulo': 'São Paulo',
    'joao pessoa': 'João Pessoa',
    'maceio': 'Maceió',
    'goiania': 'Goiânia',
    'belem': 'Belém',
    'cuiaba': 'Cuiabá',
    'vitoria': 'Vitória',
    'florianopolis': 'Florianópolis',
    'sao luis': 'São Luís',
    'maringa': 'Maringá',
    'niteroi': 'Niterói',
    'nova iguacu': 'Nova Iguaçu',
    'ribeirao preto': 'Ribeirão Preto',
    'uberlandia': 'Uberlândia',
    'sao jose dos campos': 'São José dos Campos',
    'sao jose': 'São José',
    'sao bernardo do campo': 'São Bernardo do Campo',
    'sao goncalo': 'São Gonçalo',
    'sao caetano do sul': 'São Caetano do Sul',
    'sao jose do rio preto': 'São José do Rio Preto',
    'sao paulo do potengi': 'São Paulo do Potengi',
    'jundiai': 'Jundiaí',
    'marilia': 'Marília',
    'guaruja': 'Guarujá',
    'carapicuiba': 'Carapicuíba',
    'macapa': 'Macapá',
    'santarem': 'Santarém',
    'maraba': 'Marabá',
    'parnaiba': 'Parnaíba',
    'tiangua': 'Tianguá',
    'quixada': 'Quixadá',
    'caico': 'Caicó',
    'palmas': 'Palmas',
    'joao monlevade': 'João Monlevade',
    'petropolis': 'Petrópolis',
    'angra dos reis': 'Angra dos Reis',
    'arraial do cabo': 'Arraial do Cabo',
    'rio de janeiro': 'Rio de Janeiro',
    'brasilia': 'Brasília',
    'sao sebastiao': 'São Sebastião',
    'sao vicente': 'São Vicente',
    'mogi das cruzes': 'Mogi das Cruzes',
    'praia grande': 'Praia Grande',
    'itaquaquecetuba': 'Itaquaquecetuba',
    'piracicaba': 'Piracicaba',
    'tatui': 'Tatuí',
    'botucatu': 'Botucatu',
    'araraquara': 'Araraquara',
    'presidente prudente': 'Presidente Prudente',
    'sao carlos': 'São Carlos',
    'paraiba': 'Paraíba',
    'rio grande do norte': 'Rio Grande do Norte',
    'rio grande do sul': 'Rio Grande do Sul',
    'espirito santo': 'Espírito Santo',
    'maranhao': 'Maranhão',
    'piaui': 'Piauí',
    'ceara': 'Ceará',
    'pernambuco': 'Pernambuco',
    'alagoas': 'Alagoas',
    'sergipe': 'Sergipe',
    'bahia': 'Bahia',
    'minas gerais': 'Minas Gerais',
    'sao paulo': 'São Paulo',
    'parana': 'Paraná',
    'santa catarina': 'Santa Catarina',
    'mato grosso': 'Mato Grosso',
    'mato grosso do sul': 'Mato Grosso do Sul',
    'rondonia': 'Rondônia',
    'roraima': 'Roraima',
    'amapa': 'Amapá',
    'tocantins': 'Tocantins',
    'acre': 'Acre',
    'apodi': 'Apodi',
    'pau dos ferros': 'Pau dos Ferros',
    'acu': 'Açu',
    'currais novos': 'Currais Novos',
    'jardim do serido': 'Jardim do Seridó',
};

// Corrige o nome de uma cidade usando o mapa acima.
// Se não encontrar, devolve o original.
function fixCityName(name) {
    if (!name) return '';
    const key = removeAccents(name.toLowerCase().trim());
    return brNameFix[key] || name;
}

// ── Tradução PT→EN para cobertura global ─────────────────────────
const ptToEn = {
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
    // Remove acentos só para fazer lookup no dicionário ptToEn
    const noAccent = removeAccents(query.toLowerCase().trim());
    if (ptToEn[noAccent]) return ptToEn[noAccent];
    // Se não está no dicionário, devolve o original COM acento.
    return query;
}

// ── Search (WeatherAPI) ──────────────────────────────────────────
async function searchCities(query) {
    const translated = translateQuery(query);
    const noAccent   = removeAccents(query);

    // Sempre manda até 3 variantes em paralelo:
    // 1. Original (com acento, ex: "mossoró")
    // 2. Sem acento (ex: "mossoro") — WeatherAPI às vezes só acha assim
    // 3. Traduzida para inglês (ex: "Coreia do Norte" → "North Korea")
    const querySet = new Set([query, noAccent]);
    if (translated.toLowerCase() !== query.toLowerCase()) querySet.add(translated);

    const reqs = [...querySet].map(q =>
        fetch(`${SEARCH_BASE}/search.json?key=${SEARCH_KEY}&q=${encodeURIComponent(q)}`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
    );

    const arrays = await Promise.all(reqs);

    const seen   = new Set();
    const merged = [];
    for (const arr of arrays) {
        for (const item of arr) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                // Corrige o nome antes de armazenar no resultado
                item.name   = fixCityName(item.name);
                item.region = fixCityName(item.region);
                merged.push(item);
            }
        }
    }
    return merged;
}

// ── Autocomplete ─────────────────────────────────────────────────
function renderAutocomplete(results) {
    autocomplete.innerHTML = '';
    activeIndex = -1;
    lastSearchResults = results;
    if (!results.length) return;

    results.slice(0, 6).forEach((item, i) => {
        const city    = item.name   || '';
        const region  = item.region || '';
        const country = item.country || '';
        const flag    = countryFlag(item.country_code);

        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.setAttribute('role', 'option');
        div.dataset.index = i;

        const flagHtml = flag
            ? `<span class="ac-flag">${flag}</span>`
            : `<span class="ac-flag"></span>`;

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

function countryFlag(code) {
    if (!code || code.length !== 2) return '';
    try {
        return [...code.toUpperCase()].map(
            c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
        ).join('');
    } catch { return ''; }
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
    fetchWeatherByCoords(item.lat, item.lon, item.name, item.region, item.country);
}

// ── Keyboard nav ─────────────────────────────────────────────────
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

// ── Input / clear ────────────────────────────────────────────────
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

geoBtn.addEventListener('click', () => {
    geoBtn.style.opacity = '0.5';
    getGeolocation(() => { geoBtn.style.opacity = '1'; });
});

// ── UI States ────────────────────────────────────────────────────
function showSkeleton() {
    skeleton.style.display     = 'flex';
    realContent.style.display  = 'none';
    errorContent.style.display = 'none';
}

function showWeather() {
    skeleton.style.display     = 'none';
    errorContent.style.display = 'none';
    realContent.style.display  = 'flex';
    requestAnimationFrame(() => { realContent.style.opacity = '1'; });
}

function showError(msg) {
    skeleton.style.display     = 'none';
    realContent.style.display  = 'none';
    realContent.style.opacity  = '0';
    errorContent.style.display = 'flex';
    errorMsg.textContent = msg || 'Cidade não encontrada';
    locationEl.textContent = '';
}

// ── Fetch ────────────────────────────────────────────────────────
async function fetchWeather(query) {
    try {
        locationEl.textContent = 'Buscando...';
        showSkeleton();

        const results = await searchCities(query);
        if (!results.length) throw new Error('Cidade não encontrada');

        const best = results[0];
        await fetchWeatherByCoords(best.lat, best.lon, best.name, best.region, best.country);
    } catch (err) {
        showError(err.message);
    }
}

// Busca clima na Open-Meteo.
// name/region/country são opcionais — quando vêm da geolocalização,
// buscamos o nome reverso via WeatherAPI search com as coordenadas.
async function fetchWeatherByCoords(lat, lon, name, region, country) {
    try {
        locationEl.textContent = 'Carregando...';
        showSkeleton();
        realContent.style.opacity = '0';

        // Open-Meteo: clima atual + máx/mín do dia
        // WMO weather_code, is_day, temp, sensação, umidade, vento, UV
        const meteoUrl = `${METEO_BASE}/forecast`
            + `?latitude=${lat}&longitude=${lon}`
            + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,uv_index,weather_code,is_day`
            + `&daily=temperature_2m_max,temperature_2m_min`
            + `&timezone=auto`;

        // Se não temos o nome (geolocalização), buscamos via WeatherAPI reverse geocode
        let cityName    = name;
        let cityRegion  = region;
        let cityCountry = country;

        const [meteoRes, geoRes] = await Promise.all([
            fetch(meteoUrl),
            (!name)
                ? fetch(`${SEARCH_BASE}/search.json?key=${SEARCH_KEY}&q=${lat},${lon}`)
                    .then(r => r.ok ? r.json() : []).catch(() => [])
                : Promise.resolve(null),
        ]);

        if (!meteoRes.ok) throw new Error('Erro ao obter clima');
        const meteo = await meteoRes.json();

        // Resolve nome quando veio da geolocalização
        if (!name && Array.isArray(geoRes) && geoRes.length) {
            cityName    = fixCityName(geoRes[0].name);
            cityRegion  = fixCityName(geoRes[0].region);
            cityCountry = geoRes[0].country || '';
        } else if (!name) {
            cityName = `${parseFloat(lat).toFixed(2)}, ${parseFloat(lon).toFixed(2)}`;
            cityRegion  = '';
            cityCountry = '';
        }

        displayWeather(meteo, cityName, cityRegion, cityCountry);
    } catch (err) {
        showError(err.message);
    }
}

// ── Display ──────────────────────────────────────────────────────
function displayWeather(meteo, city, region, country) {
    const curr  = meteo.current;
    const daily = meteo.daily;

    // Header
    locationEl.textContent = city + (region ? `, ${region}` : '');
    cityEl.textContent   = city;
    regionEl.textContent = region || country || '';

    // Temperatura — Open-Meteo: temperature_2m, apparent_temperature
    tempEl.textContent      = Math.round(curr.temperature_2m);
    feelslikeEl.textContent = Math.round(curr.apparent_temperature) + '°';

    // Detalhes
    humidityEl.textContent = (curr.relative_humidity_2m ?? '--') + '%';
    windEl.textContent     = Math.round(curr.wind_speed_10m ?? 0);
    uvEl.textContent       = curr.uv_index != null ? Math.round(curr.uv_index) : '--';

    // Máx/Mín reais do dia (daily[0] = hoje)
    if (daily && daily.temperature_2m_max && daily.temperature_2m_min) {
        maxTempEl.textContent = Math.round(daily.temperature_2m_max[0]) + '°';
        minTempEl.textContent = Math.round(daily.temperature_2m_min[0]) + '°';
    }

    // WMO weather_code + is_day
    const code  = curr.weather_code ?? 0;
    const isDay = curr.is_day ?? 1;

    const { svg, label } = getWeatherIcon(code, isDay);
    svgIconEl.innerHTML = svg;
    conditionEl.textContent = label;

    startCanvasAnimation(code, isDay);
    showWeather();
}

// ── SVG Weather Icons (WMO codes) ────────────────────────────────
// Referência WMO: https://open-meteo.com/en/docs#weathervariables
// 0        = céu limpo
// 1,2,3    = principalmente limpo, parcialmente nublado, nublado
// 45,48    = neblina
// 51,53,55 = chuvisco leve/mod/denso
// 56,57    = chuvisco com gelo
// 61,63,65 = chuva leve/mod/forte
// 66,67    = chuva com gelo
// 71,73,75 = neve leve/mod/forte
// 77       = grãos de neve
// 80,81,82 = pancadas de chuva leve/mod/forte
// 85,86    = pancadas de neve
// 95       = trovoada
// 96,99    = trovoada com granizo

function getWeatherIcon(code, isDay) {
    // 0 — Céu limpo
    if (code === 0) {
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

    // 1,2 — Principalmente limpo / parcialmente nublado
    if (code === 1 || code === 2) {
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

    // 3 — Nublado / encoberto
    if (code === 3) return {
        label: 'nublado',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="28" width="44" height="22" rx="11" fill="white" opacity="0.6"/>
            <circle cx="22" cy="30" r="11" fill="white" opacity="0.6"/>
            <circle cx="38" cy="28" r="9" fill="white" opacity="0.6"/>
            <rect x="16" y="36" width="36" height="18" rx="9" fill="white" opacity="0.5"/>
        </svg>`
    };

    // 45, 48 — Neblina
    if (code === 45 || code === 48) return {
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

    // 51, 53, 55, 56, 57 — Chuvisco
    if (code >= 51 && code <= 57) return {
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

    // 61, 63, 80, 81 — Chuva leve / moderada
    if (code === 61 || code === 63 || code === 80 || code === 81) return {
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

    // 65, 82 — Chuva forte
    if (code === 65 || code === 82) return {
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

    // 66, 67 — Chuva com gelo
    if (code === 66 || code === 67) return {
        label: 'chuva com gelo',
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

    // 71, 73, 75, 77, 85, 86 — Neve
    if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return {
        label: 'neve',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="6" width="44" height="20" rx="10" fill="white" opacity="0.55"/>
            <circle cx="20" cy="11" r="9" fill="white" opacity="0.55"/>
            <circle cx="40" cy="10" r="7" fill="white" opacity="0.55"/>
            <g stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.85">
                <line x1="20" y1="36" x2="20" y2="50"/>
                <line x1="13" y1="39" x2="27" y2="47"/>
                <line x1="27" y1="39" x2="13" y2="47"/>
                <circle cx="20" cy="36" r="1.5" fill="white"/>
                <circle cx="20" cy="50" r="1.5" fill="white"/>
                <line x1="42" y1="38" x2="42" y2="50"/>
                <line x1="36" y1="41" x2="48" y2="47"/>
                <line x1="48" y1="41" x2="36" y2="47"/>
                <circle cx="42" cy="38" r="1.5" fill="white"/>
                <circle cx="42" cy="50" r="1.5" fill="white"/>
            </g>
        </svg>`
    };

    // 95 — Trovoada
    if (code === 95) return {
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

    // 96, 99 — Trovoada com granizo
    if (code === 96 || code === 99) return {
        label: 'tempestade c/ granizo',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="6" width="48" height="20" rx="10" fill="#334155" opacity="0.85"/>
            <circle cx="18" cy="11" r="10" fill="#334155" opacity="0.85"/>
            <circle cx="42" cy="10" r="9" fill="#334155" opacity="0.85"/>
            <path d="M36 28L28 40H34L26 56L44 38H36Z" fill="#FBBF24" opacity="0.9"/>
            <g fill="white" opacity="0.75">
                <circle cx="48" cy="40" r="2.5"/>
                <circle cx="52" cy="48" r="2.5"/>
            </g>
        </svg>`
    };

    // Fallback
    return {
        label: 'variável',
        svg: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="22" width="40" height="22" rx="11" fill="white" opacity="0.6"/>
            <circle cx="22" cy="25" r="10" fill="white" opacity="0.6"/>
            <circle cx="38" cy="23" r="8" fill="white" opacity="0.6"/>
        </svg>`
    };
}

// ── Canvas Animation ─────────────────────────────────────────────
// WMO code → tipo de animação
function classifyCondition(code, isDay) {
    if (code === 0 && isDay)  return 'sunny';
    if (code === 0 && !isDay) return 'night';
    if (code <= 3)            return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if (code === 95 || code === 96 || code === 99) return 'thunder';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 51) return 'rain'; // chuva, chuvisco, pancadas
    return 'clear';
}

const particles = [];

function startCanvasAnimation(code, isDay) {
    if (animFrame) cancelAnimationFrame(animFrame);
    particles.length = 0;

    const type = classifyCondition(code, isDay);
    canvasConditionType = type;

    resizeCanvas();
    initParticles(type);
    animateCanvas(type);
}

function resizeCanvas() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

function initParticles(type) {
    const W = canvas.width;
    const H = canvas.height;
    const count = type === 'rain'   ? 40
                : type === 'snow'   ? 24
                : type === 'sunny'  ? 12
                : type === 'night'  ? 20
                : 0;

    for (let i = 0; i < count; i++) {
        if (type === 'rain') {
            particles.push({
                x: Math.random() * W, y: Math.random() * H,
                len: 8 + Math.random() * 10,
                speed: 4 + Math.random() * 4,
                opacity: 0.15 + Math.random() * 0.25,
            });
        } else if (type === 'snow') {
            particles.push({
                x: Math.random() * W, y: Math.random() * H,
                r: 1.5 + Math.random() * 2,
                speed: 0.3 + Math.random() * 0.5,
                drift: (Math.random() - 0.5) * 0.4,
                opacity: 0.3 + Math.random() * 0.4,
            });
        } else if (type === 'sunny') {
            particles.push({
                x: Math.random() * W, y: Math.random() * H,
                r: 1 + Math.random() * 2,
                speed: 0.1 + Math.random() * 0.2,
                opacity: 0.06 + Math.random() * 0.1,
                phase: Math.random() * Math.PI * 2,
            });
        } else if (type === 'night') {
            particles.push({
                x: Math.random() * W, y: Math.random() * (H * 0.6),
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
        if (Math.random() < 0.004) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 240, 100, 0.04)';
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
    }

    animFrame = requestAnimationFrame(() => animateCanvas(type));
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && animFrame) cancelAnimationFrame(animFrame);
    else if (!document.hidden && canvasConditionType) animateCanvas(canvasConditionType);
});

window.addEventListener('resize', () => {
    resizeCanvas();
    particles.length = 0;
    if (canvasConditionType) initParticles(canvasConditionType);
});

// ── Geolocation ──────────────────────────────────────────────────
function getGeolocation(onDone) {
    if (!navigator.geolocation) {
        locationEl.textContent = 'Busque uma cidade manualmente';
        onDone && onDone();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
            // Sem nome pré-definido — fetchWeatherByCoords vai buscar via reverse geocode
            await fetchWeatherByCoords(coords.latitude, coords.longitude, null, null, null);
            onDone && onDone();
        },
        () => {
            showError('Busque uma cidade manualmente');
            locationEl.textContent = 'Localização não permitida';
            onDone && onDone();
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ── Init ─────────────────────────────────────────────────────────
showSkeleton();
getGeolocation();