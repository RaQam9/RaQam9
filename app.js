// ==========================================================
// SECTION 0: GLOBAL SETUP (Supabase, Constants)
// ==========================================================
const SUPABASE_URL = 'https://uxtxavurcgdeueeemmdi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dHhhdnVyY2dkZXVlZWVtbWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjQ4NzYsImV4cCI6MjA2NjYwMDg3Nn0.j7MrIoGzbzjurKyWGN0GgpMBIzl5exOsZrYlKCSmNbk';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const HOST_EMAIL = "host@example.com";
let currentUser = null;
let articlesCache = [];

// ==========================================================
//      INITIALIZATION & PAGE SWITCHING
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Page Switching
    document.getElementById('nav-predictions-btn').addEventListener('click', () => switchPage('predictions'));
    document.getElementById('nav-news-btn').addEventListener('click', () => switchPage('news'));

    // Initialize all app sections
    initializeAuth();
    initializePredictionsPage();
    initializeNewsPage();
    initializeRealtimeListeners();
    initializeProfilePageListeners();
});

function switchPage(pageToShow) {
    const predictionsPage = document.getElementById('predictions-page');
    const newsPage = document.getElementById('news-page');
    const predictionsBtn = document.getElementById('nav-predictions-btn');
    const newsBtn = document.getElementById('nav-news-btn');

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
            document.getElementById('user-email-display').textContent = `أنت مسجل بـ: ${currentUser.email}`;
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
        const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { username: username } } });
        if (error) { authMessage.textContent = `خطأ: ${error.message}`; }
        else { authMessage.textContent = 'تم! يرجى مراجعة بريدك لتفعيل الحساب.'; signupForm.reset(); }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        authMessage.textContent = 'جاري تسجيل الدخول...';
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { authMessage.textContent = `خطأ: ${error.message}`; }
        else { authMessage.textContent = 'تم تسجيل الدخول!'; loginForm.reset(); setTimeout(closeAuthModal, 1000); }
    });

    logoutBtn.addEventListener('click', async () => {
        authMessage.textContent = 'جاري تسجيل الخروج...';
        await supabaseClient.auth.signOut();
        authMessage.textContent = '';
        closeAuthModal();
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
        const userIcon = document.getElementById('user-icon-btn');
        if (event === 'SIGNED_IN' || event === "INITIAL_SESSION") {
            currentUser = session.user;
            userIcon.classList.add('logged-in');
            userIcon.innerHTML = `<i class="fa-solid fa-user-check"></i>`;
            loadUserPredictions();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            userIcon.classList.remove('logged-in');
            userIcon.innerHTML = `<i class="fa-solid fa-user-pen"></i>`;
            resetUIOnLogout();
        }
    });
}

