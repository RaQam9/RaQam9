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

function showNotification(message) {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function triggerHapticFeedback(style = 'LIGHT') {
    if (window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins.Haptics) {
        try {
            const { Haptics, HapticsImpactStyle } = window.Capacitor.Plugins;
            Haptics.impact({ style: HapticsImpactStyle[style] });
        } catch (err) {
            console.warn("Haptic feedback failed:", err);
        }
    }
}

async function shareContent(title, text, url) {
    if (window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins.Share) {
        const { Share } = window.Capacitor.Plugins;
        try { await Share.share({ title, text, url, dialogTitle: 'مشاركة مع أصدقائك' }); }
        catch (err) { console.error('Capacitor Share Error:', err); }
    } else if (navigator.share) {
        try { await navigator.share({ title, text, url }); }
        catch (err) { if (err.name !== 'AbortError') console.error('Web Share API Error:', err); }
    } else {
        try { await navigator.clipboard.writeText(url); showNotification('تم نسخ رابط المقال بنجاح!'); }
        catch (err) { console.error('Clipboard API Error:', err); showNotification('فشل نسخ الرابط.'); }
    }
}

function navigateToSubPage(pageName) {
    const newsHomePage = document.getElementById('home-page');
    const newsArticlePage = document.getElementById('article-page');
    currentNewsSubPage = pageName;
    if (pageName === 'article') {
        newsHomePage.style.transform = 'translateX(-100%)';
        newsArticlePage.style.transform = 'translateX(0)';
        newsArticlePage.scrollTop = 0;
    } else {
        newsHomePage.style.transform = 'translateX(0)';
        newsArticlePage.style.transform = 'translateX(100%)';
    }
}

function getMatchStatus(datetime) {
    if (!datetime) return { state: 'scheduled' };
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
    try {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(reg => console.log('✅ Service Worker registered', reg.scope))
                    .catch(err => console.error('❌ Service Worker registration failed', err));
            });
        }

        const offlineStatusDiv = document.getElementById('offline-status');
        const handleConnectionChange = () => {
            if (offlineStatusDiv) {
                offlineStatusDiv.style.display = navigator.onLine ? 'none' : 'block';
            }
        };
        window.addEventListener('online', handleConnectionChange);
        window.addEventListener('offline', handleConnectionChange);
        handleConnectionChange();

        initializePageNavigation();
        initializeAuth();
        initializePredictionsPage();
        initializeNewsPage();
        initializeRealtimeListeners();
        initializeGlobalEventListeners();
        initializeProfilePageListeners();
        initializePullToRefresh();
        initializeBackButtonHandler();

    } catch (e) {
        console.error("A critical error occurred during initialization:", e);
        document.body.innerHTML = `<div style="padding: 20px; color: red; text-align: center;"><h1>خطأ فادح في التطبيق</h1><p>${e.message}</p></div>`;
    }
});

window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }
});

// ==========================================================
// SECTION 2: CORE APP MODULES & EVENT LISTENERS
// ==========================================================

function initializePageNavigation() {
    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');
    const predictionsPage = document.getElementById('predictions-page');
    const newsPage = document.getElementById('news-page');

    function switchPage(pageToShow) {
        if (typeof gtag !== 'undefined') { gtag('event', 'select_content', { 'content_type': 'tab', 'item_id': pageToShow }); }
        
        const isPredictions = pageToShow === 'predictions';
        predictionsBtn.classList.toggle('bg-blue-600', isPredictions);
        predictionsBtn.classList.toggle('text-white', isPredictions);
        predictionsBtn.classList.toggle('text-gray-400', !isPredictions);
        predictionsPage.classList.toggle('hidden', !isPredictions);
        
        newsBtn.classList.toggle('bg-blue-600', !isPredictions);
        newsBtn.classList.toggle('text-white', !isPredictions);
        newsBtn.classList.toggle('text-gray-400', isPredictions);
        newsPage.classList.toggle('hidden', isPredictions);
    }

    predictionsBtn.addEventListener('click', () => switchPage('predictions'));
    newsBtn.addEventListener('click', () => switchPage('news'));
}

