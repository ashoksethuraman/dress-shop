import React, { useState, useRef, useEffect } from 'react';
import { FiUpload, FiX, FiImage, FiTrash2, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { uploadHomeBanner, getSiteConfig, deleteHomeBanner } from '../../services/configService';
import AlertModal from '../AlertModal';
import Loader from '../Loader';
import type { SiteConfig } from '../../types/config';

export default function ConfigTab() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch current config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await getSiteConfig();
      setConfig(data);
    } catch (err: any) {
      console.error('Failed to load config:', err);
    }
  };

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const ALLOWED_MIME = [
    'image/jpeg',
    'image/jpg',    // Non-standard but commonly used
    'image/pjpeg',  // Progressive JPEG (older browsers)
    'image/png',
    'image/webp'
  ];

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate file type
    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError(
        `"${file.name}" was rejected (detected type: "${file.type || 'unknown'}"). ` +
        `Only JPEG, PNG, and WebP images are accepted.`
      );
      e.target.value = '';
      return;
    }

    // Validate file size (500KB max)
    const MAX_SIZE = 500 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError(
        `"${file.name}" is ${Math.round(file.size / 1024)} KB. Maximum allowed is 500 KB. Please compress the image.`
      );
      e.target.value = '';
      return;
    }

    // Clear old preview
    if (preview) URL.revokeObjectURL(preview);

    setImageFile(file);
    setPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!imageFile) return;

    setLoading(true);
    setLoadingLabel('Uploading banner...');
    setUploadError(null);
    setSuccessMessage(null);

    try {
      await uploadHomeBanner(imageFile);
      setSuccessMessage('Home banner uploaded successfully!');
      
      // Reload config to show new banner
      await loadConfig();
      
      // Clear preview
      if (preview) URL.revokeObjectURL(preview);
      setImageFile(null);
      setPreview(null);
    } catch (err: any) {
      const message = err?.message || 'Failed to upload banner. Please try again.';
      setUploadError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!config?.bannerImage) return;

    const confirmed = window.confirm('Are you sure you want to delete the current home banner?');
    if (!confirmed) return;

    setLoading(true);
    setLoadingLabel('Deleting banner...');
    setUploadError(null);
    setSuccessMessage(null);

    try {
      await deleteHomeBanner();
      setSuccessMessage('Home banner deleted successfully!');
      await loadConfig();
    } catch (err: any) {
      const message = err?.message || 'Failed to delete banner. Please try again.';
      setUploadError(message);
    } finally {
      setLoading(false);
    }
  };

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImageFile(null);
    setPreview(null);
  };

  return (
    <>
      {loading && <Loader fullPage label={loadingLabel} />}

      {successMessage && (
        <AlertModal
          type="success"
          title="Success"
          messages={[successMessage]}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {uploadError && (
        <AlertModal
          type="error"
          title="Upload Error"
          messages={[uploadError]}
          onClose={() => setUploadError(null)}
        />
      )}

      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 max-w-4xl overflow-x-hidden">
        <h3 className="text-sm sm:text-base font-bold text-primary mb-4 sm:mb-5 flex items-center gap-2">
          <span className="w-1.5 h-4 sm:h-5 bg-brand-dark rounded-full inline-block" />
          Site Configuration
        </h3>

        {/* Single Row Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
          
          {/* Current Banner */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Current Banner
            </label>
            
            {config?.bannerImage ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="relative h-24 bg-gray-100">
                  <img
                    src={config.bannerImage}
                    alt="Current banner"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2 bg-gray-50 flex items-center justify-between">
                  <div className="text-xs text-gray-600 flex-1 min-w-0">
                    <p className="truncate text-[10px]">Banner Image</p>
                  </div>
                  <button
                    onClick={handleDelete}
                    className="ml-2 p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    title="Delete banner"
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center h-[120px] flex flex-col items-center justify-center">
                <FiImage className="text-gray-400 mb-1" size={24} />
                <p className="text-xs text-gray-500">No banner</p>
              </div>
            )}
          </div>

          {/* Upload New Banner */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {preview ? 'Selected Banner' : 'Select New Banner'}
            </label>

            {preview ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="relative h-24 bg-gray-100">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={clearPreview}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <FiX size={12} />
                  </button>
                </div>
                <div className="p-2 bg-gray-50">
                  <p className="text-xs text-gray-600 truncate text-[10px]">{imageFile?.name}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-brand-dark hover:bg-brand/5 transition-all text-center h-[120px] flex flex-col items-center justify-center group"
              >
                <FiUpload className="text-gray-400 group-hover:text-brand-dark transition-colors mb-1" size={24} />
                <p className="text-xs font-semibold text-gray-600 group-hover:text-brand-dark transition-colors">
                  Browse Image
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Max 500 KB</p>
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <strong>Recommended:</strong> 1920x600px • Max 500 KB
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {preview && (
              <button
                onClick={clearPreview}
                className="px-3 sm:px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleUpload}
              disabled={loading || !preview}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg bg-brand-dark hover:bg-brand-hover text-white font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial justify-center"
            >
              <FiUpload size={14} />
              Upload Banner
            </button>
          </div>
        </div>

        {/* Collapsible Guidelines */}
        <div className="mt-3">
          <button
            onClick={() => setShowGuidelines(!showGuidelines)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-brand-dark transition-colors"
          >
            {showGuidelines ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
            Banner Guidelines
          </button>
          
          {showGuidelines && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• <strong>Dimensions:</strong> 1920x600px (min 800x200px)</li>
                <li>• <strong>Size:</strong> Max 500 KB</li>
                <li>• <strong>Format:</strong> JPEG, PNG, or WebP</li>
                <li>• <strong>Tip:</strong> Use Squoosh.app to compress</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}