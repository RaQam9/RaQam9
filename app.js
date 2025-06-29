// ==========================================================
// SECTION 0: GLOBAL SETUP (Supabase, Constants & Page Switching)
// ==========================================================
const SUPABASE_URL = 'https://uxtxavurcgdeueeemmdi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dHhhdnVyY2dkZXVlZWVtbWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjQ4NzYsImV4cCI6MjA2NjYwMDg3Nn0.j7MrIoGzbzjurKyWGN0GgpMBIzl5exOsZrYlKCSmNbk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_EMAIL = "your-email@example.com"; // <-- !! غير هذا إلى بريدك الإلكتروني
const HOST_EMAIL = "host@example.com"; // --!!-- قم بتغيير هذا البريد لبريد المستضيف --!!--

let currentUser = null;

// Main entry point for the application
document.addEventListener('DOMContentLoaded', () => {
    // Page switching setup
    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');
    predictionsBtn.addEventListener('click', () => switchPage('predictions'));
    newsBtn.addEventListener('click', () => switchPage('news'));

    // Initialize all application modules
    initializeAuth();
    initializePredictionsPage();
    initializeNewsPage();
    initializeRealtimeListeners();
    initializeGlobalEventListeners();
    initializeProfilePageListeners(); // Initialize profile page functionality
});

function switchPage(pageToShow) {
    const predictionsPage = document.getElementById('predictions-page');
    const newsPage = document.getElementById('news-page');
    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');

    if (typeof gtag !== 'undefined') { gtag('event', 'select_content', { 'content_type': 'tab', 'item_id': pageToShow }); }
    
    const isPredictions = pageToShow === 'predictions';
    predictionsPage.classList.toggle('hidden', !isPredictions);
    newsPage.classList.toggle('hidden', isPredictions);
    
    predictionsBtn.classList.toggle('bg-blue-600', isPredictions);
    predictionsBtn.classList.toggle('text-white', isPredictions);
    predictionsBtn.classList.toggle('text-gray-400', !isPredictions);

    newsBtn.classList.toggle('bg-blue-600', !isPredictions);
    newsBtn.classList.toggle('text-white', !isPredictions);
    newsBtn.classList.toggle('text-gray-400', isPredictions);
}


// ==========================================================
// SECTION 0.5: AUTHENTICATION LOGIC
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
            document.getElementById('user-email-display').textContent = `أنت مسجل الدخول بـ: ${currentUser.email}`;
            showView(loggedinView);
        } else {
            showView(loginView);
        }
        openAuthModal();
    });

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
        if (error) {
            authMessage.textContent = `خطأ: ${error.message}`;
        } else {
            authMessage.textContent = 'تم إنشاء الحساب بنجاح! يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.';
            signupForm.reset();
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        authMessage.textContent = 'جاري تسجيل الدخول...';
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            authMessage.textContent = `خطأ: ${error.message}`;
        } else {
            authMessage.textContent = 'تم تسجيل الدخول بنجاح!';
            loginForm.reset();
            setTimeout(closeAuthModal, 1000);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        authMessage.textContent = 'جاري تسجيل الخروج...';
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            authMessage.textContent = `خطأ: ${error.message}`;
        } else {
            authMessage.textContent = '';
            closeAuthModal();
        }
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
        const userIcon = document.getElementById('user-icon-btn');
        if (event === 'SIGNED_IN' || event === "INITIAL_SESSION") {
            currentUser = session.user;
            userIcon.classList.add('logged-in');
            userIcon.innerHTML = `<i class="fa-solid fa-user-check"></i>`;
            loadUserPredictions();
            refreshVisibleComments();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            userIcon.classList.remove('logged-in');
            userIcon.innerHTML = `<i class="fa-solid fa-user-pen"></i>`;
            resetUIOnLogout();
            refreshVisibleComments();
        }
    });
}

