const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const files = ['en.json', 'ar.json', 'fr.json', 'zh.json'];

const slidesData = {
  "hero_slide1_title": { en: "World’s 1st Smart AI Powered B2B Trade Platform", ar: "أول منصة تجارة B2B ذكية مدعومة بالذكاء الاصطناعي في العالم", fr: "La première plateforme commerciale B2B intelligente propulsée par l'IA", zh: "全球首个智能AI驱动的B2B贸易平台" },
  "hero_slide1_subtitle": { en: "Live 24/7 Commodity Prices | OCEAN FREIGHTS | AI Predict", ar: "أسعار السلع الحية على مدار 24/7 | الشحن البحري | توقعات الذكاء الاصطناعي", fr: "Prix des matières premières en direct 24/7 | FRETS MARITIMES | Prédictions IA", zh: "全天候实时商品价格 | 海运费 | AI 预测" },
  "hero_slide1_desc": { en: "Discover global agri-commodity trade intelligence with FOB, CNF and CIF prices, freight rates, historical price charts, AI-powered price predictions, market reports, price alerts, trade opportunities, smart export documentation and many more powerful features in one platform.", ar: "اكتشف ذكاء تجارة السلع الزراعية العالمية بأسعار فوب، سي ان اف، و سي اي اف، وأسعار الشحن، وما إلى ذلك.", fr: "Découvrez l'intelligence du commerce mondial des matières premières agricoles avec des prix FOB, CNF et CIF, etc.", zh: "在一个平台上发现包含FOB、CNF和CIF价格、运费、历史价格图表、AI驱动的价格预测等全球农产品贸易情报。" },
  "hero_slide1_tag": { en: "Platform Feature", ar: "ميزة المنصة", fr: "Fonctionnalité de la plateforme", zh: "平台特色" },
  "hero_slide1_btn": { en: "Explore Features", ar: "استكشاف الميزات", fr: "Explorer les fonctionnalités", zh: "探索功能" },
  "hero_slide2_title": { en: "Trusted by Global Traders", ar: "موثوق به من قبل التجار العالميين", fr: "Approuvé par les traders mondiaux", zh: "深受全球贸易商信任" },
  "hero_slide2_subtitle": { en: "90+ Countries | 20+ Years Experience | 10K+ Clients", ar: "90+ دولة | 20+ سنوات خبرة | 10K+ عملاء", fr: "90+ Pays | 20+ Ans d'expérience | 10K+ Clients", zh: "90+ 个国家 | 20+ 年经验 | 10K+ 客户" },
  "hero_slide2_desc": { en: "Backed by over two decades of practical market experience, AgriGuru Online is the reliable partner for your trading needs. Join our growing network of over 10,000 trusted clients across 90+ countries worldwide.", ar: "بدعم من أكثر من عقدين من الخبرة العملية في السوق، AgriGuru Online هو الشريك الموثوق لاحتياجات التداول الخاصة بك.", fr: "Soutenu par plus de deux décennies d'expérience pratique sur le marché, AgriGuru Online est le partenaire fiable pour vos besoins de trading.", zh: "凭借二十多年的实际市场经验，AgriGuru Online 是您可靠的交易合作伙伴。" },
  "hero_slide2_tag": { en: "Global Trust & Network", ar: "الثقة العالمية والشبكة", fr: "Confiance mondiale et réseau", zh: "全球信任与网络" },
  "hero_slide2_btn": { en: "Read Our Story", ar: "اقرأ قصتنا", fr: "Lisez notre histoire", zh: "阅读我们的故事" },
  "hero_slide3_title": { en: "Try It Risk-Free for 90 Days", ar: "جربه بدون مخاطر لمدة 90 يومًا", fr: "Essayez-le sans risque pendant 90 jours", zh: "免费试用 90 天，零风险" },
  "hero_slide3_subtitle": { en: "Silver Plan Trial - Completely Free", ar: "تجربة الخطة الفضية - مجانية تمامًا", fr: "Essai du plan Silver - Totalement gratuit", zh: "白银计划试用 - 完全免费" },
  "hero_slide3_desc": { en: "The Silver Plan trial costs nothing. No credit card, no banking details, no catch. Just sign up and explore all premium features for yourself for a full 90 days.", ar: "تجربة الخطة الفضية لا تكلف شيئًا. بدون بطاقة ائتمان، بدون تفاصيل بنكية، بدون شروط مخفية.", fr: "L'essai du plan Silver ne coûte rien. Pas de carte de crédit, pas de coordonnées bancaires, pas de piège.", zh: "白银计划试用不花一分钱。无需信用卡，无需银行信息，没有任何隐性条款。" },
  "hero_slide3_tag": { en: "Membership Plan", ar: "خطة العضوية", fr: "Plan d'adhésion", zh: "会员计划" },
  "hero_slide3_btn": { en: "Start Free Trial Now", ar: "ابدأ الإصدار التجريبي المجاني الآن", fr: "Commencer l'essai gratuit maintenant", zh: "立即开始免费试用" },
  "hero_slide4_title": { en: "Download AgriGuru Online App", ar: "قم بتنزيل تطبيق AgriGuru Online", fr: "Téléchargez l'application AgriGuru Online", zh: "下载 AgriGuru Online 应用程序" },
  "hero_slide4_subtitle": { en: "Global market access right in your pocket", ar: "الوصول إلى السوق العالمية في جيبك", fr: "Accès au marché mondial directement dans votre poche", zh: "将全球市场尽在掌握" },
  "hero_slide4_desc": { en: "Get live market prices, instant freight rates, custom alerts, and AI insights on the go. Available for both iOS and Android. Scan the QR code or download directly from the App Store or Google Play.", ar: "احصل على أسعار السوق الحية، وأسعار الشحن الفورية، والتنبيهات المخصصة، ورؤى الذكاء الاصطناعي أثناء التنقل.", fr: "Obtenez les prix du marché en direct, les taux de fret instantanés, les alertes personnalisées et les informations de l'IA en déplacement.", zh: "随时随地获取实时市场价格、即时运费、自定义提醒和 AI 见解。" },
  "hero_slide4_tag": { en: "Mobile App", ar: "تطبيق الجوال", fr: "Application mobile", zh: "移动应用" },
  "hero_slide4_btn": { en: "Download Now", ar: "تنزيل الآن", fr: "Télécharger maintenant", zh: "立即下载" }
};

