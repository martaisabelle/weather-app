// WeatherAPI.com — app.js
// Endpoints:
//   Search:  /v1/search.json?key=KEY&q=QUERY  → array de cidades
//   Current: /v1/current.json?key=KEY&q=lat,lon&aqi=no → clima

const API_KEY  = 'f2e7f458da914ce296831541262303';
const API_BASE = 'https://api.weatherapi.com/v1';

// ── DOM ──────────────────────────────────────────────────────────
const cityInput      = document.getElementById('cityInput');
const clearBtn       = document.getElementById('clearBtn');
const weatherInfo    = document.getElementById('weatherInfo');
const locationEl     = document.getElementById('location');
const cityEl         = document.getElementById('city');
const regionEl       = document.getElementById('region');
const tempEl         = document.getElementById('temp');
const feelslikeEl    = document.getElementById('feelslike');
const humidityEl     = document.getElementById('humidity');
const windEl         = document.getElementById('wind');
const uvEl           = document.getElementById('uv');
const weatherIconEl  = document.getElementById('weatherIcon');
const conditionEl    = document.getElementById('weatherCondition');
const skeleton       = document.getElementById('skeleton');
const realContent    = document.getElementById('realContent');
const errorContent   = document.getElementById('errorContent');
const errorMsg       = document.getElementById('errorMsg');
const autocomplete   = document.getElementById('autocompleteList');

let currentLocation    = '';
let autocompleteTimer  = null;
let activeIndex        = -1;
let lastSearchResults  = [];

// ── Encoding fix ─────────────────────────────────────────────────
// escape() está deprecated. Usa TextDecoder para corrigir UTF-8 mal-interpretado.
function fixEncoding(text) {
    if (!text) return '';
    // Tenta corrigir sequências Latin-1 interpretadas como UTF-8 (ex: "LeÃ³n" → "León")
    try {
        const bytes = new Uint8Array([...text].map(c => c.charCodeAt(0)));
        const decoded = new TextDecoder('utf-8').decode(bytes);
        // Só usa se o resultado for válido e mais curto (sem caracteres estranhos)
        if (!/[\uFFFD]/.test(decoded)) return decoded;
    } catch { /* ignora */ }
    return text;
}