function refreshVisibleComments() {
    document.querySelectorAll('.comments-section:not([style*="display:none"]):not([style*="display: none"]) .comment-list').forEach(listElement => {
        const matchCard = listElement.closest('.match-card');
        if (matchCard) {
            const matchId = matchCard.dataset.matchId;
            fetchAndRenderMatchComments(matchId, listElement);
        }
    });
    
    const articlePage = document.getElementById('article-page');
    if (articlePage.style.transform === 'translateX(0px)') {
        const articleId = document.getElementById('article-id-hidden-input').value;
        if (articleId) fetchAndRenderNewsComments(articleId);
    }
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
            form.querySelector('.scorer-input').value = p.predicted_scorer;
            [...form.elements].forEach(el => el.disabled = true);
            form.querySelector('.submit-btn').innerHTML = 'تم الإرسال ✅';
        }
    });
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


// ======================================================================
// SECTION 1: PREDICTIONS PAGE LOGIC
// ======================================================================
async function initializePredictionsPage() {
    try {
        const container = document.getElementById('matches-container');
        container.innerHTML = '<p class="text-center text-gray-400 mt-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i> جاري تحميل المباريات...</p>';
        const { data, error } = await supabaseClient.from('matches').select('*').order('datetime', { ascending: true });
        if (error) throw error;
        const formattedMatches = data.map(match => ({ id: match.id, team1: { name: match.team1_name, logo: match.team1_logo }, team2: { name: match.team2_name, logo: match.team2_logo }, league: match.league, datetime: match.datetime, channels: match.channels || [] }));
        document.getElementById('matches-container').innerHTML = `<div class="date-tabs-container" id="date-tabs"></div><div id="days-content-container"></div>`;
        initializeAppWithData(formattedMatches);
    } catch (error) {
        console.error("An error occurred:", error);
        document.getElementById('matches-container').innerHTML = '<p class="text-center text-red-500 mt-8">فشل تحميل المباريات. يرجى المحاولة مرة أخرى لاحقًا.</p>';
    }
}

