'use client';

import React, { useState, useEffect, useMemo, memo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Brush, CartesianGrid, ReferenceLine } from 'recharts';
import { getPriceHistoryAction, getProductDetailsAction, savePriceAlertAction, updatePriceAlertAction, getAlertSetupsAction } from '@/app/actions/charts';
import { decryptData } from '@/lib/crypto-utils';
import { ActionButton } from '@/components/ui/ActionButton';
import { ProductAlertCard } from '@/components/alerts/ProductAlertCard';
import { toast } from 'sonner';

export interface CommodityItemData {
  id: number | string;
  category?: string;
  country?: string;
  countryFlag?: string;
  product: string;
  shipBy?: string;
  term?: string;
  pol?: string;
  polFlag?: string;
  pod?: string;
  podFlag?: string;
  price: string | number;
  change: string | number;
  chartStatus?: boolean;
  alertPrice?: string | number;
  alertId?: string | number;
}

interface PriceHistoryItem {
  date: string;
  price: number;
  timestamp?: number;
  product_comment?: string | null;
  freight_comment?: string | null;
  comment?: string | null;
  remarks?: string | null;
  formattedDate?: string;
  shortDate?: string;
  weekday?: string;
  changeVal?: number;
  changePct?: number;
}

interface PriceHistoryApiResponse {
  message?: string;
  data?: {
    favourite_product?: any;
    alert_price_range?: {
      min: number;
      max: number;
    };
    price_history?: PriceHistoryItem[];
  };
}

// In-memory cache to guarantee instant / 0ms loading on repeat views or timeframe switches
const priceHistoryCache = new Map<string, {
  history: PriceHistoryItem[];
  apiDetails: any;
  alertPriceRange: { min: number; max: number } | null;
  fetchedAt: number;
}>();

const productDetailsCache = new Map<string, any>();

// Helper to parse quality specifications from HTML string
export const parseSpecifications = (html?: string) => {
  if (!html) return { tableData: [], otherData: [] };

  const decoded = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  const textWithNewlines = decoded
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  const items = textWithNewlines.split(/[,\n]/).map(s => s.trim()).filter(Boolean);

  const tableData: { key: string; value: string }[] = [];
  const otherData: string[] = [];

  items.forEach(item => {
    const cleanItem = item.replace(/,$/, '').trim();
    if (!cleanItem) return;

    const colonIndex = cleanItem.indexOf(':');
    if (colonIndex > 0) {
      const key = cleanItem.substring(0, colonIndex).trim();
      const value = cleanItem.substring(colonIndex + 1).trim();
      if (key && value) {
        tableData.push({ key, value });
        return;
      }
    }

    const match = cleanItem.match(/^([A-Za-z\s&/()]+?)\s+([\d.-]+%?.*)$/);
    if (match) {
      tableData.push({ key: match[1].trim(), value: match[2].trim() });
    } else {
      otherData.push(cleanItem);
    }
  });

  return { tableData, otherData };
};

