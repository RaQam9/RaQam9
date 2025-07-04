// ==========================================================
// SECTION 0: GLOBAL SETUP & CAPACITOR BRIDGE
// ==========================================================
const SUPABASE_URL = 'https://uxtxavurcgdeueeemmdi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dHhhdnVyY2dkZXVlZWVtbWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjQ4NzYsImV4cCI6MjA2NjYwMDg3Nn0.j7MrIoGzbzjurKyWGN0GgpMBIzl5exOsZrYlKCSmNbk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_EMAIL = "your-email@example.com";
const HOST_EMAIL = "host@example.com";

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check if Capacitor is available
    if (window.Capacitor) {
        console.log("Capacitor is available.");
    } else {
        console.log("Capacitor is not available. Running in web mode.");
    }

    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');
    const predictionsPage = document.getElementById('predictions-page');
    const newsPage = document.getElementById('news-page');

    function switchPage(pageToShow) {
        if (typeof gtag !== 'undefined') { gtag('event', 'select_content', { 'content_type': 'tab', 'item_id': pageToShow }); }
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
// SECTION 0.5: AUTHENTICATION & PUSH NOTIFICATIONS
// ==========================================================
const registerPushNotifications = async () => {
  // Check if Capacitor and its plugins are available
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
        const { error } = await supabaseClient
          .from('fcm_tokens')
          .upsert({ user_id: currentUser.id, token: token.value }, { onConflict: 'token' });
        
        if (error) {
          console.error('Error saving FCM token:', error);
        } else {
          console.log('FCM token saved successfully!');
        }
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Error on registration: ' + JSON.stringify(err));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        alert('إشعار جديد: ' + (notification.title || '') + "\n" + (notification.body || ''));
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
    });

  } catch(e) {
    console.error("Error in registerPushNotifications:", e);
  }
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
    
    if (openProfileBtn) {
       openProfileBtn.addEventListener('click', openProfilePage);
    }

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
            // استدعاء دالة تسجيل الإشعارات هنا
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


// ======================================================================
// باقي الملف يبقى كما هو تمامًا بدون تغيير
// The rest of the file remains exactly the same
// ======================================================================

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
    if (getComputedStyle(articlePage).transform !== 'none' && !articlePage.style.transform.includes('100')) {
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
            const scorerInput = form.querySelector('.scorer-input');
            if (scorerInput) scorerInput.value = p.predicted_scorer || '';
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
    try {
        const container = document.getElementById('matches-container');
        container.innerHTML = '<p class="text-center text-gray-400 mt-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i> جاري تحميل المباريات...</p>';
        const { data, error } = await supabaseClient.from('matches').select('*').order('datetime', { ascending: true });
        if (error) throw error;
        const formattedMatches = data.map(match => ({ id: match.id, team1: { name: match.team1_name, logo: match.team1_logo }, team2: { name: match.team2_name, logo: match.team2_logo }, league: match.league, datetime: match.datetime, channels: match.channels || [] }));
        container.innerHTML = `<div class="date-tabs-container" id="date-tabs"></div><div id="days-content-container"></div>`;
        initializeAppWithData(formattedMatches);
    } catch (error) {
        console.error("An error occurred:", error);
        document.getElementById('matches-container').innerHTML = '<p class="text-center text-red-500 mt-8">فشل تحميل المباريات. يرجى المحاولة مرة أخرى لاحقًا.</p>';
    }
}