function initializeAppWithData(matchesData) {
    const tickerMessages = ["🏆 سيتم تكريم أفضل المتوقعين في نهاية كل أسبوع!", "💡 سجل دخولك للمشاركة في السحب.", "🔥 تابعونا في تغطية خاصة لمباريات كأس العالم للأندية."];
    const dateTabsContainer = document.getElementById('date-tabs');
    const daysContentContainer = document.getElementById('days-content-container');

    function renderMatchesForDay(dayContainer, matches) {
        dayContainer.innerHTML = '';
        if (!matches || matches.length === 0) return;
        
        const numMap = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
        const replaceNumerals = (str) => str.replace(/[٠-٩]/g, c => numMap[c]);

        matches.forEach(match => {
            const matchDate = new Date(match.datetime);
            const dateString = replaceNumerals(matchDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }));
            const timeString = replaceNumerals(matchDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }));
            const status = getMatchStatus(match.datetime);
            const isEnded = status.state === 'ended';
            
            let statusHtml;
            switch (status.state) {
                case 'ended': statusHtml = `<span class="match-status ended">انتهت</span>`; break;
                case 'live': statusHtml = `<span class="match-status live">مباشر</span>`; break;
                case 'soon': statusHtml = `<span class="match-status soon">بعد قليل</span>`; break;
                default: statusHtml = `<div class="match-time">${timeString}</div>`;
            }

            const channels = (match.channels && match.channels.length > 0) ? match.channels.join(' / ') : "غير محددة";

            const matchCard = document.createElement('div');
            matchCard.className = 'match-card';
            matchCard.dataset.matchId = match.id;
            matchCard.dataset.datetime = match.datetime;
            matchCard.innerHTML = `
                <div class="match-header"><span class="match-league">${match.league}</span><span class="match-date-time">${dateString}</span></div>
                <div class="match-body">
                    <div class="teams-row">
                        <div class="team"><img src="${match.team1.logo}" alt="${match.team1.name}"><span class="team-name">${match.team1.name}</span></div>
                        <div class="match-status-container">${statusHtml}</div>
                        <div class="team"><img src="${match.team2.logo}" alt="${match.team2.name}"><span class="team-name">${match.team2.name}</span></div>
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
            dayContainer.appendChild(matchCard);
        });
    }
    
    function attachTabEventListeners() {
        dateTabsContainer.addEventListener('click', (e) => {
            if (!e.target.classList.contains('date-tab')) return;
            const tabId = e.target.dataset.tabId;
            document.querySelectorAll('.date-tab').forEach(tab => tab.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('.day-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`day-${tabId}`).classList.add('active');
        });
    }

    function attachMatchEventListeners() {
        daysContentContainer.addEventListener('submit', e => {
            e.preventDefault();
            if (e.target.matches('.prediction-form, .comment-form')) {
                handleFormSubmit(e.target);
            }
        });
        daysContentContainer.addEventListener('click', e => {
            if (e.target.classList.contains('toggle-comments-btn')) {
                handleToggleComments(e.target);
            }
        });
        document.getElementById('dismiss-icon-btn').addEventListener('click', () => {
            document.getElementById('floating-icon-container').classList.add('hidden');
            sessionStorage.setItem('isIconDismissed', 'true');
        });
    }
    
    async function handleFormSubmit(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!currentUser) {
            alert('الرجاء تسجيل الدخول أولاً للمشاركة.');
            document.getElementById('user-icon-btn').click();
            return;
        }
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
        submitBtn.disabled = true;
        const username = currentUser.user_metadata.username || currentUser.email;

        if (form.name === 'prediction-form') {
            const matchId = form.closest('.match-card').dataset.matchId;
            const winnerRadio = form.querySelector('input[name="winner"]:checked');
            if (!winnerRadio) {
                alert('الرجاء اختيار نتيجة المباراة.');
                submitBtn.innerHTML = 'إرسال التوقع';
                submitBtn.disabled = false;
                return;
            }
            const predictionData = { match_id: parseInt(matchId), user_id: currentUser.id, user_email: currentUser.email, username: username, predicted_winner: winnerRadio.value, predicted_scorer: form.querySelector('input[name="scorer"]').value.trim() };
            try {
                const { error } = await supabaseClient.from('predictions').upsert(predictionData, { onConflict: 'user_id, match_id' });
                if (error) throw error;
                submitBtn.innerHTML = `تم الإرسال ✅`;
                [...form.elements].forEach(el => el.disabled = true);
            } catch (error) {
                console.error('Error submitting prediction:', error);
                alert('حدث خطأ أثناء إرسال توقعك.');
                submitBtn.innerHTML = 'إرسال التوقع';
                submitBtn.disabled = false;
            }
        } else if (form.name === 'match-comment-form') {
            const matchId = form.closest('.match-card').dataset.matchId;
            const commentText = form.querySelector('textarea').value.trim();
            if (!commentText) {
                alert("لا يمكن إرسال تعليق فارغ.");
                submitBtn.innerHTML = "إرسال";
                submitBtn.disabled = false;
                return;
            }
            try {
                const { error } = await supabaseClient.from('comments').insert([{ match_id: parseInt(matchId), user_id: currentUser.id, author: username, comment_text: commentText }]);
                if (error) throw error;
                form.querySelector('textarea').value = '';
            } catch (error) {
                alert('حدث خطأ أثناء إرسال تعليقك.');
            } finally {
                submitBtn.innerHTML = "إرسال";
                submitBtn.disabled = false;
            }
        }
    }

    async function handleToggleComments(button) {
        const commentsSection = button.nextElementSibling;
        const isHidden = commentsSection.style.display === 'none' || !commentsSection.style.display;
        if (isHidden) {
            const listElement = commentsSection.querySelector('.comment-list');
            const matchId = button.closest('.match-card').dataset.matchId;
            commentsSection.style.display = 'block';
            button.innerHTML = '💬 إخفاء التعليقات';
            await fetchAndRenderMatchComments(matchId, listElement);
        } else {
            commentsSection.style.display = 'none';
            button.innerHTML = '💬 التعليقات';
        }
    }
    
    // --- Ticker, Date Grouping and Rendering Logic ---
    document.getElementById('predictions-ticker-content').innerHTML = tickerMessages.map(m => `<span class="ticker-item">${m}</span>`).join('');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchesByDay = matchesData
        .filter(m => new Date(m.datetime) >= today)
        .reduce((acc, m) => {
            const day = new Date(m.datetime).toLocaleDateString('fr-CA');
            if (!acc[day]) acc[day] = [];
            acc[day].push(m);
            return acc;
        }, {});

    if (Object.keys(matchesByDay).length === 0) {
        daysContentContainer.innerHTML = `<p class="text-center text-gray-400 mt-8">لا توجد مباريات قادمة.</p>`;
    } else {
        const sortedDays = Object.keys(matchesByDay).sort();
        const numMap = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
        
        sortedDays.forEach((day, index) => {
            const dateObj = new Date(day + 'T00:00:00Z');
            const tabText = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }).replace(/[٠-٩]/g, c => numMap[c]);
            const tabEl = document.createElement('div');
            tabEl.className = `date-tab ${index === 0 ? 'active' : ''}`;
            tabEl.textContent = tabText;
            tabEl.dataset.tabId = day;
            dateTabsContainer.appendChild(tabEl);

            const dayContentEl = document.createElement('div');
            dayContentEl.className = `day-content ${index === 0 ? 'active' : ''}`;
            dayContentEl.id = `day-${day}`;
            daysContentContainer.appendChild(dayContentEl);

            const statusOrder = { 'live': 1, 'soon': 2, 'scheduled': 3, 'ended': 4 };
            const sortedMatches = matchesByDay[day].sort((a, b) => {
                const statusA = getMatchStatus(a.datetime).state;
                const statusB = getMatchStatus(b.datetime).state;
                if (statusOrder[statusA] !== statusOrder[statusB]) return statusOrder[statusA] - statusOrder[statusB];
                return new Date(a.datetime) - new Date(b.datetime);
            });
            renderMatchesForDay(dayContentEl, sortedMatches);
        });
    }
    
    attachTabEventListeners();
    attachMatchEventListeners();
    loadUserPredictions();
}

function getMatchStatus(datetime) {
    const matchTime = new Date(datetime);
    const now = new Date();
    const diffMinutes = (matchTime.getTime() - now.getTime()) / 60000;
    if (diffMinutes < -125) return { state: 'ended' };
    if (diffMinutes <= 0) return { state: 'live' };
    if (diffMinutes <= 5) return { state: 'soon' };
    return { state: 'scheduled' };
}


// ==========================================================
// SECTION 2: NEWS PAGE LOGIC
// ==========================================================
function initializeNewsPage() {
    const articlesGrid = document.getElementById('articles-grid');
    const articleContent = document.getElementById('article-content');
    const newsHomePage = document.getElementById('home-page');
    const newsArticlePage = document.getElementById('article-page');
    const exitToast = document.getElementById('exit-toast');
    const commentForm = document.getElementById('comment-form');
    let articlesCache = [];
    let currentNewsSubPage = 'home';
    let firstBackPressTime = 0;

    async function fetchArticlesFromDB() {
        articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأخبار...</p>';
        const { data, error } = await supabaseClient.from('articles').select('id, title, image_url, content').order('created_at', { ascending: false });
        if (error) { console.error("Supabase error:", error); articlesGrid.innerHTML = `<p class="text-center text-red-500 col-span-full">فشل تحميل الأخبار.</p>`; return null; }
        return data;
    }

    function renderArticleCards(articles) {
        articlesGrid.innerHTML = '';
        if (!articles || articles.length === 0) {
            articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full">لا توجد أخبار متاحة حالياً.</p>';
            return;
        }
        articles.forEach(article => {
            const card = document.createElement('div');
            card.className = 'article-card';
            card.innerHTML = `<img src="${article.image_url}" alt="${article.title}"><div class="article-title"><h3>${article.title}</h3></div>`;
            card.addEventListener('click', () => renderArticleDetail(article.id));
            articlesGrid.appendChild(card);
        });
    }

    function renderArticleDetail(articleId) {
        const article = articlesCache.find(a => a.id === articleId);
        if (!article) return;
        document.getElementById('article-id-hidden-input').value = article.id;
        articleContent.innerHTML = `<div id="article-header"><h1>${article.title}</h1></div><img src="${article.image_url}" alt="${article.title}"><div>${article.content}</div>`;
        navigateToSubPage('article');
        fetchAndRenderNewsComments(article.id);
    }

    function navigateToSubPage(pageName) {
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

    async function start() {
        const fetchedArticles = await fetchArticlesFromDB();
        if (fetchedArticles) {
            articlesCache = fetchedArticles;
            renderArticleCards(articlesCache);
        }
    }

    commentForm.addEventListener('submit', handleNewsCommentSubmit);
    
    // Back button handling
    document.addEventListener('backbutton', (e) => {
        e.preventDefault();
        if (document.getElementById('news-page').classList.contains('hidden')) return;
        if (currentNewsSubPage === 'article') {
            navigateToSubPage('home');
        } else {
            if (new Date().getTime() - firstBackPressTime < 2000) {
                if (navigator.app && navigator.app.exitApp) navigator.app.exitApp();
            } else {
                firstBackPressTime = new Date().getTime();
                exitToast.classList.add('show');
                setTimeout(() => { exitToast.classList.remove('show'); }, 2000);
            }
        }
    }, false);

    // Swipe gesture for back navigation
    let touchStartX = 0;
    newsArticlePage.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    newsArticlePage.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        if (touchEndX > touchStartX && (touchEndX - touchStartX > 50)) {
            if (currentNewsSubPage === 'article') navigateToSubPage('home');
        }
    }, { passive: true });

    start();
}

async function handleNewsCommentSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('submit-comment-btn');
    if (!currentUser) { alert('يجب تسجيل الدخول أولاً للتعليق.'); document.getElementById('user-icon-btn').click(); return; }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جار الإرسال...';
    const articleId = document.getElementById('article-id-hidden-input').value;
    const commentText = document.getElementById('comment-text').value.trim();
    if (!commentText) {
        alert('لا يمكن إرسال تعليق فارغ.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'إرسال التعليق';
        return;
    }
    try {
        const { error } = await supabaseClient.from('news_comments').insert([{ article_id: parseInt(articleId), user_id: currentUser.id, author: currentUser.user_metadata.username || currentUser.email, comment_text: commentText }]);
        if (error) throw error;
        document.getElementById('comment-text').value = '';
    } catch (error) {
        console.error('Error submitting news comment:', error);
        alert(`حدث خطأ أثناء إرسال تعليقك: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'إرسال التعليق';
    }
}