// 1. Update locales
files.forEach(file => {
  const lang = file.replace('.json', '');
  const filePath = path.join(localesDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);
  
  if (!json.home) json.home = {};
  for (const key in slidesData) {
    json.home[key] = slidesData[key][lang];
  }
  
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
});
console.log("Updated locales successfully");

// 2. Modify HeroCarousel to accept and use dict
const heroFile = 'components/home/HeroCarousel.tsx';
let heroContent = fs.readFileSync(heroFile, 'utf-8');

heroContent = heroContent.replace(
  `const getSlides = (lang: string): CarouselSlide[] => [`,
  `const getSlides = (lang: string, dict: any): CarouselSlide[] => [`
);

// Slide 1
heroContent = heroContent.replace(
  `title: 'World’s 1st Smart AI Powered B2B Trade Platform',`,
  `title: dict?.home?.hero_slide1_title || 'World’s 1st Smart AI Powered B2B Trade Platform',`
);
heroContent = heroContent.replace(
  `subtitle: 'Live 24/7 Commodity Prices | OCEAN FREIGHTS | AI Predict',`,
  `subtitle: dict?.home?.hero_slide1_subtitle || 'Live 24/7 Commodity Prices | OCEAN FREIGHTS | AI Predict',`
);
heroContent = heroContent.replace(
  `description: 'Discover global agri-commodity trade intelligence with FOB, CNF and CIF prices, freight rates, historical price charts, AI-powered price predictions, market reports, price alerts, trade opportunities, smart export documentation and many more powerful features in one platform.',`,
  `description: dict?.home?.hero_slide1_desc || 'Discover global agri-commodity trade intelligence with FOB, CNF and CIF prices, freight rates, historical price charts, AI-powered price predictions, market reports, price alerts, trade opportunities, smart export documentation and many more powerful features in one platform.',`
);
heroContent = heroContent.replace(
  `tag: 'Platform Feature',`,
  `tag: dict?.home?.hero_slide1_tag || 'Platform Feature',`
);
heroContent = heroContent.replace(
  `linkText: 'Explore Features',`,
  `linkText: dict?.home?.hero_slide1_btn || 'Explore Features',`
);

// Slide 2
heroContent = heroContent.replace(
  `title: 'Trusted by Global Traders',`,
  `title: dict?.home?.hero_slide2_title || 'Trusted by Global Traders',`
);
heroContent = heroContent.replace(
  `subtitle: '90+ Countries | 20+ Years Experience | 10K+ Clients',`,
  `subtitle: dict?.home?.hero_slide2_subtitle || '90+ Countries | 20+ Years Experience | 10K+ Clients',`
);
heroContent = heroContent.replace(
  `description: 'Backed by over two decades of practical market experience, AgriGuru Online is the reliable partner for your trading needs. Join our growing network of over 10,000 trusted clients across 90+ countries worldwide.',`,
  `description: dict?.home?.hero_slide2_desc || 'Backed by over two decades of practical market experience, AgriGuru Online is the reliable partner for your trading needs. Join our growing network of over 10,000 trusted clients across 90+ countries worldwide.',`
);
heroContent = heroContent.replace(
  `tag: 'Global Trust & Network',`,
  `tag: dict?.home?.hero_slide2_tag || 'Global Trust & Network',`
);
heroContent = heroContent.replace(
  `linkText: 'Read Our Story',`,
  `linkText: dict?.home?.hero_slide2_btn || 'Read Our Story',`
);