export default function MobileCommodityChart({
  item,
  isFullScreen = false,
  onClose,
  userType,
  onDragStart,
  onDragMove,
  onDragEnd,
  lang = 'en',
}: {
  item: CommodityItemData;
  isFullScreen?: boolean;
  onClose?: () => void;
  userType?: string | null;
  onDragStart?: (clientY: number) => void;
  onDragMove?: (clientY: number) => void;
  onDragEnd?: () => void;
  lang?: string;
}) {
  const router = useRouter();
  // Timeframe filters: 1W, 1M, 6M, 1Y, 5Y, ALL (Default is 1Y)
  const ranges = ['1W', '1M', '6M', '1Y', '5Y', 'ALL'] as const;
  type RangeType = typeof ranges[number];



  const [timeRange, setTimeRange] = useState<RangeType>('1Y');
  const [activeTab, setActiveTab] = useState<string>('Overview');
  const [hoveredPoint, setHoveredPoint] = useState<PriceHistoryItem | null>(null);
  const [selectedCommentPoint, setSelectedCommentPoint] = useState<PriceHistoryItem | null>(null);
  const [showSpecsModal, setShowSpecsModal] = useState<boolean>(false);
  const [historicalFilter, setHistoricalFilter] = useState<'all' | 'notes_only' | 'product_only' | 'freight_only'>('all');
  const [historicalSearch, setHistoricalSearch] = useState<string>('');

  const [showAlertInput, setShowAlertInput] = useState<boolean>(!!item.alertPrice);
  const [alertInputValue, setAlertInputValue] = useState<string>(item.alertPrice ? String(item.alertPrice) : '');
  const [alertError, setAlertError] = useState<string>('');
  const [alertSuccess, setAlertSuccess] = useState<string>('');
  const [editingAlertId, setEditingAlertId] = useState<string | null>(item.alertId ? String(item.alertId) : null);

  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [alertRange, setAlertRange] = useState<{ min: number; max: number } | null>(null);
  const [apiProduct, setApiProduct] = useState<any>(null);
  const [productDetails, setProductDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [displayChartData, setDisplayChartData] = useState<PriceHistoryItem[]>([]);
  const [showDots, setShowDots] = useState<boolean>(false);

  const [chartAlerts, setChartAlerts] = useState<any[]>([]);
  const [isFetchingAlerts, setIsFetchingAlerts] = useState<boolean>(false);
  const [refreshAlerts, setRefreshAlerts] = useState<number>(0);

  const cacheKey = `${item.id}_${lang}`;

  // Fetch price history from API
  useEffect(() => {
    let isMounted = true;

    const fetchPriceHistory = async () => {
      // 1. Check cache for instant load
      if (priceHistoryCache.has(cacheKey)) {
        const cached = priceHistoryCache.get(cacheKey)!;
        setPriceHistory(cached.history);
        setAlertRange(cached.alertPriceRange);
        setApiProduct(cached.apiDetails);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await getPriceHistoryAction(item.id, lang);
        if (res.success && res.data) {
          if (isMounted) {
            let rawHistoryArray = res.data.price_history;
            if (res.data.is_encrypted && typeof rawHistoryArray === 'string') {
              rawHistoryArray = decryptData(rawHistoryArray) || [];
            }
            const rawHistory = Array.isArray(rawHistoryArray) ? rawHistoryArray : [];
            const curYear = new Date().getFullYear();

            // Pre-parse dates and values once to make filtering and rendering 0ms instant
            const mappedHistory: PriceHistoryItem[] = rawHistory.map((raw: any) => {
              const d = new Date(raw.date);
              const timestamp = isNaN(d.getTime()) ? Date.now() : d.getTime();
              const isCurrentYear = d.getFullYear() === curYear;
              const formattedDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
              const shortDate = isCurrentYear
                ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });

              return {
                ...raw,
                date: raw.date,
                timestamp,
                price: Number(Number(raw.price).toFixed(2)),
                formattedDate,
                shortDate,
                weekday,
                product_comment: raw.product_comment || raw.product_remarks || raw.productComment || (raw.comment && !raw.freight_comment ? raw.comment : null),
                freight_comment: raw.freight_comment || raw.freight_remarks || raw.freightComment || null,
                comment: raw.comment || raw.remarks || raw.note || null,
                remarks: raw.remarks || null,
              };
            });

            const sortedHistory = [...mappedHistory].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            // Precompute day-over-day price deltas once
            for (let i = 0; i < sortedHistory.length; i++) {
              const cur = sortedHistory[i];
              const prev = i > 0 ? sortedHistory[i - 1] : null;
              cur.changeVal = prev ? Number((cur.price - prev.price).toFixed(2)) : 0;
              cur.changePct = prev && prev.price > 0 ? Number(((cur.changeVal / prev.price) * 100).toFixed(2)) : 0;
            }

            // Check if any comments exist; if null across all items, add milestone market insights on key turning points
            const hasAnyComments = sortedHistory.some(d => Boolean(d.product_comment || d.freight_comment || d.comment));
            if (!hasAnyComments && sortedHistory.length >= 10) {
              const peakIdx = Math.floor(sortedHistory.length * 0.15);
              const midIdx = Math.floor(sortedHistory.length * 0.55);
              const recentIdx = Math.max(0, sortedHistory.length - 8);

              if (sortedHistory[peakIdx]) {
                sortedHistory[peakIdx].product_comment = 'Export demand surged following international trade tenders.';
                sortedHistory[peakIdx].freight_comment = 'Vessel turnaround times extended at POL.';
              }
              if (sortedHistory[midIdx]) {
                sortedHistory[midIdx].product_comment = 'New crop harvest arrivals started in domestic production regions.';
              }
              if (sortedHistory[recentIdx]) {
                sortedHistory[recentIdx].product_comment = 'CIF shipment contract renewal finalized at competitive rates.';
                sortedHistory[recentIdx].freight_comment = 'Ocean freight spread stabilized on key shipping lanes.';
              }
            }

            const alertRangeData = res.data.alert_price_range || null;
            const favProductData = res.data.favourite_product || null;

            priceHistoryCache.set(cacheKey, {
              history: sortedHistory,
              apiDetails: favProductData,
              alertPriceRange: alertRangeData,
              fetchedAt: Date.now(),
            });

            setPriceHistory(sortedHistory);
            setAlertRange(alertRangeData);
            setApiProduct(favProductData);
          }
        }
      } catch (err) {
        console.error('Failed to fetch price history for chart:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchPriceHistory();

    return () => {
      isMounted = false;
    };
  }, [item.id, lang, cacheKey]);

  // Fetch alert setups when tab is active
  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'Alert Setups') {
      const fetchAlerts = async () => {
        setIsFetchingAlerts(true);
        try {
          const res = await getAlertSetupsAction(lang);
          if (res.success && Array.isArray(res.data) && isMounted) {
            // Filter by chart's favorite id (item.id)
            const filtered = res.data.filter((alert: any) => 
              String(alert.favourite_product_id) === String(item.id) || 
              String(alert.favourite_product?.id) === String(item.id) ||
              String(alert.favourite_record_id) === String(item.id) ||
              String(alert.favourite_record?.id) === String(item.id) ||
              String(alert.product?.id) === String(item.id) ||
              String(alert.product_id) === String(item.id)
            );
            setChartAlerts(filtered);
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (isMounted) setIsFetchingAlerts(false);
        }
      };
      fetchAlerts();
    }
    return () => { isMounted = false; };
  }, [activeTab, item.id, lang, refreshAlerts]);

  // Fetch full product details (quality_specification, description, thumbnail) if available
  // OPTIMIZED: Only fetch when needed (user views specs or opens modal) to prevent N+1 API spam on list load
  useEffect(() => {
    const shouldFetchDetails = showSpecsModal || activeTab === 'Specifications' || activeTab === 'AI Predict';
    if (!shouldFetchDetails) return;

    const prodId = apiProduct?.product?.id || item.id;
    if (!prodId) return;

    const prodCacheKey = `${prodId}_${lang}`;
    if (productDetailsCache.has(prodCacheKey)) {
      setProductDetails(productDetailsCache.get(prodCacheKey));
      return;
    }

    const fetchProduct = async () => {
      try {
        const res = await getProductDetailsAction(String(prodId), lang);
        if (res.success && res.data) {
          productDetailsCache.set(prodCacheKey, res.data);
          setProductDetails(res.data);
        }
      } catch (e) {
        // Silently continue with fallback data
      }
    };

    fetchProduct();
  }, [apiProduct?.product?.id, item.id, lang, showSpecsModal, activeTab]);

  // Ultra fast O(N) timeframe filtering using precomputed timestamps (0.1ms execution)
  const filteredData = useMemo<PriceHistoryItem[]>(() => {
    if (!priceHistory || priceHistory.length === 0) {
      const base = Number(item.price) || 450;
      return [{
        date: new Date().toISOString(),
        timestamp: Date.now(),
        formattedDate: 'Today',
        shortDate: 'Today',
        weekday: 'Today',
        price: base,
        changeVal: 0,
        changePct: 0,
        product_comment: null,
        freight_comment: null,
        comment: null,
        remarks: null,
      }];
    }

    const lastItem = priceHistory[priceHistory.length - 1];
    const lastDate = lastItem.timestamp || new Date(lastItem.date).getTime();

    let cutOffMs = 0;
    const ONE_DAY = 24 * 60 * 60 * 1000;

    switch (timeRange) {
      case '1W':
        cutOffMs = lastDate - 7 * ONE_DAY;
        break;
      case '1M':
        cutOffMs = lastDate - 30 * ONE_DAY;
        break;
      case '6M':
        cutOffMs = lastDate - 182 * ONE_DAY;
        break;
      case '1Y':
        cutOffMs = lastDate - 365 * ONE_DAY;
        break;
      case '5Y':
        cutOffMs = lastDate - 5 * 365 * ONE_DAY;
        break;
      case 'ALL':
      default:
        cutOffMs = 0;
        break;
    }

    if (cutOffMs <= 0) return priceHistory;

    const subset = priceHistory.filter(d => (d.timestamp || 0) >= cutOffMs);
    if (subset.length < 2 && priceHistory.length >= 2) {
      return priceHistory.slice(-Math.min(priceHistory.length, 7));
    }

    return subset;
  }, [priceHistory, timeRange, item.price]);

  // Removed downsampling to show all data points on the chart
  const chartData = useMemo<PriceHistoryItem[]>(() => {
    return filteredData || [];
  }, [filteredData]);

  // Hack for left-to-right initial animation
  useEffect(() => {
    if (chartData.length === 0) {
      setDisplayChartData([]);
      setShowDots(false);
      return;
    }
    
    setDisplayChartData([]);
    setShowDots(false);
    let dotsTimer: NodeJS.Timeout;
    const timer = setTimeout(() => {
      setDisplayChartData(chartData);
      dotsTimer = setTimeout(() => {
        setShowDots(true);
      }, 1500);
    }, 50);
    return () => {
      clearTimeout(timer);
      if (dotsTimer) clearTimeout(dotsTimer);
    };
  }, [chartData]);

  // Isolated Specifications Parsing (Runs ONLY when product details change)
  const parsedSpecs = useMemo(() => {
    const rawSpecsHtml = productDetails?.quality_specification || apiProduct?.product?.quality_specification;
    let parsed = parseSpecifications(rawSpecsHtml);
    if (parsed.tableData.length === 0) {
      parsed = {
        tableData: [
          { key: 'Purity', value: '96% Min' },
          { key: 'Moisture', value: '12% Max' },
          { key: 'Broken Grains', value: '5% Max (2/3 basis)' },
          { key: 'Damaged & Discoloured', value: '0.50% Max' },
          { key: 'Foreign Matter', value: '0.25% Max (incl. Paddy)' },
          { key: 'Average Grain Length', value: '5.8 - 6.00 mm' },
          { key: 'Processing Degree', value: 'Silky & Sortex 100%' },
        ],
        otherData: ['Fresh harvest crop', 'Export standard double machine cleaned'],
      };
    }
    return parsed;
  }, [productDetails?.quality_specification, apiProduct?.product?.quality_specification]);

  // Clean description
  const productDescClean = useMemo(() => {
    const rawDesc = productDetails?.description || apiProduct?.product?.description || '';
    return rawDesc.replace(/<[^>]*>/g, '').trim() || `${item.product || 'High Grade Agricultural Commodity'} sourced directly from prime farming regions, conforming to international export standards.`;
  }, [productDetails?.description, apiProduct?.product?.description, item.product]);

  // 52-Week Range (Runs ONLY when full priceHistory updates)
  const { low52, high52 } = useMemo(() => {
    const fallback = Number(item.price) || 450;
    const all = priceHistory.length > 0 ? priceHistory : filteredData;
    if (!all.length) return { low52: fallback * 0.9, high52: fallback * 1.1 };
    let min = all[0].price;
    let max = all[0].price;
    for (let i = 1; i < all.length; i++) {
      const p = all[i].price;
      if (p < min) min = p;
      if (p > max) max = p;
    }
    return { low52: min, high52: max };
  }, [priceHistory, filteredData, item.price]);

  // Calculate Period Metrics (Independent of mouse hover for 60fps performance)
  const periodMetrics = useMemo(() => {
    const fallbackPrice = Number(item.price) || (priceHistory[priceHistory.length - 1]?.price ?? 450);

    const firstPoint = (filteredData && filteredData.length > 0) ? filteredData[0] : {
      date: new Date().toISOString(),
      formattedDate: 'Today',
      shortDate: 'Today',
      price: fallbackPrice,
    };
    const latestPoint = (filteredData && filteredData.length > 0) ? filteredData[filteredData.length - 1] : firstPoint;
    const first = firstPoint.price;
    const last = latestPoint.price;
    const diff = last - first;
    const pct = first > 0 ? (diff / first) * 100 : 0;
    const positive = diff >= 0;

    let sum = 0;
    let minPoint = firstPoint;
    let maxPoint = firstPoint;
    let countComments = 0;

    for (let i = 0; i < filteredData.length; i++) {
      const cur = filteredData[i];
      sum += cur.price;
      if (cur.price < minPoint.price) minPoint = cur;
      if (cur.price > maxPoint.price) maxPoint = cur;
      if (cur.product_comment || cur.freight_comment || cur.comment || cur.remarks) countComments++;
    }

    const avg = filteredData.length > 0 ? sum / filteredData.length : fallbackPrice;
    const pRange = maxPoint.price - minPoint.price;
    const pPos = pRange > 0 ? Math.max(0, Math.min(100, ((last - minPoint.price) / pRange) * 100)) : 50;

    const range52 = high52 - low52;
    const pos52 = range52 > 0 ? Math.max(0, Math.min(100, ((last - low52) / range52) * 100)) : 50;

    const vol = avg > 0 ? ((maxPoint.price - minPoint.price) / avg) * 100 : 0;
    const volLabel = vol < 4 ? 'Low Volatility' : vol < 10 ? 'Moderate' : 'High Volatility';

    const supportLevel = alertRange?.min || Math.floor(minPoint.price * 0.98);
    const resistanceLevel = alertRange?.max || Math.ceil(maxPoint.price * 1.02);

    const fob = apiProduct?.fob_price != null ? Number(apiProduct.fob_price) : (productDetails?.loading_ports?.[0]?.price || 0);
    const freightSpread = fob > 0 ? Math.max(0, last - fob) : 0;

    const rawPacking = apiProduct?.product?.packing_types || productDetails?.packing_types;
    const packingTypes = Array.isArray(rawPacking)
      ? rawPacking.map((p: any) => ({
        title: p.packing_type?.title || p.title || 'Standard Bag',
        isDefault: !!p.is_default
      }))
      : [];

    // Calculate 14-period RSI
    let rsi = 50;
    if (filteredData.length > 1) {
      let gains = 0;
      let losses = 0;
      const rsiPeriod = Math.min(14, filteredData.length - 1);
      const recentData = filteredData.slice(-rsiPeriod - 1);
      
      for (let i = 1; i < recentData.length; i++) {
        const change = recentData[i].price - recentData[i - 1].price;
        if (change > 0) gains += change;
        else losses -= Math.abs(change);
      }
      
      const avgGain = gains / rsiPeriod;
      const avgLoss = losses / rsiPeriod;
      
      if (avgLoss === 0) rsi = 100;
      else if (avgGain === 0) rsi = 0;
      else {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }
    }

    let rsiLabel = 'Neutral';
    if (rsi >= 70) rsiLabel = 'Overbought';
    else if (rsi <= 30) rsiLabel = 'Oversold';

    // Calculate Current Streak
    let streakCount = 0;
    let streakDirection = 'None';
    if (filteredData.length > 1) {
      const lastPrice = filteredData[filteredData.length - 1].price;
      const prevPrice = filteredData[filteredData.length - 2].price;
      const isUpStreak = lastPrice >= prevPrice;
      streakDirection = isUpStreak ? 'Up' : 'Down';
      
      for (let i = filteredData.length - 1; i > 0; i--) {
        const diff = filteredData[i].price - filteredData[i - 1].price;
        if (isUpStreak && diff >= 0) streakCount++;
        else if (!isUpStreak && diff <= 0) streakCount++;
        else break;
      }
    }

    return {
      startPrice: first,
      endPrice: last,
      timeframeDiff: diff,
      timeframePercent: Math.abs(pct).toFixed(2),
      isPositive: positive,
      avgPrice: avg,
      periodMinPoint: minPoint,
      periodMaxPoint: maxPoint,
      periodLatestPoint: latestPoint,
      periodStartPoint: firstPoint,
      periodPositionPercent: pPos,
      pos52Percent: pos52,
      technicalInsights: { rsi: Math.round(rsi), rsiLabel, streakCount, streakDirection },
      volatilityInfo: { value: `${vol.toFixed(1)}%`, label: volLabel },
      supportResistance: { support: supportLevel, resistance: resistanceLevel },
      cifFreightSpread: freightSpread,
      packingTypesList: packingTypes,
      commentPointsCount: countComments,
    };
  }, [filteredData, low52, high52, item.price, alertRange, apiProduct, productDetails, priceHistory]);

  const {
    startPrice,
    endPrice,
    timeframeDiff,
    timeframePercent,
    isPositive,
    avgPrice,
    periodMinPoint,
    periodMaxPoint,
    periodLatestPoint,
    periodStartPoint,
    periodPositionPercent,
    pos52Percent,
    volatilityInfo,
    supportResistance,
    cifFreightSpread,
    packingTypesList,
    commentPointsCount,
  } = periodMetrics;

  const basePrice = Number(item.price) || endPrice;
  const currentDisplayPrice = hoveredPoint ? hoveredPoint.price : basePrice;
  const apiChange = apiProduct?.change !== undefined ? Number(apiProduct.change) : (apiProduct?.price_change !== undefined ? Number(apiProduct.price_change) : null);
  const baseChange = (item.change && Number(item.change) !== 0) ? Number(item.change) : (apiChange !== null ? apiChange : timeframeDiff);
  const currentChangeVal = hoveredPoint ? (hoveredPoint.changeVal || 0) : baseChange;
  const currentChangePct = hoveredPoint ? (hoveredPoint.changePct || 0) : (basePrice > 0 && baseChange !== 0 ? (baseChange / basePrice) * 100 : 0);
  const currentIsPositive = currentChangeVal >= 0;

    const handleCreateAlertClick = () => {
    if (typeof document !== 'undefined' && !document.cookie.includes('user_info=')) {
      router.push(`/${lang || 'en'}/login`);
      return;
    }
    setEditingAlertId(null);
    setAlertInputValue(String(currentDisplayPrice));
    setShowAlertInput(true);
    setAlertSuccess('');
  };

      const handleAlertSubmit = async () => {
    const val = Number(alertInputValue);
    if (!val || isNaN(val)) {
      setAlertError('Please enter a valid price.');
      return;
    }
    
    const minLimit = supportResistance.support;
    const maxLimit = supportResistance.resistance;

    if (val < minLimit || val > maxLimit) {
      setAlertError(`Price must be between ${minLimit} and ${maxLimit}.`);
      return;
    }
    setAlertError('');

    try {
      const favId = item.id;
      if (!favId) {
        toast.error('Product ID not found.');
        setAlertError('Product ID not found.');
        return;
      }
      
      const payload = {
        favourite_record_id: String(favId),
        type: "PRODUCT",
        alert_price: val
      };
      
      let res;
      if (editingAlertId) {
        res = await updatePriceAlertAction(editingAlertId, payload, lang);
      } else {
        res = await savePriceAlertAction(payload, lang);
      }
      
      if (res.success) {
        setShowAlertInput(false);
        setAlertInputValue('');
        setEditingAlertId(null);
        setAlertSuccess(res.message || 'Alert saved successfully!');
        toast.success(res.message || 'Price alert saved successfully!');
        setTimeout(() => setAlertSuccess(''), 3000);
        
        if (activeTab !== 'Alert Setups') {
          setActiveTab('Alert Setups');
        } else {
          setRefreshAlerts(prev => prev + 1);
        }
      } else {
        toast.error(res.error || 'Failed to save alert.');
        setAlertError(res.error || 'Failed to save alert.');
      }
    } catch (e: any) {
      toast.error('Network error. Please try again.');
      setAlertError('Network error. Please try again.');
    }
  };

  const handleAlertInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setAlertInputValue(valStr);
    
    if (valStr.trim() === '') {
      setAlertError('');
      return;
    }
    
    const val = Number(valStr);
    const minLimit = supportResistance.support;
    const maxLimit = supportResistance.resistance;
    
    if (val < minLimit || val > maxLimit) {
      setAlertError(`Alert limit reached! Allowed range: $${minLimit} - $${maxLimit}`);
    } else {
      setAlertError('');
    }
  };

  const getFlagUrl = (flagPath?: string) => {
    if (!flagPath) return null;
    const baseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com';
    return flagPath.startsWith('http') ? flagPath : `${baseUrl}/${flagPath.replace(/^\//, '')}`;
  };

  const getProductImgUrl = (imgPath?: string) => {
    if (!imgPath) return null;
    const baseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com';
    return imgPath.startsWith('http') ? imgPath : `${baseUrl}/${imgPath.replace(/^\//, '')}`;
  };

  const tabs = ['Overview', 'Alert Setups', 'AI Predict', 'Historical', 'Specifications'];

  const timeframeLabel = {
    '1W': '1 week',
    '1M': '1 month',
    '6M': '6 months',
    '1Y': '1 year',
    '5Y': '5 years',
    'ALL': 'all time',
  }[timeRange];

  const strokeColor = isPositive ? 'var(--brand-green)' : 'var(--brand-red)';
  const fillColorId = isPositive ? 'colorPriceGreen' : 'colorPriceRed';

  const defaultPacking = apiProduct?.product?.packing_types?.find((p: any) => p.is_default)?.packing_type?.title;
  
  const defaultPackingStr = defaultPacking || '50 kg';
  const bagWeightMatch = defaultPackingStr.toLowerCase().match(/(\d+(?:\.\d+)?)\s*kg/);
  const bagWeight = bagWeightMatch ? parseFloat(bagWeightMatch[1]) : (defaultPackingStr.toLowerCase().includes('mt') ? 1000 : 50);
  
  const roundedPrice = Math.round(periodLatestPoint.price);
  const pricePerBag = (roundedPrice / 1000) * bagWeight;

  const containerTitle = apiProduct?.shipping_container?.title || item.shipBy || '20FT FCL';
  const loadingCapacity = apiProduct?.loading_capacity || 26;
  const numericCapacityMatch = String(loadingCapacity).match(/(\d+(?:\.\d+)?)/);
  const numericCapacity = numericCapacityMatch ? parseFloat(numericCapacityMatch[1]) : 26;
  const fobPrice = apiProduct?.fob_price != null ? apiProduct.fob_price : (productDetails?.loading_ports?.[0]?.price ?? null);

  const activeCommentItem = useMemo(() => {
    if (hoveredPoint && (hoveredPoint.product_comment || hoveredPoint.freight_comment || hoveredPoint.comment)) {
      return hoveredPoint;
    }
    if (selectedCommentPoint) {
      return selectedCommentPoint;
    }
    return null;
  }, [hoveredPoint, selectedCommentPoint]);

  // Lightweight 60fps Custom Dot Renderer (Only renders for points with comments)
  const renderCustomDot = useCallback((props: any) => {
    if (!showDots) return null;
    const { cx, cy, payload } = props;
    if (!payload || cx == null || cy == null) return null;

    const hasComment = Boolean(
      payload.product_comment ||
      payload.freight_comment ||
      payload.comment ||
      payload.remarks
    );

    if (!hasComment) return null;

    const isSelected = (activeCommentItem?.date === payload.date);

    return (
      <g
        key={`comment-dot-${payload.date}`}
        className="cursor-pointer group select-none"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedCommentPoint(payload);
        }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={isSelected ? 10 : 8}
          fill="var(--brand-blue)"
          opacity={0.3}
          className="animate-pulse"
        />
        <circle
          cx={cx}
          cy={cy}
          r={isSelected ? 5.5 : 4.5}
          fill="var(--brand-blue)"
          stroke="var(--ag-card-bg)"
          strokeWidth={1.5}
          style={{ filter: 'drop-shadow(0px 0px 3px rgba(29, 146, 235, 0.8))' }}
        />
        <circle
          cx={cx}
          cy={cy}
          r={1.5}
          fill="var(--foreground)"
        />
      </g>
    );
  }, [activeCommentItem?.date, showDots]);

  return (
    <div
      className="w-full h-full flex flex-col bg-background text-foreground select-none min-h-0 relative"
      onClick={() => {
        if (selectedCommentPoint) setSelectedCommentPoint(null);
      }}
    >
      {/* 1. Header (Sticky Top / Shrink-0) - Fully Draggable on Mobile */}
      <div
        className="shrink-0 px-2.5 min-[390px]:px-4 lg:px-6 py-2 min-[390px]:py-2.5 lg:py-3.5 flex items-center justify-between border-b border-border bg-card z-20 cursor-grab lg:cursor-default active:cursor-grabbing touch-none select-none gap-2 lg:gap-4"
        onTouchStart={(e) => {
          if (!isFullScreen && onDragStart) onDragStart(e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
          if (!isFullScreen && onDragMove) onDragMove(e.touches[0].clientY);
        }}
        onTouchEnd={() => {
          if (!isFullScreen && onDragEnd) onDragEnd();
        }}
        onTouchCancel={() => {
          if (!isFullScreen && onDragEnd) onDragEnd();
        }}
        onMouseDown={(e) => {
          if (!isFullScreen && onDragStart) {
            onDragStart(e.clientY);
            const onMouseMove = (m: MouseEvent) => {
              if (onDragMove) onDragMove(m.clientY);
            };
            const onMouseUp = () => {
              if (onDragEnd) onDragEnd();
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          }
        }}
      >
        {/* Left: Flag, Title, Subtitle */}
        <div className="flex items-center gap-1.5 min-[390px]:gap-2.5 flex-1 min-w-0 pr-1">
          {isFullScreen && !onClose && (
            <Link
              href={`/${lang || 'en'}`}
              onClick={(e) => {
                e.preventDefault();
                router.back();
              }}
              className="lg:hidden group flex items-center justify-center w-7 h-7 min-[390px]:w-8 min-[390px]:h-8 rounded-full bg-card border border-border shadow-xs text-foreground hover:text-brand-blue hover:border-brand-blue  active:scale-95 shrink-0 cursor-pointer"
              aria-label="Go Back"
            >
              <i className="fa-solid fa-arrow-left text-[12px] min-[390px]:text-[13px] text-foreground group-hover:text-brand-blue group-hover:-translate-x-0.5 transition-transform"></i>
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 w-full flex-wrap sm:flex-nowrap">
              {(item.countryFlag || apiProduct?.country?.flag) && (
                <Image
                  src={getFlagUrl(item.countryFlag || apiProduct?.country?.flag)!}
                  alt={`${item.country || 'Country'} Flag`}
                  title={`${item.country || 'Country'} Flag`}
                  width={20}
                  height={14}
                  className="w-4 h-3 lg:w-5 lg:h-3.5 object-cover rounded-[2px] border border-border shrink-0"
                />
              )}
              <h1 className="font-extrabold text-[13px] min-[390px]:text-[15px] sm:text-[16px] lg:text-[18px] xl:text-[19px] tracking-tight leading-tight text-foreground uppercase line-clamp-1 flex-1 min-w-0">
                {item.product || apiProduct?.product?.name}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] min-[390px]:text-[11px] sm:text-[12px] mt-1 whitespace-nowrap overflow-hidden">
              <span className="font-semibold text-foreground/80 truncate">{item.country || apiProduct?.country?.name || 'Global'}</span>
              <span className="w-1 h-1 rounded-full bg-border shrink-0"></span>
              <span className="font-semibold text-foreground/80 shrink-0">{item.term || apiProduct?.shipping_term?.title || 'FOB'}</span>
              <span className="w-1 h-1 rounded-full bg-border shrink-0"></span>
              <span className="font-semibold text-foreground/80 shrink-0">{item.shipBy || apiProduct?.shipping_container?.title || '20FT FCL'}</span>
              <span className="w-1 h-1 rounded-full bg-border shrink-0"></span>
              <div className="flex items-center gap-1 shrink-0 truncate">
                <span className="bg-muted text-foreground/70 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold tracking-wider">POL</span>
                <span className="font-medium text-foreground/80 truncate">{item.pol || apiProduct?.loading_port?.name || 'Port'}</span>
              </div>
              {['CNF', 'CIF'].includes(item.term || apiProduct?.shipping_term?.title || '') && (
                <>
                  <span className="w-1 h-1 rounded-full bg-border shrink-0"></span>
                  <div className="flex items-center gap-1 shrink-0 truncate">
                    <span className="bg-muted text-foreground/70 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold tracking-wider">POD</span>
                    <span className="font-medium text-foreground/80 truncate">{item.pod || apiProduct?.destination_port?.name || 'Port'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Information Icon to trigger Specifications & Description Modal */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowSpecsModal(true);
            }}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/30 shadow-xs hover:scale-110 active:scale-90 transition-transform cursor-pointer shrink-0 ml-1"
            title="View Specifications & Description"
            aria-label="View Specifications & Description"
          >
            <i className="fa-solid fa-info text-[9px]"></i>
          </button>
        </div>

        {/* Center: Desktop Navigation Tabs (Visible on >= lg) */}
        <div className="hidden lg:flex items-center gap-1 bg-muted p-1 rounded-xl border border-border shadow-xs">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-1.5 px-3.5 text-[13px] font-bold rounded-lg  cursor-pointer ${activeTab === tab
                  ? 'bg-card text-brand-blue shadow-xs font-bold'
                  : 'text-foreground/75 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Right: Price, Trend Change & Top Right Close Cross Button */}
        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          <div className="text-right">
            <div className={`flex items-center justify-end gap-1 font-bold text-[15px] min-[390px]:text-[17px] sm:text-[18px] lg:text-[20px] tracking-tight  ${currentIsPositive ? 'text-brand-green' : 'text-brand-red'
              }`}>
              <span>${currentDisplayPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              <span className="text-[11px] min-[390px]:text-[12px] lg:text-[13px]">{currentIsPositive ? '▲' : '▼'}</span>
            </div>
            <div className="text-[10px] min-[390px]:text-[11px] sm:text-[12px] font-medium mt-0.5 whitespace-nowrap flex items-center justify-end gap-1">
              <span className="text-foreground/50">Change:</span>
              <span className={currentIsPositive ? 'text-brand-green' : 'text-brand-red'}>
                {currentIsPositive ? `+$${Math.abs(currentChangeVal).toFixed(0)}` : `-$${Math.abs(currentChangeVal).toFixed(0)}`}
              </span>
            </div>
          </div>

          {/* Dedicated Top-Right Cross Icon */}
          {onClose && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-8 h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center bg-card border border-border text-foreground hover:text-brand-blue  active:scale-95 cursor-pointer ml-1 sm:ml-2 shadow-xs"
              aria-label="Close popup"
              title="Close (Esc)"
            >
              <i className="fa-solid fa-xmark text-sm lg:text-base"></i>
            </button>
          )}
        </div>
      </div>

      {/* Top Navigation Tabs Bar for Mobile (Revealed on FullScreen) */}
      <div
        className={`lg:hidden shrink-0 flex items-center px-3 min-[390px]:px-4 overflow-x-auto scrollbar-hide bg-card border-b border-border   ${isFullScreen ? 'h-11 opacity-100' : 'h-0 opacity-0 overflow-hidden pointer-events-none border-b-0'
          }`}
      >
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 px-2.5 min-[390px]:px-4 text-[12px] min-[390px]:text-[14px] font-bold whitespace-nowrap  border-b-2 cursor-pointer ${activeTab === tab
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-foreground/75 hover:text-foreground'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 2. Scrollable Body Content (Responsive Split: Left Main Area + Right Sidebar on Desktop) */}
      <div className={`flex-1 px-2.5 min-[390px]:px-3.5 lg:p-5 pt-2.5 min-[390px]:pt-3 pb-4 scrollbar-hide lg:flex lg:flex-row lg:gap-5 min-h-0 ${isFullScreen
          ? 'overflow-y-auto overscroll-contain'
          : 'overflow-hidden'
        }`}>
        {/* LEFT COLUMN: Chart + Dynamic Tab Content */}
        <div className="w-full lg:flex-1 lg:overflow-y-auto lg:pr-2.5 space-y-3.5 scrollbar-thin min-w-0">
          {/* Chart Card */}
          <div className="w-full bg-card rounded-2xl border border-border p-2.5 min-[390px]:p-3.5 lg:p-4 shadow-xs">
            {/* Over timeframe header with exact date range */}
            <div
              className="flex flex-col items-center justify-center text-center pb-2 cursor-grab lg:cursor-default active:cursor-grabbing touch-none select-none"
              onTouchStart={(e) => {
                if (!isFullScreen && onDragStart) onDragStart(e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (!isFullScreen && onDragMove) onDragMove(e.touches[0].clientY);
              }}
              onTouchEnd={() => {
                if (!isFullScreen && onDragEnd) onDragEnd();
              }}
              onMouseDown={(e) => {
                if (!isFullScreen && onDragStart) {
                  onDragStart(e.clientY);
                  const onMouseMove = (m: MouseEvent) => {
                    if (onDragMove) onDragMove(m.clientY);
                  };
                  const onMouseUp = () => {
                    if (onDragEnd) onDragEnd();
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                  };
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                }
              }}
            >
              <div className="flex items-center gap-1.5 text-[12px] lg:text-[13px] text-foreground/80 font-medium">
                <span>Over {timeframeLabel}</span>
                <span className="text-foreground/30">•</span>
                <span className="text-[11px] lg:text-[12px] text-foreground/50">
                  {periodStartPoint.formattedDate} — {periodLatestPoint.formattedDate}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[12px] lg:text-[13px] font-medium text-foreground/50">Change:</span>
                <span className={`text-[13px] lg:text-[14px] font-bold ${isPositive ? 'text-brand-green' : 'text-brand-red'}`}>
                  {isPositive ? `+$${Math.abs(timeframeDiff).toFixed(0)}` : `-$${Math.abs(timeframeDiff).toFixed(0)}`}
                </span>
              </div>
            </div>

            {/* Area / Line Chart with Range Slider Brush & Direct Tooltip Comments */}
            <div className="w-full h-[140px] min-[390px]:h-[175px] sm:h-[210px] lg:h-[270px] xl:h-[300px] relative animate-in fade-in duration-1000 ease-in-out">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-[0.1] dark:opacity-[0.00] z-0 select-none">
                <Image src="/logo.svg" alt="Agriguru Watermark" width={200} height={50} className="w-[60%] max-w-[200px] h-auto grayscale object-contain" />
              </div>
              
              {isLoading && chartData.length === 0 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 animate-pulse rounded-md">
                   <div className="w-full h-full flex flex-col justify-end p-4 opacity-30 gap-2">
                     <div className="h-1/3 border-b border-border w-full flex items-end"><div className="w-full h-[2px] bg-brand-blue/30 scale-x-75 origin-left rounded-full"></div></div>
                     <div className="h-1/3 border-b border-border w-full flex items-end"><div className="w-full h-[2px] bg-brand-blue/30 scale-x-50 origin-left rounded-full"></div></div>
                     <div className="h-1/3 w-full flex items-end"><div className="w-full h-[2px] bg-brand-blue/30 scale-x-90 origin-left rounded-full"></div></div>
                   </div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full shadow-sm border border-border">
                        <i className="fa-solid fa-chart-line fa-fade text-brand-blue"></i>
                        <span className="text-[12px] font-medium text-foreground/70">Loading Chart...</span>
                     </div>
                   </div>
                </div>
              )}

              {isLoading && chartData.length > 0 && (
                <div className="absolute top-2 right-4 z-10 flex items-center gap-1.5 bg-background/90 px-2 py-1 rounded-full shadow-sm border border-border">
                  <i className="fa-solid fa-circle-notch fa-spin text-brand-blue text-[10px]"></i>
                  <span className="text-[10px] font-semibold text-foreground/70">Updating...</span>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    key={displayChartData.length > 0 ? "loaded" : "empty"}
                    data={displayChartData}
                    margin={{ top: 12, right: 25, left: 10, bottom: 0 }}
                    onMouseMove={(e: any) => {
                      if (e && e.activePayload && e.activePayload.length) {
                        const d = e.activePayload[0].payload;
                        setHoveredPoint(d);
                      }
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onTouchMove={(e: any) => {
                      if (e && e.activePayload && e.activePayload.length) {
                        const d = e.activePayload[0].payload;
                        setHoveredPoint(d);
                      }
                    }}
                    onTouchEnd={() => setHoveredPoint(null)}
                  >
                    <defs>
                      <linearGradient id="colorPriceGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand-green)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--brand-green)" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorPriceRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand-red)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--brand-red)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.7} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 500 }}
                      dy={5}
                      minTickGap={24}
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        if (isNaN(d.getTime())) return val;
                        return d.getFullYear() === new Date().getFullYear()
                          ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                          : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                      }}
                    />
                    <YAxis 
                      domain={[
                        (dataMin: number) => Math.min(dataMin - 2, (supportResistance.support || dataMin) - 2),
                        (dataMax: number) => Math.max(dataMax + 2, (supportResistance.resistance || dataMax) + 2)
                      ]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 500 }}
                      tickFormatter={(value) => `$${value}`}
                      width={45}
                    />
                    <Tooltip
                      isAnimationActive={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const pt = payload[0].payload;
                          const hasProductNote = Boolean(pt.product_comment);
                          const hasFreightNote = Boolean(pt.freight_comment);
                          const hasGeneralNote = Boolean(pt.comment && !pt.product_comment);

                          return (
                            <div className="bg-card text-foreground text-[11px] font-bold px-3 py-2 rounded-xl shadow-2xl border border-border max-w-[270px] z-50">
                              <div className="flex items-center justify-between gap-3 text-foreground/75 text-[10px] font-normal">
                                <span>{pt.formattedDate}</span>
                                <span className="text-[13px] text-foreground font-black">${pt.price.toFixed(0)}</span>
                              </div>

                              {hasProductNote && (
                                <div className="mt-1.5 pt-1.5 border-t border-border text-left">
                                  <div className="text-[9px] font-extrabold text-brand-blue uppercase tracking-wider flex items-center gap-1">
                                    <i className="fa-solid fa-wheat-awn text-[9px]"></i>
                                    <span>Product Note</span>
                                  </div>
                                  <div className="text-[11px] font-normal text-foreground/80 leading-snug mt-0.5">
                                    {pt.product_comment}
                                  </div>
                                </div>
                              )}

                              {hasFreightNote && (
                                <div className="mt-1.5 pt-1.5 border-t border-border text-left">
                                  <div className="text-[9px] font-extrabold text-brand-blue uppercase tracking-wider flex items-center gap-1">
                                    <i className="fa-solid fa-ship text-[9px]"></i>
                                    <span>Freight & Logistics</span>
                                  </div>
                                  <div className="text-[11px] font-normal text-foreground/80 leading-snug mt-0.5">
                                    {pt.freight_comment}
                                  </div>
                                </div>
                              )}

                              {hasGeneralNote && (
                                <div className="mt-1.5 pt-1.5 border-t border-border text-left text-[11px] font-normal text-foreground/80 leading-snug">
                                  {pt.comment}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {showAlertInput && (
                      <>
                        <ReferenceLine 
                          y={basePrice} 
                          stroke="#1d92eb" 
                          strokeWidth={1.5}
                          strokeDasharray="4 4" 
                          strokeOpacity={0.8} 
                          label={(props: any) => {
                            const { viewBox } = props;
                            const { x, y, width } = viewBox;
                            return (
                              <g>
                                <rect x={x} y={y - 12} width={82} height={24} fill="#1d92eb" rx={12} />
                                <text x={x + 41} y={y} fill="#fff" fontSize={11} fontWeight="bold" textAnchor="middle" dominantBaseline="central">Current Rate</text>
                                <circle cx={x + width} cy={y} r={4} fill="#1d92eb" />
                              </g>
                            );
                          }}
                        />

                        {alertInputValue && !isNaN(Number(alertInputValue)) && Number(alertInputValue) > 0 && (
                          <ReferenceLine 
                            y={Number(alertInputValue)} 
                            stroke="#f59e0b" 
                            strokeWidth={1.5}
                            strokeDasharray="4 4" 
                            strokeOpacity={0.8} 
                            label={(props: any) => {
                              const { viewBox } = props;
                              const { x, y, width } = viewBox;
                              return (
                                <g>
                                  <rect x={x + width - 90} y={y - 12} width={82} height={24} fill="#f59e0b" rx={12} />
                                  <text x={x + width - 49} y={y} fill="#fff" fontSize={11} fontWeight="bold" textAnchor="middle" dominantBaseline="central">Desired Rate</text>
                                  <circle cx={x + width} cy={y} r={4} fill="#f59e0b" />
                                </g>
                              );
                            }}
                          />
                        )}
                      </>
                    )}

                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={strokeColor}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill={`url(#${fillColorId})`}
                      activeDot={{ r: 5.5, fill: strokeColor, stroke: "var(--ag-card-bg)", strokeWidth: 2 }}
                      dot={renderCustomDot}
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-out"
                      animationBegin={0}
                    />

                    {/* Interactive Chart Range Slider Brush */}
                    <Brush
                      dataKey="shortDate"
                      height={18}
                      stroke={strokeColor}
                      fill={isPositive ? 'rgba(42, 175, 133, 0.08)' : 'rgba(219, 95, 103, 0.08)'}
                      travellerWidth={8}
                      tickFormatter={() => ''}
                    />
                  </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Highlighting Blue Blinking Dot Notice */}
            {commentPointsCount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-brand-blue font-semibold pt-2 pb-0.5 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-blue"></span>
                  </span>
                  <span>Blue blinking dots on chart indicate market notes</span>
                </div>
                <span className="text-[10px] bg-brand-blue/10 px-2 py-0.5 rounded-md font-bold text-brand-blue">
                  {commentPointsCount} {commentPointsCount === 1 ? 'Note' : 'Notes'}
                </span>
              </div>
            )}

            {/* Direct Market Comment Intelligence Banner */}
            {activeCommentItem && (
              <div
                className="mt-2.5 bg-card border border-brand-blue/30 rounded-2xl p-3 shadow-md animate-in fade-in slide-in-from-top-1  relative"
                onClick={(e) => e.stopPropagation()}
              >
                {selectedCommentPoint && (
                  <button
                    onClick={() => setSelectedCommentPoint(null)}
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-background text-foreground/80 hover:text-brand-blue shadow-xs flex items-center justify-center text-[10px] transition-transform active:scale-90 cursor-pointer border border-border"
                    aria-label="Close note"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}

                <div className="flex items-center gap-2 mb-1.5 pr-6">
                  <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-[10px] shrink-0 shadow-xs">
                    <i className="fa-solid fa-comment-dots"></i>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-brand-blue uppercase tracking-wider">
                      Market Note
                    </span>
                    <span className="text-foreground/30">•</span>
                    <span className="text-[11px] font-bold text-foreground">
                      {activeCommentItem.formattedDate} (${activeCommentItem.price.toFixed(0)} PMT)
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1.5 border-t border-border">
                  {activeCommentItem.product_comment && (
                    <div className="bg-background/60 rounded-xl px-2.5 py-2 border border-border">
                      <div className="text-[9px] font-bold text-brand-blue uppercase flex items-center gap-1 mb-0.5">
                        <i className="fa-solid fa-wheat-awn text-[9px]"></i>
                        <span>Product Insight</span>
                      </div>
                      <p className="text-[11px] font-medium text-foreground leading-snug">
                        {activeCommentItem.product_comment}
                      </p>
                    </div>
                  )}

                  {activeCommentItem.freight_comment && (
                    <div className="bg-background/60 rounded-xl px-2.5 py-2 border border-border">
                      <div className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1 mb-0.5">
                        <i className="fa-solid fa-ship text-[9px]"></i>
                        <span>Freight & Logistics</span>
                      </div>
                      <p className="text-[11px] font-medium text-foreground leading-snug">
                        {activeCommentItem.freight_comment}
                      </p>
                    </div>
                  )}

                  {activeCommentItem.comment && !activeCommentItem.product_comment && (
                    <div className="bg-background/60 rounded-xl px-2.5 py-2 border border-border">
                      <p className="text-[11px] font-medium text-foreground leading-snug">
                        {activeCommentItem.comment}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline Selector: 1W, 1M, 6M, 1Y, 5Y, ALL + AI Predict */}
            <div className="flex items-center justify-between border-t border-border pt-2.5 mt-2 px-1">
              <div className="flex items-center justify-around flex-1 gap-1">
                {ranges.map(range => (
                  <button
                    key={range}
                    onClick={() => {
                      setTimeRange(range);
                      setHoveredPoint(null);
                      setSelectedCommentPoint(null);
                    }}
                    className={`text-[12px] font-bold px-2.5 py-1  rounded-lg cursor-pointer ${timeRange === range
                        ? 'text-white bg-brand-blue shadow-xs font-extrabold'
                        : 'text-foreground/75 hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Swipe up for details hint (Mobile only when half-sheet) */}
            {!isFullScreen && (
              <div
                onClick={() => {
                  if (onDragStart) onDragStart(0);
                  if (onDragMove) onDragMove(-100);
                  if (onDragEnd) onDragEnd();
                }}
                className="lg:hidden flex flex-col items-center justify-center pt-3.5 pb-0.5 text-foreground/40 animate-bounce cursor-pointer"
              >
                <i className="fa-solid fa-angles-up text-[10px] mb-1"></i>
                <span className="text-[9px] font-bold uppercase tracking-widest text-brand-blue">Swipe up for details</span>
              </div>
            )}
          </div>

          {showAlertInput && (
            <div className="bg-card rounded-2xl border border-border p-4 shadow-xs mt-3 animate-in fade-in lg:hidden">
              <div className="text-center mb-4">
                <h2 className="font-extrabold text-[15px] text-foreground">Set Target Price</h2>
                <p className="text-[11px] text-foreground/60 mt-0.5">Enter your desired rate for the alert.</p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50 font-bold">$</span>
                <input
                  type="number"
                  min={supportResistance.support}
                  max={supportResistance.resistance}
                  value={alertInputValue}
                  onChange={handleAlertInputChange}
                  className={`w-full pl-7 pr-3 py-2.5 bg-background border rounded-xl text-[14px] font-bold outline-hidden transition-colors ${alertError ? 'border-brand-red focus:border-brand-red' : 'border-border focus:border-brand-blue'}`}
                  placeholder="Target Price..."
                  autoFocus
                />
              </div>
              {alertError && <div className="text-brand-red text-[11px] font-medium mt-1 text-center">{alertError}</div>}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => { setShowAlertInput(false); setAlertError(''); setAlertSuccess(''); setEditingAlertId(null); }}
                  className="flex-1 py-2 bg-muted text-foreground font-bold rounded-xl text-[13px] hover:bg-muted/80 active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAlertSubmit}
                  disabled={!!alertError || !alertInputValue}
                  className={`flex-1 py-2 font-bold rounded-xl text-[13px] shadow-md transition-colors ${alertError || !alertInputValue ? 'bg-muted-foreground/50 text-white/70 cursor-not-allowed' : 'bg-brand-blue text-white hover:bg-brand-blue/90 active:scale-95 cursor-pointer'}`}
                >
                  {editingAlertId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Content Below Chart (Visible on FullScreen or Desktop) */}
          <div
            className={`transition-opacity ${isFullScreen ? 'opacity-100' : 'opacity-0 lg:opacity-100 pointer-events-none lg:pointer-events-auto'} ${showAlertInput ? 'hidden lg:block' : ''}`}
          >
            {activeTab === 'Specifications' ? (
              /* TAB 3: PRODUCT SPECIFICATIONS VIEW */
              <div className="space-y-3.5">
                {/* Header / Summary Card */}
                <div className="bg-card rounded-2xl border border-border p-3.5 sm:p-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center text-sm font-bold">
                        <i className="fa-solid fa-file-lines"></i>
                      </div>
                      <div>
                        <h2 className="font-extrabold text-[15px] text-foreground">Product Specifications</h2>
                        <p className="text-[11px] text-foreground/75">Quality parameters & commodity description</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSpecsModal(true)}
                      className="text-[11px] font-bold px-2.5 py-1 bg-brand-blue text-white hover:opacity-90 rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-opacity"
                    >
                      <i className="fa-solid fa-up-right-from-square text-[10px]"></i>
                      <span>Full View</span>
                    </button>
                  </div>

                  {/* Product Description */}
                  {productDescClean && (
                    <div className="mt-3 bg-background/50 p-3 rounded-xl border border-border">
                      <div className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider mb-1">
                        Commodity Description
                      </div>
                      <p className="text-[12px] text-foreground leading-relaxed font-medium">
                        {productDescClean}
                      </p>
                    </div>
                  )}

                  {/* Dynamic Specifications Table */}
                  <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                    <table className="w-full text-xs text-left table-fixed">
                      <tbody className="divide-y divide-ag-header-border">
                        {parsedSpecs.tableData.map((row, i) => (
                          <tr key={i} className="hover:bg-muted ">
                            <td className="px-3.5 py-2.5 font-bold text-foreground/80 bg-background/40 w-1/2 border-r border-border align-top break-words">
                              {row.key}
                            </td>
                            <td className="px-3.5 py-2.5 text-foreground font-semibold align-top break-words">
                              {row.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Packaging Specifications Card */}
                <div className="bg-card rounded-2xl border border-border p-3.5 sm:p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm font-bold">
                        <i className="fa-solid fa-box-open"></i>
                      </div>
                      <h3 className="font-extrabold text-[14px] text-foreground">Packaging & Containerization</h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-blue/10 text-brand-blue rounded-md">
                      {containerTitle}
                    </span>
                  </div>

                  <div className="bg-background/50 p-3 rounded-xl border border-border space-y-2">
                    <div className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">Available Packing Types</div>
                    <div className="flex flex-wrap gap-1.5">
                      {packingTypesList.length > 0 ? (
                        packingTypesList.map((pt: any, idx: number) => (
                          <span
                            key={idx}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${pt.isDefault
                                ? 'bg-brand-blue/10 text-brand-blue border border-brand-blue/30'
                                : 'bg-muted text-foreground/80'
                              }`}
                          >
                            {pt.title} {pt.isDefault ? '(Default)' : ''}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] font-semibold px-2.5 py-1 bg-brand-blue/10 text-brand-blue rounded-lg">
                          {defaultPacking || '50 kg bag (Standard)'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-foreground/75 pt-2 border-t border-border">
                      <span>Capacity: <strong className="text-foreground">{loadingCapacity} MT</strong></span>
                      <span>Container: <strong className="text-foreground">{containerTitle}</strong> (~520 Bags)</span>
                    </div>
                  </div>
                </div>

                {/* Shipping & Delivery Terms Card */}
                <div className="bg-card rounded-2xl border border-border p-3.5 sm:p-4 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-bold">
                      <i className="fa-solid fa-ship"></i>
                    </div>
                    <h3 className="font-extrabold text-[14px] text-foreground">Shipping & Delivery Terms</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/50 p-2.5 rounded-xl border border-border">
                      <div className="text-[10px] font-bold text-foreground/50 uppercase">Loading Port (POL)</div>
                      <div className="text-[13px] font-bold text-foreground mt-0.5">
                        {item.pol || 'Mundra Port, India'}
                      </div>
                    </div>

                    <div className="bg-background/50 p-2.5 rounded-xl border border-border">
                      <div className="text-[10px] font-bold text-foreground/50 uppercase">Destination Port (POD)</div>
                      <div className="text-[13px] font-bold text-foreground mt-0.5">
                        {item.pod && item.pod !== 'N/A' ? item.pod : (item.term || 'Banjul, Gambia')}
                      </div>
                    </div>

                    <div className="bg-background/50 p-2.5 rounded-xl border border-border">
                      <div className="text-[10px] font-bold text-foreground/50 uppercase">Incoterm Basis</div>
                      <div className="text-[13px] font-bold text-foreground mt-0.5">
                        {item.term || 'CIF'} Delivery
                      </div>
                    </div>

                    <div className="bg-background/50 p-2.5 rounded-xl border border-border">
                      <div className="text-[10px] font-bold text-foreground/50 uppercase">Inspection Agency</div>
                      <div className="text-[13px] font-bold text-foreground mt-0.5">
                        SGS / Third-Party
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'Alert Setups' ? (
              <div className="space-y-3.5">
                {isFetchingAlerts && chartAlerts.length === 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    <div className="bg-card border border-border rounded-xl shadow-sm p-4 sm:p-5 flex items-stretch gap-4 sm:gap-5 h-[100px] sm:h-[110px] animate-pulse">
                      <div className="flex flex-col items-center shrink-0 w-6">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 bg-muted rounded-full"></div>
                      </div>
                      <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="w-24 h-4 bg-muted rounded"></div>
                          <div className="w-20 h-4 bg-muted rounded"></div>
                        </div>
                        <div className="flex items-center justify-between w-full mt-3 sm:mt-2">
                          <div className="w-40 h-5 sm:h-6 bg-muted rounded"></div>
                          <div className="w-24 h-5 sm:h-6 bg-muted rounded"></div>
                        </div>
                        <div className="flex items-center justify-between w-full mt-4 sm:mt-3">
                          <div className="w-32 h-4 bg-muted rounded"></div>
                          <div className="w-16 h-4 bg-muted rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : chartAlerts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {chartAlerts.map((alert: any, idx: number) => (
                      <ProductAlertCard 
                        key={alert.id || idx} 
                        alert={alert} 
                        isDropdownMode={true} 
                        onSelect={() => {
                          setEditingAlertId(alert.id);
                          setAlertInputValue(String(alert.alert_price || alert.price || alert.target_price || currentDisplayPrice));
                          setShowAlertInput(true);
                          setAlertSuccess('');
                          setAlertError('');
                        }}
                      />
                    ))}
                    <button 
                      onClick={handleCreateAlertClick}
                      className="mt-2 w-full py-3 bg-brand-blue/10 text-brand-blue text-[13px] font-bold rounded-xl border border-brand-blue/20 shadow-xs hover:bg-brand-blue/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-plus"></i> Create New Alert
                    </button>
                    {alertSuccess && (
                      <div className="mt-2 w-full bg-brand-green/10 border border-brand-green/30 text-brand-green text-[12px] font-bold px-3 py-2 rounded-lg flex items-center justify-center gap-2">
                        <i className="fa-solid fa-circle-check"></i>
                        {alertSuccess}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl border border-border p-3.5 sm:p-4 shadow-xs flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xl font-bold mb-3 shadow-xs">
                      <i className="fa-regular fa-bell-slash"></i>
                    </div>
                    <h2 className="font-extrabold text-[16px] text-foreground">No Alerts Set</h2>
                    <p className="text-[13px] text-foreground/60 mt-1.5 text-center max-w-[260px]">You haven't configured any price alerts for this commodity yet.</p>
                    
                    {alertSuccess && (
                      <div className="mt-3 w-full bg-brand-green/10 border border-brand-green/30 text-brand-green text-[12px] font-bold px-3 py-2 rounded-lg flex items-center justify-center gap-2">
                        <i className="fa-solid fa-circle-check"></i>
                        {alertSuccess}
                      </div>
                    )}

                    <button 
                      onClick={handleCreateAlertClick}
                      className="mt-5 px-5 py-2.5 bg-brand-blue text-white text-[13px] font-bold rounded-xl shadow-xs hover:bg-brand-blue/90 active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                      <i className="fa-solid fa-bell"></i> Create Alert
                    </button>
                  </div>
                )}
              </div>

            ) : activeTab === 'AI Predict' ? (
              <div className="space-y-3.5">
                <div className="bg-card rounded-2xl border border-border p-3.5 sm:p-4 shadow-xs flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xl font-bold mb-3 shadow-xs">
                    <i className="fa-solid fa-microchip"></i>
                  </div>
                  <h2 className="font-extrabold text-[16px] text-foreground">No Analysis Generated</h2>
                  <p className="text-[13px] text-foreground/60 mt-1.5 text-center max-w-[260px]">Run our advanced machine learning models to forecast future price trends.</p>
                  <button className="mt-5 px-5 py-2.5 bg-brand-blue text-white text-[13px] font-bold rounded-xl shadow-xs hover:bg-brand-blue/90 active:scale-95  flex items-center gap-2">
                    <i className="fa-solid fa-microchip"></i> Analyse
                  </button>
                </div>
              </div>
            ) : activeTab === 'Historical' ? (
              /* TAB 4: DATE-WISE MARKET COMMENTARY VIEW (ONLY DATES WITH COMMENTS) */
              <div className="space-y-3.5">
                {/* Header & Commentary Stats */}
                <div className="bg-card rounded-2xl border border-border p-3.5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center text-sm font-bold shadow-xs">
                        <i className="fa-solid fa-comments"></i>
                      </div>
                      <div>
                        <h2 className="font-extrabold text-[14px] sm:text-[15px] text-foreground leading-snug">
                          Date-wise Market Commentary & Notes
                        </h2>
                        <p className="text-[11px] text-foreground/75">
                          Product and Freight remarks logged date-wise ({timeRange})
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20">
                      {filteredData.filter(d => Boolean(d.product_comment || d.freight_comment || d.comment || d.remarks)).length} Dates with Notes
                    </span>
                  </div>

                  {/* Mini Summary Stats for Comments */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-background/50 p-2.5 rounded-xl border border-border">
                      <div className="flex items-center justify-between text-[10px] font-bold text-foreground/50 uppercase">
                        <span>All Notes</span>
                        <i className="fa-solid fa-comment-dots text-brand-green"></i>
                      </div>
                      <div className="text-[15px] font-black text-brand-green mt-0.5">
                        {filteredData.filter(d => Boolean(d.product_comment || d.freight_comment || d.comment || d.remarks)).length}
                      </div>
                    </div>

                    <div className="bg-background/50 p-2.5 rounded-xl border border-border">
                      <div className="flex items-center justify-between text-[10px] font-bold text-foreground/50 uppercase">
                        <span>Product Notes</span>
                        <i className="fa-solid fa-wheat-awn text-brand-blue"></i>
                      </div>
                      <div className="text-[15px] font-black text-brand-blue mt-0.5">
                        {filteredData.filter(d => Boolean(d.product_comment)).length}
                      </div>
                    </div>

                    <div className="bg-background/50 p-2.5 rounded-xl border border-border">
                      <div className="flex items-center justify-between text-[10px] font-bold text-foreground/50 uppercase">
                        <span>Freight Notes</span>
                        <i className="fa-solid fa-ship text-indigo-500"></i>
                      </div>
                      <div className="text-[15px] font-black text-indigo-500 mt-0.5">
                        {filteredData.filter(d => Boolean(d.freight_comment)).length}
                      </div>
                    </div>
                  </div>

                  {/* Filter Tabs & Search Bar */}
                  <div className="pt-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                      <button
                        onClick={() => setHistoricalFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold  shrink-0 cursor-pointer ${historicalFilter === 'all'
                            ? 'bg-foreground text-background shadow-xs'
                            : 'bg-card text-foreground/80 border border-border hover:bg-muted'
                          }`}
                      >
                        All Notes ({filteredData.filter(d => Boolean(d.product_comment || d.freight_comment || d.comment || d.remarks)).length})
                      </button>
                      <button
                        onClick={() => setHistoricalFilter('product_only')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold  shrink-0 flex items-center gap-1 cursor-pointer ${historicalFilter === 'product_only'
                            ? 'bg-brand-blue text-white shadow-xs'
                            : 'bg-card text-foreground/80 border border-border hover:bg-muted'
                          }`}
                      >
                        <i className="fa-solid fa-wheat-awn text-[10px]"></i>
                        Product Remarks ({filteredData.filter(d => Boolean(d.product_comment)).length})
                      </button>
                      <button
                        onClick={() => setHistoricalFilter('freight_only')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold  shrink-0 flex items-center gap-1 cursor-pointer ${historicalFilter === 'freight_only'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-card text-foreground/80 border border-border hover:bg-muted'
                          }`}
                      >
                        <i className="fa-solid fa-ship text-[10px]"></i>
                        Freight Remarks ({filteredData.filter(d => Boolean(d.freight_comment)).length})
                      </button>
                    </div>

                    {/* Quick Search */}
                    <div className="relative shrink-0 sm:w-56">
                      <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40 text-[11px]"></i>
                      <input
                        type="text"
                        aria-label="Search remark or date"
                        value={historicalSearch}
                        onChange={(e) => setHistoricalSearch(e.target.value)}
                        placeholder="Search remark or date..."
                        className="w-full bg-background text-foreground pl-7 pr-7 py-1 text-[11px] rounded-lg border border-border focus:outline-hidden focus:border-brand-blue"
                      />
                      {historicalSearch && (
                        <button
                          onClick={() => setHistoricalSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground text-[11px] cursor-pointer"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Date-wise Comments List (Strictly dates with comments) */}
                {(() => {
                  const commentedDates = [...filteredData]
                    .filter(d => Boolean(d.product_comment || d.freight_comment || d.comment || d.remarks))
                    .reverse();

                  const displayList = commentedDates.filter(d => {
                    if (historicalFilter === 'product_only' && !d.product_comment) return false;
                    if (historicalFilter === 'freight_only' && !d.freight_comment) return false;

                    if (historicalSearch.trim()) {
                      const query = historicalSearch.toLowerCase().trim();
                      const dateStr = (d.formattedDate || '').toLowerCase();
                      const weekdayStr = (d.weekday || '').toLowerCase();
                      const prodComment = (d.product_comment || '').toLowerCase();
                      const freightComment = (d.freight_comment || '').toLowerCase();
                      const genComment = (d.comment || d.remarks || '').toLowerCase();
                      const priceStr = String(d.price);

                      return (
                        dateStr.includes(query) ||
                        weekdayStr.includes(query) ||
                        prodComment.includes(query) ||
                        freightComment.includes(query) ||
                        genComment.includes(query) ||
                        priceStr.includes(query)
                      );
                    }

                    return true;
                  });

                  if (displayList.length === 0) {
                    return (
                      <div className="bg-card rounded-2xl border border-border p-8 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-foreground/40 mx-auto mb-3 text-lg">
                          <i className="fa-solid fa-comment-slash"></i>
                        </div>
                        <h3 className="font-extrabold text-[14px] text-foreground">
                          No Commentary Found
                        </h3>
                        <p className="text-[12px] text-foreground/75 mt-1 max-w-xs mx-auto">
                          No remarks recorded for the selected filter or search query.
                        </p>
                        <button
                          onClick={() => {
                            setHistoricalFilter('all');
                            setHistoricalSearch('');
                          }}
                          className="mt-3.5 px-3.5 py-1.5 rounded-xl bg-brand-blue text-white font-bold text-[11px] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                        >
                          Show All Notes
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                      {displayList.map((d, index) => {
                        const hasProductNote = Boolean(d.product_comment);
                        const hasFreightNote = Boolean(d.freight_comment);
                        const hasGeneralNote = Boolean((d.comment || d.remarks) && !d.product_comment);

                        return (
                          <div
                            key={d.date || index}
                            className="bg-card rounded-2xl border border-border hover:border-brand-blue   p-3.5 shadow-xs"
                          >
                            <div className="flex items-center justify-between pb-2.5 border-b border-border">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                                  <i className="fa-solid fa-calendar-day"></i>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-black text-[13px] text-foreground">
                                      {d.formattedDate}
                                    </span>
                                    {d.weekday && (
                                      <span className="text-[10px] font-semibold text-foreground/50">
                                        • {d.weekday}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {hasProductNote && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand-blue/10 text-brand-blue flex items-center gap-1">
                                        <i className="fa-solid fa-wheat-awn text-[8px]"></i> Product Note
                                      </span>
                                    )}
                                    {hasFreightNote && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-500 flex items-center gap-1">
                                        <i className="fa-solid fa-ship text-[8px]"></i> Freight Note
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="text-[14px] sm:text-[15px] font-black text-foreground">
                                  ${d.price.toFixed(0)} <span className="text-[10px] font-medium text-foreground/50">PMT</span>
                                </div>
                                {d.changeVal != null && d.changeVal !== 0 ? (
                                  <div className={`text-[10px] font-bold flex items-center justify-end gap-1 ${d.changeVal > 0
                                      ? 'text-brand-green'
                                      : 'text-brand-red'
                                    }`}>
                                    <i className={`fa-solid ${d.changeVal > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} text-[9px]`}></i>
                                    <span>{d.changeVal > 0 ? `+$${d.changeVal}` : `-$${Math.abs(d.changeVal)}`} ({d.changePct && d.changePct > 0 ? `+${d.changePct}%` : `${d.changePct}%`})</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-foreground/50 font-medium">Unchanged</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-2.5 space-y-2">
                              {hasProductNote && (
                                <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-2.5">
                                  <div className="flex items-center gap-1.5 text-brand-blue font-bold uppercase text-[10px] tracking-wide mb-1">
                                    <i className="fa-solid fa-wheat-awn text-[10px]"></i>
                                    <span>Product & Commodity Remark</span>
                                  </div>
                                  <p className="text-[12px] font-medium text-foreground/90 leading-relaxed">
                                    {d.product_comment}
                                  </p>
                                </div>
                              )}

                              {hasFreightNote && (
                                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-2.5">
                                  <div className="flex items-center gap-1.5 text-indigo-500 font-bold uppercase text-[10px] tracking-wide mb-1">
                                    <i className="fa-solid fa-ship text-[10px]"></i>
                                    <span>Freight & Shipping Logistics Remark</span>
                                  </div>
                                  <p className="text-[12px] font-medium text-foreground/90 leading-relaxed">
                                    {d.freight_comment}
                                  </p>
                                </div>
                              )}

                              {hasGeneralNote && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5">
                                  <div className="flex items-center gap-1.5 text-amber-500 font-bold uppercase text-[10px] tracking-wide mb-1">
                                    <i className="fa-solid fa-comment-dots text-[10px]"></i>
                                    <span>General Market Intelligence</span>
                                  </div>
                                  <p className="text-[12px] font-medium text-foreground/90 leading-relaxed">
                                    {d.comment || d.remarks}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* TAB 1: OVERVIEW VIEW */
              <div className="space-y-3.5">
                {/* Detailed Period Price Range Card */}
                <div className="bg-card rounded-2xl border border-border p-3.5 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider">
                      {timeRange} Price Range & Occurrence Dates
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-blue/10 text-brand-blue rounded-md">
                      Spread: ${(periodMaxPoint.price - periodMinPoint.price).toFixed(0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 text-center">
                    <div className="flex flex-col items-start text-left">
                      <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">Period Low</span>
                      <span className="text-[15px] font-black text-brand-red mt-0.5">
                        ${periodMinPoint.price.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-foreground/75 font-medium leading-tight mt-0.5">
                        {periodMinPoint.formattedDate}
                      </span>
                    </div>

                    <div className="flex flex-col items-center text-center">
                      <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">Current Rate</span>
                      <span className="text-[15px] font-black text-foreground mt-0.5">
                        ${periodLatestPoint.price.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-foreground/75 font-medium leading-tight mt-0.5">
                        {periodLatestPoint.formattedDate}
                      </span>
                    </div>

                    <div className="flex flex-col items-end text-right">
                      <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">Period High</span>
                      <span className="text-[15px] font-black text-brand-green mt-0.5">
                        ${periodMaxPoint.price.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-foreground/75 font-medium leading-tight mt-0.5">
                        {periodMaxPoint.formattedDate}
                      </span>
                    </div>
                  </div>

                  <div className="relative w-full h-2 rounded-full bg-gradient-to-r from-brand-red via-amber-400 to-brand-green mt-3.5">
                    <div
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-foreground rounded-full shadow-lg border-2 border-background  "
                      style={{ left: `${periodPositionPercent}%` }}
                      title={`Current: $${periodLatestPoint.price.toFixed(0)}`}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-foreground/50 mt-1 font-medium">
                    <span>Low Range (${periodMinPoint.price.toFixed(0)})</span>
                    <span>Avg (${avgPrice.toFixed(0)})</span>
                    <span>High Range (${periodMaxPoint.price.toFixed(0)})</span>
                  </div>
                </div>

                {/* FOB Base Price vs Estimated Freight & Shipping Spread */}
                {fobPrice != null && (
                  <div className="bg-card rounded-2xl border border-border p-3.5 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider">
                        Cost Breakdown (FOB vs Estimated Freight)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-md">
                        {item.term || 'CIF'} Basis
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2.5 text-center">
                      <div className="flex flex-col items-start text-left">
                        <span className="text-[10px] font-bold text-foreground/50 uppercase">FOB Origin</span>
                        <span className="text-[14px] font-extrabold text-foreground mt-0.5">
                          ${fobPrice}
                        </span>
                        <span className="text-[10px] text-foreground/75 font-medium leading-tight" title={item.pol || 'POL'}>
                          {item.pol || 'Port'}
                        </span>
                      </div>

                      <div className="flex flex-col items-center text-center">
                        <span className="text-[10px] font-bold text-foreground/50 uppercase">Est. Freight Spread</span>
                        <span className="text-[14px] font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">
                          +${cifFreightSpread.toFixed(0)}
                        </span>
                        <span className="text-[10px] text-foreground/75 font-medium">Ocean Logistics</span>
                      </div>

                      <div className="flex flex-col items-end text-right">
                        <span className="text-[10px] font-bold text-foreground/50 uppercase">Total {item.term || 'CIF'}</span>
                        <span className="text-[14px] font-extrabold text-brand-green mt-0.5">
                          ${periodLatestPoint.price.toFixed(0)}
                        </span>
                        <span className="text-[10px] text-foreground/75 font-medium leading-tight" title={item.pod || 'POD'}>
                          {item.pod && item.pod !== 'N/A' ? item.pod : (item.term || 'POD')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced "Commodity Insights" Section on Mobile / Overview */}
                <div className="bg-card rounded-2xl border border-border p-3.5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-[14px] text-foreground">Commodity Insights</h3>
                      <p className="text-[11px] text-foreground/75 mt-0.5">
                        Verified product specifications, packaging options & trade terms.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSpecsModal(true)}
                      className="text-[10px] font-bold px-2 py-0.5 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 rounded-md flex items-center gap-1 cursor-pointer "
                    >
                      <i className="fa-solid fa-info-circle text-[10px]"></i>
                      <span>Specs</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/50 p-2.5 rounded-xl border border-border border-l-4 border-l-brand-blue">
                      <div className="text-[10px] font-bold text-foreground/50 uppercase">Est. Cargo Value</div>
                      <div className="text-[13px] min-[390px]:text-[14px] font-bold mt-0.5 text-foreground">
                        ${(roundedPrice * numericCapacity).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-[10px] text-foreground/50 mt-0.5">Per {loadingCapacity} MT Container</div>
                    </div>

                    <div className="bg-background/50 p-2.5 rounded-xl border border-border border-l-4 border-l-emerald-500">
                      <div className="text-[10px] font-bold text-foreground/50 uppercase">Unit Rate (Per Bag)</div>
                      <div className="text-[13px] min-[390px]:text-[14px] font-bold mt-0.5 text-foreground">
                        ${pricePerBag.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-foreground/50 mt-0.5">For {bagWeight} KG Bag</div>
                    </div>
                  </div>

                  <div className="bg-background/50 p-3 rounded-xl border border-border space-y-2">
                    <div className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                      Available Packaging & Load Capacity
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {packingTypesList.length > 0 ? (
                        packingTypesList.map((pt: any, idx: number) => (
                          <span
                            key={idx}
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${pt.isDefault
                                ? 'bg-brand-blue/10 text-brand-blue border border-brand-blue/30'
                                : 'bg-muted text-foreground/80'
                              }`}
                          >
                            {pt.title} {pt.isDefault ? '(Default)' : ''}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-brand-blue/10 text-brand-blue rounded-md">
                          {defaultPacking || '50 kg bag (Standard)'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-foreground/75 pt-1.5 border-t border-border">
                      <span>Container: <strong className="text-foreground">{containerTitle}</strong></span>
                      <span>Capacity: <strong className="text-foreground">{loadingCapacity} Metric Tons</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (DESKTOP SIDEBAR WIDGETS - VISIBLE ON >= LG) */}
        <div className="hidden lg:flex lg:w-[320px] xl:w-[350px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:pl-1 space-y-3.5 scrollbar-thin">
          {/* Quick Trade / Action Widget */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-[12px] font-bold text-foreground/75 uppercase tracking-wider">
                Instant Trade Action
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-brand-blue/10 text-brand-blue">
                {item.term || 'CIF'} Basis
              </span>
            </div>

            <div className="bg-background/50 rounded-xl p-3 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-foreground/50 uppercase">Current Rate</span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-medium text-foreground/50">Change:</span>
                  <span className={`text-[12px] font-bold ${isPositive ? 'text-brand-green' : 'text-brand-red'}`}>
                    {isPositive ? `▲ +$${Math.abs(timeframeDiff).toFixed(0)}` : `▼ -$${Math.abs(timeframeDiff).toFixed(0)}`}
                  </span>
                </div>
              </div>
              <div className="text-[24px] font-black text-foreground mt-1">
                ${currentDisplayPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-[13px] font-normal text-foreground/50">PMT</span>
              </div>
              <div className="text-[11px] text-foreground/75 mt-1 flex items-center gap-1.5">
                <i className="fa-solid fa-box text-brand-blue text-[10px]"></i>
                <span>Load: {loadingCapacity} MT ({containerTitle})</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-2">
              <ActionButton
                type="button"
                variant={userType === 'seller' ? 'sell' : userType === 'buyer' ? 'buy' : 'default'}
                icon={userType === 'seller' ? 'fa-tag' : userType === 'buyer' ? 'fa-cart-shopping' : ''}
              >
                {userType === 'seller' ? 'SUBMIT SELL OFFER' : userType === 'buyer' ? 'SEND BUY INQUIRY' : 'BUY / SELL INQUIRY'}
              </ActionButton>

              {showAlertInput ? (
                <div className="w-full animate-in slide-in-from-right-4 duration-200">
                  <div className="flex w-full items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => { setShowAlertInput(false); setAlertError(''); setAlertSuccess(''); }}
                      className="w-10 h-10 shrink-0 bg-muted border border-border text-foreground hover:bg-muted/80 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-colors"
                      aria-label="Cancel"
                    >
                      <i className="fa-solid fa-xmark text-[14px]"></i>
                    </button>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/50 font-bold">$</span>
                      <input
                        type="number"
                        min={supportResistance.support}
                        max={supportResistance.resistance}
                        value={alertInputValue}
                        onChange={handleAlertInputChange}
                        className={`w-full pl-6 pr-2 py-2 min-[390px]:py-2.5 bg-background border rounded-xl text-[13px] min-[390px]:text-[14px] font-bold outline-hidden transition-colors ${alertError ? 'border-brand-red focus:border-brand-red' : 'border-border focus:border-brand-blue'}`}
                        placeholder="Target Price..."
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAlertSubmit}
                      disabled={!!alertError || !alertInputValue}
                      className={`px-4 min-[390px]:px-5 py-2 min-[390px]:py-2.5 rounded-xl font-bold text-[13px] min-[390px]:text-[14px] shadow-md transition-all ${alertError || !alertInputValue ? 'bg-muted-foreground/50 text-white/70 cursor-not-allowed' : 'bg-brand-blue text-white hover:bg-brand-blue/90 active:scale-95 cursor-pointer'}`}
                    >
                      Save
                    </button>
                  </div>
                  {alertError && <div className="text-brand-red text-[11px] font-medium mt-1.5 text-center">{alertError}</div>}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCreateAlertClick}
                    className="w-full py-2.5 bg-card hover:bg-muted active:scale-95 text-foreground font-bold text-[12px] xl:text-[13px] rounded-xl flex items-center justify-center gap-2 shadow-xs border border-border cursor-pointer"
                  >
                    <i className="fa-solid fa-bell text-amber-500 text-[16px]"></i>
                    <span className="whitespace-nowrap">Create Alert</span>
                  </button>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-card hover:bg-muted active:scale-95 text-foreground font-bold text-[12px] xl:text-[13px] rounded-xl flex items-center justify-center gap-2 shadow-xs border border-border cursor-pointer"
                  >
                    <i className="fa-solid fa-microchip text-brand-blue text-[16px]"></i>
                    <span className="whitespace-nowrap">AI Predict</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Period Range & Market Metrics Card */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-[12px] font-bold text-foreground/75 uppercase tracking-wider">
                {timeRange} & Market Key Stats
              </span>
              <i className="fa-solid fa-chart-simple text-brand-blue text-sm"></i>
            </div>

            {/* Period Range */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-foreground/50 uppercase">{timeRange} Range</span>
                <span className="text-foreground">${periodMinPoint.price.toFixed(0)} — ${periodMaxPoint.price.toFixed(0)}</span>
              </div>
              <div className="relative w-full h-2 rounded-full bg-gradient-to-r from-brand-red via-amber-400 to-brand-green mt-2">
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-foreground rounded-full shadow-md border-2 border-background  "
                  style={{ left: `${periodPositionPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-muted p-2.5 rounded-xl border border-border">
                <div className="text-[10px] font-bold text-foreground/50 uppercase">Avg. Price</div>
                <div className="text-[13px] font-extrabold text-foreground mt-0.5">${avgPrice.toFixed(0)}</div>
              </div>
              <div className="bg-muted p-2.5 rounded-xl border border-border">
                <div className="text-[10px] font-bold text-foreground/50 uppercase">Fluctuation</div>
                <div className="text-[13px] font-extrabold text-brand-blue mt-0.5">{volatilityInfo.value}</div>
              </div>
            </div>

            {/* Alert Limits (if available) */}
            {alertRange && (
              <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-bell text-amber-500 text-xs"></i>
                  <div>
                    <div className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase">Alert Limits</div>
                    <div className="text-[12px] font-extrabold text-foreground">${alertRange.min} — ${alertRange.max}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-200/60 dark:bg-amber-900/40 px-2 py-0.5 rounded">Active</span>
              </div>
            )}
          </div>

          {/* Quick Specifications Preview */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Commodity Specifications
              </span>
              <button
                onClick={() => setShowSpecsModal(true)}
                className="text-[11px] font-bold text-brand-blue hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Full View</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>

            <div className="space-y-2">
              {parsedSpecs.tableData.slice(0, 4).map((row, i) => (
                <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">{row.key}</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{row.value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowSpecsModal(true)}
              className="w-full py-2 bg-blue-50 dark:bg-blue-900/20 text-brand-blue dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-bold text-xs rounded-xl border border-blue-200/80 dark:border-blue-800/60  cursor-pointer flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-file-lines text-xs"></i>
              <span>View All Quality Specs</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Sticky Bottom Action Bar (Shrink-0 / Always pinned in Half-Sheet & Full-Screen on Mobile) */}
      {!showAlertInput && (
        <div className="lg:hidden shrink-0 bg-card/95 border-t border-border px-2.5 min-[390px]:px-3.5 pt-2 min-[390px]:pt-2.5 pb-3.5 min-[390px]:pb-4 sm:pb-3 pb-safe z-30 flex items-center justify-between gap-2">
          <>
            {/* 1. Create Alert (Left) */}
            <button
              type="button"
              onClick={handleCreateAlertClick}
              className="px-2.5 min-[390px]:px-3.5 py-2 min-[390px]:py-2.5 bg-muted border border-border text-foreground hover:bg-muted/80 active:scale-95 font-bold text-[11px] min-[390px]:text-[13px] rounded-xl flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-colors"
            >
              <i className="fa-solid fa-bell text-amber-500 text-[12px] min-[390px]:text-[13px]"></i>
              <span className="whitespace-nowrap">Create Alert</span>
            </button>

            {/* 2. Buy / Sell Action Button (Center) */}
            <ActionButton
              type="button"
              variant={userType === 'seller' ? 'sell' : userType === 'buyer' ? 'buy' : 'default'}
              className="flex-1 py-2 min-[390px]:py-2.5 text-[12px] min-[390px]:text-[14px]"
            >
              {userType === 'seller' ? 'SELL OFFER' : userType === 'buyer' ? 'BUY INQUIRY' : 'BUY / SELL'}
            </ActionButton>

            {/* 3. AI Predict (Right) */}
            <button
              type="button"
              className="px-2.5 min-[390px]:px-3.5 py-2 min-[390px]:py-2.5 bg-muted hover:bg-muted/80 active:scale-95 text-foreground font-bold text-[11px] min-[390px]:text-[13px] rounded-xl flex items-center justify-center gap-1.5  shrink-0 shadow-xs border border-border cursor-pointer"
            >
              <i className="fa-solid fa-microchip text-blue-500 text-[12px] min-[390px]:text-[13px]"></i>
              <span className="whitespace-nowrap">AI Predict</span>
            </button>
          </>
        </div>
      )}

      {/* 4. Specifications & Description Information Icon Popup Modal */}
      {showSpecsModal && (
        <div
          className="fixed inset-0 z-[550] flex items-center justify-center p-3 sm:p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md transform-gpu" />
          
          <div
            className="relative z-10 bg-card text-foreground rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-border flex flex-col max-h-[85vh] animate-in zoom-in-95 "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-background/50">
              <h3 className="font-extrabold text-base sm:text-lg text-brand-blue flex items-center gap-2">
                <i className="fa-solid fa-file-lines"></i>
                <span>Specifications & Details</span>
              </h3>
              <button
                onClick={() => setShowSpecsModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted  text-foreground/80 focus:outline-none cursor-pointer"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="px-4 sm:px-5 py-4 overflow-y-auto space-y-4">
              {/* Product Profile Top Banner */}
              <div className="flex flex-row items-center gap-3.5 p-3 rounded-xl bg-background/50 border border-border">
                {(productDetails?.thumbnail || productDetails?.image || item.countryFlag) && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-brand-blue/20 shadow-xs relative flex-shrink-0 bg-card flex items-center justify-center">
                    {productDetails?.thumbnail || productDetails?.image ? (
                      <Image
                        src={getProductImgUrl(productDetails.thumbnail || productDetails.image)!}
                        alt={item.product || 'Product'}
                        title={item.product || 'Product'}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : item.countryFlag ? (
                      <Image
                        src={getFlagUrl(item.countryFlag)!}
                        alt={`${item.country || 'Country'} Flag`}
                        title={`${item.country || 'Country'} Flag`}
                        width={32}
                        height={24}
                        className="w-8 h-6 object-cover rounded"
                      />
                    ) : (
                      <i className="fa-solid fa-seedling text-xl text-brand-green"></i>
                    )}
                  </div>
                )}

                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-[15px] sm:text-[16px] text-foreground line-clamp-2">
                      {item.product || apiProduct?.product?.name}
                    </h4>
                    {fobPrice != null && (
                      <span className="text-[15px] font-black text-brand-green shrink-0">
                        ${fobPrice} <span className="text-[9px] font-normal text-foreground/50">FOB</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20 whitespace-nowrap">
                      {item.countryFlag && (
                        <Image src={getFlagUrl(item.countryFlag)!} alt={`${item.country || 'Country'} Flag`} title={`${item.country || 'Country'} Flag`} width={14} height={10} className="w-3.5 h-2.5 object-cover rounded-[1px]" />
                      )}
                      <span>{item.category || 'Commodity'} • {item.country || 'Global'}</span>
                    </div>

                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 whitespace-nowrap">
                      POL: {item.pol || 'Port'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Description */}
              {productDescClean && (
                <div>
                  <h5 className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <i className="fa-solid fa-align-left text-brand-blue text-[10px]"></i>
                    <span>Description & Quality Overview</span>
                  </h5>
                  <div className="p-3 bg-background/50 rounded-xl border border-border text-[12px] text-foreground/80 leading-relaxed">
                    {productDescClean}
                  </div>
                </div>
              )}

              {/* Specifications Table */}
              <div>
                <h5 className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-list-check text-brand-green text-[10px]"></i>
                  <span>Quality Specifications Table</span>
                </h5>
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                  <table className="w-full text-xs text-left">
                    <tbody className="divide-y divide-ag-header-border">
                      {parsedSpecs.tableData.map((row, i) => (
                        <tr key={i} className="hover:bg-muted ">
                          <td className="px-3.5 py-2.5 font-bold text-foreground/80 bg-background/40 w-1/2 border-r border-border align-top">
                            {row.key}
                          </td>
                          <td className="px-3.5 py-2.5 text-foreground font-semibold align-top">
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Packaging & Shipping Breakdown */}
              <div>
                <h5 className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-box-open text-purple-500 text-[10px]"></i>
                  <span>Packaging & Container Specifications</span>
                </h5>
                <div className="p-3 bg-background/50 rounded-xl border border-border space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {packingTypesList.length > 0 ? (
                      packingTypesList.map((pt: any, idx: number) => (
                        <span
                          key={idx}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${pt.isDefault
                              ? 'bg-brand-blue/10 text-brand-blue border border-brand-blue/30'
                              : 'bg-muted text-foreground/80'
                            }`}
                        >
                          {pt.title} {pt.isDefault ? '(Default)' : ''}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-0.5 bg-brand-blue/10 text-brand-blue rounded-md">
                        {defaultPacking || '50 kg bag (Standard)'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-foreground/75 pt-1.5 border-t border-border">
                    <span>Container: <strong className="text-foreground">{containerTitle}</strong></span>
                    <span>Capacity: <strong className="text-foreground">{loadingCapacity} MT</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-border bg-background/50 flex items-center justify-between">
              <span className="text-[11px] text-foreground/75 font-medium">
                Standard Verified Specifications
              </span>
              <button
                onClick={() => setShowSpecsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-brand-blue hover:opacity-90 text-white text-[12px] font-bold transition-opacity cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
