# ----- ابدأ النسخ من هنا -----

# 1. ملء ملف index.html
cat <<'EOF' > public/index.html
<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>تطبيق رقم</title><link rel="stylesheet" href="style.css"></head><body><div class="container"><h1>أهلاً بك في تطبيق رقم</h1><p>التطبيق يعمل الآن!</p><button id="alertButton">اضغط هنا</button><p id="message"></p></div><script src="app.js"></script></body></html>
EOF

# 2. ملء ملف style.css (النسخة المضغوطة)
echo "body{font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background-color:#f0f2f5;color:#333;text-align:center}.container{padding:2rem;background-color:white;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.1)}h1{color:#007bff}button{background-color:#007bff;color:white;border:none;padding:10px 20px;border-radius:5px;font-size:16px;cursor:pointer;margin-top:1rem;transition:background-color .3s}button:hover{background-color:#0056b3}#message{margin-top:1rem;color:green;font-weight:bold}" > public/style.css

# 3. ملء ملف app.js (النسخة المضغوطة)
echo "document.addEventListener(\"DOMContentLoaded\",()=>{const o=document.getElementById(\"alertButton\"),e=document.getElementById(\"message\");o.addEventListener(\"click\",()=>{e.textContent=\"رائع! الزر يعمل!\",console.log(\"Button was clicked!\")})});" > public/app.js


echo "✅ تم ملء ملفات الويب بالمحتوى المضغوط بنجاح!"

# ----- انتهى الكود -----
