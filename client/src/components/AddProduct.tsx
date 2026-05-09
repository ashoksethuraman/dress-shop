import React, { useState, useRef, useEffect } from 'react';
import { FiUpload, FiX, FiPlus } from 'react-icons/fi';
import { productsApi } from '../services/apiClient';
import { uploadImages, uploadSizeChart, checkImageSize } from '../services/imageService';
import { resolveImageUrl } from '../config/imageConfig';
import { StockStatus } from '../utils/types';
import { useAppDispatch } from '../store/hooks';
import { dressShopApi } from '../store/apiSlice';
import AlertModal from './AlertModal';
import Loader from './Loader';
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const MAX_IMAGES = 5;

type Props = { onAdded?: () => void; productToEdit?: any; onSaved?: (id: string) => void };

interface FieldErrors {
  title?: string;
  productCode?: string;
  description?: string;
  shippingAndDelivery?: string;
  exchangeAndReturns?: string;
  price?: string;
  sizes?: string;
  images?: string;
  stock?: string;
}

function validate(
  title: string,
  productCode: string,
  description: string,
  shippingAndDelivery: string,
  exchangeAndReturns: string,
  price: string,
  sizes: string[],
  imageCount: number,
  stockMode: 'available' | 'out_of_stock',
): FieldErrors {
  const errs: FieldErrors = {};
  if (!title.trim()) errs.title = 'Product name is required.';
  else if (title.trim().length < 3) errs.title = 'Product name must be at least 3 characters.';
  else if (title.trim().length > 100) errs.title = 'Product name must be 100 characters or fewer.';

  if (!productCode.trim()) errs.productCode = 'Product code is required.';
  else if (productCode.trim().length < 2) errs.productCode = 'Product code must be at least 2 characters.';

  if (!description.trim()) errs.description = 'Description is required.';
  else if (description.trim().length < 10) errs.description = 'Description must be at least 10 characters.';

  if (!shippingAndDelivery.trim()) errs.shippingAndDelivery = 'Shipping & delivery is required.';
  else if (shippingAndDelivery.trim().length < 3) errs.shippingAndDelivery = 'Shipping & delivery must be at least 3 characters.';

  if (!exchangeAndReturns.trim()) errs.exchangeAndReturns = 'Exchange & returns is required.';
  else if (exchangeAndReturns.trim().length < 3) errs.exchangeAndReturns = 'Exchange & returns must be at least 3 characters.';

  if (!price) errs.price = 'Price is required.';
  else if (Number(price) <= 0 || isNaN(Number(price))) errs.price = 'Price must be a number greater than 0.';

  if (sizes.length === 0) errs.sizes = 'Select at least one size.';

  if (imageCount === 0) errs.images = 'At least one image is required.';

  return errs;
}

