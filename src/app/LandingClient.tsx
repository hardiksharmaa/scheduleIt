"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";


const features = [
  { title: "Smart Scheduling", desc: "Share your booking link and let guests pick a time. No back-and-forth emails." },
  { title: "Flexible Availability", desc: "Set your weekly schedule, overrides, and buffer times effortlessly." },
  { title: "Team Scheduling", desc: "Round-robin, collective, and group events tailored for scale." },
  { title: "Auto Integrations", desc: "Auto-creates meeting links and sends automated calendar invites." },
];

export default function LandingClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(false);
  
  // Using ref for fast access in scroll handler to avoid dependency re-renders
  const progressRef = useRef(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Hide global scrollbar cleanly on mount
  useEffect(() => {
    document.body.classList.add('no-scrollbar');
    return () => {
      document.body.classList.remove('no-scrollbar');
    };
  }, []);

  // Preload frames
  useEffect(() => {
    const frameCount = 35;
    const loadedImages: HTMLImageElement[] = [];

    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      const numStr = i.toString().padStart(2, "0");
      img.src = `/newbg/${numStr}.png`;
      img.onload = () => {
        // Keeps images rendering smoothly
      };
      // To preserve order, let's assign by index once all are loaded
      loadedImages.push(img);
    }

    // Fix for out-of-order loading: ensure we just check all complete
    const checkInterval = setInterval(() => {
      let complete = true;
      for (const img of loadedImages) {
        if (!img.complete) {
          complete = false;
          break;
        }
      }
      if (complete) {
        clearInterval(checkInterval);
        setImages(loadedImages);
        setLoaded(true);
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, []);

  // Update canvas
  useEffect(() => {
    if (!loaded || !canvasRef.current || !containerRef.current || images.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false }); // Optimization
    if (!ctx) return;

    let animationFrameId: number;

    const drawFrame = (progress: number) => {
      // frames range 0 to 34
      const frameIndex = Math.min(34, Math.max(0, Math.floor(progress * 34)));
      const img = images[frameIndex];
      // Only draw if img is fully loaded to prevent broken frames
      if (!img || !img.complete || img.naturalWidth === 0) return;

      // Hard clear to black to prevent any purple body background from bleeding securely
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const canvasRatio = canvas.width / canvas.height;
      const imgRatio = img.width / img.height;
      
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      let offsetX = 0;
      let offsetY = 0;

      // Object fit cover logic
      if (canvasRatio > imgRatio) {
        drawHeight = canvas.width / imgRatio;
        offsetY = (canvas.height - drawHeight) / 2;
      } else {
        drawWidth = canvas.height * imgRatio;
        offsetX = (canvas.width - drawWidth) / 2;
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawFrame(progressRef.current);
    };

    const handleScroll = () => {
      if (!containerRef.current) return;
      const containerInfo = containerRef.current.getBoundingClientRect();
      const maxScroll = containerInfo.height - window.innerHeight;
      const currentScroll = -containerInfo.top;
      
      const progress = Math.min(1, Math.max(0, currentScroll / maxScroll));
      progressRef.current = progress;
      setScrollProgress(progress);
      
      // Request animation frame for smooth drawing
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => drawFrame(progress));
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    
    // Initial setup
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [loaded, images]);

  return (
    <div className="bg-black min-h-screen text-white relative font-sans [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      
      {!loaded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <span className="text-gray-400 text-sm tracking-widest uppercase animate-pulse">
            Loading Experience...
          </span>
        </div>
      )}

      {/* Scroll container (500vh allows enough scroll distance / medium speed) */}
      <div ref={containerRef} style={{ height: "500vh" }} className="relative bg-black">
        
        {/* Sticky viewport content */}
        <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full object-cover z-0"
          />

          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none" />

          {/* Tagline & Button (Fades out quickly) */}
          <div 
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center"
            style={{ 
              opacity: Math.max(0, 1 - scrollProgress * 5),
              pointerEvents: scrollProgress > 0.1 ? "none" : "auto",
              transform: `translateY(${scrollProgress * 100}px)`
            }}
          >
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-linear-to-b from-white/90 to-white/40 mb-8 select-none">
              Scheduling, Simplified.
            </h1>
            
            {isLoggedIn ? (
              <Link href="/dashboard">
                <Button size="lg" className="bg-transparent hover:bg-white/5 border border-white/20 text-white rounded-2xl text-lg px-7 py-4 h-auto transition-all hover:scale-105 font-medium tracking-wide">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="lg" className="bg-transparent hover:bg-white/5 border border-white/20 text-white rounded-2xl text-lg px-7 py-4 h-auto transition-all hover:scale-105 font-medium tracking-wide">
                  Log In
                </Button>
              </Link>
            )}
          </div>

          {/* Features */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            {features.map((feat, idx) => {
              const startProgress = 0.18 + (idx * 0.18);
              const endProgress = startProgress + 0.18;
              
              let opacity = 0;
              let translateY = 40;
              let scale = 0.95;

              if (scrollProgress >= startProgress && scrollProgress <= endProgress) {
                const localProgress = (scrollProgress - startProgress) / 0.18;
                opacity = localProgress < 0.5 ? localProgress * 2 : (1 - localProgress) * 2;
                translateY = 40 - (localProgress * 80);
                scale = 0.95 + (localProgress * 0.05);
              }
              


              return (
                <div 
                  key={idx}
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center px-6"
                  style={{ 
                    opacity, 
                    transform: `translateY(${translateY}px) scale(${scale})`,
                    transition: "opacity 0.1s ease-out, transform 0.1s ease-out" 
                  }}
                >
                  <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-white">{feat.title}</h2>
                  <p className="text-xl md:text-2xl text-gray-400 max-w-2xl font-light">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-black flex items-center justify-center py-32 overflow-hidden relative z-30">
        <h1 className="text-[16vw] font-black tracking-tighter text-[#2A1B3D] leading-none select-none opacity-50">
          SCHEDULEIT
        </h1>
        {/* Glowing overlay text */}
        <h1 className="absolute text-[16vw] font-black tracking-tighter text-transparent bg-clip-text bg-linear-to-b from-white/80 to-transparent leading-none select-none">
          SCHEDULEIT
        </h1>
      </footer>
    </div>
  );
}
