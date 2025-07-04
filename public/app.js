// ==========================================================
// الملف: app.js (النسخة النهائية والمعدّلة لتصحيح مشكلة الأخبار)
// ==========================================================

// SECTION 0: GLOBAL SETUP & CAPACITOR BRIDGE
const SUPABASE_URL = 'https://uxtxavurcgdeueeemmdi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dHhhdnVyY2dkZXVlZWVtbWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjQ4NzYsImV4cCI6MjA2NjYwMDg3Nn0.j7MrIoGzbzjurKyWGN0GgpMBIzl5exOsZrYlKCSmNbk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_EMAIL = "your-email@example.com";
const HOST_EMAIL = "host@example.com";

let currentUser = null;
let hasNewsLoaded = false; // ✅ متغير لمعرفة إذا تم تحميل الأخبار من قبل
let articlesCache = [];
let currentNewsSubPage = 'home';

document.addEventListener('DOMContentLoaded', () => {
    if (window.Capacitor) { console.log("Capacitor is available."); } 
    else { console.log("Capacitor is not available. Running in web mode."); }

    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');
    const predictionsPage = document.getElementById('predictions-page');
    const newsPage = document.getElementById('news-page');

    // ✅ دالة switchPage المعدّلة مع منطق التحميل عند الطلب
    function switchPage(pageToShow) {
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

        // ✅ الحل: تحميل الأخبار فقط عند الضغط على التبويب لأول مرة
        if (pageToShow === 'news' && !hasNewsLoaded) {
            initializeNewsPage();
            hasNewsLoaded = true;
        }
    }

    predictionsBtn.addEventListener('click', () => switchPage('predictions'));
    newsBtn.addEventListener('click', () => switchPage('news'));

    // ✅ ترتيب استدعاء الدوال الصحيح
    initializeAuth();
    initializePredictionsPage(); // تحميل التوقعات عند البدء
    initializeNewsPageListeners(); // فقط ربط الأحداث لصفحة الأخبار
    initializeRealtimeListeners();
    initializeGlobalEventListeners();
    initializeProfilePageListeners();
});


