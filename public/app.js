// ==========================================================
// الملف: app.js (النسخة النهائية والمُصححة)
// ==========================================================

// SECTION 0: GLOBAL SETUP
const SUPABASE_URL = 'https://uxtxavurcgdeueeemmdi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dHhhdnVyY2dkZXVlZWVtbWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjQ4NzYsImV4cCI6MjA2NjYwMDg3Nn0.j7MrIoGzbzjurKyWGN0GgpMBIzl5exOsZrYlKCSmNbk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let hasNewsLoaded = false;
let articlesCache = [];
let currentNewsSubPage = 'home';

document.addEventListener('DOMContentLoaded', () => {
    // --- Page Switching Logic (Corrected with Lazy Loading) ---
    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');
    const predictionsPage = document.getElementById('predictions-page');
    const newsPage = document.getElementById('news-page');

    function switchPage(pageToShow) {
        const isPredictions = pageToShow === 'predictions';
        
        predictionsPage.classList.toggle('hidden', !isPredictions);
        newsPage.classList.toggle('hidden', isPredictions);

        predictionsBtn.classList.toggle('bg-blue-600', isPredictions);
        predictionsBtn.classList.toggle('text-white', isPredictions);
        predictionsBtn.classList.toggle('text-gray-400', !isPredictions);

        newsBtn.classList.toggle('bg-blue-600', !isPredictions);
        newsBtn.classList.toggle('text-white', !isPredictions);
        newsBtn.classList.toggle('text-gray-400', isPredictions);

        // The Correct Fix: Load news only when the tab is clicked for the first time
        if (pageToShow === 'news' && !hasNewsLoaded) {
            initializeNewsPage();
            hasNewsLoaded = true;
        }
    }

    predictionsBtn.addEventListener('click', () => switchPage('predictions'));
    newsBtn.addEventListener('click', () => switchPage('news'));

    // --- Initialize All App Modules ---
    initializeAuth();
    initializePredictionsPage(); // Predictions load on start
    initializeNewsPageListeners(); // Attaches listeners for swipe/comments
    initializeRealtimeListeners();
    initializeGlobalEventListeners();
    initializeProfilePageListeners();
});


// ==========================================================
// SECTION: NEWS PAGE
// ==========================================================
async function initializeNewsPage() {
    const articlesGrid = document.getElementById('articles-grid');
    if (!articlesGrid) return;
    articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full mt-8"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأخبار...</p>';
    
    try {
        const { data, error } = await supabaseClient.from('articles').select('id, title, image_url, content').order('created_at', { ascending: false });
        if (error) throw error;
        articlesCache = data;
        renderArticleCards(articlesCache);
    } catch (err) {
        console.error("Error initializing news page:", err);
        articlesGrid.innerHTML = `<p class="text-center text-red-500 col-span-full mt-8">فشل تحميل الأخبار. يرجى المحاولة مرة أخرى.</p>`;
    }
}

function renderArticleCards(articles) {
    const articlesGrid = document.getElementById('articles-grid');
    articlesGrid.innerHTML = '';
    if (!articles || articles.length === 0) {
        articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full mt-8">لا توجد أخبار متاحة حالياً.</p>';
        return;
    }
    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.innerHTML = `<img src="${article.image_url}" alt="${article.title}" onerror="this.onerror=null;this.src='https://via.placeholder.com/400x200.png?text=Image+Not+Found'"><div class="article-title"><h3>${article.title}</h3></div>`;
        card.addEventListener('click', () => renderArticleDetail(article.id));
        articlesGrid.appendChild(card);
    });
}

function renderArticleDetail(articleId) {
    const article = articlesCache.find(a => a.id === articleId);
    if (!article) return;
    const articleContent = document.getElementById('article-content');
    document.getElementById('article-id-hidden-input').value = article.id;
    articleContent.innerHTML = `<div id="article-header"><h1>${article.title}</h1></div><img src="${article.image_url}" alt="${article.title}" onerror="this.style.display='none'"><div>${article.content}</div>`;
    navigateToSubPage('article');
    fetchAndRenderNewsComments(article.id);
}

