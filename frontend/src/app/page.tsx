"use client";

import React, { useState } from "react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { MomentsReview } from "@/components/MomentsReview";
import { LowQualityReview } from "@/components/LowQualityReview";
import { FinalReview } from "@/components/FinalReview";
import { SummaryScreen } from "@/components/SummaryScreen";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { fetchWithLogging } from "./fetchUtils";

type AppState = "upload" | "processing" | "review-groups" | "review-quality" | "final-review" | "summary";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  
  // Track keepers across both review steps
  const [keepers, setKeepers] = useState<Set<string>>(new Set());
  const [totalOriginal, setTotalOriginal] = useState(0);

  const handleUploadStart = async (files: File[]) => {
    try {
      setTotalOriginal(files.length);
      
      const createRes = await fetchWithLogging("http://localhost:8000/api/session/new", { method: "POST" });
      const { session_id } = await createRes.json();
      setSessionId(session_id);
      
      setAppState("processing");
      
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append("file", file);
        return fetchWithLogging(`http://localhost:8000/api/upload/${session_id}`, {
          method: "POST",
          body: formData,
        });
      });
      
      await Promise.all(uploadPromises);
      await fetchWithLogging(`http://localhost:8000/api/analyze/${session_id}`, { method: "POST" });
      
    } catch (err: any) {
      console.error(err);
      alert(`Error starting upload: ${err.message || "Is the backend running?"}`);
      setAppState("upload");
    }
  };

  const handleProcessingComplete = (data: any) => {
    setSessionData(data);
    
    // Initialize keepers for the flow
    const allImages = Object.keys(data.blur_scores);
    const groupedPhotosSet = new Set(data.groups.flat());
    const remainingImages = allImages.filter(img => !groupedPhotosSet.has(img));
    
    const lowQualityUniques = remainingImages.filter(img => {
      const q = data.blur_scores[img] || "Excellent";
      return q === "Needs Review" || q === "Low Quality";
    });
    const lowQualitySet = new Set(lowQualityUniques);
    const sharpUniques = remainingImages.filter(img => !lowQualitySet.has(img));
    
    const initialKeepers = new Set<string>();
    sharpUniques.forEach(p => initialKeepers.add(p));
    // Needs Review starts selected, Low Quality starts unselected
    lowQualityUniques.forEach(p => {
      if ((data.blur_scores[p] || "Excellent") === "Needs Review") initialKeepers.add(p);
    });
    
    setKeepers(initialKeepers);
    
    // If no groups, skip to quality review
    if (data.groups && data.groups.length > 0) {
      setAppState("review-groups");
    } else if (lowQualityUniques.length > 0) {
      setAppState("review-quality");
    } else {
      setAppState("summary");
    }
  };

  const handleProcessingError = (err: string) => {
    alert(`Processing failed: ${err}`);
    setAppState("upload");
  };

  const handleGroupsFinish = (currentKeepers: Set<string>) => {
    setKeepers(currentKeepers);
    
    // Check if there are low quality images to review
    const allImages = Object.keys(sessionData.blur_scores);
    const groupedPhotosSet = new Set(sessionData.groups.flat());
    const remainingImages = allImages.filter(img => !groupedPhotosSet.has(img));
    const lowQualityUniques = remainingImages.filter(img => {
      const q = sessionData.blur_scores[img] || "Excellent";
      return q === "Needs Review" || q === "Low Quality";
    });
    
    if (lowQualityUniques.length > 0) {
      setAppState("review-quality");
    } else {
      setAppState("final-review");
    }
  };

  const handleQualityFinish = (currentKeepers: Set<string>) => {
    setKeepers(currentKeepers);
    setAppState("final-review");
  };

  const handleFinalReviewFinish = (finalKeepers: Set<string>) => {
    setKeepers(finalKeepers);
    setAppState("summary");
  };

  return (
    <main className="min-h-screen bg-white text-slate-900 font-sans selection:bg-black/10 selection:text-black overflow-x-hidden">
      {/* Ultra minimal navigation bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-black/[0.04] z-50 flex items-center px-6">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState("upload")}>
            <div className="w-7 h-7 rounded-md bg-black flex items-center justify-center shadow-md">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Photosort</h1>
          </div>
          <div className="text-sm font-medium text-slate-500">
            Intelligent Curation
          </div>
        </div>
      </header>
      
      <div className="pt-24 px-6 pb-24 max-w-7xl mx-auto min-h-screen flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {appState === "upload" && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              exit={{ opacity: 0, filter: "blur(10px)", y: -20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex-grow flex items-center justify-center"
            >
              <UploadDropzone onUploadStart={handleUploadStart} />
            </motion.div>
          )}

          {appState === "processing" && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <ProcessingScreen 
                sessionId={sessionId!} 
                onComplete={handleProcessingComplete} 
                onError={handleProcessingError} 
              />
            </motion.div>
          )}

          {appState === "review-groups" && sessionData && (
            <motion.div 
              key="review-groups"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <MomentsReview 
                sessionId={sessionId!} 
                data={sessionData} 
                initialKeepers={keepers}
                onFinish={handleGroupsFinish} 
              />
            </motion.div>
          )}

          {appState === "review-quality" && sessionData && (
            <motion.div 
              key="review-quality"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <LowQualityReview 
                sessionId={sessionId!} 
                data={sessionData} 
                initialKeepers={keepers}
                onFinish={handleQualityFinish} 
              />
            </motion.div>
          )}

          {appState === "final-review" && sessionData && (
            <motion.div 
              key="final-review"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <FinalReview 
                sessionId={sessionId!} 
                data={sessionData} 
                initialKeepers={keepers}
                totalOriginal={totalOriginal}
                onFinish={handleFinalReviewFinish} 
              />
            </motion.div>
          )}

          {appState === "summary" && sessionData && (
            <motion.div 
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <SummaryScreen 
                sessionId={sessionId!} 
                keepers={Array.from(keepers)} 
                totalOriginal={totalOriginal}
                onRestart={() => {
                  setAppState("upload");
                  setSessionId(null);
                  setSessionData(null);
                  setKeepers(new Set());
                }} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
