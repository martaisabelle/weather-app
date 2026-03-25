// Endpoints usados:
// - Current: http://api.weatherapi.com/v1/current.json?key=KEY&q=LOCATION (localização, temp_c, feelslike_c, name, region) [web:14][web:17]
// - Search: http://api.weatherapi.com/v1/search.json?key=KEY&q=CITY (busca cidades)

// WeatherAPI.com (sem servidor)
const API_KEY = 'f2e7f458da914ce296831541262303';
const API_BASE = 'https://api.weatherapi.com/v1';

// DOM Elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const weatherInfo = document.getElementById('weatherInfo');
const locationEl = document.getElementById('location');
const cityEl = document.getElementById('city');
const regionEl = document.getElementById('region');
const tempEl = document.getElementById('temp');
const feelslikeEl = document.getElementById('feelslike');

// Skeleton
const skeleton = document.getElementById('skeleton');
const realContent = document.getElementById('realContent');

let currentLocation = '';

// corrige encoding bugado (LeÃ³n → León)
function fixEncoding(text) {
    try {
        return decodeURIComponent(escape(text));
    } catch {
        return text;
    }
}

// remove acento (fallback interno)
function removeAccents(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// API COMPLETA (busca inteligente + fallback)
async function fetchWeather(query) {
    try {
        locationEl.textContent = 'Carregando...';

        // mostrar skeleton
        weatherInfo.classList.remove('hidden');
        skeleton.style.display = 'block';
        realContent.style.display = 'none';

        let searchData = [];

        // tentativa 1 (com acento)
        let searchUrl = `${API_BASE}/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`;
        let searchResponse = await fetch(searchUrl);

        if (searchResponse.ok) {
            searchData = await searchResponse.json();
        }

        // tentativa 2 (sem acento)
        if (!searchData.length) {
            const normalized = removeAccents(query);

            searchUrl = `${API_BASE}/search.json?key=${API_KEY}&q=${encodeURIComponent(normalized)}`;
            searchResponse = await fetch(searchUrl);

            if (searchResponse.ok) {
                searchData = await searchResponse.json();
            }
        }

        if (!searchData.length) {
            throw new Error('Cidade não encontrada');
        }

        // melhor resultado
        const bestMatch = searchData[0];
        const { lat, lon } = bestMatch;

        // busca clima pela localização exata
        const weatherUrl = `${API_BASE}/current.json?key=${API_KEY}&q=${lat},${lon}&aqi=no`;
        const weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) {
            throw new Error('Erro ao obter clima');
        }

        const data = await weatherResponse.json();
        displayWeather(data);

    } catch (error) {
        locationEl.textContent = 'Erro: ' + error.message;

        skeleton.style.display = 'none';
        realContent.style.display = 'none';

        console.error('API Error:', error);
    }
}

// UI
function displayWeather(data) {
    const loc = data.location;
    const curr = data.current;

    const city = fixEncoding(loc.name);
    const region = fixEncoding(loc.region);

    currentLocation = `${city}, ${region}`;
    locationEl.textContent = currentLocation;

    cityEl.textContent = city;
    regionEl.textContent = region;

    tempEl.textContent = Math.round(curr.temp_c);
    feelslikeEl.textContent = Math.round(curr.feelslike_c) + '°';

    skeleton.style.display = 'none';
    realContent.style.display = 'block';

    weatherInfo.classList.remove('hidden');
}

// Geolocalização
function getGeolocation() {
    if (!navigator.geolocation) {
        locationEl.textContent = 'Geolocalização não suportada';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            await fetchWeather(`${latitude},${longitude}`);
        },
        () => {
            locationEl.textContent = 'Permita localização ou busque manualmente';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// busca (mantém acento)
searchBtn.addEventListener('click', () => {
    const rawQuery = cityInput.value.trim();

    if (rawQuery) {
        fetchWeather(rawQuery);
        cityInput.value = '';
    }
});

// Enter
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});

// Init
getGeolocation();