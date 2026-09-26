"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getPriceAnalysisDetailsAction } from '@/app/actions/charts';
import { marked } from 'marked';

export function AIPredictProductCard({ 
  predict, 
  isSelected = false, 
  onSelect = () => {},
  isDropdownMode = false,
  onCardClick = undefined,
  initialExpanded = false
}: { 
  predict: any; 
  isSelected?: boolean; 
  onSelect?: (id: string) => void; 
  isDropdownMode?: boolean;
  onCardClick?: () => void;
  initialExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded || false);
  const [details, setDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(initialExpanded || false);

  useEffect(() => {
    if (initialExpanded && !details) {
      if (predict.analysis || predict.ai_analysis || predict.content || predict.description) {
        setDetails(predict);
        setIsLoading(false);
      } else {
        const fetchDetails = async () => {
          try {
            const type = (predict.alert_type || '').toLowerCase() === 'freight' ? 'freight' : 'product';
            const res = await getPriceAnalysisDetailsAction(type, predict.id);
            if (res.success && res.data) {
              setDetails(res.data);
            } else if (predict.analysis || predict.ai_analysis || predict.content) {
              setDetails(predict);
            }
          } catch (err) {
            console.error(err);
            if (predict.analysis || predict.ai_analysis || predict.content) {
              setDetails(predict);
            }
          } finally {
            setIsLoading(false);
          }
        };
        fetchDetails();
      }
    }
  }, [initialExpanded, predict.id, predict.alert_type]);

  const dateStr = predict.created_at ? new Date(predict.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';

  const title = predict.product?.name || predict.product_name || predict.commodity?.name || predict.category?.name || predict.commodity_name || predict.name || predict.title || 'Unknown Commodity';
  const price = predict.alert_price || predict.target_price || predict.current_price || predict.price || predict.threshold || 0;
  
  const incotermStr = predict.shipping_term || predict.incoterm?.name || predict.incoterm || 'FOB';
  const incoterm = typeof incotermStr === 'string' ? incotermStr.toUpperCase() : 'FOB';
  
  const rightTargetLabel = incoterm;
  const rightTargetPrice = price ? `$ ${Number(price).toLocaleString('en-IN')}` : '';
  const bottomTag = predict.shipping_container || predict.container_type || '';

  const originName = predict.loading_port?.name || predict.origin?.name || predict.origin_name || 'India';
  const destName = predict.destination_port?.name || predict.destination?.name || predict.destination_name || 'Global';
  
  const imageBaseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com/';
  const base = imageBaseUrl.endsWith('/') ? imageBaseUrl : `${imageBaseUrl}/`;
  
  const rawOriginFlag = predict.loading_port?.country?.flag || predict.origin?.country?.flag || '🇮🇳';
  const rawDestFlag = predict.destination_port?.country?.flag || predict.destination?.country?.flag || '🌍';
  
  const originFlag = rawOriginFlag.endsWith('.png') && !rawOriginFlag.startsWith('http') ? `${base}${rawOriginFlag}` : rawOriginFlag;
  const destFlag = rawDestFlag.endsWith('.png') && !rawDestFlag.startsWith('http') ? `${base}${rawDestFlag}` : rawDestFlag;

  const showDest = incoterm === 'CNF' || incoterm === 'CIF' || incoterm === 'CFR' || !!(predict.destination_port || predict.destination);

  const handleCardClick = (e: React.MouseEvent) => {
    if (onCardClick) {
      onCardClick();
    } else {
      handleToggleExpand(e);
    }
  };

  const handleToggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCardClick) {
      onCardClick();
      return;
    }
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }
    
    setIsExpanded(true);
    if (!details) {
      if (predict.analysis || predict.ai_analysis || predict.content || predict.description) {
        setDetails(predict);
      } else {
        setIsLoading(true);
        try {
          const type = (predict.alert_type || '').toLowerCase() === 'freight' ? 'freight' : 'product';
          const res = await getPriceAnalysisDetailsAction(type, predict.id);
          if (res.success && res.data) {
            setDetails(res.data);
          } else if (predict.analysis || predict.ai_analysis || predict.content) {
            setDetails(predict);
          }
        } catch (err) {
          console.error(err);
          if (predict.analysis || predict.ai_analysis || predict.content) {
            setDetails(predict);
          }
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  const extractMarkdownContent = (obj: any): string => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    
    // Check common keys for the result
    const keys = [
      'analysis', 'result', 'content', 'description', 'message', 'report', 
      'ai_analysis', 'details', 'ai_predict_result', 'analysis_result',
      'result_text', 'analysis_text', 'prediction', 'ai_prediction', 'markdown'
    ];
    for (const key of keys) {
      if (obj[key] && typeof obj[key] === 'string') return obj[key];
      if (obj.data && obj.data[key] && typeof obj.data[key] === 'string') return obj.data[key];
    }
    
    // If not found, find the longest string in the object assuming it's the markdown content
    let longestString = '';
    const traverse = (current: any) => {
      if (!current) return;
      if (typeof current === 'string') {
        if (current.length > longestString.length) {
          longestString = current;
        }
        return;
      }
      if (typeof current === 'object') {
        for (const key in current) {
          if (key !== 'predict' && key !== 'product') {
            traverse(current[key]);
          }
        }
      }
    };
    traverse(obj);
    
    if (longestString && longestString.length > 20) {
      return longestString;
    }

    return typeof obj === 'object' && obj !== null ? (obj.analysis || obj.result || obj.message || JSON.stringify(obj, null, 2)) : String(obj);
  };

  const routeDisplay = (
    <div className="flex flex-row items-center gap-1.5 sm:gap-3 text-[12px] sm:text-[15px] font-medium text-muted-foreground min-w-0">
      <span className="flex items-center gap-1 sm:gap-1.5 truncate">
        {originFlag.includes('http') ? (
          <Image src={originFlag} width={22} height={16} className="w-[20px] h-[15px] sm:w-[22px] sm:h-[16px] object-cover rounded-[2px]" alt="" />
        ) : (
          <span className="text-[16px] sm:text-[18px] leading-none">{originFlag}</span>
        )} 
        POL: <span className="truncate max-w-[120px]">{originName}</span>
      </span>
      {showDest && (
        <>
          <i className="fa-solid fa-arrow-right-long text-muted-foreground text-[11px] sm:text-[14px] shrink-0"></i>
          <span className="flex items-center gap-1 sm:gap-1.5 truncate">
            {destFlag.includes('http') ? (
              <Image src={destFlag} width={22} height={16} className="w-[20px] h-[15px] sm:w-[22px] sm:h-[16px] object-cover rounded-[2px]" alt="" />
            ) : (
              <span className="text-[16px] sm:text-[18px] leading-none">{destFlag}</span>
            )}
            POD: <span className="truncate max-w-[120px]">{destName}</span>
          </span>
        </>
      )}
    </div>
  );

  return (
    <div 
      onClick={handleCardClick}
      className={`group bg-card border ${isSelected ? 'border-brand-blue ring-1 ring-brand-blue/30' : 'border-border'} rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col`}
    >
      <div className="p-4 sm:p-5 flex items-stretch gap-4 sm:gap-5 relative">
        {/* Left Column: Icon (Top) and Checkbox (Bottom) */}
        <div className="flex flex-col items-center shrink-0 w-6">
          <div className="h-6 sm:h-7 flex items-center justify-center">
            <i className="fa-solid fa-microchip text-zinc-500 text-[24px] sm:text-[26px]"></i>
          </div>
          <div className="flex-1"></div>
          {!isDropdownMode && (
            <div className="mt-3 sm:mt-2.5 h-[18px] sm:h-[22px] flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onSelect(predict.id)}
                className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] accent-brand-blue cursor-pointer dark:scheme-dark"
                title="Select to select"
              />
            </div>
          )}
        </div>

        {/* Right Column: Main Content */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          {/* Row 1: Status, Date, Type */}
          <div className="flex items-center justify-between w-full h-6 sm:h-7 gap-1 sm:gap-2 overflow-hidden">
            <span className="text-[13px] sm:text-[16px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
              Your Data Analysis
            </span>
            
            <div className="flex-1 text-center text-[12px] sm:text-[15px] text-muted-foreground/70 whitespace-nowrap px-1 sm:px-2 truncate">
              ({dateStr})
            </div>

            <span className="text-[13px] sm:text-[16px] font-semibold text-foreground uppercase shrink-0">
              {predict.alert_type || 'DATA ANALYSIS'}
            </span>
          </div>

          {/* Row 2: Title & Prices */}
          <div className="flex flex-row items-center justify-between w-full mt-2 sm:mt-1.5 gap-2 sm:gap-3">
            <h3 className="text-[16px] sm:text-[20px] font-bold text-foreground tracking-tight truncate flex-1 pr-1 sm:pr-2">
              {title}
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {price ? (
                <div className="text-[15px] sm:text-[19px] font-bold text-foreground whitespace-nowrap">
                  {rightTargetLabel} : {rightTargetPrice}
                </div>
              ) : null}
              <div 
                className="flex items-center gap-1.5 sm:gap-2 ml-1 sm:ml-2 hover:bg-muted/50 p-1 rounded-md transition-colors"
                onClick={handleCardClick}
                title="Click to view analysis details"
              >
                <span className="text-[13px] sm:text-[16px] font-semibold text-brand-blue">
                  AI Predict
                </span>
                <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-brand-blue transition-transform text-[14px] sm:text-[18px]`}></i>
              </div>
            </div>
          </div>

          {/* Row 3: Flags & Tags */}
          <div className="flex items-center justify-between w-full mt-3 sm:mt-2.5 gap-2 h-[18px] sm:h-[22px]">
            {routeDisplay}
            {bottomTag ? (
              <span className="text-[11px] sm:text-[15px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center">
                {bottomTag}
              </span>
            ) : <span />}
          </div>
        </div>
      </div>
      
      {/* Expanded Analysis Details */}
      {isExpanded && (
        <div 
          className="border-t border-border p-4 sm:p-5 bg-muted/20"
          onClick={(e) => e.stopPropagation()}
        >
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <i className="fa-solid fa-circle-notch fa-spin text-brand-blue text-2xl"></i>
            </div>
          ) : details ? (
            <div className="text-sm sm:text-[15px] text-foreground leading-snug">
              <div 
                className="prose prose-sm sm:prose-base dark:prose-invert max-w-none 
                           [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-[18px] sm:[&_h1]:text-[20px] [&_h1]:font-bold [&_h1]:leading-tight
                           [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-[17px] sm:[&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:leading-tight
                           [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-[16px] sm:[&_h3]:text-[18px] [&_h3]:font-bold [&_h3]:leading-tight
                           [&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-[15px] sm:[&_h4]:text-[16px] [&_h4]:font-bold [&_h4]:leading-tight
                           [&_p]:mt-0 [&_p]:mb-2
                           [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_li>p]:my-0
                           [&_table]:mt-2 [&_table]:mb-4 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:px-2 [&_td]:px-2
                           [&_hr]:my-4 [&_blockquote]:my-2 [&_blockquote]:py-1"
                dangerouslySetInnerHTML={{ 
                  __html: marked.parse(extractMarkdownContent(details)) as string
                }} 
              />
            </div>
          ) : (
            <div className="text-sm sm:text-[15px] text-muted-foreground text-center p-4">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>
              No analysis details available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
