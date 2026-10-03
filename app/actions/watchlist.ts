'use server';

import { cookies } from 'next/headers';
import { getSafeLang, getNormalizedUserType, withTimeout } from '@/lib/api-utils';
import { tradingService } from '@/lib/api/trading.service';
import { getUserProfile } from '@/lib/user-data';

export async function getWatchlistProductsAction(lang: string = 'en') {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || '';
  const safeLang = getSafeLang(lang);

  let products: any[] = [];
  let shippingTerms: any[] = [];
  let userType: string | null = null;
  let favoriteProducts: any[] = [];
  let marketedProducts: any[] = [];

  const [productsSettled, termsSettled, profileSettled, favsSettled] = await Promise.allSettled([
    withTimeout(tradingService.getAllProducts(safeLang), 3000, []),
    withTimeout(tradingService.getShippingTerms(safeLang), 3000, []),
    token ? withTimeout(getUserProfile(token, safeLang).then(r => r.userProfile ? { data: r.userProfile } : null), 2500, null) : Promise.resolve(null),
    withTimeout(tradingService.getFavoriteProducts(token || '', safeLang), 3000, [])
  ]);

  if (productsSettled.status === 'fulfilled' && Array.isArray(productsSettled.value)) {
    const rawProducts = productsSettled.value;
    if (Array.isArray(rawProducts)) {
      products = rawProducts.map((p: any) => ({
        id: p.id || '',
        name: p.name || '',
        category: p.category ? { id: p.category.id || '', name: p.category.name || '' } : { id: '', name: '' },
        country: p.country ? { id: p.country.id || '', name: p.country.name || '', flag: p.country.flag || '', iso2: p.country.iso2 || '' } : { id: '', name: '', flag: '', iso2: '' },
        chart_status: p.chart_status
      }));

      marketedProducts = rawProducts.filter(p => p.is_marketed).map((p: any) => {
        const priceStr = p.loading_ports?.[0]?.price || 0;
        const changeStr = p.change != null ? p.change : (p.price_change != null ? p.price_change : (p.change_percentage != null ? p.change_percentage : 0));
        return {
          id: p.id,
          name: p.name || 'Unknown',
          price: Number(priceStr),
          change: Number(changeStr),
          port: p.loading_ports?.[0]?.port?.name || '',
          countryFlag: p.country?.flag || ''
        };
      }).filter((p: any) => p.price > 0);
    }
  }

  if (termsSettled.status === 'fulfilled' && termsSettled.value) {
    const rawTerms = Array.isArray(termsSettled.value) ? termsSettled.value : ((termsSettled.value as any)?.data?.shipping_term || []);
    if (Array.isArray(rawTerms)) {
      shippingTerms = rawTerms.map((t: any) => ({
        id: t.id || '',
        title: t.title || t.name || ''
      }));
    }
  }

  if (profileSettled.status === 'fulfilled' && profileSettled.value) {
    const uJson = profileSettled.value;
    if (uJson.data?.user_type) {
      userType = getNormalizedUserType(uJson.data.user_type);
    }
  }

  if (favsSettled.status === 'fulfilled' && favsSettled.value) {
    const rawFavs = Array.isArray(favsSettled.value) ? favsSettled.value : [];
    if (Array.isArray(rawFavs)) {
      const getTitle = (obj: any, fallback = 'N/A') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        return obj.name || obj.title || obj.label || fallback;
      };

      const getFlag = (obj: any) => {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        return obj.flag || obj.country?.flag || '';
      };

      favoriteProducts = rawFavs.map((item: any) => {
        const prodName = getTitle(item.product) !== 'N/A' ? getTitle(item.product) : (item.product_name || item.name || 'N/A');
        const catName = getTitle(item.category) !== 'N/A' ? getTitle(item.category) : (item.category_name || 'N/A');
        const countryName = getTitle(item.country) !== 'N/A' ? getTitle(item.country) : (item.country_name || 'N/A');
        const countryFlag = getFlag(item.country) || item.country_flag || item.flag || '';
        const shipBy = getTitle(item.shipping_container) !== 'N/A' ? getTitle(item.shipping_container) : (getTitle(item.shippingContainer) !== 'N/A' ? getTitle(item.shippingContainer) : (item.ship_by || item.shipBy || 'N/A'));
        const term = getTitle(item.shipping_term) !== 'N/A' ? getTitle(item.shipping_term) : (getTitle(item.shippingTerm) !== 'N/A' ? getTitle(item.shippingTerm) : (item.term || 'N/A'));
        const pol = getTitle(item.loading_port) !== 'N/A' ? getTitle(item.loading_port) : (getTitle(item.loadingPort) !== 'N/A' ? getTitle(item.loadingPort) : (item.pol || 'N/A'));
        const polFlag = getFlag(item.loading_port) || getFlag(item.loadingPort) || item.pol_flag || '';
        const pod = getTitle(item.destination_port) !== 'N/A' ? getTitle(item.destination_port) : (getTitle(item.destinationPort) !== 'N/A' ? getTitle(item.destinationPort) : (item.pod || 'N/A'));
        const podFlag = getFlag(item.destination_port) || getFlag(item.destinationPort) || item.pod_flag || '';
        const price = (item.price != null ? Math.round(Number(item.price)) : (item.current_price != null ? Math.round(Number(item.current_price)) : 0)).toString();
        const change = (item.change != null ? Math.round(Number(item.change)) : (item.price_change != null ? Math.round(Number(item.price_change)) : (item.change_percentage != null ? Math.round(Number(item.change_percentage)) : 0))).toString();

        const isChart = (val: any) => {
          if (val === false || val === 0 || val === '0' || val === 'off' || val === 'false' || val === 'disable' || val === 'disabled') return false;
          return true;
        };

        const chartStatus = isChart(item.chart_status) && isChart(item.chartStatus) && isChart(item.product?.chart_status);

        return {
          id: item.id || Date.now(),
          category: catName,
          country: countryName,
          countryFlag,
          product: prodName,
          shipBy,
          term,
          pol,
          polFlag,
          pod,
          podFlag,
          price,
          change,
          chartStatus,
        };
      });
    }
  }

  return {
    products,
    shippingTerms,
    userType,
    favoriteProducts,
    marketedProducts,
  };
}

