import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGetProductByIdQuery } from '../store/apiSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addToCart } from '../store/cartSlice';
import { toggleWishlist } from '../store/wishlistSlice';
import { getPriceLevel, BADGE_COLORS } from '../utils/priceLevel';
import { formatPrice } from '../utils/format';
import { FiChevronLeft, FiChevronRight, FiShoppingCart, FiStar, FiHeart } from 'react-icons/fi';
import { resolveImageUrl } from '../config/imageConfig';

export default function ProductDetailsPage() {
  const { id } = useParams();
  const [activeImg, setActiveImg]       = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError]       = useState(false);
  const [added, setAdded]               = useState(false);
  const dispatch = useAppDispatch();
  const wishlisted = useAppSelector((s) => s.wishlist.ids.includes(id ?? ''));
  const cartItems = useAppSelector((s) => s.cart.items);
  const [cartError, setCartError]        = useState<string | null>(null);

  const { data: product, isLoading } = useGetProductByIdQuery(id!, { skip: !id });

  if (isLoading || !product) return (
    <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse text-lg">Loading…</div>
  );

  const images: string[] = (product.images?.length ? product.images : product.image ? [product.image] : []).map(resolveImageUrl);
  const level = getPriceLevel(product.price);
  const hasMultiple = images.length > 1;

  const prevImg = () => setActiveImg((i) => (i - 1 + images.length) % images.length);
  const nextImg = () => setActiveImg((i) => (i + 1) % images.length);

  const handleAddToCart = () => {
    const hasSizes = product.sizes && product.sizes.length > 0;
    if (hasSizes && !selectedSize) {
      setSizeError(true);
      return;
    }

    // Inventory check for selected size
    if (selectedSize && product.sizeInventory) {
      const available = product.sizeInventory[selectedSize];
      if (available !== undefined) {
        if (available === 0) {
          setCartError(`Size ${selectedSize} is currently out of stock.`);
          return;
        }
        const alreadyInCart = cartItems.find(
          (i) => i.productId === product.id && i.size === selectedSize
        )?.qty ?? 0;
        if (alreadyInCart >= available) {
          setCartError(`Only ${available} unit${available !== 1 ? 's' : ''} available in size ${selectedSize}.`);
          return;
        }
      }
    }

    setCartError(null);
    const available = selectedSize ? (product.sizeInventory?.[selectedSize]) : undefined;
    dispatch(addToCart({
      productId: product.id, title: product.title, price: product.price, qty: 1,
      size: selectedSize, stock: product.stock ?? 'available',
      maxQty: available,
    }));
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
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
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
            <span className="text-3xl font-extrabold text-indigo-600">{formatPrice(product.price)}</span>
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
                {product.sizes.map((sz: string) => {
                  const inv = product.sizeInventory?.[sz];
                  const sizeOos = inv !== undefined && inv === 0;
                  return (
                    <button
                      key={sz}
                      disabled={sizeOos}
                      onClick={() => { if (!sizeOos) { setSelectedSize(sz); setSizeError(false); setCartError(null); } }}
                      className={`w-12 h-12 rounded-full border-2 text-sm font-semibold transition-all duration-150 ${
                        sizeOos
                          ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                          : selectedSize === sz
                          ? 'border-indigo-500 bg-indigo-500 text-white shadow-md scale-105'
                          : sizeError
                          ? 'border-red-400 text-gray-700 hover:border-indigo-300 hover:text-indigo-500'
                          : 'border-gray-300 text-gray-700 hover:border-indigo-300 hover:text-indigo-500'
                      }`}
                      title={sizeOos ? 'Out of stock' : undefined}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
              {sizeError && (
                <p className="text-xs text-red-500 font-medium mt-1.5">Please select a size before adding to bag.</p>
              )}
            </div>
          )}

          {/* Out-of-stock banner */}
          {product.stock === 'out_of_stock' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              This product is currently out of stock.
            </div>
          )}

          {/* Action buttons */}
          {cartError && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {cartError}
            </div>
          )}
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 'out_of_stock'}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                product.stock === 'out_of_stock'
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : added
                  ? 'bg-green-500 text-white scale-95'
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white hover:shadow-lg'
              }`}
            >
              <FiShoppingCart size={16} />
              {product.stock === 'out_of_stock' ? 'Out of Stock' : added ? '\u2713 Added to Bag' : 'Add to Bag'}
            </button>
            <button
              onClick={() => dispatch(toggleWishlist(product.id))}
              className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border-2 font-bold text-sm transition-all duration-200 ${
                wishlisted
                  ? 'bg-rose-50 border-rose-300 text-rose-500 hover:bg-rose-100'
                  : 'border-gray-200 text-gray-500 hover:border-rose-300 hover:text-rose-500'
              }`}
              title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <FiHeart size={16} className={wishlisted ? 'fill-rose-500' : ''} />
              {wishlisted ? 'Wishlisted' : 'Wishlist'}
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
