// ==========================================================
// SECTION 0: GLOBAL SETUP & CONSTANTS
// ==========================================================
const SUPABASE_URL = 'https://uxtxavurcgdeueeemmdi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dHhhdnVyY2dkZXVlZWVtbWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjQ4NzYsImV4cCI6MjA2NjYwMDg3Nn0.j7MrIoGzbzjurKyWGN0GgpMBIzl5exOsZrYlKCSmNbk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentNewsSubPage = 'home';
let articlesCache = [];

// ==========================================================
// SECTION 0.1: UTILITY & NATIVE HELPERS
// ==========================================================
function showNotification(message) { /* ... نفس الكود من قبل ... */ }
function triggerHapticFeedback(style = 'LIGHT') { /* ... نفس الكود من قبل ... */ }
async function shareContent(title, text, url) { /* ... نفس الكود من قبل ... */ }
function navigateToSubPage(pageName) { /* ... نفس الكود من قبل ... */ }

function getMatchStatus(datetime) {
    const matchDate = new Date(datetime);
    const now = new Date();
    const diffMinutes = (matchDate.getTime() - now.getTime()) / 60000;
    if (diffMinutes < -125) return { state: 'ended' };
    if (diffMinutes <= 0) return { state: 'live' };
    if (diffMinutes <= 5) return { state: 'soon' };
    return { state: 'scheduled' };
}

// ==========================================================
// SECTION 1: APP INITIALIZATION
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    // ... الكود هنا لم يتغير
    initializePageNavigation();
    initializeAuth();
    initializePredictionsPage(); // سنركز على هذه الدالة
    // ...
});

// ==========================================================
// SECTION 4: PREDICTIONS PAGE (مراجعة شاملة)
// ==========================================================

async function initializePredictionsPage() {
    const container = document.getElementById('matches-container');
    container.innerHTML = `<p class="text-center text-gray-400 mt-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i> جاري تحميل المباريات...</p>`;

    try {
        // الخطوة 1: جلب البيانات
        const { data, error } = await supabaseClient
            .from('matches')
            .select('*') // استخدام * مؤقتا للتأكد من جلب كل شيء
            .order('datetime', { ascending: true });

        // الخطوة 2: التعامل مع الأخطاء أولاً
        if (error) {
            // طباعة الخطأ في الكونسول للتشخيص لاحقًا
            console.error('Supabase Error [initializePredictionsPage]:', error);
            // إذا كان المستخدم متصلاً، فهذا خطأ حقيقي (مثل مشكلة في RLS أو اسم الجدول)
            if (navigator.onLine) {
                // عرض رسالة خطأ واضحة
                throw new Error(`فشل الاتصال بقاعدة البيانات: ${error.message}`);
            }
            // إذا كان المستخدم غير متصل، فالخطأ متوقع، وسيعمل الـ Service Worker
            // لا تفعل شيئًا هنا، فقط دع الكود يستمر
        }

        // الخطوة 3: التعامل مع البيانات
        // التحقق مما إذا كانت البيانات موجودة (من الشبكة أو من الكاش) وأنها ليست فارغة
        if (data && data.length > 0) {
            container.innerHTML = `<div class="date-tabs-container" id="date-tabs"></div><div id="days-content-container"></div>`;
            // نمرر البيانات إلى دالة العرض
            initializeAppWithData(data);
        } else {
            // إذا وصلنا إلى هنا، فهذا يعني أن `data` إما `null` أو `[]`
            // إذا كان المستخدم متصلاً، فهذا يعني أن الجدول فارغ
            if (navigator.onLine) {
                 container.innerHTML = '<p class="text-center text-gray-400 mt-8">لا توجد مباريات مجدولة حاليًا.</p>';
            } else {
                // إذا كان غير متصل، نعرض رسالة تفيد بأننا نعتمد على الكاش
                 container.innerHTML = '<p class="text-center text-gray-400 mt-8">أنت غير متصل. في انتظار عرض البيانات المحفوظة.</p>';
            }
        }

    } catch (e) {
        // هذا القسم يلتقط الأخطاء التي ألقيناها عمدًا (مثل خطأ RLS)
        // أو أي أخطاء أخرى غير متوقعة في الكود
        console.error('Caught Error [initializePredictionsPage]:', e);
        container.innerHTML = `<p class="text-center text-red-500 mt-8">فشل تحميل المباريات. اسحب للأسفل للتحديث. <br><small>(${e.message})</small></p>`;
    }
}

