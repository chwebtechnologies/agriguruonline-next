"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadKycDocument } from "@/app/actions/profile";
import { getAssetsUrl } from '@/lib/api-utils';

type KycStatus = "Missing" | "Under Review" | "Approved" | "Rejected" | "Expired";

interface RequiredDocument {
  id: string;
  title: string;
  type: string;
  is_active: boolean;
}

interface UserDocument {
  id: string;
  document_type_id?: string;
  document_type_title?: string;
  file_url?: string;
  status: KycStatus;
  rejection_reason?: string;
}

interface KycSectionProps {
  profileData?: any;
  lang?: string;
  token?: string;
  initialKycDocs?: any[];
}

const mapStatus = (status: string): KycStatus => {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "EXPIRED":
      return "Expired";
    case "PENDING":
    default:
      return "Under Review";
  }
};

function parseKycData(apiDocs: any[]) {
  const mappedRequired: RequiredDocument[] = [];
  const mappedUploaded: UserDocument[] = [];

  apiDocs.forEach((item: any) => {
    const docTypeId = item.document_id;
    const docTitle = item.document_name || "Document";
    
    if (item.is_uploaded) {
      const assetsBaseUrl = getAssetsUrl();
      const fullUrl = item.url ? (item.url.startsWith('http') ? item.url : `${assetsBaseUrl}${item.url.startsWith('/') ? '' : '/'}${item.url}`) : null;
      
      mappedUploaded.push({
        id: item.user_document_id || Math.random().toString(36).substr(2, 9),
        document_type_id: docTypeId,
        document_type_title: docTitle,
        file_url: fullUrl,
        status: mapStatus(item.status),
        rejection_reason: item.reject_reason || null,
      });
    } else {
      mappedRequired.push({
        id: docTypeId,
        title: docTitle,
        type: "BUYER",
        is_active: true
      });
    }
  });

  return { mappedRequired, mappedUploaded };
}