function initializeGlobalEventListeners() {
    document.addEventListener('click', async e => {
        const deleteBtn = e.target.closest('.delete-comment-btn, .delete-comment-btn-profile');
        if (deleteBtn) {
            e.preventDefault();
            if (!navigator.onLine) { showNotification('لا يمكن الحذف وأنت غير متصل.'); return; }
            if (confirm('هل أنت متأكد من حذف هذا التعليق؟')) {
                const { error } = await supabaseClient.from(deleteBtn.dataset.tableName).delete().eq('id', deleteBtn.dataset.commentId);
                if (error) { 
                    showNotification('فشل حذف التعليق.');
                    console.error("Delete error:", error);
                } else { 
                    deleteBtn.closest('.comment, .comment-item, .profile-comment-item')?.remove(); 
                    showNotification('تم حذف التعليق بنجاح.');
                }
            }
        }
    });
}

// ==========================================================
// SECTION 3: AUTHENTICATION & USER MANAGEMENT
// ==========================================================

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
        [loginView, signupView, loggedinView].forEach(v => { if(v) v.style.display = 'none'; });
        if(view) view.style.display = 'block';
        if(authMessage) authMessage.textContent = '';
    };

    if(userIconBtn) userIconBtn.addEventListener('click', () => {
        if (currentUser) {
            showView(loggedinView);
            document.getElementById('user-email-display').textContent = `أهلاً بك، ${currentUser.user_metadata.username || currentUser.email.split('@')[0]}!`;
        } else {
            showView(loginView);
        }
        openAuthModal();
    });
    
    if(openProfileBtn) openProfileBtn.addEventListener('click', openProfilePage);
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeAuthModal);
    if(authModal) authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });
    if(showSignupBtn) showSignupBtn.addEventListener('click', () => showView(signupView));
    if(showLoginBtn) showLoginBtn.addEventListener('click', () => showView(loginView));

    if(signupForm) signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!navigator.onLine) { showNotification('لا يمكن إنشاء حساب وأنت غير متصل.'); return; }
        authMessage.textContent = 'جاري إنشاء الحساب...';
        const { error } = await supabaseClient.auth.signUp({ 
            email: document.getElementById('signup-email').value, 
            password: document.getElementById('signup-password').value, 
            options: { data: { username: document.getElementById('signup-username').value } } 
        });
        authMessage.textContent = error ? `خطأ: ${error.message}` : 'تم إنشاء الحساب! يرجى مراجعة بريدك الإلكتروني للتفعيل.';
        if (!error) signupForm.reset();
    });

    if(loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!navigator.onLine) { showNotification('لا يمكن تسجيل الدخول وأنت غير متصل.'); return; }
        authMessage.textContent = 'جاري تسجيل الدخول...';
        const { error } = await supabaseClient.auth.signInWithPassword({ 
            email: document.getElementById('login-email').value, 
            password: document.getElementById('login-password').value 
        });
        if (error) {
            authMessage.textContent = `خطأ: ${error.message}`;
        } else {
            authMessage.textContent = 'تم تسجيل الدخول بنجاح!';
            loginForm.reset();
            setTimeout(closeAuthModal, 1000);
        }
    });

    if(logoutBtn) logoutBtn.addEventListener('click', async () => {
        if (!navigator.onLine) { showNotification('لا يمكن تسجيل الخروج وأنت غير متصل.'); return; }
        authMessage.textContent = 'جاري تسجيل الخروج...';
        const { error } = await supabaseClient.auth.signOut();
        authMessage.textContent = error ? `خطأ: ${error.message}` : '';
        if (!error) closeAuthModal();
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        const userIcon = document.getElementById('user-icon-btn');
        if(userIcon) {
            userIcon.classList.toggle('logged-in', !!currentUser);
            userIcon.innerHTML = currentUser ? `<i class="fa-solid fa-user-check"></i>` : `<i class="fa-solid fa-user-pen"></i>`;
        }
        
        if (currentUser) {
            loadUserPredictions();
            registerPushNotifications();
        } else {
            resetUIOnLogout();
        }
        refreshVisibleComments();
    });
}