function navigateToSubPage(pageName) {
    const newsHomePage = document.getElementById('home-page');
    const newsArticlePage = document.getElementById('article-page');
    currentNewsSubPage = pageName;
    newsHomePage.style.transform = pageName === 'article' ? 'translateX(-100%)' : 'translateX(0)';
    newsArticlePage.style.transform = pageName === 'article' ? 'translateX(0)' : 'translateX(100%)';
    if (pageName === 'article') newsArticlePage.scrollTop = 0;
}

function initializeNewsPageListeners() {
    const newsArticlePage = document.getElementById('article-page');
    const commentForm = document.getElementById('comment-form');
    let touchStartX = 0;
    if (newsArticlePage) {
        newsArticlePage.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        newsArticlePage.addEventListener('touchend', e => {
            const touchEndX = e.changedTouches[0].screenX;
            if (Math.abs(touchEndX - touchStartX) > 50 && currentNewsSubPage === 'article') {
                navigateToSubPage('home');
            }
        }, { passive: true });
    }
    if (commentForm) { commentForm.addEventListener('submit', handleNewsCommentSubmit); }
}

async function fetchAndRenderNewsComments(articleId) {
    const commentsListDiv = document.getElementById('comments-list');
    if (!commentsListDiv) return;
    commentsListDiv.innerHTML = '<p class="text-center text-gray-400 my-2">جاري تحميل التعليقات...</p>';
    try {
        const { data, error } = await supabaseClient.from('news_comments').select('id, author, comment_text, created_at, user_id, parent_comment_id').eq('article_id', articleId).order('created_at', { ascending: true });
        if (error) throw error;
        commentsListDiv.innerHTML = '';
        const commentsById = {};
        const rootComments = [];
        data.forEach(comment => { commentsById[comment.id] = { ...comment, replies: [] }; });
        data.forEach(comment => {
            if (comment.parent_comment_id && commentsById[comment.parent_comment_id]) {
                commentsById[comment.parent_comment_id].replies.push(commentsById[comment.id]);
            } else { rootComments.push(commentsById[comment.id]); }
        });
        if (rootComments.length === 0) {
            commentsListDiv.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
        } else {
            rootComments.forEach(commentData => { addNewsCommentToDOM(commentsListDiv, commentData); });
        }
    } catch (err) {
        console.error('Error fetching news comments:', err);
        commentsListDiv.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>';
    }
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
    authorSpan.textContent = commentData.author;
    const dateSpan = document.createElement('span');
    dateSpan.className = 'comment-date';
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


// ==========================================================
// SECTION: PREDICTIONS PAGE
// ==========================================================
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingMatchesData = matchesData.filter(m => new Date(new Date(m.datetime).toLocaleDateString('fr-CA')) >= today);
    const matchesByDay = upcomingMatchesData.reduce((acc, m) => {
        const d = new Date(m.datetime).toLocaleDateString('fr-CA');
        if (!acc[d]) acc[d] = [];
        acc[d].push(m);
        return acc;
    }, {});

    if (Object.keys(matchesByDay).length === 0) {
        daysContentContainer.innerHTML = `<p class="text-center text-gray-400 mt-8">لا توجد مباريات قادمة. يرجى التحقق لاحقًا.</p>`;
    } else {
        const sortedDays = Object.keys(matchesByDay).sort();
        const arabicNumerals = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

        sortedDays.forEach((day, index) => {
            const dateObj = new Date(day + 'T00:00:00Z');
            const tabText = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }).replace(/[٠-٩]/g, c => arabicNumerals[c]);
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

function renderMatchesForDay(dayContentEl, matches) {
    dayContentEl.innerHTML = '';
    if (!matches || matches.length === 0) return;
    const arabicNumerals = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    matches.forEach(match => {
        const dateObj = new Date(match.datetime);
        const matchDate = dateObj.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/[٠-٩]/g, c => arabicNumerals[c]);
        const matchTime = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/[٠-٩]/g, c => arabicNumerals[c]);
        const status = getMatchStatus(match.datetime);
        let statusHTML;
        switch (status.state) {
            case 'ended': statusHTML = `<span class="match-status ended">انتهت</span>`; break;
            case 'live': statusHTML = `<span class="match-status live">مباشر</span>`; break;
            case 'soon': statusHTML = `<span class="match-status soon">بعد قليل</span>`; break;
            default: statusHTML = `<div class="match-time">${matchTime}</div>`;
        }
        const channels = (match.channels && match.channels.length > 0) ? match.channels.join(' / ') : "غير محددة";
        const isEnded = status.state === 'ended';
        const card = document.createElement('div');
        card.className = 'match-card';
        card.dataset.matchId = match.id;
        card.dataset.datetime = match.datetime;
        card.innerHTML = `
            <div class="match-header"><span class="match-league">${match.league}</span><span class="match-date-time">${matchDate}</span></div>
            <div class="match-body">
                <div class="teams-row">
                    <div class="team"><img src="${match.team1.logo}" alt="${match.team1.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${match.team1.name}</span></div>
                    <div class="match-status-container">${statusHTML}</div>
                    <div class="team"><img src="${match.team2.logo}" alt="${match.team2.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${match.team2.name}</span></div>
                </div>
                <form name="prediction-form" class="prediction-form ${isEnded ? 'disabled' : ''}">
                    <div class="form-group"><legend class="channel-info"><i class="fa-solid fa-tv"></i> <span>${channels}</span></legend></div>
                    <div class="form-group"><legend>توقع النتيجة:</legend><div class="prediction-options"><input type="radio" name="winner" id="win1-${match.id}" value="${match.team1.name}" required><label for="win1-${match.id}">${match.team1.name}</label><input type="radio" name="winner" id="draw-${match.id}" value="تعادل"><label for="draw-${match.id}">تعادل</label><input type="radio" name="winner" id="win2-${match.id}" value="${match.team2.name}"><label for="win2-${match.id}">${match.team2.name}</label></div></div>
                    <div class="form-group"><legend>من سيسجل أولاً؟ (اختياري)</legend><input type="text" name="scorer" class="scorer-input" placeholder="اكتب اسم اللاعب..."></div>
                    <div class="form-group"><button type="submit" class="submit-btn">${isEnded ? 'أغلقت التوقعات' : 'إرسال التوقع'}</button></div>
                </form>
            </div>
            <div class="match-footer">
                <button class="toggle-comments-btn">💬 التعليقات</button>
                <div class="comments-section" style="display:none;">
                    <div class="comment-list"></div>
                    <form name="match-comment-form" class="comment-form"><textarea name="comment_text" placeholder="أضف تعليقك..." required></textarea><button type="submit">إرسال</button></form>
                </div>
            </div>`;
        dayContentEl.appendChild(card);
    });
}