export default function KycSection({ profileData, lang = "en", initialKycDocs = [] }: KycSectionProps) {
  const router = useRouter();
  
  const parsed = useMemo(() => parseKycData(initialKycDocs), [initialKycDocs]);

  const [requiredDocs, setRequiredDocs] = useState<RequiredDocument[]>(() => parsed.mappedRequired);
  const [userDocs, setUserDocs] = useState<UserDocument[]>(() => parsed.mappedUploaded);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string>(() => {
    const rejectedOrExpired = parsed.mappedUploaded.find(u => u.status === "Rejected" || u.status === "Expired");
    if (rejectedOrExpired?.document_type_id) return rejectedOrExpired.document_type_id;
    if (parsed.mappedRequired.length > 0) return parsed.mappedRequired[0].id;
    return "";
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedTypeIdRef = useRef<string>(selectedTypeId);
  const kycRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleAccordion = (e: any) => {
      if (e.detail !== 'kyc') setIsOpen(false);
    };
    window.addEventListener('profile-accordion', handleAccordion);
    return () => window.removeEventListener('profile-accordion', handleAccordion);
  }, []);

  const toggleKyc = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (newState) {
      window.dispatchEvent(new CustomEvent('profile-accordion', { detail: 'kyc' }));
      setTimeout(() => {
        if (kycRef.current) {
          const yOffset = -140;
          const y = kycRef.current.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 350);
    }
  };

  // Sync state if server revalidates initialKycDocs
  useEffect(() => {
    setRequiredDocs(parsed.mappedRequired);
    setUserDocs(parsed.mappedUploaded);
    
    const rejectedOrExpired = parsed.mappedUploaded.find(u => u.status === "Rejected" || u.status === "Expired");
    if (rejectedOrExpired?.document_type_id) {
      setSelectedTypeId(rejectedOrExpired.document_type_id);
      selectedTypeIdRef.current = rejectedOrExpired.document_type_id;
    } else if (parsed.mappedRequired.length > 0) {
      setSelectedTypeId(parsed.mappedRequired[0].id);
      selectedTypeIdRef.current = parsed.mappedRequired[0].id;
    } else {
      setSelectedTypeId("");
      selectedTypeIdRef.current = "";
    }
  }, [parsed]);

  const handleUploadClick = () => {
    if (!selectedTypeId) {
      toast.error("Please select a document type first.");
      return;
    }
    selectedTypeIdRef.current = selectedTypeId;
    fileInputRef.current?.click();
  };

  const handleReplaceClick = (docTypeId: string) => {
    setSelectedTypeId(docTypeId);
    selectedTypeIdRef.current = docTypeId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Basic validation
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size exceeds 5MB limit.");
        e.target.value = '';
        return;
      }
      
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Invalid file format. Please upload PDF, JPG, or PNG.");
        e.target.value = '';
        return;
      }

      setIsUploading(true);
      const uploadId = toast.loading("Uploading document...");

      try {
        const formData = new FormData();
        formData.append("document_id", selectedTypeIdRef.current);
        formData.append("file", file);

        const result = await uploadKycDocument(formData, lang);
        
        if (result.success) {
          toast.success(result.message || "Document uploaded successfully.", { id: uploadId });
          
          const uploadTypeId = selectedTypeIdRef.current;
          const reqDoc = requiredDocs.find(d => d.id === uploadTypeId);
          const usrDoc = userDocs.find(d => d.document_type_id === uploadTypeId);
          const docTitle = reqDoc?.title || usrDoc?.document_type_title || "Uploaded Document";
          
          const rawUrl = result.data?.file_url || result.data?.url || "";
          const assetsBaseUrl = getAssetsUrl();
          const fullUrl = rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `${assetsBaseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`) : file.name;

          const newDoc: UserDocument = {
            id: result.data?.id || Math.random().toString(36).substr(2, 9),
            document_type_id: uploadTypeId,
            document_type_title: docTitle,
            file_url: fullUrl,
            status: "Under Review"
          };

          setUserDocs(prev => {
            const filtered = prev.filter(d => d.document_type_id !== uploadTypeId);
            return [...filtered, newDoc];
          });
          
          setSelectedTypeId("");
          selectedTypeIdRef.current = "";
          router.refresh();
        } else {
          toast.error(result.error || "Failed to upload document.", { id: uploadId });
        }
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(err.message || "An error occurred while uploading.", { id: uploadId });
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    }
  };

  const getStatusBadge = (status: KycStatus) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-xs font-semibold shrink-0">Approved</span>;
      case "under review":
      case "processing":
      case "pending":
        return <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded text-xs font-semibold shrink-0">Under Review</span>;
      case "rejected":
        return <span className="px-2 py-0.5 bg-red-500/10 text-red-600 rounded text-xs font-semibold shrink-0">Rejected</span>;
      case "expired":
        return <span className="px-2 py-0.5 bg-gray-500/10 text-gray-600 rounded text-xs font-semibold shrink-0">Expired</span>;
      default:
        return <span className="px-2 py-0.5 bg-foreground/5 text-foreground/50 rounded text-xs font-semibold shrink-0">Missing</span>;
    }
  };

  // A document is considered "Active" if it's uploaded and not rejected/expired
  const hasActiveUpload = userDocs.some(ud => {
    const status = ud.status?.toLowerCase();
    return status !== "rejected" && status !== "expired";
  });

  const isActionRequired = !hasActiveUpload;

  // For the dropdown, show missing docs only if action is still required
  const uploadableDocs = isActionRequired ? requiredDocs : [];

  // Dropdown options should include required docs + all uploaded docs (if any)
  const dropdownOptions = [...requiredDocs];
  userDocs.forEach(uploadedDoc => {
    if (uploadedDoc.document_type_id && !dropdownOptions.some(d => d.id === uploadedDoc.document_type_id)) {
      dropdownOptions.push({
        id: uploadedDoc.document_type_id,
        title: uploadedDoc.document_type_title || "Document",
        type: "BUYER",
        is_active: true
      });
    }
  });

  const activeDoc = userDocs.find(ud => {
    const status = ud.status?.toLowerCase();
    return status !== "rejected" && status !== "expired";
  }) || userDocs[0] || null;

  const currentSelectedId = hasActiveUpload ? (activeDoc?.document_type_id || "") : selectedTypeId;
  const currentUploadedDoc = userDocs.find(ud => ud.document_type_id === currentSelectedId);

  const statusLower = currentUploadedDoc?.status?.toLowerCase();
  const isUnderReview = statusLower === 'under review' || statusLower === 'processing' || statusLower === 'pending';
  const isApproved = statusLower === 'approved';
  const isRejected = statusLower === 'rejected';
  const isExpired = statusLower === 'expired';

  return (
    <div ref={kycRef} className="group bg-background border border-foreground/10 rounded-xl shadow-sm flex flex-col">
      <div onClick={toggleKyc} className="px-4 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between gap-3 bg-foreground/[0.02] cursor-pointer lg:pointer-events-none list-none rounded-xl lg:rounded-b-none lg:border-b lg:border-foreground/5 transition-colors select-none">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
            <i className="fa-solid fa-shield-halved text-[14px] sm:text-base"></i>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight">KYC Verification</h2>
              <div className="flex lg:hidden">
                {getStatusBadge(currentUploadedDoc?.status || "Missing")}
              </div>
            </div>
            <p className="text-sm text-foreground/80 hidden sm:block mt-0.5">Manage your identity documents.</p>
          </div>
        </div>
        <i className={`fa-solid fa-chevron-down lg:!hidden transition-transform duration-300 text-foreground/50 ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>
      
      <div className={`${isOpen ? 'flex' : 'hidden'} lg:!flex flex-col gap-5 p-5 sm:p-6 animate-in slide-in-from-top-2 duration-300`}>
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <i className="fa-solid fa-circle-notch fa-spin text-brand-blue text-2xl"></i>
            <p className="text-sm text-foreground/50 font-medium">Loading documents...</p>
          </div>
        )}

        {!isLoading && (
          <div className="flex flex-col gap-3">
            {/* Document Type Dropdown (Locked if active document is uploaded) */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="kyc-doc-type-select" className="text-sm font-medium text-foreground">Select Document Type <span className="text-red-500">*</span></label>
              <div className="relative">
                <select 
                  id="kyc-doc-type-select"
                  aria-label="Select Document Type"
                  value={currentSelectedId}
                  disabled={hasActiveUpload}
                  onChange={(e) => {
                    setSelectedTypeId(e.target.value);
                    selectedTypeIdRef.current = e.target.value;
                  }}
                  className="w-full px-3.5 py-2.5 bg-background border border-foreground/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue transition-all appearance-none text-sm font-medium text-foreground disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-foreground/[0.02]"
                >
                  <option value="" disabled>-- Select a document --</option>
                  {dropdownOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.title}</option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/40 text-xs pointer-events-none"></i>
              </div>
            </div>

            {/* Dropzone Area */}
            {isUploading ? (
              /* Uploading Loader State inside Dropzone */
              <div className="w-full py-6 px-4 bg-foreground/[0.02] border-2 border-brand-blue/20 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 mt-2 select-none pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                  <i className="fa-solid fa-circle-notch fa-spin text-xl"></i>
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-sm text-foreground">Uploading File...</h3>
                  <p className="text-xs text-foreground/45 mt-0.5 font-medium">Please wait while the file is being transferred.</p>
                </div>
                {/* Horizontal loader animation */}
                <div className="w-full max-w-[240px] h-1.5 bg-foreground/5 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-brand-blue rounded-full w-full animate-pulse"></div>
                </div>
              </div>
            ) : currentUploadedDoc ? (
              /* Already Uploaded State */
              <div className="flex flex-col gap-3.5">
                <div 
                  className={`w-full p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3.5 transition-colors mt-2 ${
                    isUnderReview ? 'border-orange-500/30 bg-orange-500/[0.01]' :
                    isApproved ? 'border-green-500/30 bg-green-500/[0.01]' :
                    isRejected ? 'border-red-500/30 bg-red-500/[0.01]' :
                    'border-foreground/15 bg-foreground/[0.01]'
                  }`}
                >
                  {/* Clickable Area for View */}
                  <div 
                    onClick={() => currentUploadedDoc.file_url && window.open(currentUploadedDoc.file_url, '_blank')}
                    className="flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity text-center w-full"
                    title="Click to view document"
                  >
                    {/* Big File Icon */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      isUnderReview ? 'bg-orange-500/10 text-orange-500' :
                      isApproved ? 'bg-green-500/10 text-green-500' :
                      isRejected ? 'bg-red-500/10 text-red-500' :
                      'bg-foreground/5 text-foreground/50'
                    }`}>
                      <i className={`fa-solid fa-file-pdf text-2xl ${isUnderReview ? 'animate-pulse' : ''}`}></i>
                    </div>

                    <div className="flex flex-col items-center gap-1 max-w-full px-4">
                      <span className="text-base font-extrabold text-foreground">
                        {currentUploadedDoc.document_type_title}
                      </span>
                      {currentUploadedDoc.file_url && (
                        <span className="text-xs text-foreground/45 truncate max-w-[280px] font-medium" title={currentUploadedDoc.file_url}>
                          {currentUploadedDoc.file_url.split('/').pop()}
                        </span>
                      )}
                    </div>

                    {/* Status Badge & View Action */}
                    <div className="flex items-center gap-2.5 mt-0.5 justify-center">
                      {isUnderReview ? (
                        <span className="px-2.5 py-1 bg-orange-500/10 text-orange-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-orange-500/20">
                          <i className="fa-solid fa-circle-notch fa-spin text-[10px] mr-1"></i>
                          Under Review
                        </span>
                      ) : isApproved ? (
                        <span className="px-2.5 py-1 bg-green-500/10 text-green-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
                          <i className="fa-solid fa-circle-check mr-1"></i>
                          Approved
                        </span>
                      ) : isRejected ? (
                        <span className="px-2.5 py-1 bg-red-500/10 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-red-500/20">
                          <i className="fa-solid fa-circle-xmark mr-1"></i>
                          Rejected
                        </span>
                      ) : isExpired ? (
                        <span className="px-2.5 py-1 bg-gray-500/10 text-gray-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-gray-500/20">
                          <i className="fa-solid fa-clock-rotate-left mr-1"></i>
                          Expired
                        </span>
                      ) : null}
                      
                      <span className="text-[10px] text-brand-blue hover:underline font-bold flex items-center gap-1">
                        <i className="fa-solid fa-eye text-[9px]"></i> View File
                      </span>
                    </div>
                  </div>

                  {/* Replace Button */}
                  {!isApproved && (
                    <button 
                      type="button" 
                      onClick={() => handleReplaceClick(currentUploadedDoc.document_type_id!)}
                      className="mt-1 px-4.5 py-2 bg-foreground/5 hover:bg-foreground/10 text-foreground text-xs font-bold rounded-xl border border-foreground/10 transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <i className="fa-solid fa-arrow-rotate-right text-[10px]"></i> Replace File
                    </button>
                  )}
                </div>

                {isRejected && currentUploadedDoc.rejection_reason && (
                  <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-sm flex items-start gap-2.5">
                    <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-red-500"></i>
                    <div>
                      <p className="font-semibold mb-0.5 text-red-700 dark:text-red-400">Action Required</p>
                      <p className="text-red-600/90 dark:text-red-300/90">{currentUploadedDoc.rejection_reason}</p>
                    </div>
                  </div>
                )}

                {isExpired && (
                  <div className="p-3.5 rounded-xl border border-gray-500/20 bg-gray-500/5 text-sm flex items-start gap-2.5">
                    <i className="fa-solid fa-clock-rotate-left mt-0.5 shrink-0 text-gray-500"></i>
                    <div>
                      <p className="font-semibold mb-0.5 text-gray-700 dark:text-gray-300">Document Expired</p>
                      <p className="text-gray-600/90 dark:text-gray-400/90">{currentUploadedDoc.rejection_reason}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Upload State */
              <div className="flex flex-col gap-3">
                {dropdownOptions.length > 0 ? (
                  <>
                    <button 
                      type="button"
                      onClick={handleUploadClick}
                      className="w-full py-5 px-4 bg-foreground/[0.02] hover:bg-foreground/[0.05] border-2 border-foreground/15 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors mt-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 group/upload"
                    >
                      <div className="w-10 h-10 rounded-full bg-foreground/5 group-hover/upload:bg-brand-blue/10 flex items-center justify-center transition-colors mb-1">
                        <i className="fa-solid fa-arrow-up-from-bracket text-foreground/40 group-hover/upload:text-brand-blue text-lg transition-colors"></i>
                      </div>
                      <span className="text-sm font-bold text-foreground/80 group-hover/upload:text-foreground transition-colors">Click to upload document</span>
                      <span className="text-xs text-foreground/40 font-medium">PDF, JPG or PNG (Max 5MB)</span>
                    </button>
                  </>
                ) : (
                  <div className="text-center py-10 bg-foreground/[0.02] rounded-xl border border-foreground/5 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/30">
                      <i className="fa-solid fa-check-double text-xl"></i>
                    </div>
                    <p className="text-foreground/80 text-sm font-medium">No required documents found.</p>
                  </div>
                )}
              </div>
            )}

            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png"
            />
          </div>
        )}
      </div>
    </div>
  );
}
