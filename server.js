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
                '--disable-dev-shm-usage'
            ]
        });
        
        const page = await browser.newPage();
        
        // Navegar a la página de la PRT
        await page.goto('https://www.prt.cl/Paginas/ConsultaRevisionTecnica.aspx', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Esperar que el campo de patente esté disponible
        await page.waitForSelector('#txtPatente', { timeout: 10000 });
        
        // Ingresar la patente con delay humano entre teclas
        const patenteLimpia = patente.toUpperCase().trim();
        for (const char of patenteLimpia) {
            await page.type('#txtPatente', char);
            await humanDelay(Math.floor(Math.random() * 51) + 50); // 50-100ms
        }
        
        // Click en el botón consultar
        await page.click('#btnConsultar');
        
        // Esperar resultados
        await page.waitForSelector('#pnlResultado', { timeout: 15000 });
        
        // Extraer datos
        const datos = await page.evaluate(() => {
            const getText = (id) => {
                const el = document.querySelector(id);
                return el ? el.textContent.trim() : null;
            };
            
            return {
                marca: getText('#lblMarca'),
                modelo: getText('#lblModelo'),
                anio: getText('#lblAnio'),
                numeroMotor: getText('#lblNumeroMotor'),
                vin: getText('#lblVIN'),
                tipoVehiculo: getText('#lblTipoVehiculo'),
                fechaVencimiento: getText('#lblFechaVencimiento')
            };
        });
        
        // Verificar si se encontraron datos
        const tieneDatos = Object.values(datos).some(val => val !== null && val !== '');
        
        if (!tieneDatos) {
            return res.status(404).json({ 
                error: 'No se encontraron datos para la patente proporcionada',
                patente: patenteLimpia
            });
        }
        
        res.json({
            patente: patenteLimpia,
            ...datos
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
