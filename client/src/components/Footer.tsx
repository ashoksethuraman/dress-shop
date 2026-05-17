import { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { FaWhatsapp, FaInstagram, FaFacebook, FaTwitter } from "react-icons/fa";
import { contactApi } from '../services/apiClient';

export default function Footer() {
    const [isVisible, setIsVisible] = useState(false);
    const [socialUrls, setSocialUrls] = useState({
        whatsapp: 'https://wa.me/xxxxxxxxxx',
        instagram: 'https://instagram.com/yourbrand',
        facebook: 'https://facebook.com/yourbrand',
        twitter: 'https://twitter.com/yourbrand'
    });

    useEffect(() => {
        // Wait for page content to stabilize before showing footer
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 800);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Fetch social media URLs from database
        contactApi.get()
            .then(data => {
                setSocialUrls({
                    whatsapp: data.socialMedia.whatsapp || 'https://wa.me/xxxxxxxxxx',
                    instagram: data.socialMedia.instagram || 'https://instagram.com/yourbrand',
                    facebook: data.socialMedia.facebook || 'https://facebook.com/yourbrand',
                    twitter: data.socialMedia.twitter || 'https://twitter.com/yourbrand'
                });
            })
            .catch((err) => {
                console.error('Failed to load social media URLs:', err);
                // Keep fallback URLs on error
            });
    }, []);

    return (
        <footer
            className={`bg-[#1a1a1a] text-white w-full overflow-x-hidden transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            style={{ willChange: 'opacity' }}
        >

            {/* MAIN GRID */}
            <div className="
                max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-10 
                grid gap-10 lg:gap-16 
                md:grid-cols-2 
                lg:grid-cols-3 
                text-center md:text-left
            ">

                {/* BRAND SECTION */}
                <div className="flex flex-col items-center md:items-start">
                    <h5 className="
                        text-3xl font-extrabold 
                        bg-gradient-to-r from-[#ff9a9e] via-[#fad0c4] to-[#ffd1ff]
                        bg-clip-text text-transparent
                        animate-glow
                    ">
                        Halley Comet
                    </h5>

                    <p className="mt-2 text-sm text-[#d6c5be]">
                        Soft. Elegant. Everyday Comfort.
                    </p>

                    <p className="mt-4 text-sm text-[#d6c5be] max-w-xs leading-6">
                        Discover premium comfort & style with Halley Comet.
                        Quality, elegance, and essentials crafted for you.
                    </p>
                </div>

                {/* HELP SECTION — FIXED CENTER ALIGNMENT */}
                <div className="flex  md:pl-5 flex-col items-center md:items-start text-center md:text-left">
                    <h3 className="text-lg font-semibold">HELP</h3>

                    <ul className="mt-6 space-y-3 text-sm text-[#d6c5be]">
                        <li><Link to="/refund-policy" className="hover:text-white transition">Exchanges & Returns</Link></li>
                        <li><Link to="/shipping-policy" className="hover:text-white transition">Shipping Policy</Link></li>


                        <li><Link to="/about" className="hover:text-white transition">About Us</Link></li>
                        <li><Link to="/contact" className="hover:text-white transition">Contact Us</Link></li>

                        {/* <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link></li> */}
                        <li><Link to="/shipping" className="hover:text-white transition">Track Your Order</Link></li>
                    </ul>
                </div>

                { /* UPDATED NEWSLETTER SECTION */}
                <div className="flex flex-col items-center lg:items-start text-center md:text-left">
                    <h3 className="text-lg font-semibold">Stay Updated</h3>

                    <p className="mt-4 text-sm text-[#d6c5be] max-w-xs leading-6">
                        Subscribe for latest arrivals, offers, and exclusive deals.
                    </p>

                    {/* RESPONSIVE INPUT + BUTTON */}
                    <div
                        className=" mt-6 w-full max-w-sm flex flex-col md:flex-row  items-center md:items-start  gap-3 " >
                        {/* INPUT — full width always */}
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className=" w-full md:flex-1 rounded-md px-5 py-3 text-black focus:outline-none "/>

                        {/* BUTTON — desktop inline, mobile centered below */}
                        <button
                            className="bg-white text-black font-semibold px-6 py-3 rounded-full hover:bg-[#e8e8e8] transition md:ml-2  mx-auto md:mx-0 " >
                            Join
                        </button>
                    </div>
                </div>
            </div>

            {/* SOCIAL ICONS */}
            <div className="border-t border-white/10 py-4">
                <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 
                    flex items-center justify-between">

                    <div className="flex gap-6 text-xl">
                        <a 
                            href={socialUrls.whatsapp.startsWith('http') ? socialUrls.whatsapp : `https://wa.me/${socialUrls.whatsapp}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-[#25D366] transition"
                            title="WhatsApp"
                        >
                            <FaWhatsapp />
                        </a>
                        <a 
                            href={socialUrls.instagram} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-pink-400 transition"
                            title="Instagram"
                        >
                            <FaInstagram />
                        </a>
                        <a 
                            href={socialUrls.facebook} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-blue-400 transition"
                            title="Facebook"
                        >
                            <FaFacebook />
                        </a>
                        <a 
                            href={socialUrls.twitter} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-[#1DA1F2] transition"
                            title="Twitter"
                        >
                            <FaTwitter />
                        </a>
                    </div>

                    <div></div>
                </div>
            </div>

            {/* GLOW ANIMATION */}
            <style>
                {`
                @keyframes glow {
                    0% { text-shadow: 0 0 5px #ff9a9e, 0 0 10px #fad0c4; }
                    50% { text-shadow: 0 0 12px #ffd1ff, 0 0 20px #ff9a9e; }
                    100% { text-shadow: 0 0 5px #ff9a9e, 0 0 10px #fad0c4; }
                }
                .animate-glow {
                    animation: glow 3s ease-in-out infinite;
                }
                `}
            </style>
        </footer>
    );
}