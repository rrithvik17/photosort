"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Image as ImageIcon, ChevronRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface UploadDropzoneProps {
  onUploadStart: (files: File[]) => void;
}

export function UploadDropzone({ onUploadStart }: UploadDropzoneProps) {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpeg", ".jpg"],
      "image/png": [".png"],
    },
  });

  const handleUpload = () => {
    if (files.length > 0) {
      onUploadStart(files);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center space-y-12">
      {/* Hero Text */}
      <div className="text-center space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-100/80 border border-black/[0.05] shadow-sm backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold tracking-wide text-slate-800">Photosort AI Engine v2</span>
        </motion.div>
        
        <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight text-balance leading-[1.05] text-slate-900">
          The elegant way to <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-primary">curate your photos.</span>
        </h2>
        
        <p className="text-xl text-slate-500 max-w-2xl mx-auto text-balance font-medium leading-relaxed">
          Drop a massive photo dump below. Our local AI will intelligently group bursts, analyze focal sharpness, and help you select the absolute best shots in seconds.
        </p>
      </div>

      {/* Massive Dropzone */}
      <motion.div
        whileHover={{ scale: 1.01, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.08)" }}
        whileTap={{ scale: 0.99 }}
        {...getRootProps()}
        className={`w-full relative overflow-hidden rounded-[2rem] md:rounded-[3rem] p-16 md:p-24 text-center cursor-pointer transition-all duration-500 bg-white border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${
          isDragActive
            ? "border-primary/50 bg-blue-50/30 scale-[1.02]"
            : "hover:border-black/10 hover:bg-slate-50/50"
        }`}
      >
        <input {...getInputProps()} />
        
        <div className="relative z-10 flex flex-col items-center justify-center space-y-8">
          <motion.div 
            animate={{ 
              y: isDragActive ? -10 : 0,
              scale: isDragActive ? 1.1 : 1
            }}
            className="w-24 h-24 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-black/5 flex items-center justify-center relative group"
          >
            {/* Subtle glow */}
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <UploadCloud className="w-10 h-10 text-primary relative z-10" />
          </motion.div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">
              {isDragActive ? "Drop them right here" : "Drag & drop your photos"}
            </h3>
            <p className="text-slate-500 font-medium text-lg">
              or click to browse from your computer
            </p>
          </div>
        </div>
      </motion.div>

      {/* Upload Action */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center space-y-6 pt-4"
          >
            <div className="flex items-center space-x-3 bg-white px-6 py-3 rounded-full shadow-sm border border-black/5">
              <ImageIcon className="w-5 h-5 text-slate-400" />
              <span className="font-semibold text-slate-700">{files.length} photos ready</span>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUpload();
              }}
              className="group relative inline-flex items-center justify-center px-10 py-4 font-bold text-white bg-slate-900 rounded-full overflow-hidden transition-transform active:scale-95 shadow-xl shadow-black/10 hover:shadow-black/20"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center space-x-2">
                <span>Start Curation</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