export default function AddProductForm({ onAdded, productToEdit, onSaved }: Props) {
  const dispatch = useAppDispatch();
  const [title, setTitle] = useState('');
  const [productCode, setProductCode] = useState('');
  const [description, setDescription] = useState('');
  const [shippingAndDelivery, setShippingAndDelivery] = useState('');
  const [exchangeAndReturns, setExchangeAndReturns] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<'men' | 'women'>('women');
  const [sizeInventory, setSizeInventory] = useState<Record<string, number>>({});
  const [stockMode, setStockMode] = useState<'available' | 'out_of_stock'>('available');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [sizeChartFile, setSizeChartFile] = useState<File | null>(null);
  const [sizeChartPreview, setSizeChartPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Adding product…');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ id: string; name: string } | null>(null);
  // field-level errors shown after first submit attempt
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sizeChartRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { previews.forEach(URL.revokeObjectURL); if (sizeChartPreview) URL.revokeObjectURL(sizeChartPreview); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill when editing
  useEffect(() => {
    if (!productToEdit) return;
    setTitle(productToEdit.title ?? '');
    setProductCode(productToEdit.productCode ?? '');
    setDescription(productToEdit.description ?? '');
    setShippingAndDelivery(productToEdit.shippingAndDelivery ?? '');
    setExchangeAndReturns(productToEdit.exchangeAndReturns ?? '');
    setPrice(productToEdit.price ? String(productToEdit.price) : '');
    setCategory(productToEdit.category ?? 'women');
    setSizeInventory(productToEdit.sizeInventory ?? {});
    setStockMode(productToEdit.stock ?? 'available');
    setExistingImages(productToEdit.images ?? []);
    // sizeChart: resolve for display only (keep stored value unchanged)
    if (productToEdit.sizeChart) {
      try {
        const raw = decodeURIComponent(String(productToEdit.sizeChart));
        setSizeChartPreview(raw.startsWith('http') ? raw : resolveImageUrl(raw));
      } catch (e) {
        setSizeChartPreview(resolveImageUrl(String(productToEdit.sizeChart)));
      }
    }
  }, [productToEdit]);

  // Re-validate live once the user has hit submit once
  useEffect(() => {
    const totalImageCount = previews.length + existingImages.length;
    if (submitted) setFieldErrors(validate(title, productCode, description, shippingAndDelivery, exchangeAndReturns, price, Object.keys(sizeInventory), totalImageCount, stockMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, productCode, description, shippingAndDelivery, exchangeAndReturns, price, JSON.stringify(sizeInventory), previews.length, existingImages.length, submitted, stockMode]);

  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

  const handleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadError(null);
    if (files.length === 0) return;

    const badType = files.find((f) => !ALLOWED_MIME.includes(f.type));
    if (badType) {
      setUploadError(`"${badType.name}" is not allowed. Only JPEG, PNG, and WebP images are accepted.`);
      e.target.value = '';
      return;
    }

    const remaining = MAX_IMAGES - (imageFiles.length + existingImages.length);
    if (files.length > remaining) {
      setUploadError(
        `You can upload a maximum of ${MAX_IMAGES} images. ` +
        `${imageFiles.length + existingImages.length} already selected; only ${remaining} more allowed.`
      );
      e.target.value = '';
      return;
    }

    const MAX_RAW_BYTES = 250 * 1024; // 250 KB per image
    for (const file of files) {
      if (file.size > MAX_RAW_BYTES) {
        setUploadError(
          `"${file.name}" is ${Math.round(file.size / 1024)} KB — each product image must be under 250 KB.`
        );
        e.target.value = '';
        return;
      }
    }

    for (const file of files) {
      try { await checkImageSize(file); } catch (err: any) {
        setUploadError(err?.message ?? 'Image too large.');
        e.target.value = '';
        return;
      }
    }

    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setImageFiles((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  const handleSizeChart = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError(`"${file.name}" is not allowed. Only JPEG, PNG, and WebP images are accepted.`);
      e.target.value = '';
      return;
    }

    const MAX_RAW_BYTES = 250 * 1024; // 250 KB
    if (file.size > MAX_RAW_BYTES) {
      setUploadError(
        `Size chart "${file.name}" is ${Math.round(file.size / 1024)} KB — max allowed is 250 KB. Please compress or resize the image.`
      );
      e.target.value = '';
      return;
    }
    if (sizeChartPreview) URL.revokeObjectURL(sizeChartPreview);
    setSizeChartFile(file);
    setSizeChartPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const toggleSize = (s: string) =>
    setSizeInventory((prev) => {
      const next = { ...prev };
      if (s in next) delete next[s];
      else next[s] = 0;
      return next;
    });

  const setSizeQty = (s: string, qty: number) =>
    setSizeInventory((prev) => ({ ...prev, [s]: Math.max(0, qty) }));

  const removeImage = (i: number) => {
    // if removing from newly selected previews
    if (i < previews.length) {
      URL.revokeObjectURL(previews[i]);
      setImageFiles((prev) => prev.filter((_, idx) => idx !== i));
      setPreviews((prev) => prev.filter((_, idx) => idx !== i));
    } else {
      // existing image removal (when editing)
      const exIdx = i - previews.length;
      setExistingImages((prev) => prev.filter((_, idx) => idx !== exIdx));
    }
  };

  const getCombined = () => {
    const combined: Array<{ src: string; type: 'new' | 'existing'; file?: File }> = [];
    previews.forEach((src, i) => combined.push({ src, type: 'new', file: imageFiles[i] }));
    existingImages.forEach((src) => combined.push({ src, type: 'existing' }));
    return combined;
  };

  const displayImageSrc = (v: string) => {
    if (!v) return '';
    try {
      const raw = decodeURIComponent(v);
      if (raw.startsWith('http')) return raw;
      return resolveImageUrl(raw);
    } catch (e) {
      // fallback
      if (v.startsWith('http')) return v;
      return resolveImageUrl(v);
    }
  };

  const setFromCombined = (combined: Array<{ src: string; type: 'new' | 'existing'; file?: File }>) => {
    const newPreviews = combined.filter((c) => c.type === 'new').map((c) => c.src);
    const newFiles = combined.filter((c) => c.type === 'new').map((c) => c.file as File);
    const newExisting = combined.filter((c) => c.type === 'existing').map((c) => c.src);
    setPreviews(newPreviews);
    setImageFiles(newFiles);
    setExistingImages(newExisting);
  };
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const onDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    // small transparent image to avoid default ghosting in some browsers
    try {
      const img = new Image(); img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
      e.dataTransfer.setDragImage(img, 0, 0);
    } catch (err) { /* ignore */ }
  };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIndex(idx);
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const fromRaw = e.dataTransfer.getData('text/plain');
    const from = fromRaw ? Number(fromRaw) : null;
    setDragOverIndex(null);
    if (from === null || Number.isNaN(from)) return;
    if (from === idx) return;
    const combined = getCombined();
    const item = combined.splice(from, 1)[0];
    // when removing an earlier index, the target index shifts left by 1
    const adjustedIdx = from < idx ? idx - 1 : idx;
    combined.splice(adjustedIdx, 0, item);
    setFromCombined(combined);
  };

  const onDragEnd = () => setDragOverIndex(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const totalImageCount = previews.length + existingImages.length;
    const errs = validate(title, productCode, description, shippingAndDelivery, exchangeAndReturns, price, Object.keys(sizeInventory), totalImageCount, stockMode);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    // Don't proceed if an upload error is still showing — user must dismiss it first
    if (uploadError) return;

    setLoading(true);
    setLoadingLabel('Uploading images…');
    setApiError(null);
    setSuccessInfo(null);
    try {
      const [uploadedImages, uploadedSizeChart] = await Promise.all([
        uploadImages(imageFiles, category, title),
        sizeChartFile ? uploadSizeChart(sizeChartFile) : Promise.resolve(undefined),
      ]);
      console.log('uploaded images  ::', uploadedImages, uploadedSizeChart)
      setLoadingLabel('Saving product…');
      const stockValue: StockStatus = stockMode;
      const savedTitle = title.trim();
      if (productToEdit) {
        const payload: any = {
          title: savedTitle,
          description: description.trim(),
          shippingAndDelivery: shippingAndDelivery.trim(),
          exchangeAndReturns: exchangeAndReturns.trim(),
          price: Number(price),
          category,
          sizes: Object.keys(sizeInventory),
          sizeInventory,
          images: [...existingImages, ...(uploadedImages || [])],
          stock: stockValue,
          productCode: productCode.trim(),
          ...(uploadedSizeChart ? { sizeChart: uploadedSizeChart } : {}),
        };
        await productsApi.update(productToEdit.id, payload);
        dispatch(dressShopApi.util.invalidateTags([
          { type: 'Product', id: 'LIST' },
          { type: 'Product', id: 'ADMIN_LIST' },
          { type: 'Product', id: productToEdit.id },
        ]));
        setSuccessInfo({ id: productToEdit.id, name: savedTitle });
        if (onSaved) onSaved(productToEdit.id);
      } else {
        const res = await productsApi.add({
          title: savedTitle,
          description: description.trim(),
          shippingAndDelivery: shippingAndDelivery.trim(),
          exchangeAndReturns: exchangeAndReturns.trim(),
          price: Number(price),
          category,
          sizes: Object.keys(sizeInventory),
          sizeInventory,
          images: uploadedImages,
          stock: stockValue,
          productCode: productCode.trim(),
          ...(uploadedSizeChart ? { sizeChart: uploadedSizeChart } : {}),
        });
        const addedId = res.id;
        // Bust RTK Query caches so public listing and admin view refresh immediately
        dispatch(dressShopApi.util.invalidateTags([
          { type: 'Product', id: 'LIST' },
          { type: 'Product', id: 'ADMIN_LIST' },
        ]));
        setSuccessInfo({ id: addedId, name: savedTitle });
      }
      // Form reset + onAdded() happen when user dismisses the success modal
    } catch (err: any) {
      const raw: string = err?.message ?? '';
      // Extract readable message after "API 4xx: " prefix if present
      const match = raw.match(/^API \d+:\s*(.+)/);
      const friendly = match ? match[1].trim() : raw || 'Upload failed. Please try again.';
      setApiError(friendly);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (hasError: boolean) =>
    'w-full border rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 ' +
    'focus:outline-none focus:ring-2 transition-all bg-gray-50 ' +
    (hasError
      ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
      : 'border-gray-200 focus:border-brand-dark focus:ring-brand');

  const errMsg = (msg?: string) =>
    msg ? <p className="mt-1 text-xs text-red-500">{msg}</p> : null;

    return (
    <>
      {/* Full-page loader overlay covering all upload + save activity */}
      {loading && <Loader fullPage label={loadingLabel} />}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-base font-bold text-primary mb-5 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-brand-dark rounded-full inline-block" />
          {productToEdit ? 'Edit Product' : 'Add New Product'}
        </h3>

        {/* Success popup modal */}
        {successInfo && (
          <AlertModal
            type="success"
            title={productToEdit ? 'Product Updated' : 'Product Added'}
            messages={[`"${successInfo.name}" ${productToEdit ? 'was updated' : 'was added'} successfully.`]}
            onClose={() => {
              setSuccessInfo(null);
              if (!productToEdit) {
                setTitle(''); setProductCode(''); setDescription(''); setPrice('');
                setImageFiles([]); setPreviews([]);
                setSizeChartFile(null); setSizeChartPreview(null);
                setCategory('women');
                setStockMode('available');
                setSizeInventory({});
                setShippingAndDelivery(''); setExchangeAndReturns('');
                setSubmitted(false); setFieldErrors({});
                onAdded && onAdded();
              }
            }}
          />
        )}

        {/* Error popup modal */}
        {apiError && (
          <AlertModal
            type="error"
            title="Failed to Add Product"
            messages={[apiError]}
            onClose={() => setApiError(null)}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* First Row: Product Name, Product Code, Price in same row */}
          <div className="md:col-span-2">
            <div className="grid grid-cols-12 gap-3">
              {/* Name */}
              <div className="col-span-12 md:col-span-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Product Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => submitted && setFieldErrors((p) => ({ ...p, ...validate(title, productCode, description, shippingAndDelivery, exchangeAndReturns, price, Object.keys(sizeInventory), previews.length + existingImages.length, stockMode) }))}
                  placeholder="e.g. Summer Floral Dress"
                  className={inputCls(!!fieldErrors.title)}
                />
                {errMsg(fieldErrors.title)}
              </div>

              {/* Product Code */}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Product Code <span className="text-red-400">*</span>
                </label>
                <input
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="e.g. SFD-001"
                  className={inputCls(!!fieldErrors.productCode)}
                />
                {errMsg(fieldErrors.productCode)}
              </div>

              {/* Price */}
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Price (INR) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className={inputCls(!!fieldErrors.price)}
                />
                {errMsg(fieldErrors.price)}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the product (at least 10 characters)…"
              rows={3}
              className={`${inputCls(!!fieldErrors.description)} resize-none`}
            />
            {errMsg(fieldErrors.description)}
          </div>

          {/* SHIPPING & DELIVERY  + EXCHANGE & RETURNS (single-row textareas) */}
          <div className="md:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  SHIPPING & DELIVERY <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={shippingAndDelivery}
                  onChange={(e) => setShippingAndDelivery(e.target.value)}
                  placeholder="Shipping & delivery details..."
                  rows={2}
                  className={`${inputCls(!!fieldErrors.shippingAndDelivery)} resize-none h-24`}
                />
                {errMsg(fieldErrors.shippingAndDelivery)}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  EXCHANGE & RETURNS <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={exchangeAndReturns}
                  onChange={(e) => setExchangeAndReturns(e.target.value)}
                  placeholder="Exchange & returns policy..."
                  rows={2}
                  className={`${inputCls(!!fieldErrors.exchangeAndReturns)} resize-none h-24`}
                />
                {errMsg(fieldErrors.exchangeAndReturns)}
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Category <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-3">
              {(['women', 'men'] as const).map((cat) => (
                <label
                  key={cat}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-all select-none
                  ${category === cat
                      ? 'border-brand-dark bg-brand text-brand-dark'
                      : 'border-gray-200 text-gray-500 hover:border-brand-dark'}`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat}
                    checked={category === cat}
                    onChange={() => setCategory(cat)}
                    className="hidden"
                  />
                  {cat === 'women' ? '👗 Women' : '👔 Men'}
                </label>
              ))}
            </div>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Stock Status <span className="text-red-400">*</span>
            </label>
            <select
              value={stockMode}
              onChange={(e) => setStockMode(e.target.value as 'available' | 'out_of_stock')}
              className={inputCls(!!fieldErrors.stock)}
            >
              <option value="available">Available</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
            {errMsg(fieldErrors.stock)}
          </div>

          {/* ── Left col: Image + Size Chart  |  Right col: Sizes + Qty ── */}
          {/* Left — Image */}
          <div className="flex flex-col gap-5">
            {/* Size Chart */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Size Chart <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-3 items-start">
                {sizeChartPreview && (
                  <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-gray-200 group/sc shrink-0">
                    <img src={sizeChartPreview} alt="size-chart" className="w-full h-full object-contain bg-gray-50" />
                    <button
                      type="button"
                      onClick={() => { if (sizeChartPreview) URL.revokeObjectURL(sizeChartPreview); setSizeChartFile(null); setSizeChartPreview(null); }}
                      className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/sc:opacity-100 transition-opacity"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                )}
                {!sizeChartPreview && (
                  <button
                    type="button"
                    onClick={() => sizeChartRef.current?.click()}
                    className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 flex flex-col items-center justify-center gap-1 hover:border-brand-dark hover:text-brand-dark transition-all text-xs font-medium shrink-0"
                  >
                    <FiUpload size={18} />
                    Upload Chart
                  </button>
                )}
              </div>
              <input ref={sizeChartRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleSizeChart} className="hidden" />
              <p className="text-xs text-gray-400 mt-1.5">Single size chart · max 250 KB · 1 image only</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Image <span className="text-red-400">*</span>
                {(previews.length + existingImages.length) > 0 && (
                  <span className="ml-1 text-brand-dark normal-case font-normal">({previews.length + existingImages.length}/{MAX_IMAGES})</span>
                )}
              </label>
              <div className="flex flex-wrap gap-3">
                {previews.map((src, i) => (
                  <div
                    key={`new-${i}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDrop={(e) => onDrop(e, i)}
                    onDragEnd={onDragEnd}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group/img shrink-0 ${dragOverIndex === i ? 'ring-2 ring-brand-dark' : ''}`}
                  >
                    <img src={src} alt={`preview-${i}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                ))}
                {existingImages.map((src, idx) => {
                  const overallIdx = previews.length + idx;
                  return (
                    <div
                      key={`existing-${idx}`}
                      draggable
                      onDragStart={(e) => onDragStart(e, overallIdx)}
                      onDragOver={(e) => onDragOver(e, overallIdx)}
                      onDrop={(e) => onDrop(e, overallIdx)}
                      onDragEnd={onDragEnd}
                      className={`relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group/img shrink-0 ${dragOverIndex === overallIdx ? 'ring-2 ring-brand-dark' : ''}`}
                    >
                      <img src={displayImageSrc(src)} alt={`existing-${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(overallIdx)}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  );
                })}
                {(previews.length + existingImages.length) < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all text-xs font-medium shrink-0
                    ${fieldErrors.images
                        ? 'border-red-300 text-red-400 hover:border-red-400'
                        : 'border-gray-300 text-gray-400 hover:border-brand-dark hover:text-brand-dark'}`}
                  >
                    <FiUpload size={18} />
                    Upload
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImages} className="hidden" />
              <p className="text-xs text-gray-400 mt-1.5">Max 5 images · 250 KB per image (1250 KB total) · JPEG</p>
              {errMsg(fieldErrors.images)}
              {uploadError && (
                <AlertModal
                  type="error"
                  title="Image Upload Error"
                  messages={[uploadError]}
                  onClose={() => setUploadError(null)}
                />
              )}
            </div>
          </div>

          {/* Right — Sizes + Quantity */}
          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Sizes <span className="text-red-400">*</span>
                {Object.keys(sizeInventory).length > 0 && <span className="ml-1 text-brand-dark normal-case font-normal">({Object.keys(sizeInventory).join(', ')})</span>}
              </label>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSize(s)}
                    className={`w-11 h-11 rounded-xl border-2 text-xs font-bold transition-all
                    ${s in sizeInventory
                        ? 'border-brand-dark bg-brand-dark text-white shadow-sm'
                        : fieldErrors.sizes
                          ? 'border-red-300 text-red-400 hover:border-red-400'
                          : 'border-gray-200 text-gray-600 hover:border-brand-dark hover:text-brand-dark'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {errMsg(fieldErrors.sizes)}
            </div>

            {Object.keys(sizeInventory).length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Quantity per Size
                </label>
                <div className="flex flex-wrap gap-5">
                  {Object.keys(sizeInventory).map((sz) => (
                    <div key={sz} className="flex flex-col items-center gap-1.5">
                      <span className="text-xs font-bold text-brand-dark bg-brand border border-brand-border px-2.5 py-0.5 rounded-lg">{sz}</span>
                      <input
                        type="number"
                        min={0}
                        value={sizeInventory[sz]}
                        onChange={(e) => setSizeQty(sz, parseInt(e.target.value) || 0)}
                        className="w-16 text-center border border-gray-200 rounded-lg py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-gray-50"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Set 0 if the size is out of stock.</p>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            All fields marked <span className="text-red-400">*</span> are required
          </div>
          <button
            type="submit"
            disabled={loading || !!uploadError || !!apiError}
            className="flex items-center gap-2 px-6 py-2.5 !rounded-full bg-brand-dark hover:bg-brand-hover text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiPlus size={15} />
            {loading ? (productToEdit ? 'Saving…' : 'Adding…') : (productToEdit ? 'Save Changes' : 'Add Product')}
          </button>
        </div>
      </form>
    </>
  );
}