// ==========================================================
// SECTION 3: REALTIME & GLOBAL COMMENTS
// ==========================================================
async function fetchAndRenderMatchComments(matchId, listElement) {
    listElement.innerHTML = '<p class="text-center text-gray-500 my-2">جاري تحميل التعليقات...</p>';
    try {
        const { data, error } = await supabaseClient.from('comments').select('id, author, comment_text, created_at, user_id').eq('match_id', matchId).order('created_at', { ascending: true });
        if (error) throw error;
        listElement.innerHTML = '';
        if (data.length === 0) {
            listElement.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
        } else {
            data.forEach(comment => addCommentToDOM(listElement, comment, 'comments'));
        }
    } catch (e) { console.error("Error fetching comments:", e); listElement.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'; }
}

async function fetchAndRenderNewsComments(articleId) {
    const commentsListDiv = document.getElementById('comments-list');
    if (!commentsListDiv) return;
    commentsListDiv.innerHTML = '<p class="text-center text-gray-400 my-2">جاري تحميل التعليقات...</p>';
    try {
        const { data, error } = await supabaseClient.from('news_comments').select('id, author, comment_text, created_at, user_id').eq('article_id', articleId).order('created_at', { ascending: true });
        if (error) throw error;
        commentsListDiv.innerHTML = '';
        if (data.length === 0) {
            commentsListDiv.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
        } else {
            data.forEach(comment => addNewsCommentToDOM(commentsListDiv, comment));
        }
    } catch (err) {
        console.error('Error fetching news comments:', err);
        commentsListDiv.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>';
    }
}

function addCommentToDOM(listElement, commentData, tableName) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    commentDiv.dataset.commentId = commentData.id;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'comment-avatar';
    avatarDiv.innerHTML = '<i class="fa-solid fa-user"></i>';

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'comment-body';
    bodyDiv.innerHTML = `<span class="comment-author">${commentData.author}</span><p class="comment-text">${commentData.comment_text}</p>`;
    
    commentDiv.append(avatarDiv, bodyDiv);

    if (currentUser && currentUser.id === commentData.user_id) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-comment-btn';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.dataset.commentId = commentData.id;
        deleteBtn.dataset.tableName = tableName;
        commentDiv.appendChild(deleteBtn);
    }
    listElement.appendChild(commentDiv);
    listElement.scrollTop = listElement.scrollHeight;
}