function initializeAppWithData(matchesData) {
    const dateTabsContainer = document.getElementById('date-tabs');
    const daysContentContainer = document.getElementById('days-content-container');

    function renderMatchesForDay(d, m) { d.innerHTML = ''; if (!m || m.length === 0) return; const n = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }; m.forEach(t => { const a = new Date(t.datetime); const e = a.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/[٠-٩]/g, c => n[c]); const i = a.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/[٠-٩]/g, c => n[c]); const s = getMatchStatus(t.datetime); let o; switch (s.state) { case 'ended': o = `<span class="match-status ended">انتهت</span>`; break; case 'live': o = `<span class="match-status live">مباشر</span>`; break; case 'soon': o = `<span class="match-status soon">بعد قليل</span>`; break; default: o = `<div class="match-time">${i}</div>`; } const l = (t.channels && t.channels.length > 0) ? t.channels.join(' / ') : "غير محددة"; const r = s.state === 'ended'; const u = document.createElement('div'); u.className = 'match-card'; u.dataset.matchId = t.id; u.dataset.datetime = t.datetime; u.innerHTML = `<div class="match-header"><span class="match-league">${t.league}</span><span class="match-date-time">${e}</span></div><div class="match-body"><div class="teams-row"><div class="team"><img src="${t.team1.logo}" alt="${t.team1.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${t.team1.name}</span></div><div class="match-status-container">${o}</div><div class="team"><img src="${t.team2.logo}" alt="${t.team2.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${t.team2.name}</span></div></div><form name="prediction-form" class="prediction-form ${r ? 'disabled' : ''}"><div class="form-group"><legend class="channel-info"><i class="fa-solid fa-tv"></i> <span>${l}</span></legend></div><div class="form-group"><legend>توقع النتيجة:</legend><div class="prediction-options"><input type="radio" name="winner" id="win1-${t.id}" value="${t.team1.name}" required><label for="win1-${t.id}">${t.team1.name}</label><input type="radio" name="winner" id="draw-${t.id}" value="تعادل"><label for="draw-${t.id}">تعادل</label><input type="radio" name="winner" id="win2-${t.id}" value="${t.team2.name}"><label for="win2-${t.id}">${t.team2.name}</label></div></div><div class="form-group"><legend>من سيسجل أولاً؟ (اختياري)</legend><input type="text" name="scorer" class="scorer-input" placeholder="اكتب اسم اللاعب..."></div><div class="form-group"><button type="submit" class="submit-btn">${r ? 'أغلقت التوقعات' : 'إرسال التوقع'}</button></div></form></div><div class="match-footer"><button class="toggle-comments-btn">💬 التعليقات</button><div class="comments-section" style="display:none;"><div class="comment-list"></div><form name="match-comment-form" class="comment-form"><textarea name="comment_text" placeholder="أضف تعليقك..." required></textarea><button type="submit">إرسال</button></form></div></div>`; d.appendChild(u); }); }
    function attachTabEventListeners() { const d = document.getElementById('date-tabs'); d.addEventListener('click', (e) => { if (!e.target.classList.contains('date-tab')) return; const t = e.target.dataset.tabId; document.querySelectorAll('.date-tab').forEach(c => c.classList.remove('active')); e.target.classList.add('active'); document.querySelectorAll('.day-content').forEach(c => c.classList.remove('active')); document.getElementById(`day-${t}`).classList.add('active'); }); }
    function attachMatchEventListeners() { const d = document.getElementById('days-content-container'); d.addEventListener('submit', e => { e.preventDefault(); if (e.target.name === 'prediction-form' || e.target.name === 'match-comment-form') { handleFormSubmit(e.target); } }); d.addEventListener('click', e => { if (e.target.classList.contains('toggle-comments-btn')) handleToggleComments(e.target); }); }
    async function handleFormSubmit(form) {
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
    async function handleToggleComments(b) { const s = b.nextElementSibling; const h = s.style.display === 'none' || !s.style.display; const l = s.querySelector('.comment-list'); const i = b.closest('.match-card').dataset.matchId; if (h) { s.style.display = 'block'; b.innerHTML = '💬 إخفاء التعليقات'; await fetchAndRenderMatchComments(i, l); } else { s.style.display = 'none'; b.innerHTML = '💬 التعليقات'; } }
    
    async function fetchAndRenderMatchComments(matchId, listElement) {
        listElement.innerHTML = '<p class="text-center text-gray-500 my-2">جاري تحميل التعليقات...</p>';
        try {
            const { data, error } = await supabaseClient
                .from('comments')
                .select('id, author, comment_text, created_at, user_id, parent_comment_id')
                .eq('match_id', matchId)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            listElement.innerHTML = '';
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
            if (rootComments.length === 0) {
                listElement.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
            } else {
                rootComments.forEach(comment => { addCommentToDOM(listElement, comment, 'comments'); });
            }
        } catch (e) { console.error("Error fetching comments:", e); listElement.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'; }
    }
    
    function addCommentToDOM(listElement, commentData, tableName) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment';
        if (commentData.author === 'المدير') { commentDiv.classList.add('admin-reply'); }
        commentDiv.dataset.commentId = commentData.id;
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'comment-avatar';
        avatarDiv.innerHTML = `<i class="fa-solid fa-${commentData.author === 'المدير' ? 'user-shield' : 'user'}"></i>`;
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'comment-body';
        const authorSpan = document.createElement('span');
        authorSpan.className = 'comment-author';
        authorSpan.textContent = commentData.author;
        const textP = document.createElement('p');
        textP.className = 'comment-text';
        textP.textContent = commentData.comment_text;
        bodyDiv.append(authorSpan, textP);
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
        if (commentData.replies && commentData.replies.length > 0) {
            const repliesContainer = document.createElement('div');
            repliesContainer.className = 'replies-container';
            commentData.replies.forEach(reply => { addCommentToDOM(repliesContainer, reply, tableName); });
            listElement.appendChild(repliesContainer);
        }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingMatchesData = matchesData.filter(m => new Date(new Date(m.datetime).toLocaleDateString('fr-CA')) >= today);
    const matchesByDay = upcomingMatchesData.reduce((acc, m) => { const d = new Date(m.datetime).toLocaleDateString('fr-CA'); if (!acc[d]) acc[d] = []; acc[d].push(m); return acc; }, {});
    if (Object.keys(matchesByDay).length === 0) { daysContentContainer.innerHTML = `<p class="text-center text-gray-400 mt-8">لا توجد مباريات قادمة. يرجى التحقق لاحقًا.</p>`; } else { const s = Object.keys(matchesByDay).sort(); const n = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }; s.forEach((d, i) => { const a = new Date(d + 'T00:00:00Z'); const t = a.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }).replace(/[٠-٩]/g, c => n[c]); const b = document.createElement('div'); b.className = `date-tab ${i === 0 ? 'active' : ''}`; b.textContent = t; b.dataset.tabId = d; dateTabsContainer.appendChild(b); const e = document.createElement('div'); e.className = `day-content ${i === 0 ? 'active' : ''}`; e.id = `day-${d}`; daysContentContainer.appendChild(e); const o = { 'live': 1, 'soon': 2, 'scheduled': 3, 'ended': 4 }; const r = matchesByDay[d].sort((x, y) => { const sA = getMatchStatus(x.datetime).state; const sB = getMatchStatus(y.datetime).state; if (o[sA] !== o[sB]) return o[sA] - o[sB]; return new Date(x.datetime) - new Date(y.datetime); }); renderMatchesForDay(e, r); }); }
    attachTabEventListeners();
    attachMatchEventListeners();
    loadUserPredictions();
}

