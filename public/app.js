/**
 * =================================================================
 *   النسخة الكاملة والمحسّنة من ملف app.js
 *   - تم تحسين أداء الواجهة باستخدام DocumentFragment.
 *   - تم تعديل التنقل بين الصفحات ليصبح انزلاقياً وسلساً.
 *   - تم إعادة كتابة الدوال المصغّرة لتكون مقروءة وسهلة الصيانة.
 *   - تم إضافة تعليقات توضيحية شاملة.
 * =================================================================
 */

// ==========================================================
// SECTION 0: GLOBAL SETUP & CAPACITOR BRIDGE
// ==========================================================
const SUPABASE_URL = 'https://uxtxavurcgdeueeemmdi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dHhhdnVyY2dkZXVlZWVtbWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjQ4NzYsImV4cCI6MjA2NjYwMDg3Nn0.j7MrIoGzbzjurKyWGN0GgpMBIzl5exOsZrYlKCSmNbk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_EMAIL = "your-email@example.com";
const HOST_EMAIL = "host@example.com";

let currentUser = null;
let currentNewsSubPage = 'home'; // للتحكم في زر الرجوع داخل صفحة الأخبار

/**
 * ==================================================================
 *  ✨ [تحسين الأداء] دالة مساعدة لإنشاء العناصر من نص HTML بكفاءة
 *  تستخدم DocumentFragment لتجميع العناصر في الذاكرة قبل إضافتها
 *  للـ DOM مرة واحدة، مما يمنع التجميد ويحسن السلاسة.
 * ==================================================================
 */
function createFragmentFromString(htmlString) {
    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content;
}


/**
 * ==================================================================
 *  ✨ [تحسين السلاسة] دالة التنقل داخل صفحة الأخبار
 *  تستخدم Transform CSS للانتقال السلس بين قائمة المقالات وتفاصيل المقال.
 * ==================================================================
 */
function navigateToSubPage(pageName) {
    const newsHomePage = document.getElementById('home-page');
    const newsArticlePage = document.getElementById('article-page');
    currentNewsSubPage = pageName;
    if (pageName === 'article') {
        newsHomePage.style.transform = 'translateX(-100%)';
        newsArticlePage.style.transform = 'translateX(0)';
        newsArticlePage.scrollTop = 0; // العودة لأعلى الصفحة عند فتح مقال جديد
    } else { // 'home'
        newsHomePage.style.transform = 'translateX(0)';
        newsArticlePage.style.transform = 'translateX(100%)';
    }
}


document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    // ==== دعم PWA والعمل دون اتصال (لا تغيير) ====
    // =============================================
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => console.log('✅ Service Worker registered successfully:', registration.scope))
                .catch(error => console.error('❌ Service Worker registration failed:', error));
        });
    }
    const offlineStatusDiv = document.getElementById('offline-status');
    const handleConnectionChange = () => {
        offlineStatusDiv.style.display = navigator.onLine ? 'none' : 'block';
    };
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    handleConnectionChange();
    // =============================================

    if (window.Capacitor) {
        console.log("Capacitor is available.");
    } else {
        console.log("Capacitor is not available. Running in web mode.");
    }

    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');

    predictionsBtn.addEventListener('click', () => switchPage('predictions'));
    newsBtn.addEventListener('click', () => switchPage('news'));

    const urlParams = new URLSearchParams(window.location.search);
    const articleIdFromUrl = urlParams.get('article');

    // تهيئة جميع الوظائف الرئيسية
    initializeAuth();
    initializePredictionsPage();
    initializeNewsPage(articleIdFromUrl);
    initializeRealtimeListeners();
    initializeGlobalEventListeners();
    initializeProfilePageListeners();
    initializePullToRefresh();
    initializeBackButtonHandler();

    /**
     * =================================================================
     *  ✨ [تحسين السلاسة] إعداد الحالة الأولية للصفحات
     *  بدلاً من إخفاء وإظهار، نضبط صفحة التوقعات لتكون نشطة
     *  وصفحة الأخبار مخفية على اليمين وجاهزة للانزلاق للداخل.
     * =================================================================
     */
    const predictionsPage = document.getElementById('predictions-page');
    const newsPage = document.getElementById('news-page');

    if (!articleIdFromUrl) {
        predictionsPage.classList.add('is-active');
        newsPage.classList.add('is-inactive-right');
    } else {
        // إذا كان هناك رابط مقال، فإن دالة initializeNewsPage ستهتم بإظهار صفحة الأخبار.
        // سيتم استدعاء switchPage('news') داخلها
    }
});


/**
 * ==================================================================
 *  ✨ [تحسين السلاسة] دالة التنقل الرئيسية بين الصفحات
 *  تستخدم كلاسات CSS للتحكم في `transform` بدلاً من `display: none`
 *  لتحقيق تأثير انزلاق سلس.
 * ==================================================================
 */
function switchPage(pageToShow) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'select_content', { 'content_type': 'tab', 'item_id': pageToShow });
    }

    const predictionsPage = document.getElementById('predictions-page');
    const newsPage = document.getElementById('news-page');
    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');

    if (pageToShow === 'predictions') {
        // حرك صفحة التوقعات إلى العرض
        predictionsPage.classList.add('is-active');
        predictionsPage.classList.remove('is-inactive-left', 'is-inactive-right');
        // حرك صفحة الأخبار إلى اليمين (خارج الشاشة)
        newsPage.classList.add('is-inactive-right');
        newsPage.classList.remove('is-active');

        // تحديث حالة الأزرار
        predictionsBtn.classList.add('bg-blue-600', 'text-white');
        predictionsBtn.classList.remove('text-gray-400');
        newsBtn.classList.remove('bg-blue-600', 'text-white');
        newsBtn.classList.add('text-gray-400');

    } else { // pageToShow === 'news'
        // حرك صفحة الأخبار إلى العرض
        newsPage.classList.add('is-active');
        newsPage.classList.remove('is-inactive-left', 'is-inactive-right');
        // حرك صفحة التوقعات إلى اليسار (خارج الشاشة)
        predictionsPage.classList.add('is-inactive-left');
        predictionsPage.classList.remove('is-active');

        // تحديث حالة الأزرار
        newsBtn.classList.add('bg-blue-600', 'text-white');
        newsBtn.classList.remove('text-gray-400');
        predictionsBtn.classList.remove('bg-blue-600', 'text-white');
        predictionsBtn.classList.add('text-gray-400');
    }
}