export async function getWatchlistFreightAction(lang: string = 'en') {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || '';
  const safeLang = getSafeLang(lang);

  let shippingContainers: any[] = [];
  let userType: string | null = null;
  let favoritePorts: any[] = [];

  const [containersSettled, profileSettled, favsSettled] = await Promise.allSettled([
    withTimeout(tradingService.getShippingContainers(safeLang), 3000, []),
    token ? withTimeout(getUserProfile(token, safeLang).then(r => r.userProfile ? { data: r.userProfile } : null), 2500, null) : Promise.resolve(null),
    withTimeout(tradingService.getFavoritePorts(token || '', safeLang), 3000, [])
  ]);

  if (containersSettled.status === 'fulfilled' && containersSettled.value) {
    const rawContainers = Array.isArray(containersSettled.value) ? containersSettled.value : ((containersSettled.value as any)?.data?.shipping_container || []);
    if (Array.isArray(rawContainers)) {
      shippingContainers = rawContainers.map((c: any) => ({
        id: c.id || '',
        title: c.title || c.name || '',
        default_load_capacity: c.default_load_capacity || 0,
        default_unit: c.default_unit?.title || 'MT'
      }));
    }
  }

  if (profileSettled.status === 'fulfilled' && profileSettled.value) {
    const uJson = profileSettled.value;
    if (uJson.data?.user_type) {
      userType = typeof uJson.data.user_type === 'string'
        ? uJson.data.user_type.toLowerCase()
        : String(uJson.data.user_type.name || '').toLowerCase();
    }
  }

  if (favsSettled.status === 'fulfilled' && favsSettled.value) {
    const rawFavs = Array.isArray(favsSettled.value) ? favsSettled.value : [];
    if (Array.isArray(rawFavs)) {
      const getTitle = (obj: any, fallback = 'N/A') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        return obj.title || obj.name || obj.label || fallback;
      };

      const getFlag = (obj: any) => {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        return obj.flag || obj.country?.flag || '';
      };

      favoritePorts = rawFavs.map((item: any) => {
        const shipBy = getTitle(item.shipping_container) !== 'N/A' 
          ? getTitle(item.shipping_container) 
          : (getTitle(item.shippingContainer) !== 'N/A' ? getTitle(item.shippingContainer) : (item.ship_by || item.shipBy || 'N/A'));
        
        const pol = getTitle(item.loading_port) !== 'N/A' 
          ? getTitle(item.loading_port) 
          : (getTitle(item.loadingPort) !== 'N/A' ? getTitle(item.loadingPort) : (item.pol || 'N/A'));
        const polFlag = getFlag(item.loading_port) || getFlag(item.loadingPort) || item.loading_port?.country?.flag || item.pol_flag || '';
        
        const pod = getTitle(item.destination_port) !== 'N/A' 
          ? getTitle(item.destination_port) 
          : (getTitle(item.destinationPort) !== 'N/A' ? getTitle(item.destinationPort) : (item.pod || 'N/A'));
        const podFlag = getFlag(item.destination_port) || getFlag(item.destinationPort) || item.destination_port?.country?.flag || item.pod_flag || '';
        
        const freight = (item.freight != null ? Math.round(Number(item.freight)) : (item.current_freight != null ? Math.round(Number(item.current_freight)) : 0)).toString();
        const freightPmt = (item.freightPMT != null ? Math.round(Number(item.freightPMT)) : (item.freight_pmt != null ? Math.round(Number(item.freight_pmt)) : (item.price != null ? Math.round(Number(item.price)) : 0))).toString();
        const change = (item.change != null ? Math.round(Number(item.change)) : (item.price_change != null ? Math.round(Number(item.price_change)) : (item.change_percentage != null ? Math.round(Number(item.change_percentage)) : 0))).toString();

        const isChart = (val: any) => {
          if (val === false || val === 0 || val === '0' || val === 'off' || val === 'false' || val === 'disable' || val === 'disabled') return false;
          return true;
        };

        const chartStatus = isChart(item.chart_status) && isChart(item.chartStatus);
        const loadCapacity = item.shipping_container?.default_load_capacity || item.load_capacity || 26;
        const loadUnit = item.shipping_container?.default_unit?.title || item.load_unit || 'MT';

        return {
          id: item.id || Date.now().toString(),
          shipBy,
          pol,
          polFlag,
          pod,
          podFlag,
          freight,
          freightPmt,
          change,
          chartStatus,
          loadCapacity,
          loadUnit
        };
      });
    }
  }

  return {
    shippingContainers,
    userType,
    favoritePorts,
  };
}
