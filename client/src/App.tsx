import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import AdminRoute from './components/AdminRoute';
import SideMenu from './components/SideMenu';
import { useAppSelector } from './store/hooks';
import Loader from './components/Loader';
import { loadingBus } from './services/loadingBus';

function useApiLoadingCount(): number {
  const [count, setCount] = useState(loadingBus.getCount);
  useEffect(() => {
    loadingBus.subscribe(setCount);
    return () => loadingBus.unsubscribe();
  }, []);
  return count;
}

const Login             = lazy(() => import('./pages/Login'));
const SignupPage        = lazy(() => import('./pages/SignupPage'));
const HomePage          = lazy(() => import('./pages/HomePage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const CartPage          = lazy(() => import('./pages/CartPage'));
const OrderSummaryPage  = lazy(() => import('./pages/OrderSummaryPage'));
const CheckoutPage      = lazy(() => import('./pages/CheckoutPage'));
const OrderStatusPage   = lazy(() => import('./pages/OrderStatusPage')); // handles both success & failure
const ContactUsPage     = lazy(() => import('./pages/ContactUsPage'));
const AboutPage         = lazy(() => import('./pages/AboutPage'));
const ShippingPage      = lazy(() => import('./pages/ShippingPage'));
const AdminPage         = lazy(() => import('./pages/AdminPage'));
const ProfilePage       = lazy(() => import('./pages/ProfilePage'));
const WishlistPage      = lazy(() => import('./pages/WishlistPage'));

const PageFallback = () => <Loader fullPage label="Loading…" />;

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const cartCount = useAppSelector((s) => s.cart.items.reduce((acc, i) => acc + i.qty, 0));
  const user = useAppSelector((s) => s.user.user);
  const [bump, setBump] = useState(false);
  const prevCount = useRef(cartCount);
  const location = useLocation();

  const isAuthPage = location.pathname === '/auth' || location.pathname === '/signup';

  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 400);
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => {
    try {
      const v = localStorage.getItem('sideCollapsed');
      setSideCollapsed(v === '1');
    } catch (e) {
      // ignore
    }
  }, []);

  const toggleSide = () => {
    setSideCollapsed((s) => {
      const next = !s;
      try { localStorage.setItem('sideCollapsed', next ? '1' : '0'); } catch (e) {}
      return next;
    });
  };

  const sideWidth = isAuthPage ? '' : sideCollapsed ? 'min-[992px]:pl-16' : 'min-[992px]:pl-60';

  const apiLoadingCount = useApiLoadingCount();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
        {apiLoadingCount > 0 && <Loader fullPage />}
        <Navbar
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          cartCount={cartCount}
          user={user}
          bump={bump}
          sideCollapsed={sideCollapsed}
          toggleSide={toggleSide}
          isAuthPage={isAuthPage}
        />

        <main className={`flex-1 mt-16 transition-all duration-300 ${sideWidth}`}>
          {!isAuthPage && (
            <SideMenu mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} sideCollapsed={sideCollapsed} />
          )}

          <Suspense fallback={<PageFallback />}>
            <Routes>
            <Route path="/auth" element={<Login />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:id" element={<ProductDetailsPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/order-summary" element={<OrderSummaryPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/contact" element={<ContactUsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/shipping" element={<ShippingPage />} />
            <Route path="/order-success" element={<OrderStatusPage />} />
            <Route path="/order-failure" element={<OrderStatusPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
          </Routes>
          </Suspense>
        </main>
      </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