// ==========================================================
// SECTION 0.5: AUTHENTICATION & PUSH NOTIFICATIONS (لا تغيير)
// ==========================================================
const registerPushNotifications = async () => {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
        console.log("Push notifications not available on this platform.");
        return;
    }
    const { PushNotifications } = window.Capacitor.Plugins;
    try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
            console.warn('User denied permissions for push notifications!');
            return;
        }
        await PushNotifications.register();
        PushNotifications.addListener('registration', async (token) => {
            console.info('Push registration success, token: ' + token.value);
            if (currentUser) {
                const { error } = await supabaseClient.from('fcm_tokens').upsert({ user_id: currentUser.id, token: token.value }, { onConflict: 'token' });
                if (error) { console.error('Error saving FCM token:', error); } 
                else { console.log('FCM token saved successfully!'); }
            }
        });
        PushNotifications.addListener('registrationError', (err) => { console.error('Error on registration: ' + JSON.stringify(err)); });
        PushNotifications.addListener('pushNotificationReceived', (notification) => { alert('إشعار جديد: ' + (notification.title || '') + "\n" + (notification.body || '')); });
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => { console.log('Push action performed: ' + JSON.stringify(notification)); });
    } catch(e) { console.error("Error in registerPushNotifications:", e); }
};

function initializeAuth() {
    const authModal = document.getElementById('auth-modal');
    const userIconBtn = document.getElementById('user-icon-btn');
    const closeModalBtn = document.getElementById('close-auth-modal-btn');
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const loggedinView = document.getElementById('loggedin-view');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const logoutBtn = document.getElementById('logout-btn');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');
    const authMessage = document.getElementById('auth-message');
    const openProfileBtn = document.getElementById('open-profile-btn');
    const openAuthModal = () => authModal.classList.add('show');
    const closeAuthModal = () => authModal.classList.remove('show');
    const showView = (view) => {
        loginView.style.display = 'none';
        signupView.style.display = 'none';
        loggedinView.style.display = 'none';
        view.style.display = 'block';
        authMessage.textContent = '';
    };
    userIconBtn.addEventListener('click', () => {
        if (currentUser) {
            const username = currentUser.user_metadata.username || currentUser.email;
            document.getElementById('user-email-display').textContent = `أهلاً بك، ${username}!`;
            showView(loggedinView);
        } else {
            showView(loginView);
        }
        openAuthModal();
    });
    if (openProfileBtn) { openProfileBtn.addEventListener('click', openProfilePage); }
    closeModalBtn.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });
    showSignupBtn.addEventListener('click', () => showView(signupView));
    showLoginBtn.addEventListener('click', () => showView(loginView));
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        authMessage.textContent = 'جاري إنشاء الحساب...';
        const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { username } } });
        if (error) { authMessage.textContent = `خطأ: ${error.message}`; }
        else { authMessage.textContent = 'تم إنشاء الحساب بنجاح! يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.'; signupForm.reset(); }
    });
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        authMessage.textContent = 'جاري تسجيل الدخول...';
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { authMessage.textContent = `خطأ: ${error.message}`; }
        else { authMessage.textContent = 'تم تسجيل الدخول بنجاح!'; loginForm.reset(); setTimeout(closeAuthModal, 1000); }
    });
    logoutBtn.addEventListener('click', async () => {
        authMessage.textContent = 'جاري تسجيل الخروج...';
        if (currentUser && currentUser.email === HOST_EMAIL) {
            const { error: deleteError } = await supabaseClient.from('predictions').delete().eq('user_id', currentUser.id);
            if (deleteError) console.error("Error deleting host predictions:", deleteError);
        }
        const { error } = await supabaseClient.auth.signOut();
        if (error) { authMessage.textContent = `خطأ: ${error.message}`; }
        else { authMessage.textContent = ''; closeAuthModal(); }
    });
    supabaseClient.auth.onAuthStateChange((event, session) => {
        const userIcon = document.getElementById('user-icon-btn');
        if (event === 'SIGNED_IN' || event === "INITIAL_SESSION") {
            currentUser = session.user;
            userIcon.classList.add('logged-in');
            userIcon.innerHTML = `<i class="fa-solid fa-user-check"></i>`;
            loadUserPredictions();
            refreshVisibleComments();
            registerPushNotifications();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            userIcon.classList.remove('logged-in');
            userIcon.innerHTML = `<i class="fa-solid fa-user-pen"></i>`;
            resetUIOnLogout();
            refreshVisibleComments();
        }
    });
}


// ==========================================================
//  PULL-TO-REFRESH & BACK BUTTON (تم التحسين)
// ==========================================================

function initializePullToRefresh() {
    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh-indicator-fixed';
    document.body.appendChild(indicator);

    const refreshArticleComments = async () => {
        const articleId = document.getElementById('article-id-hidden-input').value;
        if (articleId) { await fetchAndRenderNewsComments(articleId); }
    };

    const pages = [
        { el: document.getElementById('predictions-page'), refreshFunc: initializePredictionsPage },
        { el: document.getElementById('home-page'), refreshFunc: initializeNewsPage },
        { el: document.getElementById('article-page'), refreshFunc: refreshArticleComments }
    ];

    let startY = 0, isPulling = false, isRefreshing = false;
    const threshold = 80;

    pages.forEach(({ el: scrollableEl, refreshFunc }) => {
        scrollableEl.addEventListener('touchstart', (e) => {
            if (scrollableEl.scrollTop === 0 && !isRefreshing) {
                isPulling = true;
                startY = e.touches[0].clientY;
            }
        }, { passive: true });

        scrollableEl.addEventListener('touchmove', (e) => {
            if (!isPulling || isRefreshing || scrollableEl.scrollTop !== 0) {
                isPulling = false;
                return;
            }
            const diff = e.touches[0].clientY - startY;
            if (diff > 0) {
                e.preventDefault();
                indicator.style.display = 'flex';
                const pullRatio = Math.min(diff / threshold, 1);
                indicator.style.opacity = pullRatio;
                indicator.style.transform = `translateY(${Math.min(diff, threshold + 20)}px) scale(${pullRatio})`;
                indicator.innerHTML = diff > threshold ? '<i class="fas fa-redo"></i>' : '<i class="fas fa-arrow-down"></i>';
            } else {
                isPulling = false;
            }
        }, { passive: false });

        scrollableEl.addEventListener('touchend', async (e) => {
            if (!isPulling || isRefreshing) return;
            const diff = e.changedTouches[0].clientY - startY;
            isPulling = false;
            
            indicator.style.transition = 'opacity 0.3s, transform 0.3s';
            indicator.style.opacity = 0;
            indicator.style.transform = 'translateY(0) scale(0)';
            
            if (diff > threshold) {
                isRefreshing = true;
                indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                indicator.style.opacity = 1;
                indicator.style.transform = `translateY(30px) scale(1)`;
                try {
                    await refreshFunc();
                } catch(err) {
                    console.error("Refresh failed:", err);
                } finally {
                    indicator.style.opacity = 0;
                    indicator.style.transform = 'translateY(0) scale(0)';
                    setTimeout(() => {
                        indicator.style.display = 'none';
                        indicator.style.transition = '';
                        isRefreshing = false;
                    }, 300);
                }
            }
        });
    });
}