function addNewsCommentToDOM(listElement, comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item';
    commentEl.dataset.commentId = comment.id;

    commentEl.innerHTML = `
        <div class="comment-header">
            <span class="comment-author">${comment.author}</span>
            <span class="comment-date" style="font-size: 0.8rem;">${new Date(comment.created_at).toLocaleDateString('ar-EG')}</span>
        </div>
        <p class="comment-body">${comment.comment_text}</p>
    `;

    if (currentUser && currentUser.id === comment.user_id) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-comment-btn';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.dataset.commentId = comment.id;
        deleteBtn.dataset.tableName = 'news_comments';
        commentEl.appendChild(deleteBtn);
    }
    listElement.appendChild(commentEl);
}

function showNotification(message) {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function initializeRealtimeListeners() {
    const handleRealtimeChange = (payload) => {
        if (payload.table === 'matches' || payload.table === 'articles') {
            const pageName = payload.table === 'matches' ? 'المباريات' : 'الأخبار';
            showNotification(`📢 تم تحديث قائمة ${pageName}!`);
            if (payload.table === 'matches') initializePredictionsPage();
            else initializeNewsPage();
        } else if (payload.table === 'comments') {
            const listElement = document.querySelector(`.match-card[data-match-id='${payload.new?.match_id}'] .comment-list`);
            if (listElement) fetchAndRenderMatchComments(payload.new.match_id, listElement);
        } else if (payload.table === 'news_comments') {
            const articleIdOnPage = document.getElementById('article-id-hidden-input').value;
            if (articleIdOnPage && parseInt(articleIdOnPage) === payload.new?.article_id) {
                if (payload.eventType === 'INSERT') showNotification('💬 تم إضافة تعليق جديد!');
                fetchAndRenderNewsComments(articleIdOnPage);
            }
        }
    };

    supabaseClient.channel('public-dynamic-content')
        .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeChange)
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') console.log('✅ Realtime channel subscribed!');
            if (err) console.error('Realtime subscription error:', err);
        });
}