// ==========================================================
// SECTION 0.5: AUTHENTICATION & PUSH NOTIFICATIONS
// ==========================================================
const registerPushNotifications = async () => {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) { console.log("Push notifications not available on this platform."); return; }
  const { PushNotifications } = window.Capacitor.Plugins;
  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') { permStatus = await PushNotifications.requestPermissions(); }
    if (permStatus.receive !== 'granted') { console.warn('User denied permissions for push notifications!'); return; }
    await PushNotifications.register();
    PushNotifications.addListener('registration', async (token) => {
      console.info('Push registration success, token: ' + token.value);
      if (currentUser) {
        const { error } = await supabaseClient.from('fcm_tokens').upsert({ user_id: currentUser.id, token: token.value }, { onConflict: 'token' });
        if (error) { console.error('Error saving FCM token:', error); } else { console.log('FCM token saved successfully!'); }
      }
    });
    PushNotifications.addListener('registrationError', (err) => { console.error('Error on registration: ' + JSON.stringify(err)); });
    PushNotifications.addListener('pushNotificationReceived', (n) => { alert('إشعار جديد: ' + (n.title || '') + "\n" + (n.body || '')); });
    PushNotifications.addListener('pushNotificationActionPerformed', (n) => { console.log('Push action performed: ' + JSON.stringify(n)); });
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
        loginView.style.display = 'none'; signupView.style.display = 'none'; loggedinView.style.display = 'none';
        view.style.display = 'block'; authMessage.textContent = '';
    };
    userIconBtn.addEventListener('click', () => {
        if (currentUser) {
            const username = currentUser.user_metadata.username || currentUser.email;
            document.getElementById('user-email-display').textContent = `أهلاً بك، ${username}!`;
            showView(loggedinView);
        } else { showView(loginView); }
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
// SECTION: NEWS PAGE (Data Fetching & Rendering)
// ==========================================================
async function initializeNewsPage() {
    const articlesGrid = document.getElementById('articles-grid');
    articlesGrid.innerHTML = '<p class="text-center text-gray-400 col-span-full mt-8"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأخبار...</p>';
    
    try {
        const { data, error } = await supabaseClient.from('articles').select('id, title, image_url, content').order('created_at', { ascending: false });
        if (error) {
            console.error("Supabase error:", error);
            throw error;
        }
        articlesCache = data;
        renderArticleCards(articlesCache);
    } catch (err) {
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
    if (pageName === 'article') {
        newsHomePage.style.transform = 'translateX(-100%)';
        newsArticlePage.style.transform = 'translateX(0)';
        newsArticlePage.scrollTop = 0;
    } else {
        newsHomePage.style.transform = 'translateX(0)';
        newsArticlePage.style.transform = 'translateX(100%)';
    }
}

// هذه الدالة تربط الأحداث فقط، ويتم استدعاؤها مرة واحدة عند التحميل
function initializeNewsPageListeners() {
    const newsArticlePage = document.getElementById('article-page');
    const commentForm = document.getElementById('comment-form');
    let touchStartX = 0;
    
    newsArticlePage.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    newsArticlePage.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        // تم تعديل الشرط ليكون أكثر دقة (يمين لليسار للرجوع في واجهة عربية)
        if (Math.abs(touchEndX - touchStartX) > 50 && currentNewsSubPage === 'article') {
            navigateToSubPage('home');
        }
    }, { passive: true });

    if (commentForm) {
       commentForm.addEventListener('submit', handleNewsCommentSubmit);
    }
}


// ======================================================================
// باقي الدوال تبقى كما هي - لا حاجة للتعديل
// The rest of the functions remain the same - no changes needed
// ======================================================================

// The rest of your functions (refreshVisibleComments, loadUserPredictions, resetUIOnLogout, etc.)
// can remain exactly as they were in your "working" code. I will include them here
// for completeness, but they do not need changes.

function refreshVisibleComments(){document.querySelectorAll(".comments-section").forEach(e=>{if("block"===e.style.display){const t=e.closest(".match-card")?.dataset.matchId,c=e.querySelector(".comment-list");t&&c&&fetchAndRenderMatchComments(t,c)}});const e=document.getElementById("article-page");if("none"!==getComputedStyle(e).transform&&!e.style.transform.includes("100")){const t=document.getElementById("article-id-hidden-input").value;t&&fetchAndRenderNewsComments(t)}}
async function loadUserPredictions(){if(!currentUser)return;const{data:e,error:t}=await supabaseClient.from("predictions").select("match_id, predicted_winner, predicted_scorer").eq("user_id",currentUser.id);if(t)return void console.error("Error fetching user predictions:",t);e.forEach(e=>{const t=document.querySelector(`.match-card[data-match-id='${e.match_id}']`);if(t){const c=t.querySelector(".prediction-form"),o=c.querySelector(`input[value="${e.predicted_winner}"]`);o&&(o.checked=!0);const n=c.querySelector(".scorer-input");n&&(n.value=e.predicted_scorer||""),[...c.elements].forEach(e=>e.disabled=!0),c.querySelector(".submit-btn").innerHTML="تم الإرسال ✅"}})}
function resetUIOnLogout(){document.querySelectorAll(".prediction-form").forEach(e=>{const t=e.closest(".match-card"),c=getMatchStatus(t.dataset.datetime).state;"ended"!==c&&([...e.elements].forEach(e=>{e.disabled=!1,"radio"===e.type&&(e.checked=!1),"text"===e.type&&(e.value="")}),e.querySelector(".submit-btn").innerHTML="إرسال التوقع")})}
async function initializePredictionsPage(){try{const e=document.getElementById("matches-container");e.innerHTML='<p class="text-center text-gray-400 mt-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i> جاري تحميل المباريات...</p>';const{data:t,error:c}=await supabaseClient.from("matches").select("*").order("datetime",{ascending:!0});if(c)throw c;const o=t.map(e=>({id:e.id,team1:{name:e.team1_name,logo:e.team1_logo},team2:{name:e.team2_name,logo:e.team2_logo},league:e.league,datetime:e.datetime,channels:e.channels||[]}));e.innerHTML='<div class="date-tabs-container" id="date-tabs"></div><div id="days-content-container"></div>',initializeAppWithData(o)}catch(e){console.error("An error occurred:",e),document.getElementById("matches-container").innerHTML='<p class="text-center text-red-500 mt-8">فشل تحميل المباريات. يرجى المحاولة مرة أخرى لاحقًا.</p>'}}
function initializeAppWithData(e){const t=document.getElementById("date-tabs"),c=document.getElementById("days-content-container");function o(e,t){e.innerHTML="";if(!t||0===t.length)return;const c={"٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"};t.forEach(t=>{const n=new Date(t.datetime),a=n.toLocaleDateString("ar-EG",{weekday:"long",day:"numeric",month:"long"}).replace(/[٠-٩]/g,e=>c[e]),l=n.toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit",hour12:!0}).replace(/[٠-٩]/g,e=>c[e]),s=getMatchStatus(t.datetime);let i;switch(s.state){case"ended":i='<span class="match-status ended">انتهت</span>';break;case"live":i='<span class="match-status live">مباشر</span>';break;case"soon":i='<span class="match-status soon">بعد قليل</span>';break;default:i=`<div class="match-time">${l}</div>`}const d=(t.channels&&t.channels.length>0?t.channels.join(" / "):"غير محددة"),m="ended"===s.state,r=document.createElement("div");r.className="match-card",r.dataset.matchId=t.id,r.dataset.datetime=t.datetime,r.innerHTML=`<div class="match-header"><span class="match-league">${t.league}</span><span class="match-date-time">${a}</span></div><div class="match-body"><div class="teams-row"><div class="team"><img src="${t.team1.logo}" alt="${t.team1.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${t.team1.name}</span></div><div class="match-status-container">${i}</div><div class="team"><img src="${t.team2.logo}" alt="${t.team2.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${t.team2.name}</span></div></div><form name="prediction-form" class="prediction-form ${m?"disabled":""}"><div class="form-group"><legend class="channel-info"><i class="fa-solid fa-tv"></i> <span>${d}</span></legend></div><div class="form-group"><legend>توقع النتيجة:</legend><div class="prediction-options"><input type="radio" name="winner" id="win1-${t.id}" value="${t.team1.name}" required><label for="win1-${t.id}">${t.team1.name}</label><input type="radio" name="winner" id="draw-${t.id}" value="تعادل"><label for="draw-${t.id}">تعادل</label><input type="radio" name="winner" id="win2-${t.id}" value="${t.team2.name}"><label for="win2-${t.id}">${t.team2.name}</label></div></div><div class="form-group"><legend>من سيسجل أولاً؟ (اختياري)</legend><input type="text" name="scorer" class="scorer-input" placeholder="اكتب اسم اللاعب..."></div><div class="form-group"><button type="submit" class="submit-btn">${m?"أغلقت التوقعات":"إرسال التوقع"}</button></div></form></div><div class="match-footer"><button class="toggle-comments-btn">💬 التعليقات</button><div class="comments-section" style="display:none;"><div class="comment-list"></div><form name="match-comment-form" class="comment-form"><textarea name="comment_text" placeholder="أضف تعليقك..." required></textarea><button type="submit">إرسال</button></form></div></div>`,e.appendChild(r)})}
async function n(e,t){t.innerHTML='<p class="text-center text-gray-500 my-2">جاري تحميل التعليقات...</p>';try{const{data:c,error:o}=await supabaseClient.from("comments").select("id, author, comment_text, created_at, user_id, parent_comment_id").eq("match_id",e).order("created_at",{ascending:!0});if(o)throw o;t.innerHTML="";const n={},a=[];if(c.forEach(e=>{n[e.id]={...e,replies:[]}}),c.forEach(e=>{e.parent_comment_id&&n[e.parent_comment_id]?n[e.parent_comment_id].replies.push(n[e.id]):a.push(n[e.id])}),0===a.length)t.innerHTML='<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';else{a.forEach(e=>{a(t,e,"comments")})}}catch(e){console.error("Error fetching comments:",e),t.innerHTML='<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'}}
function a(e,t,c){const o=document.createElement("div");o.className="comment","المدير"===t.author&&o.classList.add("admin-reply"),o.dataset.commentId=t.id;const n=document.createElement("div");n.className="comment-avatar",n.innerHTML=`<i class="fa-solid fa-${"المدير"===t.author?"user-shield":"user"}"></i>`;const l=document.createElement("div");l.className="comment-body";const s=document.createElement("span");s.className="comment-author",s.textContent=t.author;const i=document.createElement("p");i.className="comment-text",i.textContent=t.comment_text,l.append(s,i),o.append(n,l),currentUser&¤tUser.id===t.user_id&&(()=>{const e=document.createElement("button");e.className="delete-comment-btn",e.innerHTML='<i class="fa-solid fa-trash-can"></i>',e.dataset.commentId=t.id,e.dataset.tableName=c,o.appendChild(e)})(),e.appendChild(o),t.replies&&t.replies.length>0&&(()=>{const o=document.createElement("div");o.className="replies-container",t.replies.forEach(e=>{a(o,e,c)}),e.appendChild(o)})()}
const l=new Date;l.setHours(0,0,0,0);const s=e.filter(e=>new Date(new Date(e.datetime).toLocaleDateString("fr-CA"))>=l),i=s.reduce((e,t)=>{const c=new Date(t.datetime).toLocaleDateString("fr-CA");return e[c]||(e[c]=[]),e[c].push(t),e},{});if(0===Object.keys(i).length)c.innerHTML='<p class="text-center text-gray-400 mt-8">لا توجد مباريات قادمة. يرجى التحقق لاحقًا.</p>';else{const e=Object.keys(i).sort(),n={"٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"};e.forEach((e,a)=>{const l=new Date(e+"T00:00:00Z"),s=l.toLocaleDateString("ar-EG",{day:"numeric",month:"long"}).replace(/[٠-٩]/g,e=>n[e]),d=document.createElement("div");d.className=`date-tab ${0===a?"active":""}`,d.textContent=s,d.dataset.tabId=e,t.appendChild(d);const m=document.createElement("div");m.className=`day-content ${0===a?"active":""}`,m.id=`day-${e}`,c.appendChild(m);const r={"live":1,"soon":2,"scheduled":3,"ended":4},u=i[e].sort((e,t)=>{const c=getMatchStatus(e.datetime).state,o=getMatchStatus(t.datetime).state;return r[c]!==r[o]?r[c]-r[o]:new Date(e.datetime)-new Date(t.datetime)});o(m,u)})}
(function(){const e=document.getElementById("date-tabs");e.addEventListener("click",e=>{if(!e.target.classList.contains("date-tab"))return;const t=e.target.dataset.tabId;document.querySelectorAll(".date-tab").forEach(e=>e.classList.remove("active")),e.target.classList.add("active"),document.querySelectorAll(".day-content").forEach(e=>e.classList.remove("active")),document.getElementById(`day-${t}`).classList.add("active")})})(),(function(){const e=document.getElementById("days-content-container");e.addEventListener("submit",t=>{t.preventDefault(),("prediction-form"===t.target.name||"match-comment-form"===t.target.name)&&(async function(e){const t=e.querySelector('button[type="submit"]');if(!currentUser)return alert("الرجاء تسجيل الدخول أولاً للمشاركة."),void document.getElementById("user-icon-btn").click();t.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>',t.disabled=!0;const c=currentUser.user_metadata.username||currentUser.email;if("prediction-form"===e.name){const o=e.closest(".match-card").dataset.matchId,n=e.querySelector('input[name="winner"]:checked');if(!n)return alert("الرجاء اختيار نتيجة المباراة."),t.innerHTML="إرسال التوقع",void(t.disabled=!1);const a={match_id:parseInt(o),user_id:currentUser.id,user_email:currentUser.email,username:c,predicted_winner:n.value,predicted_scorer:e.querySelector('input[name="scorer"]').value.trim()};try{const{error:e}=await supabaseClient.from("predictions").upsert(a,{onConflict:"user_id, match_id"});if(e)throw e;t.innerHTML="تم الإرسال ✅",[...e.elements].forEach(e=>e.disabled=!0)}catch(e){console.error("Error submitting prediction:",e),alert("حدث خطأ أثناء إرسال توقعك."),t.innerHTML="إرسال التوقع",t.disabled=!1}return}if("match-comment-form"===e.name){const t=e.closest(".match-card").dataset.matchId,o=e.querySelector("textarea").value;try{if(!o.trim())throw alert("لا يمكن إرسال تعليق فارغ."),new Error("Empty comment");const{error:c}=await supabaseClient.from("comments").insert([{match_id:parseInt(t),user_id:currentUser.id,author:c,comment_text:o}]);if(c)throw c;e.querySelector("textarea").value=""}catch(e){"Empty comment"!==e.message&&alert("حدث خطأ أثناء إرسال تعليقك.")}finally{submitBtn.innerHTML="إرسال",submitBtn.disabled=!1}})(t.target)}),e.addEventListener("click",e=>{e.target.classList.contains("toggle-comments-btn")&& (async function(e){const t=e.nextElementSibling,c=null===t.style.display||"none"===t.style.display||!t.style.display,o=t.querySelector(".comment-list"),a=e.closest(".match-card").dataset.matchId;c?(t.style.display="block",e.innerHTML="💬 إخفاء التعليقات",await n(a,o)):(t.style.display="none",e.innerHTML="💬 التعليقات")})(e.target)})})(),loadUserPredictions()}
function getMatchStatus(e){const t=new Date(e),c=new Date,o=(t.getTime()-c.getTime())/6e4;return o<-125?{state:"ended"}:o<=0?{state:"live"}:o<=5?{state:"soon"}:{state:"scheduled"}}
async function fetchAndRenderNewsComments(e){const t=document.getElementById("comments-list");if(!t)return;t.innerHTML='<p class="text-center text-gray-400 my-2">جاري تحميل التعليقات...</p>';try{const{data:c,error:o}=await supabaseClient.from("news_comments").select("id, author, comment_text, created_at, user_id, parent_comment_id").eq("article_id",e).order("created_at",{ascending:!0});if(o)throw o;t.innerHTML="";const n={},a=[];if(c.forEach(e=>{n[e.id]={...e,replies:[]}}),c.forEach(e=>{e.parent_comment_id&&n[e.parent_comment_id]?n[e.parent_comment_id].replies.push(n[e.id]):a.push(n[e.id])}),0===a.length)t.innerHTML='<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>';else{a.forEach(e=>{addNewsCommentToDOM(t,e)})}}catch(e){console.error("Error fetching news comments:",e),t.innerHTML='<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'}}
function addNewsCommentToDOM(e,t){const c=document.createElement("div");c.className="comment-item","المدير"===t.author&&c.classList.add("admin-reply"),c.dataset.commentId=t.id;const o=document.createElement("div");o.className="comment-header";const n=document.createElement("span");n.className="comment-author",t.parent_comment_id?n.innerHTML=`<i class="fa-solid fa-reply fa-flip-horizontal" style="margin-left: 5px;"></i> ${t.author}`:n.textContent=t.author;const a=document.createElement("span");a.className="comment-date",a.style.fontSize="0.8rem",a.textContent=new Date(t.created_at).toLocaleDateString("ar-EG"),o.append(n,a);const l=document.createElement("p");l.className="comment-body",l.textContent=t.comment_text,c.append(o,l),currentUser&¤tUser.id===t.user_id&&(()=>{const e=document.createElement("button");e.className="delete-comment-btn",e.innerHTML='<i class="fa-solid fa-trash-can"></i>',e.dataset.commentId=t.id,e.dataset.tableName="news_comments",c.appendChild(e)})(),e.appendChild(c),t.replies&&t.replies.length>0&&(()=>{const c=document.createElement("div");c.className="news-replies-container",t.replies.forEach(t=>{addNewsCommentToDOM(c,t)}),e.appendChild(c)})()}
async function handleNewsCommentSubmit(e){e.preventDefault();const t=document.getElementById("submit-comment-btn");if(!currentUser)return alert("يجب تسجيل الدخول أولاً للتعليق."),void document.getElementById("user-icon-btn").click();t.disabled=!0,t.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> جار الإرسال...';const c=document.getElementById("article-id-hidden-input").value,o=document.getElementById("comment-text").value.trim();if(!o)return alert("لا يمكن إرسال تعليق فارغ."),t.disabled=!1,void(t.textContent="إرسال التعليق");try{const{error:e}=await supabaseClient.from("news_comments").insert([{article_id:parseInt(c),user_id:currentUser.id,author:currentUser.user_metadata.username||currentUser.email,comment_text:o}]);if(e)throw e;document.getElementById("comment-text").value=""}catch(e){console.error("Error submitting news comment:",e),alert(`حدث خطأ أثناء إرسال تعليقك: ${e.message}`)}finally{t.disabled=!1,t.textContent="إرسال التعليق"}}
function showNotification(e){const t=document.getElementById("notification-toast");t&&(t.textContent=e,t.classList.add("show"),setTimeout(()=>{t.classList.remove("show")},3500))}
function initializeRealtimeListeners(){supabaseClient.channel("public-dynamic-content").on("postgres_changes",{event:"*",schema:"public"},e=>{if(("matches"===e.table||"articles"===e.table)&&"DELETE"!==e.eventType){const t="matches"===e.table?"المباريات":"الأخبار";return showNotification(`📢 تم تحديث قائمة ${t}!`),void("matches"===e.table?initializePredictionsPage():initializeNewsPage())}if("comments"===e.table){const t=document.querySelector(`.match-card[data-match-id='${e.new?.match_id||e.old?.id}']`);if(t&&"block"===t.querySelector(".comments-section").style.display){const c=t.querySelector(".comment-list");fetchAndRenderMatchComments(e.new?.match_id,c)}return}if("news_comments"===e.table){const t=document.getElementById("article-id-hidden-input").value;t&&parseInt(t)===(e.new?.article_id||e.old?.article_id)&&("INSERT"===e.eventType&&showNotification("💬 تم إضافة تعليق جديد!"),fetchAndRenderNewsComments(t))}}).subscribe((e,t)=>{_,"SUBSCRIBED"===e&&console.log("✅ Realtime channel subscribed successfully!"),t&&console.error("Realtime subscription error:",t)})}
function initializeGlobalEventListeners(){document.addEventListener("click",async function(e){const t=e.target.closest(".delete-comment-btn");if(t){e.preventDefault();const c=t.dataset.commentId,o=t.dataset.tableName;if(confirm("هل أنت متأكد من أنك تريد حذف هذا التعليق؟"))try{const{error:e}=await supabaseClient.from(o).delete().eq("id",c);if(e)throw e;const n=t.closest(".comment, .comment-item");if(n){const e=n.nextElementSibling;e&&(e.classList.contains("replies-container")||e.classList.contains("news-replies-container"))&&e.remove(),n.remove()}showNotification("تم حذف التعليق بنجاح.")}catch(e){console.error("Error deleting comment:",e),alert("حدث خطأ أثناء حذف التعليق.")}}}})}
let profilePage,closeProfileBtn,saveUsernameBtn,profileCommentsList;function initializeProfilePageListeners(){profilePage=document.getElementById("profile-page"),closeProfileBtn=document.getElementById("close-profile-btn"),saveUsernameBtn=document.getElementById("save-username-btn"),profileCommentsList=document.getElementById("profile-comments-list"),closeProfileBtn&&closeProfileBtn.addEventListener("click",closeProfilePage),saveUsernameBtn&&saveUsernameBtn.addEventListener("click",handleUpdateUsername),profileCommentsList&&profileCommentsList.addEventListener("click",handleDeleteComment)}
function openProfilePage(){if(!currentUser||!profilePage)return;document.getElementById("auth-modal").classList.remove("show"),profilePage.classList.remove("hidden"),setTimeout(()=>{profilePage.classList.add("is-visible")},10),loadProfileData()}
function closeProfilePage(){if(!profilePage)return;const e=()=>{profilePage.classList.add("hidden"),profilePage.removeEventListener("transitionend",e)};profilePage.addEventListener("transitionend",e,{once:!0}),profilePage.classList.remove("is-visible"),setTimeout(()=>{profilePage.classList.contains("hidden")||e()},500)}
async function loadProfileData(){if(!currentUser)return;const e=document.getElementById("profile-username-input"),t=document.getElementById("profile-predictions-list"),c=document.getElementById("profile-comments-list"),o=document.getElementById("username-status");e&&(e.value=currentUser.user_metadata.username||""),o&&(o.textContent=""),t&&(t.innerHTML='<p class="text-gray-400">جاري تحميل التوقعات...</p>'),c&&(c.innerHTML='<p class="text-gray-400">جاري تحميل التعليقات...</p>'),fetchAndRenderProfilePredictions(),fetchAndRenderProfileComments()}
async function fetchAndRenderProfilePredictions(){const e=document.getElementById("profile-predictions-list");if(!e)return;const{data:t,error:c}=await supabaseClient.from("predictions").select("\n            predicted_winner, \n            predicted_scorer, \n            matches ( \n                team1_name, \n                team2_name, \n                actual_winner, \n                actual_scorer \n            )\n        ").eq("user_id",currentUser.id).order("created_at",{ascending:!1});if(c)return console.error("Error fetching profile predictions:",c),void(e.innerHTML='<p class="text-red-500">فشل تحميل التوقعات.</p>');if(0===t.length)return void(e.innerHTML='<p class="text-gray-400">لم تقم بأي توقعات بعد.</p>');e.innerHTML=t.map(e=>{if(!e.matches)return"";let t="pending",c="⏳",o="قيد الانتظار";return e.matches.actual_winner&&(e.predicted_winner===e.matches.actual_winner?(t="correct",c="✅",o="توقع صحيح"):(t="incorrect",c="❌",o=`توقع خاطئ (الفائز: ${e.matches.actual_winner})`)),`<div class="profile-prediction-item ${t}"><div class="prediction-match-info"><span>${e.matches.team1_name} ضد ${e.matches.team2_name}</span><span class="prediction-status">${c} ${o}</span></div><div class="prediction-details">توقعت فوز: <strong>${e.predicted_winner}</strong>${e.predicted_scorer?` | ومسجل الهدف الأول: <strong>${e.predicted_scorer}</strong>`:""}</div></div>`}).join("")}
async function fetchAndRenderProfileComments(){const e=document.getElementById("profile-comments-list");if(!e)return;const[t,c]=await Promise.all([supabaseClient.from("comments").select("id, comment_text, created_at, matches(team1_name, team2_name)").eq("user_id",currentUser.id),supabaseClient.from("news_comments").select("id, comment_text, created_at, articles(title)").eq("user_id",currentUser.id)]);if(t.error||c.error)return void(e.innerHTML='<p class="text-red-500">فشل تحميل التعليقات.</p>');const o=[...t.data.map(e=>({...e,type:"match",table:"comments"})),...c.data.map(e=>({...e,type:"news",table:"news_comments"}))].sort((e,t)=>new Date(t.created_at)-new Date(e.created_at));if(0===o.length)return void(e.innerHTML='<p class="text-gray-400">لم تقم بأي تعليقات بعد.</p>');e.innerHTML=o.map(e=>{const t="match"===e.type?e.matches?`مباراة ${e.matches.team1_name} ضد ${e.matches.team2_name}`:"مباراة محذوفة":e.articles?`مقال "${e.articles.title}"`:"مقال محذوف";return`<div class="profile-comment-item" id="profile-comment-${e.id}-${e.table}"><div class="comment-content"><span class="comment-text">${e.comment_text}</span><span class="comment-meta">عن: ${t}</span></div><button class="delete-comment-btn-profile" data-comment-id="${e.id}" data-table="${e.table}">حذف</button></div>`}).join("")}
async function handleUpdateUsername(e){const t=e.target,c=document.getElementById("profile-username-input"),o=document.getElementById("username-status"),n=c.value.trim();if(n.length<3)return o.textContent="يجب أن يكون الاسم 3 أحرف على الأقل.",void(o.style.color="var(--danger-color)");t.disabled=!0,t.textContent="...",o.textContent="جاري الحفظ...",o.style.color="var(--secondary-text-color)";const{error:a}=await supabaseClient.auth.updateUser({data:{username:n}});a?(o.textContent=`خطأ: ${a.message}`,o.style.color="var(--danger-color)"):(o.textContent="تم حفظ الاسم بنجاح!",o.style.color="var(--success-color)",currentUser.user_metadata.username=n),t.disabled=!1,t.textContent="حفظ"}
async function handleDeleteComment(e){if(!e.target.classList.contains("delete-comment-btn-profile"))return;const t=e.target,c=t.dataset.commentId,o=t.dataset.table;if(!confirm("هل أنت متأكد من حذف هذا التعليق نهائياً؟"))return;t.disabled=!0,t.textContent="...";const{error:n}=await supabaseClient.from(o).delete().eq("id",c).eq("user_id",currentUser.id);n?(alert(`فشل حذف التعليق: ${n.message}`),t.disabled=!1,t.textContent="حذف"):document.getElementById(`profile-comment-${c}-${o}`)?.remove()}
window.addEventListener("load",()=>{const e=document.getElementById("loader");e&&(e.style.display="none")});
