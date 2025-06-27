// netlify/functions/get-matches.js

// استيراد المكتبة الجديدة
import { neon } from '@netlify/neon';

// تعريف الـ handler. لاحظ استخدام export default
export default async (req) => {
    try {
        // هذه المكتبة تستخدم متغير البيئة تلقائياً، لا حاجة لكتابة أي شيء آخر
        const sql = neon();

        // كتابة الاستعلام بطريقة القوالب (Template Literals) الآمنة
        const matches = await sql`SELECT * FROM matches ORDER BY datetime ASC`;

        // إرجاع البيانات بنجاح باستخدام واجهة برمجة تطبيقات Netlify الأحدث
        return new Response(
            JSON.stringify(matches),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        // التعامل مع الأخطاء
        console.error("Database query failed:", error);
        return new Response(
            JSON.stringify({ message: "Failed to fetch matches." }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};

// يمكن إضافة هذا السطر لضمان أن الـ function تعمل فقط مع طلبات GET
export const config = {
  path: "/.netlify/functions/get-matches",
  method: "GET",
};
