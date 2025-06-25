const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // هذا السطر مهم جدًا لنجاح الاتصال بين Netlify و Neon
    ssl: {
        rejectUnauthorized: false
    }
});

exports.handler = async function(event, context) {
    try {
        const client = await pool.connect();
        // هذا الاستعلام يقرأ من الجدول الذي يجب أن تنشئه في Neon
        const result = await client.query('SELECT * FROM matches ORDER BY datetime ASC');
        client.release();

        // تحويل البيانات لتناسب الشكل الذي يتوقعه الكود الأمامي
        // (team1.name بدلاً من team1_name)
        const formattedMatches = result.rows.map(match => ({
            id: match.id,
            team1: { name: match.team1_name, logo: match.team1_logo },
            team2: { name: match.team2_name, logo: match.team2_logo },
            league: match.league,
            datetime: match.datetime,
            channels: match.channels
        }));

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // للسماح بالوصول من أي مكان
            },
            body: JSON.stringify(formattedMatches),
        };
    } catch (error) {
        console.error("Database Error:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                error: 'Failed to fetch matches from database.',
                details: error.message 
            }) 
        };
    }
};
