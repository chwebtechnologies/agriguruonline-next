"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";

type KycStatus = "Missing" | "Processing" | "Approved" | "Rejected" | "Expired";

interface KycData {
  status: KycStatus;
  docType?: string;
  uploadedFile?: string;
  rejectionReason?: string;
}

const DOC_TYPES = [
  "National ID Card",
  "Passport",
  "Business License",
  "Tax Certificate"
];

export default function KycSection() {
  const [kyc, setKyc] = useState<KycData>({
    status: "Rejected",
    docType: "Business License",
    uploadedFile: "business_license_scan.pdf",
    rejectionReason: "Document is blurry. Please upload a clear copy.",
  });

  const [selectedType, setSelectedType] = useState(DOC_TYPES[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileName = e.target.files[0].name;
      
      setKyc({
        status: "Processing",
        docType: selectedType,
        uploadedFile: fileName,
        rejectionReason: undefined,
      });
      
      toast.success("Document uploaded successfully. It is now processing.");
      e.target.value = '';
    }
  };

  const getStatusBadge = (status: KycStatus) => {
    switch (status) {
      case "Approved":
        return <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-xs font-semibold shrink-0">Approved</span>;
      case "Processing":
        return <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 rounded text-xs font-semibold shrink-0">Processing</span>;
      case "Rejected":
        return <span className="px-2 py-0.5 bg-red-500/10 text-red-600 rounded text-xs font-semibold shrink-0">Rejected</span>;
      case "Expired":
        return <span className="px-2 py-0.5 bg-gray-500/10 text-gray-600 rounded text-xs font-semibold shrink-0">Expired</span>;
      default:
        return <span className="px-2 py-0.5 bg-foreground/5 text-foreground/50 rounded text-xs font-semibold shrink-0">Missing</span>;
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const isActionRequired = kyc.status === "Missing" || kyc.status === "Rejected" || kyc.status === "Expired";

  return (
    <div className="group bg-background border border-foreground/10 rounded-xl shadow-sm flex flex-col">
      <div onClick={() => setIsOpen(!isOpen)} className="px-4 py-2 sm:px-6 sm:py-4 flex items-center justify-between gap-3 bg-foreground/[0.02] cursor-pointer lg:pointer-events-none list-none rounded-xl lg:rounded-b-none lg:border-b lg:border-foreground/5 transition-colors select-none">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-[#1D92EB]/10 text-[#1D92EB] flex items-center justify-center shrink-0">
            <i className="fa-solid fa-shield-halved text-[11px] sm:text-sm"></i>
          </div>
          <div>
            <h2 className="text-[15px] sm:text-base font-bold text-foreground leading-tight">KYC Verification</h2>
            <p className="text-sm text-foreground/60 hidden sm:block">Manage your identity documents.</p>
          </div>
        </div>
        <i className={`fa-solid fa-chevron-down lg:!hidden transition-transform duration-300 text-foreground/50 ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>
      
      <div className={`${isOpen ? 'flex' : 'hidden'} lg:!flex flex-col gap-5 p-5 sm:p-6 animate-in slide-in-from-top-2 duration-300`}>
        
        {/* Current Status Display */}
        {kyc.status !== "Missing" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-foreground/10 bg-background">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-file-invoice text-foreground/50"></i>
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-semibold text-sm truncate text-foreground">{kyc.docType}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getStatusBadge(kyc.status)}
                    {kyc.uploadedFile && (
                      <span className="text-xs text-foreground/50 flex items-center gap-1 truncate" title={kyc.uploadedFile}>
                        <span className="truncate">{kyc.uploadedFile}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Rejection Reason Alert */}
            {kyc.status === "Rejected" && kyc.rejectionReason && (
              <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-sm flex items-start gap-2.5">
                <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-red-500"></i>
                <div>
                  <p className="font-semibold mb-0.5 text-red-700 dark:text-red-400">Action Required</p>
                  <p className="text-red-600/90 dark:text-red-300/90">{kyc.rejectionReason}</p>
                </div>
              </div>
            )}
            
            {/* Expired Alert */}
            {kyc.status === "Expired" && (
              <div className="p-3.5 rounded-xl border border-gray-500/20 bg-gray-500/5 text-sm flex items-start gap-2.5">
                <i className="fa-solid fa-clock-rotate-left mt-0.5 shrink-0 text-gray-500"></i>
                <div>
                  <p className="font-semibold mb-0.5 text-gray-700 dark:text-gray-300">Document Expired</p>
                  <p className="text-gray-600/90 dark:text-gray-400/90">Please upload a renewed document.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Form */}
        {isActionRequired && (
          <div className="flex flex-col gap-3">
            <hr className="border-foreground/5 my-1" />
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-sm font-medium text-foreground">Document Type <span className="text-red-500">*</span></label>
              <div className="relative">
                <select 
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-foreground/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D92EB] transition-all appearance-none text-sm"
                >
                  {DOC_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/40 text-xs pointer-events-none"></i>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleUploadClick}
              className="w-full py-4 px-4 bg-foreground/[0.02] hover:bg-foreground/[0.05] border border-foreground/20 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors mt-1"
            >
              <i className="fa-solid fa-arrow-up-from-bracket text-foreground/40 text-xl mb-1"></i>
              <span className="text-sm font-medium text-foreground/80">Click to upload document</span>
              <span className="text-xs text-foreground/40">PDF, JPG or PNG (Max 5MB)</span>
            </button>
            
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
