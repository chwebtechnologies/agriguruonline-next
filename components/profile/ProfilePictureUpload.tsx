"use client";

import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/lib/cropImage';
import { toast } from 'sonner';

export default function ProfilePictureUpload() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || null);
        setIsCropping(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const showCroppedImage = useCallback(async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      const croppedImageResult = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        0
      );
      setCroppedImage(croppedImageResult);
      setIsCropping(false);
      setImageSrc(null);
      toast.success("Profile picture updated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to crop image.");
    }
  }, [imageSrc, croppedAreaPixels]);

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0 z-20">
      <div 
        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/60 overflow-hidden bg-white/10 group cursor-pointer shadow-xl backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
      >
        {croppedImage ? (
          <img src={croppedImage} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/70 text-2xl">
            <i className="fa-solid fa-user"></i>
          </div>
        )}
        
        {/* Simple clean overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <i className="fa-solid fa-camera text-white text-sm"></i>
        </div>
      </div>
      
      <button 
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
        className="text-[10px] font-bold text-white/70 hover:text-white transition-colors uppercase tracking-wider drop-shadow-sm"
      >
        Change Photo
      </button>

      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
      />
      
      {/* Standard Modal */}
      {isCropping && imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background rounded-2xl w-full max-w-md shadow-xl border border-foreground/10 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-foreground/5 bg-foreground/[0.02]">
              <h3 className="text-lg font-bold text-foreground">Crop Image</h3>
              <button onClick={() => {setIsCropping(false); setImageSrc(null);}} className="text-foreground/50 hover:text-foreground">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <div className="p-5">
              <div className="relative w-full h-[300px] bg-foreground/[0.02] rounded-xl overflow-hidden mb-5 border border-foreground/5">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={true}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  objectFit="contain"
                />
              </div>
              
              <div className="flex items-center gap-3 mb-2 px-1">
                <i className="fa-solid fa-image text-foreground/30 text-sm"></i>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-[#0c5a53]"
                />
                <i className="fa-solid fa-image text-foreground/50 text-lg"></i>
              </div>
            </div>
            
            <div className="p-5 border-t border-foreground/5 bg-foreground/[0.02] flex justify-end gap-3">
              <button 
                onClick={() => {setIsCropping(false); setImageSrc(null);}}
                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-foreground/5 border border-foreground/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={showCroppedImage}
                className="px-5 py-2 rounded-xl bg-[#0c5a53] text-white text-sm font-medium hover:bg-[#094741] transition-colors"
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
