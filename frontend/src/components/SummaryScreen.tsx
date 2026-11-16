"use client";

import React, { useState } from "react";
import { Download, CheckCircle2, Loader2, Sparkles, ImageIcon, Trash2, HardDrive, RotateCcw } from "lucide-react";
import { motion, type Variants } from "framer-motion";

interface SummaryScreenProps {
  sessionId: string;
  keepers: string[];
  totalOriginal: number;
  onRestart: () => void;
}

export function SummaryScreen({ sessionId, keepers, totalOriginal, onRestart }: SummaryScreenProps) {
  const savedCount = totalOriginal - keepers.length;
  // Estimate ~3MB per photo saved
  const storageSavedMb = savedCount * 3.5;
  const storageSavedGb = storageSavedMb / 1024;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-12">
      <motion.div 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-8"
      >
        <CheckCircle2 className="w-12 h-12 text-white" />
      </motion.div>

      <div className="text-center space-y-4 mb-16">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
          Curation Complete
        </h2>
        <p className="text-xl text-slate-500 font-medium">
          You've successfully filtered your collection down to the absolute best shots.
        </p>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
      >
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-3xl shadow-sm border border-black/[0.04] flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-2">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div className="text-4xl font-extrabold text-slate-900">{keepers.length}</div>
          <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Photos Kept</div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white p-8 rounded-3xl shadow-sm border border-black/[0.04] flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-2">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="text-4xl font-extrabold text-slate-900">{savedCount}</div>
          <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Photos Discarded</div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white p-8 rounded-3xl shadow-sm border border-black/[0.04] flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-2">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="text-4xl font-extrabold text-slate-900">
            {storageSavedGb >= 1 ? `${storageSavedGb.toFixed(1)}GB` : `${Math.round(storageSavedMb)}MB`}
          </div>
          <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Storage Saved</div>
        </motion.div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row items-center gap-4"
      >
        <button 
          onClick={onRestart}
          className="inline-flex items-center justify-center px-10 py-4 font-bold text-slate-900 bg-slate-100 rounded-full transition-transform active:scale-95 hover:bg-slate-200 shadow-sm"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Curate Another Batch
        </button>
      </motion.div>
    </div>
  );
}
