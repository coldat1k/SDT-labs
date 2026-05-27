const { Pool } = require('pg');
const fs = require('fs');

let config = { db: {} };
try {
    const configPath = fs.existsSync('/etc/mywebapp/config.json') ? '/etc/mywebapp/config.json' : './config.json';
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    console.warn('Config file not found. Falling back to environment variables.');
}

const pool = new Pool({
    user: process.env.DB_USER || config.db.user,
    host: process.env.DB_HOST || config.db.host,
    database: process.env.DB_NAME || config.db.database,
    password: process.env.DB_PASSWORD || config.db.password,
    port: process.env.DB_PORT || config.db.port
});

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