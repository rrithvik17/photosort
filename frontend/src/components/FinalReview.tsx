"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, X, Maximize2, Search, Trash2, RotateCcw, ImageIcon, AlertTriangle, Layers, Download, Loader2 } from "lucide-react";

interface FinalReviewProps {
  sessionId: string;
  data: {
    groups: string[][];
    blur_scores: Record<string, string>;
  };
  initialKeepers: Set<string>;
  totalOriginal: number;
  onFinish: (keepers: Set<string>) => void;
}

type FilterType = "All" | "Kept" | "Removed" | "Duplicates" | "Low Quality";

export function FinalReview({ sessionId, data, initialKeepers, totalOriginal, onFinish }: FinalReviewProps) {
  const [keepers, setKeepers] = useState<Set<string>>(initialKeepers);
  const [filter, setFilter] = useState<FilterType>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Compute all photos and metadata once
  const allPhotos = useMemo(() => {
    const photos = Object.keys(data.blur_scores);
    const groupsSet = new Set(data.groups?.flat() || []);
    
    return photos.map(photo => {
      const isGrouped = groupsSet.has(photo);
      const quality = data.blur_scores[photo] || "Excellent";
      const isLowQuality = quality === "Needs Review" || quality === "Low Quality";
      
      let defaultReason = "";
      if (isGrouped) defaultReason = "Duplicate from Similar Group";
      else if (isLowQuality) defaultReason = "Low Quality";
      else defaultReason = "User Deselected";
      
      return {
        id: photo,
        isGrouped,
        isLowQuality,
        defaultReason
      };
    });
  }, [data]);

  // Apply filters and search
  const displayedPhotos = useMemo(() => {
    let filtered = allPhotos;
    
    if (searchQuery) {
      filtered = filtered.filter(p => p.id.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    switch (filter) {
      case "Kept":
        filtered = filtered.filter(p => keepers.has(p.id));
        break;
      case "Removed":
        filtered = filtered.filter(p => !keepers.has(p.id));
        break;
      case "Duplicates":
        filtered = filtered.filter(p => !keepers.has(p.id) && p.defaultReason.includes("Duplicate"));
        break;
      case "Low Quality":
        filtered = filtered.filter(p => !keepers.has(p.id) && p.defaultReason.includes("Low Quality"));
        break;
      default:
        break;
    }
    return filtered;
  }, [allPhotos, keepers, filter, searchQuery]);

  const stats = useMemo(() => {
    const removedCount = totalOriginal - keepers.size;
    const storageSavedMb = removedCount * 3.5;
    
    let lowQualityCount = 0;
    allPhotos.forEach(p => { if (p.isLowQuality) lowQualityCount++; });
    
    return {
      uploaded: totalOriginal,
      kept: keepers.size,
      removed: removedCount,
      groups: data.groups?.length || 0,
      lowQuality: lowQualityCount,
      storageSaved: storageSavedMb > 1024 ? `${(storageSavedMb/1024).toFixed(1)} GB` : `${Math.round(storageSavedMb)} MB`
    };
  }, [keepers, totalOriginal, allPhotos, data.groups]);

  const toggleKeep = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setKeepers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/download/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepers: Array.from(keepers) }),
      });
      
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = "Cleaned_Collection.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      // Proceed to summary screen
      setTimeout(() => onFinish(keepers), 1000);
    } catch (err) {
      console.error(err);
      alert("Failed to download collection.");
      setDownloading(false);
    }
  };

  // Keyboard support for Viewer Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewerPhoto) return;
      const idx = displayedPhotos.findIndex(p => p.id === viewerPhoto);
      if (idx === -1) return;
      
      if (e.key === "Escape") setViewerPhoto(null);
      if (e.key === "ArrowRight" && idx < displayedPhotos.length - 1) setViewerPhoto(displayedPhotos[idx + 1].id);
      if (e.key === "ArrowLeft" && idx > 0) setViewerPhoto(displayedPhotos[idx - 1].id);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerPhoto, displayedPhotos]);

  return (
    <div className="w-full flex flex-col min-h-screen pb-32">
      <div className="mb-10 text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Final Review</h2>
        <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">
          You have full control. Review the AI's suggestions and restore or remove any photos before generating the final collection.
        </p>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        <StatCard icon={<ImageIcon />} label="Uploaded" value={stats.uploaded} />
        <StatCard icon={<CheckCircle2 />} label="Kept" value={stats.kept} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard icon={<Trash2 />} label="Removed" value={stats.removed} color="text-red-600" bg="bg-red-50" />
        <StatCard icon={<Layers />} label="Groups" value={stats.groups} />
        <StatCard icon={<AlertTriangle />} label="Low Quality" value={stats.lowQuality} color="text-amber-600" bg="bg-amber-50" />
        <StatCard icon={<Download />} label="Storage Saved" value={stats.storageSaved} color="text-blue-600" bg="bg-blue-50" />
      </div>

      {/* Sticky Control Bar */}
      <div className="sticky top-16 z-30 bg-white/80 backdrop-blur-xl border-b border-black/[0.04] py-4 mb-8 -mx-6 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {(["All", "Kept", "Removed", "Duplicates", "Low Quality"] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                filter === f 
                  ? "bg-slate-900 text-white shadow-md" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search filenames..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-black/[0.06] bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all"
          />
        </div>
      </div>

      {/* Masonry Grid */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
        <AnimatePresence>
          {displayedPhotos.map(photo => {
            const isKept = keepers.has(photo.id);
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                key={photo.id}
                className="relative rounded-3xl overflow-hidden cursor-zoom-in group break-inside-avoid shadow-sm border border-black/[0.03]"
                onClick={() => setViewerPhoto(photo.id)}
              >
                <img 
                  src={`http://localhost:8000/api/thumbnail/${sessionId}/${photo.id}`} 
                  alt={photo.id}
                  className="w-full object-cover bg-slate-100"
                  loading="lazy"
                />
                
                {/* Overlay Gradients */}
                <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity ${!isKept && "opacity-100 bg-black/40"}`} />
                
                {/* File Name */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <span className="text-xs font-medium text-white/80 bg-black/40 px-2 py-1 rounded backdrop-blur-md truncate max-w-[70%]">
                    {photo.id}
                  </span>
                  <div className="bg-black/40 p-1.5 rounded-full backdrop-blur-md">
                    <Maximize2 className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                {/* Status Indicator & Action */}
                <div className={`absolute bottom-4 left-4 right-4 flex flex-col space-y-2 z-10 ${isKept ? "opacity-0 group-hover:opacity-100 transition-opacity" : "opacity-100"}`}>
                  {!isKept && (
                    <div className="bg-red-500/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg w-fit shadow-lg">
                      Removed: {photo.defaultReason}
                    </div>
                  )}
                  
                  <button 
                    onClick={(e) => toggleKeep(photo.id, e)}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold shadow-lg backdrop-blur-md flex items-center justify-center space-x-2 transition-transform active:scale-95 ${
                      isKept ? "bg-white/90 text-red-600 hover:bg-white" : "bg-emerald-500/90 text-white hover:bg-emerald-500"
                    }`}
                  >
                    {isKept ? (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Restore</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      
      {displayedPhotos.length === 0 && (
        <div className="w-full py-20 flex flex-col items-center justify-center text-slate-400">
          <Search className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-lg font-medium">No photos match your filters.</p>
        </div>
      )}

      {/* Viewer Modal (React Portal ideally, but inline works for absolute full screen) */}
      <AnimatePresence>
        {viewerPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center"
            onClick={() => setViewerPhoto(null)}
          >
            <button className="absolute top-6 right-6 text-white/50 hover:text-white p-2 rounded-full bg-white/10 transition-colors">
              <X className="w-6 h-6" />
            </button>
            
            <img 
              src={`http://localhost:8000/api/thumbnail/${sessionId}/${viewerPhoto}`} 
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/70 font-medium tracking-wide flex items-center space-x-4 bg-black/50 px-6 py-3 rounded-full backdrop-blur-md">
              <span>Use Left/Right arrows to navigate</span>
              <div className="w-px h-4 bg-white/20" />
              <span>{viewerPhoto}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-black/[0.04] p-6 z-40 shadow-[0_-8px_30px_rgb(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold tracking-tight text-slate-900">Ready to generate ZIP?</h3>
            <p className="text-slate-500 font-medium">
              You are about to include <strong className="text-slate-900">{stats.kept}</strong> photos and permanently exclude <strong className="text-slate-900">{stats.removed}</strong> photos.
            </p>
          </div>
          
          <button 
            onClick={handleDownload}
            disabled={downloading}
            className="group w-full md:w-auto relative inline-flex items-center justify-center px-10 py-4 font-bold text-white bg-slate-900 rounded-full overflow-hidden transition-transform active:scale-95 shadow-xl shadow-black/10 hover:shadow-black/20 disabled:opacity-70 disabled:active:scale-100"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-emerald-500 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative flex items-center space-x-3">
              {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />}
              <span>{downloading ? "Zipping Collection..." : "Generate Clean Collection"}</span>
            </span>
          </button>
        </div>
      </div>

    </div>
  );
}

// Simple Stat Card Helper
function StatCard({ icon, label, value, color = "text-slate-600", bg = "bg-slate-50" }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 rounded-3xl ${bg} flex flex-col items-center justify-center text-center space-y-2 border border-black/[0.02] shadow-sm`}
    >
      <div className={`${color} mb-1`}>{React.cloneElement(icon, { className: "w-6 h-6" })}</div>
      <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
    </motion.div>
  );
}
