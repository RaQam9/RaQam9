// ==========================================================
// SECTION 0: GLOBAL SETUP (Supabase, Constants & Page Switching)
// ==========================================================
const SUPABASE_URL = 'https://uxtxavurcgdeueeemmdi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dHhhdnVyY2dkZXVlZWVtbWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjQ4NzYsImV4cCI6MjA2NjYwMDg3Nn0.j7MrIoGzbzjurKyWGN0GgpMBIzl5exOsZrYlKCSmNbk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_EMAIL = "your-email@example.com";
const HOST_EMAIL = "host@example.com";

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');
    const predictionsPage = document.getElementById('predictions-page');
    const newsPage = document.getElementById('news-page');

    function switchPage(pageToShow) {
        if (pageToShow === 'predictions') {
            predictionsPage.classList.remove('hidden');
            newsPage.classList.add('hidden');
            predictionsBtn.classList.add('bg-blue-600', 'text-white');
            predictionsBtn.classList.remove('text-gray-400');
            newsBtn.classList.remove('bg-blue-600', 'text-white');
            newsBtn.classList.add('text-gray-400');
        } else {
            newsPage.classList.remove('hidden');
            predictionsPage.classList.add('hidden');
            newsBtn.classList.add('bg-blue-600', 'text-white');
            newsBtn.classList.remove('text-gray-400');
            predictionsBtn.classList.remove('bg-blue-600', 'text-white');
            predictionsBtn.classList.add('text-gray-400');
        }
    }

    predictionsBtn.addEventListener('click', () => switchPage('predictions'));
    newsBtn.addEventListener('click', () => switchPage('news'));

    initializeAuth();
    initializePredictionsPage();
    initializeNewsPage();
    initializeRealtimeListeners();
    initializeGlobalEventListeners();
    initializeProfilePageListeners();
});

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
        if (currentUser && currentUser.email === HOST_EMAIL) {
            const { error: deleteError } = await supabaseClient.from('predictions').delete().eq('user_id', currentUser.id);
            if (deleteError) console.error("Error deleting host predictions:", deleteError);
        }
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
    document.querySelectorAll('.comments-section').forEach(section => {
        if (section.style.display === 'block') {
            const matchId = section.closest('.match-card').dataset.matchId;
            const listElement = section.querySelector('.comment-list');
            if (matchId && listElement) {
                fetchAndRenderMatchComments(matchId, listElement);
            }
        }
    });
    const articlePage = document.getElementById('article-page');
    if (articlePage.style.transform === 'translateX(0px)') {
        const articleId = document.getElementById('article-id-hidden-input').value;
        if (articleId) {
            fetchAndRenderNewsComments(articleId);
        }
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
async function initializePredictionsPage() {
    // ... محتوى هذه الدالة يبقى كما هو ...
}
function initializeAppWithData(matchesData) {
    // ... محتوى هذه الدالة يبقى كما هو ...
}
function getMatchStatus(d) {
    // ... محتوى هذه الدالة يبقى كما هو ...
}
function initializeNewsPage() {
    // ... محتوى هذه الدالة يبقى كما هو ...
}
async function fetchAndRenderNewsComments(articleId) {
    // ... محتوى هذه الدالة يبقى كما هو ...
}
async function handleNewsCommentSubmit(event) {
    // ... محتوى هذه الدالة يبقى كما هو ...
}
function showNotification(message) {
    // ... محتوى هذه الدالة يبقى كما هو ...
}
function initializeRealtimeListeners() {
    // ... محتوى هذه الدالة يبقى كما هو ...
}
function initializeGlobalEventListeners() {
    // ... محتوى هذه الدالة يبقى كما هو ...
}
// نسخ ولصق المحتوى الكامل للدوال أعلاه من الكود الأصلي

// ==========================================================
// SECTION 5: PROFILE PAGE LOGIC (FINAL SOLUTION)
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
    if (!currentUser || !profilePage) return;

    // إخفاء نافذة تسجيل الدخول إذا كانت مفتوحة
    const authModal = document.getElementById('auth-modal');
    authModal.classList.remove('show');

    // 1. أزل كلاس 'hidden' للسماح للصفحة بالظهور في DOM
    profilePage.classList.remove('hidden');

    // 2. استخدم setTimeout لفصل عملية الإظهار عن التحريك
    //    هذا يجبر المتصفح على إعادة الرسم قبل بدء الأنيميشن
    setTimeout(() => {
        profilePage.classList.add('is-visible');
    }, 10);

    loadProfileData();
}

