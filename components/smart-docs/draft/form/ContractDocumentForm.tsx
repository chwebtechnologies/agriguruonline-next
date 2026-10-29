'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import DocUnderlineInput from './DocUnderlineInput';
import DocUnderlineSelect from './DocUnderlineSelect';
import DocToggle from './DocToggle';
import DocNotesEditor from './DocNotesEditor';
import DocSegmentedToggle, { DocSegmentedToggleOption } from './DocSegmentedToggle';
import DocDocumentMultiSelect, { STANDARD_TRADE_DOCUMENTS } from './DocDocumentMultiSelect';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import ProductManageModal from './ProductManageModal';
import PaymentTermManageModal from './PaymentTermManageModal';
import InstructionManageModal from './InstructionManageModal';
import DocSignatureBox from './DocSignatureBox';
import {
  getSmartDocsInstructionsAction,
  getSmartDocsProductsAction,
  getSmartDocsProductDetailsAction,
  getSmartDocsPaymentTermsAction,
  getSmartDocsCurrenciesAction,
} from '@/app/actions/smart-docs';
import {
  DEFAULT_CURRENCIES,
  DEFAULT_PAYMENT_TERMS,
  parsePackingBagWeightKg,
} from '@/lib/api/smart-docs.service';
import type { FormOptionItem } from './ConfirmationDocumentForm';

export interface ContractDocumentFormProps {
  initialData?: any;
  sellers?: FormOptionItem[];
  buyers?: FormOptionItem[];
  products?: FormOptionItem[];
  loadingPorts?: FormOptionItem[];
  destinationPorts?: FormOptionItem[];
  packingOptions?: FormOptionItem[];
  shippingTerms?: FormOptionItem[];
  currencies?: FormOptionItem[];
  paymentTerms?: FormOptionItem[];
  onSaveDraft?: (payload: any) => Promise<any>;
  onSaveSuccess?: (savedId: string) => void;
  onSubmitContract?: (payload: any) => Promise<any>;
  lang?: string;
  dict?: any;
  readOnly?: boolean;
}

const DEFAULT_FCL_TYPES: FormOptionItem[] = [
  { value: '40 FT', label: '40 FT' },
  { value: '20 FT', label: '20 FT' },  
  { value: 'Vessel', label: 'Vessel' }
];

const DEFAULT_SHIPPING_TERMS: FormOptionItem[] = [
  { value: 'FOB', label: 'FOB (Free On Board)' },
  { value: 'CNF', label: 'CNF (Cost & Freight)' },
  { value: 'CIF', label: 'CIF (Cost, Insurance & Freight)' }
];

const DEFAULT_LOADING_CONDITIONS: FormOptionItem[] = [
  { value: 'Select Loading Condition', label: 'Select Loading Condition' },
  { value: 'Containerized', label: 'Containerized' },
  { value: 'Break Bulk', label: 'Break Bulk' },
  { value: 'Bulk Loading', label: 'Bulk Loading' },
  { value: 'Palletized', label: 'Palletized' },
  { value: 'Loose in Container', label: 'Loose in Container' },
  { value: 'FCL Stuffed at Port', label: 'FCL Stuffed at Port' },
];

const DEFAULT_ADVANCE_TYPE_OPTIONS: DocSegmentedToggleOption<'amount' | '%'>[] = [
  { value: '%', label: '%', icon: 'fa-solid fa-percent' },
  { value: 'amount', label: 'AMOUNT', icon: 'fa-solid fa-coins' },
];

const DEFAULT_BROKER_COMMISSION_TYPE_OPTIONS: DocSegmentedToggleOption<'%' | 'PMT'>[] = [
  { value: '%', label: '%', icon: 'fa-solid fa-percent' },
  { value: 'PMT', label: 'PMT', icon: 'fa-solid fa-scale-balanced' },
];

export function getInsuranceFromIncoterm(term?: string | null): string {
  if (!term || !term.trim()) return '';
  const upper = term.trim().toUpperCase();
  if (
    upper === 'FOB' ||
    upper === 'CNF' ||
    upper === 'CFR' ||
    upper.startsWith('FOB') ||
    upper.startsWith('CNF') ||
    upper.startsWith('CFR')
  ) {
    return 'Buyer';
  }
  return 'Seller';
}

export function getPartialLabel(index: number): string {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

const DEFAULT_OTHER_TERMS_PAYMENT = `THE BUYER SHALL PAY 100% OF THE INVOICE WITHOUT ANY BANK CHARGES DEDUCTION FROM THE TOTAL AMOUNT. BANK CHARGES SHALL BE FOR BUYER'S ACCOUNT.
<ol>
  <li>IN CASE OF NON-PAYMENT AGAINST AT SIGHT FOR D/P THE CHARGES AT THE RATE OF 1% PER MONTH SHALL BE APPLICABLE.</li>
  <li>SUPPLIER NOT RESPONSIBLE FOR ANY LOSS OR DAMAGE DELAYED TO THE GOODS DUE TO CUSTOMS OR PORT PROCEDURES.</li>
</ol>`;

const DEFAULT_CONTAINER_TERMS = `<ol>
  <li>02% EMPTY BAGS WILL BE ADDED IN PER CONTAINER</li>
  <li>SILICA &amp; FULL SIDE CRAFT PAPER WILL BE USED PER REQUIRED STANDARD</li>
  <li>PLASTIC SHEET AT CONTAINER DOOR SIDE</li>
</ol>`;

const DEFAULT_FORCE_MAJEUR = `BOTH BUYER AND SELLER SHALL NOT BE LIABLE FOR DELAY OR NON-PERFORMANCE IN WHOLE OR IN PART OF HIS CONTRACTUAL OBLIGATION IN CONSEQUENCES OF WAR, BLOCKADE, REVOLUTION, INSURRECTION, CIVIL COMMOTION, RIOTS MOBILIZATION, ACT OF GOVERNMENT, ACT OF GOD, PLAGUE OR OTHER EPIDEMIC, FIRE , PORT CONGESTION/DROUGHT, ANY SHIPPING LINE ISSUES, MODIFICATION IN COMMERCIAL LAWS AND REGULATIONS BY THE GOVERNMENT ETC.`;

const DEFAULT_CONFIDENTIALITY = `THIS CONTRACT AND INFORMATION RELATED ONLY THERETO, SHALL BE HELD STRICTLY CONFIDENTIAL AND BUYER IS BOUND WORK TROUGH BROKER ONLY AND SELLER IS BOUND TO WORK TROUGH BROKER ONLY IF ANY PARTIES WILL BREACH BY WORKING DIRECT OR INDIRECT, WE WILL TAKE SUITABLE ACTION ACCORDINGLY WITH BROKERS SAFETY PROTECTION CLAUSE AND SHALL NOT BE DISCLOSED BY THE BUYER/SELLER TO ANY THIRD PARTY UNLESS SPECIFICALLY AUTHORIZED IN WRITING BY THE BROKER/SELLER/BUYER, OR REQUIRED/REQUESTED BY LAW OR ARBITRATION/ COMPETENT AUTHORITY IN CASE OF DISPUTE`;

function isFclType(val?: string | null): boolean {
  if (!val) return true;
  const s = String(val).toUpperCase().trim();
  return s.includes('20') || s.includes('40') || s.includes('CONTAINER') || s.includes('FCL');
}

function toCleanLabel(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '[object Object]' ? '' : trimmed;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return (
      val.name ||
      val.company_name ||
      val.product_name ||
      val.label ||
      val.title ||
      val.code ||
      ''
    );
  }
  return '';
}

function toCleanId(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '[object Object]' ? '' : trimmed;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return val.id || val._id || val.value || val.code || '';
  }
  return '';
}

