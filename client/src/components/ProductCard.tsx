import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { addToCart } from '../store/cartSlice';
import { getPriceLevel } from '../utils/priceLevel';
import { FiTrash2, FiEye, } from 'react-icons/fi';
import { Product } from '../utils/types';
import { resolveImageUrl } from '../config/imageConfig';

const BADGE_COLORS: Record<string, string> = {
  budget: 'bg-green-100 text-green-700',
  mid:    'bg-yellow-100 text-yellow-700',
  premium:'bg-indigo-100 text-indigo-700',
};

interface Props {
  product: Product & { id: string };
  isAdmin?: boolean;
  onDelete?: (id: string, title: string) => void;
}

export default function ProductCard({ product: p, isAdmin, onDelete }: Props) {
  const dispatch = useAppDispatch();
  const level = getPriceLevel(p.price);

  /** All images for this product (normalise legacy `image` field + resolve base URL) */
  const images: string[] = React.useMemo(() => {
    const raw: string[] = p.images?.length ? p.images : p.image ? [p.image] : [];
    return raw.map(resolveImageUrl);
  }, [p.images, p.image]);

  const hasMultiple = images.length > 1;

  const [activeIdx, setActiveIdx]   = useState(0);
  const [hovered,   setHovered]     = useState(false);
  const [adding,    setAdding]      = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Start auto-carousel on hover */
  useEffect(() => {
    if (hovered && hasMultiple) {
      intervalRef.current = setInterval(() => {
        setActiveIdx((prev) => (prev + 1) % images.length);
      }, 1500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!hovered) setActiveIdx(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [hovered, hasMultiple, images.length]);

  const handleAddToCart = () => {
    dispatch(addToCart({ productId: p.id, title: p.title, price: p.price, qty: 1 }));
    setAdding(true);
    setTimeout(() => setAdding(false), 600);
  };

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow flex flex-col group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Admin delete ── */}
      {isAdmin && onDelete && (
        <button
          onClick={() => onDelete(p.id, p.title)}
          className="absolute top-2 right-2 z-20 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          title="Delete product"
        >
          <FiTrash2 size={13} />
        </button>
      )}

      {/* ── Image carousel area ── */}
      <div className="relative h-60 bg-gray-100 overflow-hidden">
        {images.length > 0 ? (
          <>
            {images.map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt={`${p.title} ${idx + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                  idx === activeIdx ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}

            {/* Dot indicators – only when multiple images */}
            {hasMultiple && (
              <div className={`absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.preventDefault(); setActiveIdx(idx); }}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                      idx === activeIdx ? 'bg-white scale-125' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Image counter badge */}
            {hasMultiple && (
              <span className="absolute top-2 left-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {activeIdx + 1}/{images.length}
              </span>
            )}

            {/* Quick-view overlay on hover */}
            <Link
              to={`/product/${p.id}`}
              className={`absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors duration-300 no-underline ${hovered ? 'pointer-events-auto' : 'pointer-events-none'}`}
            >
              <span className={`flex items-center gap-1.5 bg-white/90 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full shadow transition-all duration-300 ${hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                <FiEye size={12} /> Quick View
              </span>
            </Link>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">👗</div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-4 flex flex-col flex-1">
        <h4 className="font-semibold text-base text-primary mb-1 line-clamp-2">{p.title}</h4>
        <p className="text-sm text-muted mb-2 line-clamp-2 flex-1">{p.description}</p>

        {/* Category + sizes */}
        {(p.category || (p.sizes && p.sizes.length > 0)) && (
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {p.category && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                p.category === 'women' ? 'bg-pink-50 text-pink-500' : 'bg-blue-50 text-blue-500'
              }`}>
                {p.category}
              </span>
            )}
            {p.sizes?.slice(0, 4).map((sz) => (
              <span key={sz} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{sz}</span>
            ))}
            {(p.sizes?.length ?? 0) > 4 && (
              <span className="text-xs text-gray-400">+{p.sizes!.length - 4}</span>
            )}
          </div>
        )}

        <div className="font-bold text-accent text-lg">₹{p.price.toFixed(2)}</div>
        <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${BADGE_COLORS[level.className] ?? 'bg-gray-100 text-gray-600'}`}>
          {level.level}
        </span>
      </div>

      {/* ── Footer buttons ── */}
      <div className="px-4 pb-4 flex gap-2">
        <Link
          to={`/product/${p.id}`}
          className="flex-1 text-center py-2 rounded-xl border border-indigo-300 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors no-underline"
        >
          View
        </Link>
        <button
          onClick={handleAddToCart}
          className={`flex-1 py-2 rounded-xl text-white text-sm font-semibold transition-all ${
            adding ? 'bg-green-500 scale-95' : 'bg-indigo-500 hover:bg-indigo-600'
          }`}
        >
          {adding ? '✓ Added' : 'Add to cart'}
        </button>
      </div>
    </div>
  );
}