function closeProfilePage() {
    if (!profilePage) return;

    // دالة يتم استدعاؤها مرة واحدة فقط عند انتهاء الأنيميشن
    const onTransitionEnd = () => {
        profilePage.classList.add('hidden');
        profilePage.removeEventListener('transitionend', onTransitionEnd);
    };

    // إضافة المستمع الذي ينتظر انتهاء حركة الانزلاق للخارج
    profilePage.addEventListener('transitionend', onTransitionEnd, { once: true });

    // ابدأ الأنيميشن بإزالة الكلاس
    profilePage.classList.remove('is-visible');
    
    // احتياطي إذا لم يعمل الأنيميشن
    setTimeout(() => {
        if (!profilePage.classList.contains('hidden')) {
            onTransitionEnd();
        }
    }, 500); // مدة أطول قليلاً من الأنيميشن
}


async function loadProfileData() {
    if (!currentUser) return;
    const usernameInput = document.getElementById('profile-username-input');
    const predictionsListDiv = document.getElementById('profile-predictions-list');
    const commentsListDiv = document.getElementById('profile-comments-list');
    const statusP = document.getElementById('username-status');
    
    if (usernameInput) usernameInput.value = currentUser.user_metadata.username || '';
    if (statusP) statusP.textContent = ''; // Clear status on load
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
        predictionsListDiv.innerHTML = '<p class="text-red-500">فشل تحميل التوقعات.</p>';
        return;
    }
    if (data.length === 0) {
        predictionsListDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي توقعات بعد.</p>';
        return;
    }
    predictionsListDiv.innerHTML = data.map(p => {
        if (!p.matches) return '';
        return `<div class="profile-prediction-item"><div class="match-info">${p.matches.team1_name} ضد ${p.matches.team2_name}</div><div class="prediction-info">توقعت فوز: <strong>${p.predicted_winner}</strong>${p.predicted_scorer ? ` | ومسجل الهدف الأول: <strong>${p.predicted_scorer}</strong>` : ''}</div></div>`
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
        commentsListDiv.innerHTML = '<p class="text-red-500">فشل تحميل التعليقات.</p>';
        return;
    }
    
    const allComments = [
        ...matchComments.data.map(c => ({...c, type: 'match', table: 'comments'})),
        ...newsComments.data.map(c => ({...c, type: 'news', table: 'news_comments'}))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (allComments.length === 0) {
        commentsListDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي تعليقات بعد.</p>';
        return;
    }
    commentsListDiv.innerHTML = allComments.map(c => {
        const context = c.type === 'match'
            ? (c.matches ? `مباراة ${c.matches.team1_name} ضد ${c.matches.team2_name}` : 'مباراة محذوفة')
            : (c.articles ? `مقال "${c.articles.title}"` : 'مقال محذوف');
        return `<div class="profile-comment-item" id="profile-comment-${c.id}-${c.table}"><div class="comment-content"><span class="comment-text">${c.comment_text}</span><span class="comment-meta">عن: ${context}</span></div><button class="delete-comment-btn-profile" data-comment-id="${c.id}" data-table="${c.table}">حذف</button></div>`
    }).join('');
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
        currentUser.user_metadata.username = newUsername;
    }
    btn.disabled = false;
    btn.textContent = 'حفظ';
}

async function handleDeleteComment(e) {
    if (!e.target.classList.contains('delete-comment-btn-profile')) return;
    const btn = e.target;
    const commentId = btn.dataset.commentId;
    const tableName = btn.dataset.table;

    if (!confirm('هل أنت متأكد من حذف هذا التعليق نهائياً؟')) return;

    btn.disabled = true;
    btn.textContent = '...';
    const { error } = await supabaseClient.from(tableName).delete().eq('id', commentId).eq('user_id', currentUser.id);

    if (error) {
        alert(`فشل حذف التعليق: ${error.message}`);
        btn.disabled = false;
        btn.textContent = 'حذف';
    } else {
        document.getElementById(`profile-comment-${commentId}-${tableName}`)?.remove();
    }
}
