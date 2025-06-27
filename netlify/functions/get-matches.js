// netlify/functions/get-matches.js
const { Pool } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        return { statusCode: 500, body: JSON.stringify({ error: "DATABASE_URL is not set." }) };
    }

    try {
        const pool = new Pool({ connectionString });
        const { rows } = await pool.query('SELECT * FROM matches ORDER BY datetime ASC');
        await pool.end();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rows),
        };
    } catch (error) {
        console.error('Error fetching matches:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data' }),
        };
    }
};
