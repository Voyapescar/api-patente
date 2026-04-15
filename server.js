const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();

// Middleware de seguridad para validar API Key
const authMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.APP_SERVICE_KEY;
    
    if (!validKey) {
        console.error('ERROR: APP_SERVICE_KEY no está configurada en las variables de entorno');
        return res.status(500).json({ error: 'Error de configuración del servidor' });
    }
    
    if (!apiKey || apiKey !== validKey) {
        return res.status(401).json({ error: 'Unauthorized: API Key inválida o faltante' });
    }
    
    next();
};

// Función para delay humano
const humanDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Endpoint principal para consulta de vehículos
app.get('/api/vehiculo/:patente', authMiddleware, async (req, res) => {
    const { patente } = req.params;
    let browser = null;
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        const page = await browser.newPage();
        
        const patenteLimpia = patente.toUpperCase().trim();
        
        // Navegar directamente a PatenteChile con la patente en la URL
        await page.goto(`https://www.patentechile.com/resultados.php?patente=${patenteLimpia}`, {
            waitUntil: 'networkidle2',
            timeout: 20000
        });
        
        // Verificar si la patente existe buscando texto clave
        const noExiste = await page.evaluate(() => {
            return document.body.innerText.includes('No se encontraron resultados');
        });
        
        if (noExiste) {
            return res.status(404).json({ 
                error: 'Patente no encontrada en PatenteChile',
                patente: patenteLimpia
            });
        }
        
        // Extraer datos de la tabla
        const datos = await page.evaluate(() => {
            const filas = Array.from(document.querySelectorAll('table tr'));
            const info = {};
            
            filas.forEach(fila => {
                const celdas = fila.querySelectorAll('td');
                if (celdas.length === 2) {
                    const clave = celdas[0].innerText.toLowerCase();
                    const valor = celdas[1].innerText.trim();
                    
                    if (clave.includes('marca')) info.marca = valor;
                    if (clave.includes('modelo')) info.modelo = valor;
                    if (clave.includes('año')) info.anio = valor;
                    if (clave.includes('chasis')) info.vin = valor;
                    if (clave.includes('motor')) info.numeroMotor = valor;
                    if (clave.includes('tipo')) info.tipoVehiculo = valor;
                }
            });
            
            return info;
        });
        
        // Verificar si se extrajeron datos
        const tieneDatos = Object.keys(datos).length > 0;
        
        if (!tieneDatos) {
            return res.status(404).json({ 
                error: 'No se pudieron extraer datos de la patente',
                patente: patenteLimpia
            });
        }
        
        res.json({
            patente: patenteLimpia,
            ...datos,
            fuente: 'PatenteChile'
        });
        
    } catch (error) {
        console.error('Error en el scraping:', error.message);
        res.status(500).json({ 
            error: 'Error al consultar los datos del vehículo',
            details: error.message 
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
