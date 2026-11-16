"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, ChevronRight, ChevronLeft, ArrowRight } from "lucide-react";

interface MomentsReviewProps {
  sessionId: string;
  data: {
    groups: string[][];
    blur_scores: Record<string, string>;
  };
  initialKeepers: Set<string>;
  onFinish: (keepers: Set<string>) => void;
}

export function MomentsReview({ sessionId, data, initialKeepers, onFinish }: MomentsReviewProps) {
  const [keepers, setKeepers] = useState<Set<string>>(initialKeepers);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  
  const groups = data.groups || [];
  const activeGroup = groups[currentGroupIndex] || [];
  const [activePhoto, setActivePhoto] = useState<string>(activeGroup[0]);

  useEffect(() => {
    setActivePhoto(groups[currentGroupIndex]?.[0]);
  }, [currentGroupIndex, groups]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (groups.length === 0) return;
      
      const currentIndex = activeGroup.indexOf(activePhoto);
      
      if (e.key === "ArrowRight") {
        if (currentIndex < activeGroup.length - 1) {
          setActivePhoto(activeGroup[currentIndex + 1]);
        }
      } else if (e.key === "ArrowLeft") {
        if (currentIndex > 0) {
          setActivePhoto(activeGroup[currentIndex - 1]);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        toggleKeep(activePhoto);
      } else if (e.key === "Enter") {
        if (currentGroupIndex < groups.length - 1) {
          setCurrentGroupIndex(prev => prev + 1);
        } else {
          onFinish(keepers);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePhoto, activeGroup, groups.length, currentGroupIndex, keepers, onFinish]);

  const toggleKeep = (photoId: string) => {
    setKeepers(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const getQualityBadge = (quality: string) => {
    if (quality === "Excellent") return { label: "Excellent", dot: "bg-emerald-500" };
    if (quality === "Good") return { label: "Good", dot: "bg-green-500" };
    if (quality === "Needs Review") return { label: "Needs Review", dot: "bg-amber-500" };
    return { label: "Low Quality", dot: "bg-red-500" };
  };

  if (groups.length === 0) {
    // If no groups, this component shouldn't really be rendered, but handle it gracefully
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <button onClick={() => onFinish(keepers)} className="px-6 py-3 bg-slate-900 text-white rounded-full">Continue</button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Similar Moments</h2>
          <p className="text-slate-500 font-medium mt-1">Select the best shots from each burst sequence.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm font-bold text-slate-400">
            {currentGroupIndex + 1} / {groups.length}
          </div>
          <button
            onClick={() => {
              if (currentGroupIndex < groups.length - 1) {
                setCurrentGroupIndex(prev => prev + 1);
              } else {
                onFinish(keepers);
              }
            }}
            className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-800 transition-colors shadow-md"
          >
            <span>{currentGroupIndex < groups.length - 1 ? "Next Group" : "Continue"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main UI */}
      <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-0">
        
        {/* Large Preview */}
        <div className="flex-grow bg-slate-50 rounded-[2rem] border border-black/[0.04] overflow-hidden relative shadow-sm flex items-center justify-center p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePhoto}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full relative flex items-center justify-center"
            >
              <img 
                src={`http://localhost:8000/api/thumbnail/${sessionId}/${activePhoto}`} 
                alt="Preview"
                className="max-w-full max-h-full object-contain rounded-xl"
              />
              
              {/* Quality Badge */}
              {(() => {
                const q = data.blur_scores[activePhoto] || "Excellent";
                if (q !== "Excellent") {
                  const badge = getQualityBadge(q);
                  return (
                    <div className="absolute top-6 left-6 flex items-center space-x-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border border-black/5">
                      <div className={`w-2 h-2 rounded-full ${badge.dot}`} />
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{badge.label}</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Selection Toggle */}
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="absolute bottom-6 right-6 cursor-pointer z-10"
                onClick={() => toggleKeep(activePhoto)}
              >
                {keepers.has(activePhoto) ? (
                  <CheckCircle2 className="w-14 h-14 text-slate-900 bg-white rounded-full shadow-xl" />
                ) : (
                  <Circle className="w-14 h-14 text-white drop-shadow-md opacity-80 bg-black/20 rounded-full" />
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Thumbnail Strip */}
        <div className="w-full lg:w-48 xl:w-56 flex-shrink-0 flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto pb-4 lg:pb-0 hide-scrollbar">
          {activeGroup.map((photo) => (
            <motion.div
              key={photo}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActivePhoto(photo)}
              className={`relative aspect-[4/3] rounded-2xl cursor-pointer overflow-hidden border-2 transition-all duration-300 ${
                activePhoto === photo 
                  ? "border-slate-900 shadow-md scale-100" 
                  : "border-transparent opacity-60 hover:opacity-100 scale-95"
              }`}
            >
              <img 
                src={`http://localhost:8000/api/thumbnail/${sessionId}/${photo}`} 
                alt="Thumbnail"
                className="w-full h-full object-cover"
              />
              {keepers.has(photo) && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="w-5 h-5 text-white fill-slate-900 drop-shadow-md" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
        
      </div>
      <div className="mt-4 text-center text-xs font-medium text-slate-400">
        Use Left/Right arrows to navigate, Space to select, Enter to continue
      </div>
    </div>
  );
}
