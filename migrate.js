const { Pool } = require('pg');
const fs = require('fs');

const configPath = '/etc/mywebapp/config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const pool = new Pool(config.db);

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS items (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
};

initDB();