// netlify/functions/get-matches.js

const { Pool } = require('@neondatabase/serverless');

exports.handler = async function(event) {
    // 1. التأكد من أن الطلب من نوع GET فقط
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed',
        };
    }

    // 2. الحصول على رابط الاتصال من متغيرات البيئة
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("Error: DATABASE_URL environment variable is not set.");
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Server configuration error." }),
        };
    }

    let pool;
    try {
        // 3. إنشاء اتصال جديد
        pool = new Pool({ connectionString });
        
        // 4. تنفيذ الاستعلام لجلب المباريات
        const sqlQuery = 'SELECT * FROM matches ORDER BY datetime ASC;';
        const { rows: matches } = await pool.query(sqlQuery);
        
        // 5. إنهاء الاتصال لتحرير الموارد
        await pool.end();

        // 6. إرجاع البيانات بنجاح
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // للسماح بالوصول من أي مكان
            },
            body: JSON.stringify(matches),
        };

    } catch (error) {
        // 7. التعامل مع أي خطأ يحدث
        console.error("Database query failed:", error);
        
        // تأكد من إنهاء الاتصال حتى في حالة الخطأ
        if (pool) {
            await pool.end();
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to fetch matches from the database." }),
        };
    }
};
