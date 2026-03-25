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

// função para remover acentos
function normalizeText(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// API
async function fetchWeather(query) {
    try {
        locationEl.textContent = 'Carregando...';

        // mostrar card + skeleton
        weatherInfo.classList.remove('hidden');
        skeleton.style.display = 'block';
        realContent.style.display = 'none';

        const url = `${API_BASE}/current.json?key=${API_KEY}&q=${encodeURIComponent(query)}&aqi=no`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Cidade não encontrada');
        }

        const data = await response.json();
        displayWeather(data);

    } catch (error) {
        locationEl.textContent = 'Erro: ' + error.message;

        // esconder skeleton em caso de erro
        skeleton.style.display = 'none';
        realContent.style.display = 'none';

        console.error('API Error:', error);
    }
}

function displayWeather(data) {
    const loc = data.location;
    const curr = data.current;

    currentLocation = `${loc.name}, ${loc.region}`;
    locationEl.textContent = currentLocation;

    cityEl.textContent = loc.name;
    regionEl.textContent = loc.region;
    tempEl.textContent = Math.round(curr.temp_c);
    feelslikeEl.textContent = Math.round(curr.feelslike_c) + '°';

    // trocar skeleton pelo conteúdo real
    skeleton.style.display = 'none';
    realContent.style.display = 'block';

    weatherInfo.classList.remove('hidden');
}

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

// Busca com normalização
searchBtn.addEventListener('click', () => {
    const rawQuery = cityInput.value.trim();

    if (rawQuery) {
        const query = normalizeText(rawQuery.toLowerCase());
        fetchWeather(query);
        cityInput.value = '';
    }
});

// Enter para buscar
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});

// Inicializa com geolocalização
getGeolocation();