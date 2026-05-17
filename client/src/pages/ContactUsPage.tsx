import React, { useState, useEffect } from 'react';
import { FiMail, FiPhone, FiMapPin, FiClock, FiTag, FiInfo, FiEdit2, FiSave, FiX, FiFacebook, FiInstagram, FiTwitter, FiMessageCircle } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { contactApi, ContactInfo } from '../services/apiClient';
import Loader from '../components/Loader';

export default function ContactUsPage() {
  const user = useSelector((state: RootState) => state.user.user);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<ContactInfo>({
    tradeName: '',
    brandName: '',
    address: '',
    phone: '',
    email: '',
    operatingHours: '',
    mapUrl: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: '',
      whatsapp: '',
    },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadContactInfo();
  }, []);

  const loadContactInfo = async () => {
    try {
      setLoading(true);
      const data = await contactApi.get();
      setContactInfo(data);
      setEditForm(data);
    } catch (err) {
      console.error('Failed to load contact info:', err);
      setError('Failed to load contact information');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setSuccessMsg('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (contactInfo) {
      setEditForm(contactInfo);
    }
    setError('');
    setSuccessMsg('');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMsg('');
      
      const updated = await contactApi.update(editForm);
      setContactInfo(updated);
      setIsEditing(false);
      setSuccessMsg('Contact information updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Failed to update contact info:', err);
      setError(err.message || 'Failed to update contact information');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ContactInfo, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialMediaChange = (platform: keyof ContactInfo['socialMedia'], value: string) => {
    setEditForm(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  if (!contactInfo) {
    return (
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-8">
        <div className="text-center text-red-600">Failed to load contact information</div>
      </div>
    );
  }

  const isAdmin = user?.isAdmin === true;

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-20 md:pt-20 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FiMail size={22} className="text-brand-dark" />
          <h1 className="text-2xl font-bold text-gray-900 font-display">Contact Us</h1>
        </div>
        
        {/* Admin Edit Button */}
        {isAdmin && !isEditing && (
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-opacity-90 transition-all text-sm font-semibold"
          >
            <FiEdit2 size={16} />
            Edit
          </button>
        )}
        
        {/* Save/Cancel Buttons */}
        {isEditing && (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all text-sm font-semibold disabled:opacity-50"
            >
              <FiX size={16} />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all text-sm font-semibold disabled:opacity-50"
            >
              <FiSave size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className={`grid ${isAdmin ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6`}>
        {/* Left Column - Contact Info */}
        <div className="bg-brand rounded-2xl border border-brand-border shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiInfo size={20} className="text-brand-dark" />
            Company Information
          </h2>
          
          <div className="space-y-4">
            {/* Trade Name */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                <FiTag size={16} className="text-brand-dark" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Trade Name</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.tradeName}
                    onChange={(e) => handleInputChange('tradeName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium text-primary">{contactInfo.tradeName}</p>
                )}
              </div>
            </div>

            {/* Brand Name */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                <FiInfo size={16} className="text-brand-dark" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Brand Name</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.brandName}
                    onChange={(e) => handleInputChange('brandName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium text-primary">{contactInfo.brandName}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                <FiMapPin size={16} className="text-brand-dark" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Address</p>
                {isEditing ? (
                  <textarea
                    value={editForm.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium text-primary whitespace-pre-line">{contactInfo.address}</p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                <FiPhone size={16} className="text-brand-dark" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Phone</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium text-primary">{contactInfo.phone}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                <FiMail size={16} className="text-brand-dark" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Email</p>
                {isEditing ? (
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium text-primary">{contactInfo.email}</p>
                )}
              </div>
            </div>

            {/* Operating Hours */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                <FiClock size={16} className="text-brand-dark" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Operating Hours</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.operatingHours}
                    onChange={(e) => handleInputChange('operatingHours', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium text-primary">{contactInfo.operatingHours}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Map & Social Media (Admin Only) */}
        {isAdmin && (
          <div className="space-y-6">
            {/* Map */}
            <div className="bg-brand rounded-2xl border border-brand-border shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiMapPin size={20} className="text-brand-dark" />
                Location
              </h2>
            {isEditing ? (
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Google Maps Embed URL
                </label>
                <input
                  type="text"
                  value={editForm.mapUrl}
                  onChange={(e) => handleInputChange('mapUrl', e.target.value)}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                />
                <p className="text-xs text-gray-500">
                  Get embed URL from Google Maps → Share → Embed a map
                </p>
              </div>
            ) : contactInfo.mapUrl ? (
              <div className="rounded-xl overflow-hidden h-48">
                <iframe
                  src={contactInfo.mapUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Location Map"
                />
              </div>
            ) : (
              <div className="h-48 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                <div className="text-center">
                  <FiMapPin size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Map not configured</p>
                </div>
              </div>
            )}
          </div>

            {/* Social Media - Admin Only */}
            <div className="bg-brand rounded-2xl border border-brand-border shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiMessageCircle size={20} className="text-brand-dark" />
                Connect With Us
                <span className="ml-auto text-xs font-semibold text-brand-dark bg-brand border border-brand-border rounded-full px-3 py-1">
                  Admin Only
                </span>
              </h2>
            <div className="space-y-3">
              {/* WhatsApp */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <FiMessageCircle size={16} className="text-green-600" />
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.socialMedia.whatsapp}
                      onChange={(e) => handleSocialMediaChange('whatsapp', e.target.value)}
                      placeholder="WhatsApp number or link"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  ) : contactInfo.socialMedia.whatsapp ? (
                    <a
                      href={contactInfo.socialMedia.whatsapp.startsWith('http') ? contactInfo.socialMedia.whatsapp : `https://wa.me/${contactInfo.socialMedia.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-green-600 hover:underline"
                    >
                      WhatsApp
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Not configured</p>
                  )}
                </div>
              </div>

              {/* Facebook */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FiFacebook size={16} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.socialMedia.facebook}
                      onChange={(e) => handleSocialMediaChange('facebook', e.target.value)}
                      placeholder="Facebook page URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  ) : contactInfo.socialMedia.facebook ? (
                    <a
                      href={contactInfo.socialMedia.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Facebook
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Not configured</p>
                  )}
                </div>
              </div>

              {/* Instagram */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <FiInstagram size={16} className="text-pink-600" />
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.socialMedia.instagram}
                      onChange={(e) => handleSocialMediaChange('instagram', e.target.value)}
                      placeholder="Instagram profile URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  ) : contactInfo.socialMedia.instagram ? (
                    <a
                      href={contactInfo.socialMedia.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-pink-600 hover:underline"
                    >
                      Instagram
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Not configured</p>
                  )}
                </div>
              </div>

              {/* Twitter */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <FiTwitter size={16} className="text-sky-600" />
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.socialMedia.twitter}
                      onChange={(e) => handleSocialMediaChange('twitter', e.target.value)}
                      placeholder="Twitter profile URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  ) : contactInfo.socialMedia.twitter ? (
                    <a
                      href={contactInfo.socialMedia.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-sky-600 hover:underline"
                    >
                      Twitter
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Not configured</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Non-Admin: Contact Information Display */}
      {!isAdmin && (
        <div className="mt-6 bg-gradient-to-br from-brand-dark to-brand-hover rounded-2xl shadow-lg p-8 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-3">Get In Touch</h2>
            <p className="text-brand-light mb-6 text-sm">
              We'd love to hear from you! Reach out to us through any of the following channels.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4 text-left">
              {/* Email */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <FiMail size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-brand-light uppercase tracking-wide">Email Us</p>
                    <a href={`mailto:${contactInfo.email}`} className="text-sm font-semibold hover:underline">
                      {contactInfo.email}
                    </a>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <FiPhone size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-brand-light uppercase tracking-wide">Call Us</p>
                    <a href={`tel:${contactInfo.phone}`} className="text-sm font-semibold hover:underline">
                      {contactInfo.phone}
                    </a>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all sm:col-span-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <FiMapPin size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-brand-light uppercase tracking-wide mb-1">Visit Us</p>
                    <p className="text-sm font-medium whitespace-pre-line">{contactInfo.address}</p>
                  </div>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all sm:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <FiClock size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-brand-light uppercase tracking-wide mb-1">Business Hours</p>
                    <p className="text-sm font-semibold">{contactInfo.operatingHours}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map for non-admin */}
            {contactInfo.mapUrl && (
              <div className="mt-6 rounded-xl overflow-hidden shadow-lg">
                <iframe
                  src={contactInfo.mapUrl}
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Location Map"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