function removeAccents(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Autocomplete ──────────────────────────────────────────────────
// Problema principal: a API WeatherAPI faz match por similaridade de string
// e devolve resultados por relevância interna (frequência, não distância).
// Para garantir pesquisa global ("Coreia do Norte" → North Korea),
// fazemos duas buscas em paralelo: uma com o texto original e uma traduzida
// para inglês (via mapeamento local + fallback sem acentos).

// Mapa de termos comuns PT → EN para melhorar cobertura da API
const ptToEn = {
    'coreia do norte': 'North Korea',
    'coreia do sul': 'South Korea',
    'estados unidos': 'United States',
    'reino unido': 'United Kingdom',
    'nova zelândia': 'New Zealand',
    'nova zelandia': 'New Zealand',
    'alemanha': 'Germany',
    'frança': 'France',
    'franca': 'France',
    'espanha': 'Spain',
    'itália': 'Italy',
    'italia': 'Italy',
    'japão': 'Japan',
    'japao': 'Japan',
    'china': 'China',
    'rússia': 'Russia',
    'russia': 'Russia',
    'índia': 'India',
    'india': 'India',
    'canadá': 'Canada',
    'canada': 'Canada',
    'méxico': 'Mexico',
    'mexico': 'Mexico',
    'áustria': 'Austria',
    'austria': 'Austria',
    'suíça': 'Switzerland',
    'suica': 'Switzerland',
    'grécia': 'Greece',
    'grecia': 'Greece',
    'turquia': 'Turkey',
    'egito': 'Egypt',
    'egípto': 'Egypt',
    'marrocos': 'Morocco',
    'áfrica do sul': 'South Africa',
    'africa do sul': 'South Africa',
    'argentina': 'Argentina',
    'colombia': 'Colombia',
    'colômbia': 'Colombia',
    'venezuela': 'Venezuela',
    'portugal': 'Portugal',
    'holanda': 'Netherlands',
    'países baixos': 'Netherlands',
    'paises baixos': 'Netherlands',
    'bélgica': 'Belgium',
    'belgica': 'Belgium',
    'polônia': 'Poland',
    'polonia': 'Poland',
    'ucrânia': 'Ukraine',
    'ucrania': 'Ukraine',
    'noruega': 'Norway',
    'suécia': 'Sweden',
    'suecia': 'Sweden',
    'finlândia': 'Finland',
    'finlandia': 'Finland',
    'dinamarca': 'Denmark',
    'irlanda': 'Ireland',
    'escócia': 'Scotland',
    'escocia': 'Scotland',
    'gales': 'Wales',
    'irã': 'Iran',
    'ira': 'Iran',
    'iraque': 'Iraq',
    'arábia saudita': 'Saudi Arabia',
    'arabia saudita': 'Saudi Arabia',
    'emirados árabes': 'UAE',
    'emirados arabes': 'UAE',
    'paquistão': 'Pakistan',
    'paquistao': 'Pakistan',
    'bangladesh': 'Bangladesh',
    'tailândia': 'Thailand',
    'tailandia': 'Thailand',
    'vietnã': 'Vietnam',
    'vietna': 'Vietnam',
    'filipinas': 'Philippines',
    'malásia': 'Malaysia',
    'malasia': 'Malaysia',
    'indonésia': 'Indonesia',
    'indonesia': 'Indonesia',
    'austrália': 'Australia',
    'australia': 'Australia',
};

function translateQuery(query) {
    const lower = query.toLowerCase().trim();
    // Busca no mapa (com e sem acento)
    if (ptToEn[lower]) return ptToEn[lower];
    const noAccent = removeAccents(lower);
    if (ptToEn[noAccent]) return ptToEn[noAccent];
    // Fallback: remove acentos e retorna
    return removeAccents(query);
}

async function searchCities(query) {
    const translated = translateQuery(query);
    const queries = [query];
    if (translated !== query) queries.push(translated);

    // Busca em paralelo (original + traduzido)
    const requests = queries.map(q =>
        fetch(`${API_BASE}/search.json?key=${API_KEY}&q=${encodeURIComponent(q)}`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
    );

    const results = await Promise.all(requests);

    // Mescla e deduplica por id
    const seen = new Set();
    const merged = [];
    for (const arr of results) {
        for (const item of arr) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                merged.push(item);
            }
        }
    }

    return merged;
}

function renderAutocomplete(results) {
    autocomplete.innerHTML = '';
    activeIndex = -1;
    lastSearchResults = results;

    if (!results.length) return;

    results.slice(0, 6).forEach((item, i) => {
        const city   = fixEncoding(item.name);
        const region = fixEncoding(item.region);
        const country= fixEncoding(item.country);

        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.setAttribute('role', 'option');
        div.setAttribute('tabindex', '-1');
        div.dataset.index = i;

        // Emoji de bandeira (country code → regional indicators)
        const flag = countryFlag(item.country_code);

        div.innerHTML = `
            <span class="ac-icon">${flag}</span>
            <span class="ac-name">${city}</span>
            <span class="ac-region">${region ? region + ', ' : ''}${country}</span>
        `;

        div.addEventListener('mousedown', (e) => {
            e.preventDefault(); // impede blur no input antes do clique
            selectCity(item);
        });

        autocomplete.appendChild(div);
    });
}

function countryFlag(code) {
    if (!code || code.length !== 2) return '📍';
    try {
        const chars = [...code.toUpperCase()].map(
            c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
        );
        return chars.join('');
    } catch {
        return '📍';
    }
}

function clearAutocomplete() {
    autocomplete.innerHTML = '';
    activeIndex = -1;
    lastSearchResults = [];
}

function selectCity(item) {
    cityInput.value = '';
    clearAutocomplete();
    showClearBtn(false);
    fetchWeatherByCoords(item.lat, item.lon);
}

// ── Keyboard navigation ───────────────────────────────────────────
cityInput.addEventListener('keydown', (e) => {
    const items = autocomplete.querySelectorAll('.autocomplete-item');
    if (!items.length) {
        if (e.key === 'Enter') {
            const query = cityInput.value.trim();
            if (query) fetchWeather(query);
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
            const query = cityInput.value.trim();
            if (query) {
                clearAutocomplete();
                fetchWeather(query);
            }
        }
    } else if (e.key === 'Escape') {
        clearAutocomplete();
    }
});