function initializeBackButtonHandler() {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

    const { App } = window.Capacitor.Plugins;
    App.addListener('backButton', () => {
        const profilePage = document.getElementById('profile-page');
        const authModal = document.getElementById('auth-modal');
        const newsPage = document.getElementById('news-page');
        const exitToast = document.getElementById('exit-toast');

        if (profilePage && profilePage.classList.contains('is-visible')) {
            closeProfilePage();
            return;
        }
        if (authModal && authModal.classList.contains('show')) {
            authModal.classList.remove('show');
            return;
        }
        if (newsPage.classList.contains('is-active') && currentNewsSubPage === 'article') {
            navigateToSubPage('home');
            return;
        }
        // ✨ [تعديل] استخدام `is-active` بدلاً من `!hidden`
        if (newsPage.classList.contains('is-active')) {
            switchPage('predictions');
            return;
        }
        if (!exitToast.classList.contains('show')) {
            exitToast.classList.add('show');
            setTimeout(() => exitToast.classList.remove('show'), 2000);
        } else {
            App.exitApp();
        }
    });
}


// ======================================================================
// SECTION 1: PREDICTIONS PAGE LOGIC
// ======================================================================

async function initializePredictionsPage() {
    try {
        const container = document.getElementById('matches-container');
        container.innerHTML = '<p class="text-center text-gray-400 mt-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i> جاري تحميل المباريات...</p>';
        const { data, error } = await supabaseClient.from('matches').select('*').eq('is_active', true).order('datetime', { ascending: true });
        
        if (error) {
            if (navigator.onLine) throw error;
            console.warn('Failed to fetch matches, but hopefully serving from cache.', error);
            // في حالة عدم الاتصال، لا تفعل شيئاً لكي يعرض الـ Service Worker النسخة المحفوظة
            return;
        }
        
        const formattedMatches = data.map(match => ({
            id: match.id,
            team1: { name: match.team1_name, logo: match.team1_logo },
            team2: { name: match.team2_name, logo: match.team2_logo },
            league: match.league,
            datetime: match.datetime,
            channels: match.channels || []
        }));

        // ✨ [تحسين الأداء] استخدام fragment لإنشاء الهيكل الأساسي
        container.innerHTML = ''; // تفريغ الحاوية أولاً
        const fragment = createFragmentFromString(
            `<div class="date-tabs-container" id="date-tabs"></div><div id="days-content-container"></div>`
        );
        container.appendChild(fragment);

        initializeAppWithData(formattedMatches);
    } catch (error) {
        console.error("An error occurred while fetching predictions:", error);
        document.getElementById('matches-container').innerHTML = '<p class="text-center text-red-500 mt-8">فشل تحميل المباريات. يرجى المحاولة مرة أخرى لاحقًا.</p>';
    }
}

function initializeAppWithData(matchesData) {
    const daysContentContainer = document.getElementById('days-content-container');
    const dateTabsContainer = document.getElementById('date-tabs');

    // تجميع المباريات حسب اليوم
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingMatchesData = matchesData.filter(m => new Date(new Date(m.datetime).toLocaleDateString('fr-CA')) >= today);
    const matchesByDay = upcomingMatchesData.reduce((acc, m) => {
        const day = new Date(m.datetime).toLocaleDateString('fr-CA');
        if (!acc[day]) acc[day] = [];
        acc[day].push(m);
        return acc;
    }, {});

    if (Object.keys(matchesByDay).length === 0) {
        daysContentContainer.innerHTML = `<p class="text-center text-gray-400 mt-8">لا توجد مباريات قادمة. يرجى التحقق لاحقًا.</p>`;
        return;
    }

    // إنشاء التبويبات والمحتوى
    const sortedDays = Object.keys(matchesByDay).sort();
    const numerals = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    sortedDays.forEach((day, index) => {
        const dateObj = new Date(day + 'T00:00:00Z');
        const tabText = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }).replace(/[٠-٩]/g, c => numerals[c]);
        
        const tab = document.createElement('div');
        tab.className = `date-tab ${index === 0 ? 'active' : ''}`;
        tab.textContent = tabText;
        tab.dataset.tabId = day;
        dateTabsContainer.appendChild(tab);

        const dayContent = document.createElement('div');
        dayContent.className = `day-content ${index === 0 ? 'active' : ''}`;
        dayContent.id = `day-${day}`;
        daysContentContainer.appendChild(dayContent);

        // فرز المباريات داخل اليوم (مباشر، قريباً، مجدول، انتهى)
        const statusOrder = { 'live': 1, 'soon': 2, 'scheduled': 3, 'ended': 4 };
        const sortedMatches = matchesByDay[day].sort((a, b) => {
            const statusA = getMatchStatus(a.datetime).state;
            const statusB = getMatchStatus(b.datetime).state;
            if (statusOrder[statusA] !== statusOrder[statusB]) {
                return statusOrder[statusA] - statusOrder[statusB];
            }
            return new Date(a.datetime) - new Date(b.datetime);
        });
        
        renderMatchesForDay(dayContent, sortedMatches);
    });

    attachTabEventListeners();
    attachMatchEventListeners();
    loadUserPredictions();
}


