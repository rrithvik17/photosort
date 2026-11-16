"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

interface LowQualityReviewProps {
  sessionId: string;
  data: {
    groups: string[][];
    blur_scores: Record<string, string>;
  };
  initialKeepers: Set<string>;
  onFinish: (keepers: Set<string>) => void;
}

export function LowQualityReview({ sessionId, data, initialKeepers, onFinish }: LowQualityReviewProps) {
  const [keepers, setKeepers] = useState<Set<string>>(initialKeepers);

  // Extract only low quality photos
  const allImages = Object.keys(data.blur_scores);
  const groupedPhotosSet = new Set(data.groups?.flat() || []);
  const remainingImages = allImages.filter(img => !groupedPhotosSet.has(img));
  
  const lowQualityPhotos = remainingImages.filter(img => {
    const q = data.blur_scores[img] || "Excellent";
    return q === "Needs Review" || q === "Low Quality";
  });

  const toggleKeep = (photoId: string) => {
    setKeepers(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const getQualityBadge = (quality: string) => {
    if (quality === "Needs Review") return { label: "Needs Review", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" };
    return { label: "Low Quality", bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" };
  };

  return (
    <div className="w-full flex flex-col min-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Potential Issues</h2>
          <p className="text-slate-500 font-medium mt-1">
            We flagged {lowQualityPhotos.length} photos that might be blurry. Uncheck the ones you want to discard.
          </p>
        </div>
        <button
          onClick={() => onFinish(keepers)}
          className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-md active:scale-95"
        >
          <span>Complete Curation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-20">
        {lowQualityPhotos.map((photo, i) => {
          const q = data.blur_scores[photo] || "Low Quality";
          const badge = getQualityBadge(q);
          const isKept = keepers.has(photo);

          return (
            <motion.div
              key={photo}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.05, duration: 0.3 }}
              className={`relative aspect-[3/4] rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 border-2 ${
                isKept ? "border-slate-900 shadow-xl" : "border-transparent opacity-70 hover:opacity-100"
              }`}
              onClick={() => toggleKeep(photo)}
            >
              <img 
                src={`http://localhost:8000/api/thumbnail/${sessionId}/${photo}`} 
                alt="Low Quality Review"
                className="w-full h-full object-cover bg-slate-100"
              />
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

              {/* Badge */}
              <div className="absolute top-4 left-4 flex items-center space-x-2 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm">
                <div className={`w-2 h-2 rounded-full ${badge.dot}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${badge.text}`}>
                  {badge.label}
                </span>
              </div>

              {/* Checkbox */}
              <div className="absolute bottom-4 right-4 z-10">
                {isKept ? (
                  <CheckCircle2 className="w-10 h-10 text-white fill-slate-900 drop-shadow-md transition-transform scale-100" />
                ) : (
                  <Circle className="w-10 h-10 text-white drop-shadow-md opacity-80 bg-black/20 rounded-full transition-transform scale-90" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