async function loadUserPredictions() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient.from('predictions').select('match_id, predicted_winner, predicted_scorer').eq('user_id', currentUser.id);
    if (error) return;
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
async function initializePredictionsPage(){try{const t=document.getElementById("matches-container");t.innerHTML='<p class="text-center text-gray-400 mt-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i> جاري تحميل المباريات...</p>';let{data:e,error:a}=await supabaseClient.from("matches").select("*").order("datetime",{ascending:!0});if(a)throw a;const n=e.map(t=>({id:t.id,team1:{name:t.team1_name,logo:t.team1_logo},team2:{name:t.team2_name,logo:t.team2_logo},league:t.league,datetime:t.datetime,channels:t.channels||[]}));document.getElementById("matches-container").innerHTML='<div class="date-tabs-container" id="date-tabs"></div><div id="days-content-container"></div>',initializeAppWithData(n)}catch(t){console.error("An error occurred:",t);const e=document.getElementById("matches-container");e&&(e.innerHTML='<p class="text-center text-red-500 mt-8">فشل تحميل المباريات. يرجى المحاولة مرة أخرى لاحقًا.</p>')}}function initializeAppWithData(t){function e(t,e){t.innerHTML="",e&&0!==e.length&&e.forEach(e=>{const a=new Date(e.datetime),n={"٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"},i=a.toLocaleDateString("ar-EG",{weekday:"long",day:"numeric",month:"long"}).replace(/[٠-٩]/g,t=>n[t]),o=a.toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit",hour12:!0}).replace(/[٠-٩]/g,t=>n[t]),d=getMatchStatus(e.datetime);let r;switch(d.state){case"ended":r='<span class="match-status ended">انتهت</span>';break;case"live":r='<span class="match-status live">مباشر</span>';break;case"soon":r='<span class="match-status soon">بعد قليل</span>';break;default:r=`<div class="match-time">${o}</div>`}const s=e.channels&&e.channels.length>0?e.channels.join(" / "):"غير محددة",c="ended"===d.state,l=document.createElement("div");l.className="match-card",l.dataset.matchId=e.id,l.dataset.datetime=e.datetime,l.innerHTML=`<div class="match-header"><span class="match-league">${e.league}</span><span class="match-date-time">${i}</span></div><div class="match-body"><div class="teams-row"><div class="team"><img src="${e.team1.logo}" alt="${e.team1.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${e.team1.name}</span></div><div class="match-status-container">${r}</div><div class="team"><img src="${e.team2.logo}" alt="${e.team2.name}" onerror="this.onerror=null;this.src='https://via.placeholder.com/50';"><span class="team-name">${e.team2.name}</span></div></div><form name="prediction-form" class="prediction-form ${c?"disabled":""}"><div class="form-group"><legend class="channel-info"><i class="fa-solid fa-tv"></i> <span>${s}</span></legend></div><div class="form-group"><legend>توقع النتيجة:</legend><div class="prediction-options"><input type="radio" name="winner" id="win1-${e.id}" value="${e.team1.name}" required><label for="win1-${e.id}">${e.team1.name}</label><input type="radio" name="winner" id="draw-${e.id}" value="تعادل"><label for="draw-${e.id}">تعادل</label><input type="radio" name="winner" id="win2-${e.id}" value="${e.team2.name}"><label for="win2-${e.id}">${e.team2.name}</label></div></div><div class="form-group"><legend>من سيسجل أولاً؟ (اختياري)</legend><input type="text" name="scorer" class="scorer-input" placeholder="اكتب اسم اللاعب..."></div><div class="form-group"><button type="submit" class="submit-btn">${c?"أغلقت التوقعات":"إرسال التوقع"}</button></div></form></div><div class="match-footer"><button class="toggle-comments-btn" ${c?"disabled":""}>💬 التعليقات</button><div class="comments-section" style="display:none;"><div class="comment-list"></div><form name="match-comment-form" class="comment-form"><textarea name="comment_text" placeholder="أضف تعليقك..." required></textarea><button type="submit">إرسال</button></form></div></div>`,t.appendChild(l)})}function a(){document.getElementById("date-tabs").addEventListener("click",t=>{if(!t.target.classList.contains("date-tab"))return;const e=t.target.dataset.tabId;document.querySelectorAll(".date-tab").forEach(t=>t.classList.remove("active")),t.target.classList.add("active"),document.querySelectorAll(".day-content").forEach(t=>t.classList.remove("active")),document.getElementById(`day-${e}`).classList.add("active")})}function n(){const t=document.getElementById("days-content-container"),e=document.getElementById("dismiss-icon-btn");e.addEventListener("click",()=>{document.getElementById("floating-icon-container").classList.add("hidden"),sessionStorage.setItem("isIconDismissed","true")}),t.addEventListener("submit",t=>{t.preventDefault(),("prediction-form"===t.target.name||"match-comment-form"===t.target.name)&&async function(t){const e=t.querySelector('button[type="submit"]'),a=e.innerHTML;if(!currentUser)return alert("الرجاء تسجيل الدخول أولاً للمشاركة."),void document.getElementById("user-icon-btn").click();e.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>',e.disabled=!0;const n=currentUser.user_metadata.username||currentUser.email;if("prediction-form"===t.name){const i=t.closest(".match-card"),o=i.dataset.matchId,d=t.querySelector('input[name="winner"]:checked');if(!d)return alert("الرجاء اختيار نتيجة المباراة."),e.innerHTML=a,void(e.disabled=!1);const r={match_id:parseInt(o),user_id:currentUser.id,user_email:currentUser.email,username:n,predicted_winner:d.value,predicted_scorer:t.querySelector('input[name="scorer"]').value.trim()};try{const{error:t}=await supabaseClient.from("predictions").upsert(r,{onConflict:"user_id, match_id"});if(t)throw t;e.innerHTML="تم الإرسال ✅",[...t.elements].forEach(t=>t.disabled=!0)}catch(t){console.error("Error submitting prediction:",t),alert("حدث خطأ أثناء إرسال توقعك. قد تكون توقعت لهذه المباراة من قبل."),e.innerHTML=a,e.disabled=!1}return}if("match-comment-form"===t.name){const a=t.closest(".match-card"),i=a.dataset.matchId,o=t.querySelector("textarea").value;try{if(!o.trim())throw new Error("Empty comment");const{error:a}=await supabaseClient.from("comments").insert([{match_id:parseInt(i),user_id:currentUser.id,author:n,comment_text:o}]);if(a)throw a;t.querySelector("textarea").value=""}catch(t){"Empty comment"!==t.message&&alert("حدث خطأ أثناء إرسال تعليقك.")}finally{e.innerHTML="إرسال",e.disabled=!1}}}(t.target)}),t.addEventListener("click",t=>{t.target.classList.contains("toggle-comments-btn")&&async function(t){const e=t.nextElementSibling,a=null===e.style.display||"none"===e.style.display||!e.style.display,n=e.querySelector(".comment-list"),i=t.closest(".match-card").dataset.matchId;if(a)e.style.display="block",t.innerHTML="💬 إخفاء التعليقات",await async function(t,e){e.innerHTML='<p class="text-center text-gray-500 my-2">جاري تحميل التعليقات...</p>';try{let{data:a,error:n}=await supabaseClient.from("comments").select("author, comment_text, created_at").eq("match_id",t).order("created_at",{ascending:!0});if(n)throw n;e.innerHTML="",0===a.length?e.innerHTML='<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>':a.forEach(t=>{addCommentToDOM(e, { author: t.author, text: t.comment_text })})}catch(t){e.innerHTML='<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'}}(i,n);else e.style.display="none",t.innerHTML="💬 التعليقات"}(t.target)})}function addCommentToDOM(l, d) { const c = document.createElement('div'); c.className = 'comment'; const avatar = document.createElement('div'); avatar.className = 'comment-avatar'; avatar.innerHTML = '<i class="fa-solid fa-user"></i>'; const body = document.createElement('div'); body.className = 'comment-body'; const author = document.createElement('span'); author.className = 'comment-author'; author.textContent = d.author; const text = document.createElement('p'); text.className = 'comment-text'; text.textContent = d.text; body.append(author, text); c.append(avatar, body); l.appendChild(c); l.scrollTop = l.scrollHeight; }const i=document.getElementById("predictions-ticker-content"),o=["🏆 سيتم تكريم أفضل المتوقعين في نهاية كل أسبوع!","💡 سجل دخولك للمشاركة في السحب.","🔥 تابعونا في تغطية خاصة لمباريات كأس العالم للأندية."];i.innerHTML=o.map(t=>`<span class="ticker-item">${t}</span>`).join("");const d=new Date;d.setHours(0,0,0,0);const r=t.filter(t=>new Date(new Date(t.datetime).toLocaleDateString("fr-CA"))>=d).reduce((t,e)=>{const a=new Date(e.datetime).toLocaleDateString("fr-CA");return t[a]||(t[a]=[]),t[a].push(e),t},{});if(0===Object.keys(r).length)daysContentContainer.innerHTML='<p class="text-center text-gray-400 mt-8">لا توجد مباريات قادمة. يرجى التحقق لاحقًا.</p>';else{const t=Object.keys(r).sort(),i={"٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"};t.forEach((o,s)=>{const c=new Date(o+"T00:00:00Z").toLocaleDateString("ar-EG",{day:"numeric",month:"long"}).replace(/[٠-٩]/g,t=>i[t]),l=document.createElement("div");l.className=`date-tab ${0===s?"active":""}`,l.textContent=c,l.dataset.tabId=o,dateTabsContainer.appendChild(l);const d=document.createElement("div");d.className=`day-content ${0===s?"active":""}`,d.id=`day-${o}`,daysContentContainer.appendChild(d);const m={"live":1,"soon":2,"scheduled":3,"ended":4},p=r[o].sort((t,e)=>{const a=getMatchStatus(t.datetime).state,n=getMatchStatus(e.datetime).state;return m[a]!==m[n]?m[a]-m[n]:new Date(t.datetime)-new Date(e.datetime)});e(d,p)})}a(),n(),loadUserPredictions()}function getMatchStatus(t){const e=new Date(t),a=(e.getTime()-Date.now())/6e4;return a<-125?{state:"ended"}:a<=0?{state:"live"}:a<=5?{state:"soon"}:{state:"scheduled"}}

// ==========================================================
// SECTION 2: NEWS PAGE LOGIC
// ==========================================================
function initializeNewsPage(){const t=document.getElementById("articles-grid"),e=document.getElementById("article-content"),a=document.getElementById("home-page"),n=document.getElementById("article-page"),i=document.getElementById("exit-toast"),o=document.getElementById("comment-form");if(!t||!e||!a||!n||!i||!o)return;let d="home",r=0;async function s(){t.innerHTML='<p class="text-center text-gray-400 col-span-full"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأخبار...</p>';const{data:e,error:a}=await supabaseClient.from("articles").select("id, title, image_url, content").order("created_at",{ascending:!1});return a?(console.error("Supabase error:",a),t.innerHTML=`<p class="text-center text-red-500 col-span-full">فشل تحميل الأخبار.</p>`,null):(articlesCache=e,e)}function c(e){t.innerHTML="",e&&0!==e.length?e.forEach(e=>{const a=document.createElement("div");a.className="article-card",a.innerHTML=`<img src="${e.image_url}" alt="${e.title}" onerror="this.style.display='none'"><div class="article-title"><h3>${e.title}</h3></div>`,a.addEventListener("click",()=>l(e.id)),t.appendChild(a)}):t.innerHTML='<p class="text-center text-gray-400 col-span-full">لا توجد أخبار متاحة حالياً.</p>'}function l(t){const a=articlesCache.find(e=>e.id===t);a&&(document.getElementById("article-id-hidden-input").value=a.id,e.innerHTML=`<div id="article-header"><h1>${a.title}</h1></div><img src="${a.image_url}" alt="${a.title}" onerror="this.style.display='none'"><div>${a.content}</div>`,m("article"),fetchAndRenderNewsComments(a.id))}function m(t){d=t,"article"===t?(a.style.transform="translateX(-100%)",n.style.transform="translateX(0)",n.scrollTop=0):(a.style.transform="translateX(0)",n.style.transform="translateX(100%)")}o.addEventListener("submit",handleNewsCommentSubmit),document.addEventListener("backbutton",t=>{t.preventDefault(),document.getElementById("news-page").classList.contains("hidden")||("article"===d?m("home"):(new Date).getTime()-r<2e3?navigator.app&&navigator.app.exitApp&&navigator.app.exitApp():(r=(new Date).getTime(),i.classList.add("show"),setTimeout(()=>{i.classList.remove("show")},2e3)))}),async function(){const t=await s();t&&c(t)}();let p=0;n.addEventListener("touchstart",t=>{p=t.changedTouches[0].screenX},{passive:!0}),n.addEventListener("touchend",t=>{const e=t.changedTouches[0].screenX;e>p&&e-p>50&&"article"===d&&m("home")},{passive:!0})}async function fetchAndRenderNewsComments(t){const e=document.getElementById("comments-list");if(!e)return;e.innerHTML='<p class="text-center text-gray-400 my-2">جاري تحميل التعليقات...</p>';try{const{data:a,error:n}=await supabaseClient.from("news_comments").select("author, comment_text, created_at").eq("article_id",t).order("created_at",{ascending:!0});if(n)throw n;e.innerHTML="",0===a.length?e.innerHTML='<p class="text-center text-gray-500 my-2">لا توجد تعليقات. كن أول من يعلق!</p>':a.forEach(t=>{const a=document.createElement("div");a.className="comment-item",a.innerHTML=`<div class="comment-header"><span class="comment-author">${t.author}</span><span class="comment-date" style="font-size: 0.8rem;">${new Date(t.created_at).toLocaleDateString("ar-EG")}</span></div><p class="comment-body">${t.comment_text}</p>`,e.appendChild(a)})}catch(t){console.error("Error fetching news comments:",t),e.innerHTML='<p class="text-center text-red-500 my-2">فشل تحميل التعليقات.</p>'}}async function handleNewsCommentSubmit(t){t.preventDefault();const e=document.getElementById("submit-comment-btn"),a=e.textContent;if(!currentUser)return alert("يجب تسجيل الدخول أولاً للتعليق."),void document.getElementById("user-icon-btn").click();e.disabled=!0,e.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> جار الإرسال...';const n=document.getElementById("article-id-hidden-input").value,i=document.getElementById("comment-text").value.trim(),o=currentUser.user_metadata.username||currentUser.email;if(!i)return alert("لا يمكن إرسال تعليق فارغ."),e.disabled=!1,void(e.textContent=a);try{const{error:t}=await supabaseClient.from("news_comments").insert([{article_id:parseInt(n),user_id:currentUser.id,author:o,comment_text:i}]);if(t)throw t;document.getElementById("comment-text").value=""}catch(t){console.error("Error submitting news comment:",t),alert(`حدث خطأ أثناء إرسال تعليقك: ${t.message}`)}finally{e.disabled=!1,e.textContent=a}}

// ==========================================================
// SECTION 3: REALTIME FUNCTIONALITY
// ==========================================================
function showNotification(t){const e=document.getElementById("notification-toast");e&&(e.textContent=t,e.classList.add("show"),setTimeout(()=>{e.classList.remove("show")},3500))}function initializeRealtimeListeners(){const t=t=>{if("matches"===t.table||"articles"===t.table)return showNotification(`📢 تم تحديث قائمة ${"matches"===t.table?"المباريات":"الأخبار"}!`),(t.table==="matches"?initializePredictionsPage:initializeNewsPage)();if("comments"===t.table){const e=document.querySelector(`.match-card[data-match-id='${t.new?.match_id||t.old?.id}']`);if(e&&"block"===e.querySelector(".comments-section").style.display){const a=e.querySelector(".comment-list");fetchAndRenderMatchComments(t.new?.match_id||t.old?.id,a)}return}if("news_comments"===t.table){const e=document.getElementById("article-id-hidden-input").value;if(e&&parseInt(e)===t.new?.article_id||t.old?.id)return"INSERT"===t.eventType&&showNotification("💬 تم إضافة تعليق جديد!"),void fetchAndRenderNewsComments(e)}};supabaseClient.channel("public-dynamic-content").on("postgres_changes",{event:"*",schema:"public"},t).subscribe((t,e)=>{ "SUBSCRIBED"===t&&console.log("✅ Realtime channel subscribed successfully!"),e&&console.error("Realtime subscription error:",e)})}

// ===================================
//      PROFILE PAGE LOGIC
// ===================================
let profilePage, openProfileBtn, closeProfileBtn, saveUsernameBtn, profileCommentsList;

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
    document.getElementById('auth-modal').classList.remove('show');
    profilePage.classList.remove('hidden');
    setTimeout(() => { profilePage.style.transform = 'translateX(0)'; }, 10);
    loadProfileData();
}

function closeProfilePage() {
    profilePage.style.transform = 'translateX(100%)';
    setTimeout(() => { profilePage.classList.add('hidden'); }, 300);
}

async function loadProfileData() {
    if (!currentUser) return;
    const usernameInput = document.getElementById('profile-username-input');
    document.getElementById('profile-predictions-list').innerHTML = '<p class="text-gray-400">جاري تحميل التوقعات...</p>';
    document.getElementById('profile-comments-list').innerHTML = '<p class="text-gray-400">جاري تحميل التعليقات...</p>';
    usernameInput.value = currentUser.user_metadata.username || '';
    fetchAndRenderProfilePredictions();
    fetchAndRenderProfileComments();
}

async function fetchAndRenderProfilePredictions() {
    const listDiv = document.getElementById('profile-predictions-list');
    const { data, error } = await supabaseClient.from('predictions').select(`predicted_winner, predicted_scorer, matches ( team1_name, team2_name )`).eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (error) { listDiv.innerHTML = `<p class="text-red-500">فشل تحميل التوقعات.</p><p class="text-xs text-gray-500">${error.message}</p>`; return; }
    if (data.length === 0) { listDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي توقعات بعد.</p>'; return; }
    listDiv.innerHTML = data.map(p => {
        const team1 = p.matches ? p.matches.team1_name : 'فريق محذوف';
        const team2 = p.matches ? p.matches.team2_name : 'فريق محذوف';
        return `<div class="profile-prediction-item"><div class="match-info">${team1} ضد ${team2}</div><div class="prediction-info">توقعت فوز: <strong>${p.predicted_winner}</strong>${p.predicted_scorer ? ` | ومسجل الهدف الأول: <strong>${p.predicted_scorer}</strong>` : ''}</div></div>`
    }).join('');
}

async function fetchAndRenderProfileComments() {
    const listDiv = document.getElementById('profile-comments-list');
    const [matchComments, newsComments] = await Promise.all([
        supabaseClient.from('comments').select('id, comment_text, created_at, matches(team1_name, team2_name)').eq('user_id', currentUser.id),
        supabaseClient.from('news_comments').select('id, comment_text, created_at, articles(title)').eq('user_id', currentUser.id)
    ]);
    if (matchComments.error || newsComments.error) { listDiv.innerHTML = `<p class="text-red-500">فشل تحميل التعليقات.</p><p class="text-xs text-gray-500">${matchComments.error?.message || newsComments.error?.message}</p>`; return; }
    const allComments = [...matchComments.data.map(c => ({...c, type: 'match', table: 'comments'})), ...newsComments.data.map(c => ({...c, type: 'news', table: 'news_comments'}))];
    allComments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (allComments.length === 0) { listDiv.innerHTML = '<p class="text-gray-400">لم تقم بأي تعليقات بعد.</p>'; return; }
    listDiv.innerHTML = allComments.map(c => {
        let context = 'محتوى محذوف';
        if (c.type === 'match' && c.matches) context = `مباراة ${c.matches.team1_name} ضد ${c.matches.team2_name}`;
        else if (c.type === 'news' && c.articles) context = `مقال "${c.articles.title}"`;
        return `<div class="profile-comment-item" id="profile-comment-${c.id}-${c.table}"><div class="comment-content"><span class="comment-text">${c.comment_text}</span><span class="comment-meta">عن: ${context}</span></div><button class="delete-comment-btn-profile" data-comment-id="${c.id}" data-table="${c.table}">حذف</button></div>`;
    }).join('');
}

async function handleUpdateUsername(e) {
    const btn = e.target, input = document.getElementById('profile-username-input'), status = document.getElementById('username-status'), newUsername = input.value.trim();
    if (newUsername.length < 3) { status.textContent = 'يجب أن يكون الاسم 3 أحرف على الأقل.'; status.style.color = 'var(--danger-color)'; return; }
    btn.disabled = true; btn.textContent = '...'; status.textContent = 'جاري الحفظ...'; status.style.color = 'var(--secondary-text-color)';
    const { error } = await supabaseClient.auth.updateUser({ data: { username: newUsername } });
    if (error) { status.textContent = `خطأ: ${error.message}`; status.style.color = 'var(--danger-color)'; }
    else { status.textContent = 'تم حفظ الاسم بنجاح!'; status.style.color = 'var(--success-color)'; currentUser.user_metadata.username = newUsername; }
    btn.disabled = false; btn.textContent = 'حفظ';
}

async function handleDeleteComment(e) {
    if (!e.target.classList.contains('delete-comment-btn-profile')) return;
    const btn = e.target, id = btn.dataset.commentId, table = btn.dataset.table;
    if (!confirm('هل أنت متأكد من حذف هذا التعليق نهائياً؟')) return;
    btn.disabled = true; btn.textContent = '...';
    const { error } = await supabaseClient.from(table).delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) { alert(`فشل حذف التعليق: ${error.message}`); btn.disabled = false; btn.textContent = 'حذف'; }
    else { const el = document.getElementById(`profile-comment-${id}-${table}`); if (el) el.remove(); }
}
