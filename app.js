const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');

const configPath = '/etc/mywebapp/config.json';
let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    console.error('Failed to read config file. Exiting.');
    process.exit(1);
}

const app = express();
const pool = new Pool(config.db);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sendResponse = (req, res, data, htmlBuilder) => {
    const accept = req.get('Accept') || '';
    if (accept.includes('text/html')) {
        res.send(htmlBuilder(data));
    } else {
        res.json(data);
    }
};

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html><body>
        <h1>Simple Inventory API</h1>
        <ul>
            <li>GET /items</li>
            <li>POST /items</li>
            <li>GET /items/:id</li>
        </ul>
        </body></html>
    `);
});

app.get('/health/alive', (req, res) => res.status(200).send('OK'));

app.get('/health/ready', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).send('OK');
    } catch (err) {
        res.status(500).send('Database connection failed');
    }
});

app.get('/items', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, name FROM items');
        sendResponse(req, res, rows, (data) => {
            const trs = data.map(i => `<tr><td>${i.id}</td><td>${i.name}</td></tr>`).join('');
            return `<table border="1"><tr><th>ID</th><th>Name</th></tr>${trs}</table>`;
        });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

app.get('/items/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, name, quantity, created_at FROM items WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).send('Item not found');
        
        sendResponse(req, res, rows[0], (data) => {
            return `<table border="1">
                <tr><th>ID</th><td>${data.id}</td></tr>
                <tr><th>Name</th><td>${data.name}</td></tr>
                <tr><th>Quantity</th><td>${data.quantity}</td></tr>
                <tr><th>Created At</th><td>${data.created_at}</td></tr>
            </table>`;
        });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

app.post('/items', async (req, res) => {
    const { name, quantity } = req.body;
    if (!name || quantity === undefined) {
        return res.status(400).send('Name and quantity are required');
    }
    try {
        await pool.query('INSERT INTO items (name, quantity) VALUES ($1, $2)', [name, quantity]);
        res.status(201).send('Created');
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

app.listen(config.port, '127.0.0.1', () => {
    console.log(`Web app listening on 127.0.0.1:${config.port}`);
});