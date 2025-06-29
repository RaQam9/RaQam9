// ==========================================================
    // SECTION 0: GLOBAL SETUP (Supabase, Constants & Page Switching)
    // ==========================================================
    const SUPABASE_URL = 'https://uxtxavurcgdeueeemmdi.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dHhhdnVyY2dkZXVlZWVtbWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjQ4NzYsImV4cCI6MjA2NjYwMDg3Nn0.j7MrIoGzbzjurKyWGN0GgpMBIzl5exOsZrYlKCSmNbk';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // --!!-- قم بتغيير هذا البريد لبريد المستضيف --!!--
    const HOST_EMAIL = "host@example.com"; 

    let currentUser = null;

    document.addEventListener('DOMContentLoaded', () => {
        const predictionsBtn = document.getElementById('nav-predictions-btn');
        const newsBtn = document.getElementById('nav-news-btn');
        const predictionsPage = document.getElementById('predictions-page');
        const newsPage = document.getElementById('news-page');
        
        function switchPage(pageToShow) { 
            if (typeof gtag !== 'undefined') { gtag('event', 'select_content', { 'content_type': 'tab', 'item_id': pageToShow }); }
            if (pageToShow === 'predictions') { 
                predictionsPage.classList.remove('hidden'); newsPage.classList.add('hidden'); 
                predictionsBtn.classList.add('bg-blue-600', 'text-white'); predictionsBtn.classList.remove('text-gray-400'); 
                newsBtn.classList.remove('bg-blue-600', 'text-white'); newsBtn.classList.add('text-gray-400'); 
            } else { 
                newsPage.classList.remove('hidden'); predictionsPage.classList.add('hidden'); 
                newsBtn.classList.add('bg-blue-600', 'text-white'); newsBtn.classList.remove('text-gray-400'); 
                predictionsBtn.classList.remove('bg-blue-600', 'text-white'); predictionsBtn.classList.add('text-gray-400'); 
            } 
        }
        
        predictionsBtn.addEventListener('click', () => switchPage('predictions'));
        newsBtn.addEventListener('click', () => switchPage('news'));
        
        initializeAuth();
        initializePredictionsPage();
        initializeNewsPage();
        initializeRealtimeListeners(); // <-- تم إضافة هذه الدالة
    });

    // ==========================================================
    // SECTION 0.5: AUTHENTICATION LOGIC (NEW)
    // ==========================================================
    function initializeAuth() {
        const authModal = document.getElementById('auth-modal');
        const userIconBtn = document.getElementById('user-icon-btn');
        const closeModalBtn = document.getElementById('close-auth-modal-btn');

        // Views and Forms
        const loginView = document.getElementById('login-view');
        const signupView = document.getElementById('signup-view');
        const loggedinView = document.getElementById('loggedin-view');
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const logoutBtn = document.getElementById('logout-btn');
        
        // Toggles
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
        
        // Handle Signup
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('signup-username').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            authMessage.textContent = 'جاري إنشاء الحساب...';

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username // Save username in metadata
                    }
                }
            });

            if (error) {
                authMessage.textContent = `خطأ: ${error.message}`;
            } else {
                authMessage.textContent = 'تم إنشاء الحساب بنجاح! يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.';
                signupForm.reset();
            }
        });

        // Handle Login
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
        
        // Handle Logout
        logoutBtn.addEventListener('click', async () => {
            authMessage.textContent = 'جاري تسجيل الخروج...';

            // Special logic for the HOST
            if (currentUser && currentUser.email === HOST_EMAIL) {
                console.log("Host is logging out. Deleting their predictions...");
                const { error: deleteError } = await supabaseClient
                    .from('predictions')
                    .delete()
                    .eq('user_id', currentUser.id);

                if (deleteError) {
                    console.error("Error deleting host predictions:", deleteError);
                    alert("حدث خطأ أثناء حذف بيانات المستضيف.");
                } else {
                    console.log("Host predictions deleted successfully.");
                }
            }

            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                authMessage.textContent = `خطأ: ${error.message}`;
            } else {
                authMessage.textContent = '';
                closeAuthModal();
            }
        });

        // Listen for auth state changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            const userIcon = document.getElementById('user-icon-btn');
            if (event === 'SIGNED_IN' || event === "INITIAL_SESSION") {
                currentUser = session.user;
                userIcon.classList.add('logged-in');
                userIcon.innerHTML = `<i class="fa-solid fa-user-check"></i>`;
                loadUserPredictions(); // Fetch user-specific data
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                userIcon.classList.remove('logged-in');
                userIcon.innerHTML = `<i class="fa-solid fa-user-pen"></i>`;
                resetUIOnLogout(); // Reset UI to default state
            }
        });
    }
    
    // Function to load user-specific predictions after login
    async function loadUserPredictions() {
        if (!currentUser) return;
        
        const { data, error } = await supabaseClient
            .from('predictions')
            .select('match_id, predicted_winner, predicted_scorer')
            .eq('user_id', currentUser.id);
            
        if (error) {
            console.error("Error fetching user predictions:", error);
            return;
        }

        // Apply predictions to the UI
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

    // Function to reset the UI on logout
    function resetUIOnLogout() {
        document.querySelectorAll('.prediction-form').forEach(form => {
            const matchCard = form.closest('.match-card');
            const matchStatus = getMatchStatus(matchCard.dataset.datetime).state;
            const isEnded = matchStatus === 'ended';

            // Reset only if match is not ended
            if (!isEnded) {
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
            let { data: matchesDataFromDB, error } = await supabaseClient.from('matches').select('*').order('datetime', { ascending: true });
            if (error) { throw error; }
            const formattedMatches = matchesDataFromDB.map(match => ({ id: match.id, team1: { name: match.team1_name, logo: match.team1_logo }, team2: { name: match.team2_name, logo: match.team2_logo }, league: match.league, datetime: match.datetime, channels: match.channels || [] }));
            document.getElementById('matches-container').innerHTML = `<div class="date-tabs-container" id="date-tabs"></div><div id="days-content-container"></div>`;
            initializeAppWithData(formattedMatches);
        } catch (error) {
            console.error("An error occurred:", error);
            const container = document.getElementById('matches-container');
            if (container) { container.innerHTML = '<p class="text-center text-red-500 mt-8">فشل تحميل المباريات. يرجى المحاولة مرة أخرى لاحقًا.</p>'; }
        }
    }

    function initializeAppWithData(matchesData) {
        const tickerMessages = ["🏆 سيتم تكريم أفضل المتوقعين في نهاية كل أسبوع!", "💡 سجل دخولك للمشاركة في السحب.", "🔥 تابعونا في تغطية خاصة لمباريات كأس العالم للأندية."];
        const dateTabsContainer = document.getElementById('date-tabs');
        const daysContentContainer = document.getElementById('days-content-container');
        
        function renderMatchesForDay(d, m) { d.innerHTML = ''; if (!m || m.length === 0) return; const n = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'}; m.forEach(t => { const a = new Date(t.datetime); const e = a.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/[٠-٩]/g, c => n[c]); const i = a.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/[٠-٩]/g, c => n[c]); const s = getMatchStatus(t.datetime); let o; switch (s.state) { case 'ended': o = `<span class="match-status ended">انتهت</span>`; break; case 'live': o = `<span class="match-status live">مباشر</span>`; break; case 'soon': o = `<span class="match-status soon">بعد قليل</span>`; break; default: o = `<div class="match-time">${i}</div>`; } const l = (t.channels && t.channels.length > 0) ? t.channels.join(' / ') : "غير محددة"; const r = s.state === 'ended'; const u = document.createElement('div'); u.className = 'match-card'; u.dataset.matchId = t.id; u.dataset.datetime = t.datetime; u.innerHTML = `<div class="match-header"><span class="match-league">${t.league}</span><span class="match-date-time">${e}</span></div><div class="match-body"><div class="teams-row"><div class="team"><img src="${t.team1.logo}" alt="${t.team1.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${t.team1.name}</span></div><div class="match-status-container">${o}</div><div class="team"><img src="${t.team2.logo}" alt="${t.team2.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${t.team2.name}</span></div></div><form name="prediction-form" class="prediction-form ${r ? 'disabled' : ''}"><div class="form-group"><legend class="channel-info"><i class="fa-solid fa-tv"></i> <span>${l}</span></legend></div><div class="form-group"><legend>توقع النتيجة:</legend><div class="prediction-options"><input type="radio" name="winner" id="win1-${t.id}" value="${t.team1.name}" required><label for="win1-${t.id}">${t.team1.name}</label><input type="radio" name="winner" id="draw-${t.id}" value="تعادل"><label for="draw-${t.id}">تعادل</label><input type="radio" name="winner" id="win2-${t.id}" value="${t.team2.name}"><label for="win2-${t.id}">${t.team2.name}</label></div></div><div class="form-group"><legend>من سيسجل أولاً؟ (اختياري)</legend><input type="text" name="scorer" class="scorer-input" placeholder="اكتب اسم اللاعب..."></div><div class="form-group"><button type="submit" class="submit-btn">${r ? 'أغلقت التوقعات' : 'إرسال التوقع'}</button></div></form></div><div class="match-footer"><button class="toggle-comments-btn" ${r ? 'disabled' : ''}>💬 التعليقات</button><div class="comments-section" style="display:none;"><div class="comment-list"></div><form name="match-comment-form" class="comment-form"><textarea name="comment_text" placeholder="أضف تعليقك..." required></textarea><button type="submit">إرسال</button></form></div></div>`; d.appendChild(u); }); }
        function attachTabEventListeners() { const d = document.getElementById('date-tabs'); d.addEventListener('click', (e) => { if (!e.target.classList.contains('date-tab')) return; const t = e.target.dataset.tabId; document.querySelectorAll('.date-tab').forEach(c => c.classList.remove('active')); e.target.classList.add('active'); document.querySelectorAll('.day-content').forEach(c => c.classList.remove('active')); document.getElementById(`day-${t}`).classList.add('active'); }); }
        function attachMatchEventListeners() { const d = document.getElementById('days-content-container'); const i = document.getElementById('dismiss-icon-btn'); i.addEventListener('click', dismissFloatingIcon); d.addEventListener('submit', e => { e.preventDefault(); if (e.target.name === 'prediction-form' || e.target.name === 'match-comment-form') { handleFormSubmit(e.target); } }); d.addEventListener('click', e => { if (e.target.classList.contains('toggle-comments-btn')) handleToggleComments(e.target); }); }
        function dismissFloatingIcon() { document.getElementById('floating-icon-container').classList.add('hidden'); sessionStorage.setItem('isIconDismissed', 'true'); }
        function populateTicker() { const t = document.getElementById('predictions-ticker-content'); t.innerHTML = tickerMessages.map(m => `<span class="ticker-item">${m}</span>`).join(''); }
        
        async function handleFormSubmit(form) {
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            if (!currentUser) {
                alert('الرجاء تسجيل الدخول أولاً للمشاركة.');
                document.getElementById('user-icon-btn').click(); // Open auth modal
                return;
            }

            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
            submitBtn.disabled = true;

            const username = currentUser.user_metadata.username || currentUser.email;

            if (form.name === 'prediction-form') {
                const matchCard = form.closest('.match-card');
                const matchId = matchCard.dataset.matchId;
                const winnerRadio = form.querySelector('input[name="winner"]:checked');
                if (!winnerRadio) { alert('الرجاء اختيار نتيجة المباراة.'); submitBtn.innerHTML = originalText; submitBtn.disabled = false; return; }
                const predictionData = { 
                    match_id: parseInt(matchId), 
                    user_id: currentUser.id,
                    user_email: currentUser.email,
                    username: username, 
                    predicted_winner: winnerRadio.value, 
                    predicted_scorer: form.querySelector('input[name="scorer"]').value.trim() 
                };
                try {
                    const { error } = await supabaseClient.from('predictions').upsert(predictionData, { onConflict: 'user_id, match_id' });
                    if (error) throw error;
                    submitBtn.innerHTML = `تم الإرسال ✅`;
                    [...form.elements].forEach(el => el.disabled = true);
                } catch (error) {
                    console.error('Error submitting prediction:', error);
                    alert('حدث خطأ أثناء إرسال توقعك. قد تكون توقعت لهذه المباراة من قبل.');
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
                return;
            }
            
            if (form.name === 'match-comment-form') {
                const matchCard = form.closest('.match-card');
                const matchId = matchCard.dataset.matchId;
                const commentText = form.querySelector('textarea').value;
                try {
                    if (!commentText.trim()) { alert("لا يمكن إرسال تعليق فارغ."); throw new Error("Empty comment"); }
                    const { error } = await supabaseClient.from('comments').insert([{ 
                        match_id: parseInt(matchId), 
                        user_id: currentUser.id, 
                        author: username, 
                        comment_text: commentText 
                    }]);
                    if (error) throw error;
                    // The realtime listener will handle updating the DOM
                    form.querySelector('textarea').value = '';
                } catch (error) { 
                    console.error('Error submitting comment:', error); 
                    if (error.message !== "Empty comment") { alert('حدث خطأ أثناء إرسال تعليقك.'); }
                } finally { 
                    submitBtn.innerHTML = "إرسال"; 
                    submitBtn.disabled = false; 
                }
            }
        }
        
        async function handleToggleComments(b) { const s = b.nextElementSibling; const h = s.style.display === 'none' || !s.style.display; const l = s.querySelector('.comment-list'); const m = b.closest('.match-card'); const i = m.dataset.matchId; if (h) { s.style.display = 'block'; b.innerHTML = '💬 إخفاء التعليقات'; await fetchAndRenderMatchComments(i, l); } else { s.style.display = 'none'; b.innerHTML = '💬 التعليقات'; } }
        async function fetchAndRenderMatchComments(matchId, listElement) { listElement.innerHTML = '<p class="text-center text-gray-500 my-2">جاري تحميل التعليقات...</p>'; try { let { data: o, error: e } = await supabaseClient.from('comments').select('author, comment_text, created_at').eq('match_id', matchId).order('created_at', { ascending: true }); if (e) throw e; listElement.innerHTML = ''; if (o.length === 0) { listElement.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>'; } else { o.forEach(t => { addCommentToDOM(listElement, { author: t.author, text: t.comment_text }); }); } } catch (e) { console.error("Error fetching comments:", e); listElement.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'; } }
        function addCommentToDOM(listElement, commentData) {
    // إنشاء العناصر الأساسية
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'comment-avatar';
    avatarDiv.innerHTML = '<i class="fa-solid fa-user"></i>'; // هذا آمن لأنه نص ثابت

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'comment-body';

    // إنشاء عناصر المحتوى واستخدام textContent الآمن
    const authorSpan = document.createElement('span');
    authorSpan.className = 'comment-author';
    authorSpan.textContent = commentData.author; // <-- استخدام textContent الآمن

    const textP = document.createElement('p');
    textP.className = 'comment-text';
    textP.textContent = commentData.text; // <-- استخدام textContent الآمن

    // تجميع العناصر معًا
    bodyDiv.appendChild(authorSpan);
    bodyDiv.appendChild(textP);
    commentDiv.appendChild(avatarDiv);
    commentDiv.appendChild(bodyDiv);

    // إضافة التعليق النهائي إلى القائمة
    listElement.appendChild(commentDiv);
    listElement.scrollTop = listElement.scrollHeight;
}

        
        populateTicker();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingMatchesData = matchesData.filter(m => new Date(new Date(m.datetime).toLocaleDateString('fr-CA')) >= today);
        const matchesByDay = upcomingMatchesData.reduce((acc, m) => { const d = new Date(m.datetime).toLocaleDateString('fr-CA'); if (!acc[d]) acc[d] = []; acc[d].push(m); return acc; }, {});
        if (Object.keys(matchesByDay).length === 0) { daysContentContainer.innerHTML = `<p class="text-center text-gray-400 mt-8">لا توجد مباريات قادمة. يرجى التحقق لاحقًا.</p>`; } else { const s = Object.keys(matchesByDay).sort(); const n = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'}; s.forEach((d, i) => { const a = new Date(d + 'T00:00:00Z'); const t = a.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }).replace(/[٠-٩]/g, c => n[c]); const b = document.createElement('div'); b.className = `date-tab ${i === 0 ? 'active' : ''}`; b.textContent = t; b.dataset.tabId = d; dateTabsContainer.appendChild(b); const e = document.createElement('div'); e.className = `day-content ${i === 0 ? 'active' : ''}`; e.id = `day-${d}`; daysContentContainer.appendChild(e); const o = { 'live': 1, 'soon': 2, 'scheduled': 3, 'ended': 4 }; const r = matchesByDay[d].sort((x, y) => { const sA = getMatchStatus(x.datetime).state; const sB = getMatchStatus(y.datetime).state; if (o[sA] !== o[sB]) return o[sA] - o[sB]; return new Date(x.datetime) - new Date(y.datetime); }); renderMatchesForDay(e, r); }); }
        attachTabEventListeners();
        attachMatchEventListeners();
        loadUserPredictions(); // Check for predictions if user is already logged in
    }

    function getMatchStatus(d) { const m = new Date(d); const n = new Date(); const f = (m.getTime() - n.getTime()) / 60000; if (f < -125) return { state: 'ended' }; if (f <= 0) return { state: 'live' }; if (f <= 5) return { state: 'soon' }; return { state: 'scheduled' }; }

    // ==========================================================
    // SECTION 2: NEWS PAGE LOGIC (WITH SWIPE GESTURE)
    // ==========================================================
    function initializeNewsPage() {
        const articlesGrid = document.getElementById('articles-grid');
        const articleContent = document.getElementById('article-content');
        const newsHomePage = document.getElementById('home-page');
        const newsArticlePage = document.getElementById('article-page');
        const exitToast = document.getElementById('exit-toast');
        const commentForm = document.getElementById('comment-form');

        if (!articlesGrid || !articleContent || !newsHomePage || !newsArticlePage || !exitToast || !commentForm) {
            console.error("One or more essential news page elements are missing from the HTML.");
            return;
        }
        
        let articlesCache = [];
        let currentNewsSubPage = 'home';
        let firstBackPressTime = 0;

        async function fetchArticlesFromDB() {
            articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأخبار...</p>';
            const { data, error } = await supabaseClient.from('articles').select('id, title, image_url, content').order('created_at', { ascending: false });
            if (error) {
                console.error("Supabase error:", error);
                articlesGrid.innerHTML = `<p class="text-center text-red-500 col-span-full">فشل تحميل الأخبار. الخطأ: ${error.message}</p>`;
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
            articles.forEach(article => {
                const card = document.createElement('div');
                card.className = 'article-card';
                card.innerHTML = `<img src="${article.image_url}" alt="${article.title}" onerror="this.style.display='none'"><div class="article-title"><h3>${article.title}</h3></div>`;
                card.addEventListener('click', () => renderArticleDetail(article.id));
                articlesGrid.appendChild(card);
            });
        }
        
        function renderArticleDetail(articleId) {
            const article = articlesCache.find(a => a.id === articleId);
            if (!article) return; 

            document.getElementById('article-id-hidden-input').value = article.id;
            
            articleContent.innerHTML = `<div id="article-header"><h1>${article.title}</h1></div><img src="${article.image_url}" alt="${article.title}" onerror="this.style.display='none'"><div>${article.content}</div>`;
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
        
        document.addEventListener('backbutton', (e) => {
            e.preventDefault();
            const newsPage = document.getElementById('news-page');
            if (!newsPage || newsPage.classList.contains('hidden')) return;

            if (currentNewsSubPage === 'article') {
                navigateToSubPage('home');
            } else {
                if (new Date().getTime() - firstBackPressTime < 2000) {
                    if (navigator.app && navigator.app.exitApp) { navigator.app.exitApp(); }
                } else {
                    firstBackPressTime = new Date().getTime();
                    exitToast.classList.add('show');
                    setTimeout(() => { exitToast.classList.remove('show'); }, 2000);
                }
            }
        }, false);
        
        // --- SWIPE GESTURE LOGIC ---
        let touchStartX = 0;
        let touchEndX = 0;
        const swipeThreshold = 50; // Minimum distance for a swipe

        newsArticlePage.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        newsArticlePage.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            // Swipe from Left to Right (to go back)
            if (touchEndX > touchStartX && (touchEndX - touchStartX > swipeThreshold)) {
                if (currentNewsSubPage === 'article') {
                    navigateToSubPage('home');
                }
            }
            // Reset coordinates
            touchStartX = 0;
            touchEndX = 0;
        }
        // --- END SWIPE GESTURE LOGIC ---

        start();
    }

    async function fetchAndRenderNewsComments(articleId) {
        const commentsListDiv = document.getElementById('comments-list');
        if (!commentsListDiv) return;
        commentsListDiv.innerHTML = '<p class="text-center text-gray-400 my-2">جاري تحميل التعليقات...</p>';
        try {
            const { data, error } = await supabaseClient.from('news_comments').select('author, comment_text, created_at').eq('article_id', articleId).order('created_at', { ascending: true });
            if (error) throw error;
            commentsListDiv.innerHTML = '';
            if (data.length === 0) {
                commentsListDiv.innerHTML = '<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';
            } else {
data.forEach(comment => {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item';

    // Header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'comment-header';

    const authorSpan = document.createElement('span');
    authorSpan.className = 'comment-author';
    authorSpan.textContent = comment.author; // <-- استخدام textContent الآمن

    const dateSpan = document.createElement('span');
    dateSpan.className = 'comment-date';
    dateSpan.style.fontSize = '0.8rem';
    dateSpan.textContent = new Date(comment.created_at).toLocaleDateString('ar-EG');

    headerDiv.appendChild(authorSpan);
    headerDiv.appendChild(dateSpan);

    // Body
    const bodyP = document.createElement('p');
    bodyP.className = 'comment-body';
    bodyP.textContent = comment.comment_text; // <-- استخدام textContent الآمن
    
    // تجميع العناصر
    commentEl.appendChild(headerDiv);
    commentEl.appendChild(bodyP);
    commentsListDiv.appendChild(commentEl);
});
            }
        } catch (err) {
            console.error('Error fetching news comments:', err);
            commentsListDiv.innerHTML = '<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>';
        }
    }

    async function handleNewsCommentSubmit(event) {
        event.preventDefault(); 
        const submitBtn = document.getElementById('submit-comment-btn');
        const originalBtnText = submitBtn.textContent;
        
        if (!currentUser) {
            alert('يجب تسجيل الدخول أولاً للتعليق.');
            document.getElementById('user-icon-btn').click();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جار الإرسال...';
        
        const articleId = document.getElementById('article-id-hidden-input').value;
        const commentText = document.getElementById('comment-text').value.trim();
        const authorName = currentUser.user_metadata.username || currentUser.email;

        if (!commentText) {
            alert('لا يمكن إرسال تعليق فارغ.');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }
        
        try {
            const { data, error } = await supabaseClient.from('news_comments').insert([{ 
                article_id: parseInt(articleId), 
                user_id: currentUser.id,
                author: authorName, 
                comment_text: commentText 
            }]);
            if (error) throw error;
            // The realtime listener will handle the update
            document.getElementById('comment-text').value = ''; 
        } catch (error) {
            console.error('Error submitting news comment:', error);
            alert(`حدث خطأ أثناء إرسال تعليقك: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }

    // ==========================================================
    // SECTION 3: REALTIME FUNCTIONALITY (NEW)
    // ==========================================================
    function showNotification(message) {
        const toast = document.getElementById('notification-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    function initializeRealtimeListeners() {
        console.log("🚀 Initializing Realtime Listeners...");

        const handleRealtimeChange = (payload) => {
            console.log("Realtime change received:", payload);
            
            // Handle updates for major lists (matches and articles)
            if (payload.table === 'matches' || payload.table === 'articles') {
                const pageName = payload.table === 'matches' ? 'المباريات' : 'الأخبار';
                showNotification(`📢 تم تحديث قائمة ${pageName}!`);
                
                // Re-initialize the relevant page to get all new data
                if (payload.table === 'matches') {
                    initializePredictionsPage();
                } else {
                    initializeNewsPage();
                }
                return;
            }

            // Handle updates for match comments
            if (payload.table === 'comments') {
                const newComment = payload.new;
                const matchCard = document.querySelector(`.match-card[data-match-id='${newComment.match_id}']`);
                
                // Only update if the comments section for this specific match is open
                if (matchCard) {
                    const commentsSection = matchCard.querySelector('.comments-section');
                    if (commentsSection && commentsSection.style.display === 'block') {
                         console.log(`New comment for match ${newComment.match_id}. Refreshing its comments.`);
                         const commentList = commentsSection.querySelector('.comment-list');
                         fetchAndRenderMatchComments(newComment.match_id, commentList);
                    }
                }
                return;
            }

            // Handle updates for news comments
            if (payload.table === 'news_comments') {
                const newComment = payload.new;
                const articleIdOnPage = document.getElementById('article-id-hidden-input').value;

                // Only update if the user is currently viewing the article that received a new comment
                if (articleIdOnPage && parseInt(articleIdOnPage) === newComment.article_id) {
                    console.log(`New comment for article ${newComment.article_id}. Refreshing its comments.`);
                    showNotification('💬 تم إضافة تعليق جديد!');
                    fetchAndRenderNewsComments(newComment.article_id);
                }
                return;
            }
        };

        const channel = supabaseClient
            .channel('public-dynamic-content')
            .on(
                'postgres_changes', 
                { event: '*', schema: 'public' }, 
                handleRealtimeChange
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime channel subscribed successfully!');
                }
                if (err) {
                    console.error('Realtime subscription error:', err);
                }
            });
    }