// Slide 3
heroContent = heroContent.replace(
  `title: 'Try It Risk-Free for 90 Days',`,
  `title: dict?.home?.hero_slide3_title || 'Try It Risk-Free for 90 Days',`
);
heroContent = heroContent.replace(
  `subtitle: 'Silver Plan Trial - Completely Free',`,
  `subtitle: dict?.home?.hero_slide3_subtitle || 'Silver Plan Trial - Completely Free',`
);
heroContent = heroContent.replace(
  `description: 'The Silver Plan trial costs nothing. No credit card, no banking details, no catch. Just sign up and explore all premium features for yourself for a full 90 days.',`,
  `description: dict?.home?.hero_slide3_desc || 'The Silver Plan trial costs nothing. No credit card, no banking details, no catch. Just sign up and explore all premium features for yourself for a full 90 days.',`
);
heroContent = heroContent.replace(
  `tag: 'Membership Plan',`,
  `tag: dict?.home?.hero_slide3_tag || 'Membership Plan',`
);
heroContent = heroContent.replace(
  `linkText: 'Start Free Trial Now',`,
  `linkText: dict?.home?.hero_slide3_btn || 'Start Free Trial Now',`
);

// Slide 4
heroContent = heroContent.replace(
  `title: 'Download AgriGuru Online App',`,
  `title: dict?.home?.hero_slide4_title || 'Download AgriGuru Online App',`
);
heroContent = heroContent.replace(
  `subtitle: 'Global market access right in your pocket',`,
  `subtitle: dict?.home?.hero_slide4_subtitle || 'Global market access right in your pocket',`
);
heroContent = heroContent.replace(
  `description: 'Get live market prices, instant freight rates, custom alerts, and AI insights on the go. Available for both iOS and Android. Scan the QR code or download directly from the App Store or Google Play.',`,
  `description: dict?.home?.hero_slide4_desc || 'Get live market prices, instant freight rates, custom alerts, and AI insights on the go. Available for both iOS and Android. Scan the QR code or download directly from the App Store or Google Play.',`
);
heroContent = heroContent.replace(
  `tag: 'Mobile App',`,
  `tag: dict?.home?.hero_slide4_tag || 'Mobile App',`
);
heroContent = heroContent.replace(
  `linkText: 'Download Now',`,
  `linkText: dict?.home?.hero_slide4_btn || 'Download Now',`
);


heroContent = heroContent.replace(
  `export default function HeroCarousel({ lang }: { lang: string }) {`,
  `export default function HeroCarousel({ lang, dict }: { lang: string, dict?: any }) {`
);
heroContent = heroContent.replace(
  `const slides = getSlides(lang);`,
  `const slides = getSlides(lang, dict);`
);

// Adding translation to hardcoded small texts
heroContent = heroContent.replace(
  `Market Reports`,
  `{dict?.header?.market_reports || 'Market Reports'}`
);
heroContent = heroContent.replace(
  `AI Predict`,
  `{dict?.header?.ai_predicts || 'AI Predict'}`
);
heroContent = heroContent.replace(
  `Alert Setups`,
  `{dict?.header?.alerts || 'Alert Setups'}`
);

fs.writeFileSync(heroFile, heroContent);
console.log("Fixed HeroCarousel");

// 3. Modify app/[lang]/(home)/page.tsx to pass dict
const homeFile = 'app/[lang]/(home)/page.tsx';
let homeContent = fs.readFileSync(homeFile, 'utf-8');

homeContent = homeContent.replace(
  `<HeroCarousel lang={activeLang} />`,
  `<HeroCarousel lang={activeLang} dict={pageDict} />`
);

// We need to make sure we replace the one inside Suspense, or wait, the HeroCarousel was outside Suspense!
// In page.tsx, it's outside Suspense but `pageDict` is only fetched INSIDE `LocalizedHomePageContent`. 
// If HeroCarousel is outside, it doesn't get `dict`. 
// Oh! I must move HeroCarousel inside LocalizedHomePageContent!

if (homeContent.includes('<HeroCarousel lang={activeLang} />')) {
    // Remove HeroCarousel from outside
    homeContent = homeContent.replace('<HeroCarousel lang={activeLang} />', '');
    // Insert into LocalizedHomePageContent just before the first section
    homeContent = homeContent.replace(
      `<section className="w-full pt-4 pb-2">`,
      `<HeroCarousel lang={activeLang} dict={pageDict} />\n      <section className="w-full pt-4 pb-2">`
    );
}

fs.writeFileSync(homeFile, homeContent);
console.log("Fixed page.tsx");
