import React, { useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Quote, CheckCircle2 } from "lucide-react";

interface TestimonialCarouselProps {
  language: "EN" | "ID";
}

export default function TestimonialCarousel({ language }: TestimonialCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(2); // Start at middle card (0, 1, [2], 3, 4)
  const isEN = language === "EN";

  const testimonials = [
    {
      id: 1,
      name: "Budi Santoso",
      role: isEN ? "Corporate Staff, 32" : "Karyawan Swasta, 32",
      initials: "BS",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
      goal: isEN ? "Fat Loss & Macro Control" : "Menurunkan Lemak Tubuh",
      progress: isEN ? "-8kg in 3 Months" : "-8kg dalam 3 bulan",
      badge: "-8 kg",
      quote: isEN
        ? "The easiest way to track meals. Just snap a photo in WhatsApp, and GymBuddy calculates calories and macros without tedious weighing. Dieting feels sustainable."
        : "Paling praktis kirim foto makanan di WhatsApp, GymBuddy langsung estimasi kalori dan makro tanpa perlu timbang manual. Diet jadi santai dan konsisten.",
      beforeImg: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400",
      afterImg: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&q=80&w=400",
    },
    {
      id: 2,
      name: "Sarah Amalia",
      role: isEN ? "Architect, 27" : "Arsitek, 27",
      initials: "SA",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
      goal: isEN ? "Strength & Safe Lifting Form" : "Bentuk Otot & Postur Bebas Cedera",
      progress: isEN ? "+4kg Lean Muscle" : "+4kg Massa Otot",
      badge: "+4 kg Otot",
      quote: isEN
        ? "Vision AI form check eliminated my hesitation with squats and deadlifts. Movement cues kept my posture clean and back protected."
        : "Vision AI form check bikin gak ragu lagi squat & deadlift sendiri di gym. Postur makin rapi dan punggung aman dari cedera.",
      beforeImg: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=400",
      afterImg: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400",
    },
    {
      id: 3,
      name: "Dimas Rizky",
      role: isEN ? "Software Engineer, 29" : "Software Engineer, 29",
      initials: "DR",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
      goal: isEN ? "Daily Consistency & Energy" : "Bangun Kebiasaan & Disiplin Harian",
      progress: isEN ? "3 Months Consistency" : "3 Bulan Konsisten",
      badge: "3 Bulan",
      quote: isEN
        ? "The 24/7 WhatsApp coach keeps me accountable for workouts and hydration. Turned erratic gym attendance into a consistent daily habit."
        : "Asisten WhatsApp 24/7 selalu mengingatkan target air & jadwal workout. Dari yang dulu sering bolong latihan, sekarang rutin jalanin tiap pagi.",
      beforeImg: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400",
      afterImg: "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&q=80&w=400",
    },
    {
      id: 4,
      name: "Jessica Tan",
      role: isEN ? "Entrepreneur, 25" : "Entrepreneur, 25",
      initials: "JT",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200",
      goal: isEN ? "Flexible Nutrition & Tone" : "Body Recomposition & Nutrisi Fleksibel",
      progress: isEN ? "-6cm Waistline" : "-6cm Lingkar Pinggang",
      badge: "-6 cm Waist",
      quote: isEN
        ? "Coach Mia is encouraging yet firm. Her daily macro guidance keeps my nutrition flexible without feeling starved or exhausted."
        : "Coach Mia bener-bener ramah tapi tegas. Panduan makro harian bikin pola makan fleksibel tanpa rasa lapar berlebihan atau tersiksa.",
      beforeImg: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&q=80&w=400",
      afterImg: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&q=80&w=400",
    },
    {
      id: 5,
      name: "Rendy Pratama",
      role: isEN ? "Marketing Lead, 31" : "Marketing Lead, 31",
      initials: "RP",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200",
      goal: isEN ? "Busy Schedule Fat Loss" : "Fat Loss Efektif di Tengah Kesibukan",
      progress: isEN ? "-10kg Goal Achieved" : "-10kg Target Tercapai",
      badge: "-10 kg",
      quote: isEN
        ? "The most realistic solution for demanding corporate hours. 35-45 minute efficient workouts that deliver measurable results."
        : "Solusi paling realistis buat yang super sibuk kerja kantoran. Latihan cuma 35-45 menit tapi efektif dan terukur hasilnya.",
      beforeImg: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400",
      afterImg: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=400",
    },
  ];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section id="reviews-section" className="w-full bg-black text-white rounded-[2rem] 2xl:rounded-[3rem] py-10 md:py-14 px-6 md:px-10 lg:px-12 relative overflow-hidden font-['Inter']">
      <div className="w-full">
        
        {/* HEADER SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start mb-8 sm:mb-10">
          <div className="md:col-span-8">
            <h2 className="font-['Archivo_Black'] font-normal text-3xl md:text-5xl lg:text-6xl 2xl:text-7xl uppercase tracking-tighter leading-[1] md:leading-[0.95] text-white">
              {isEN
                ? "WHAT MEMBERS ACHIEVE WITH GYMBUDDY AI"
                : "APA KATA MEREKA YANG CAPAI GOAL BERSAMA GYMBUDDY AI"}
            </h2>
          </div>

          <div className="md:col-span-4 md:text-right">
            <p className="text-neutral-400 text-sm md:text-base leading-relaxed max-w-md md:ml-auto font-['Inter'] font-medium">
              {isEN
                ? "From struggling with consistency to reaching peak physical transformations with personalized 24/7 AI coaching directly on WhatsApp."
                : "Dari mager dan gak konsisten, jadi berhasil capai goal berkat pendampingan AI coach 24/7 di WhatsApp."}
            </p>
          </div>
        </div>

        {/* 5-CARD HORIZONTAL CAROUSEL - FLAT CHARCOAL CARDS */}
        <div className="relative py-2">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 lg:gap-5 items-start">
            {testimonials.map((item, idx) => {
              const isCenter = idx === activeIndex;

              return (
                <motion.div
                  key={item.id}
                  onClick={() => setActiveIndex(idx)}
                  layout
                  initial={false}
                  animate={{
                    scale: isCenter ? 1.05 : 0.92,
                    opacity: isCenter ? 1 : 0.5,
                    y: 0,
                  }}
                  whileHover={{
                    scale: isCenter ? 1.07 : 0.96,
                    opacity: isCenter ? 1 : 0.85,
                  }}
                  transition={{
                    duration: 0.35,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                  /* STRICT FLAT CHARCOAL CARD (#262626) */
                  className={`relative cursor-pointer rounded-[2rem] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 min-h-[440px] sm:min-h-[480px] bg-[#262626] overflow-hidden font-['Inter'] ${
                    isCenter ? "z-20" : "z-10"
                  }`}
                >
                  {/* CARD TOP: RATING & SHORT QUOTE */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, starIdx) => (
                          <span key={starIdx} className="text-white text-xs">★</span>
                        ))}
                      </div>
                      <Quote className="w-5 h-5 text-white/80" />
                    </div>

                    <p className={`font-medium text-sm sm:text-base leading-snug tracking-tight mb-4 font-['Inter'] ${
                      isCenter ? "text-white" : "text-neutral-200 line-clamp-3"
                    }`}>
                      "{item.quote}"
                    </p>
                  </div>

                  {/* CARD MIDDLE: BEFORE / AFTER PHOTO SPLIT CONTAINER */}
                  <div className="relative my-3 rounded-2xl overflow-hidden bg-black/50 h-44 sm:h-48 flex items-stretch font-['Inter']">
                    
                    {/* Left: BEFORE Photo */}
                    <div className="relative w-1/2 h-full overflow-hidden border-r border-black/40 bg-neutral-800">
                      <img
                        src={item.beforeImg}
                        alt={`${item.name} Before`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover filter brightness-90 grayscale-[20%]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-neutral-300 text-[10px] font-semibold uppercase tracking-wider">
                        Before
                      </span>
                    </div>

                    {/* Right: AFTER Photo */}
                    <div className="relative w-1/2 h-full overflow-hidden bg-neutral-800">
                      <img
                        src={item.afterImg}
                        alt={`${item.name} After`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white text-black text-[10px] font-bold uppercase tracking-wider">
                        After
                      </span>
                    </div>

                    {/* Corner Result Badge */}
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-bold tracking-tight shadow-md">
                      {item.badge}
                    </div>
                  </div>

                  {/* CARD BOTTOM: USER AVATAR, NAME, GOAL & PROGRESS */}
                  <div className="pt-3 flex items-center gap-3 font-['Inter']">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-700 border border-neutral-600 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-neutral-200 select-none">{item.initials}</span>
                      <img
                        src={item.avatar}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                        <span>{item.name}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                        <span className="text-[11px] font-normal text-neutral-400">({item.role})</span>
                      </div>
                      <div className="text-xs text-white font-medium truncate mt-0.5">
                        {item.goal} • <span className="text-neutral-300 font-normal">{item.progress}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* CAROUSEL CONTROLS & DOT INDICATORS */}
          <div className="flex items-center justify-between mt-10 pt-4">
            {/* Left/Right Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrev}
                className="w-11 h-11 rounded-full bg-[#262626] text-white hover:bg-white hover:text-black transition-all flex items-center justify-center cursor-pointer"
                aria-label="Previous Testimonial"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleNext}
                className="w-11 h-11 rounded-full bg-[#262626] text-white hover:bg-white hover:text-black transition-all flex items-center justify-center cursor-pointer"
                aria-label="Next Testimonial"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Dot Indicators */}
            <div className="flex items-center gap-2">
              {testimonials.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  onClick={() => setActiveIndex(dotIdx)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    dotIdx === activeIndex
                      ? "w-8 bg-white"
                      : "w-2 bg-neutral-800 hover:bg-neutral-600"
                  }`}
                  aria-label={`Go to slide ${dotIdx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
