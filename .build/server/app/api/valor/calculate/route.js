"use strict";(()=>{var e={};e.id=4592,e.ids=[4592],e.modules={53524:e=>{e.exports=require("@prisma/client")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},27790:e=>{e.exports=require("assert")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},86624:e=>{e.exports=require("querystring")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},27238:(e,a,r)=>{r.r(a),r.d(a,{originalPathname:()=>E,patchFetch:()=>y,requestAsyncStorage:()=>k,routeModule:()=>x,serverHooks:()=>A,staticGenerationAsyncStorage:()=>R});var i={};r.r(i),r.d(i,{POST:()=>p,dynamic:()=>c});var t=r(79182),n=r(72007),o=r(56719),l=r(93442),s=r(57978),d=r(11826),u=r(54413),m=r(28286);let c="force-dynamic",T=new u.ZP({apiKey:process.env.ABACUSAI_API_KEY,baseURL:"https://routellm.abacus.ai/v1"}),L={new:"Sıfır/Yeni",likeNew:"Yeni Gibi",good:"İyi",fair:"Orta",poor:"K\xf6t\xfc"};async function p(e){try{let a;let r=await (0,s.getServerSession)(d.L);if(!r?.user?.email)return l.NextResponse.json({error:"Giriş yapmalısınız"},{status:401});let{title:i,description:t,categoryName:n,categorySlug:o,condition:u,city:c,checklistData:p}=await e.json();if(!i||!n)return l.NextResponse.json({error:"Başlık ve kategori gerekli"},{status:400});let x=p?Object.entries(p).map(([e,a])=>`${e}: ${a}`).join(", "):"Yok",k=(0,m.n8)(c||"İzmir"),R="TR"===k,A=o||"",E=i.toLowerCase(),y="oto-yedek-parca"===A||"otomobil"===A||"oto-moto"===A||!!E.match(/bmw|mercedes|audi|volkswagen|toyota|honda|renault|fiat|araba|otomobil|araç|suv|sedan|ford|opel|hyundai|kia|volvo|peugeot|citroen|skoda|mazda|nissan|tesla/),g="gayrimenkul"===A||"emlak"===A||!!E.match(/daire|ev |konut|arsa|villa|residence|apartman|m²|metrekare/),b=y?"TR"===k?`
REFERANS: T\xdcRKİYE 2025 İKİNCİ EL OTOMOBİL FİYATLARI (TL):
- 2014 BMW 520d 150-200bin km: 1.400.000-1.800.000 TL
- 2014 BMW 520d 200bin+ km: 1.200.000-1.500.000 TL
- 2018 BMW 520i: 2.200.000-2.800.000 TL
- 2018 Mercedes C200: 2.200.000-2.800.000 TL
- 2020 Mercedes E200: 3.500.000-4.500.000 TL
- 2020 Volkswagen Passat: 1.800.000-2.400.000 TL
- 2016 Toyota Corolla: 900.000-1.200.000 TL
- 2019 Renault Megane: 1.000.000-1.400.000 TL
- 2015 Fiat Egea: 700.000-1.000.000 TL
- 2022 Hyundai Tucson: 2.000.000-2.600.000 TL

⚠️ T\xdcRKİYE'DE \xd6TV NEDENİYLE ARA\xc7 FİYATLARI AVRUPA'NIN 2-3 KATI PAHALIDIR!
Avrupa fiyatlarını referans ALMA! Fiyatı TL olarak ver.`:`
REFERANS: AVRUPA 2025 İKİNCİ EL OTOMOBİL FİYATLARI (EUR):
- 2014 BMW 520d 150-200bin km: 12.000-18.000 EUR
- 2018 BMW 520i: 22.000-28.000 EUR
- 2018 Mercedes C200: 20.000-26.000 EUR
- 2020 Volkswagen Passat: 18.000-24.000 EUR
- 2016 Toyota Corolla: 10.000-14.000 EUR
- 2019 Renault Megane: 12.000-16.000 EUR
- 2022 Hyundai Tucson: 24.000-30.000 EUR

Fiyatı EUR olarak ver. 1 EUR ≈ 37 TL olarak \xe7evir.
Sonucu TL olarak "estimatedTL" alanında d\xf6nd\xfcr.`:g?"TR"===k?`
REFERANS: T\xdcRKİYE 2025 GAYRİMENKUL (TL):
- İstanbul Kadık\xf6y/Beşiktaş: 120.000-180.000 TL/m\xb2
- İstanbul Esenyurt: 40.000-70.000 TL/m\xb2
- İzmir Karşıyaka/Alsancak: 60.000-100.000 TL/m\xb2
- İzmir Bornova: 40.000-65.000 TL/m\xb2
- Ankara \xc7ankaya: 50.000-80.000 TL/m\xb2
- Antalya Konyaaltı: 70.000-120.000 TL/m\xb2

⚠️ T\xdcRKİYE'DE KONUT FİYATLARI 2023-2025 ARASI 3 KAT ARTTI!
Fiyatı TL olarak ver.`:`
REFERANS: AVRUPA 2025 GAYRİMENKUL (EUR):
- Barcelona merkez: 4.000-6.000 EUR/m\xb2
- Madrid merkez: 4.500-7.000 EUR/m\xb2
- Berlin merkez: 4.000-6.000 EUR/m\xb2
- Paris merkez: 8.000-14.000 EUR/m\xb2
- London merkez: 8.000-15.000 GBP/m\xb2
- Amsterdam merkez: 5.000-8.000 EUR/m\xb2
- Lizbon merkez: 3.000-5.000 EUR/m\xb2
- Milano merkez: 3.500-6.000 EUR/m\xb2

Fiyatı EUR olarak hesapla, 1 EUR ≈ 37 TL olarak \xe7evir.
Sonucu TL olarak "estimatedTL" alanında d\xf6nd\xfcr.`:"TR"===k?`
REFERANS: T\xdcRKİYE 2025 G\xdcNCEL FİYATLAR (TL):

📱 ELEKTRONİK:
- iPhone 16 Pro Max 256GB: 85.000-95.000 TL
- iPhone 15 Pro Max: 65.000-75.000 TL
- iPhone 14 Pro Max: 50.000-60.000 TL
- iPhone 13 Pro Max: 38.000-45.000 TL
- Samsung S24 Ultra: 65.000-75.000 TL
- Samsung Tab S8: 20.000-28.000 TL
- Samsung Galaxy Watch: 8.000-12.000 TL
- MacBook Air M2: 45.000-55.000 TL
- MacBook Pro M3: 85.000-100.000 TL
- PS5 + 2 Kol: 28.000-35.000 TL
- PS5 Controller: 3.500-5.000 TL
- Bose QC Ultra: 15.000-20.000 TL
- Canon R50: 30.000-38.000 TL
- Canon R5 + 24-105mm: 120.000-150.000 TL
- DJI Mini 3 Pro: 35.000-45.000 TL
- Samsung 55" TV: 22.000-30.000 TL
- Dyson V15: 22.000-28.000 TL
- Garmin Fenix 7X: 30.000-40.000 TL
- Laptop (orta): 25.000-40.000 TL
- Monitor (gaming): 8.000-15.000 TL

🏠 EV & MOBİLYA:
- IKEA Billy: 3.000-5.000 TL
- Berjer Koltuk: 15.000-25.000 TL
- Antika Şifonyer: 20.000-40.000 TL
- Le Creuset Tencere: 10.000-15.000 TL
- KitchenAid Mikser: 18.000-25.000 TL
- Monstera dev boy: 800-1.500 TL
- Kupa bardak: 50-200 TL

🍳 BEYAZ EŞYA:
- Buzdolabı (A+++): 25.000-40.000 TL
- \xc7amaşır Makinesi: 18.000-30.000 TL
- Klima 12000 BTU: 18.000-25.000 TL

👗 GİYİM:
- Nike Air Max 90: 4.500-6.500 TL
- Jordan 1 High: 8.000-15.000 TL
- Converse Chuck: 1.500-2.500 TL
- Zara Kaşmir Palto: 4.000-7.000 TL
- Canada Goose Parka: 30.000-45.000 TL
- Vintage Deri Ceket: 3.000-8.000 TL
- Levi's 501 Vintage: 2.000-5.000 TL
- Ray-Ban Aviator: 5.000-8.000 TL
- Louis Vuitton Neverfull: 80.000-120.000 TL

⌚ SAAT: Rolex Submariner: 800.000-1.200.000 TL

👶 BEBEK: Bugaboo Fox 3: 30.000-45.000 TL
🐾 HAYVAN: Kedi Tırmalama 180cm: 3.000-6.000 TL
🎸 M\xdcZİK: Fender Stratocaster: 30.000-45.000 TL
📚 KİTAP: Harry Potter 7li set: 2.000-4.000 TL
⚽ SPOR: Kayak Takımı: 25.000-40.000 TL
🚲 BİSİKLET: Specialized Tarmac SL7: 150.000-200.000 TL
🏡 BAH\xc7E: Weber Genesis Mangal: 25.000-40.000 TL

⚠️ T\xdcRKİYE'DE \xd6TV+KDV İLE ELEKTRONİK AVRUPA'NIN 1.5-2 KATI PAHALIDIR!
İkinci el ≈ yeni fiyatın %60-85'i.`:`
REFERANS: AVRUPA 2025 G\xdcNCEL FİYATLAR (EUR → TL \xe7evir, 1 EUR ≈ 37 TL):

📱 ELEKTRONİK:
- iPhone 16 Pro Max: 1.450-1.600 EUR (53.000-59.000 TL)
- iPhone 15 Pro Max: 1.100-1.300 EUR (40.000-48.000 TL)
- iPhone 13 Pro Max: 600-800 EUR (22.000-30.000 TL)
- Samsung S24 Ultra: 1.100-1.300 EUR (40.000-48.000 TL)
- MacBook Air M2: 1.100-1.300 EUR (40.000-48.000 TL)
- PS5 + 2 Kol: 500-600 EUR (18.000-22.000 TL)
- Samsung 55" TV: 450-650 EUR (16.000-24.000 TL)
- Dyson V15: 550-700 EUR (20.000-26.000 TL)
- Canon R5 + Lens: 3.500-4.500 EUR (130.000-165.000 TL)

🏠 EV & MOBİLYA:
- IKEA Billy: 60-80 EUR (2.200-3.000 TL)
- KitchenAid Mikser: 400-550 EUR (15.000-20.000 TL)
- Le Creuset Tencere: 250-350 EUR (9.000-13.000 TL)

👗 GİYİM:
- Nike Air Max 90: 120-160 EUR (4.400-5.900 TL)
- Canada Goose Parka: 900-1.200 EUR (33.000-44.000 TL)
- Louis Vuitton Neverfull: 1.800-2.500 EUR (66.000-92.000 TL)

⌚ SAAT: Rolex Submariner: 12.000-18.000 EUR (444.000-666.000 TL)
👶 BEBEK: Bugaboo Fox 3: 800-1.100 EUR (30.000-41.000 TL)
🎸 M\xdcZİK: Fender Stratocaster: 700-1.000 EUR (26.000-37.000 TL)

İkinci el ≈ yeni fiyatın %50-75'i.
Fiyatı EUR olarak hesapla, 1 EUR ≈ 37 TL ile \xe7evir.
Sonucu TL olarak "estimatedTL" alanında d\xf6nd\xfcr.`,M="";y?M=`Bu bir ARA\xc7/OTOMOBİL. Marka, model, yıl, yakıt ve kilometreyi dikkate al.`:g&&(M=`Bu bir GAYRİMENKUL. Şehir, il\xe7e, m\xb2, oda sayısı ve bina yaşını dikkate al.`);let f=`${M}

\xdcr\xfcn: ${i}
A\xe7ıklama: ${t||"Yok"}
Kategori: ${n}
Durum: ${L[u]||u}
Şehir: ${c||"İzmir"}
Ek Bilgiler: ${x}

${b}

Bu \xfcr\xfcn\xfcn PİYASA DEĞERİNİ tahmin et.
estimatedTL alanında TL cinsinden değer ver.

JSON d\xf6nd\xfcr:
{
  "estimatedTL": <TL piyasa değeri>,
  "reason": "<kısa a\xe7ıklama>",
  "marketInsight": "<pazar trendi>"
}
Sadece JSON.`,h=R?`T\xfcrkiye piyasa uzmanısın. T\xfcrkiye 2025 fiyatlarını kullan.
\xd6TV+KDV nedeniyle elektronik Avrupa'nın 1.5-2x, ara\xe7lar 2-3x pahalıdır.
Avrupa/ABD fiyatlarını ASLA referans alma. Fiyatı TL olarak ver.`:`Avrupa piyasa uzmanısın. Avrupa 2025 fiyatlarını kullan.
Fiyatı \xf6nce EUR olarak hesapla, sonra 1 EUR = 37 TL ile \xe7evir.
estimatedTL alanında TL cinsinden değer ver.`,U=await T.chat.completions.create({model:"gpt-4.1-mini",messages:[{role:"system",content:`${h}
SADECE JSON d\xf6nd\xfcr, başka metin yazma.`},{role:"user",content:f}],max_tokens:500,temperature:.3}),v=U.choices[0]?.message?.content||"{}";try{let e=v.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();a=JSON.parse(e)}catch{a={estimatedTL:5e3,reason:"Tahmin yapılamadı",marketInsight:""}}let S=Math.max(50,a.estimatedTL||5e3),K={};try{K="string"==typeof p?JSON.parse(p):p||{}}catch{K={}}let B=(0,m.pu)({estimatedTL:S,condition:u||"good",city:c||"İzmir",categorySlug:o||"default",checklistData:K});return l.NextResponse.json({valorPrice:B.valorPrice,estimatedTL:S,reason:a.reason||"AI tarafından hesaplandı",marketInsight:a.marketInsight||"",formula:B.breakdown.formula,simpleFormula:B.breakdown.simpleFormula,breakdown:B.breakdown,country:k})}catch(e){return console.error("Valor calculate error:",e),l.NextResponse.json({error:"Valor hesaplanamadı"},{status:500})}}let x=new t.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/valor/calculate/route",pathname:"/api/valor/calculate",filename:"route",bundlePath:"app/api/valor/calculate/route"},resolvedPagePath:"/home/ubuntu/takas-a-kodlar/nextjs_space/app/api/valor/calculate/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:k,staticGenerationAsyncStorage:R,serverHooks:A}=x,E="/api/valor/calculate/route";function y(){return(0,o.patchFetch)({serverHooks:A,staticGenerationAsyncStorage:R})}},11826:(e,a,r)=>{r.d(a,{L:()=>d});var i=r(66291),t=r(64617),n=r(3390),o=r.n(n),l=r(83178),s=r(59521);let d={adapter:(0,t.N)(l.default),providers:[(0,i.Z)({name:"credentials",credentials:{email:{label:"Email",type:"email"},password:{label:"Password",type:"password"}},async authorize(e,a){if(!e?.email||!e?.password)return null;let r=a?.headers?.["x-real-ip"],i=a?.headers?.["x-forwarded-for"],t=r?Array.isArray(r)?r[0]:r:i&&(Array.isArray(i)?i[0]:i).split(",").pop()?.trim()||"unknown",n=a?.headers?.["user-agent"]||"unknown";if(!(await (0,s.d5)(t,e.email)).allowed)throw await (0,s.Ky)(e.email,t,5,void 0),Error("ACCOUNT_LOCKED");let d=await l.default.user.findUnique({where:{email:e.email}});return d?await o().compare(e.password,d.password)?(await (0,s.LW)(t,d.id,d.email,n),await l.default.user.update({where:{id:d.id},data:{lastLoginAt:new Date}}),{id:d.id,email:d.email,name:d.name,role:d.role}):(await (0,s.Vm)(t,e.email,n,"Invalid password"),null):(await (0,s.Vm)(t,e.email,n,"User not found"),null)}})],session:{strategy:"jwt",maxAge:86400,updateAge:300},jwt:{maxAge:86400},callbacks:{jwt:async({token:e,user:a})=>(a&&(e.id=a.id,e.role=a.role),e),session:async({session:e,token:a})=>(e?.user&&(e.user.id=a?.id,e.user.role=a?.role),e)},pages:{signIn:"/giris"},secret:process.env.NEXTAUTH_SECRET,cookies:{sessionToken:{name:"__Secure-next-auth.session-token",options:{httpOnly:!0,sameSite:"lax",path:"/",secure:!0}}}}},28286:(e,a,r)=>{r.d(a,{n8:()=>d,pu:()=>u});let i={inflationMultiplier:1.025,baseValorRate:.14,displayRate:50},t={new:1,likeNew:.85,good:.7,fair:.5,poor:.3},n={İstanbul:1.15,Istanbul:1.15,İzmir:1,Izmir:1,Ankara:1.05,Antalya:1.02,Bursa:.95,Konya:.88,Adana:.9,Gaziantep:.85,Barcelona:1.1,Madrid:1.08,London:1.2,Berlin:1.08,Paris:1.18,Amsterdam:1.12,Roma:1.05,Rome:1.05,Milano:1.12,Milan:1.12,Lizbon:.95,Lisbon:.95,default:1},o={elektronik:1.15,giyim:.9,"ev-yasam":1,"spor-outdoor":1.05,kitaplar:.75,oyuncaklar:.85,"oto-yedek-parca":1.1,otomobil:1.2,gayrimenkul:1.25,"bebek-cocuk":.95,"taki-aksesuar":1.1,mutfak:.95,bahce:.9,"beyaz-esya":1,"evcil-hayvan":.85,default:1},l={"0-50.000 km":1,"50.000-100.000 km":.9,"100.000-150.000 km":.8,"150.000-200.000 km":.7,"200.000+ km":.6},s={"2024-2025":1,"2022-2023":.85,"2020-2021":.75,"2018-2019":.65,"2015-2017":.55,"2012-2014":.45,"2010-2011":.38,"2010 \xf6ncesi":.3};function d(e){return["İstanbul","Istanbul","İzmir","Izmir","Ankara","Antalya","Bursa","Konya","Adana","Gaziantep","Mersin","Kayseri","Eskişehir","Trabzon","Samsun","Denizli","Diyarbakır","Muğla","Manisa","Balıkesir"].some(a=>e.includes(a))?"TR":["Barcelona","Madrid","Valencia","Sevilla","Malaga","Bilbao","Zaragoza"].some(a=>e.includes(a))?"ES":["London","Manchester","Birmingham","Edinburgh","Glasgow","Liverpool","Bristol"].some(a=>e.includes(a))?"UK":["Berlin","M\xfcnchen","Munich","Hamburg","Frankfurt","K\xf6ln","Cologne","Stuttgart","D\xfcsseldorf"].some(a=>e.includes(a))?"DE":["Paris","Lyon","Marseille","Toulouse","Nice","Bordeaux","Lille"].some(a=>e.includes(a))?"FR":["Roma","Rome","Milano","Milan","Napoli","Torino","Firenze","Bologna"].some(a=>e.includes(a))?"IT":["Lizbon","Lisbon","Porto","Faro"].some(a=>e.includes(a))?"PT":["Amsterdam","Rotterdam","Utrecht","Den Haag"].some(a=>e.includes(a))?"NL":"TR"}function u(e){let{estimatedTL:a,condition:r,city:d,categorySlug:u,checklistData:m}=e,c=t[r]||.7,T=o[u]||1,L=n[d]||n.default,p=i.inflationMultiplier,x=i.baseValorRate*p,k=1;m?.mileage&&l[m.mileage]&&(k*=l[m.mileage]),m?.modelYear&&s[m.modelYear]&&(k*=s[m.modelYear]),m?.hasAccidentRecord===!0&&(k*=.8);let R=Math.max(10,10*Math.round(a*x*c*T*L*k/10));return{valorPrice:R,breakdown:{estimatedTL:a,baseRate:x,conditionMultiplier:c,demandMultiplier:T,regionMultiplier:L,inflationMultiplier:p,simpleFormula:`${a.toLocaleString("tr-TR")}₺ \xf7 ${i.displayRate} ≈ ${Math.round(a/i.displayRate).toLocaleString("tr-TR")} V`,formula:`${a.toLocaleString("tr-TR")}₺ \xd7 ${x.toFixed(4)} kur \xd7 ${c} durum \xd7 ${T} talep \xd7 ${L} b\xf6lge${1!==k?` \xd7 ${k.toFixed(2)} ara\xe7`:""} = ${R.toLocaleString("tr-TR")} V`}}}}};var a=require("../../../../webpack-runtime.js");a.C(e);var r=e=>a(a.s=e),i=a.X(0,[8412,7609,3390,1472,4413,9521],()=>r(27238));module.exports=i})();