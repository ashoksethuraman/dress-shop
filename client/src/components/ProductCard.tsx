import React, { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addToCart } from '../store/cartSlice';
import { toggleWishlist } from '../store/wishlistSlice';
import { FiTrash2, FiEye, FiEdit2, FiHeart, FiShoppingCart, FiCheck } from 'react-icons/fi';
import { Product, AgeSize } from '../utils/types';
import { resolveImageUrl } from '../config/imageConfig';

/** Sum all values in inventory; returns null when no inventory data exists */
function totalStock(inventory?: Record<string, number>): number | null {
  if (!inventory) return null;
  const vals = Object.values(inventory);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

function stockLabel(p: { stock?: string; sizeInventory?: Record<string, number>; ageSizeInventory?: Record<AgeSize, number> }): { text: string; color: string } | null {
  const inventory = p.ageSizeInventory || p.sizeInventory;
  const total = totalStock(inventory);
  if (total === null) return p.stock === 'out_of_stock' ? { text: 'Out of Stock', color: 'text-red-500' } : null;
  if (total === 0) return { text: 'Out of Stock', color: 'text-red-500' };
  if (total < 3)   return { text: `Only ${total} item${total !== 1 ? 's' : ''} left!`, color: 'text-red-500' };
  if (total < 5)   return { text: 'Only a few items left!', color: 'text-orange-500' };
  return null;
}

interface Props {
  product: Product & { id: string };
  isAdmin?: boolean;
  onDelete?: (id: string, title: string, images: string[] | undefined, sizeChart: string | undefined) => void;
}

export default function ProductCard({ product: p, isAdmin, onDelete }: Props) {
  const dispatch = useAppDispatch();
  const wishlisted = useAppSelector((s) => s.wishlist.ids.includes(p.id));
  const currentIsAdmin = useAppSelector((s) => s.user.user?.isAdmin ?? false) || Boolean(isAdmin);
  const navigate = useNavigate();
  const cartItems  = useAppSelector((s) => s.cart.items);

  const images: string[] = React.useMemo(() => {
    const raw: string[] = p.images?.length ? p.images : p.image ? [p.image] : [];
    return raw.map(resolveImageUrl);
  }, [p.images, p.image]);

  const hasMultiple = images.length > 1;

  const [activeIdx,    setActiveIdx]    = useState(0);
  const [hovered,      setHovered]      = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError,    setSizeError]    = useState(false);
  const [cartError,    setCartError]    = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const isOutOfStock = p.stock === 'out_of_stock';
  const isChildProduct = p.category === 'boys' || p.category === 'girls';
  const hasSizes = isChildProduct ? (p.ageSizes?.length ?? 0) > 0 : (p.sizes?.length ?? 0) > 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    if (hasSizes && !selectedSize) { setSizeError(true); return; }

    // Check inventory for age sizes (children) or regular sizes (adults)
    if (selectedSize) {
      const inventory = isChildProduct ? p.ageSizeInventory : p.sizeInventory;
      if (inventory) {
        const available = inventory[selectedSize as any];
        if (available !== undefined) {
          if (available === 0) { 
            setCartError(`${isChildProduct ? 'Age' : 'Size'} ${selectedSize} is out of stock.`); 
            return; 
          }
          const alreadyInCart = cartItems.find(
            (i) => i.productId === p.id && 
                   (isChildProduct ? i.ageSize === selectedSize : i.size === selectedSize)
          )?.qty ?? 0;
          if (alreadyInCart >= available) {
            setCartError(`Only ${available} unit${available !== 1 ? 's' : ''} left in ${isChildProduct ? 'age' : 'size'} ${selectedSize}.`);
            return;
          }
        }
      }
    }

    setCartError(null);
    dispatch(addToCart({
      productId: p.id,
      title: p.title,
      price: p.price,
      qty: 1,
      category: p.category,
      size: isChildProduct ? null : selectedSize,
      ageSize: isChildProduct ? (selectedSize as AgeSize) : null,
      stock: p.stock ?? 'available',
      maxQty: selectedSize ? (isChildProduct ? p.ageSizeInventory?.[selectedSize as AgeSize] : p.sizeInventory?.[selectedSize]) : undefined,
    }));
    setAdding(true);
    setSelectedSize(null);
    setSizeError(false);
    setTimeout(() => setAdding(false), 600);
  };

  const stock = stockLabel(p);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Admin delete */}
      {isAdmin && onDelete && (
        <button
          onClick={() => onDelete(p.id, p.title, p.images ?? [], p.sizeChart)}
          className="absolute top-2 right-2 z-20 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          title="Delete product"
        >
          <FiTrash2 size={12} />
        </button>
      )}

      {/* Image area with 3:4 aspect ratio (portrait) */}
      <div className="relative w-full aspect-[3/4] bg-gray-100 overflow-hidden shrink-0">
        {images.length > 0 ? (
          <>
            {images.map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt={`${p.title} ${idx + 1}`}
                className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${
                  idx === activeIdx ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}

            {hasMultiple && (
              <div className={`absolute bottom-2 left-0 right-0 flex justify-center gap-1 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
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

            {hasMultiple && (
              <span className="absolute top-2 left-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {activeIdx + 1}/{images.length}
              </span>
            )}

            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide shadow-lg">
                  Out of Stock
                </span>
              </div>
            )}

            <Link
              to={`/product/${p.id}`}
              className={`absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors duration-300 no-underline ${hovered ? 'pointer-events-auto' : 'pointer-events-none'}`}
            >
              <span className={`flex items-center gap-1.5 bg-white/90 text-brand-dark text-xs font-semibold px-3 py-1.5 rounded-full shadow transition-all duration-300 ${hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                <FiEye size={12} /> Quick View
              </span>
            </Link>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">👗</div>
        )}
      </div>

      {/* Content ~35% */}
      <div className="px-2 sm:px-3 pt-2 sm:pt-2.5 pb-2 sm:pb-3 flex flex-col gap-0.5 sm:gap-1">

        <h4 className="font-semibold text-xs sm:text-sm text-primary leading-snug truncate">{p.title}</h4>

        {/* Category + sizes/ages */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
          {p.category && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize shrink-0 ${
              p.category === 'women' ? 'bg-pink-50 text-pink-600' : 
              p.category === 'men' ? 'bg-blue-50 text-blue-600' :
              p.category === 'girls' ? 'bg-rose-50 text-rose-600' :
              'bg-sky-50 text-sky-600'
            }`}>
              {p.category === 'women' ? '👗' : p.category === 'men' ? '👔' : p.category === 'girls' ? '👧' : '👦'} {p.category}
            </span>
          )}
          {hasSizes && (isChildProduct ? p.ageSizes! : p.sizes!).map((sz) => {
            const inv = isChildProduct ? p.ageSizeInventory?.[sz as AgeSize] : p.sizeInventory?.[sz];
            const sizeOos = inv !== undefined && inv === 0;
            return (
              <button
                key={sz}
                disabled={sizeOos}
                onClick={() => { if (!sizeOos) { setSelectedSize(sz); setSizeError(false); setCartError(null); } }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                  sizeOos
                    ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed line-through'
                    : selectedSize === sz
                    ? 'bg-brand-dark border-brand-dark text-white'
                    : sizeError
                    ? 'border-red-300 text-gray-500'
                    : 'border-gray-200 text-gray-500 hover:border-brand-dark hover:text-brand-dark'
                }`}
                title={sizeOos ? 'Out of stock' : undefined}
              >
                {sz}
              </button>
            );
          })}
        </div>

        {/* Inline messages */}
        {sizeError && <p className="text-[10px] text-red-500 leading-none">Please select a {isChildProduct ? 'age' : 'size'}</p>}
        {cartError && <p className="text-[10px] text-red-500 leading-none truncate">{cartError}</p>}
        {stock     && <p className={`text-[10px] font-semibold leading-none ${stock.color}`}>{stock.text}</p>}

        {/* Price + action icons */}
        <div className="flex items-center justify-between mt-0.5">
          <span className="font-bold text-accent text-xs sm:text-sm leading-none">
            &#8377;{p.price.toFixed(0)} <span className="text-[9px] text-gray-500 font-normal">(GST incl.)</span>
          </span>

          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Admin edit button */}
            {currentIsAdmin && (
              <div className="mr-0.5 sm:mr-1">
                <button
                  onClick={() => navigate(`/admin/product/${p.id}`)}
                  title="Edit product"
                  className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                   <FiEdit2 size={12} />
                </button>
              </div>
            )}
            {/* Wishlist */}
            <div className="relative group/wish">
              <button
                onClick={() => dispatch(toggleWishlist(p.id))}
                className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 !rounded-full border transition-colors ${
                  wishlisted
                    ? 'bg-rose-50 border-rose-300 text-rose-500'
                    : 'border-gray-200 text-gray-400 hover:border-rose-300 hover:text-rose-400'
                }`}
              >
                <FiHeart size={12} className={wishlisted ? 'fill-rose-500' : ''} />
              </button>
              <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover/wish:opacity-100 transition-opacity z-20">
                {wishlisted ? 'Remove wishlist' : 'Wishlist'}
              </span>
            </div>

            {/* Add to cart */}
            <div className="relative group/cart">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 !rounded-full border transition-all ${
                  isOutOfStock
                    ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                    : adding
                    ? 'bg-green-500 border-green-500 text-white scale-95'
                    : 'bg-brand-dark border-brand-dark text-white hover:bg-brand-hover'
                }`}
              >
                {adding ? <FiCheck size={12} /> : <FiShoppingCart size={12} />}
              </button>
              <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover/cart:opacity-100 transition-opacity z-20">
                {isOutOfStock ? 'Out of stock' : 'Add to cart'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
