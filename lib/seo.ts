import type { Metadata } from 'next'

export const SUPPORTED_LANGUAGES = ['en', 'ar', 'zh', 'fr'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
}

export function getSafeLanguage(lang?: string): SupportedLanguage {
  if (lang && isValidLanguage(lang)) {
    return lang
  }
  return DEFAULT_LANGUAGE
}

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  return url.replace(/\/$/, '')
}

/**
 * Returns RFC 5988 / Google Search compliant canonical and hreflang alternate URLs
 * for en, ar, zh, fr, and x-default.
 */
export function getAlternates(pathname: string = '', currentLang: string = DEFAULT_LANGUAGE) {
  const siteUrl = getSiteUrl()
  const lang = getSafeLanguage(currentLang)

  // Remove leading / trailing slashes and any leading locale if present
  let cleanPath = pathname.replace(/^\/+|\/+$/g, '')
  for (const l of SUPPORTED_LANGUAGES) {
    if (cleanPath === l) {
      cleanPath = ''
      break
    }
    if (cleanPath.startsWith(`${l}/`)) {
      cleanPath = cleanPath.slice(l.length + 1)
      break
    }
  }

  const suffix = cleanPath ? `/${cleanPath}` : ''

  return {
    canonical: `${siteUrl}/${lang}${suffix}`,
    languages: {
      en: `${siteUrl}/en${suffix}`,
      ar: `${siteUrl}/ar${suffix}`,
      zh: `${siteUrl}/zh${suffix}`,
      fr: `${siteUrl}/fr${suffix}`,
      'x-default': `${siteUrl}/en${suffix}`,
    },
  }
}

export interface LocalizedSeoContent {
  title: string
  description: string
  keywords?: string[]
}

export const SEO_DICTIONARY: Record<
  string,
  Record<SupportedLanguage, LocalizedSeoContent>