function getMatchStatus(d) { const m = new Date(d); const n = new Date(); const f = (m.getTime() - n.getTime()) / 60000; if (f < -125) return { state: 'ended' }; if (f <= 0) return { state: 'live' }; if (f <= 5) return { state: 'soon' }; return { state: 'scheduled' }; }

function initializeNewsPage() {
    const articlesGrid = document.getElementById('articles-grid');
    const articleContent = document.getElementById('article-content');
    const newsHomePage = document.getElementById('home-page');
    const newsArticlePage = document.getElementById('article-page');
    const commentForm = document.getElementById('comment-form');
    let articlesCache = [];
    let currentNewsSubPage = 'home';

    async function fetchArticlesFromDB() {
        articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأخبار...</p>';
        const { data, error } = await supabaseClient.from('articles').select('id, title, image_url, content').order('created_at', { ascending: false });
        if (error) { console.error("Supabase error:", error); articlesGrid.innerHTML = `<p class="text-center text-red-500 col-span-full">فشل تحميل الأخبار.</p>`; return null; }
        return data;
    }
    function renderArticleCards(articles) {
        articlesGrid.innerHTML = ''; if (!articles || articles.length === 0) { articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full">لا توجد أخبار متاحة حالياً.</p>'; return; }
        articles.forEach(article => {
            const card = document.createElement('div'); card.className = 'article-card';
            card.innerHTML = `<img src="${article.image_url}" alt="${article.title}" onerror="this.style.display='none'"><div class="article-title"><h3>${article.title}</h3></div>`;
            card.addEventListener('click', () => renderArticleDetail(article.id));
            articlesGrid.appendChild(card);
        });
    }
    function renderArticleDetail(articleId) {
        const article = articlesCache.find(a => a.id === articleId); if (!article) return;
        document.getElementById('article-id-hidden-input').value = article.id;
        articleContent.innerHTML = `<div id="article-header"><h1>${article.title}</h1></div><img src="${article.image_url}" alt="${article.title}" onerror="this.style.display='none'"><div>${article.content}</div>`;
        navigateToSubPage('article');
        fetchAndRenderNewsComments(article.id);
    }
    function navigateToSubPage(pageName) {
        currentNewsSubPage = pageName;
        if (pageName === 'article') { newsHomePage.style.transform = 'translateX(-100%)'; newsArticlePage.style.transform = 'translateX(0)'; newsArticlePage.scrollTop = 0; }
        else { newsHomePage.style.transform = 'translateX(0)'; newsArticlePage.style.transform = 'translateX(100%)'; }
    }
    async function start() {
        const fetchedArticles = await fetchArticlesFromDB();
        if (fetchedArticles) { articlesCache = fetchedArticles; renderArticleCards(articlesCache); }
    }
    if (commentForm) {
       commentForm.addEventListener('submit', handleNewsCommentSubmit);
    }
    let touchStartX = 0; newsArticlePage.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true }); newsArticlePage.addEventListener('touchend', e => { const touchEndX = e.changedTouches[0].screenX; if (touchEndX > touchStartX && (touchEndX - touchStartX > 50)) { if (currentNewsSubPage === 'article') navigateToSubPage('home'); } }, { passive: true });
    start();
}

