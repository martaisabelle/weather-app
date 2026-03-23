const express = require('express');
const fetch = require('node-fetch'); 
require('dotenv').config();

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

const API_KEY = process.env.WEATHER_API_KEY;
console.log('API_KEY OK');

app.get('/weather/:query', async (req, res) => {
    try {
        console.log('Busca:', req.params.query);
        const url = `http://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${req.params.query}&aqi=no`;
        
        const response = await fetch(url);
        console.log('Status:', response.status);
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('ERRO:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3001, () => console.log('Proxy em http://localhost:3001'));