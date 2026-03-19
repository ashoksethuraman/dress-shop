import React, { useState, useRef } from 'react';
import { FiUpload, FiX, FiPlus } from 'react-icons/fi';
import { firestoreService } from '../services/firestoreService';
import { Product } from '../utils/types';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

type Props = { onAdded: () => void };

/** Compress a File to a JPEG data-URL, max 400px on longest side */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 400;
      let { width, height } = img;
      if (width > height && width > MAX) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      } else if (height > MAX) {
        width = Math.round((width * MAX) / height);
        height = MAX;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.src = url;
  });
}

export default function AdminProductForm({ onAdded }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<'men' | 'women'>('women');
  const [sizes, setSizes] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const compressed = await Promise.all(files.map(compressImage));
    setImages((prev) => [...prev, ...compressed]);
    e.target.value = '';
  };

  const toggleSize = (s: string) =>
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const removeImage = (i: number) =>
    setImages((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price) return;
    setLoading(true);
    const product: Product = {
      id: 'p' + Date.now(),
      title,
      description,
      price: Number(price),
      category,
      sizes,          // stored as array field
      images,         // stored as array field
      image: images[0] || '',
    };
    await firestoreService.addProduct(product);
    setTitle(''); setDescription(''); setPrice('');
    setSizes([]); setImages([]); setCategory('women');
    setLoading(false);
    onAdded();
  };

  const inputCls =
    'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 ' +
    'focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-gray-50';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6">
      <h3 className="text-base font-bold text-primary mb-5 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-indigo-500 rounded-full inline-block" />
        Add New Product
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Product Name <span className="text-red-400">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Summer Floral Dress"
            required
            className={inputCls}
          />
        </div>

        {/* Price */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Price (USD) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            required
            className={inputCls}
          />
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the product…"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Category</label>
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

        {/* Sizes */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Sizes{sizes.length > 0 && <span className="ml-1 text-indigo-500 normal-case">({sizes.join(', ')})</span>}
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
                    : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-500'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Images */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Images{images.length > 0 && <span className="ml-1 text-indigo-500 normal-case">({images.length} selected)</span>}
          </label>
          <div className="flex flex-wrap gap-3">
            {images.map((src, i) => (
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
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 flex flex-col items-center justify-center gap-1 transition-all text-xs font-medium shrink-0"
            >
              <FiUpload size={18} />
              Upload
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
          <p className="text-xs text-gray-400 mt-1.5">Images are compressed to 400px thumbnails for storage.</p>
        </div>
      </div>

      {/* Submit */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          Required fields <span className="text-red-400">*</span>
        </div>
        <button
          type="submit"
          disabled={loading || !title || !price}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FiPlus size={15} />
          {loading ? 'Adding…' : 'Add Product'}
        </button>
      </div>
    </form>
  );
}
