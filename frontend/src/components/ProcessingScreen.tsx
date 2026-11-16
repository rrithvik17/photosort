"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface ProcessingScreenProps {
  sessionId: string;
  onComplete: (data: any) => void;
  onError: (err: string) => void;
}

export async function fetchWithLogging(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch (e) {
        bodyText = "Could not read response body";
      }
      console.error(`Fetch failed: ${url} | Status: ${response.status} | Body: ${bodyText}`);
      let parsedError = bodyText;
      try {
        const json = JSON.parse(bodyText);
        if (json.detail) parsedError = json.detail;
      } catch (e) {}
      throw new Error(`HTTP ${response.status}: ${parsedError}`);
    }
    return response;
  } catch (err: any) {
    console.error(`Fetch exception for ${url}:`, err);
    throw err;
  }
}

export function ProcessingScreen({ sessionId, onComplete, onError }: ProcessingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Initializing engine...");

  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetchWithLogging(`http://localhost:8000/api/status/${sessionId}`);
        const data = await res.json();
        
        if (active) {
          setProgress(data.progress || 0);
          setMessage(data.message || "Processing...");
          
          if (data.status === "completed") {
            clearInterval(interval);
            try {
              const resultsRes = await fetchWithLogging(`http://localhost:8000/api/results/${sessionId}`);
              const results = await resultsRes.json();
              setTimeout(() => onComplete(results), 800); // Small delay for UX transition
            } catch (resultsErr: any) {
              onError(resultsErr.message || "Failed to fetch results");
            }
          }
        }
      } catch (err: any) {
        console.error("Status check error:", err);
      }
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionId, onComplete, onError]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center space-y-12 py-20">
      {/* Skeleton / Animation Container */}
      <div className="relative w-full aspect-[2/1] rounded-[2rem] bg-slate-50 border border-black/[0.04] overflow-hidden shadow-sm flex items-center justify-center">
        {/* Animated background scanline effect */}
        <motion.div 
          animate={{ x: ["-100%", "100%"] }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-[-20deg]"
        />
        
        {/* Placeholder UI */}
        <div className="absolute inset-0 p-8 flex space-x-6 opacity-40">
          <div className="w-1/3 h-full bg-slate-200 rounded-2xl animate-pulse" />
          <div className="w-2/3 h-full flex flex-col space-y-4">
            <div className="w-full h-1/2 bg-slate-200 rounded-2xl animate-pulse" />
            <div className="w-3/4 h-1/4 bg-slate-200 rounded-2xl animate-pulse delay-75" />
            <div className="w-1/2 h-1/4 bg-slate-200 rounded-2xl animate-pulse delay-150" />
          </div>
        </div>

        <div className="relative z-10 bg-white/80 backdrop-blur-md px-6 py-3 rounded-full border border-black/5 flex items-center space-x-3 shadow-lg">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="font-semibold text-slate-700 tracking-wide text-sm uppercase">AI Analysis Running</span>
        </div>
      </div>

      {/* Progress Info */}
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-between items-end mb-2">
          <h3 className="text-xl font-bold tracking-tight text-slate-900">{message}</h3>
          <span className="text-sm font-bold text-slate-400 tabular-nums">{Math.round(progress * 100)}%</span>
        </div>
        
        {/* Sleek Progress Bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-black/[0.03]">
          <motion.div 
            className="h-full bg-slate-900 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ ease: "circOut", duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
}