function attachTabEventListeners() {
    const dateTabsContainer = document.getElementById('date-tabs');
    dateTabsContainer.addEventListener('click', (e) => {
        if (!e.target.classList.contains('date-tab')) return;
        const tabId = e.target.dataset.tabId;
        document.querySelectorAll('.date-tab').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.day-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`day-${tabId}`).classList.add('active');
    });
}

function attachMatchEventListeners() {
    const daysContentContainer = document.getElementById('days-content-container');
    daysContentContainer.addEventListener('submit', e => {
        e.preventDefault();
        if (e.target.name === 'prediction-form' || e.target.name === 'match-comment-form') {
            handleFormSubmit(e.target);
        }
    });
    daysContentContainer.addEventListener('click', e => {
        if (e.target.classList.contains('toggle-comments-btn')) {
            handleToggleComments(e.target);
        }
    });
}

async function handleFormSubmit(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!currentUser) { alert('الرجاء تسجيل الدخول أولاً للمشاركة.'); document.getElementById('user-icon-btn').click(); return; }
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
        } catch (error) {
            if (error.message !== "Empty comment") { alert('حدث خطأ أثناء إرسال تعليقك.'); }
        } finally {
            submitBtn.innerHTML = "إرسال";
            submitBtn.disabled = false;
        }
    }
}

