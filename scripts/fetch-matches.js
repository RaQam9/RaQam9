const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // سنحتاج لتثبيت هذه المكتبة أيضاً

// ------------------- الإعدادات والمتغيرات -------------------

// قراءة المتغيرات من بيئة التشغيل (GitHub Actions Secrets)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const footballDataApiKey = process.env.FOOTBALL_DATA_API_KEY;

// التحقق من وجود كل المتغيرات المطلوبة
if (!supabaseUrl || !supabaseKey || !footballDataApiKey) {
  console.error("Error: Missing required environment variables (Supabase URL/Key or Football Data API Key).");
  process.exit(1); // إنهاء السكربت مع رمز خطأ
}

// إنشاء اتصال مع Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// تحديد الدوريات المهمة التي نريد جلب مبارياتها
// يمكنك إضافة أو حذف الدوريات حسب حاجتك
const LEAGUES = [
  // --- بطولات المنتخبات الدولية ---
  'WC',      // FIFA World Cup
  'AFCON',   // Africa Cup of Nations
  'ASLC',    // AFC Asian Cup
  'EC',      // UEFA European Championship (Euro)

  // --- بطولات الأندية القارية ---
  'CWC',     // FIFA Club World Cup
  'CL',      // UEFA Champions League
  'CCL',     // CAF Champions League
  'ACL',     // AFC Champions League
  'CLI',     // Copa Libertadores
  
  // --- الدوريات الأوروبية الخمس الكبرى ---
  'PL',      // Premier League (England)
  'PD',      // La Liga (Spain)
  'SA',      // Serie A (Italy)
  'BL1',     // Bundesliga (Germany)
  'FL1',     // Ligue 1 (France)

  // --- الكؤوس المحلية الهامة ---
  'FAC',     // FA Cup (England)
  
  // --- دوريات أخرى ---
  'PPL',     // Egyptian Premier League
  'SPL',     // Saudi Pro League
  'DED',     // Eredivisie (Netherlands)
  'BSA',     // Brasileiro Série A (Brazil)
];

// ------------------- الدوال المساعدة -------------------

/**
 * دالة لجلب المباريات من API
 * @param {string} leagueCode - رمز الدوري
 * @returns {Promise<Array>} - قائمة بالمباريات
 */
async function fetchMatchesFromApi(leagueCode) {
  const url = `https://api.football-data.org/v4/competitions/${leagueCode}/matches`;
  try {
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': footballDataApiKey },
    });
    if (!response.ok) {
      throw new Error(`API call failed for ${leagueCode} with status: ${response.status}`);
    }
    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error(`Failed to fetch matches for league ${leagueCode}:`, error.message);
    return []; // إرجاع مصفوفة فارغة في حالة الفشل لتجنب إيقاف العملية كلها
  }
}

/**
 * دالة لتحويل بيانات المباراة من API إلى تنسيق قاعدة البيانات
 * @param {object} matchData - بيانات المباراة من API
 * @returns {object} - بيانات المباراة بالتنسيق المطلوب
 */
function transformMatchData(matchData) {
  return {
    api_id: matchData.id, // مهم جداً لعملية الـ upsert
    team1_name: matchData.homeTeam.name,
    team1_logo: matchData.homeTeam.crest,
    team2_name: matchData.awayTeam.name,
    team2_logo: matchData.awayTeam.crest,
    datetime: matchData.utcDate,
    league: matchData.competition.name,
    is_active: true, // تفعيل المباراة افتراضياً
    // يمكنك إضافة القنوات هنا إذا كانت متوفرة في API آخر أو تركها فارغة
    channels: [],
    // سيتم تحديث هذه الحقول لاحقاً
    actual_winner: null,
    actual_scorer: null,

  };
}

// ------------------- الدالة الرئيسية -------------------

async function run() {
  console.log("🚀 Starting the fetch-and-update process...");

  let allMatchesToUpsert = [];

  // جلب المباريات لكل دوري على حدة
  for (const league of LEAGUES) {
    console.log(`- Fetching matches for ${league}...`);
    const matchesFromApi = await fetchMatchesFromApi(league);
    const transformedMatches = matchesFromApi
      .filter(match => match.status === 'SCHEDULED' || match.status === 'TIMED') // جلب المباريات المجدولة فقط
      .map(transformMatchData); // تحويل تنسيقها
    
    allMatchesToUpsert.push(...transformedMatches);
    console.log(`  Found ${transformedMatches.length} scheduled matches for ${league}.`);
  }

  if (allMatchesToUpsert.length === 0) {
    console.log("✅ No new scheduled matches to update. Process finished.");
    return;
  }

  console.log(`\n🔄 Attempting to upsert a total of ${allMatchesToUpsert.length} matches to Supabase...`);

  // استخدام `upsert` لإضافة أو تحديث المباريات في قاعدة البيانات
  // `onConflict: 'api_id'` يخبر Supabase أنه إذا وجد مباراة بنفس `api_id`،
  // يجب أن يقوم بتحديثها بدلاً من إضافة صف جديد.
  // تأكد من أن عمود `api_id` في جدول Supabase هو `UNIQUE`.
  const { data, error } = await supabase
    .from('matches')
    .upsert(allMatchesToUpsert, {
      onConflict: 'api_id',
      ignoreDuplicates: true,
    })
    .select('id, team1_name, team2_name'); // select a few fields for logging

  if (error) {
    console.error("❌ Supabase upsert error:", error.message);
    process.exit(1);
  }

  console.log(`✅ Successfully upserted ${data.length} matches.`);
  console.log("Process completed successfully!");
}

// تشغيل السكربت
run();