function initializeAppWithData(matchesData) {
    const dateTabsContainer = document.getElementById('date-tabs');
    const daysContentContainer = document.getElementById('days-content-container');
    
    // فحص إضافي للتأكد من أن العناصر موجودة قبل استخدامها
    if (!dateTabsContainer || !daysContentContainer) {
        console.error("Error: Date tabs or content container not found in the DOM.");
        return;
    }
    
    // مسح المحتوى القديم
    dateTabsContainer.innerHTML = '';
    daysContentContainer.innerHTML = '';

    try {
        // فلترة المباريات: عرض مباريات اليوم والمباريات المستقبلية فقط
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingMatches = matchesData.filter(match => {
            // التحقق من أن حقل التاريخ موجود وصحيح
            if (!match.datetime || isNaN(new Date(match.datetime))) {
                console.warn("Skipping match with invalid or missing datetime:", match);
                return false;
            }
            return new Date(new Date(match.datetime).toLocaleDateString('en-CA')) >= today;
        });

        if (upcomingMatches.length === 0) {
            daysContentContainer.innerHTML = `<p class="text-center text-gray-400 mt-8">لا توجد مباريات قادمة.</p>`;
            return;
        }

        const matchesByDay = upcomingMatches.reduce((acc, match) => {
            const day = new Date(match.datetime).toLocaleDateString('en-CA');
            if (!acc[day]) acc[day] = [];
            acc[day].push(match);
            return acc;
        }, {});

        const sortedDays = Object.keys(matchesByDay).sort();

        sortedDays.forEach((day, index) => {
            // بناء تبويبات الأيام
            const dateObj = new Date(day + 'T00:00:00Z');
            const tab = document.createElement('div');
            tab.className = `date-tab ${index === 0 ? 'active' : ''}`;
            tab.textContent = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
            tab.dataset.tabId = day;
            dateTabsContainer.appendChild(tab);

            // بناء حاويات المحتوى لكل يوم
            const content = document.createElement('div');
            content.className = `day-content ${index === 0 ? 'active' : ''}`;
            content.id = `day-${day}`;
            daysContentContainer.appendChild(content);

            // ترتيب المباريات داخل اليوم وعرضها
            const sortedMatches = matchesByDay[day].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
            renderMatchesForDay(content, sortedMatches);
        });

        // إضافة مستمعي الأحداث للتبويبات والمباريات
        dateTabsContainer.addEventListener('click', handleTabClick);
        daysContentContainer.addEventListener('submit', handleFormSubmit);
        daysContentContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-comments-btn')) handleToggleComments(e.target);
        });

        loadUserPredictions();

    } catch (e) {
        // إذا حدث خطأ أثناء عرض البيانات (مثلاً، أحد الحقول ناقص)
        console.error("Error rendering matches [initializeAppWithData]:", e);
        daysContentContainer.innerHTML = `<p class="text-center text-red-500 mt-8">حدث خطأ أثناء عرض بيانات المباريات. يرجى إبلاغ الدعم.</p>`;
    }
}

// دالة منفصلة للتعامل مع نقرات التبويبات
function handleTabClick(e) {
    if (!e.target.classList.contains('date-tab')) return;
    const tabId = e.target.dataset.tabId;
    // إزالة 'active' من كل التبويبات والحاويات
    document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.day-content').forEach(c => c.classList.remove('active'));
    // إضافة 'active' إلى العنصر المستهدف
    e.target.classList.add('active');
    document.getElementById(`day-${tabId}`).classList.add('active');
}


function renderMatchesForDay(dayContainer, matches) {
    // هذه الدالة مهمة جدًا ويجب التأكد من صحتها
    matches.forEach(match => {
        // التأكد من وجود البيانات الأساسية قبل محاولة عرضها
        if (!match.id || !match.team1_name || !match.team2_name) {
            console.warn("Skipping rendering a match due to missing data:", match);
            return; // تخطي هذه المباراة والانتقال للتالية
        }
        
        // ... بقية كود العرض من نسختك السابقة، فهو جيد
        const card = document.createElement('div');
        card.className = 'match-card';
        // ... (تكملة بناء HTML للبطاقة)
        dayContainer.appendChild(card);
    });
}


// ... بقية ملف app.js (Auth, News, Profile, etc.) يبقى كما هو
// ... انسخ بقية الدوال من الملف الكامل الذي قدمته في المرة السابقة