async function fetchAndRenderNewsComments(articleId) {
    const commentsListDiv = document.getElementById('comments-list');
    if (!commentsListDiv) return;
    commentsListDiv.innerHTML = '<p class="text-center text-gray-400 my-2">جاري تحميل التعليقات...</p>';
    try {
        const { data, error } = await supabaseClient
            .from('news_comments')
            .select('id, author, comment_text, created_at, user_id, parent_comment_id')
            .eq('article_id', articleId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        commentsListDiv.innerHTML = '';
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
        if (rootComments.length === 0) {
            commentsListDiv.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
        } else {
            rootComments.forEach(commentData => { addNewsCommentToDOM(commentsListDiv, commentData); });
        }
    } catch (err) { console.error('Error fetching news comments:', err); commentsListDiv.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'; }
}

function addNewsCommentToDOM(container, commentData) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item';
    if (commentData.author === 'المدير') { commentEl.classList.add('admin-reply'); }
    commentEl.dataset.commentId = commentData.id;
    const headerDiv = document.createElement('div');
    headerDiv.className = 'comment-header';
    const authorSpan = document.createElement('span');
    authorSpan.className = 'comment-author';
    if (commentData.parent_comment_id) {
         authorSpan.innerHTML = `<i class="fa-solid fa-reply fa-flip-horizontal" style="margin-left: 5px;"></i> ${commentData.author}`;
    } else {
         authorSpan.textContent = commentData.author;
    }
    const dateSpan = document.createElement('span');
    dateSpan.className = 'comment-date';
    dateSpan.style.fontSize = '0.8rem';
    dateSpan.textContent = new Date(commentData.created_at).toLocaleDateString('ar-EG');
    headerDiv.append(authorSpan, dateSpan);
    const bodyP = document.createElement('p');
    bodyP.className = 'comment-body';
    bodyP.textContent = commentData.comment_text;
    commentEl.append(headerDiv, bodyP);
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

function showNotification(message) {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function initializeRealtimeListeners() {
    const handleRealtimeChange = (payload) => {
        if ((payload.table === 'matches' || payload.table === 'articles') && payload.eventType !== 'DELETE') {
            const pageName = payload.table === 'matches' ? 'المباريات' : 'الأخبار';
            showNotification(`📢 تم تحديث قائمة ${pageName}!`);
            if (payload.table === 'matches') initializePredictionsPage(); else initializeNewsPage();
            return;
        }
        if (payload.table === 'comments') {
            const matchCard = document.querySelector(`.match-card[data-match-id='${payload.new?.match_id || payload.old?.id}']`);
            if (matchCard && matchCard.querySelector('.comments-section').style.display === 'block') {
                const listElement = matchCard.querySelector('.comment-list');
                fetchAndRenderMatchComments(payload.new?.match_id, listElement);
            }
            return;
        }
        if (payload.table === 'news_comments') {
            const articleIdOnPage = document.getElementById('article-id-hidden-input').value;
            if (articleIdOnPage && parseInt(articleIdOnPage) === (payload.new?.article_id || payload.old?.article_id)) {
                if (payload.eventType === 'INSERT') showNotification('💬 تم إضافة تعليق جديد!');
                fetchAndRenderNewsComments(articleIdOnPage);
            }
            return;
        }
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
            const commentId = deleteBtn.dataset.commentId;
            const tableName = deleteBtn.dataset.tableName;
            const isConfirmed = confirm('هل أنت متأكد من أنك تريد حذف هذا التعليق؟');
            if (isConfirmed) {
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
    });
}

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
    const authModal = document.getElementById('auth-modal');
    authModal.classList.remove('show');
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
    setTimeout(() => {
        if (!profilePage.classList.contains('hidden')) { onTransitionEnd(); }
    }, 500);
}

async function loadProfileData() {
    if (!currentUser) return;
    const usernameInput = document.getElementById('profile-username-input');
    const predictionsListDiv = document.getElementById('profile-predictions-list');
    const commentsListDiv = document.getElementById('profile-comments-list');
    const statusP = document.getElementById('username-status');
    
    if (usernameInput) usernameInput.value = currentUser.user_metadata.username || '';
    if (statusP) statusP.textContent = '';
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
        .select(`
            predicted_winner, 
            predicted_scorer, 
            matches ( 
                team1_name, 
                team2_name, 
                actual_winner, 
                actual_scorer 
            )
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching profile predictions:", error);
        predictionsListDiv.innerHTML = '<p class="text-red-500">فشل تحميل التوقعات.</p>';
        return;
    }
    if (data.length === 0) {
        predictionsListDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي توقعات بعد.</p>';
        return;
    }
    
    predictionsListDiv.innerHTML = data.map(p => {
        if (!p.matches) return ''; 
        let resultClass = 'pending';
        let resultIcon = '⏳';
        let resultText = 'قيد الانتظار';
        if (p.matches.actual_winner) {
            if (p.predicted_winner === p.matches.actual_winner) {
                resultClass = 'correct';
                resultIcon = '✅';
                resultText = 'توقع صحيح';
            } else {
                resultClass = 'incorrect';
                resultIcon = '❌';
                resultText = `توقع خاطئ (الفائز: ${p.matches.actual_winner})`;
            }
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

// Hide loader after everything is loaded
window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }
});