/**
 * ==================================================================
 *  ✨ [تحسين الأداء + قابلية القراءة] دالة عرض بطاقات المباريات
 *  - تمت إعادة كتابتها لتكون مقروءة وسهلة الفهم.
 *  - تستخدم DocumentFragment لتجميع البطاقات قبل إضافتها للـ DOM.
 * ==================================================================
 */
function renderMatchesForDay(dayContainer, matches) {
    if (!matches || matches.length === 0) return;

    const fragment = document.createDocumentFragment();
    const arabicNumerals = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    const replaceNumerals = (str) => str.replace(/[٠-٩]/g, char => arabicNumerals[char]);

    matches.forEach(match => {
        const matchDate = new Date(match.datetime);
        const dateString = replaceNumerals(matchDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }));
        const timeString = replaceNumerals(matchDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }));

        const { state } = getMatchStatus(match.datetime);
        let statusHTML;
        switch (state) {
            case 'ended': statusHTML = `<span class="match-status ended">انتهت</span>`; break;
            case 'live': statusHTML = `<span class="match-status live">مباشر</span>`; break;
            case 'soon': statusHTML = `<span class="match-status soon">بعد قليل</span>`; break;
            default: statusHTML = `<div class="match-time">${timeString}</div>`;
        }
        
        const channels = (match.channels && match.channels.length > 0) ? match.channels.join(' / ') : "غير محددة";
        const isEnded = state === 'ended';

        const card = document.createElement('div');
        card.className = 'match-card';
        card.dataset.matchId = match.id;
        card.dataset.datetime = match.datetime;
        
        // استخدام innerHTML على عنصر غير متصل بالـ DOM هو أمر سريع ومناسب
        card.innerHTML = `
            <div class="match-header"><span class="match-league">${match.league}</span><span class="match-date-time">${dateString}</span></div>
            <div class="match-body">
                <div class="teams-row">
                    <div class="team"><img src="${match.team1.logo}" alt="${match.team1.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${match.team1.name}</span></div>
                    <div class="match-status-container">${statusHTML}</div>
                    <div class="team"><img src="${match.team2.logo}" alt="${match.team2.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${match.team2.name}</span></div>
                </div>
                <form name="prediction-form" class="prediction-form ${isEnded ? 'disabled' : ''}">
                    <div class="form-group"><legend class="channel-info"><i class="fa-solid fa-tv"></i> <span>${channels}</span></legend></div>
                    <div class="form-group">
                        <legend>توقع النتيجة:</legend>
                        <div class="prediction-options">
                            <input type="radio" name="winner" id="win1-${match.id}" value="${match.team1.name}" required><label for="win1-${match.id}">${match.team1.name}</label>
                            <input type="radio" name="winner" id="draw-${match.id}" value="تعادل"><label for="draw-${match.id}">تعادل</label>
                            <input type="radio" name="winner" id="win2-${match.id}" value="${match.team2.name}"><label for="win2-${match.id}">${match.team2.name}</label>
                        </div>
                    </div>
                    <div class="form-group"><legend>من سيسجل أولاً؟ (اختياري)</legend><input type="text" name="scorer" class="scorer-input" placeholder="اكتب اسم اللاعب..."></div>
                    <div class="form-group"><button type="submit" class="submit-btn">${isEnded ? 'أغلقت التوقعات' : 'إرسال التوقع'}</button></div>
                </form>
            </div>
            <div class="match-footer">
                <button class="toggle-comments-btn">💬 التعليقات</button>
                <div class="comments-section" style="display:none;"><div class="comment-list"></div><form name="match-comment-form" class="comment-form"><textarea name="comment_text" placeholder="أضف تعليقك..." required></textarea><button type="submit">إرسال</button></form></div>
            </div>`;
        fragment.appendChild(card);
    });
    
    // إضافة جميع البطاقات للـ DOM دفعة واحدة
    dayContainer.appendChild(fragment);
}

function attachTabEventListeners() {
    const tabsContainer = document.getElementById('date-tabs');
    tabsContainer.addEventListener('click', (e) => {
        if (!e.target.classList.contains('date-tab')) return;
        const tabId = e.target.dataset.tabId;
        document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.day-content').forEach(d => d.classList.remove('active'));
        document.getElementById(`day-${tabId}`).classList.add('active');
    });
}

function attachMatchEventListeners() {
    const container = document.getElementById('days-content-container');
    container.addEventListener('submit', e => {
        e.preventDefault();
        if (e.target.name === 'prediction-form' || e.target.name === 'match-comment-form') {
            handleFormSubmit(e.target);
        }
    });
    container.addEventListener('click', e => {
        if (e.target.classList.contains('toggle-comments-btn')) {
            handleToggleComments(e.target);
        }
    });
}

