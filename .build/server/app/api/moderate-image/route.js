"use strict";(()=>{var e={};e.id=3754,e.ids=[3754],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},70612:(e,r,a)=>{a.r(r),a.d(r,{originalPathname:()=>c,patchFetch:()=>x,requestAsyncStorage:()=>u,routeModule:()=>p,serverHooks:()=>m,staticGenerationAsyncStorage:()=>d});var t={};a.r(t),a.d(t,{POST:()=>l});var i=a(79182),n=a(72007),o=a(56719),s=a(93442);async function l(e){try{let r=(await e.formData()).get("file");if(!r)return s.NextResponse.json({error:"Dosya bulunamadı",isAppropriate:!1},{status:400});if(!["image/jpeg","image/png","image/gif","image/webp"].includes(r.type))return s.NextResponse.json({error:"Ge\xe7ersiz dosya t\xfcr\xfc. Sadece JPEG, PNG, GIF ve WebP desteklenir.",isAppropriate:!1},{status:400});if(r.size>10485760)return s.NextResponse.json({error:"Dosya boyutu 10MB'dan b\xfcy\xfck olamaz.",isAppropriate:!1},{status:400});let a=await r.arrayBuffer(),t=Buffer.from(a).toString("base64"),i=r.type,n=await fetch("https://apps.abacus.ai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.ABACUSAI_API_KEY}`},body:JSON.stringify({model:"gpt-4.1-mini",messages:[{role:"system",content:`Sen bir i\xe7erik moderasyon uzmanısın. Y\xfcklenen g\xf6rselleri etik ve ahlaki uygunluk a\xe7ısından analiz ediyorsun.

Bu platform Atat\xfcrk\xe7\xfc ve laik bir vizyona sahiptir.

Bir takas platformu i\xe7in \xfcr\xfcn g\xf6rseli olarak şunları REDDET:
1. Pornografik veya cinsel i\xe7erik
2. Şiddet veya kanlı g\xf6r\xfcnt\xfcler
3. Uyuşturucu veya yasadışı maddeler
4. Nefret sembolleri veya ırk\xe7ı i\xe7erik
5. \xc7ocuk istismarı i\xe7eren herhangi bir şey
6. Silah veya patlayıcı maddeler
7. Kişisel kimlik bilgileri (TC no, kredi kartı vb. g\xf6r\xfcn\xfcyorsa)
8. Siyasal islam propagandası i\xe7eren materyaller
9. Dini aşırılık, yobazlık veya radikal dini i\xe7erik
10. Tarikat, cemaat propagandası i\xe7eren materyaller
11. Laiklik karşıtı i\xe7erikler

MUTLAKA KABUL ET (bunlar kesinlikle uygundur):
- Kitaplar (\xf6zellikle Atat\xfcrk, Cumhuriyet, laiklik, tarih kitapları)
- Atat\xfcrk g\xf6rseli i\xe7eren \xfcr\xfcnler (kitap, poster, heykel vb.)
- Akademik ve eğitim materyalleri
- \xdcr\xfcn fotoğrafları (elektronik, giyim, oyuncak, mobilya vb.)
- G\xfcnl\xfck nesneler
- İnsanların normal kıyafetli fotoğrafları

\xd6NEMLİ: Başlığında "saldırı" gibi kelimeler ge\xe7se bile, bu kitabın i\xe7eriğini değerlendir. \xd6rneğin "Atat\xfcrk'e Saldırmanın Dayanılmaz Hafifliği" Atat\xfcrk'\xfc savunan bir kitaptır ve kesinlikle KABUL edilmelidir.

YANIT FORMATI (sadece JSON):
{"isAppropriate": true/false, "reason": "kısa a\xe7ıklama", "category": "UYGUN/UYGUNSUZ"}`},{role:"user",content:[{type:"text",text:"Bu g\xf6rseli bir takas platformu i\xe7in \xfcr\xfcn fotoğrafı olarak uygun olup olmadığını değerlendir. Sadece JSON formatında yanıt ver."},{type:"image_url",image_url:{url:`data:${i};base64,${t}`}}]}],max_tokens:500,response_format:{type:"json_object"}})});if(!n.ok)return console.error("LLM API error:",await n.text()),s.NextResponse.json({error:"G\xf6rsel analizi başarısız oldu",isAppropriate:!1},{status:500});let o=await n.json(),l=o.choices?.[0]?.message?.content;if(!l)return s.NextResponse.json({error:"Analiz sonucu alınamadı",isAppropriate:!1},{status:500});try{let e=JSON.parse(l);return s.NextResponse.json({isAppropriate:e.isAppropriate??!1,reason:e.reason||"Bilinmeyen neden",category:e.category||"BELIRSIZ"})}catch(e){return console.error("JSON parse error:",e),s.NextResponse.json({error:"Analiz sonucu işlenemedi",isAppropriate:!1},{status:500})}}catch(e){return console.error("Image moderation error:",e),s.NextResponse.json({error:"Bir hata oluştu",isAppropriate:!1},{status:500})}}let p=new i.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/moderate-image/route",pathname:"/api/moderate-image",filename:"route",bundlePath:"app/api/moderate-image/route"},resolvedPagePath:"/home/ubuntu/takas-a-kodlar/nextjs_space/app/api/moderate-image/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:u,staticGenerationAsyncStorage:d,serverHooks:m}=p,c="/api/moderate-image/route";function x(){return(0,o.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:d})}}};var r=require("../../../webpack-runtime.js");r.C(e);var a=e=>r(r.s=e),t=r.X(0,[8412,7609],()=>a(70612));module.exports=t})();