function updateActive(items) {
    items.forEach((el, i) => {
        el.classList.toggle('active', i === activeIndex);
    });
}

// ── Input debounce ────────────────────────────────────────────────
cityInput.addEventListener('input', () => {
    const query = cityInput.value.trim();
    showClearBtn(query.length > 0);
    clearAutocomplete();

    if (autocompleteTimer) clearTimeout(autocompleteTimer);
    if (query.length < 2) return;

    autocompleteTimer = setTimeout(async () => {
        const results = await searchCities(query);
        if (cityInput.value.trim() === query) {
            renderAutocomplete(results);
        }
    }, 280);
});

// Fecha autocomplete ao clicar fora
document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.search-box')) {
        clearAutocomplete();
    }
});

// Limpar input
clearBtn.addEventListener('click', () => {
    cityInput.value = '';
    clearAutocomplete();
    showClearBtn(false);
    cityInput.focus();
});

function showClearBtn(show) {
    clearBtn.style.display = show ? 'flex' : 'none';
}

// ── UI States ────────────────────────────────────────────────────
function showSkeleton() {
    weatherInfo.classList.remove('hidden');
    skeleton.style.display = 'flex';
    realContent.style.display = 'none';
    errorContent.style.display = 'none';
}

function showWeather() {
    skeleton.style.display = 'none';
    realContent.style.display = 'block';
    errorContent.style.display = 'none';
}

function showError(msg) {
    skeleton.style.display = 'none';
    realContent.style.display = 'none';
    errorContent.style.display = 'flex';
    errorMsg.textContent = msg || 'Cidade não encontrada';
    weatherInfo.classList.remove('hidden');
    locationEl.textContent = 'Nenhum resultado';
}

// ── Fetch Weather ────────────────────────────────────────────────
async function fetchWeather(query) {
    try {
        locationEl.textContent = 'Buscando...';
        showSkeleton();

        const results = await searchCities(query);
        if (!results.length) throw new Error('Cidade não encontrada');

        const best = results[0];
        await fetchWeatherByCoords(best.lat, best.lon);
    } catch (err) {
        showError(err.message);
        console.error('fetchWeather error:', err);
    }
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        locationEl.textContent = 'Carregando...';
        showSkeleton();

        const url = `${API_BASE}/current.json?key=${API_KEY}&q=${lat},${lon}&aqi=no`;
        const response = await fetch(url);

        if (!response.ok) throw new Error('Erro ao obter clima');

        const data = await response.json();
        displayWeather(data);
    } catch (err) {
        showError(err.message);
        console.error('fetchWeatherByCoords error:', err);
    }
}

// ── Display ──────────────────────────────────────────────────────
function displayWeather(data) {
    const loc  = data.location;
    const curr = data.current;

    const city   = fixEncoding(loc.name);
    const region = fixEncoding(loc.region);
    const country= fixEncoding(loc.country);

    // Header
    currentLocation = city + (region ? `, ${region}` : '');
    locationEl.textContent = currentLocation;

    // City / Region
    cityEl.textContent   = city;
    regionEl.textContent = region || country;

    // Temperature — sem ° no span pois já está no .degree-unit
    tempEl.textContent      = Math.round(curr.temp_c);
    feelslikeEl.textContent = Math.round(curr.feelslike_c) + '°';

    // Extra
    humidityEl.textContent = (curr.humidity ?? '--') + '%';
    windEl.textContent     = Math.round(curr.wind_kph ?? 0) + ' km/h';
    uvEl.textContent       = curr.uv ?? '--';

    // Ícone de condição
    if (curr.condition) {
        weatherIconEl.src = 'https:' + curr.condition.icon;
        weatherIconEl.alt = curr.condition.text;
        conditionEl.textContent = curr.condition.text;
    }

    showWeather();
}

// ── Geolocation ──────────────────────────────────────────────────
function getGeolocation() {
    if (!navigator.geolocation) {
        locationEl.textContent = 'Busque uma cidade manualmente';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
            await fetchWeatherByCoords(coords.latitude, coords.longitude);
        },
        () => {
            locationEl.textContent = 'Permita localização ou busque manualmente';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ── Init ─────────────────────────────────────────────────────────
getGeolocation();