function formatNumberWithCommas(num: number | string): string {
  if (num === '' || num === null || num === undefined) return '-';
  const n = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num;
  if (isNaN(n)) return String(num);
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ContractDocumentForm({
  initialData,
  sellers = [],
  buyers = [],
  products = [],
  loadingPorts = [],
  destinationPorts = [],
  packingOptions = [],
  shippingTerms = DEFAULT_SHIPPING_TERMS,
  currencies = DEFAULT_CURRENCIES,
  paymentTerms = DEFAULT_PAYMENT_TERMS,
  onSaveDraft,
  onSaveSuccess,
  onSubmitContract,
  lang = 'en',
  dict,
  readOnly = false,
}: ContractDocumentFormProps) {
  // Guard against confirmation data being used to autofill the contract form
  const isActualContractData = Boolean(
    initialData &&
      (initialData.contract_id ||
        initialData.contract_number ||
        initialData.contractNumber ||
        initialData.is_contract) &&
      !initialData.is_confirmation &&
      initialData.action !== 'confirmation'
  );
  const contractSrc = isActualContractData ? initialData : null;

  // Top Header Configuration
  const [letterhead, setLetterhead] = useState<boolean>(
    Boolean(contractSrc?.letterhead_space ?? contractSrc?.letterhead ?? false)
  );
  const [watermark, setWatermark] = useState<boolean>(
    Boolean(contractSrc?.is_watermark_enabled ?? contractSrc?.watermark ?? false)
  );
  const [documentTitle, setDocumentTitle] = useState<string>(() => {
    const raw = toCleanLabel(
      contractSrc?.contract_pdf_title ||
        contractSrc?.contract_title ||
        contractSrc?.pdf_title ||
        contractSrc?.title
    );
    if (!raw || raw.toUpperCase().includes('CONFIRMATION')) {
      return 'CONTRACT';
    }
    return raw;
  });
  const titleInputRef = useRef<HTMLInputElement>(null);

  // ROW 1: Confirmation Number & Date
  const [confirmationNumber, setConfirmationNumber] = useState<string>(() =>
    toCleanLabel(
      contractSrc?.confirmation_number ||
        contractSrc?.confirmation_no ||
        contractSrc?.confirmationNumber
    ) || ''
  );
  const [confirmationDate, setConfirmationDate] = useState<string>(() => {
    const raw = toCleanLabel(contractSrc?.confirmation_date || contractSrc?.confirmationDate);
    if (raw && raw.includes('T')) return raw.split('T')[0];
    return raw || '';
  });

  // ROW 2: Contract Number & Date
  const [contractNumber, setContractNumber] = useState<string>(() =>
    toCleanLabel(contractSrc?.contract_number || contractSrc?.contract_no || contractSrc?.contractNumber) || ''
  );
  const contractInputRef = useRef<HTMLInputElement>(null);
  const [contractDate, setContractDate] = useState<string>(() => {
    const raw = toCleanLabel(contractSrc?.contract_date || contractSrc?.contractDate);
    if (raw && raw.includes('T')) return raw.split('T')[0];
    return raw || '';
  });

  // ROW 3: Parties Header
  const [partiesHeader, setPartiesHeader] = useState<string>(() =>
    toCleanLabel(contractSrc?.parties_header || contractSrc?.partiesHeader) ||
      'THIS CONTRACT IS DRAWN BETWEEN FOLLOWING PARTIES'
  );

  // ROW 4: Exporter (Seller) & Importer (Buyer)
  const [sellerId, setSellerId] = useState<string>(() =>
    toCleanId(contractSrc?.seller_instruction_id || contractSrc?.sellerId || contractSrc?.seller)
  );
  const [sellerInstruction, setSellerInstruction] = useState<string>(() =>
    toCleanLabel(contractSrc?.seller_instruction || contractSrc?.sellerInstruction)
  );
  const [buyerId, setBuyerId] = useState<string>(() =>
    toCleanId(contractSrc?.buyer_instruction_id || contractSrc?.buyerId || contractSrc?.buyer)
  );
  const [buyerInstruction, setBuyerInstruction] = useState<string>(() =>
    toCleanLabel(contractSrc?.buyer_instruction || contractSrc?.buyerInstruction)
  );

  // ROW 5: Shipping Instruction
  const [shippingInstruction, setShippingInstruction] = useState<string>(() =>
    toCleanLabel(contractSrc?.shipping_instruction || contractSrc?.shippingInstruction) || ''
  );

  // ROW 6: Product, HSN, Country
  const [productId, setProductId] = useState<string>(() =>
    toCleanId(contractSrc?.product_id || contractSrc?.productId || contractSrc?.product)
  );
  const [hsnCode, setHsnCode] = useState<string>(() =>
    toCleanLabel(contractSrc?.hsn_code || contractSrc?.hsnCode || contractSrc?.hsn)
  );
  const [productCountry, setProductCountry] = useState<string>(() =>
    toCleanLabel(contractSrc?.country || contractSrc?.origin_country || contractSrc?.productCountry)
  );

  // ROW 7: Specification
  const [specification, setSpecification] = useState<string>(() =>
    toCleanLabel(contractSrc?.quality_specification || contractSrc?.specification)
  );

  // ROW 8: Shipment Period
  const [shipmentRange, setShipmentRange] = useState<{ start: Date | null; end: Date | null }>({
    start: contractSrc?.shipment_start_date ? new Date(contractSrc.shipment_start_date) : null,
    end: contractSrc?.shipment_end_date ? new Date(contractSrc.shipment_end_date) : null,
  });

  // ROW 9: Payment Term
  const [paymentTerm, setPaymentTerm] = useState<string>(() =>
    toCleanId(contractSrc?.payment_term_id || contractSrc?.payment_term)
  );

  // ROW 10: FCL Type
  const [fclType, setFclType] = useState<string>(() =>
    toCleanLabel(contractSrc?.fcl_type || contractSrc?.ship_by || contractSrc?.shipBy) || ''
  );
  const isFcl = isFclType(fclType);

  // ROW 11: Packing
  const [packing, setPacking] = useState<string>(() =>
    toCleanId(contractSrc?.packing_type_id || contractSrc?.packing)
  );

  // ROW 12: Marking Brand
  const [markingBrand, setMarkingBrand] = useState<string>(() =>
    toCleanLabel(contractSrc?.marking_brand || contractSrc?.markingBrand) || ''
  );

  // ROW 13: Loading Port & Country
  const [loadingPort, setLoadingPort] = useState<string>(() =>
    toCleanId(contractSrc?.loading_port_id || contractSrc?.loading_port)
  );

  // ROW 14: Loading Condition
  const [loadingCondition, setLoadingCondition] = useState<string>(() =>
    toCleanLabel(contractSrc?.loading_condition || contractSrc?.loadingCondition) || ''
  );

  // ROW 15: Destination Port & Country
  const [destinationPort, setDestinationPort] = useState<string>(() =>
    toCleanId(contractSrc?.destination_port_id || contractSrc?.destination_port)
  );

  // ROW 16: Matrix Calculation (FCL Qty, Capacity, MT Qty, Bag Qty, Currency, Price, Total Value)
  const [fclQty, setFclQty] = useState<string | number>(contractSrc?.fcl_quantity ?? contractSrc?.fclQty ?? '');
  const [fclCapacity, setFclCapacity] = useState<string | number>(contractSrc?.fcl_capacity ?? contractSrc?.fclCapacity ?? '');
  const [mtQty, setMtQty] = useState<string | number>(contractSrc?.mt_quantity ?? contractSrc?.mtQty ?? '');
  const [bagQty, setBagQty] = useState<string | number>(contractSrc?.bag_quantity ?? contractSrc?.bagQty ?? '');
  const [currency, setCurrency] = useState<string>(() => toCleanLabel(contractSrc?.currency || contractSrc?.currency_code) || '');
  const [currencyId, setCurrencyId] = useState<string>(() => toCleanId(contractSrc?.currency_id || contractSrc?.currencyId));
  const [price, setPrice] = useState<string | number>(contractSrc?.price ?? '');
  const [totalValue, setTotalValue] = useState<string | number>(contractSrc?.total_value ?? contractSrc?.totalValue ?? '');

  // ROW 17: Inspection
  const [inspection, setInspection] = useState<string>(() =>
    toCleanLabel(contractSrc?.inspection) || ''
  );

  // ROW 18: Incoterm
  const [incoterm, setIncoterm] = useState<string>(() =>
    toCleanLabel(contractSrc?.shipping_term || contractSrc?.incoterm) || ''
  );

  // ROW 19: Insurance (Auto-derived from Incoterm: FOB or CNF => Buyer, otherwise => Seller)
  const insurance = useMemo(() => {
    return getInsuranceFromIncoterm(incoterm) || (contractSrc?.insurance ? toCleanLabel(contractSrc.insurance) : '');
  }, [incoterm, contractSrc]);

  // ROW 20-24: Segmented Toggles (Image 3)
  const [isPartialAllowed, setIsPartialAllowed] = useState<boolean | null>(() => {
    if (contractSrc?.partial_shipment_allowed !== undefined && contractSrc?.partial_shipment_allowed !== null) {
      return Boolean(contractSrc.partial_shipment_allowed);
    }
    return null;
  });
  const [partialCount, setPartialCount] = useState<string | number>(() => {
    return contractSrc?.partial_count ?? contractSrc?.partialCount ?? '';
  });
  const [partialQuantities, setPartialQuantities] = useState<(string | number)[]>(() => {
    const raw =
      contractSrc?.partial_breakdown ??
      contractSrc?.partialBreakdown ??
      contractSrc?.partial_quantities ??
      contractSrc?.partialQuantities ??
      contractSrc?.partials;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((item: any) => {
        if (typeof item === 'object' && item !== null) {
          return item.quantity ?? item.qty ?? item.value ?? '';
        }
        return item ?? '';
      });
    }
    const count = parseInt(String(contractSrc?.partial_count ?? contractSrc?.partialCount ?? 0), 10);
    if (!isNaN(count) && count > 0) {
      return Array(Math.min(count, 500)).fill('');
    }
    return [];
  });

  const handlePartialCountChange = (val: string) => {
    setPartialCount(val);
    setErrors((prev) => ({ ...prev, partialCount: '', partialTotal: '' }));
    const count = parseInt(val, 10);
    if (!isNaN(count) && count > 0) {
      const safeCount = Math.min(count, 500);
      setPartialQuantities((prev) => {
        const next = [...prev];
        if (next.length < safeCount) {
          while (next.length < safeCount) {
            next.push('');
          }
        } else if (next.length > safeCount) {
          return next.slice(0, safeCount);
        }
        return next;
      });
    } else {
      setPartialQuantities([]);
    }
  };

  const handlePartialQtyChange = (index: number, val: string) => {
    setPartialQuantities((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
    setErrors((prev) => ({ ...prev, partialTotal: '' }));
  };

  const partialSum = useMemo(() => {
    return partialQuantities.reduce((acc: number, curr) => {
      const n = parseFloat(String(curr).replace(/[^\d.]/g, ''));
      return acc + (isNaN(n) ? 0 : n);
    }, 0);
  }, [partialQuantities]);

  const targetFclQty = useMemo(() => {
    const n = parseFloat(String(fclQty).replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }, [fclQty]);

  const isPartialMatch = useMemo(() => {
    if (!isPartialAllowed) return true;
    const count = parseInt(String(partialCount), 10);
    if (isNaN(count) || count <= 0) return false;
    if (targetFclQty <= 0) return false;
    return Math.abs(partialSum - targetFclQty) < 0.0001;
  }, [isPartialAllowed, partialCount, partialSum, targetFclQty]);
  const [isTranshipmentAllowed, setIsTranshipmentAllowed] = useState<boolean | null>(() => {
    if (contractSrc?.transhipment_allowed !== undefined && contractSrc?.transhipment_allowed !== null) {
      return Boolean(contractSrc.transhipment_allowed);
    }
    return null;
  });
  const [isTransitClauseAllowed, setIsTransitClauseAllowed] = useState<boolean | null>(() => {
    if (contractSrc?.transit_clause_allowed !== undefined && contractSrc?.transit_clause_allowed !== null) {
      return Boolean(contractSrc.transit_clause_allowed);
    }
    return null;
  });
  const [hasAdvance, setHasAdvance] = useState<boolean | null>(() => {
    if (contractSrc?.any_advance !== undefined && contractSrc?.any_advance !== null) {
      return Boolean(contractSrc.any_advance);
    }
    return null;
  });
  const [advanceType, setAdvanceType] = useState<'amount' | '%'>(() => {
    const rawType = contractSrc?.advance_type || contractSrc?.advanceType;
    if (rawType === '%' || rawType === 'percentage' || rawType === 'PERCENTAGE') {
      return '%';
    }
    if (
      contractSrc?.advance_percentage !== undefined &&
      contractSrc?.advance_percentage !== null &&
      contractSrc?.advance_percentage !== ''
    ) {
      return '%';
    }
    return 'amount';
  });
  const [advanceAmount, setAdvanceAmount] = useState<string | number>(() => {
    return contractSrc?.advance_amount ?? contractSrc?.advanceAmount ?? '';
  });
  const [advancePercentage, setAdvancePercentage] = useState<string | number>(() => {
    return contractSrc?.advance_percentage ?? contractSrc?.advancePercentage ?? contractSrc?.advance_percent ?? '';
  });

  // Advance dynamic calculations based on MT and Total Contract Value
  const effectiveContractMt = useMemo(() => {
    if (isFcl) {
      const q = parseFloat(String(fclQty).replace(/[^\d.]/g, '')) || 0;
      const c = parseFloat(String(fclCapacity).replace(/[^\d.]/g, '')) || 0;
      if (q > 0 && c > 0) return q * c;
    }
    return parseFloat(String(mtQty).replace(/[^\d.]/g, '')) || 0;
  }, [isFcl, fclQty, fclCapacity, mtQty]);

  const effectiveContractTotalValue = useMemo(() => {
    const tot = parseFloat(String(totalValue).replace(/[^\d.]/g, '')) || 0;
    if (tot > 0) return tot;
    const p = parseFloat(String(price).replace(/[^\d.]/g, '')) || 0;
    if (effectiveContractMt > 0 && p > 0) return effectiveContractMt * p;
    return 0;
  }, [totalValue, price, effectiveContractMt]);

  const calculatedAdvanceAmount = useMemo(() => {
    const pct = parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0;
    if (pct > 0 && effectiveContractTotalValue > 0) {
      return ((effectiveContractTotalValue * pct) / 100).toFixed(2);
    }
    return '';
  }, [advancePercentage, effectiveContractTotalValue]);

  const calculatedAdvanceMt = useMemo(() => {
    const pct = parseFloat(String(advancePercentage).replace(/[^\d.]/g, '')) || 0;
    if (pct > 0 && effectiveContractMt > 0) {
      const val = (effectiveContractMt * pct) / 100;
      return Number.isInteger(val) ? String(val) : val.toFixed(2);
    }
    return '';
  }, [advancePercentage, effectiveContractMt]);
  const [isSalesBrokerAllowed, setIsSalesBrokerAllowed] = useState<boolean | null>(() => {
    if (contractSrc?.sales_broker_allowed !== undefined && contractSrc?.sales_broker_allowed !== null) {
      return Boolean(contractSrc.sales_broker_allowed);
    }
    return null;
  });
  const [brokerCommissionType, setBrokerCommissionType] = useState<'%' | 'PMT'>(() => {
    const raw = contractSrc?.broker_commission_type || contractSrc?.sales_broker_type;
    if (raw === '%' || raw === 'percentage') return '%';
    return 'PMT';
  });
  const [brokerCommission, setBrokerCommission] = useState<string>(() => {
    const val = contractSrc?.broker_commission ?? contractSrc?.sales_broker_commission ?? '';
    return val !== '' && val !== null && val !== undefined ? String(val) : '';
  });
  const [brokerName, setBrokerName] = useState<string>(() =>
    toCleanLabel(contractSrc?.broker_name || contractSrc?.sales_broker_name) || ''
  );

  const calculatedBrokerCommission = useMemo(() => {
    if (!isSalesBrokerAllowed) return '';
    const rate = parseFloat(String(brokerCommission).replace(/[^\d.]/g, '')) || 0;
    if (rate <= 0) return '';
    if (brokerCommissionType === '%') {
      if (effectiveContractTotalValue > 0) {
        return ((effectiveContractTotalValue * rate) / 100).toFixed(2);
      }
    } else {
      // PMT: Per Metric Ton
      if (effectiveContractMt > 0) {
        return (effectiveContractMt * rate).toFixed(2);
      }
    }
    return '';
  }, [isSalesBrokerAllowed, brokerCommission, brokerCommissionType, effectiveContractTotalValue, effectiveContractMt]);

  // ROW 25: Additional Details
  const [freeDays, setFreeDays] = useState<string>(() =>
    toCleanLabel(contractSrc?.free_days || contractSrc?.freeDays) || ''
  );
  const [emptyBags, setEmptyBags] = useState<string>(() =>
    toCleanLabel(contractSrc?.empty_bags || contractSrc?.emptyBags) || ''
  );
  const [additionalComment, setAdditionalComment] = useState<string>(() =>
    toCleanLabel(contractSrc?.additional_comment || contractSrc?.comment) || ''
  );

  // ROW 26: Other Terms (Payment & Charges)
  const [otherTermsPayment, setOtherTermsPayment] = useState<string>(() =>
    contractSrc?.other_terms || contractSrc?.payment_terms_charges || ''
  );

  // ROW 27: Documents Checklist (Image 4)
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>(() => {
    if (Array.isArray(contractSrc?.required_documents)) return contractSrc.required_documents;
    if (Array.isArray(contractSrc?.documents)) return contractSrc.documents;
    return [];
  });

  // ROW 28: Shipping Line (Image 4)
  const [shippingLine, setShippingLine] = useState<string>(() =>
    toCleanLabel(contractSrc?.shipping_line) || ''
  );

  // ROW 29: Arbitration (Image 4)
  const [arbitration, setArbitration] = useState<string>(() =>
    toCleanLabel(contractSrc?.arbitration) || ''
  );

  // ROW 30: Container & Packaging Standards (Image 4 & 5)
  const [containerStandards, setContainerStandards] = useState<string>(() =>
    contractSrc?.container_terms || contractSrc?.packaging_standards || ''
  );

  // ROW 31: Force Majeur (Image 4 & 5)
  const [forceMajeur, setForceMajeur] = useState<string>(() =>
    contractSrc?.force_majeur || ''
  );

  // ROW 32: Confidentiality (Image 5)
  const [confidentiality, setConfidentiality] = useState<string>(() =>
    contractSrc?.confidentiality || ''
  );

  // ROW 33: NOTES (Below Confidentiality)
  const [notes, setNotes] = useState<string>(() => toCleanLabel(contractSrc?.notes) || '');

  // ROW 34: Signatures - Importer & Exporter (Below Notes)
  const [importerTitle, setImporterTitle] = useState<string>(
    () => toCleanLabel(contractSrc?.importer_title) || 'IMPORTER'
  );
  const [importerSignature, setImporterSignature] = useState<string>(
    () => contractSrc?.importer_signature || ''
  );
  const [importerAuthorityTitle, setImporterAuthorityTitle] = useState<string>(
    () => toCleanLabel(contractSrc?.importer_authority_title) || 'AUTHORITY SIGNATURE'
  );

  const [brokerTitle, setBrokerTitle] = useState<string>(
    () => toCleanLabel(contractSrc?.broker_title || contractSrc?.sales_broker_title) || 'BROKER'
  );
  const [brokerSignature, setBrokerSignature] = useState<string>(
    () => contractSrc?.broker_signature || contractSrc?.sales_broker_signature || ''
  );
  const [brokerAuthorityTitle, setBrokerAuthorityTitle] = useState<string>(
    () => toCleanLabel(contractSrc?.broker_authority_title || contractSrc?.sales_broker_authority_title) || 'AUTHORITY SIGNATURE'
  );

  const [exporterTitle, setExporterTitle] = useState<string>(
    () => toCleanLabel(contractSrc?.exporter_title) || 'EXPORTER'
  );
  const [exporterSignature, setExporterSignature] = useState<string>(
    () => contractSrc?.exporter_signature || ''
  );
  const [exporterAuthorityTitle, setExporterAuthorityTitle] = useState<string>(
    () => toCleanLabel(contractSrc?.exporter_authority_title) || 'AUTHORITY SIGNATURE'
  );

  // UI States
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic Options States
  const [internalSellers, setInternalSellers] = useState<FormOptionItem[]>(sellers);
  const [internalBuyers, setInternalBuyers] = useState<FormOptionItem[]>(buyers);
  const [internalProducts, setInternalProducts] = useState<FormOptionItem[]>(products);
  const [internalLoadingPorts, setInternalLoadingPorts] = useState<FormOptionItem[]>(loadingPorts);
  const [internalDestinationPorts, setInternalDestinationPorts] = useState<FormOptionItem[]>(destinationPorts);
  const [internalPackingOptions, setInternalPackingOptions] = useState<FormOptionItem[]>(packingOptions);
  const [internalPaymentTerms, setInternalPaymentTerms] = useState<FormOptionItem[]>(paymentTerms);
  const [internalCurrencies, setInternalCurrencies] = useState<FormOptionItem[]>(currencies);

  const [isLoadingProductDetails, setIsLoadingProductDetails] = useState<boolean>(false);

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [productModalMode, setProductModalMode] = useState<'add' | 'edit'>('add');
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [isPaymentTermModalOpen, setIsPaymentTermModalOpen] = useState<boolean>(false);
  const [paymentTermModalMode, setPaymentTermModalMode] = useState<'add' | 'edit'>('add');
  const [editingPaymentTerm, setEditingPaymentTerm] = useState<any>(null);

  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState<boolean>(false);
  const [instructionModalMode, setInstructionModalMode] = useState<'add' | 'edit'>('add');
  const [instructionModalPartyType, setInstructionModalPartyType] = useState<'seller' | 'buyer'>('seller');
  const [editingParty, setEditingParty] = useState<FormOptionItem | null>(null);

  // Sync external options
  useEffect(() => {
    if (sellers && sellers.length > 0) setInternalSellers(sellers);
  }, [sellers]);

  useEffect(() => {
    if (buyers && buyers.length > 0) setInternalBuyers(buyers);
  }, [buyers]);

  useEffect(() => {
    if (products && products.length > 0) setInternalProducts(products);
  }, [products]);

  useEffect(() => {
    if (paymentTerms && paymentTerms.length > 0) setInternalPaymentTerms(paymentTerms);
  }, [paymentTerms]);

  // Client-side self-heal for options if not passed from parent
  useEffect(() => {
    if ((!sellers || sellers.length === 0) && (!buyers || buyers.length === 0)) {
      getSmartDocsInstructionsAction({ lang })
        .then((res) => {
          if (res?.success) {
            if (res.sellers && res.sellers.length > 0) setInternalSellers(res.sellers);
            if (res.buyers && res.buyers.length > 0) setInternalBuyers(res.buyers);
          }
        })
        .catch((err) => console.error('[ContractDocumentForm] Error fetching instructions:', err));
    }
  }, [sellers, buyers, lang]);

  useEffect(() => {
    if (!products || products.length === 0) {
      getSmartDocsProductsAction({ lang })
        .then((res) => {
          if (res?.success && res.products && res.products.length > 0) {
            setInternalProducts(res.products);
          }
        })
        .catch((err) => console.error('[ContractDocumentForm] Error fetching products:', err));
    }
  }, [products, lang]);

  useEffect(() => {
    if (!paymentTerms || paymentTerms.length === 0) {
      getSmartDocsPaymentTermsAction({ lang })
        .then((res) => {
          if (res?.success && res.paymentTerms && res.paymentTerms.length > 0) {
            setInternalPaymentTerms(res.paymentTerms);
          }
        })
        .catch((err) => console.error('[ContractDocumentForm] Error fetching payment terms:', err));
    }
  }, [paymentTerms, lang]);

  useEffect(() => {
    if (!currencies || currencies.length === 0) {
      getSmartDocsCurrenciesAction({ lang })
        .then((res) => {
          if (res?.success && res.currencies && res.currencies.length > 0) {
            setInternalCurrencies(res.currencies);
          }
        })
        .catch((err) => console.error('[ContractDocumentForm] Error fetching currencies:', err));
    }
  }, [currencies, lang]);

  const handleAddNewSeller = () => {
    setEditingParty(null);
    setInstructionModalMode('add');
    setInstructionModalPartyType('seller');
    setIsInstructionModalOpen(true);
  };

  const handleEditSeller = (opt: any) => {
    const found = internalSellers.find((s) => s.value === opt.value || s.label === opt.label) || opt;
    setEditingParty(found);
    setInstructionModalMode('edit');
    setInstructionModalPartyType('seller');
    setIsInstructionModalOpen(true);
  };

  const handleAddNewBuyer = () => {
    setEditingParty(null);
    setInstructionModalMode('add');
    setInstructionModalPartyType('buyer');
    setIsInstructionModalOpen(true);
  };

  const handleEditBuyer = (opt: any) => {
    const found = internalBuyers.find((b) => b.value === opt.value || b.label === opt.label) || opt;
    setEditingParty(found);
    setInstructionModalMode('edit');
    setInstructionModalPartyType('buyer');
    setIsInstructionModalOpen(true);
  };

  const handleSaveInstruction = (savedData: { id: string; label: string; instructionText: string }) => {
    const formattedItem: FormOptionItem = {
      value: savedData.id,
      label: savedData.label,
      subLabel: savedData.instructionText,
      instructionText: savedData.instructionText,
    };

    if (instructionModalPartyType === 'seller') {
      setInternalSellers((prev) => {
        const idx = prev.findIndex(
          (p) => p.value === savedData.id || p.label.toLowerCase() === savedData.label.toLowerCase()
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...formattedItem };
          return next;
        }
        return [formattedItem, ...prev];
      });
      setSellerId(savedData.id);
      setSellerInstruction(savedData.instructionText);
      setErrors((prev) => ({ ...prev, sellerId: '' }));
    } else {
      setInternalBuyers((prev) => {
        const idx = prev.findIndex(
          (p) => p.value === savedData.id || p.label.toLowerCase() === savedData.label.toLowerCase()
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...formattedItem };
          return next;
        }
        return [formattedItem, ...prev];
      });
      setBuyerId(savedData.id);
      setBuyerInstruction(savedData.instructionText);
      setErrors((prev) => ({ ...prev, buyerId: '' }));
    }
  };

  const handleAddNewProduct = () => {
    setEditingProduct(null);
    setProductModalMode('add');
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (opt: any) => {
    const found = internalProducts.find((p) => p.value === opt.value || p.label === opt.label) || opt;
    setEditingProduct(found);
    setProductModalMode('edit');
    setIsProductModalOpen(true);
  };

  const handleAddNewPaymentTerm = () => {
    setEditingPaymentTerm(null);
    setPaymentTermModalMode('add');
    setIsPaymentTermModalOpen(true);
  };

  const handleEditPaymentTerm = (opt: any) => {
    const found = internalPaymentTerms.find((p) => p.value === opt.value || p.label === opt.label) || opt;
    setEditingPaymentTerm(found);
    setPaymentTermModalMode('edit');
    setIsPaymentTermModalOpen(true);
  };

  // Product Selection & Details Fetching
  const fetchAndApplyProductDetails = useCallback(
    async (prodId: string) => {
      if (!prodId) return;
      setIsLoadingProductDetails(true);
      try {
        const res = await getSmartDocsProductDetailsAction(prodId, { lang });
        if (res?.success && res.data) {
          const d = res.data;
          if (d.hsnCode || (d as any).hsn) setHsnCode(d.hsnCode || (d as any).hsn);
          if (d.country) setProductCountry(d.country);
          if (d.specification) setSpecification(d.specification);

          if (d.loadingPorts && Array.isArray(d.loadingPorts)) {
            setInternalLoadingPorts(d.loadingPorts);
          }
          if (d.destinationPorts && Array.isArray(d.destinationPorts)) {
            setInternalDestinationPorts(d.destinationPorts);
          }
          if (d.packingTypes && Array.isArray(d.packingTypes)) {
            setInternalPackingOptions(d.packingTypes);
          }
        }
      } catch (err) {
        console.error('[ContractDocumentForm] Product details error:', err);
      } finally {
        setIsLoadingProductDetails(false);
      }
    },
    [lang]
  );

  const handleProductChange = (val: string) => {
    setProductId(val);
    setErrors((prev) => ({ ...prev, productId: '' }));
    fetchAndApplyProductDetails(val);
  };

  const handleSellerChange = (val: string) => {
    setSellerId(val);
    setErrors((prev) => ({ ...prev, sellerId: '' }));
    const selected = internalSellers.find(
      (s) => String(s.value) === String(val) || String(s.id) === String(val)
    );
    if (selected) {
      const addressParts = [
        selected.label || selected.name || '',
        selected.address || selected.instructionText || selected.details || '',
      ].filter(Boolean);
      setSellerInstruction(addressParts.join('\n'));
    }
  };

  const handleBuyerChange = (val: string) => {
    setBuyerId(val);
    setErrors((prev) => ({ ...prev, buyerId: '' }));
    const selected = internalBuyers.find(
      (b) => String(b.value) === String(val) || String(b.id) === String(val)
    );
    if (selected) {
      const addressParts = [
        selected.label || selected.name || '',
        selected.address || selected.instructionText || selected.details || '',
      ].filter(Boolean);
      setBuyerInstruction(addressParts.join('\n'));
    }
  };

  // Real-time calculation for MT QTY, BAG QTY & TOTAL VALUE
  useEffect(() => {
    const bagKg = parsePackingBagWeightKg(packing, internalPackingOptions);
    const p = parseFloat(String(price)) || 0;

    if (isFcl) {
      const fcl = parseFloat(String(fclQty).replace(/[^\d.]/g, '')) || 0;
      const capacity = parseFloat(String(fclCapacity).replace(/[^\d.]/g, '')) || 0;
      const calcMt = fcl * capacity;
      const nextMt =
        !fclQty && !fclCapacity
          ? ''
          : calcMt > 0
          ? calcMt % 1 === 0
            ? calcMt.toString()
            : calcMt.toFixed(2)
          : '0';

      if (String(mtQty) !== String(nextMt)) {
        setMtQty(nextMt);
      }

      if (calcMt > 0 && bagKg && bagKg > 0) {
        const calcBags = Math.round((calcMt * 1000) / bagKg);
        if (String(bagQty) !== String(calcBags)) {
          setBagQty(calcBags);
        }
      } else if (!nextMt) {
        setBagQty('');
      }

      if (calcMt > 0 && p > 0) {
        const calcTotal = (calcMt * p).toFixed(2);
        if (String(totalValue) !== String(calcTotal)) {
          setTotalValue(calcTotal);
        }
      } else if (!nextMt || !price) {
        setTotalValue('');
      }
    } else {
      const mt = parseFloat(String(mtQty).replace(/[^\d.]/g, '')) || 0;
      if (mt > 0 && bagKg && bagKg > 0) {
        const calcBags = Math.round((mt * 1000) / bagKg);
        if (String(bagQty) !== String(calcBags)) {
          setBagQty(calcBags);
        }
      } else if (!mtQty) {
        setBagQty('');
      }

      if (mt > 0 && p > 0) {
        const calcTotal = (mt * p).toFixed(2);
        if (String(totalValue) !== String(calcTotal)) {
          setTotalValue(calcTotal);
        }
      } else if (!mtQty || !price) {
        setTotalValue('');
      }
    }
  }, [isFcl, fclQty, fclCapacity, mtQty, packing, price, internalPackingOptions]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!contractNumber || !contractNumber.trim()) {
      newErrors.contractNumber =
        dict?.smart_docs?.contract_form?.contract_number_required || 'Contract number is required';
    }
    if (!sellerId) {
      newErrors.sellerId = 'Please select a seller';
    }
    if (!buyerId) {
      newErrors.buyerId = 'Please select a buyer';
    }
    if (!productId) {
      newErrors.productId = 'Please select a product';
    }
    if (isFcl) {
      if (!fclQty || Number(fclQty) <= 0) {
        newErrors.fclQty = 'FCL Qty required';
      }
      if (!fclCapacity || Number(fclCapacity) <= 0) {
        newErrors.fclCapacity = 'FCL Capacity required';
      }
    } else {
      if (!mtQty || Number(mtQty) <= 0) {
        newErrors.mtQty = 'MT Qty required';
      }
    }
    if (!price || Number(price) <= 0) {
      newErrors.price = 'Price is required';
    }

    if (isPartialAllowed) {
      const count = parseInt(String(partialCount), 10);
      if (!partialCount || isNaN(count) || count <= 0) {
        newErrors.partialCount = 'Partial count required';
      } else {
        const hasEmpty = partialQuantities.some((q) => q === '' || q === null || q === undefined);
        if (hasEmpty) {
          newErrors.partialTotal = 'All partial quantities must be entered';
        } else if (targetFclQty > 0 && Math.abs(partialSum - targetFclQty) > 0.0001) {
          newErrors.partialTotal = `Total partial count (${partialSum}) must equal FCL Quantity (${targetFclQty})`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getContractPayload = () => {
    return {
      confirmation_number: confirmationNumber.trim(),
      confirmation_date: confirmationDate,
      contract_number: contractNumber.trim(),
      contract_date: contractDate,
      pdf_title: documentTitle.trim() || 'CONTRACT',
      letterhead_space: Boolean(letterhead),
      is_watermark_enabled: Boolean(watermark),
      parties_header: partiesHeader.trim(),
      seller_instruction_id: sellerId,
      seller_instruction: sellerInstruction.trim(),
      buyer_instruction_id: buyerId,
      buyer_instruction: buyerInstruction.trim(),
      shipping_instruction: shippingInstruction.trim(),
      product_id: productId,
      hsn_code: hsnCode,
      country: productCountry,
      quality_specification: specification.trim(),
      shipment_start_date: shipmentRange.start ? shipmentRange.start.toISOString().split('T')[0] : undefined,
      shipment_end_date: shipmentRange.end ? shipmentRange.end.toISOString().split('T')[0] : undefined,
      payment_term_id: paymentTerm,
      fcl_type: fclType,
      ship_by: fclType,
      packing_type_id: packing,
      marking_brand: markingBrand.trim(),
      loading_port_id: loadingPort,
      loading_condition: loadingCondition,
      destination_port_id: destinationPort,
      fcl_quantity: isFcl && fclQty ? Number(fclQty) : undefined,
      fcl_capacity: isFcl && fclCapacity ? String(fclCapacity) : undefined,
      mt_quantity: mtQty ? Number(mtQty) : undefined,
      bag_quantity: bagQty ? Number(bagQty) : undefined,
      currency_id: currencyId || currency,
      currency: currency,
      price: price ? Number(price) : undefined,
      total_value: totalValue ? Number(totalValue) : undefined,
      inspection: inspection.trim(),
      shipping_term: incoterm,
      incoterm: incoterm,
      insurance: insurance,
      partial_shipment_allowed: isPartialAllowed !== null ? isPartialAllowed : undefined,
      partial_count: isPartialAllowed && partialCount ? Number(partialCount) : undefined,
      partial_breakdown: isPartialAllowed && partialQuantities.length > 0 ? partialQuantities : undefined,
      partial_quantities: isPartialAllowed && partialQuantities.length > 0 ? partialQuantities : undefined,
      transhipment_allowed: isTranshipmentAllowed !== null ? isTranshipmentAllowed : undefined,
      transit_clause_allowed: isTransitClauseAllowed !== null ? isTransitClauseAllowed : undefined,
      any_advance: hasAdvance !== null ? hasAdvance : undefined,
      advance_type: hasAdvance ? advanceType : undefined,
      advance_amount: hasAdvance
        ? advanceType === 'amount'
          ? advanceAmount ? Number(advanceAmount) : undefined
          : calculatedAdvanceAmount ? Number(calculatedAdvanceAmount) : undefined
        : undefined,
      advance_percentage: hasAdvance && advanceType === '%' && advancePercentage
        ? Number(advancePercentage)
        : undefined,
      sales_broker_allowed: isSalesBrokerAllowed !== null ? isSalesBrokerAllowed : undefined,
      broker_commission_type: isSalesBrokerAllowed ? brokerCommissionType : undefined,
      broker_commission: isSalesBrokerAllowed && brokerCommission ? Number(brokerCommission) : undefined,
      broker_commission_amount: isSalesBrokerAllowed && calculatedBrokerCommission ? Number(calculatedBrokerCommission) : undefined,
      broker_name: isSalesBrokerAllowed && brokerName.trim() ? brokerName.trim() : undefined,
      sales_broker_type: isSalesBrokerAllowed ? brokerCommissionType : undefined,
      sales_broker_commission: isSalesBrokerAllowed && brokerCommission ? Number(brokerCommission) : undefined,
      sales_broker_amount: isSalesBrokerAllowed && calculatedBrokerCommission ? Number(calculatedBrokerCommission) : undefined,
      sales_broker_name: isSalesBrokerAllowed && brokerName.trim() ? brokerName.trim() : undefined,
      free_days: freeDays.trim(),
      empty_bags: emptyBags.trim(),
      additional_comment: additionalComment.trim(),
      other_terms: otherTermsPayment.trim(),
      required_documents: selectedDocuments,
      shipping_line: shippingLine.trim(),
      arbitration: arbitration.trim(),
      container_terms: containerStandards.trim(),
      force_majeur: forceMajeur.trim(),
      confidentiality: confidentiality.trim(),
      notes: notes.trim(),
      importer_title: importerTitle.trim(),
      importer_signature: importerSignature,
      importer_authority_title: importerAuthorityTitle.trim(),
      broker_title: isSalesBrokerAllowed ? brokerTitle.trim() : undefined,
      broker_signature: isSalesBrokerAllowed ? brokerSignature : undefined,
      broker_authority_title: isSalesBrokerAllowed ? brokerAuthorityTitle.trim() : undefined,
      sales_broker_title: isSalesBrokerAllowed ? brokerTitle.trim() : undefined,
      sales_broker_signature: isSalesBrokerAllowed ? brokerSignature : undefined,
      sales_broker_authority_title: isSalesBrokerAllowed ? brokerAuthorityTitle.trim() : undefined,
      exporter_title: exporterTitle.trim(),
      exporter_signature: exporterSignature,
      exporter_authority_title: exporterAuthorityTitle.trim(),
    };
  };

  const handleSaveDraft = async () => {
    if (!contractNumber.trim()) {
      setErrors((prev) => ({
        ...prev,
        contractNumber:
          dict?.smart_docs?.contract_form?.contract_number_required || 'Contract number is required',
      }));
      toast.error(
        dict?.smart_docs?.contract_form?.contract_number_required ||
        'Please enter contract number before saving'
      );
      contractInputRef.current?.focus();
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload = getContractPayload();
      if (onSaveDraft) {
        const res = await onSaveDraft(payload);
        if (res?.success) {
          toast.success(
            dict?.smart_docs?.contract_form?.saved_as_draft_success ||
            'Contract saved as draft successfully!'
          );
          if (res.id && onSaveSuccess) {
            onSaveSuccess(String(res.id));
          }
        } else {
          toast.error(res?.message || 'Failed to save contract draft');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error while saving draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error(
        dict?.smart_docs?.confirmation_form?.validation_error ||
        'Please fill all required highlighted fields before submitting.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = getContractPayload();
      if (onSubmitContract) {
        const res = await onSubmitContract(payload);
        if (res?.success) {
          toast.success('Contract submitted successfully to Proforma Invoice!');
        } else {
          toast.error(res?.message || 'Failed to submit contract to Proforma');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error while submitting contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-auto lg:h-full flex flex-col min-h-fit lg:min-h-0 bg-card text-foreground rounded-xl">
      {/* 
        Scrollable Table Viewport:
        - Fluid on mobile (no trapped inner scroll)
        - Locked internal scrolling on desktop
      */}
      <div className="w-full flex-none lg:flex-1 min-h-fit lg:min-h-0 overflow-visible lg:overflow-y-auto lg:overscroll-contain">
        {/* TOP BAR: Letterhead Toggle | CONTRACT Title | Watermark Toggle */}
        <div className="px-3 sm:px-4 py-2 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
          {/* Desktop Left: Letterhead Toggle */}
          <div className="hidden sm:flex items-center">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.letterhead || 'Letterhead'}
              checked={letterhead}
              onChange={setLetterhead}
              disabled={readOnly}
            />
          </div>

          {/* Center: Title (Directly Editable Field) + Dotted Accent Underline */}
          <div className="flex flex-col items-center justify-center group/title w-full sm:w-auto">
            <div className="inline-flex items-center justify-center gap-1.5 max-w-full">
              <input
                ref={titleInputRef}
                type="text"
                value={documentTitle}
                onChange={(e) => {
                  setDocumentTitle(e.target.value);
                  setErrors((prev) => ({ ...prev, documentTitle: '' }));
                }}
                disabled={readOnly}
                placeholder={dict?.smart_docs?.contract_form?.contract_title || 'CONTRACT'}
                aria-label={dict?.smart_docs?.contract_form?.contract_title || 'Document Title'}
                style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                className="text-xs sm:text-sm md:text-[15px] font-extrabold uppercase tracking-widest text-foreground text-center bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:bg-transparent rounded-sm px-1.5 py-0.5 w-auto min-w-[130px] max-w-[210px] sm:max-w-xs cursor-text transition-all"
              />
              {!readOnly && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => titleInputRef.current?.focus()}
                  title="Edit document title"
                  aria-label="Edit document title"
                  style={{ outline: 'none' }}
                  className="w-5 h-5 flex items-center justify-center rounded-full text-primary hover:text-primary-hover hover:bg-primary/10 text-[10px] transition-colors cursor-pointer shrink-0 outline-none focus:outline-none"
                >
                  <i className="fa-solid fa-pen text-primary" />
                </button>
              )}
            </div>
            {/* Clean Underline - becomes solid and vibrant on focus */}
            <div
              className={`w-36 sm:w-56 md:w-64 border-b-2 ${
                errors.documentTitle
                  ? 'border-solid border-brand-red'
                  : 'border-dotted border-primary/70 group-focus-within/title:border-solid group-focus-within/title:border-primary'
              } mt-0.5 transition-all`}
            />
            {errors.documentTitle && (
              <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1">
                <i className="fa-solid fa-circle-exclamation text-[10px] shrink-0 text-brand-red" />
                <span>{errors.documentTitle}</span>
              </span>
            )}
          </div>

          {/* Desktop Right: Watermark Toggle */}
          <div className="hidden sm:flex items-center">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.watermark || 'Watermark'}
              checked={watermark}
              onChange={setWatermark}
              disabled={readOnly}
            />
          </div>

          {/* Mobile Bottom Row: Letterhead on left, Watermark on right */}
          <div className="flex sm:hidden items-center justify-between w-full pt-1.5 border-t border-border">
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.letterhead || 'Letterhead'}
              checked={letterhead}
              onChange={setLetterhead}
              disabled={readOnly}
            />
            <DocToggle
              label={dict?.smart_docs?.confirmation_form?.watermark || 'Watermark'}
              checked={watermark}
              onChange={setWatermark}
              disabled={readOnly}
            />
          </div>
        </div>

        {/* 
          DOCUMENT GRID / TABLE:
          100% matches Canva paper mockup with crisp 1px borders and blue dotted input blanks.
        */}
        <div className="w-full flex flex-col text-xs divide-y divide-border border-b border-border bg-card">
          
          {/* ROW 1: CONFIRMATION NUMBER | CONFIRMATION DATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Confirmation Number */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2.5" data-field="confirmationNumber">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5 pt-1.5">
                {dict?.smart_docs?.confirmation_form?.confirmation_number || 'CONFIRMATION NUMBER'} :
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <DocUnderlineInput
                  id="field-confirmationNumber"
                  value={confirmationNumber}
                  onChange={setConfirmationNumber}
                  disabled={readOnly}
                  placeholder={
                    dict?.smart_docs?.confirmation_form?.enter_confirmation_number ||
                    'Enter Confirmation Number'
                  }
                />
              </div>
            </div>

            {/* Confirmation Date */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2.5" data-field="confirmationDate">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5 pt-1.5">
                {dict?.smart_docs?.confirmation_form?.confirmation_date || 'CONFIRMATION DATE'} :
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <DocUnderlineInput
                  id="field-confirmationDate"
                  type="date"
                  value={confirmationDate}
                  onChange={setConfirmationDate}
                  icon="fa-regular fa-calendar"
                  disabled={readOnly}
                  placeholder={
                    dict?.smart_docs?.confirmation_form?.select_date || 'Select Date'
                  }
                />
              </div>
            </div>
          </div>

          {/* ROW 2: CONTRACT NUMBER | CONTRACT DATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Contract Number */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2.5" data-field="contractNumber">
              <label
                htmlFor="field-contractNumber"
                className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5 pt-1.5"
              >
                {dict?.smart_docs?.contract_form?.contract_number || 'CONTRACT NUMBER'}{' '}
                <span className="text-brand-red font-bold">*</span> :
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <DocUnderlineInput
                  ref={contractInputRef}
                  id="field-contractNumber"
                  value={contractNumber}
                  onChange={(val) => {
                    setContractNumber(val);
                    setErrors((prev) => ({ ...prev, contractNumber: '' }));
                  }}
                  error={errors.contractNumber}
                  icon="fa-solid fa-pen"
                  disabled={readOnly}
                  placeholder="Enter contract number"
                />
              </div>
            </div>

            {/* Contract Date */}
            <div className="py-2 px-2.5 sm:px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider shrink-0 px-0.5">
                {dict?.smart_docs?.contract_form?.contract_date || 'CONTRACT DATE'}
              </label>
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <DocUnderlineInput
                  id="field-contractDate"
                  type="date"
                  value={contractDate}
                  onChange={(val) => {
                    setContractDate(val);
                    setErrors((prev) => ({ ...prev, contractDate: '' }));
                  }}
                  error={errors.contractDate}
                  icon="fa-regular fa-calendar"
                  disabled={readOnly}
                  placeholder={
                    dict?.smart_docs?.contract_form?.select_date || 'Select Date'
                  }
                />
              </div>
            </div>
          </div>

          {/* ROW 3: THIS CONTRACT IS DRAWN BETWEEN FOLLOWING PARTIES */}
          <div className="py-2 px-2.5 sm:px-3 bg-muted/20 flex items-center justify-between gap-2" data-field="partiesHeader">
            <DocUnderlineInput
              id="field-partiesHeader"
              value={partiesHeader}
              onChange={setPartiesHeader}
              disabled={readOnly}
              icon="fa-solid fa-pen"
              placeholder="THIS CONTRACT IS DRAWN BETWEEN FOLLOWING PARTIES"
              className="w-full"
              inputClassName="font-extrabold text-foreground uppercase text-[11px] sm:text-xs tracking-wider text-center sm:text-left"
            />
          </div>

          {/* ROW 4: EXPORTER (SELLER) | IMPORTER (BUYER) */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Exporter (Seller) */}
            <div className="py-1.5 px-2.5 sm:px-3 flex flex-col gap-1.5" data-field="sellerId">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.exporter_seller || 'EXPORTER (SELLER)'} :
              </label>
              <DocUnderlineSelect
                id="field-sellerId"
                options={internalSellers}
                value={sellerId}
                onChange={handleSellerChange}
                placeholder="Select Seller"
                error={errors.sellerId}
                disabled={readOnly}
                searchable={true}
                showEditOption={!readOnly}
                onEditOption={(opt) => handleEditSeller(opt)}
                showAddNew={!readOnly}
                addNewLabel="Add Seller"
                onAddNew={handleAddNewSeller}
              />
              <DocUnderlineInput
                id="field-sellerInstruction"
                multiline
                rows={3}
                icon="fa-solid fa-pen"
                value={sellerInstruction}
                onChange={setSellerInstruction}
                placeholder="Company name, address, contact, email..."
                disabled={readOnly}
              />
            </div>

            {/* Importer (Buyer) */}
            <div className="py-1.5 px-2.5 sm:px-3 flex flex-col gap-1.5" data-field="buyerId">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.importer_buyer || 'IMPORTER (BUYER)'} :
              </label>
              <DocUnderlineSelect
                id="field-buyerId"
                options={internalBuyers}
                value={buyerId}
                onChange={handleBuyerChange}
                placeholder="Select Buyer"
                error={errors.buyerId}
                disabled={readOnly}
                searchable={true}
                showEditOption={!readOnly}
                onEditOption={(opt) => handleEditBuyer(opt)}
                showAddNew={!readOnly}
                addNewLabel="Add Buyer"
                onAddNew={handleAddNewBuyer}
              />
              <DocUnderlineInput
                id="field-buyerInstruction"
                multiline
                rows={3}
                icon="fa-solid fa-pen"
                value={buyerInstruction}
                onChange={setBuyerInstruction}
                placeholder="Company name, address, contact, email..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 5: SHIPPING INSTRUCTION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="shippingInstruction">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center min-w-0">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                SHIPPING INSTRUCTION :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center min-w-0">
              <DocUnderlineInput
                id="field-shippingInstruction"
                value={shippingInstruction}
                onChange={setShippingInstruction}
                icon="fa-solid fa-pen"
                placeholder="TO BE ADVICE"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 6: PRODUCT | HSN CODE | COUNTRY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="productId">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center min-w-0">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.product || 'PRODUCT'} :
              </label>
            </div>
            <div className="md:col-span-5 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center min-w-0">
              <DocUnderlineSelect
                id="field-productId"
                options={internalProducts}
                value={productId}
                onChange={handleProductChange}
                placeholder="Select Product"
                searchable={true}
                error={errors.productId}
                disabled={readOnly}
                showEditOption={!readOnly}
                onEditOption={(opt) => handleEditProduct(opt)}
                showAddNew={!readOnly}
                addNewLabel="Add Product"
                onAddNew={handleAddNewProduct}
              />
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-t border-border md:border-t-0 md:col-span-4 md:grid-cols-2 md:divide-x">
              <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col justify-center min-w-0 overflow-hidden" data-field="hsnCode">
                <span className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wider leading-tight">
                  HSN CODE :
                </span>
                <span className="text-[13px] font-semibold text-foreground truncate min-w-0 mt-0.5 leading-snug">
                  {isLoadingProductDetails ? 'Loading...' : hsnCode || '-'}
                </span>
              </div>
              <div className="py-1 px-2.5 sm:py-1.5 sm:px-3 flex flex-col justify-center min-w-0 overflow-hidden" data-field="productCountry">
                <span className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wider leading-tight">
                  COUNTRY :
                </span>
                <span className="text-[13px] font-semibold text-foreground uppercase truncate min-w-0 mt-0.5 leading-snug">
                  {isLoadingProductDetails ? 'Loading...' : productCountry || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* ROW 7: SPECIFICATION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="specification">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-start pt-2 sm:pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.specification || 'SPECIFICATION'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3">
              <DocUnderlineInput
                id="field-specification"
                multiline
                rows={2}
                value={specification}
                onChange={setSpecification}
                icon="fa-solid fa-pen"
                placeholder={dict?.smart_docs?.confirmation_form?.enter_specification || 'Enter Specification'}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 8: SHIPMENT PERIOD */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="shipmentPeriod">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.shipment_period || 'SHIPMENT PERIOD'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DateRangePicker
                variant="underline"
                startDate={shipmentRange.start}
                endDate={shipmentRange.end}
                onChange={(start, end) => {
                  setShipmentRange({ start, end });
                }}
                formatString="dd/MM/yyyy"
                placeholder="Select Shipment Period"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 9: PAYMENT TERM */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="paymentTerm">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.payment_term || 'PAYMENT TERM'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-contract-paymentTerm"
                options={internalPaymentTerms}
                value={paymentTerm}
                onChange={setPaymentTerm}
                placeholder="Select Payment Term"
                searchable={true}
                disabled={readOnly}
                showEditOption={!readOnly}
                onEditOption={(opt) => handleEditPaymentTerm(opt)}
                showAddNew={!readOnly}
                addNewLabel="Add Payment Term"
                onAddNew={handleAddNewPaymentTerm}
              />
            </div>
          </div>

          {/* ROW 10: FCL TYPE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="fclType">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                FCL TYPE :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-fclType"
                options={DEFAULT_FCL_TYPES}
                value={fclType}
                onChange={setFclType}
                placeholder="Select FCL Type"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 11: PACKING */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="packing">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                {dict?.smart_docs?.confirmation_form?.packing || 'PACKING'} :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-packing"
                options={internalPackingOptions}
                value={packing}
                onChange={setPacking}
                placeholder="Select Packing"
                searchable={true}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 12: MARKING BRAND */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="markingBrand">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                MARKING BRAND :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                id="field-markingBrand"
                value={markingBrand}
                onChange={setMarkingBrand}
                icon="fa-solid fa-pen"
                placeholder="Enter marking brand"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 13: LOADING PORT & COUNTRY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="loadingPort">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                LOADING PORT &amp; COUNTRY :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-loadingPort"
                options={internalLoadingPorts}
                value={loadingPort}
                onChange={setLoadingPort}
                placeholder="Select Loading Port & Country"
                searchable={true}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 14: LOADING CONDITION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="loadingCondition">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                LOADING CONDITION :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-loadingCondition"
                options={DEFAULT_LOADING_CONDITIONS}
                value={loadingCondition}
                onChange={setLoadingCondition}
                placeholder="Select Loading Condition"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 15: DESTINATION PORT & COUNTRY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="destinationPort">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                DESTINATION PORT &amp; COUNTRY :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-destinationPort"
                options={internalDestinationPorts}
                value={destinationPort}
                onChange={setDestinationPort}
                placeholder="Select Destination Port & Country"
                searchable={true}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 16: QUANTITIES & PRICING TABLE MATRIX (Image 2) */}
          {isFcl ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border-collapse text-center">
              {/* FCL QTY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  FCL QTY
                </span>
                <div className="w-full max-w-[90px]">
                  <DocUnderlineInput
                    id="field-contract-fclQty"
                    type="number"
                    value={fclQty}
                    onChange={(val) => {
                      setFclQty(val);
                      setErrors((prev) => ({ ...prev, fclQty: '' }));
                    }}
                    error={errors.fclQty}
                    icon="fa-solid fa-pen"
                    placeholder="0"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* FCL CAPACITY */}
              <div className="p-1.5 sm:p-2 border-b sm:border-r sm:border-b lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  FCL CAPACITY
                </span>
                <div className="w-full max-w-[90px]">
                  <DocUnderlineInput
                    id="field-contract-fclCapacity"
                    type="number"
                    value={fclCapacity}
                    onChange={(val) => {
                      setFclCapacity(val);
                      setErrors((prev) => ({ ...prev, fclCapacity: '' }));
                    }}
                    error={errors.fclCapacity}
                    icon="fa-solid fa-pen"
                    placeholder="0"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* MT QTY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  MT QTY
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">{mtQty || '-'}</span>
              </div>

              {/* BAG QTY */}
              <div className="p-1.5 sm:p-2 border-b sm:border-b lg:border-r lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  BAG QTY
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">{bagQty || '-'}</span>
              </div>

              {/* CURRENCY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-r sm:border-b-0 lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  CURRENCY
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineSelect
                    id="field-contract-currency"
                    options={internalCurrencies}
                    value={currency}
                    onChange={setCurrency}
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* PRICE */}
              <div className="p-1.5 sm:p-2 border-b sm:border-r sm:border-b-0 lg:border-r lg:border-b-0 border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  PRICE ({currency || '$'})
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineInput
                    id="field-contract-price"
                    type="number"
                    value={price}
                    onChange={(val) => {
                      setPrice(val);
                      setErrors((prev) => ({ ...prev, price: '' }));
                    }}
                    error={errors.price}
                    icon="fa-solid fa-pen"
                    placeholder="0.00"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* TOTAL VALUE */}
              <div className="p-1.5 sm:p-2 col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  TOTAL VALUE ({currency || '$'})
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">
                  {formatNumberWithCommas(totalValue)}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 border-collapse text-center">
              {/* MT QTY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  MT QTY
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineInput
                    id="field-contract-mtQty"
                    type="number"
                    value={mtQty}
                    onChange={(val) => {
                      setMtQty(val);
                      setErrors((prev) => ({ ...prev, mtQty: '' }));
                    }}
                    error={errors.mtQty}
                    icon="fa-solid fa-pen"
                    placeholder="0.00"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* BAG QTY */}
              <div className="p-1.5 sm:p-2 border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  BAG QTY
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">{bagQty || '-'}</span>
              </div>

              {/* CURRENCY */}
              <div className="p-1.5 sm:p-2 border-r border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  CURRENCY
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineSelect
                    id="field-contract-currency"
                    options={internalCurrencies}
                    value={currency}
                    onChange={setCurrency}
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* PRICE */}
              <div className="p-1.5 sm:p-2 border-b sm:border-b-0 sm:border-r border-border flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  PRICE ({currency || '$'})
                </span>
                <div className="w-full max-w-[100px]">
                  <DocUnderlineInput
                    id="field-contract-price"
                    type="number"
                    value={price}
                    onChange={(val) => {
                      setPrice(val);
                      setErrors((prev) => ({ ...prev, price: '' }));
                    }}
                    error={errors.price}
                    icon="fa-solid fa-pen"
                    placeholder="0.00"
                    align="center"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* TOTAL VALUE */}
              <div className="p-1.5 sm:p-2 col-span-2 sm:col-span-1 flex flex-col items-center justify-center">
                <span className="block font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide mb-1 px-0.5">
                  TOTAL VALUE ({currency || '$'})
                </span>
                <span className="text-[13px] font-bold text-foreground py-0.5">
                  {formatNumberWithCommas(totalValue)}
                </span>
              </div>
            </div>
          )}

          {/* ROW 17: INSPECTION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="inspection">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                INSPECTION :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                id="field-inspection"
                value={inspection}
                onChange={setInspection}
                icon="fa-solid fa-pen"
                placeholder="Enter inspection"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 18: INCOTERM */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="incoterm">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                INCOTERM :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineSelect
                id="field-incoterm"
                options={shippingTerms || DEFAULT_SHIPPING_TERMS}
                value={incoterm}
                onChange={(val) => {
                  setIncoterm(val);
                }}
                placeholder="Select Incoterm"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 19: INSURANCE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="insurance">
            <div className="md:col-span-3 py-1.5 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                INSURANCE :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center min-h-[38px]">
              <span
                id="field-insurance"
                className="text-xs sm:text-sm font-semibold text-foreground tracking-wide px-0.5"
              >
                {insurance || '—'}
              </span>
            </div>
          </div>

          {/* ROW 20: PARTIAL */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="partial">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                PARTIAL :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3 flex flex-col gap-2.5 justify-center">
              {/* Controls Row: Toggle, Count & Arrow */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <DocSegmentedToggle
                  id="toggle-partial"
                  value={isPartialAllowed}
                  onChange={(val) => {
                    setIsPartialAllowed(val);
                    if (!val) {
                      setErrors((prev) => ({ ...prev, partialCount: '', partialTotal: '' }));
                    }
                  }}
                  trueLabel="ALLOWED"
                  falseLabel="NOT ALLOWED"
                  disabled={readOnly}
                />

                {isPartialAllowed && (
                  <div className="flex items-center gap-2 pl-2 sm:border-l border-border/70">
                    <label
                      htmlFor="field-partial-count"
                      className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider whitespace-nowrap"
                    >
                      Partial Count:
                    </label>
                    <div className="w-[48px] sm:w-[56px]">
                      <input
                        id="field-partial-count"
                        type="number"
                        min={1}
                        max={500}
                        value={partialCount}
                        onChange={(e) => handlePartialCountChange(e.target.value)}
                        placeholder="0"
                        disabled={readOnly}
                        className={`w-full text-center text-xs sm:text-sm font-bold text-foreground bg-transparent border-b-2 border-dotted ${
                          errors.partialCount
                            ? 'border-solid border-brand-red'
                            : 'border-primary/70 dark:border-primary/80 focus:border-solid focus:border-primary'
                        } focus:outline-none transition-colors py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-muted-foreground/40 disabled:cursor-not-allowed`}
                      />
                    </div>
                    {/* Right Arrow */}
                    <i className="fa-solid fa-arrow-right text-muted-foreground/60 text-xs sm:text-sm ml-0.5 shrink-0" />
                  </div>
                )}
              </div>

              {/* Partials Grid with + signs and = Total Card */}
              {isPartialAllowed && partialQuantities.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-2.5 w-full">
                    {/* Render all partial input cards */}
                    {partialQuantities.map((val, index) => {
                      const label = getPartialLabel(index);
                      const isLastPartial = index === partialQuantities.length - 1;
                      return (
                        <div key={label} className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
                          {/* Stacked Card: Label on top, centered input with dotted underline below */}
                          <div className="flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-2.5 rounded-lg border border-border/80 bg-card hover:border-primary/50 transition-all shadow-2xs group focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 min-h-[58px]">
                            <label
                              htmlFor={`field-partial-${label}`}
                              className="font-bold text-muted-foreground/85 uppercase text-[10px] sm:text-[11px] tracking-wide select-none whitespace-nowrap cursor-pointer text-center"
                            >
                              Partial {label}
                            </label>
                            <div className="w-[52px] sm:w-[60px] mx-auto mt-1">
                              <input
                                id={`field-partial-${label}`}
                                type="number"
                                min={0}
                                value={val}
                                onChange={(e) => handlePartialQtyChange(index, e.target.value)}
                                placeholder="0"
                                disabled={readOnly}
                                className="w-full text-center text-xs sm:text-sm font-bold text-foreground bg-transparent border-b-2 border-dotted border-primary/70 dark:border-primary/80 focus:border-solid focus:border-primary focus:outline-none transition-colors py-0.5 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-muted-foreground/40 disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>

                          {/* Operator: + between inputs, = after the last input */}
                          <span className="font-bold text-muted-foreground/70 select-none text-sm shrink-0 w-3 text-center">
                            {isLastPartial ? '=' : '+'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Total Card: Stacked, same exact dimensions & style, read-only answer value, no dotted line, no icons, theme brand colors */}
                    <div className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
                      <div
                        className={`flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-2.5 rounded-lg border transition-all shadow-2xs min-h-[58px] ${
                          isPartialMatch
                            ? 'border-brand-green/60 bg-brand-green/10 text-brand-green'
                            : 'border-brand-red/60 bg-brand-red/10 text-brand-red'
                        }`}
                        title={
                          isPartialMatch
                            ? `Total (${partialSum}) matched with FCL Quantity (${targetFclQty})`
                            : targetFclQty > 0
                            ? `Total (${partialSum}) does not match FCL Quantity (${targetFclQty})`
                            : `Total: ${partialSum}`
                        }
                      >
                        <span className="font-bold uppercase text-[10px] sm:text-[11px] tracking-wide select-none whitespace-nowrap text-center">
                          Total
                        </span>
                        <div className="w-[52px] sm:w-[60px] mx-auto mt-1 text-center">
                          <span className="block w-full text-center font-extrabold text-xs sm:text-sm font-mono truncate">
                            {partialSum}
                          </span>
                        </div>
                      </div>

                      {/* Spacer to match operator width for 100% column alignment */}
                      <span className="w-3 shrink-0" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              )}

              {/* Red Client-side Validation Error */}
              {errors.partialTotal && (
                <div className="w-full text-[11px] text-brand-red font-semibold px-0.5 tracking-tight flex items-center gap-1.5 mt-0.5">
                  <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
                  <span>{errors.partialTotal}</span>
                </div>
              )}
            </div>
          </div>

          {/* ROW 21: TRANSHIPMENT */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="transhipment">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                TRANSHIPMENT :
              </label>
            </div>
            <div className="md:col-span-9 py-1.5 px-2.5 sm:px-3 flex items-center">
              <DocSegmentedToggle
                id="toggle-transhipment"
                value={isTranshipmentAllowed}
                onChange={setIsTranshipmentAllowed}
                trueLabel="ALLOWED"
                falseLabel="NOT ALLOWED"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 22: TRANSIT CLAUSE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="transitClause">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                TRANSIT CLAUSE :
              </label>
            </div>
            <div className="md:col-span-9 py-1.5 px-2.5 sm:px-3 flex items-center">
              <DocSegmentedToggle
                id="toggle-transitClause"
                value={isTransitClauseAllowed}
                onChange={setIsTransitClauseAllowed}
                trueLabel="ALLOWED"
                falseLabel="NOT ALLOWED"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 23: ADVANCE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="advance">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                ADVANCE :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3 flex flex-wrap items-center gap-2 sm:gap-2.5">
              <DocSegmentedToggle
                id="toggle-advance"
                value={hasAdvance}
                onChange={(val) => {
                  setHasAdvance(val);
                  if (val && !advanceType) {
                    setAdvanceType('amount');
                  }
                }}
                trueLabel="YES"
                falseLabel="NO"
                disabled={readOnly}
              />

              {hasAdvance && (
                <>
                  <div className="pl-2 border-l border-border/70 flex items-center">
                    <DocSegmentedToggle
                      id="toggle-advance-type"
                      value={advanceType}
                      onChange={(val: 'amount' | '%') => setAdvanceType(val)}
                      options={DEFAULT_ADVANCE_TYPE_OPTIONS}
                      disabled={readOnly}
                    />
                  </div>

                  {advanceType === 'amount' ? (
                    <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
                      <label
                        htmlFor="field-advance-amount"
                        className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider whitespace-nowrap"
                      >
                        Advance ({currency || '$'}):
                      </label>
                      <div className="w-[100px] sm:w-[120px]">
                        <DocUnderlineInput
                          id="field-advance-amount"
                          type="number"
                          min={0}
                          value={advanceAmount}
                          onChange={(val) => {
                            setAdvanceAmount(val);
                            setErrors((prev) => ({ ...prev, advanceAmount: '' }));
                          }}
                          placeholder="0.00"
                          align="center"
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
                        <label
                          htmlFor="field-advance-percent"
                          className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider whitespace-nowrap"
                        >
                          Advance (%):
                        </label>
                        <div className="w-[60px] sm:w-[70px]">
                          <DocUnderlineInput
                            id="field-advance-percent"
                            type="number"
                            min={0}
                            max={100}
                            value={advancePercentage}
                            onChange={(val) => {
                              setAdvancePercentage(val);
                              setErrors((prev) => ({ ...prev, advancePercentage: '' }));
                            }}
                            placeholder="0%"
                            align="center"
                            disabled={readOnly}
                          />
                        </div>
                      </div>

                      {/* Calculated Amount */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
                        <span className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider whitespace-nowrap">
                          Amount ({currency || '$'}):
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-foreground py-0.5">
                          {calculatedAdvanceAmount ? formatNumberWithCommas(calculatedAdvanceAmount) : '-'}
                        </span>
                        {calculatedAdvanceMt && (
                          <span className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold whitespace-nowrap">
                            (~{calculatedAdvanceMt} MT)
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ROW 24: SALES BROKER */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="salesBroker">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                SALES BROKER :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3 flex flex-wrap items-center gap-2 sm:gap-2.5">
              <DocSegmentedToggle
                id="toggle-salesBroker"
                value={isSalesBrokerAllowed}
                onChange={(val) => {
                  setIsSalesBrokerAllowed(val);
                  if (val && !brokerCommissionType) {
                    setBrokerCommissionType('PMT');
                  }
                }}
                trueLabel="ALLOWED"
                falseLabel="NOT ALLOWED"
                disabled={readOnly}
              />

              {isSalesBrokerAllowed && (
                <>
                  {/* Commission Type Segmented Toggle: % or PMT (default PMT) */}
                  <div className="pl-2 border-l border-border/70 flex items-center">
                    <DocSegmentedToggle
                      id="toggle-broker-commission-type"
                      value={brokerCommissionType}
                      onChange={(val: '%' | 'PMT') => setBrokerCommissionType(val)}
                      options={DEFAULT_BROKER_COMMISSION_TYPE_OPTIONS}
                      disabled={readOnly}
                    />
                  </div>

                  {/* Commission Rate Number Input */}
                  <div className="pl-2 border-l border-border/70 flex items-center">
                    <div className="w-[125px] sm:w-[135px]">
                      <DocUnderlineInput
                        id="field-broker-commission"
                        type="number"
                        min={0}
                        step="any"
                        value={brokerCommission}
                        onChange={(val) => {
                          setBrokerCommission(val);
                        }}
                        placeholder={
                          brokerCommissionType === '%'
                            ? 'Commission (%)'
                            : (currency && currency !== '$' ? `Commission (${currency})` : 'Commission ($)')
                        }
                        align="center"
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* Broker Commission Calculated Amount Display */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-border/70">
                    <span className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider whitespace-nowrap">
                      Broker Commission:
                    </span>
                    <div className="min-w-[80px] px-2 py-0.5 border-b-2 border-dotted border-primary/50 text-center text-xs sm:text-sm font-bold text-foreground whitespace-nowrap">
                      {calculatedBrokerCommission
                        ? `${currency || '$'} ${formatNumberWithCommas(calculatedBrokerCommission)}`
                        : '-'}
                    </div>
                  </div>

                  {/* Broker Name Text Input */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-border/70 flex-1 min-w-[240px]">
                    <label
                      htmlFor="field-broker-name"
                      className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider whitespace-nowrap"
                    >
                      Broker Name:
                    </label>
                    <div className="flex-1 min-w-[160px]">
                      <DocUnderlineInput
                        id="field-broker-name"
                        value={brokerName}
                        onChange={setBrokerName}
                        placeholder="Broker Name"
                        icon="fa-solid fa-pen"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ROW 25: ADDITIONAL DETAILS */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="additionalDetails">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                ADDITIONAL DETAILS :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3 flex flex-col gap-2">
              <DocUnderlineInput
                id="field-freeDays"
                value={freeDays}
                onChange={setFreeDays}
                icon="fa-solid fa-pen"
                placeholder="Enter Free Days"
                disabled={readOnly}
              />
              <DocUnderlineInput
                id="field-emptyBags"
                value={emptyBags}
                onChange={setEmptyBags}
                icon="fa-solid fa-pen"
                placeholder="Enter Empty Bags"
                disabled={readOnly}
              />
              <DocUnderlineInput
                id="field-additionalComment"
                value={additionalComment}
                onChange={setAdditionalComment}
                icon="fa-solid fa-pen"
                placeholder="Enter Comment"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 26: OTHER TERMS */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="otherTermsPayment">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                OTHER TERMS :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-otherTermsPayment"
                value={otherTermsPayment}
                onChange={setOtherTermsPayment}
                placeholder="Payment terms, bank charges instructions..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 27: DOCUMENTS */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="documents">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                DOCUMENTS :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocDocumentMultiSelect
                value={selectedDocuments}
                onChange={setSelectedDocuments}
                disabled={readOnly}
                placeholder="Select Documents"
              />
            </div>
          </div>

          {/* ROW 28: SHIPPING LINE */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="shippingLine">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                SHIPPING LINE :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                id="field-shippingLine"
                value={shippingLine}
                onChange={setShippingLine}
                icon="fa-solid fa-pen"
                placeholder="SHIPMENT IN CONTAINERS ( DO NOT USE NVOCC & IRANIAN SHIPPING LINE )"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 29: ARBITRATION */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="arbitration">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-center">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                ARBITRATION :
              </label>
            </div>
            <div className="md:col-span-9 py-1 px-2.5 sm:py-1.5 sm:px-3 flex items-center">
              <DocUnderlineInput
                id="field-arbitration"
                value={arbitration}
                onChange={setArbitration}
                icon="fa-solid fa-pen"
                placeholder="Enter Arbitration"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 30: OTHER TERMS */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="containerStandards">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                OTHER TERMS :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-containerStandards"
                value={containerStandards}
                onChange={setContainerStandards}
                placeholder="Special container terms, empty bags, silica gel, plastic sheets..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 31: FORCE MAJEUR */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="forceMajeur">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                FORCE MAJEUR :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-forceMajeur"
                value={forceMajeur}
                onChange={setForceMajeur}
                placeholder="Force majeure clauses..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 32: CONFIDENTIALITY */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="confidentiality">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                CONFIDENTIALITY :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-confidentiality"
                value={confidentiality}
                onChange={setConfidentiality}
                placeholder="Confidentiality and broker safety protection clause..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 33: NOTES */}
          <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x divide-border" data-field="notes">
            <div className="md:col-span-3 py-2 px-2.5 sm:px-3 flex items-start pt-2.5">
              <label className="font-bold text-muted-foreground/85 uppercase text-[11px] sm:text-xs tracking-wider px-0.5">
                NOTES :
              </label>
            </div>
            <div className="md:col-span-9 py-2 px-2.5 sm:px-3">
              <DocNotesEditor
                id="field-contract-notes"
                value={notes}
                onChange={setNotes}
                placeholder="Write your description..."
                disabled={readOnly}
              />
            </div>
          </div>

          {/* ROW 34: SIGNATURES - IMPORTER | BROKER (if allowed) | EXPORTER */}
          <div
            className={`grid grid-cols-1 ${
              isSalesBrokerAllowed ? 'md:grid-cols-3' : 'md:grid-cols-2'
            } divide-y md:divide-y-0 md:divide-x divide-border`}
          >
            <DocSignatureBox
              partyType="importer"
              title={importerTitle}
              onTitleChange={setImporterTitle}
              signatureUrl={importerSignature}
              onSignatureChange={setImporterSignature}
              authorityTitle={importerAuthorityTitle}
              onAuthorityTitleChange={setImporterAuthorityTitle}
              readOnly={readOnly}
            />
            {isSalesBrokerAllowed && (
              <DocSignatureBox
                partyType="broker"
                title={brokerTitle}
                onTitleChange={setBrokerTitle}
                signatureUrl={brokerSignature}
                onSignatureChange={setBrokerSignature}
                authorityTitle={brokerAuthorityTitle}
                onAuthorityTitleChange={setBrokerAuthorityTitle}
                readOnly={readOnly}
              />
            )}
            <DocSignatureBox
              partyType="exporter"
              title={exporterTitle}
              onTitleChange={setExporterTitle}
              signatureUrl={exporterSignature}
              onSignatureChange={setExporterSignature}
              authorityTitle={exporterAuthorityTitle}
              onAuthorityTitleChange={setExporterAuthorityTitle}
              readOnly={readOnly}
            />
          </div>

        </div>
      </div>

      {/* 
        BOTTOM ACTION BAR:
        Theme-compliant buttons matching AgriGuru brand system (exact match with confirmation).
        Sticky on mobile docked at viewport bottom, static on desktop at bottom of card.
      */}
      <div className="shrink-0 sticky bottom-0 lg:static border-t border-border bg-card/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 sm:gap-2.5 print:hidden z-30 shadow-md lg:shadow-none rounded-b-xl">
        {/* Left Action Buttons: Print Preview & Download PDF (Disabled for future implementation) */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          {/* Print Preview Button (Disabled) */}
          <button
            type="button"
            disabled
            title={dict?.smart_docs?.confirmation_form?.print_preview || 'Print Preview'}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 text-destructive opacity-60 cursor-not-allowed select-none shadow-xs transition-all"
          >
            <i className="fa-solid fa-print text-xs" />
            <span>{dict?.smart_docs?.confirmation_form?.print_preview || 'Print Preview'}</span>
          </button>

          {/* Download PDF Button (Disabled) */}
          <button
            type="button"
            disabled
            title={dict?.smart_docs?.confirmation_form?.download_pdf || 'Download PDF'}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold border border-destructive/30 bg-destructive/10 text-destructive opacity-60 cursor-not-allowed select-none shadow-xs transition-all"
          >
            <i className="fa-solid fa-file-pdf text-xs" />
            <span>{dict?.smart_docs?.confirmation_form?.download_pdf || 'Download PDF'}</span>
          </button>
        </div>

        {/* Right Action Buttons: Save As Draft & Submit To Proforma */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          {/* Save As Draft */}
          <button
            type="button"
            disabled={isSavingDraft || readOnly}
            onClick={handleSaveDraft}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-md text-xs font-semibold border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary active:scale-[0.98] transition-all duration-150 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {isSavingDraft ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
            ) : (
              <i className="fa-regular fa-floppy-disk text-xs" />
            )}
            <span className="truncate">
              {isSavingDraft
                ? 'Saving...'
                : dict?.smart_docs?.confirmation_form?.save_as_draft || 'Save As Draft'}
            </span>
          </button>

          {/* Submit To Proforma */}
          <button
            type="button"
            disabled={isSubmitting || readOnly}
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 group"
          >
            <span className="truncate">
              {isSubmitting ? 'Submitting...' : 'Submit To Proforma'}
            </span>
            {isSubmitting ? (
              <i className="fa-solid fa-circle-notch fa-spin text-xs" />
            ) : (
              <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Product Add / Edit Modal */}
      <ProductManageModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        mode={productModalMode}
        product={editingProduct}
        onSave={(savedProd) => {
          const formattedItem: FormOptionItem = {
            value: savedProd.id,
            label: savedProd.label,
            subLabel: savedProd.country ? `Origin Country: ${savedProd.country}` : undefined,
            hsn: savedProd.hsn,
            country: savedProd.country,
            spec: savedProd.spec,
          };
          setInternalProducts((prev) => {
            const idx = prev.findIndex(
              (p) => p.value === savedProd.id || p.label.toLowerCase() === savedProd.label.toLowerCase()
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...formattedItem };
              return next;
            }
            return [formattedItem, ...prev];
          });
          setProductId(savedProd.id);
          setHsnCode(savedProd.hsn);
          setProductCountry(savedProd.country);
          if (savedProd.spec) setSpecification(savedProd.spec);
          setIsProductModalOpen(false);
        }}
        dict={dict}
      />

      {/* Payment Term Add / Edit Modal */}
      <PaymentTermManageModal
        isOpen={isPaymentTermModalOpen}
        onClose={() => setIsPaymentTermModalOpen(false)}
        mode={paymentTermModalMode}
        paymentTerm={editingPaymentTerm}
        onSave={(savedTerm) => {
          const formattedItem: FormOptionItem = {
            value: savedTerm.id,
            label: savedTerm.label,
            subLabel: savedTerm.description || (savedTerm.days ? `${savedTerm.days} Days credit period` : undefined),
            badge: savedTerm.days ? `${savedTerm.days} Days` : undefined,
            days: savedTerm.days,
            description: savedTerm.description,
          };
          setInternalPaymentTerms((prev) => {
            const idx = prev.findIndex((p) => p.value === savedTerm.id || p.label.toLowerCase() === savedTerm.label.toLowerCase());
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...formattedItem };
              return next;
            }
            return [formattedItem, ...prev];
          });
          setPaymentTerm(savedTerm.id);
          setIsPaymentTermModalOpen(false);
        }}
        dict={dict}
      />

      {/* Party (Seller / Buyer) Add / Edit Modal */}
      <InstructionManageModal
        isOpen={isInstructionModalOpen}
        onClose={() => setIsInstructionModalOpen(false)}
        mode={instructionModalMode}
        partyType={instructionModalPartyType}
        party={editingParty}
        onSave={handleSaveInstruction}
        dict={dict}
      />
    </div>
  );
}

export default ContractDocumentForm;