> = {
  root: {
    en: {
      title: 'AgriGuru Online - Global Agricultural Trading',
      description: 'The premium B2B SaaS platform for global agricultural trade. Access live commodity prices, freight rates, crop intelligence, and trade matching.',
      keywords: [
        'Agriculture',
        'Commodity Trading',
        'B2B Marketplace',
        'Agricultural Commodities',
        'AgriGuru Online',
        'Agricultural Trade',
        'Commodity Prices',
        'Crop Intelligence',
        'Export',
        'Import'
      ],
    },
    ar: {
      title: 'AgriGuru Online - منصة التجارة الزراعية العالمية',
      description: 'المنصة العالمية الرائدة لتجارة السلع الزراعية بين الشركات. احصل على أسعار السلع الفورية، أسعار الشحن البحري، وتحليلات الأسواق.',
      keywords: [
        'تجارة زراعية',
        'سوق السلع الزراعية',
        'منصة تجارة B2B',
        'استيراد وتصدير الحبوب',
        'AgriGuru Online',
        'أسعار المحاصيل العالمية'
      ],
    },
    zh: {
      title: 'AgriGuru Online - 全球农产品大宗商品跨境交易平台',
      description: '全球领先的农产品B2B贸易SaaS平台。提供实时大宗农产品价格行情、海运费走势、供需情报及智能商机匹配。',
      keywords: [
        '农产品交易',
        '大宗商品贸易',
        'B2B跨境电商',
        '全球农产品进出口',
        'AgriGuru Online',
        '实时大宗价格'
      ],
    },
    fr: {
      title: 'AgriGuru Online - Plateforme Mondiale de Commerce Agricole',
      description: 'La plateforme SaaS B2B de référence pour le commerce mondial des matières premières agricoles. Cours en direct, fret maritime et veille de marché.',
      keywords: [
        'Commerce agricole',
        'Négoce de matières premières',
        'Plateforme B2B',
        'Exportation agricole',
        'AgriGuru Online',
        'Prix des denrées agricoles'
      ],
    },
  },
  home: {
    en: {
      title: 'Global Agricultural Trading & B2B Commodity Platform',
      description: 'Discover global agricultural trade opportunities, real-time commodity prices, freight trends, and B2B intelligence on AgriGuru Online.',
      keywords: [
        'Agricultural Trading',
        'Commodities Marketplace',
        'Agri B2B Platform',
        'Global Crop Prices',
        'AgriGuru Online',
        'Export Import Agriculture'
      ],
    },
    ar: {
      title: 'منصة التجارة الزراعية العالمية وسوق السلع بين الشركات',
      description: 'اكتشف فرص التجارة الزراعية الدولية، أسعار السلع الفورية، اتجاهات الشحن، وتحليلات التجارة بين الشركات على AgriGuru Online.',
      keywords: [
        'التجارة الزراعية',
        'سوق السلع الزراعية',
        'منصة B2B الزراعية',
        'أسعار المحاصيل العالمية',
        'AgriGuru Online',
        'استيراد وتصدير المحاصيل'
      ],
    },
    zh: {
      title: '全球农产品贸易与B2B大宗商品交易平台',
      description: '在 AgriGuru Online 探索全球农产品国际贸易机会、实时农产品报价、海运价格趋势和智能农业贸易撮合。',
      keywords: [
        '农产品进出口',
        '大宗农产品交易',
        '全球农业B2B平台',
        '农产品即时行情',
        'AgriGuru Online',
        '粮食与经济作物贸易'
      ],
    },
    fr: {
      title: 'Plateforme Mondiale de Commerce et Négoce Agricole B2B',
      description: 'Découvrez des opportunités de commerce agricole mondial, les prix des denrées en temps réel, les tendances du fret et la veille B2B sur AgriGuru Online.',
      keywords: [
        'Négoce agricole international',
        'Marché des matières premières',
        'Plateforme B2B agriculture',
        'Prix des récoltes mondiales',
        'AgriGuru Online',
        'Export import agricole'
      ],
    },
  },
  about: {
    en: {
      title: 'About Us - B2B Agri Trading Platform',
      description: 'Learn about AgriGuru Online: The AI-powered B2B platform transforming global agricultural commodity trading for buyers, sellers, and traders worldwide.',
      keywords: [
        'About AgriGuru Online',
        'Agri Commodity Trading Platform',
        'Global Agriculture Trade',
        'B2B Agriculture Marketplace',
        'Agricultural Export Import'
      ],
    },
    ar: {
      title: 'من نحن - منصة التجارة الزراعية العالمية B2B',
      description: 'تعرف على AgriGuru Online: المنصة الرقمية المدعومة بالذكاء الاصطناعي التي تقود تحول التجارة العالمية للمحاصيل والسلع الزراعية بين الشركات.',
      keywords: [
        'عن AgriGuru Online',
        'منصة تداول السلع الزراعية',
        'التجارة الزراعية الدولية',
        'سوق B2B الزراعي',
        'استيراد وتصدير المنتجات الزراعية'
      ],
    },
    zh: {
      title: '关于我们 - 全球B2B农产品交易数字化平台',
      description: '了解 AgriGuru Online：通过AI与大数据驱动的全球农产品大宗商品跨境B2B交易平台，服务全球买家、卖家和国际贸易商。',
      keywords: [
        '关于 AgriGuru Online',
        '农产品交易平台',
        '全球农业贸易',
        'B2B农产品市场',
        '农业进出口跨境平台'
      ],
    },
    fr: {
      title: 'À Propos - Plateforme B2B de Commerce Agricole',
      description: 'Découvrez AgriGuru Online : la plateforme B2B innovante optimisée par IA qui transforme le négoce international des produits agricoles pour les acheteurs et vendeurs mondiaux.',
      keywords: [
        'À propos de AgriGuru Online',
        'Plateforme de négoce agricole',
        'Commerce agricole mondial',
        'Marché agricole B2B',
        'Import export agricole'
      ],
    },
  },
  contact: {
    en: {
      title: 'Contact Us',
      description: 'Get in touch with AgriGuru Online. Find our global office locations, contact information, customer support, and send us a message.',
      keywords: [
        'Contact AgriGuru',
        'Agricultural Support',
        'Agri Trade Inquiry',
        'Customer Service AgriGuru'
      ],
    },
    ar: {
      title: 'اتصل بنا',
      description: 'تواصل مع فريق AgriGuru Online. اكتشف مواقع مكاتبنا الدولية، بيانات التواصل، دعم العملاء، وأرسل استفسارك التجاري مباشرة.',
      keywords: [
        'اتصل بـ AgriGuru',
        'دعم التجارة الزراعية',
        'استفسار تجاري',
        'خدمة عملاء AgriGuru'
      ],
    },
    zh: {
      title: '联系我们',
      description: '联系 AgriGuru Online 全球服务团队。获取全球分支机构地址、电话、技术支持并随时向我们发送业务咨询。',
      keywords: [
        '联系 AgriGuru',
        '农产品贸易咨询',
        '客户支持',
        '商务合作'
      ],
    },
    fr: {
      title: 'Contactez-nous',
      description: 'Prenez contact avec AgriGuru Online. Retrouvez les coordonnées de nos bureaux internationaux, notre assistance clientèle et transmettez-nous vos demandes.',
      keywords: [
        'Contacter AgriGuru',
        'Support négoce agricole',
        'Demande commerciale',
        'Service client AgriGuru'
      ],
    },
  },
  download_app: {
    en: {
      title: 'Download Mobile Application',
      description: 'Download the AgriGuru Online Mobile App for Agri Commodity Importers, Exporters and Traders. Real-time product prices, ocean freight rates, and smart documentation.',
      keywords: [
        'Download AgriGuru App',
        'Agri Trading Mobile App',
        'Commodity Prices App',
        'Ocean Freight Calculator'
      ],
    },
    ar: {
      title: 'تحميل تطبيق الهاتف المحمول',
      description: 'حمل تطبيق AgriGuru Online للهواتف الذكية لمستوردي ومصدري وتجار السلع الزراعية. أسعار السلع اللحظية، أسعار الشحن، والمستندات الذكية.',
      keywords: [
        'تحميل تطبيق AgriGuru',
        'تطبيق التجارة الزراعية',
        'أسعار السلع على الهاتف',
        'تطبيق الشحن البحري'
      ],
    },
    zh: {
      title: '下载移动端应用程序',
      description: '下载 AgriGuru Online 官方移动应用程序。专为全球农产品进出口商打造，随时随地查看即时价格、海运报价及智能外贸单证。',
      keywords: [
        '下载 AgriGuru App',
        '农产品交易APP',
        '大宗商品行情APP',
        '海运运价助手'
      ],
    },
    fr: {
      title: "Télécharger l'Application Mobile",
      description: "Téléchargez l'application mobile AgriGuru Online pour les importateurs, exportateurs et négociants agricoles. Cours en direct, fret maritime et documentation intelligente.",
      keywords: [
        'Application AgriGuru',
        'App commerce agricole',
        'Cours matières premières mobile',
        'Tarifs fret maritime'
      ],
    },
  },
  news: {
    en: {
      title: 'Global Agriculture & Commodity Trade News',
      description: 'Read the latest global agriculture news, international commodity market developments, government trade policies, and price forecasts on AgriGuru Online.',
      keywords: [
        'Global Agriculture News',
        'Commodity Market News',
        'Agri Trade Updates',
        'Crop Export News',
        'AgriGuru Online'
      ],
    },
    ar: {
      title: 'أخبار التجارة الزراعية والسلع العالمية',
      description: 'تابع أحدث أخبار الزراعة العالمية، تطورات أسواق السلع الدولية، السياسات التجارية الحكومية، وتوقعات الأسعار على AgriGuru Online.',
      keywords: [
        'أخبار الزراعة العالمية',
        'أخبار سوق السلع',
        'مستجدات التجارة الزراعية',
        'AgriGuru Online'
      ],
    },
    zh: {
      title: '全球农业与大宗商品贸易快讯',
      description: '阅读最新的全球农业新闻、国际大宗商品市场动态、各国进出口政策法规以及前沿价格预测分析。',
      keywords: [
        '全球农业新闻',
        '大宗商品市场行情',
        '农业贸易政策',
        '粮食进出口动态',
        'AgriGuru Online'
      ],
    },
    fr: {
      title: 'Actualités Mondiales du Commerce et Négoce Agricole',
      description: 'Consultez les dernières actualités agricoles mondiales, l’évolution des marchés de matières premières, les politiques commerciales et les prévisions de prix.',
      keywords: [
        'Actualités agricoles mondiales',
        'Marché des matières premières',
        'Informations négoce agricole',
        'AgriGuru Online'
      ],
    },
  },
  events: {
    en: {
      title: 'Global Agriculture Events, Expos & Conferences',
      description: 'Discover upcoming international agricultural exhibitions, commodity trade fairs, expos, and networking conferences worldwide on AgriGuru Online.',
      keywords: [
        'Agriculture Events',
        'Commodity Trade Expos',
        'Agri Trade Shows',
        'Global Farming Conferences',
        'AgriGuru Online'
      ],
    },
    ar: {
      title: 'الفعاليات والمعارض والمؤتمرات الزراعية العالمية',
      description: 'اكتشف المعارض الزراعية الدولية القادمة، معارض تجارة السلع، والمؤتمرات العالمية للتواصل بين الشركات على AgriGuru Online.',
      keywords: [
        'معارض زراعية دولية',
        'مؤتمرات السلع الزراعية',
        'معارض التجارة الدولية',
        'AgriGuru Online'
      ],
    },
    zh: {
      title: '全球农业展会、商贸博览会与高端峰会',
      description: '探索全球最新的国际农业展览会、大宗农产品展销会、行业峰会与商业洽谈展贸盛会。',
      keywords: [
        '农业展会',
        '大宗商品博览会',
        '农业国际峰会',
        '国际农产品商贸展',
        'AgriGuru Online'
      ],
    },
    fr: {
      title: 'Événements, Foires et Conférences Agricoles Mondiales',
      description: 'Découvrez les prochains salons professionnels agricoles internationaux, foires commerciales et conférences de négoce dans le monde entier.',
      keywords: [
        'Salons agricoles',
        'Foires commerciales matières premières',
        'Conférences agricoles mondiales',
        'AgriGuru Online'
      ],
    },
  },
  market_updates: {
    en: {
      title: 'Daily Agri Market Updates & Trade Flyers',
      description: 'Stay informed with daily agricultural commodity flyers, harvest updates, market price shifts, and trade bulletins on AgriGuru Online.',
      keywords: [
        'Agri Market Updates',
        'Commodity Market Flyers',
        'Daily Agricultural Bulletins',
        'Crop Harvest Trends',
        'AgriGuru Online'
      ],
    },
    ar: {
      title: 'تحديثات السوق الزراعي اليومية ونشرات التجارة',
      description: 'ابق على اطلاع دائم بنشرات السلع الزراعية اليومية، تقارير الحصاد، تقلبات أسعار السوق، والتحديثات التجارية على AgriGuru Online.',
      keywords: [
        'تحديثات السوق الزراعي',
        'نشرات السلع اليومية',
        'تقارير المحاصيل',
        'AgriGuru Online'
      ],
    },
    zh: {
      title: '每日农业市场快报与交易简报',
      description: '及时获取每日大宗农产品市场简讯、收成报告、实时价格波动和一手商业动态分析。',
      keywords: [
        '农业市场快报',
        '农产品每日简报',
        '作物收成行情',
        '大宗交易内参',
        'AgriGuru Online'
      ],
    },
    fr: {
      title: 'Mises à Jour Quotidiennes du Marché Agricole',
      description: 'Restez informé avec les bulletins quotidiens des matières premières agricoles, les bilans de récolte et les fluctuations de cours sur AgriGuru Online.',
      keywords: [
        'Mises à jour marché agricole',
        'Bulletins matières premières',
        'Tendances récoltes',
        'AgriGuru Online'
      ],
    },
  },
  market_reports: {
    en: {
      title: 'Agri Market Reports & Trade Intelligence',
      description: 'Access exclusive agricultural commodity market reports, in-depth crop analysis, supply-demand forecasts, and trade intelligence on AgriGuru Online.',
      keywords: [
        'Agri Market Reports',
        'Commodity Trade Intelligence',
        'Crop Forecast Reports',
        'Agriculture Market Analysis',
        'AgriGuru Online'
      ],
    },
    ar: {
      title: 'تقارير الأسواق الزراعية وتحليلات التجارة المتخصصة',
      description: 'احصل على تقارير حصرية عن أسواق السلع الزراعية، تحليلات المحاصيل المعمقة، توقعات العرض والطلب، والذكاء التجاري على AgriGuru Online.',
      keywords: [
        'تقارير الأسواق الزراعية',
        'تحليلات تجارة السلع',
        'توقعات العرض والطلب',
        'AgriGuru Online'
      ],
    },
    zh: {
      title: '农产品行业深度研究报告与商贸情报',
      description: '查阅权威独家的农产品大宗市场报告、作物产销深度剖析、供需平衡预测及全球商业情报。',
      keywords: [
        '农业市场报告',
        '大宗商品研究研报',
        '作物供需预测',
        '农产品产业分析',
        'AgriGuru Online'
      ],
    },
    fr: {
      title: 'Rapports de Marché Agricole & Intelligence Commerciale',
      description: 'Consultez des rapports exclusifs sur les marchés des denrées agricoles, des analyses approfondies des récoltes et des prévisions d’offre et de demande.',
      keywords: [
        'Rapports marché agricole',
        'Intelligence négoce matières premières',
        'Prévisions récoltes',
        'AgriGuru Online'
      ],
    },
  },
  video_gallery: {
    en: {
      title: 'Agri Video Gallery & Market Analysis',
      description: 'Watch expert agricultural commodity analysis, market video updates, tutorial guides, and industry insights on AgriGuru Online.',
      keywords: [
        'Agricultural Video Analysis',
        'Agri Commodity Videos',
        'Crop Market Video Updates',
        'AgriGuru Online'
      ],
    },
    ar: {
      title: 'معرض الفيديو الزراعي وتحليلات السوق المرئية',
      description: 'شاهد تحليلات الخبراء لسوق السلع الزراعية، التحديثات المرئية للأسواق، والشروحات التوجيهية المتخصصة على AgriGuru Online.',
      keywords: [
        'فيديوهات السوق الزراعي',
        'تحليلات مرئية للسلع',
        'فيديوهات المحاصيل',
        'AgriGuru Online'
      ],
    },
    zh: {
      title: '农业大宗视频中心与专家行情视界',
      description: '观看农产品大宗商品深度视频分析、前沿行情播报、行业操作指南以及全球专家解读。',
      keywords: [
        '农产品行情视频',
        '农业市场专家解析',
        '大宗商品贸易视频',
        'AgriGuru Online'
      ],
    },
    fr: {
      title: 'Galerie Vidéo Agricole & Analyses Vidéos de Marché',
      description: 'Regardez les analyses d’experts en matières premières agricoles, les vidéos d’actualité des marchés et les guides pratiques sur AgriGuru Online.',
      keywords: [
        'Vidéos marché agricole',
        'Analyses matières premières vidéo',
        'Insights agricoles',
        'AgriGuru Online'
      ],
    },
  },
  participation_gallery: {
    en: {
      title: 'Participation Gallery & Global Expo Highlights',
      description: "Explore AgriGuru Online's participation across premier international agriculture conferences, global trade expos, and summits worldwide.",
      keywords: [
        'AgriGuru Participation Gallery',
        'Agriculture Conferences Exhibitor',
        'Global Agricultural Trade Events',
        'AgriGuru Online Exhibitions'
      ],
    },
    ar: {
      title: 'معرض المشاركات والفعاليات الدولية',
      description: 'استكشف مشاركات AgriGuru Online في أبرز المؤتمرات والمعارض الزراعية الدولية وقمم التجارة العالمية.',
      keywords: [
        'معرض مشاركات AgriGuru',
        'معارض التجارة الزراعية الدولية',
        'فعاليات AgriGuru',
        'AgriGuru Online'
      ],
    },
    zh: {
      title: '展会足迹与全球经贸峰会图集',
      description: '回顾 AgriGuru Online 在全球顶级国际农业盛会、跨境商贸博览会及高端峰会上的精彩亮相与商务合作瞬间。',
      keywords: [
        'AgriGuru 参展回顾',
        '国际农业展会相册',
        '全球商贸博览会展台',
        'AgriGuru Online'
      ],
    },
    fr: {
      title: 'Galerie des Participations & Salons Internationaux',
      description: 'Découvrez la présence et les participations d’AgriGuru Online aux conférences agricoles internationales et salons professionnels à travers le monde.',
      keywords: [
        'Galerie participations AgriGuru',
        'Salons professionnels mondiaux',
        'Expositions agricoles',
        'AgriGuru Online'
      ],
    },
  },
  product_charts: {
    en: {
      title: 'Agricultural Commodity Price Charts & Trends',
      description: 'Track live and historical agricultural commodity price charts, market trends, and FOB price movements across global origins on AgriGuru Online.',
      keywords: [
        'Commodity Price Charts',
        'Agri Price Trends',
        'Historical Crop Prices',
        'FOB Price Tracking',
        'AgriGuru Online'
      ],
    },
    ar: {
      title: 'الرسوم البيانية لأسعار السلع الزراعية والاتجاهات التاريخية',
      description: 'تتبع الرسوم البيانية اللحظية والتاريخية لأسعار السلع الزراعية، اتجاهات الأسواق، وحركات أسعار FOB من مختلف موانئ المنشأ العالمية على AgriGuru Online.',
      keywords: [
        'رسوم بيانية لأسعار السلع',
        'اتجاهات الأسعار الزراعية',
        'أسعار المحاصيل التاريخية',
        'AgriGuru Online'
      ],
    },
    zh: {
      title: '农产品大宗价格走势图表与历史行情走势',
      description: '实时追踪全球农产品即时及历史价格图表、全球主要港口FOB离岸价格走势及周期趋势。',
      keywords: [
        '农产品价格图表',
        '大宗商品价格走势',
        '农产品历史价格',
        'FOB价格走势',
        'AgriGuru Online'
      ],
    },
    fr: {
      title: 'Graphiques des Prix des Denrées Agricoles & Tendances',
      description: 'Suivez les graphiques des prix en temps réel et historiques des matières premières agricoles et les cours FOB mondiaux sur AgriGuru Online.',
      keywords: [
        'Graphiques prix agricoles',
        'Tendances cours agricoles',
        'Historique prix denrées',
        'AgriGuru Online'
      ],
    },
  },
  freight_charts: {
    en: {
      title: 'Freight Charts & Ocean Shipping Rate Trends',
      description: 'Track live and historical global ocean freight rates, container shipping costs (20FT / 40FT FCL, Breakbulk), and freight market trends on AgriGuru Online.',
      keywords: [
        'Freight Charts',
        'Ocean Freight Charts',
        'Container Shipping Prices',
        'FCL Freight Rates',
        'AgriGuru Online'
      ],
    },
    ar: {
      title: 'مخططات الشحن البحري واتجاهات أسعار النقل الدولي',
      description: 'تتبع أسعار الشحن البحري الدولية اللحظية والتاريخية، تكاليف شحن الحاويات (20 قدم / 40 قدم)، واتجاهات سوق النقل على AgriGuru Online.',
      keywords: [
        'مخططات الشحن',
        'أسعار الشحن البحري',
        'تكاليف شحن الحاويات',
        'AgriGuru Online'
      ],
    },
    zh: {
      title: '海运运价走势图表与国际航运价格趋势',
      description: '实时追踪全球主要航线集装箱海运费走势（20尺/40尺柜整箱FCL及散杂货），掌握国际物流成本动向。',
      keywords: [
        '海运价格走势',
        '国际航运运费图表',
        '集装箱海运费',
        '散货航运运价',
        'AgriGuru Online'
      ],
    },
    fr: {
      title: 'Graphiques du Fret Maritime & Tarifs des Conteneurs',
      description: 'Suivez les tarifs du fret maritime mondial en direct et historiques, coûts des conteneurs (20FT / 40FT FCL) et tendances maritimes sur AgriGuru Online.',
      keywords: [
        'Graphiques fret maritime',
        'Tarifs transport maritime',
        'Prix conteneurs FCL',
        'AgriGuru Online'
      ],
    },
  },
  marketed_products: {
    en: {
      title: 'Marketed Agricultural Commodities & Products',
      description: 'Browse active marketed agricultural commodities, origin details, specifications, and FOB prices. Explore B2B trade opportunities on AgriGuru Online.',
      keywords: [
        'Marketed Agricultural Commodities',
        'Agri Commodity Listings',
        'FOB Commodity Prices',
        'AgriGuru Online'
      ],
    },
    ar: {
      title: 'المنتجات والسلع الزراعية المعروضة للتداول',
      description: 'تصفح السلع الزراعية النشطة المعروضة للتداول، تفاصيل المنشأ، المواصفات الفنية، وأسعار FOB. استكشف فرص التجارة العالمية على AgriGuru Online.',
      keywords: [
        'منتجات زراعية معروضة',
        'سلع زراعية للتداول',
        'مواصفات المحاصيل',
        'AgriGuru Online'
      ],
    },
    zh: {
      title: '在售农产品大宗商品展厅与商机目录',
      description: '浏览当季热销的进出口大宗农产品、产地详情、技术规格指标及离岸FOB指导价，快速对接全球商机。',
      keywords: [
        '热销农产品',
        '大宗农产品目录',
        'FOB农产品现货',
        '外贸现货货源',
        'AgriGuru Online'
      ],
    },
    fr: {
      title: 'Produits et Matières Premières Agricoles Commercialisés',
      description: 'Parcourez les produits agricoles commercialisés, caractéristiques, origines et prix FOB. Saisissez des opportunités B2B sur AgriGuru Online.',
      keywords: [
        'Produits agricoles commercialisés',
        'Offres matières premières',
        'Prix FOB denrées',
        'AgriGuru Online'
      ],
    },
  },
  latest_offers: {
    en: {
      title: 'Latest Offers for Buyers',
      description: 'Explore the latest selling offers from global verified agricultural suppliers and exporters on AgriGuru Online.',
    },
    ar: {
      title: 'أحدث عروض البيع للمشترين',
      description: 'استكشف أحدث عروض البيع المباشرة المقدمة من كبار الموردين والمصدرين الزراعيين المعتمدين دولياً على AgriGuru Online.',
    },
    zh: {
      title: '买家最新供应报价信息',
      description: '查看全球认证优质农产品供应商及出口商发布的最新现货与期货供应报价，尊享一手实惠货源。',
    },
    fr: {
      title: 'Dernières Offres de Vente pour Acheteurs',
      description: 'Découvrez les dernières offres de vente directes de fournisseurs et exportateurs agricoles certifiés sur AgriGuru Online.',
    },
  },
  latest_inquiries: {
    en: {
      title: 'Latest Inquiries for Sellers',
      description: 'Explore the latest verified buying inquiries and purchase demands from international commodity buyers on AgriGuru Online.',
    },
    ar: {
      title: 'أحدث طلبات الشراء للبائعين والمصدرين',
      description: 'استكشف أحدث طلبات الشراء المؤكدة وعروض الشراء الواردة من المستوردين والمشترين الدوليين على AgriGuru Online.',
    },
    zh: {
      title: '卖家最新采购询盘需求',
      description: '浏览来自全球国际买家的最新农产品真实采购订单与寻源询盘，直接对接高质量海外大买家。',
    },
    fr: {
      title: 'Dernières Demandes d’Achat pour Vendeurs',
      description: 'Consultez les demandes d’achat vérifiées et les besoins d’approvisionnement d’acheteurs internationaux sur AgriGuru Online.',
    },
  },
  login: {
    en: {
      title: 'Login to Your Account',
      description: 'Log in to AgriGuru Online to access your agricultural commodity trading dashboard, price charts, and market intelligence.',
    },
    ar: {
      title: 'تسجيل الدخول إلى حسابك',
      description: 'سجل الدخول إلى AgriGuru Online للوصول إلى لوحة تداول السلع الزراعية، الرسوم البيانية، والتقارير الحصرية.',
    },
    zh: {
      title: '登录您的账户',
      description: '登录 AgriGuru Online 开启全功能大宗农产品交易控制台、实时价格走势及独家行业内参。',
    },
    fr: {
      title: 'Connexion à Votre Compte',
      description: 'Connectez-vous à AgriGuru Online pour accéder à votre tableau de bord commercial, graphiques de prix et rapports de marché.',
    },
  },
  register: {
    en: {
      title: 'Create an Account',
      description: 'Register for an AgriGuru Online account to unlock global agricultural trading, real-time commodity pricing, and trade reports.',
    },
    ar: {
      title: 'إنشاء حساب جديد',
      description: 'أنشئ حسابك في AgriGuru Online للوصول إلى شبكة التجارة الزراعية الدولية، أسعار السلع الفورية، وتقارير السوق المتميزة.',
    },
    zh: {
      title: '注册新用户',
      description: '免费注册 AgriGuru Online 会员，开启全球农产品数字贸易网络，获取即时大宗行情与专业研报。',
    },
    fr: {
      title: 'Créer un Compte',
      description: 'Créez votre compte AgriGuru Online pour débloquer le commerce agricole international et les cours des denrées en direct.',
    },
  },
  profile: {
    en: {
      title: 'My Profile',
      description: 'Manage your profile, company details, preferences, and verified credentials on AgriGuru Online.',
    },
    ar: {
      title: 'الملف الشخصي',
      description: 'إدارة ملفك الشخصي، بيانات الشركة، التفضيلات التجارية، والوثائق المعتمدة على AgriGuru Online.',
    },
    zh: {
      title: '个人中心与企业档案',
      description: '管理您的个人信息、企业资质、认证材料及偏好设置，展示全球商业信誉。',
    },
    fr: {
      title: 'Mon Profil',
      description: 'Gérez votre profil, les informations de votre entreprise et vos préférences sur AgriGuru Online.',
    },
  },
  alerts_setups: {
    en: {
      title: 'Price Alerts & Market Setups',
      description: 'Configure and manage your personalized commodity price alerts, freight threshold notifications, and trade market setups.',
    },
    ar: {
      title: 'تنبيهات الأسعار وإعدادات السوق',
      description: 'قم بتهيئة وإدارة تنبيهات أسعار السلع المخصصة، إشعارات الشحن البحري، وإعدادات مراقبة السوق الخاصة بك.',
    },
    zh: {
      title: '价格预警与行情提醒设置',
      description: '配置并管理您专属的大宗商品价格波动预警、海运运费门槛提醒及个性化监控策略。',
    },
    fr: {
      title: 'Alertes de Prix & Configuration Marché',
      description: 'Configurez et gérez vos alertes de cours personnalisées, vos seuils de fret et vos configurations de marché sur AgriGuru Online.',
    },
  },
}