function resetUIOnLogout() {
    document.querySelectorAll('.prediction-form').forEach(form => {
        const matchCard = form.closest('.match-card');
        if(!matchCard) return;
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

// ==========================================================
// SECTION 4: PREDICTIONS PAGE
// ==========================================================
async function initializePredictionsPage() {
    const container = document.getElementById('matches-container');
    if (!container) { console.error("CRITICAL: #matches-container not found."); return; }
    container.innerHTML = `<p class="text-center text-gray-400 mt-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i> جاري تحميل المباريات...</p>`;

    try {
        const { data, error } = await supabaseClient.from('matches').select('*').order('datetime', { ascending: true });

        if (error) {
            console.error('Supabase Error [initializePredictionsPage]:', error);
            if (navigator.onLine) {
                throw new Error(error.message);
            }
        }

        if (data && data.length > 0) {
            container.innerHTML = `<div class="date-tabs-container" id="date-tabs"></div><div id="days-content-container"></div>`;
            initializeAppWithData(data);
        } else {
            container.innerHTML = navigator.onLine
                ? '<p class="text-center text-gray-400 mt-8">لا توجد مباريات مجدولة حاليًا.</p>'
                : '<p class="text-center text-gray-400 mt-8">أنت غير متصل ولا توجد بيانات محفوظة لعرضها.</p>';
        }

    } catch (e) {
        console.error('Caught Error [initializePredictionsPage]:', e);
        container.innerHTML = `<p class="text-center text-red-500 mt-8 font-bold">فشل تحميل المباريات.</p><p class="text-center text-gray-400 text-sm mt-1">السبب: ${e.message}.<br>اسحب للأسفل للمحاولة مرة أخرى.</p>`;
    }
}

function initializeAppWithData(matchesData) {
    const dateTabsContainer = document.getElementById('date-tabs');
    const daysContentContainer = document.getElementById('days-content-container');
    if (!dateTabsContainer || !daysContentContainer) { return; }

    dateTabsContainer.innerHTML = '';
    daysContentContainer.innerHTML = '';

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingMatches = matchesData.filter(match => {
            if (!match.datetime) return false;
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

        Object.keys(matchesByDay).sort().forEach((day, index) => {
            const dateObj = new Date(day + 'T00:00:00Z');
            const tab = document.createElement('div');
            tab.className = `date-tab ${index === 0 ? 'active' : ''}`;
            tab.textContent = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
            tab.dataset.tabId = day;
            dateTabsContainer.appendChild(tab);

            const content = document.createElement('div');
            content.className = `day-content ${index === 0 ? 'active' : ''}`;
            content.id = `day-${day}`;
            daysContentContainer.appendChild(content);

            const sortedMatches = matchesByDay[day].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
            renderMatchesForDay(content, sortedMatches);
        });

        dateTabsContainer.addEventListener('click', e => {
            if (!e.target.classList.contains('date-tab')) return;
            document.querySelectorAll('.date-tab.active, .day-content.active').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`day-${e.target.dataset.tabId}`).classList.add('active');
        });

        daysContentContainer.addEventListener('submit', handleFormSubmit);
        daysContentContainer.addEventListener('click', e => {
            if (e.target.classList.contains('toggle-comments-btn')) handleToggleComments(e.target);
        });
        
        loadUserPredictions();

    } catch (e) {
        console.error("Error rendering matches [initializeAppWithData]:", e);
        daysContentContainer.innerHTML = `<p class="text-center text-red-500 mt-8">حدث خطأ أثناء عرض بيانات المباريات.</p>`;
    }
}

function renderMatchesForDay(dayContainer, matches) {
    const numberMap = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    matches.forEach(match => {
        if (!match.id || !match.team1_name || !match.team2_name) { return; }
        
        const matchDate = new Date(match.datetime);
        const dateString = matchDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/[٠-٩]/g, c => numberMap[c]);
        const timeString = matchDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/[٠-٩]/g, c => numberMap[c]);
        const status = getMatchStatus(match.datetime);
        const statusClasses = { ended: 'ended', live: 'live', soon: 'soon' };
        const statusText = { ended: 'انتهت', live: 'مباشر', soon: 'بعد قليل' };
        const statusHTML = status.state in statusClasses
            ? `<span class="match-status ${statusClasses[status.state]}">${statusText[status.state]}</span>`
            : `<div class="match-time">${timeString}</div>`;
        const channels = (match.channels && match.channels.length > 0) ? match.channels.join(' / ') : "غير محددة";
        const isEnded = status.state === 'ended';
        
        const card = document.createElement('div');
        card.className = 'match-card';
        card.dataset.matchId = match.id;
        card.dataset.datetime = match.datetime;
        card.innerHTML = `
            <div class="match-header"><span class="match-league">${match.league || ''}</span><span class="match-date-time">${dateString}</span></div>
            <div class="match-body">
                <div class="teams-row">
                    <div class="team"><img src="${match.team1_logo || ''}" alt="${match.team1_name}"><span class="team-name">${match.team1_name}</span></div>
                    <div class="match-status-container">${statusHTML}</div>
                    <div class="team"><img src="${match.team2_logo || ''}" alt="${match.team2_name}"><span class="team-name">${match.team2_name}</span></div>
                </div>
                <form name="prediction-form" class="prediction-form ${isEnded ? 'disabled' : ''}">
                    <div class="form-group"><legend class="channel-info"><i class="fa-solid fa-tv"></i> <span>${channels}</span></legend></div>
                    <div class="form-group"><legend>توقع النتيجة:</legend>
                        <div class="prediction-options">
                            <input type="radio" name="winner" id="win1-${match.id}" value="${match.team1_name}" required><label for="win1-${match.id}">${match.team1_name}</label>
                            <input type="radio" name="winner" id="draw-${match.id}" value="تعادل"><label for="draw-${match.id}">تعادل</label>
                            <input type="radio" name="winner" id="win2-${match.id}" value="${match.team2_name}"><label for="win2-${match.id}">${match.team2_name}</label>
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
        dayContainer.appendChild(card);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!navigator.onLine) { showNotification('لا يمكن الإرسال وأنت غير متصل.'); return; }
    if (!currentUser) { showNotification('يجب تسجيل الدخول أولاً.'); document.getElementById('user-icon-btn').click(); return; }
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    const username = currentUser.user_metadata.username || currentUser.email.split('@')[0];

    try {
        if (form.name === 'prediction-form') {
            const winnerRadio = form.querySelector('input[name="winner"]:checked');
            if (!winnerRadio) throw new Error('الرجاء اختيار نتيجة المباراة.');
            
            const { error } = await supabaseClient.from('predictions').upsert({
                match_id: form.closest('.match-card').dataset.matchId,
                user_id: currentUser.id, username: username,
                predicted_winner: winnerRadio.value,
                predicted_scorer: form.querySelector('[name="scorer"]').value.trim()
            }, { onConflict: 'user_id, match_id' });

            if (error) throw error;
            submitBtn.innerHTML = 'تم الإرسال ✅';
            [...form.elements].forEach(el => el.disabled = true);
            triggerHapticFeedback();
        } else if (form.name === 'match-comment-form') {
            const commentText = form.querySelector('[name="comment_text"]').value.trim();
            if (!commentText) throw new Error("لا يمكن إرسال تعليق فارغ.");

            const { error } = await supabaseClient.from('comments').insert([{
                match_id: form.closest('.match-card').dataset.matchId,
                user_id: currentUser.id, author: username, comment_text: commentText
            }]);
            
            if (error) throw error;
            form.querySelector('[name="comment_text"]').value = '';
            triggerHapticFeedback('LIGHT');
        }
    } catch (error) {
        showNotification(error.message);
    } finally {
        if (!form.querySelector('.submit-btn').innerHTML.includes('✅')) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = form.name === 'prediction-form' ? 'إرسال التوقع' : 'إرسال';
        }
    }
}

async function handleToggleComments(button) {
    const commentsSection = button.nextElementSibling;
    const isHidden = commentsSection.style.display === 'none';
    commentsSection.style.display = isHidden ? 'block' : 'none';
    button.innerHTML = isHidden ? '💬 إخفاء التعليقات' : '💬 التعليقات';
    if (isHidden) {
        const matchId = button.closest('.match-card').dataset.matchId;
        await fetchAndRenderMatchComments(matchId, commentsSection.querySelector('.comment-list'));
    }
}

async function loadUserPredictions() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient.from('predictions').select('match_id, predicted_winner, predicted_scorer').eq('user_id', currentUser.id);
    if (error) { console.error("Error fetching user predictions:", error); return; }
    data.forEach(p => {
        const form = document.querySelector(`.match-card[data-match-id='${p.match_id}'] .prediction-form`);
        if (form) {
            const winnerRadio = form.querySelector(`input[value="${p.predicted_winner}"]`);
            if (winnerRadio) winnerRadio.checked = true;
            const scorerInput = form.querySelector('[name="scorer"]');
            if(scorerInput) scorerInput.value = p.predicted_scorer || '';
            [...form.elements].forEach(el => el.disabled = true);
            form.querySelector('.submit-btn').innerHTML = 'تم الإرسال ✅';
        }
    });
}

// ==========================================================
// SECTION 5: NEWS PAGE
// ==========================================================
async function initializeNewsPage() {
    const articlesGrid = document.getElementById('articles-grid');
    articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأخبار...</p>';
    try {
        const { data, error } = await supabaseClient.from('articles').select('id, title, image_url, content, created_at').order('created_at', { ascending: false });
        if (error && navigator.onLine) throw error;
        if (data && data.length > 0) {
            articlesCache = data;
            renderArticleCards(articlesCache);
        } else {
            articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full">لا توجد أخبار متاحة حالياً.</p>';
        }
    } catch (error) {
        console.error("Error fetching articles:", error);
        articlesGrid.innerHTML = `<p class="text-center text-red-500 col-span-full">فشل تحميل الأخبار. اسحب للأسفل للتحديث.</p>`;
    }
    const commentForm = document.getElementById('comment-form');
    if (commentForm) commentForm.addEventListener('submit', handleNewsCommentSubmit);
}

function renderArticleCards(articles) {
    const articlesGrid = document.getElementById('articles-grid');
    articlesGrid.innerHTML = '';
    if (!articles || articles.length === 0) { articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full">لا توجد أخبار متاحة.</p>'; return; }
    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.innerHTML = `
            <img src="${article.image_url}" alt="${article.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="image-placeholder" style="display: none;"><i class="fa-regular fa-image"></i></div>
            <div class="article-title"><h3>${article.title}</h3></div>`;
        card.addEventListener('click', () => renderArticleDetail(article.id));
        articlesGrid.appendChild(card);
    });
}

function renderArticleDetail(articleId) {
    const article = articlesCache.find(a => a.id === articleId);
    if (!article) return;
    document.getElementById('article-id-hidden-input').value = article.id;
    const articleContentDiv = document.getElementById('article-content');
    articleContentDiv.innerHTML = `
        <div id="article-header" class="mb-4">
            <h1 class="text-2xl md:text-3xl font-bold leading-tight">${article.title}</h1>
            <div class="mt-3 flex items-center justify-between">
                <span class="text-sm text-gray-400">${new Date(article.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</span>
                <button id="share-article-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition hover:bg-blue-700">
                    <i class="fa-solid fa-share-nodes"></i><span>مشاركة</span>
                </button>
            </div>
        </div>
        <img src="${article.image_url}" alt="${article.title}" class="w-full h-auto max-h-96 object-cover rounded-lg mb-6" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="image-placeholder" style="display: none; height: 250px;"><i class="fa-regular fa-image"></i></div>
        <div class="prose prose-invert max-w-none text-lg leading-relaxed text-gray-300">${article.content}</div>`;
    navigateToSubPage('article');
    fetchAndRenderNewsComments(article.id);
    document.getElementById('share-article-btn').addEventListener('click', () => {
        const articleUrl = `${window.location.origin}/article/${article.id}`;
        shareContent(article.title, `اقرأ هذا المقال: ${article.title}`, articleUrl);
    });
}

async function handleNewsCommentSubmit(event) {
    event.preventDefault();
    if (!navigator.onLine) { showNotification('لا يمكن الإرسال وأنت غير متصل.'); return; }
    const submitBtn = document.getElementById('submit-comment-btn');
    if (!currentUser) { showNotification('يجب تسجيل الدخول أولاً.'); document.getElementById('user-icon-btn').click(); return; }
    submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جار الإرسال...';
    
    try {
        const commentText = document.getElementById('comment-text').value.trim();
        if (!commentText) throw new Error("لا يمكن إرسال تعليق فارغ.");
        const { error } = await supabaseClient.from('news_comments').insert([{
            article_id: document.getElementById('article-id-hidden-input').value,
            user_id: currentUser.id,
            author: currentUser.user_metadata.username || currentUser.email.split('@')[0],
            comment_text: commentText
        }]);
        if (error) throw error;
        document.getElementById('comment-text').value = '';
        triggerHapticFeedback();
    } catch(err) {
        showNotification(err.message);
    } finally {
        submitBtn.disabled = false; submitBtn.textContent = 'إرسال التعليق';
    }
}

// ==========================================================
// SECTION 6: COMMENTS RENDERING & MANAGEMENT
// ==========================================================
function refreshVisibleComments() {
    document.querySelectorAll('.comments-section').forEach(section => {
        if (section.style.display === 'block') {
            const matchId = section.closest('.match-card')?.dataset.matchId;
            if (matchId) {
                fetchAndRenderMatchComments(matchId, section.querySelector('.comment-list'));
            }
        }
    });
    const articlePage = document.getElementById('article-page');
    if (articlePage && (!articlePage.style.transform || !articlePage.style.transform.includes('100'))) {
        const articleId = document.getElementById('article-id-hidden-input').value;
        if (articleId) fetchAndRenderNewsComments(articleId);
    }
}

async function fetchAndRenderMatchComments(matchId, listElement) {
    if (!listElement) return;
    listElement.innerHTML = '<p class="text-center text-gray-500 my-2">جاري تحميل التعليقات...</p>';
    try {
        const { data, error } = await supabaseClient.from('comments').select('id, author, comment_text, created_at, user_id').eq('match_id', matchId).order('created_at', { ascending: true });
        if (error) throw error;
        renderComments(listElement, data, 'comments');
    } catch (e) { listElement.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'; }
}

async function fetchAndRenderNewsComments(articleId) {
    const commentsListDiv = document.getElementById('comments-list');
    if (!commentsListDiv) return;
    commentsListDiv.innerHTML = '<p class="text-center text-gray-400 my-2">جاري تحميل التعليقات...</p>';
    try {
        const { data, error } = await supabaseClient.from('news_comments').select('id, author, comment_text, created_at, user_id').eq('article_id', articleId).order('created_at', { ascending: true });
        if (error) throw error;
        renderComments(commentsListDiv, data, 'news_comments');
    } catch (err) { commentsListDiv.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'; }
}

function renderComments(container, commentsData, tableName) {
    container.innerHTML = '';
    if (commentsData.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
        return;
    }

    commentsData.forEach(comment => {
        const commentEl = document.createElement('div');
        commentEl.className = tableName === 'comments' ? 'comment' : 'comment-item';
        if (comment.author === 'المدير') commentEl.classList.add('admin-reply');
        commentEl.dataset.commentId = comment.id;

        const authorHTML = `<span class="comment-author">${comment.author}</span>`;
        const textHTML = `<p class="${tableName === 'comments' ? 'comment-text' : 'comment-body'}">${comment.comment_text}</p>`;
        const deleteBtnHTML = (currentUser && currentUser.id === comment.user_id) ? `<button class="delete-comment-btn" data-comment-id="${comment.id}" data-table-name="${tableName}"><i class="fa-solid fa-trash-can"></i></button>` : '';

        if (tableName === 'comments') {
            commentEl.innerHTML = `
                <div class="comment-avatar"><i class="fa-solid fa-${comment.author === 'المدير' ? 'user-shield' : 'user'}"></i></div>
                <div class="comment-body">${authorHTML}${textHTML}</div>
                ${deleteBtnHTML}`;
        } else {
            const dateString = new Date(comment.created_at).toLocaleDateString('ar-EG');
            commentEl.innerHTML = `
                <div class="comment-header">${authorHTML}<span class="comment-date text-xs">${dateString}</span></div>
                ${textHTML}
                ${deleteBtnHTML}`;
        }
        container.appendChild(commentEl);
    });
}

// ==========================================================
// SECTION 7: PROFILE PAGE
// ==========================================================
function initializeProfilePageListeners() {
    document.getElementById('open-profile-btn')?.addEventListener('click', openProfilePage);
    document.getElementById('close-profile-btn')?.addEventListener('click', closeProfilePage);
    document.getElementById('save-username-btn')?.addEventListener('click', handleUpdateUsername);
}

function openProfilePage() {
    if (!currentUser) return;
    document.getElementById('auth-modal')?.classList.remove('show');
    const profilePage = document.getElementById('profile-page');
    if (profilePage) {
        profilePage.classList.remove('hidden');
        setTimeout(() => profilePage.classList.add('is-visible'), 10);
        loadProfileData();
    }
}

function closeProfilePage() {
    const profilePage = document.getElementById('profile-page');
    if (profilePage) {
        profilePage.classList.remove('is-visible');
        profilePage.addEventListener('transitionend', () => profilePage.classList.add('hidden'), { once: true });
    }
}

async function loadProfileData() {
    if (!currentUser) return;
    document.getElementById('profile-username-input').value = currentUser.user_metadata.username || '';
    document.getElementById('username-status').textContent = '';
    fetchAndRenderProfilePredictions();
    fetchAndRenderProfileComments();
}

async function fetchAndRenderProfilePredictions() {
    const listDiv = document.getElementById('profile-predictions-list');
    listDiv.innerHTML = '<p class="text-gray-400">جاري تحميل التوقعات...</p>';
    const { data, error } = await supabaseClient.from('predictions').select('predicted_winner, predicted_scorer, matches ( team1_name, team2_name, actual_winner )').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (error) { listDiv.innerHTML = '<p class="text-red-500">فشل تحميل التوقعات.</p>'; return; }
    if (data.length === 0) { listDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي توقعات بعد.</p>'; return; }
    listDiv.innerHTML = data.map(p => {
        if (!p.matches) return '';
        const isCorrect = p.predicted_winner === p.matches.actual_winner;
        const resultClass = p.matches.actual_winner ? (isCorrect ? 'correct' : 'incorrect') : 'pending';
        const resultText = p.matches.actual_winner ? (isCorrect ? 'توقع صحيح' : `خاطئ (الفائز: ${p.matches.actual_winner})`) : 'قيد الانتظار';
        return `<div class="profile-prediction-item ${resultClass}">
            <div class="prediction-match-info"><span>${p.matches.team1_name} ضد ${p.matches.team2_name}</span><span class="prediction-status">${resultText}</span></div>
            <div class="prediction-details">توقعت فوز: <strong>${p.predicted_winner}</strong>${p.predicted_scorer ? ` | ومسجل: <strong>${p.predicted_scorer}</strong>` : ''}</div>
        </div>`;
    }).join('');
}

async function fetchAndRenderProfileComments() {
    const listDiv = document.getElementById('profile-comments-list');
    listDiv.innerHTML = '<p class="text-gray-400">جاري تحميل التعليقات...</p>';
    const [matchComments, newsComments] = await Promise.all([
        supabaseClient.from('comments').select('id, comment_text, created_at, matches(team1_name, team2_name)').eq('user_id', currentUser.id),
        supabaseClient.from('news_comments').select('id, comment_text, created_at, articles(title)').eq('user_id', currentUser.id)
    ]);
    if (matchComments.error || newsComments.error) { listDiv.innerHTML = '<p class="text-red-500">فشل تحميل التعليقات.</p>'; return; }
    const allComments = [
        ...matchComments.data.map(c => ({ ...c, type: 'match', tableName: 'comments' })),
        ...newsComments.data.map(c => ({ ...c, type: 'news', tableName: 'news_comments' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (allComments.length === 0) { listDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي تعليقات بعد.</p>'; return; }
    listDiv.innerHTML = allComments.map(c => {
        const context = c.type === 'match'
            ? (c.matches ? `مباراة ${c.matches.team1_name} ضد ${c.matches.team2_name}` : 'مباراة')
            : (c.articles ? `مقال "${c.articles.title}"` : 'مقال');
        return `<div class="profile-comment-item" id="profile-comment-${c.id}-${c.tableName}">
            <div class="comment-content"><span class="comment-text">${c.comment_text}</span><span class="comment-meta">عن: ${context}</span></div>
            <button class="delete-comment-btn-profile" data-comment-id="${c.id}" data-table-name="${c.tableName}">حذف</button>
        </div>`;
    }).join('');
}

async function handleUpdateUsername(e) {
    if (!navigator.onLine) { showNotification('لا يمكن التحديث وأنت غير متصل.'); return; }
    const btn = e.target;
    const usernameInput = document.getElementById('profile-username-input');
    const statusP = document.getElementById('username-status');
    const newUsername = usernameInput.value.trim();
    if (newUsername.length < 3) { statusP.textContent = 'الاسم يجب أن يكون 3 أحرف على الأقل.'; return; }
    btn.disabled = true; btn.textContent = '...';
    const { error } = await supabaseClient.auth.updateUser({ data: { username: newUsername } });
    if (error) {
        statusP.textContent = `خطأ: ${error.message}`;
    } else {
        statusP.textContent = 'تم حفظ الاسم بنجاح!';
        currentUser.user_metadata.username = newUsername;
    }
    btn.disabled = false; btn.textContent = 'حفظ';
}

// ==========================================================
// SECTION 8: NATIVE & REALTIME
// ==========================================================
async function registerPushNotifications() {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform() || !window.Capacitor.Plugins.PushNotifications) return;
  const { PushNotifications } = window.Capacitor.Plugins;
  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') return;
    await PushNotifications.register();
    PushNotifications.addListener('registration', async token => {
      if (currentUser) {
        await supabaseClient.from('fcm_tokens').upsert({ user_id: currentUser.id, token: token.value }, { onConflict: 'token' });
      }
    });
    PushNotifications.addListener('pushNotificationReceived', notification => {
        alert('إشعار جديد: ' + (notification.title || '') + "\n" + (notification.body || ''));
    });
  } catch(e) { console.error("Error registering push notifications:", e); }
}

function initializePullToRefresh() {
    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh-indicator-fixed';
    document.body.appendChild(indicator);
    const refreshFuncs = {
        'predictions-page': initializePredictionsPage,
        'home-page': initializeNewsPage,
        'article-page': () => {
            const articleId = document.getElementById('article-id-hidden-input').value;
            if (articleId) fetchAndRenderNewsComments(articleId);
        }
    };
    const pages = Object.keys(refreshFuncs).map(id => document.getElementById(id)).filter(Boolean);
    let startY = 0, isPulling = false, isRefreshing = false;
    pages.forEach(pageEl => {
        pageEl.addEventListener('touchstart', e => {
            if (pageEl.scrollTop === 0 && !isRefreshing) { isPulling = true; startY = e.touches[0].clientY; }
        }, { passive: true });
        pageEl.addEventListener('touchmove', e => {
            if (!isPulling || isRefreshing || pageEl.scrollTop !== 0) { isPulling = false; return; }
            const diff = e.touches[0].clientY - startY;
            if (diff > 0) {
                e.preventDefault();
                indicator.style.display = 'flex';
                const pullRatio = Math.min(diff / 80, 1);
                indicator.style.opacity = pullRatio;
                indicator.style.transform = `translateY(${Math.min(diff, 100)}px) scale(${pullRatio})`;
                indicator.innerHTML = diff > 80 ? '<i class="fas fa-redo"></i>' : '<i class="fas fa-arrow-down"></i>';
            } else { isPulling = false; }
        }, { passive: false });
        pageEl.addEventListener('touchend', async e => {
            if (!isPulling || isRefreshing) return;
            const diff = e.changedTouches[0].clientY - startY;
            isPulling = false;
            indicator.style.transition = 'opacity 0.3s, transform 0.3s';
            indicator.style.opacity = 0; indicator.style.transform = 'translateY(0) scale(0)';
            if (diff > 80) {
                isRefreshing = true;
                indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                indicator.style.opacity = 1; indicator.style.transform = `translateY(30px) scale(1)`;
                triggerHapticFeedback('MEDIUM');
                try { await refreshFuncs[pageEl.id](); }
                catch(err) { console.error("Refresh failed:", err); }
                finally { setTimeout(() => { indicator.style.display = 'none'; indicator.style.transition = ''; isRefreshing = false; }, 300); }
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
        if (profilePage && profilePage.classList.contains('is-visible')) { closeProfilePage(); return; }
        if (authModal && authModal.classList.contains('show')) { authModal.classList.remove('show'); return; }
        if (newsPage && !newsPage.classList.contains('hidden')) {
            if (currentNewsSubPage === 'article') { navigateToSubPage('home'); return; }
            document.getElementById('nav-predictions-btn').click(); return;
        }
        if (exitToast && !exitToast.classList.contains('show')) {
            exitToast.classList.add('show');
            setTimeout(() => exitToast.classList.remove('show'), 2000);
        } else {
            App.exitApp();
        }
    });
}

function initializeRealtimeListeners() {
    const handleRealtimeChange = (payload) => {
        if ((payload.table === 'matches' || payload.table === 'articles') && payload.eventType !== 'DELETE') {
            showNotification(`📢 تم تحديث قائمة ${payload.table === 'matches' ? 'المباريات' : 'الأخبار'}!`);
            if (payload.table === 'matches') initializePredictionsPage(); else initializeNewsPage();
        } else if (payload.table === 'comments' || payload.table === 'news_comments') {
            refreshVisibleComments();
        }
    };
    supabaseClient.channel('public-dynamic-content')
        .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeChange)
        .subscribe();
}
