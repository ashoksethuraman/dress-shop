import React, { useState, useRef, useEffect } from 'react';
import { FiUpload, FiX, FiPlus } from 'react-icons/fi';
import { firestoreService, invalidateProductsCache } from '../services/firestoreService';
import { productsApi } from '../services/apiClient';
import { uploadImages, checkImageSize } from '../services/imageService';
import { Product, StockStatus } from '../utils/types';
import Alert from './Alert';
import Loader from './Loader';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const MAX_IMAGES = 5;

type Props = { onAdded: () => void };

interface FieldErrors {
  title?: string;
  description?: string;
  price?: string;
  sizes?: string;
  images?: string;
  stock?: string;
}

function validate(
  title: string,
  description: string,
  price: string,
  sizes: string[],
  imageCount: number,
  stockMode: 'available' | 'out_of_stock',
): FieldErrors {
  const errs: FieldErrors = {};
  if (!title.trim()) errs.title = 'Product name is required.';
  else if (title.trim().length < 3) errs.title = 'Product name must be at least 3 characters.';
  else if (title.trim().length > 100) errs.title = 'Product name must be 100 characters or fewer.';

  if (!description.trim()) errs.description = 'Description is required.';
  else if (description.trim().length < 10) errs.description = 'Description must be at least 10 characters.';

  if (!price) errs.price = 'Price is required.';
  else if (Number(price) <= 0 || isNaN(Number(price))) errs.price = 'Price must be a number greater than 0.';

  if (sizes.length === 0) errs.sizes = 'Select at least one size.';

  if (imageCount === 0) errs.images = 'At least one image is required.';

  return errs;
}

export default function AddProductForm({ onAdded }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<'men' | 'women'>('women');
  const [sizes, setSizes] = useState<string[]>([]);
  const [stockMode, setStockMode] = useState<'available' | 'out_of_stock'>('available');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ id: string; name: string } | null>(null);
  // field-level errors shown after first submit attempt
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { previews.forEach(URL.revokeObjectURL); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-validate live once the user has hit submit once
  useEffect(() => {
    if (submitted) setFieldErrors(validate(title, description, price, sizes, imageFiles.length, stockMode));
  }, [title, description, price, sizes, imageFiles.length, submitted, stockMode]);

  const handleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadError(null);

    const remaining = MAX_IMAGES - imageFiles.length;
    if (files.length > remaining) {
      setUploadError(
        `You can upload a maximum of ${MAX_IMAGES} images. ` +
        `${imageFiles.length} already selected; only ${remaining} more allowed.`
      );
      e.target.value = '';
      return;
    }

    const MAX_RAW_BYTES = 60 * 1024; // 60 KB
    for (const file of files) {
      if (file.size > MAX_RAW_BYTES) {
        setUploadError(
          `"${file.name}" is ${Math.round(file.size / 1024)} KB — each image must be under 60 KB. ` +
          `Please resize or compress the image before uploading.`
        );
        e.target.value = '';
        return;
      }
    }

    for (const file of files) {
      try {
        await checkImageSize(file);
      } catch (err: any) {
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

  const toggleSize = (s: string) =>
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const removeImage = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setImageFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(title, description, price, sizes, imageFiles.length, stockMode);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setUploadError(null);
    setApiError(null);
    setSuccessInfo(null);
    try {
      const uploadedImages = await uploadImages(imageFiles, category, title);
      const stockValue: StockStatus = stockMode;
      const savedTitle = title.trim();
      const product: Product = {
        id: 'p' + Date.now(),
        title: savedTitle,
        description: description.trim(),
        price: Number(price),
        category,
        sizes,
        images: uploadedImages,
        image: uploadedImages[0] || '',
        stock: stockValue,
      };
      let addedId: string = product.id;
      try {
        const res = await productsApi.add({
          title: savedTitle, description: description.trim(),
          price: Number(price), category, sizes, images: uploadedImages,
          stock: stockValue,
        });
        addedId = res.id;
      } catch (apiErr: any) {
        // Fall back to Firestore direct write
        const added = await firestoreService.addProduct(product);
        addedId = added.id;
      }
      invalidateProductsCache();
      setSuccessInfo({ id: addedId, name: savedTitle });
      setTitle(''); setDescription(''); setPrice('');
      setSizes([]); setImageFiles([]); setPreviews([]); setCategory('women');
      setStockMode('available');
      setSubmitted(false); setFieldErrors({});
      onAdded();
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
      : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-100');

  const errMsg = (msg?: string) =>
    msg ? <p className="mt-1 text-xs text-red-500">{msg}</p> : null;

  return (
    <>
      {loading && <Loader fullPage label="Adding product…" />}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6">
      <h3 className="text-base font-bold text-primary mb-5 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-indigo-500 rounded-full inline-block" />
        Add New Product
      </h3>

      {/* Success / Error feedback */}
      {successInfo && (
        <div className="mb-4">
          <Alert
            type="success"
            message={`Product "${successInfo.name}" added successfully! (ID: ${successInfo.id})`}
            onClose={() => setSuccessInfo(null)}
          />
        </div>
      )}
      {apiError && (
        <div className="mb-4">
          <Alert
            type="error"
            message={apiError}
            onClose={() => setApiError(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Product Name <span className="text-red-400">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => submitted && setFieldErrors((p) => ({ ...p, ...validate(title, description, price, sizes, imageFiles.length, stockMode) }))}
            placeholder="e.g. Summer Floral Dress"
            className={inputCls(!!fieldErrors.title)}
          />
          {errMsg(fieldErrors.title)}
        </div>

        {/* Price */}
        <div>
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
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                    : 'border-gray-200 text-gray-500 hover:border-indigo-200'}`}
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

        {/* Sizes */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Sizes <span className="text-red-400">*</span>
            {sizes.length > 0 && <span className="ml-1 text-indigo-500 normal-case font-normal">({sizes.join(', ')})</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSize(s)}
                className={`w-11 h-11 rounded-xl border-2 text-xs font-bold transition-all
                  ${sizes.includes(s)
                    ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                    : fieldErrors.sizes
                      ? 'border-red-300 text-red-400 hover:border-red-400'
                      : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-500'}`}
              >
                {s}
              </button>
            ))}
          </div>
          {errMsg(fieldErrors.sizes)}
        </div>

        {/* Images */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Images <span className="text-red-400">*</span>
            {imageFiles.length > 0 && (
              <span className="ml-1 text-indigo-500 normal-case font-normal">
                ({imageFiles.length}/{MAX_IMAGES})
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group/img shrink-0">
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
            {imageFiles.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all text-xs font-medium shrink-0
                  ${fieldErrors.images
                    ? 'border-red-300 text-red-400 hover:border-red-400'
                    : 'border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500'}`}
              >
                <FiUpload size={18} />
                Upload
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
          <p className="text-xs text-gray-400 mt-1.5">
            Max {MAX_IMAGES} images · 60 KB per image (up to 300 KB total) · 400 px JPEG
          </p>
          {errMsg(fieldErrors.images)}
          {uploadError && (
            <Alert
              type="error"
              message={uploadError}
              onClose={() => setUploadError(null)}
            />
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
          disabled={loading || !!uploadError}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FiPlus size={15} />
          {loading ? 'Adding…' : 'Add Product'}
        </button>
      </div>
    </form>
    </>
  );
}
