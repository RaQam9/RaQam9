// netlify/functions/get-matches.js

import { neon } from '@netlify/neon';

export default async (req, context) => {
    try {
        // الاتصال بقاعدة البيانات باستخدام متغير البيئة تلقائياً
        const sql = neon();

        // الاستعلام عن كل المباريات وترتيبها حسب التاريخ
        const matches = await sql`
            SELECT * FROM matches ORDER BY datetime ASC
        `;

        // إرجاع البيانات بصيغة JSON
        return new Response(
            JSON.stringify(matches),
            {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' // للسماح بالوصول من أي مكان
                }
            }
        );
    } catch (error) {
        // في حالة حدوث خطأ، يتم تسجيله وإرجاع رسالة خطأ واضحة
        console.error("Database query failed:", error);
        return new Response(
            JSON.stringify({ message: "Failed to fetch matches from the database." }),
            {
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    }
};

// إعدادات إضافية للـ function (اختياري ولكنه جيد)
export const config = {
  path: "/.netlify/functions/get-matches"
};
