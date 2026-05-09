import React from 'react';
import { FiInfo } from 'react-icons/fi';

const sections = [
  {
    emoji: '🌙',
    title: 'Our Essence',
    paragraphs: [
      'We create everyday essentials where comfort meets quiet luxury.',
      'Designed to feel soft, breathable, and effortless on your skin, our collection focuses on pyjama sets and versatile t-shirts made for ease in every moment.',
      'At the heart of what we do is a simple idea — clothing should feel natural, not forced. Pieces that fit into your lifestyle effortlessly, offering comfort you can rely on every day.',
    ],
  },
  {
    emoji: '☄️',
    title: 'Our Brand',
    paragraphs: [
      'Halley Comet is our parent brand — the name behind our vision, design, and direction. Inspired by Halley\'s Comet, it reflects something rare, memorable, and quietly distinctive.',
      'Under Halley Comet, we introduce Cozy Luna Wears — a label dedicated to comfort-focused clothing, especially sleepwear. Designed to reflect calm, softness, and ease, it brings a more relaxed expression to our collections.',
      'While each name carries its own identity, every piece is created with the same standards of quality, care, and consistency.',
    ],
    quote: '"Like a comet that leaves its mark, we create comfort that stays with you."',
  },
  {
    emoji: '🌿',
    title: 'Where It All Began',
    paragraphs: [
      'Our journey is shaped by a deep connection to textiles and craftsmanship — where fabric, skill, and dedication come together every day.',
      'With our production based in Tirupur, we work closely with a team of experienced workers to create each piece with care and attention. Being directly involved in the process allows us to maintain quality, consistency, and a personal touch in everything we make.',
    ],
  },
  {
    emoji: '✂️',
    title: 'Crafted With Care',
    paragraphs: [
      'From selecting the right fabric to the final stitch, every step is handled with precision.',
      'Our process includes sourcing, dyeing, cutting, stitching, and finishing — all done with close attention to detail. By creating everything from scratch, we ensure softness, durability, and a comfortable fit that lasts over time.',
    ],
  },
  {
    emoji: '💛',
    title: 'Thank You',
    paragraphs: [
      'Thank you for choosing comfort with us.',
      'Every piece you wear is a small part of our journey.',
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Hero banner — keeps brand green, sits directly under navbar */}
      {/* <div className="bg-brand border-b border-brand-border px-6 py-10 text-center">
        <p className="text-xs font-bold tracking-[0.25em] uppercase text-brand-dark mb-2">Halley Comet</p>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-primary leading-tight mb-3">
          Our Story
        </h1>
        <div className="w-12 h-0.5 bg-brand-dark mx-auto rounded-full" />
      </div> */}

      {/* Page header */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <FiInfo size={22} className="text-brand-dark" />
          <h1 className="text-2xl font-bold text-gray-900 font-display">Our Story</h1>
        </div>
      </div>

      {/* Content — pale bg-bg, each section in a white card */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-6 flex flex-col gap-6">
        {sections.map(({ emoji, title, paragraphs, quote }) => (
          <div key={title} className="bg-brand rounded-2xl border border-brand-border shadow-sm px-6 py-5 flex gap-5 sm:gap-7">
            {/* Left accent line + emoji */}
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <span className="text-2xl">{emoji}</span>
              <div className="w-px flex-1 bg-brand-border mt-1" />
            </div>

            {/* Right content */}
            <div className="pb-1">
              <h2 className="text-base font-bold text-primary mb-3 font-display tracking-wide">{title}</h2>
              <div className="flex flex-col gap-2.5">
                {paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-primary/75">{p}</p>
                ))}
                {quote && (
                  <blockquote className="mt-2 border-l-2 border-brand-dark pl-4 italic text-sm text-brand-dark font-medium">
                    {quote}
                  </blockquote>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer strip */}
      <div className="border-t border-border text-center max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-8">
        <p className="text-xs text-muted tracking-widest uppercase">Halley Comet · Cozy Luna Wears</p>
        <p className="text-xs text-muted mt-1">Tirupur, India</p>
      </div>
    </div>
  );
}

