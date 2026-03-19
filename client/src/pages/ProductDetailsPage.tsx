import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { firestoreService } from '../services/firestoreService';
import { useAppDispatch } from '../store/hooks';
import { addToCart } from '../store/cartSlice';
import { getPriceLevel } from '../utils/priceLevel';
import { FiChevronLeft, FiChevronRight, FiShoppingCart, FiHeart, FiStar } from 'react-icons/fi';
import { resolveImageUrl } from '../config/imageConfig';

const BADGE_COLORS: Record<string, string> = {
  budget:  'bg-green-100 text-green-700',
  mid:     'bg-yellow-100 text-yellow-700',
  premium: 'bg-indigo-100 text-indigo-700',
};

export default function ProductDetailsPage() {
  const { id } = useParams();
  const [product, setProduct]       = useState<any>(null);
  const [activeImg, setActiveImg]   = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [added, setAdded]           = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const dispatch = useAppDispatch();

  useEffect(() => {
    firestoreService.getProducts().then((all) => {
      const found = all.find((p) => p.id === id);
      setProduct(found ?? null);
      setActiveImg(0);
    });
  }, [id]);

  if (!product) return (
    <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse text-lg">Loading…</div>
  );

  const images: string[] = (product.images?.length ? product.images : product.image ? [product.image] : []).map(resolveImageUrl);
  const level = getPriceLevel(product.price);
  const hasMultiple = images.length > 1;

  const prevImg = () => setActiveImg((i) => (i - 1 + images.length) % images.length);
  const nextImg = () => setActiveImg((i) => (i + 1) % images.length);

  const handleAddToCart = () => {
    dispatch(addToCart({ productId: product.id, title: product.title, price: product.price, qty: 1 }));
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-500 no-underline transition-colors">
          <FiChevronLeft size={16} /> Back to shop
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* ── LEFT: Image Gallery ── */}
        <div className="flex flex-col gap-4">
          {/* Main large image */}
          <div className="relative w-full aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden shadow-md group">
            {images.length > 0 ? (
              <>
                {images.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`${product.title} view ${idx + 1}`}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                      idx === activeImg ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ))}

                {/* Prev / Next arrows */}
                {hasMultiple && (
                  <>
                    <button
                      onClick={prevImg}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <FiChevronLeft size={18} />
                    </button>
                    <button
                      onClick={nextImg}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <FiChevronRight size={18} />
                    </button>
                  </>
                )}

                {/* Dot indicators */}
                {hasMultiple && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImg(idx)}
                        className={`rounded-full transition-all duration-200 ${
                          idx === activeImg ? 'w-5 h-2 bg-indigo-500' : 'w-2 h-2 bg-white/70 hover:bg-white'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Counter */}
                {hasMultiple && (
                  <span className="absolute top-3 right-3 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
                    {activeImg + 1} / {images.length}
                  </span>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-7xl">👗</div>
            )}
          </div>

          {/* Thumbnail strip */}
          {hasMultiple && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImg(idx)}
                  className={`flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    idx === activeImg
                      ? 'border-indigo-500 shadow-md scale-105'
                      : 'border-transparent hover:border-indigo-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={src} alt={`thumb ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Product Details ── */}
        <div className="flex flex-col gap-5">
          {/* Title + badge */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{product.title}</h1>
              <span className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full mt-1 ${BADGE_COLORS[level.className] ?? 'bg-gray-100 text-gray-600'}`}>
                {level.level}
              </span>
            </div>

            {/* Static rating */}
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <FiStar className="text-yellow-400 fill-yellow-400" size={14} />
              <span className="font-semibold text-gray-700">4.4</span>
              <span>· 486 ratings</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-indigo-600">${product.price.toFixed(2)}</span>
            {level.className === 'premium' && (
              <span className="text-sm text-gray-400 line-through">${(product.price * 1.43).toFixed(2)}</span>
            )}
            {level.className === 'premium' && (
              <span className="text-sm font-semibold text-orange-500">43% OFF</span>
            )}
          </div>
          <p className="text-xs text-green-600 font-medium -mt-3">Inclusive of all taxes</p>

          {/* Category */}
          {product.category && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Category:</span>
              <span className={`text-sm px-3 py-0.5 rounded-full font-semibold capitalize ${
                product.category === 'women' ? 'bg-pink-50 text-pink-500' : 'bg-blue-50 text-blue-500'
              }`}>
                {product.category}
              </span>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Description</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Size selector */}
          {product.sizes && product.sizes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Select Size</h3>
                <button className="text-xs text-indigo-500 hover:underline font-medium">Size Chart →</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map((sz: string) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz === selectedSize ? null : sz)}
                    className={`w-12 h-12 rounded-full border-2 text-sm font-semibold transition-all duration-150 ${
                      selectedSize === sz
                        ? 'border-indigo-500 bg-indigo-500 text-white shadow-md scale-105'
                        : 'border-gray-300 text-gray-700 hover:border-indigo-300 hover:text-indigo-500'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              {!selectedSize && (
                <p className="text-xs text-amber-500 mt-1.5">Please select a size</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleAddToCart}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                added
                  ? 'bg-green-500 text-white scale-95'
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white hover:shadow-lg'
              }`}
            >
              <FiShoppingCart size={16} />
              {added ? '✓ Added to Bag' : 'Add to Bag'}
            </button>
            <button
              onClick={() => setWishlisted((w) => !w)}
              className={`flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-xl border-2 font-semibold text-sm transition-all duration-200 ${
                wishlisted
                  ? 'border-pink-400 bg-pink-50 text-pink-500'
                  : 'border-gray-300 text-gray-600 hover:border-pink-300 hover:text-pink-400'
              }`}
            >
              <FiHeart size={16} className={wishlisted ? 'fill-pink-500' : ''} />
              Wishlist
            </button>
          </div>

          {/* Delivery placeholder */}
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Delivery Options</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter pincode"
                maxLength={10}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button className="px-4 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                Check
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