// ==========================================================
// SECTION 4: GLOBAL EVENT LISTENERS
// ==========================================================
function initializeGlobalEventListeners() {
    document.addEventListener('click', async function(e) {
        const deleteBtn = e.target.closest('.delete-comment-btn');
        if (deleteBtn) {
            e.preventDefault();
            const commentId = deleteBtn.dataset.commentId;
            const tableName = deleteBtn.dataset.tableName;

            if (confirm('هل أنت متأكد من أنك تريد حذف هذا التعليق؟')) {
                try {
                    const { error } = await supabaseClient.from(tableName).delete().eq('id', commentId);
                    if (error) throw error;
                    
                    const commentElement = deleteBtn.closest('.comment, .comment-item');
                    if (commentElement) commentElement.remove();
                    showNotification('تم حذف التعليق بنجاح.');
                } catch (error) {
                    console.error('Error deleting comment:', error);
                    alert('حدث خطأ أثناء حذف التعليق.');
                }
            }
        }
    });
}


// ==========================================================
// SECTION 5: PROFILE PAGE LOGIC (Final Version)
// ==========================================================
let profilePage;
let openProfileBtn;
let closeProfileBtn;
let saveUsernameBtn;
let profileCommentsList;

function initializeProfilePageListeners() {
    profilePage = document.getElementById('profile-page');
    openProfileBtn = document.getElementById('open-profile-btn');
    closeProfileBtn = document.getElementById('close-profile-btn');
    saveUsernameBtn = document.getElementById('save-username-btn');
    profileCommentsList = document.getElementById('profile-comments-list');

    if (openProfileBtn) openProfileBtn.addEventListener('click', openProfilePage);
    if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeProfilePage);
    if (saveUsernameBtn) saveUsernameBtn.addEventListener('click', handleUpdateUsername);
    if (profileCommentsList) profileCommentsList.addEventListener('click', handleDeleteComment);
}

