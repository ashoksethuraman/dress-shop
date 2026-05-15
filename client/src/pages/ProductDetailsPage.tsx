import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useGetProductByIdQuery } from '../store/apiSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addToCart } from '../store/cartSlice';
import { toggleWishlist } from '../store/wishlistSlice';
import { getPriceLevel, BADGE_COLORS } from '../utils/priceLevel';
import { formatPrice } from '../utils/format';
import {
  FiChevronLeft, FiChevronRight, FiShoppingCart, FiHash, FiHeart, FiShare2,
  FiMinus, FiPlus, FiZoomIn, FiChevronDown, FiX, FiEdit2, FiTruck, FiClock, FiSend
} from 'react-icons/fi';
import { resolveImageUrl } from '../config/imageConfig';

/** Sum all values in sizeInventory; returns null when no inventory data exists */
function totalStock(sizeInventory?: Record<string, number>): number | null {
  if (!sizeInventory) return null;
  const vals = Object.values(sizeInventory);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

/* ─── Accordion ─────────────────────────────────────────────────────────── */
function Accordion({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className={`transition-colors duration-200 ${open ? 'bg-gray-50/60' : 'bg-white hover:bg-gray-50/40'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left group"
      >
        <span className="flex items-center gap-3">
          <span className="text-lg leading-none">{icon}</span>
          <span className={`text-sm font-semibold tracking-wide transition-colors duration-200 ${open ? 'text-brand-dark' : 'text-gray-800 group-hover:text-brand-dark'}`}>
            {title}
          </span>
        </span>
        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${open ? 'bg-brand-dark text-white rotate-180' : 'bg-gray-100 text-gray-400 group-hover:bg-brand text-gray-600'}`}>
          <FiChevronDown size={13} />
        </span>
      </button>

      {/* Animated content panel */}
      <div
        style={{
          maxHeight: open ? (contentRef.current ? contentRef.current.scrollHeight + 32 : 500) : 0,
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
        }}
      >
        <div ref={contentRef} className="px-5 pb-5 text-sm text-gray-600 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Size-chart lightbox ────────────────────────────────────────────────── */
function SizeChartModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
        >
          <FiX size={16} />
        </button>
        <img src={url} alt="Size chart" className="w-full h-auto max-h-[80vh] object-contain" />
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function ProductDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeImg, setActiveImg] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  const dispatch = useAppDispatch();
  const wishlisted = useAppSelector((s) => s.wishlist.ids.includes(id ?? ''));
  const cartItems = useAppSelector((s) => s.cart.items);
  const isAdmin = useAppSelector((s) => s.user.user?.isAdmin ?? false);

  const { data: product, isLoading } = useGetProductByIdQuery(id!, { skip: !id });

  // Share menu state (hooks must be called unconditionally before any early return)
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (showShareMenu && shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showShareMenu]);

  if (isLoading || !product) return (
    <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse text-lg">Loading…</div>
  );

  const images: string[] = (product.images?.length ? product.images : product.image ? [product.image] : []).map(resolveImageUrl);
  const level = getPriceLevel(product.price);
  const hasMultiple = images.length > 1;

  const prevImg = () => setActiveImg((i) => (i - 1 + images.length) % images.length);
  const nextImg = () => setActiveImg((i) => (i + 1) % images.length);

  /** Returns an error string or null if stock is fine.
   *  forBuyNow=true skips the alreadyInCart check so Buy Now always
   *  proceeds based purely on what the user wants to buy right now. */
  const stockCheck = (forBuyNow = false): string | null => {
    const hasSizes = product.sizes && product.sizes.length > 0;
    if (hasSizes && !selectedSize) return '__size';
    if (selectedSize && product.sizeInventory) {
      const available = product.sizeInventory[selectedSize];
      if (available !== undefined) {
        if (available === 0) return `Size ${selectedSize} is currently out of stock.`;
        const alreadyInCart = forBuyNow
          ? 0
          : (cartItems.find(
            (i) => i.productId === product.id && i.size === selectedSize
          )?.qty ?? 0);
        if (alreadyInCart + qty > available)
          return `Only ${available} unit${available !== 1 ? 's' : ''} available in size ${selectedSize}.`;
      }
    }
    return null;
  };

  const maxAvailable = (): number => {
    if (selectedSize && product.sizeInventory) {
      const av = product.sizeInventory[selectedSize];
      if (av !== undefined) return av;
    }
    return 99;
  };

  const handleAddToCart = () => {
    const err = stockCheck();
    if (err === '__size') { setSizeError(true); return; }
    if (err) { setCartError(err); return; }
    setCartError(null);
    const available = selectedSize ? (product.sizeInventory?.[selectedSize]) : undefined;
    dispatch(addToCart({
      productId: product.id, title: product.title, price: product.price, qty,
      size: selectedSize, stock: product.stock ?? 'available', maxQty: available,
    }));
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const handleBuyNow = () => {
    // forBuyNow=true: ignore how many units are already sitting in cart
    const err = stockCheck(true);
    if (err === '__size') { setSizeError(true); return; }
    if (err) { setCartError(err); return; }
    setCartError(null);
    const available = selectedSize ? (product.sizeInventory?.[selectedSize]) : undefined;
    // Go to order summary with only this item — don't touch the cart
    navigate('/order-summary', {
      state: {
        buyNowItem: {
          productId: product.id, title: product.title, price: product.price, qty,
          size: selectedSize ?? null, stock: product.stock ?? 'available', maxQty: available,
        },
      },
    });
  };

  const changeQty = (delta: number) => {
    setQty((q) => Math.min(Math.max(1, q + delta), maxAvailable()));
  };

  const sizeChartUrl = product.sizeChart ? resolveImageUrl(product.sizeChart) : null;

  const tryNativeShare = async () => {
    const payload = {
      title: product?.title ?? '',
      text: product?.description ?? product?.title ?? '',
      url: window.location.href,
    };
    if ((navigator as any).share) {
      try {
        await (navigator as any).share(payload);
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  };

  const handleShareClick = async () => {
    const ok = await tryNativeShare();
    if (!ok) setShowShareMenu((s) => !s);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowShareMenu(false);
    } catch (e) {
      // fallback: prompt
      // eslint-disable-next-line no-alert
      window.prompt('Copy link', window.location.href);
      setShowShareMenu(false);
    }
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(product?.title ?? '');
    const body = encodeURIComponent(`${product?.description ?? ''}\n\n${window.location.href}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setShowShareMenu(false);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${product?.title ?? ''} - ${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setShowShareMenu(false);
  };

  // Derive overall OOS from sizeInventory (more accurate than product.stock field)
  const totalStockVal = totalStock(product.sizeInventory);
  const isProductOos = totalStockVal === 0 || (totalStockVal === null && product.stock === 'out_of_stock');

  // Per-selected-size stock for inline warning
  const selectedSizeStock: number | undefined =
    selectedSize && product.sizeInventory ? product.sizeInventory[selectedSize] : undefined;
  const selectedSizeFew = selectedSizeStock !== undefined && selectedSizeStock > 0 && selectedSizeStock < 3;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Size chart modal */}
      {sizeChartOpen && sizeChartUrl && (
        <SizeChartModal url={sizeChartUrl} onClose={() => setSizeChartOpen(false)} />
      )}

      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-dark no-underline transition-colors">
          <FiChevronLeft size={16} /> Back to shop
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* ── LEFT: Image Gallery ── */}
        <div className="flex flex-col gap-4">
          <div className="relative w-full aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden shadow-md group">
            {images.length > 0 ? (
              <>
                {images.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`${product.title} view ${idx + 1}`}
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${idx === activeImg ? 'opacity-100' : 'opacity-0'
                      }`}
                  />
                ))}
                {hasMultiple && (
                  <>
                    <button type="button" onClick={prevImg}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <FiChevronLeft size={18} />
                    </button>
                    <button type="button" onClick={nextImg}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <FiChevronRight size={18} />
                    </button>
                  </>
                )}
                {hasMultiple && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                    {images.map((_, idx) => (
                      <button key={idx} type="button" onClick={() => setActiveImg(idx)}
                        className={`rounded-full transition-all duration-200 ${idx === activeImg ? 'w-5 h-2 bg-brand-dark' : 'w-2 h-2 bg-white/70 hover:bg-white'}`}
                      />
                    ))}
                  </div>
                )}
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
                <button key={idx} type="button" onClick={() => setActiveImg(idx)}
                  className={`flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden border-2 transition-all duration-200 ${idx === activeImg ? 'border-brand-dark shadow-md scale-105' : 'border-transparent hover:border-brand-border opacity-70 hover:opacity-100'
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
              <div className="relative flex items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/product/${product.id}`)}
                    title="Edit product"
                    className="mr-2 mt-1 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                  >
                    <FiEdit2 size={14} className={wishlisted ? 'fill-rose-500' : ''} />
                  </button>
                )}
                {/* <span className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full mt-1 ${BADGE_COLORS[level.className] ?? 'bg-gray-100 text-gray-600'}`}>
                  {level.level}
                </span> */}

                <div ref={shareRef} className="relative">
                  <button
                    type="button"
                    onClick={handleShareClick}
                    title="Share"
                    className="ml-1 mt-1 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                  >
                    <FiShare2 size={21} />
                  </button>

                  {showShareMenu && (
                    <div className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg text-sm z-50">
                      <button onClick={copyLink} className="w-full text-left px-3 py-2 hover:bg-gray-50">Copy link</button>
                      <button onClick={shareEmail} className="w-full text-left px-3 py-2 hover:bg-gray-50">Share via Email</button>
                      <button onClick={shareWhatsApp} className="w-full text-left px-3 py-2 hover:bg-gray-50">Share to WhatsApp</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <FiHash className="text-yellow-400 fill-yellow-400" size={14} />
              <span className="font-semibold text-gray-700">SKU : </span>
              <span> {product.productCode}</span>
            </div>
          </div>

          {/* Price */}
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-brand-dark">{formatPrice(product.price)}</span>
              {/* {level.className === 'premium' && (
                <>
                  <span className="text-sm text-gray-400 line-through">₹{(product.price * 1.43).toFixed(0)}</span>
                  <span className="text-sm font-semibold text-orange-500">43% OFF</span>
                </>
              )} */}
            </div>
            <p className="text-xs text-green-600 font-medium mt-0.5">Shipping calculated at checkout.</p>
          </div>

          {/* Category */}
          {product.category && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Category:</span>
              <span className={`text-sm px-3 py-0.5 rounded-full font-semibold capitalize ${product.category === 'women' ? 'bg-pink-50 text-pink-500' : 'bg-blue-50 text-blue-500'
                }`}>{product.category}</span>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="text-base font-bold text-primary mb-2">Description</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Size selector */}
          {product.sizes && product.sizes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Select Size</h3>
                {sizeChartUrl ? (
                  <button type="button" onClick={() => setSizeChartOpen(true)}
                    className="flex items-center gap-1 text-xs text-brand-dark hover:text-brand-hover font-medium transition-colors">
                    <FiZoomIn size={13} /> Size Chart
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">Size Chart</span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map((sz: string) => {
                  const inv = product.sizeInventory?.[sz];
                  const sizeOos = inv !== undefined && inv === 0;
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={sizeOos}
                      onClick={() => { if (!sizeOos) { setSelectedSize(sz); setSizeError(false); setCartError(null); setQty(1); } }}
                      className={`w-12 h-12 rounded-full border-2 text-sm font-semibold transition-all duration-150 ${sizeOos
                        ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                        : selectedSize === sz
                          ? 'border-brand-dark bg-brand-dark text-white shadow-md scale-105'
                          : sizeError
                            ? 'border-red-400 text-gray-700 hover:border-brand-dark'
                            : 'border-gray-300 text-gray-700 hover:border-brand-dark hover:text-brand-dark'
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
              {/* Per-size stock warnings */}
              {!sizeError && selectedSizeFew && selectedSizeStock !== undefined && (
                <p className="flex items-center gap-1.5 text-xs text-orange-600 font-semibold mt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 animate-pulse" />
                  Only {selectedSizeStock} item{selectedSizeStock !== 1 ? 's' : ''} left in size {selectedSize}!
                </p>
              )}
              {!sizeError && selectedSizeStock === 0 && selectedSize && (
                <p className="flex items-center gap-1.5 text-xs text-red-600 font-semibold mt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  Size {selectedSize} is out of stock.
                </p>
              )}
            </div>
          )}

          {/* Out-of-stock / low-stock banner */}
          {(() => {
            const total = totalStock(product.sizeInventory);
            const isOos = total === 0 || (total === null && product.stock === 'out_of_stock');
            const isLow = total !== null && total > 0 && total < 3;
            const isFew = total !== null && total >= 3 && total < 5;
            if (isOos) return (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                This product is currently out of stock.
              </div>
            );
            if (isLow) return (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                Only {total} item{total !== 1 ? 's' : ''} left — order soon!
              </div>
            );
            if (isFew) return (
              <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-600 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 animate-pulse" />
                Only a few items left!
              </div>
            );
            return null;
          })()}

          {/* Quantity + Add to cart — same row */}
          {!isProductOos && (
            <div className="flex items-center gap-3">
              <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => changeQty(-1)}
                  disabled={qty <= 1}
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <FiMinus size={15} />
                </button>
                <span className="w-10 text-center text-sm font-bold text-gray-800">{qty}</span>
                <button
                  type="button"
                  onClick={() => changeQty(1)}
                  disabled={qty >= maxAvailable()}
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <FiPlus size={15} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${added
                  ? 'bg-brand-border text-white scale-95'
                  : 'bg-brand-dark hover:bg-brand-hover text-white'
                  }`}
              >
                <FiShoppingCart size={16} />
                {added ? '✓ Added' : 'Add to cart'}
              </button>
            </div>
          )}

          {/* Cart error */}
          {cartError && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium -mt-2">
              {cartError}
            </div>
          )}

          {/* Wishlist + Buy Now — same row */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch(toggleWishlist(product.id))}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-all duration-200 ${wishlisted
                ? 'bg-rose-50 border-rose-300 text-rose-500 hover:bg-rose-100'
                : 'border-gray-200 text-gray-500 hover:border-rose-300 hover:text-rose-500'
                }`}
              title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <FiHeart size={16} className={wishlisted ? 'fill-rose-500' : ''} />
              {wishlisted ? 'Wishlisted' : 'Wishlist'}
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={isProductOos}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${isProductOos
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-brand-dark hover:bg-brand-hover text-white hover:shadow-lg'
                }`}
            >
              Buy Now
            </button>
          </div>


          {/* Shipping Features Panel - Compact & Refined */}
          <div className="bg-black rounded-xl p-4 mt-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

              {/* Free Shipping */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-2">
                  <FiTruck className="w-8 h-8 text-white" />
                </div>
                <h4 className="font-semibold text-white text-xs mb-0.5">
                  Free Shipping
                </h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  On all orders above ₹999
                </p>
              </div>

              {/* Same Day Dispatch */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-2">
                  <FiClock className="w-8 h-8 text-white" />
                </div>
                <h4 className="font-semibold text-white text-xs mb-0.5">
                  Same Day Dispatch
                </h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Orders placed before 2 PM
                </p>
              </div>

              {/* Express Delivery */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-2">
                  <FiSend className="w-8 h-8 text-white" />
                </div>
                <h4 className="font-semibold text-white text-xs mb-0.5">
                  Express Delivery
                </h4>
                <p className="text-[10px] text-gray-400 leading-tight">
                  Available on request
                </p>
              </div>

            </div>
          </div>


          {/* ── Info Accordions ── */}
          <div className="mt-2 rounded-2xl overflow-hidden border border-gray-200 shadow-sm divide-y divide-gray-100">
            <Accordion title="Shipping Information" icon={<span>🚚</span>}>
              <p className="text-gray-500 text-justify">
                {product.shippingAndDelivery}
                {/* Your order dispatches in 1–2 working days. Delivery typically takes 2–4 days for South India and 4–6 days for North India.
                Tracking details are emailed once shipped. Please ensure your address is accurate to avoid delivery issues. */}
              </p>
            </Accordion>

            <Accordion title="Return Policy" icon={<span>↩️</span>}>
              <div className="space-y-2.5 text-gray-500 text-justify">
                {product.exchangeAndReturns}

              </div>
            </Accordion>
            <Accordion title="Wash Care" icon={<span>🧺</span>}>
              <ul className="space-y-2 text-justify">
                {['30°C Machine Wash', 'Wash With Similar Colours', 'Do Not Bleach', 'Tumble Dry Medium', 'Iron Low'].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-dark flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </Accordion>

            <Accordion title="Disclaimer" icon={<span>👁️</span>}>
              <p className="text-gray-500 text-justify">
                Actual color of the product may vary slightly due to photographic lighting sources or your device display settings.
              </p>
            </Accordion>


          </div>

        </div>
      </div>
    </div>
  );
}

