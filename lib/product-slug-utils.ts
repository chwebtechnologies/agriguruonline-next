/**
 * Helper to resolve a product slug from its name or id.
 * Maps known commodity titles from trading inquiries/offers to their actual marketed product slugs.
 */

const KNOWN_PRODUCT_NAME_TO_SLUG: Record<string, string> = {
  '100% broken parboiled': '100-broken-parboiled-rice',
  'ir64 white rice 05%': 'ir64-white-rice-5-sortex',
  'ir64 white rice 25% ss': 'ir64-white-rice-25-sortex',
  'irri6 parboiled rice 05%': 'irri6-parboiled-rice-5',
  'irri6 white 100% broken': 'irri-6-100-broken-white-rice',
  'white rice 05%': 'thai-white-rice-5',
  'white rice 25%': 'thai-white-rice-25',
  'ic150 white crystal brazil sugar': 'ic150-white-crystal-sugar',
  'ic45 white refined sugar': 'ic45-white-refined-sugar',
  'fragrant rice 100% broken': 'fragrant-rice-100-broken',
  'japonica 05% broken rice': 'japonica-5-broken-rice',
  'ir64 parboiled rice 05%': 'ir64-parboiled-rice-5-sortex',
  '100% broken white': 'white-rice-100-broken',
  'ir8 parboiled 05%': 'ir8-parboiled-5',
  'pr11 sella rice': 'pr-11-sella-rice',
  'pr11 golden rice': 'pr-11-golden-rice',
  'pr11 steam rice': 'pr-11-steam-rice',
  'sona masoori steam rice': 'sona-masoori-steam-rice',
  'pusa steam basmati rice': 'pusa-steam-basmati-rice',
  '1121 sella basmati rice': '1121-sella-basmati-rice',
  '1121 golden basmati rice': '1121-golden-basmati-rice',
  '1121 steam basmati rice': '1121-steam-basmati-rice',
  'sugandha sella basmati rice': 'sugandha-sella-basmati-rice',
  'sharbati sella rice': 'sharbati-sella-basmati-rice',
  'irri6 white rice 05%': '5-irri-6-white-rice-long-grain-pakistan',
  'irri6 white rice 25%': '25-irri6-white-rice-long-grain-pakistan',
  'parboiled rice 05%': 'thai-parboiled-rice-5',
  'hom mali rice 05%': 'hom-mali-rice-5',
  'white rice 05% broken': 'viet-white-rice-5-broken',
  'white rice 25% broken': 'viet-white-rice-25-broken',
  'white rice 100% broken': 'viet-white-rice-100-broken',
  'jasmin white rice 05%': 'jasmin-white-rice-5-broken',
  'swarna brown rice 05%': 'swarna-brown-rice-5-sortex',
  'swarna white rice 05%': 'swarna-white-rice-5-sortex',
  'swarna parboiled rice 05%': 'swarna-parboiled-rice-5-sortex',
  'swarna white rice 25%': 'swarna-white-rice-25-cleaned',
  'emata white rice 100%': 'emata-white-100-broken-b-12-sortes',
  'emata white rice 25%': 'emata-white-rice-25-broken',
  'emata white rice 05%': 'long-grain-white-rice-05-broken',
  'renuka sugar ic 45': 'renuka-sugar-ic-45',
  'india parboiled rice 10% broken': 'parboiled-rice-10-broken',
  'india sugar s30': 'sugar-s30',
  'milling wheat': 'milling-wheat',
  'indian milling wheat': 'indian-milling-wheat',
  'indian feed barely': 'indian-feed-barely',
  'indian yellow corn / maize': 'indian-yellow-corn-maize',
  'indian sorghum': 'indian-sorghum',
  'pakistan milling wheat': 'pakistan-milling-wheat',
  'feed wheat': 'feed-wheat',
  'pakistan yellow corn / maize': 'pakistan-yellow-corn-maize',
  'test product - ag': 'test-product-ag',
  'hard red spring wheat': 'hard-red-spring-wheat',
  'canada kabuli chickpeas': 'canada-kabuli-chickpeas',
  'premium hard wheat': 'premium-hard-wheat',
  'red kidney beans': 'red-kidney-beans',
  'australian milling wheat': 'australian-milling-wheat',
  'yellow mazie': 'yellow-mazie',
  'yellow maize': 'yellow-maize',
  'ukraine milling wheat': 'ukraine-milling-wheat',
  'soft wheat': 'soft-wheat',
  'argentina yellow peas': 'argentina-yellow-peas',
  'feba beans': 'feba-beans',
  'australian desi chickpeas - 1': 'australian-desi-chcikpeas',
  'feed barely': 'feed-barely',
  'ir64 white rice 25% mc': 'ir64-white-rice-25-mc',
  'chickpeas 42/44 sortex': 'chickpeas-4244-sortex',
  'tur lemon burma': 'tur-burnma-variety',
  'masoor nipper no 1': 'masoor-nipper-no-1',
  'masoor crimson no 2': 'masoor-crimson-no-2',
  'yellow pea (canada)': 'yellow-pea-canada',
  'test  product rice': 'test-product-lentil',
  'chickpeas 58/60 sortex': 'chickpeas-5860-sortex',
  'australian desi chickpeas (chana)': 'australian-desi-chickpeas-3',
  'soybean (west africa)': 'soybean-west-africa',
  'rbd palm oil cp-10 - in': 'rbd-palm-oil-cp-10',
  'rbd palm oil cp-10 - ma': 'rbd-palm-oil-cp-10-ma',
  'doga spaghetti – 1.2 mm': 'doga-spaghetti-12-mm',
  'chickpeas 80/85 sorext': 'chickpeas-8085-sorext'
};

export function getProductSlugByName(name?: string): string | null {
  if (!name) return null;
  const clean = name.trim().toLowerCase();
  if (KNOWN_PRODUCT_NAME_TO_SLUG[clean]) {
    return KNOWN_PRODUCT_NAME_TO_SLUG[clean];
  }
  // Try partial or stripped match
  const stripped = clean.replace(/[^a-z0-9]/g, '');
  for (const [key, slug] of Object.entries(KNOWN_PRODUCT_NAME_TO_SLUG)) {
    if (key.replace(/[^a-z0-9]/g, '') === stripped) {
      return slug;
    }
  }
  return null;
}
