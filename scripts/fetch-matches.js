const { createClient } = require('@supabase/supabase-js');
const axios = require('axios'); // استخدام axios لجلب البيانات

// ------------------- الإعدادات والمتغيرات -------------------

// قراءة المتغيرات من بيئة التشغيل (GitHub Actions Secrets)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const apiFootballKey = process.env.API_FOOTBALL_KEY; // تم تغيير اسم المتغير

// التحقق من وجود كل المتغيرات المطلوبة
if (!supabaseUrl || !supabaseKey || !apiFootballKey) {
  console.error("Error: Missing required environment variables (Supabase URL/Key or API_FOOTBALL_KEY).");
  process.exit(1);
}

// إنشاء اتصال مع Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// ------------------- إدارة الدوريات (الطريقة الاحترافية) -------------------

// الخطوة 1: "الخريطة" التي تربط بين الكود النصي السهل والمعرف الرقمي المطلوب
const leagueMap = {
  // --- بطولات المنتخبات الدولية ---
  'WC': 1,      // FIFA World Cup
  'AFCON': 21,  // Africa Cup of Nations
  'ASLC': 6,    // AFC Asian Cup
  'EC': 4,      // UEFA European Championship (Euro)

  // --- بطولات الأندية القارية ---
  'CWC': 15,    // FIFA Club World Cup
  'CL': 2,      // UEFA Champions League
  'CCL': 7,     // CAF Champions League
  'ACL': 8,     // AFC Champions League
  'CLI': 13,    // Copa Libertadores

  // --- الدوريات الأوروبية الخمس الكبرى ---
  'PL': 39,     // Premier League (England)
  'PD': 140,    // La Liga (Spain)
  'SA': 135,    // Serie A (Italy)
  'BL1': 78,    // Bundesliga (Germany)
  'FL1': 61,    // Ligue 1 (France)

  // --- الكؤوس المحلية الهامة ---
  'FAC': 45,    // FA Cup (England)

  // --- دوريات أخرى ---
  'EPL': 233,   // Egyptian Premier League
  'SPL': 307,   // Saudi Pro League
  'DED': 88,    // Eredivisie (Netherlands)
  'BSA': 71     // Brasileiro Série A (Brazil)
};

// الخطوة 2: القائمة "النشطة" التي تريد جلبها. قم بالتعديل هنا فقط.
const activeLeagueCodes = [
  'PL',
  'PD',
  'SA',
  'CL',
  'SPL',
  'EPL',
  'WC'
  // أضف أو احذف الأكواد حسب حاجتك
];


// ------------------- الدوال المساعدة -------------------

/**
 * دالة لجلب المباريات من API-Football
 * @param {number} leagueId - المعرف الرقمي للدوري
 * @returns {Promise<Array>} - قائمة بالمباريات
 */
async function fetchMatchesFromApi(leagueId) {
  const season = new Date().getFullYear(); // استخدام السنة الحالية للموسم
  const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&status=NS`;
  
  console.log(`  Fetching from: ${url.replace(season, `${season}`)}...`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-rapidapi-key': apiFootballKey,
      },
    });
    
    // API-Football يضع البيانات داخل data.response
    return response.data.response || [];
  } catch (error) {
    console.error(`  Failed to fetch matches for league ID ${leagueId}:`, error.response ? error.response.data : error.message);
    return []; // إرجاع مصفوفة فارغة في حالة الفشل
  }
}

/**
 * دالة لتحويل بيانات المباراة من API-Football إلى تنسيق قاعدة البيانات
 * @param {object} fixtureData - بيانات المباراة من API
 * @returns {object} - بيانات المباراة بالتنسيق المطلوب
 */
function transformMatchData(fixtureData) {
  return {
    api_id: fixtureData.fixture.id, // مهم جداً لعملية الـ upsert
    team1_name: fixtureData.teams.home.name,
    team1_logo: fixtureData.teams.home.logo,
    team2_name: fixtureData.teams.away.name,
    team2_logo: fixtureData.teams.away.logo,
    datetime: fixtureData.fixture.date,
    league: fixtureData.league.name,
    is_active: true,
    channels: [],
    actual_winner: null,
    actual_scorer: null,
  };
}

// ------------------- الدالة الرئيسية -------------------

async function run() {
  console.log("🚀 Starting the fetch-and-update process...");

  let allMatchesToUpsert = [];

  // جلب المباريات لكل دوري في القائمة النشطة
  for (const code of activeLeagueCodes) {
    const leagueId = leagueMap[code]; // ترجمة الكود إلى رقم
    
    if (!leagueId) {
      console.warn(`- Warning: League code '${code}' not found in map. Skipping.`);
      continue;
    }

    console.log(`- Fetching matches for ${code} (ID: ${leagueId})...`);
    const matchesFromApi = await fetchMatchesFromApi(leagueId);
    
    // لا حاجة للفلترة حسب الحالة لأننا طلبناها (NS = Not Started) في رابط الـ API
    const transformedMatches = matchesFromApi.map(transformMatchData);
    
    allMatchesToUpsert.push(...transformedMatches);
    console.log(`  Found ${transformedMatches.length} scheduled matches for ${code}.`);
  }

  if (allMatchesToUpsert.length === 0) {
    console.log("\n✅ No new scheduled matches to update. Process finished.");
    return;
  }

  console.log(`\n🔄 Attempting to upsert a total of ${allMatchesToUpsert.length} matches to Supabase...`);
  
  // تأكد من أن عمود `api_id` في جدول Supabase هو من نوع `integer` أو `bigint` وعليه قيد `UNIQUE`.
  const { data, error } = await supabase
    .from('matches')
    .upsert(allMatchesToUpsert, {
      onConflict: 'api_id',
      ignoreDuplicates: false, // false is the default and correct setting for upsert
    })
    .select('id');

  if (error) {
    console.error("❌ Supabase upsert error:", error.message);
    process.exit(1);
  }

  console.log(`✅ Successfully upserted/updated ${data.length} matches.`);
  console.log("Process completed successfully!");
}

// تشغيل السكربت
run();