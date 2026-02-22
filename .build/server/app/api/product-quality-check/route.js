"use strict";(()=>{var e={};e.id=8197,e.ids=[8197],e.modules={53524:e=>{e.exports=require("@prisma/client")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},27790:e=>{e.exports=require("assert")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},86624:e=>{e.exports=require("querystring")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},41679:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>g,patchFetch:()=>h,requestAsyncStorage:()=>m,routeModule:()=>k,serverHooks:()=>y,staticGenerationAsyncStorage:()=>x});var r={};a.r(r),a.d(r,{POST:()=>d,dynamic:()=>u});var o=a(79182),i=a(72007),n=a(56719),s=a(93442),l=a(57978),c=a(11826);let u="force-dynamic";async function d(e){try{let t=await (0,l.getServerSession)(c.L);if(!t?.user?.email)return s.NextResponse.json({error:"Giriş yapmanız gerekiyor"},{status:401});let a=await e.formData(),r=a.get("file"),o=a.get("title")||"",i=a.get("category")||"";if(!r)return s.NextResponse.json({error:"Dosya bulunamadı",passed:!1},{status:400});if(!["image/jpeg","image/png","image/webp"].includes(r.type))return s.NextResponse.json({error:"Ge\xe7ersiz dosya t\xfcr\xfc. Sadece JPEG, PNG ve WebP desteklenir.",passed:!1},{status:400});if(r.size>10485760)return s.NextResponse.json({error:"Dosya boyutu 10MB'dan b\xfcy\xfck olamaz.",passed:!1},{status:400});let n=await r.arrayBuffer(),u=Buffer.from(n).toString("base64"),d=r.type,f=await p(u,d,o,i);return s.NextResponse.json(f)}catch(e){return console.error("Product quality check error:",e),s.NextResponse.json({error:"Kalite kontrol\xfc sırasında bir hata oluştu",passed:!1},{status:500})}}async function p(e,t,a,r){try{let o=await fetch("https://apps.abacus.ai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.ABACUSAI_API_KEY}`},body:JSON.stringify({model:"gpt-4.1-mini",messages:[{role:"system",content:`Sen bir \xfcr\xfcn fotoğrafı kalite kontrol uzmanısın. Takas platformu i\xe7in y\xfcklenen \xfcr\xfcn fotoğraflarını analiz ediyorsun.

G\xd6REVLERİN:
1. **\xc7\xf6z\xfcn\xfcrl\xfck/Netlik Analizi**: Fotoğrafın bulanık olup olmadığını, \xe7\xf6z\xfcn\xfcrl\xfcğ\xfcn yeterli olup olmadığını değerlendir.
2. **Ger\xe7eklik Kontrol\xfc**: 
   - Stock fotoğraf mı? (Shutterstock, iStock, Getty vb. watermark veya tipik stock tarzı)
   - İnternetten indirilen sahte/aldatıcı g\xf6rsel mi?
   - Ger\xe7ek bir \xfcr\xfcn fotoğrafı mı?
3. **\xdcr\xfcn G\xf6r\xfcn\xfcrl\xfcğ\xfc**: \xdcr\xfcn net şekilde g\xf6r\xfcn\xfcyor mu? Ana \xfcr\xfcn mi yoksa arka plan mı \xf6n planda?
4. **Aydınlatma Kalitesi**: Fotoğraf iyi aydınlatılmış mı? \xc7ok karanlık veya aşırı parlak mı?
5. **İ\xe7erik Uygunluğu**: Yasadışı, uygunsuz veya yasaklı i\xe7erik var mı?

Ş\xdcPHELİ BELİRTİLER (dikkat et):
- \xc7ok profesyonel st\xfcdyo \xe7ekimi (genellikle stock photo)
- Watermark izleri veya bulanıklaştırılmış logolar
- Google g\xf6rsel arama sonucu gibi g\xf6r\xfcnen fotoğraflar
- \xdcr\xfcnle uyumsuz arka plan (T\xfcrkiye'de satılıyor ama yabancı mağaza etiketi g\xf6r\xfcn\xfcyor)
- Aşırı d\xfcş\xfck kalite veya pikselleşme
- Ekran g\xf6r\xfcnt\xfcs\xfc veya screenshot
- Katalog/tanıtım g\xf6rseli

PUAN SİSTEMİ (0-100):
- 90-100: M\xfckemmel, ger\xe7ek \xfcr\xfcn fotoğrafı
- 70-89: İyi, kabul edilebilir
- 50-69: Orta, iyileştirme \xf6nerilir
- 30-49: D\xfcş\xfck kalite, muhtemelen reddedilmeli
- 0-29: Kabul edilemez (stock photo, sahte, uygunsuz)

YANIT FORMATI (sadece JSON):
{
  "resolution": {
    "estimatedWidth": number,
    "estimatedHeight": number,
    "isAdequate": boolean,
    "message": "string"
  },
  "clarity": {
    "score": number (0-100),
    "isBlurry": boolean,
    "message": "string"
  },
  "authenticity": {
    "isStockPhoto": boolean,
    "isFakeProduct": boolean,
    "isScreenshot": boolean,
    "isCatalogImage": boolean,
    "confidence": number (0-100),
    "suspiciousElements": ["string"],
    "message": "string"
  },
  "content": {
    "hasProduct": boolean,
    "productVisible": boolean,
    "productType": "string",
    "matchesTitle": boolean,
    "message": "string"
  },
  "lighting": {
    "score": number (0-100),
    "isTooD ark": boolean,
    "isOverexposed": boolean,
    "message": "string"
  },
  "overallScore": number (0-100),
  "shouldBlock": boolean,
  "blockReason": "string or null",
  "recommendations": ["string"]
}`},{role:"user",content:[{type:"text",text:`Bu fotoğrafı analiz et. ${a?`\xdcr\xfcn başlığı: "${a}"`:""} ${r?`Kategori: ${r}`:""}

Fotoğrafın:
1. \xc7\xf6z\xfcn\xfcrl\xfck ve netlik kalitesini değerlendir
2. Stock photo veya sahte \xfcr\xfcn g\xf6rseli olup olmadığını kontrol et
3. Ger\xe7ek bir \xfcr\xfcn fotoğrafı olup olmadığını belirle
4. Aydınlatma ve g\xf6r\xfcn\xfcrl\xfck kalitesini puanla
5. Genel kalite puanı ver (0-100)

Sadece JSON formatında yanıt ver.`},{type:"image_url",image_url:{url:`data:${t};base64,${e}`}}]}],max_tokens:1e3,response_format:{type:"json_object"}})});if(!o.ok)return console.error("AI API error:",await o.text()),f(!0,"AI analizi şu anda kullanılamıyor");let i=await o.json(),n=i.choices?.[0]?.message?.content;if(!n)return f(!0,"Analiz sonucu alınamadı");let s=JSON.parse(n);return function(e){let t=e.overallScore??70,a=e.shouldBlock||e.authenticity?.isStockPhoto||e.authenticity?.isFakeProduct||t<30,r=e.recommendations||[];return e.clarity?.isBlurry&&r.push("Daha net bir fotoğraf \xe7ekin, kameranızı sabit tutun"),e.lighting?.isTooDark&&r.push("Daha aydınlık bir ortamda fotoğraf \xe7ekin"),e.lighting?.isOverexposed&&r.push("Doğrudan g\xfcneş ışığından ka\xe7ının"),e.content?.productVisible||r.push("\xdcr\xfcn\xfc daha yakından ve net şekilde \xe7ekin"),e.authenticity?.isScreenshot&&r.push("Ekran g\xf6r\xfcnt\xfcs\xfc yerine ger\xe7ek \xfcr\xfcn fotoğrafı y\xfckleyin"),{passed:!a&&t>=50,overallScore:t,checks:{resolution:{passed:e.resolution?.isAdequate??!0,width:e.resolution?.estimatedWidth,height:e.resolution?.estimatedHeight,message:e.resolution?.message||"\xc7\xf6z\xfcn\xfcrl\xfck kontrol\xfc yapıldı"},clarity:{passed:!e.clarity?.isBlurry&&(e.clarity?.score??70)>=50,score:e.clarity?.score??70,message:e.clarity?.message||"Netlik kontrol\xfc yapıldı"},authenticity:{passed:!e.authenticity?.isStockPhoto&&!e.authenticity?.isFakeProduct,isStockPhoto:e.authenticity?.isStockPhoto??!1,isFakeProduct:e.authenticity?.isFakeProduct??!1,confidence:e.authenticity?.confidence??80,message:e.authenticity?.message||"Ger\xe7eklik kontrol\xfc yapıldı"},content:{passed:e.content?.hasProduct&&e.content?.productVisible,hasProduct:e.content?.hasProduct??!0,productVisible:e.content?.productVisible??!0,message:e.content?.message||"İ\xe7erik kontrol\xfc yapıldı"},lighting:{passed:(e.lighting?.score??70)>=50,score:e.lighting?.score??70,message:e.lighting?.message||"Aydınlatma kontrol\xfc yapıldı"}},recommendations:[...new Set(r)],blockedReason:a?e.blockReason||(e.authenticity?.isStockPhoto?"Bu fotoğraf bir stock fotoğraf olarak tespit edildi. L\xfctfen kendi \xe7ektiğiniz \xfcr\xfcn fotoğrafını y\xfckleyin.":e.authenticity?.isFakeProduct?"Bu fotoğraf internetten alınmış veya sahte bir \xfcr\xfcn g\xf6rseli olarak tespit edildi.":e.authenticity?.isScreenshot?"Ekran g\xf6r\xfcnt\xfcleri kabul edilmiyor. L\xfctfen ger\xe7ek \xfcr\xfcn fotoğrafı y\xfckleyin.":e.authenticity?.isCatalogImage?"Katalog g\xf6rselleri kabul edilmiyor. L\xfctfen kendi \xe7ektiğiniz fotoğrafı y\xfckleyin.":e.overallScore<30?"Fotoğraf kalitesi \xe7ok d\xfcş\xfck. L\xfctfen daha net ve aydınlık bir fotoğraf \xe7ekin.":"Fotoğraf kalite standartlarını karşılamıyor."):void 0}}(s)}catch(e){return console.error("AI analysis error:",e),f(!0,"Analiz hatası, varsayılan olarak kabul edildi")}}function f(e,t){return{passed:e,overallScore:e?70:30,checks:{resolution:{passed:!0,message:t},clarity:{passed:!0,score:70,message:t},authenticity:{passed:!0,isStockPhoto:!1,isFakeProduct:!1,confidence:50,message:t},content:{passed:!0,hasProduct:!0,productVisible:!0,message:t},lighting:{passed:!0,score:70,message:t}},recommendations:[],blockedReason:e?void 0:t}}let k=new o.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/product-quality-check/route",pathname:"/api/product-quality-check",filename:"route",bundlePath:"app/api/product-quality-check/route"},resolvedPagePath:"/home/ubuntu/takas-a-kodlar/nextjs_space/app/api/product-quality-check/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:m,staticGenerationAsyncStorage:x,serverHooks:y}=k,g="/api/product-quality-check/route";function h(){return(0,n.patchFetch)({serverHooks:y,staticGenerationAsyncStorage:x})}},11826:(e,t,a)=>{a.d(t,{L:()=>c});var r=a(66291),o=a(64617),i=a(3390),n=a.n(i),s=a(83178),l=a(59521);let c={adapter:(0,o.N)(s.default),providers:[(0,r.Z)({name:"credentials",credentials:{email:{label:"Email",type:"email"},password:{label:"Password",type:"password"}},async authorize(e,t){if(!e?.email||!e?.password)return null;let a=t?.headers?.["x-real-ip"],r=t?.headers?.["x-forwarded-for"],o=a?Array.isArray(a)?a[0]:a:r&&(Array.isArray(r)?r[0]:r).split(",").pop()?.trim()||"unknown",i=t?.headers?.["user-agent"]||"unknown";if(!(await (0,l.d5)(o,e.email)).allowed)throw await (0,l.Ky)(e.email,o,5,void 0),Error("ACCOUNT_LOCKED");let c=await s.default.user.findUnique({where:{email:e.email}});return c?await n().compare(e.password,c.password)?(await (0,l.LW)(o,c.id,c.email,i),await s.default.user.update({where:{id:c.id},data:{lastLoginAt:new Date}}),{id:c.id,email:c.email,name:c.name,role:c.role}):(await (0,l.Vm)(o,e.email,i,"Invalid password"),null):(await (0,l.Vm)(o,e.email,i,"User not found"),null)}})],session:{strategy:"jwt",maxAge:86400,updateAge:300},jwt:{maxAge:86400},callbacks:{jwt:async({token:e,user:t})=>(t&&(e.id=t.id,e.role=t.role),e),session:async({session:e,token:t})=>(e?.user&&(e.user.id=t?.id,e.user.role=t?.role),e)},pages:{signIn:"/giris"},secret:process.env.NEXTAUTH_SECRET,cookies:{sessionToken:{name:"__Secure-next-auth.session-token",options:{httpOnly:!0,sameSite:"lax",path:"/",secure:!0}}}}}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[8412,7609,3390,1472,9521],()=>a(41679));module.exports=r})();