function openProfilePage() {
    if (!currentUser) return;
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.classList.remove('show');

    if (profilePage) {
        profilePage.classList.remove('hidden');
        setTimeout(() => { profilePage.style.transform = 'translateX(0)'; }, 10);
        loadProfileData();
    }
}

function closeProfilePage() {
    if (profilePage) {
        profilePage.style.transform = 'translateX(100%)';
        setTimeout(() => { profilePage.classList.add('hidden'); }, 300);
    }
}

async function loadProfileData() {
    if (!currentUser) return;
    const usernameInput = document.getElementById('profile-username-input');
    const predictionsListDiv = document.getElementById('profile-predictions-list');
    const commentsListDiv = document.getElementById('profile-comments-list');

    if (usernameInput) usernameInput.value = currentUser.user_metadata.username || '';
    if (predictionsListDiv) predictionsListDiv.innerHTML = '<p class="text-gray-400">جاري تحميل التوقعات...</p>';
    if (commentsListDiv) commentsListDiv.innerHTML = '<p class="text-gray-400">جاري تحميل التعليقات...</p>';

    fetchAndRenderProfilePredictions();
    fetchAndRenderProfileComments();
}

async function fetchAndRenderProfilePredictions() {
    const predictionsListDiv = document.getElementById('profile-predictions-list');
    if (!predictionsListDiv) return;

    const { data, error } = await supabaseClient
        .from('predictions')
        .select(`predicted_winner, predicted_scorer, matches ( team1_name, team2_name )`)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        predictionsListDiv.innerHTML = `<p class="text-red-500">فشل تحميل التوقعات. خطأ: ${error.message}</p>`;
        return;
    }
    if (data.length === 0) {
        predictionsListDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي توقعات بعد.</p>';
        return;
    }
    predictionsListDiv.innerHTML = data.map(p => {
        if (!p.matches) return ''; // Skip if match was deleted
        return `
        <div class="profile-prediction-item">
            <div class="match-info">${p.matches.team1_name} ضد ${p.matches.team2_name}</div>
            <div class="prediction-info">
                توقعت فوز: <strong>${p.predicted_winner}</strong>
                ${p.predicted_scorer ? ` | ومسجل الهدف الأول: <strong>${p.predicted_scorer}</strong>` : ''}
            </div>
        </div>`;
    }).join('');
}