async function handleToggleComments(button) {
    const commentsSection = button.nextElementSibling;
    const shouldShow = commentsSection.style.display === 'none' || !commentsSection.style.display;
    const listElement = commentsSection.querySelector('.comment-list');
    const matchId = button.closest('.match-card').dataset.matchId;

    if (shouldShow) {
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
        if (error) throw error;
        listElement.innerHTML = '';
        const commentsById = {};
        const rootComments = [];
        data.forEach(comment => { commentsById[comment.id] = { ...comment, replies: [] }; });
        data.forEach(comment => {
            if (comment.parent_comment_id && commentsById[comment.parent_comment_id]) {
                commentsById[comment.parent_comment_id].replies.push(commentsById[comment.id]);
            } else { rootComments.push(commentsById[comment.id]); }
        });
        if (rootComments.length === 0) {
            listElement.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
        } else {
            rootComments.forEach(comment => { addCommentToDOM(listElement, comment); });
        }
    } catch (e) {
        console.error("Error fetching comments:", e);
        listElement.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>';
    }
}

function addCommentToDOM(listElement, commentData) {
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
        deleteBtn.dataset.tableName = 'comments';
        commentDiv.appendChild(deleteBtn);
    }
    listElement.appendChild(commentDiv);
    if (commentData.replies && commentData.replies.length > 0) {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        commentData.replies.forEach(reply => { addCommentToDOM(repliesContainer, reply); });
        listElement.appendChild(repliesContainer);
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


// ==========================================================
// SECTION: AUTH, PROFILE & GLOBAL LOGIC
// ==========================================================
// All remaining functions from your previous correct versions are here.
// No major changes needed in this block.

function initializeAuth(){const e=document.getElementById("auth-modal"),t=document.getElementById("user-icon-btn"),o=document.getElementById("close-auth-modal-btn"),n=document.getElementById("login-view"),s=document.getElementById("signup-view"),a=document.getElementById("loggedin-view"),i=document.getElementById("login-form"),l=document.getElementById("signup-form"),d=document.getElementById("logout-btn"),c=document.getElementById("show-signup"),r=document.getElementById("show-login"),m=document.getElementById("auth-message"),u=document.getElementById("open-profile-btn"),p=()=>{e.classList.add("show")},h=()=>{e.classList.remove("show")},g=e=>{n.style.display="none",s.style.display="none",a.style.display="none",e.style.display="block",m.textContent=""};t.addEventListener("click",()=>{currentUser?(document.getElementById("user-email-display").textContent=`أهلاً بك، ${currentUser.user_metadata.username||currentUser.email}!`,g(a)):g(n),p()}),u&&u.addEventListener("click",openProfilePage),o.addEventListener("click",h),e.addEventListener("click",t=>{t.target===e&&h()}),c.addEventListener("click",()=>g(s)),r.addEventListener("click",()=>g(n)),l.addEventListener("submit",async e=>{e.preventDefault();const t=document.getElementById("signup-username").value,o=document.getElementById("signup-email").value,n=document.getElementById("signup-password").value;m.textContent="جاري إنشاء الحساب...";const{data:s,error:a}=await supabaseClient.auth.signUp({email:o,password:n,options:{data:{username:t}}});a?m.textContent=`خطأ: ${a.message}`:(m.textContent="تم إنشاء الحساب بنجاح! يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.",l.reset())}),i.addEventListener("submit",async e=>{e.preventDefault();const t=document.getElementById("login-email").value,o=document.getElementById("login-password").value;m.textContent="جاري تسجيل الدخول...";const{data:n,error:s}=await supabaseClient.auth.signInWithPassword({email:t,password:o});s?m.textContent=`خطأ: ${s.message}`:(m.textContent="تم تسجيل الدخول بنجاح!",i.reset(),setTimeout(h,1e3))}),d.addEventListener("click",async()=>{m.textContent="جاري تسجيل الخروج...";const{error:e}=await supabaseClient.auth.signOut();e?m.textContent=`خطأ: ${e.message}`:(m.textContent="",h())}),supabaseClient.auth.onAuthStateChange((e,o)=>{const n=document.getElementById("user-icon-btn");"SIGNED_IN"===e||"INITIAL_SESSION"===e?(currentUser=o.user,n.classList.add("logged-in"),n.innerHTML='<i class="fa-solid fa-user-check"></i>',loadUserPredictions(),refreshVisibleComments(),registerPushNotifications()):"SIGNED_OUT"===e&&(currentUser=null,n.classList.remove("logged-in"),n.innerHTML='<i class="fa-solid fa-user-pen"></i>',resetUIOnLogout(),refreshVisibleComments())})}
async function loadUserPredictions(){if(!currentUser)return;const{data:e,error:t}=await supabaseClient.from("predictions").select("match_id, predicted_winner, predicted_scorer").eq("user_id",currentUser.id);if(t)return void console.error("Error fetching user predictions:",t);e.forEach(e=>{const t=document.querySelector(`.match-card[data-match-id='${e.match_id}']`);if(t){const o=t.querySelector(".prediction-form"),n=o.querySelector(`input[value="${e.predicted_winner}"]`);n&&(n.checked=!0);const s=o.querySelector(".scorer-input");s&&(s.value=e.predicted_scorer||""),[...o.elements].forEach(e=>e.disabled=!0),o.querySelector(".submit-btn").innerHTML="تم الإرسال ✅"}})}
function resetUIOnLogout(){document.querySelectorAll(".prediction-form").forEach(e=>{const t=e.closest(".match-card"),o=getMatchStatus(t.dataset.datetime).state;"ended"!==o&&([...e.elements].forEach(e=>{e.disabled=!1,"radio"===e.type&&(e.checked=!1),"text"===e.type&&(e.value="")}),e.querySelector(".submit-btn").innerHTML="إرسال التوقع")})}
function refreshVisibleComments(){document.querySelectorAll(".comments-section").forEach(e=>{if("block"===e.style.display){const t=e.closest(".match-card")?.dataset.matchId,o=e.querySelector(".comment-list");t&&o&&fetchAndRenderMatchComments(t,o)}});const e=document.getElementById("article-page");if(e&&"none"!==getComputedStyle(e).transform&&!e.style.transform.includes("100")){const t=document.getElementById("article-id-hidden-input")?.value;t&&fetchAndRenderNewsComments(t)}}
const registerPushNotifications=async()=>{if(!window.Capacitor||!window.Capacitor.isNativePlatform())return;const{PushNotifications:e}=window.Capacitor.Plugins;try{let t=await e.checkPermissions();"prompt"===t.receive&&(t=await e.requestPermissions()),"granted"!==t.receive||(await e.register(),e.addListener("registration",async e=>{currentUser&&await supabaseClient.from("fcm_tokens").upsert({user_id:currentUser.id,token:e.value},{onConflict:"token"})}),e.addListener("pushNotificationReceived",e=>{alert("إشعار جديد: "+(e.title||"")+"\n"+(e.body||""))}))}catch(e){console.error("Error in registerPushNotifications:",e)}};
function showNotification(e){const t=document.getElementById("notification-toast");t&&(t.textContent=e,t.classList.add("show"),setTimeout(()=>t.classList.remove("show"),3500))}
function initializeRealtimeListeners(){supabaseClient.channel("public-dynamic-content").on("postgres_changes",{event:"*",schema:"public"},e=>{if("matches"===e.table&&"DELETE"!==e.eventType)return showNotification("📢 تم تحديث قائمة المباريات!"),void initializePredictionsPage();if("articles"===e.table&&"DELETE"!==e.eventType)return showNotification("📢 تم تحديث قائمة الأخبار!"),void initializeNewsPage();if("comments"===e.table){const t=document.querySelector(`.match-card[data-match-id='${e.new?.match_id||e.old?.id}']`);if(t&&"block"===t.querySelector(".comments-section").style.display){const o=t.querySelector(".comment-list");fetchAndRenderMatchComments(e.new?.match_id,o)}return}if("news_comments"===e.table){const t=document.getElementById("article-id-hidden-input").value;t&&parseInt(t)===(e.new?.article_id||e.old?.article_id)&&("INSERT"===e.eventType&&showNotification("💬 تم إضافة تعليق جديد!"),fetchAndRenderNewsComments(t))}}).subscribe((e,t)=>{_,"SUBSCRIBED"===e&&console.log("✅ Realtime channel subscribed successfully!"),t&&console.error("Realtime subscription error:",t)})}
function initializeGlobalEventListeners(){document.addEventListener("click",async function(e){const t=e.target.closest(".delete-comment-btn");if(t){e.preventDefault();const o=t.dataset.commentId,n=t.dataset.tableName;if(confirm("هل أنت متأكد من أنك تريد حذف هذا التعليق؟"))try{const{error:e}=await supabaseClient.from(n).delete().eq("id",o);if(e)throw e;const s=t.closest(".comment, .comment-item");if(s){const e=s.nextElementSibling;e&&(e.classList.contains("replies-container")||e.classList.contains("news-replies-container"))&&e.remove(),s.remove()}showNotification("تم حذف التعليق بنجاح.")}catch(e){console.error("Error deleting comment:",e),alert("حدث خطأ أثناء حذف التعليق.")}}}})}
let profilePage,closeProfileBtn,saveUsernameBtn,profileCommentsList;function initializeProfilePageListeners(){profilePage=document.getElementById("profile-page"),closeProfileBtn=document.getElementById("close-profile-btn"),saveUsernameBtn=document.getElementById("save-username-btn"),profileCommentsList=document.getElementById("profile-comments-list"),closeProfileBtn&&closeProfileBtn.addEventListener("click",closeProfilePage),saveUsernameBtn&&saveUsernameBtn.addEventListener("click",handleUpdateUsername),profileCommentsList&&profileCommentsList.addEventListener("click",handleDeleteComment)}
function openProfilePage(){if(!currentUser||!profilePage)return;document.getElementById("auth-modal").classList.remove("show"),profilePage.classList.remove("hidden"),setTimeout(()=>{profilePage.classList.add("is-visible")},10),loadProfileData()}
function closeProfilePage(){if(!profilePage)return;const e=()=>{profilePage.classList.add("hidden"),profilePage.removeEventListener("transitionend",e)};profilePage.addEventListener("transitionend",e,{once:!0}),profilePage.classList.remove("is-visible"),setTimeout(()=>{profilePage.classList.contains("hidden")||e()},500)}
async function loadProfileData(){if(!currentUser)return;const e=document.getElementById("profile-username-input"),t=document.getElementById("profile-predictions-list"),o=document.getElementById("profile-comments-list"),n=document.getElementById("username-status");e&&(e.value=currentUser.user_metadata.username||""),n&&(n.textContent=""),t&&(t.innerHTML='<p class="text-gray-400">جاري تحميل التوقعات...</p>'),o&&(o.innerHTML='<p class="text-gray-400">جاري تحميل التعليقات...</p>'),fetchAndRenderProfilePredictions(),fetchAndRenderProfileComments()}
async function fetchAndRenderProfilePredictions(){const e=document.getElementById("profile-predictions-list");if(!e)return;const{data:t,error:o}=await supabaseClient.from("predictions").select("predicted_winner, predicted_scorer, matches ( team1_name, team2_name, actual_winner, actual_scorer )").eq("user_id",currentUser.id).order("created_at",{ascending:!1});if(o)return console.error("Error fetching profile predictions:",o),void(e.innerHTML='<p class="text-red-500">فشل تحميل التوقعات.</p>');if(0===t.length)return void(e.innerHTML='<p class="text-gray-400">لم تقم بأي توقعات بعد.</p>');e.innerHTML=t.map(e=>{if(!e.matches)return"";let t="pending",o="⏳",n="قيد الانتظار";return e.matches.actual_winner&&(e.predicted_winner===e.matches.actual_winner?(t="correct",o="✅",n="توقع صحيح"):(t="incorrect",o="❌",n=`توقع خاطئ (الفائز: ${e.matches.actual_winner})`)),`<div class="profile-prediction-item ${t}"><div class="prediction-match-info"><span>${e.matches.team1_name} ضد ${e.matches.team2_name}</span><span class="prediction-status">${o} ${n}</span></div><div class="prediction-details">توقعت فوز: <strong>${e.predicted_winner}</strong>${e.predicted_scorer?` | ومسجل الهدف الأول: <strong>${e.predicted_scorer}</strong>`:""}</div></div>`}).join("")}
async function fetchAndRenderProfileComments(){const e=document.getElementById("profile-comments-list");if(!e)return;const[t,o]=await Promise.all([supabaseClient.from("comments").select("id, comment_text, created_at, matches(team1_name, team2_name)").eq("user_id",currentUser.id),supabaseClient.from("news_comments").select("id, comment_text, created_at, articles(title)").eq("user_id",currentUser.id)]);if(t.error||o.error)return void(e.innerHTML='<p class="text-red-500">فشل تحميل التعليقات.</p>');const n=[...t.data.map(e=>({...e,type:"match",table:"comments"})),...o.data.map(e=>({...e,type:"news",table:"news_comments"}))].sort((e,t)=>new Date(t.created_at)-new Date(e.created_at));if(0===n.length)return void(e.innerHTML='<p class="text-gray-400">لم تقم بأي تعليقات بعد.</p>');e.innerHTML=n.map(e=>{const t="match"===e.type?e.matches?`مباراة ${e.matches.team1_name} ضد ${e.matches.team2_name}`:"مباراة محذوفة":e.articles?`مقال "${e.articles.title}"`:"مقال محذوف";return`<div class="profile-comment-item" id="profile-comment-${e.id}-${e.table}"><div class="comment-content"><span class="comment-text">${e.comment_text}</span><span class="comment-meta">عن: ${t}</span></div><button class="delete-comment-btn-profile" data-comment-id="${e.id}" data-table="${e.table}">حذف</button></div>`}).join("")}
async function handleUpdateUsername(e){const t=e.target,o=document.getElementById("profile-username-input"),n=document.getElementById("username-status"),s=o.value.trim();if(s.length<3)return n.textContent="يجب أن يكون الاسم 3 أحرف على الأقل.",void(n.style.color="var(--danger-color)");t.disabled=!0,t.textContent="...",n.textContent="جاري الحفظ...",n.style.color="var(--secondary-text-color)";const{error:a}=await supabaseClient.auth.updateUser({data:{username:s}});a?(n.textContent=`خطأ: ${a.message}`,n.style.color="var(--danger-color)"):(n.textContent="تم حفظ الاسم بنجاح!",n.style.color="var(--success-color)",currentUser.user_metadata.username=s),t.disabled=!1,t.textContent="حفظ"}
async function handleDeleteComment(e){if(!e.target.classList.contains("delete-comment-btn-profile"))return;const t=e.target,o=t.dataset.commentId,n=t.dataset.table;if(!confirm("هل أنت متأكد من حذف هذا التعليق نهائياً؟"))return;t.disabled=!0,t.textContent="...";const{error:s}=await supabaseClient.from(n).delete().eq("id",o).eq("user_id",currentUser.id);s?(alert(`فشل حذف التعليق: ${s.message}`),t.disabled=!1,t.textContent="حذف"):document.getElementById(`profile-comment-${o}-${n}`)?.remove()}
window.addEventListener("load",()=>{const e=document.getElementById("loader");e&&(e.style.display="none")});