/**
 * Helper to construct standard metadata for any page
 */
export function getStandardMetadata({
  pageKey,
  pathname,
  lang,
  overrideTitle,
  overrideDescription,
  overrideKeywords,
  noIndex = false,
  ogImage,
}: {
  pageKey?: keyof typeof SEO_DICTIONARY
  pathname: string
  lang: string
  overrideTitle?: string
  overrideDescription?: string
  overrideKeywords?: string[]
  noIndex?: boolean
  ogImage?: string
}): Metadata {
  const safeLang = getSafeLanguage(lang)
  const siteUrl = getSiteUrl()
  const content = pageKey && SEO_DICTIONARY[pageKey] ? SEO_DICTIONARY[pageKey][safeLang] : undefined

  const title = overrideTitle || content?.title || SEO_DICTIONARY.root[safeLang].title
  const description = overrideDescription || content?.description || SEO_DICTIONARY.root[safeLang].description
  const keywords = overrideKeywords || content?.keywords || SEO_DICTIONARY.root[safeLang].keywords

  const alternates = getAlternates(pathname, safeLang)
  const fullTitle = `${title} | AgriGuru Online`
  const imageUrl = ogImage || `${siteUrl}/logo.png`

  return {
    title,
    description,
    keywords,
    robots: noIndex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : {
          index: true,
          follow: true,
        },
    openGraph: {
      title: fullTitle,
      description,
      url: alternates.canonical,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: safeLang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates,
  }
}