async function fetchAndRenderProfileComments() {
    const commentsListDiv = document.getElementById('profile-comments-list');
    if (!commentsListDiv) return;

    try {
        const [matchComments, newsComments] = await Promise.all([
            supabaseClient.from('comments').select('id, comment_text, created_at, matches(team1_name, team2_name)').eq('user_id', currentUser.id),
            supabaseClient.from('news_comments').select('id, comment_text, created_at, articles(title)').eq('user_id', currentUser.id)
        ]);

        if (matchComments.error) throw matchComments.error;
        if (newsComments.error) throw newsComments.error;
        
        const allComments = [
            ...matchComments.data.map(c => ({...c, type: 'match', table: 'comments'})),
            ...newsComments.data.map(c => ({...c, type: 'news', table: 'news_comments'}))
        ];
        allComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (allComments.length === 0) {
            commentsListDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي تعليقات بعد.</p>';
            return;
        }
        commentsListDiv.innerHTML = allComments.map(c => {
            let context = "سياق غير معروف";
            if (c.type === 'match' && c.matches) context = `مباراة ${c.matches.team1_name} ضد ${c.matches.team2_name}`;
            else if (c.type === 'news' && c.articles) context = `مقال "${c.articles.title}"`;
            
            return `
            <div class="profile-comment-item" id="profile-comment-${c.id}-${c.table}">
                <div class="comment-content">
                    <span class="comment-text">${c.comment_text}</span>
                    <span class="comment-meta">عن: ${context}</span>
                </div>
                <button class="delete-comment-btn-profile" data-comment-id="${c.id}" data-table-name="${c.table}">حذف</button>
            </div>`;
        }).join('');
    } catch (error) {
        commentsListDiv.innerHTML = `<p class="text-red-500">فشل تحميل التعليقات. خطأ: ${error.message}</p>`;
    }
}

async function handleUpdateUsername(e) {
    const btn = e.target;
    const usernameInput = document.getElementById('profile-username-input');
    const statusP = document.getElementById('username-status');
    const newUsername = usernameInput.value.trim();

    if (newUsername.length < 3) {
        statusP.textContent = 'يجب أن يكون الاسم 3 أحرف على الأقل.';
        statusP.style.color = 'var(--danger-color)';
        return;
    }
    btn.disabled = true;
    btn.textContent = '...';
    statusP.textContent = 'جاري الحفظ...';
    statusP.style.color = 'var(--secondary-text-color)';

    const { error } = await supabaseClient.auth.updateUser({ data: { username: newUsername } });

    if (error) {
        statusP.textContent = `خطأ: ${error.message}`;
        statusP.style.color = 'var(--danger-color)';
    } else {
        statusP.textContent = 'تم حفظ الاسم بنجاح!';
        statusP.style.color = 'var(--success-color)';
        currentUser.user_metadata.username = newUsername; // Update local state
    }
    btn.disabled = false;
    btn.textContent = 'حفظ';
}

async function handleDeleteComment(e) {
    const deleteBtn = e.target.closest('.delete-comment-btn-profile');
    if (!deleteBtn) return;

    const commentId = deleteBtn.dataset.commentId;
    const tableName = deleteBtn.dataset.tableName;

    if (!confirm('هل أنت متأكد من حذف هذا التعليق نهائياً؟')) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = '...';

    const { error } = await supabaseClient.from(tableName).delete().eq('id', commentId);

    if (error) {
        alert(`فشل حذف التعليق: ${error.message}`);
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'حذف';
    } else {
        const commentElement = document.getElementById(`profile-comment-${commentId}-${tableName}`);
        if (commentElement) commentElement.remove();
    }
}