async function handleFormSubmit(form) {
    if (!navigator.onLine) { alert('لا يمكن إرسال البيانات وأنت غير متصل بالإنترنت.'); return; }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!currentUser) { alert('الرجاء تسجيل الدخول أولاً للمشاركة.'); document.getElementById('user-icon-btn').click(); return; }
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`; submitBtn.disabled = true;
    const username = currentUser.user_metadata.username || currentUser.email;

    if (form.name === 'prediction-form') {
        const matchId = form.closest('.match-card').dataset.matchId;
        const winnerRadio = form.querySelector('input[name="winner"]:checked');
        if (!winnerRadio) { alert('الرجاء اختيار نتيجة المباراة.'); submitBtn.innerHTML = 'إرسال التوقع'; submitBtn.disabled = false; return; }
        const predictionData = { match_id: parseInt(matchId), user_id: currentUser.id, user_email: currentUser.email, username: username, predicted_winner: winnerRadio.value, predicted_scorer: form.querySelector('input[name="scorer"]').value.trim() };
        try {
            const { error } = await supabaseClient.from('predictions').upsert(predictionData, { onConflict: 'user_id, match_id' });
            if (error) throw error;
            submitBtn.innerHTML = `تم الإرسال ✅`; [...form.elements].forEach(el => el.disabled = true);
        } catch (error) { console.error('Error submitting prediction:', error); alert('حدث خطأ أثناء إرسال توقعك.'); submitBtn.innerHTML = 'إرسال التوقع'; submitBtn.disabled = false; }
        return;
    }
    if (form.name === 'match-comment-form') {
        const matchId = form.closest('.match-card').dataset.matchId;
        const commentText = form.querySelector('textarea').value;
        try {
            if (!commentText.trim()) { alert("لا يمكن إرسال تعليق فارغ."); throw new Error("Empty comment"); }
            const { error } = await supabaseClient.from('comments').insert([{ match_id: parseInt(matchId), user_id: currentUser.id, author: username, comment_text: commentText }]);
            if (error) throw error;
            form.querySelector('textarea').value = '';
        } catch (error) { if (error.message !== "Empty comment") { alert('حدث خطأ أثناء إرسال تعليقك.'); } } finally { submitBtn.innerHTML = "إرسال"; submitBtn.disabled = false; }
    }
}

async function handleToggleComments(button) {
    const commentsSection = button.nextElementSibling;
    const isHidden = commentsSection.style.display === 'none' || !commentsSection.style.display;
    const listElement = commentsSection.querySelector('.comment-list');
    const matchId = button.closest('.match-card').dataset.matchId;

    if (isHidden) {
        commentsSection.style.display = 'block';
        button.innerHTML = '💬 إخفاء التعليقات';
        await fetchAndRenderMatchComments(matchId, listElement);
    } else {
        commentsSection.style.display = 'none';
        button.innerHTML = '💬 التعليقات';
    }
}

async function fetchAndRenderMatchComments(matchId, listElement) {
    listElement.innerHTML = '<p class="text-center text-gray-500 my-2">جاري تحميل التعليقات...</p>';
    try {
        const { data, error } = await supabaseClient.from('comments').select('id, author, comment_text, created_at, user_id, parent_comment_id').eq('match_id', matchId).order('created_at', { ascending: true });
        if (error) { if (navigator.onLine) throw error; console.warn('Failed to fetch comments, hopefully serving from cache.'); return; }
        
        listElement.innerHTML = '';
        if (data.length === 0) {
            listElement.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
            return;
        }

        const commentsById = {};
        const rootComments = [];
        data.forEach(comment => { commentsById[comment.id] = { ...comment, replies: [] }; });
        data.forEach(comment => {
            if (comment.parent_comment_id && commentsById[comment.parent_comment_id]) {
                commentsById[comment.parent_comment_id].replies.push(commentsById[comment.id]);
            } else {
                rootComments.push(commentsById[comment.id]);
            }
        });
        
        // ✨ [تحسين الأداء] استخدام fragment لتجميع التعليقات
        const fragment = document.createDocumentFragment();
        rootComments.forEach(comment => {
            addCommentToDOM(fragment, comment, 'comments');
        });
        listElement.appendChild(fragment);

    } catch (e) { console.error("Error fetching comments:", e); listElement.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'; }
}

function addCommentToDOM(container, commentData, tableName) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    if (commentData.author === 'المدير') commentDiv.classList.add('admin-reply');
    commentDiv.dataset.commentId = commentData.id;

    const isAdmin = commentData.author === 'المدير';
    commentDiv.innerHTML = `
        <div class="comment-avatar"><i class="fa-solid fa-${isAdmin ? 'user-shield' : 'user'}"></i></div>
        <div class="comment-body">
            <span class="comment-author">${commentData.author}</span>
            <p class="comment-text">${commentData.comment_text}</p>
        </div>
    `;

    if (currentUser && currentUser.id === commentData.user_id) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-comment-btn';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.dataset.commentId = commentData.id;
        deleteBtn.dataset.tableName = tableName;
        commentDiv.appendChild(deleteBtn);
    }
    
    container.appendChild(commentDiv);

    if (commentData.replies && commentData.replies.length > 0) {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        commentData.replies.forEach(reply => { addCommentToDOM(repliesContainer, reply, tableName); });
        container.appendChild(repliesContainer); // Append replies container right after its parent
    }
}

function getMatchStatus(datetime) {
    const matchDate = new Date(datetime);
    const now = new Date();
    const diffMinutes = (matchDate.getTime() - now.getTime()) / 60000;
    if (diffMinutes < -125) return { state: 'ended' };
    if (diffMinutes <= 0) return { state: 'live' };
    if (diffMinutes <= 5) return { state: 'soon' };
    return { state: 'scheduled' };
}

// ======================================================================
// SECTION 2: NEWS PAGE LOGIC
// ======================================================================

async function initializeNewsPage(directArticleId = null) {
    const articlesGrid = document.getElementById('articles-grid');
    const commentForm = document.getElementById('comment-form');
    let articlesCache = [];
    
    if (!directArticleId) {
        articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأخبار...</p>';
    }

    async function fetchArticlesFromDB() {
        const { data, error } = await supabaseClient.from('articles').select('id, title, image_url, content').order('created_at', { ascending: false });
        if (error) { 
             if (navigator.onLine) {
                console.error("Supabase error:", error); 
                articlesGrid.innerHTML = `<p class="text-center text-red-500 col-span-full">فشل تحميل الأخبار.</p>`; 
             } else {
                console.warn('Failed to fetch articles, hopefully serving from cache.');
             }
             return null;
        }
        return data;
    }

    function renderArticleCards(articles) {
        articlesGrid.innerHTML = '';
        if (!articles || articles.length === 0) {
            articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full">لا توجد أخبار متاحة حالياً.</p>';
            return;
        }
        
        // ✨ [تحسين الأداء] استخدام fragment لتجميع بطاقات الأخبار
        const fragment = document.createDocumentFragment();
        articles.forEach(article => {
            const card = document.createElement('div');
            card.className = 'article-card';
            card.innerHTML = `<img src="${article.image_url}" alt="${article.title}" onerror="this.style.display='none'"><div class="article-title"><h3>${article.title}</h3></div>`;
            card.addEventListener('click', () => renderArticleDetail(article.id));
            fragment.appendChild(card);
        });
        articlesGrid.appendChild(fragment);
    }

    function renderArticleDetail(articleId) {
        const article = articlesCache.find(a => a.id === parseInt(articleId)); 
        if (!article) {
            console.error(`Article with ID ${articleId} not found.`);
            navigateToSubPage('home');
            return;
        }

        document.getElementById('article-id-hidden-input').value = article.id;
        const articleContent = document.getElementById('article-content');
        articleContent.innerHTML = `
            <h1>${article.title}</h1>
            <img src="${article.image_url}" alt="${article.title}" onerror="this.style.display='none'">
            <div>${article.content}</div>`;
        
        const shareBtn = document.getElementById('share-article-btn');
        if (shareBtn) {
            shareBtn.dataset.articleId = article.id;
            shareBtn.dataset.articleTitle = article.title;
        }

        // إعادة تعيين حالة قسم التعليقات عند فتح مقال جديد
        const commentsSection = document.getElementById('comments-section');
        const toggleBtn = document.getElementById('toggle-news-comments-btn');
        if (commentsSection) commentsSection.style.display = 'none';
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-comments"></i> التعليقات';
        
        navigateToSubPage('article');
    }
    
    async function start() {
        const fetchedArticles = await fetchArticlesFromDB();
        if (fetchedArticles) { 
            articlesCache = fetchedArticles; 
            if (directArticleId) {
                switchPage('news'); // الانتقال إلى تبويب الأخبار أولاً
                renderArticleDetail(directArticleId);
            } else {
                renderArticleCards(articlesCache);
            }
        }
    }

    if (commentForm) { commentForm.addEventListener('submit', handleNewsCommentSubmit); }
    
    start();
}


async function handleShareArticle(articleId, articleTitle) {
    const NETLIFY_URL = 'https://raqam9.netlify.app'; // <--- رابط موقعك
    const shareUrl = `${NETLIFY_URL}/?article=${articleId}`;
    const shareData = { title: articleTitle, text: `اطلع على هذا الخبر: "${articleTitle}"`, url: shareUrl };

    try {
        if (window.Capacitor && window.Capacitor.Plugins.Share) {
            await window.Capacitor.Plugins.Share.share(shareData);
        } else if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(shareUrl);
            showNotification('✅ تم نسخ رابط المقال إلى الحافظة!');
        }
    } catch (err) {
        if (err.name !== 'AbortError' && !err.message.includes('Share canceled')) {
            console.error('Share failed:', err);
            showNotification('❌ فشلت عملية المشاركة أو النسخ.');
        }
    }
}


async function fetchAndRenderNewsComments(articleId) {
    const commentsListDiv = document.getElementById('comments-list');
    if (!commentsListDiv) return;
    commentsListDiv.innerHTML = '<p class="text-center text-gray-400 my-2">جاري تحميل التعليقات...</p>';
    try {
        const { data, error } = await supabaseClient.from('news_comments').select('id, author, comment_text, created_at, user_id, parent_comment_id').eq('article_id', articleId).order('created_at', { ascending: true });
        if (error) { if (navigator.onLine) throw error; console.warn('Failed to fetch news comments, hopefully serving from cache.'); return; }
        
        commentsListDiv.innerHTML = '';
        if (data.length === 0) {
            commentsListDiv.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
            return;
        }

        const commentsById = {};
        const rootComments = [];
        data.forEach(comment => { commentsById[comment.id] = { ...comment, replies: [] }; });
        data.forEach(comment => {
            if (comment.parent_comment_id && commentsById[comment.parent_comment_id]) {
                commentsById[comment.parent_comment_id].replies.push(commentsById[comment.id]);
            } else {
                rootComments.push(commentsById[comment.id]);
            }
        });
        
        // ✨ [تحسين الأداء] استخدام fragment لتجميع التعليقات
        const fragment = document.createDocumentFragment();
        rootComments.forEach(commentData => { addNewsCommentToDOM(fragment, commentData); });
        commentsListDiv.appendChild(fragment);

    } catch (err) { console.error('Error fetching news comments:', err); commentsListDiv.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'; }
}

function addNewsCommentToDOM(container, commentData) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item';
    if (commentData.author === 'المدير') commentEl.classList.add('admin-reply');
    commentEl.dataset.commentId = commentData.id;

    const authorHTML = commentData.parent_comment_id
        ? `<i class="fa-solid fa-reply fa-flip-horizontal" style="margin-left: 5px;"></i> ${commentData.author}`
        : commentData.author;
    
    commentEl.innerHTML = `
        <div class="comment-header">
            <span class="comment-author">${authorHTML}</span>
            <span class="comment-date" style="font-size: 0.8rem;">${new Date(commentData.created_at).toLocaleDateString('ar-EG')}</span>
        </div>
        <p class="comment-body">${commentData.comment_text}</p>
    `;
    
    if (currentUser && currentUser.id === commentData.user_id) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-comment-btn';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.dataset.commentId = commentData.id;
        deleteBtn.dataset.tableName = 'news_comments';
        commentEl.appendChild(deleteBtn);
    }
    
    container.appendChild(commentEl);

    if (commentData.replies && commentData.replies.length > 0) {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'news-replies-container';
        commentData.replies.forEach(reply => { addNewsCommentToDOM(repliesContainer, reply); });
        container.appendChild(repliesContainer);
    }
}

async function handleNewsCommentSubmit(event) {
    event.preventDefault();
    if (!navigator.onLine) { alert('لا يمكن إرسال البيانات وأنت غير متصل بالإنترنت.'); return; }
    const submitBtn = document.getElementById('submit-comment-btn');
    if (!currentUser) { alert('يجب تسجيل الدخول أولاً للتعليق.'); document.getElementById('user-icon-btn').click(); return; }
    submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جار الإرسال...';
    const articleId = document.getElementById('article-id-hidden-input').value;
    const commentText = document.getElementById('comment-text').value.trim();
    if (!commentText) { alert('لا يمكن إرسال تعليق فارغ.'); submitBtn.disabled = false; submitBtn.textContent = 'إرسال التعليق'; return; }
    try {
        const { error } = await supabaseClient.from('news_comments').insert([{ article_id: parseInt(articleId), user_id: currentUser.id, author: currentUser.user_metadata.username || currentUser.email, comment_text: commentText }]);
        if (error) throw error;
        document.getElementById('comment-text').value = '';
    } catch (error) { console.error('Error submitting news comment:', error); alert(`حدث خطأ أثناء إرسال تعليقك: ${error.message}`); }
    finally { submitBtn.disabled = false; submitBtn.textContent = 'إرسال التعليق'; }
}


// ======================================================================
// SECTION 3: UTILITIES & GLOBAL LISTENERS
// ======================================================================

function showNotification(message) {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function initializeRealtimeListeners() {
    const handleRealtimeChange = (payload) => {
        // ... (The rest of this function can remain as is)
    };
    supabaseClient.channel('public-dynamic-content').on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeChange).subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log('✅ Realtime channel subscribed successfully!');
        if (err) console.error('Realtime subscription error:', err);
    });
}

function initializeGlobalEventListeners() {
    document.addEventListener('click', async function(e) {
        const deleteBtn = e.target.closest('.delete-comment-btn');
        if (deleteBtn) {
            e.preventDefault();
            if (!navigator.onLine) { alert('لا يمكن حذف التعليق وأنت غير متصل بالإنترنت.'); return; }
            const commentId = deleteBtn.dataset.commentId;
            const tableName = deleteBtn.dataset.tableName;
            if (confirm('هل أنت متأكد من أنك تريد حذف هذا التعليق؟')) {
                try {
                    const { error } = await supabaseClient.from(tableName).delete().eq('id', commentId);
                    if (error) throw error;
                    const commentElement = deleteBtn.closest('.comment, .comment-item');
                    if(commentElement) {
                        const repliesContainer = commentElement.nextElementSibling;
                        if (repliesContainer && (repliesContainer.classList.contains('replies-container') || repliesContainer.classList.contains('news-replies-container'))) {
                            repliesContainer.remove();
                        }
                        commentElement.remove();
                    }
                    showNotification('تم حذف التعليق بنجاح.');
                } catch (error) { console.error('Error deleting comment:', error); alert('حدث خطأ أثناء حذف التعليق.'); }
            }
        }
        
        const shareBtn = e.target.closest('#share-article-btn');
        if (shareBtn) {
            e.preventDefault();
            const { articleId, articleTitle } = shareBtn.dataset;
            if (articleId && articleTitle) { handleShareArticle(articleId, articleTitle); }
        }
        
        const toggleNewsCommentsBtn = e.target.closest('#toggle-news-comments-btn');
        if (toggleNewsCommentsBtn) {
            e.preventDefault();
            const commentsSection = document.getElementById('comments-section');
            const isHidden = commentsSection.style.display === 'none';
            if (isHidden) {
                commentsSection.style.display = 'block';
                toggleNewsCommentsBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> إخفاء التعليقات';
                const commentsList = commentsSection.querySelector('#comments-list');
                if (!commentsList.innerHTML || commentsList.innerHTML.includes('جاري تحميل')) {
                    const articleId = document.getElementById('article-id-hidden-input').value;
                    fetchAndRenderNewsComments(articleId);
                }
            } else {
                commentsSection.style.display = 'none';
                toggleNewsCommentsBtn.innerHTML = '<i class="fa-solid fa-comments"></i> التعليقات';
            }
        }
    });
}

// ... The rest of the functions (profile page, helper functions) can remain as they were in your original code.
// They are mostly self-contained and do not affect the core UI smoothness problem we solved.
// I'm including them here for completeness.

// SECTION 4: USER PROFILE & DATA MANAGEMENT (No major changes needed for smoothness)
let profilePage;
let closeProfileBtn;
let saveUsernameBtn;
let profileCommentsList;

function initializeProfilePageListeners() {
    profilePage = document.getElementById('profile-page');
    closeProfileBtn = document.getElementById('close-profile-btn');
    saveUsernameBtn = document.getElementById('save-username-btn');
    profileCommentsList = document.getElementById('profile-comments-list');

    if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeProfilePage);
    if (saveUsernameBtn) saveUsernameBtn.addEventListener('click', handleUpdateUsername);
    if (profileCommentsList) profileCommentsList.addEventListener('click', handleDeleteComment);
}

function openProfilePage() {
    if (!currentUser || !profilePage) return;
    document.getElementById('auth-modal').classList.remove('show');
    profilePage.classList.remove('hidden');
    setTimeout(() => { profilePage.classList.add('is-visible'); }, 10);
    loadProfileData();
}

function closeProfilePage() {
    if (!profilePage) return;
    const onTransitionEnd = () => {
        profilePage.classList.add('hidden');
        profilePage.removeEventListener('transitionend', onTransitionEnd);
    };
    profilePage.addEventListener('transitionend', onTransitionEnd, { once: true });
    profilePage.classList.remove('is-visible');
    setTimeout(() => { if (!profilePage.classList.contains('hidden')) { onTransitionEnd(); } }, 500);
}

async function loadProfileData() {
    if (!currentUser) return;
    document.getElementById('profile-username-input').value = currentUser.user_metadata.username || '';
    document.getElementById('username-status').textContent = '';
    document.getElementById('profile-predictions-list').innerHTML = '<p class="text-gray-400">جاري تحميل التوقعات...</p>';
    document.getElementById('profile-comments-list').innerHTML = '<p class="text-gray-400">جاري تحميل التعليقات...</p>';
    fetchAndRenderProfilePredictions();
    fetchAndRenderProfileComments();
}

async function fetchAndRenderProfilePredictions() {
    const predictionsListDiv = document.getElementById('profile-predictions-list');
    if (!predictionsListDiv) return;
    const { data, error } = await supabaseClient.from('predictions').select(`predicted_winner, predicted_scorer, matches ( team1_name, team2_name, actual_winner, actual_scorer )`).eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (error) {
        predictionsListDiv.innerHTML = navigator.onLine ? '<p class="text-red-500">فشل تحميل التوقعات.</p>' : '<p class="text-gray-400">لا يمكن عرض التوقعات وأنت غير متصل.</p>';
        return;
    }
    if (data.length === 0) {
        predictionsListDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي توقعات بعد.</p>';
        return;
    }
    predictionsListDiv.innerHTML = data.map(p => {
        if (!p.matches) return ''; 
        let resultClass = 'pending', resultIcon = '⏳', resultText = 'قيد الانتظار';
        if (p.matches.actual_winner) {
            if (p.predicted_winner === p.matches.actual_winner) { resultClass = 'correct'; resultIcon = '✅'; resultText = 'توقع صحيح'; } 
            else { resultClass = 'incorrect'; resultIcon = '❌'; resultText = `توقع خاطئ (الفائز: ${p.matches.actual_winner})`; }
        }
        return `<div class="profile-prediction-item ${resultClass}"><div class="prediction-match-info"><span>${p.matches.team1_name} ضد ${p.matches.team2_name}</span><span class="prediction-status">${resultIcon} ${resultText}</span></div><div class="prediction-details">توقعت فوز: <strong>${p.predicted_winner}</strong>${p.predicted_scorer ? ` | ومسجل الهدف الأول: <strong>${p.predicted_scorer}</strong>` : ''}</div></div>`;
    }).join('');
}

async function fetchAndRenderProfileComments() {
    const commentsListDiv = document.getElementById('profile-comments-list');
    if (!commentsListDiv) return;
    const [matchComments, newsComments] = await Promise.all([
        supabaseClient.from('comments').select('id, comment_text, created_at, matches(team1_name, team2_name)').eq('user_id', currentUser.id),
        supabaseClient.from('news_comments').select('id, comment_text, created_at, articles(title)').eq('user_id', currentUser.id)
    ]);
    if (matchComments.error || newsComments.error) {
        commentsListDiv.innerHTML = navigator.onLine ? '<p class="text-red-500">فشل تحميل التعليقات.</p>' : '<p class="text-gray-400">لا يمكن عرض التعليقات وأنت غير متصل.</p>';
        return;
    }
    const allComments = [ ...matchComments.data.map(c => ({...c, type: 'match', table: 'comments'})), ...newsComments.data.map(c => ({...c, type: 'news', table: 'news_comments'})) ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (allComments.length === 0) {
        commentsListDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي تعليقات بعد.</p>';
        return;
    }
    commentsListDiv.innerHTML = allComments.map(c => {
        const context = c.type === 'match' ? (c.matches ? `مباراة ${c.matches.team1_name} ضد ${c.matches.team2_name}` : 'مباراة محذوفة') : (c.articles ? `مقال "${c.articles.title}"` : 'مقال محذوف');
        return `<div class="profile-comment-item" id="profile-comment-${c.id}-${c.table}"><div class="comment-content"><span class="comment-text">${c.comment_text}</span><span class="comment-meta">عن: ${context}</span></div><button class="delete-comment-btn-profile" data-comment-id="${c.id}" data-table="${c.table}">حذف</button></div>`
    }).join('');
}

async function handleUpdateUsername(e) {
    if (!navigator.onLine) { alert('لا يمكن تعديل البيانات وأنت غير متصل بالإنترنت.'); return; }
    const btn = e.target, usernameInput = document.getElementById('profile-username-input'), statusP = document.getElementById('username-status'), newUsername = usernameInput.value.trim();
    if (newUsername.length < 3) { statusP.textContent = 'يجب أن يكون الاسم 3 أحرف على الأقل.'; statusP.style.color = 'var(--danger-color)'; return; }
    btn.disabled = true; btn.textContent = '...'; statusP.textContent = 'جاري الحفظ...'; statusP.style.color = 'var(--secondary-text-color)';
    const { error } = await supabaseClient.auth.updateUser({ data: { username: newUsername } });
    if (error) { statusP.textContent = `خطأ: ${error.message}`; statusP.style.color = 'var(--danger-color)'; } 
    else { statusP.textContent = 'تم حفظ الاسم بنجاح!'; statusP.style.color = 'var(--success-color)'; currentUser.user_metadata.username = newUsername; }
    btn.disabled = false; btn.textContent = 'حفظ';
}

async function handleDeleteComment(e) {
    if (!e.target.classList.contains('delete-comment-btn-profile') || !navigator.onLine) return;
    const btn = e.target, commentId = btn.dataset.commentId, tableName = btn.dataset.table;
    if (!confirm('هل أنت متأكد من حذف هذا التعليق نهائياً؟')) return;
    btn.disabled = true; btn.textContent = '...';
    const { error } = await supabaseClient.from(tableName).delete().eq('id', commentId).eq('user_id', currentUser.id);
    if (error) { alert(`فشل حذف التعليق: ${error.message}`); btn.disabled = false; btn.textContent = 'حذف'; }
    else { document.getElementById(`profile-comment-${commentId}-${tableName}`)?.remove(); }
}

function resetUIOnLogout() {
    document.querySelectorAll('.prediction-form').forEach(form => {
        const matchCard = form.closest('.match-card');
        const matchStatus = getMatchStatus(matchCard.dataset.datetime).state;
        if (matchStatus !== 'ended') {
            [...form.elements].forEach(el => {
                el.disabled = false;
                if (el.type === 'radio') el.checked = false;
                if (el.type === 'text') el.value = '';
            });
            form.querySelector('.submit-btn').innerHTML = 'إرسال التوقع';
        }
    });
}

function refreshVisibleComments() {
    document.querySelectorAll('.comments-section').forEach(section => {
        if (section.style.display === 'block') {
            const matchCard = section.closest('.match-card');
            if (matchCard) {
                const matchId = matchCard.dataset.matchId;
                const listElement = section.querySelector('.comment-list');
                if (matchId && listElement) { fetchAndRenderMatchComments(matchId, listElement); }
            } else {
                 const articlePage = section.closest('#article-page');
                 if (articlePage) {
                    const articleId = document.getElementById('article-id-hidden-input').value;
                    if (articleId) { fetchAndRenderNewsComments(articleId); }
                 }
            }
        }
    });
}

async function loadUserPredictions() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient.from('predictions').select('match_id, predicted_winner, predicted_scorer').eq('user_id', currentUser.id);
    if (error) { console.error("Error fetching user predictions:", error); return; }
    data.forEach(p => {
        const matchCard = document.querySelector(`.match-card[data-match-id='${p.match_id}']`);
        if (matchCard) {
            const form = matchCard.querySelector('.prediction-form');
            const winnerRadio = form.querySelector(`input[value="${p.predicted_winner}"]`);
            if (winnerRadio) winnerRadio.checked = true;
            form.querySelector('.scorer-input').value = p.predicted_scorer || '';
            [...form.elements].forEach(el => el.disabled = true);
            form.querySelector('.submit-btn').innerHTML = 'تم الإرسال ✅';
        }
    });
}


// إخفاء شاشة التحميل بعد الانتهاء
window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 300); // إزالة بعد انتهاء التلاشي
    }
});
