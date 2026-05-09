import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import AdminRoute from './components/AdminRoute';
import SideMenu from './components/SideMenu';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import { useAppSelector } from './store/hooks';
import Loader from './components/Loader';
import { loadingBus } from './services/loadingBus';
import { authService } from './services/authService';
import { API_BASE_URL } from './services/apiClient';

function useApiLoadingCount(): number {
  const [count, setCount] = useState(loadingBus.getCount);
  useEffect(() => {
    return loadingBus.subscribe(setCount);
  }, []);
  return count;
}

const Login              = lazy(() => import('./pages/Login'));
const SignupPage         = lazy(() => import('./pages/SignupPage'));
const HomePage           = lazy(() => import('./pages/HomePage'));
const ProductsPage       = lazy(() => import('./pages/ProductsPage'));
const BestSellersPage    = lazy(() => import('./pages/BestSellersPage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const CartPage           = lazy(() => import('./pages/CartPage'));
const OrderSummaryPage   = lazy(() => import('./pages/OrderSummaryPage'));
const CheckoutPage       = lazy(() => import('./pages/CheckoutPage'));
const OrderStatusPage    = lazy(() => import('./pages/OrderStatusPage')); // handles both success & failure
const ContactUsPage      = lazy(() => import('./pages/ContactUsPage'));
const AboutPage          = lazy(() => import('./pages/AboutPage'));
const ShippingPage       = lazy(() => import('./pages/ShippingPage'));
const AdminPage          = lazy(() => import('./pages/AdminPage'));
const AdminEditProductPage = lazy(() => import('./pages/AdminEditProductPage'));
const ProfilePage        = lazy(() => import('./pages/ProfilePage'));
const WishlistPage       = lazy(() => import('./pages/WishlistPage'));
const ManageUsersPage    = lazy(() => import('./pages/ManageUsersPage'));
const MyOrdersPage       = lazy(() => import('./pages/MyOrdersPage'));
const OrderDetailPage    = lazy(() => import('./pages/OrderDetailPage'));
const RefundPolicyPage   = lazy(() => import('./pages/RefundPolicyPage'));
const ShippingPolicyPage = lazy(() => import('./pages/ShippingPolicyPage'));


// Delayed fallback to prevent flash of loading state for fast-loading pages
function PageFallback() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;
  return <Loader fullPage label="Loading…" />;
}

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const cartCount = useAppSelector((s) => s.cart.items.reduce((acc, i) => acc + i.qty, 0));
  const user = useAppSelector((s) => s.user.user);
  const [bump, setBump] = useState(false);
  const prevCount = useRef(cartCount);
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth' || location.pathname === '/signup';
  const apiLoadingCount = useApiLoadingCount();

  // Bootstrap the CSRF cookie on mount — but only when the current token
  // is missing or older than 55 min (proactive refresh before 1 h expiry).
  // useEffect(() => {
  //   if (!authService.isCsrfValid()) {
  //     fetch(`${API_BASE_URL}/users/csrf-token`, { credentials: 'include' })
  //       .then(() => authService.markCsrfFetched())
  //       .catch(() => {/* non-fatal — apiClient will retry before next mutation */});
  //   }
  // }, []);

  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 400);
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {apiLoadingCount > 0 && <Loader fullPage />}
      <Navbar
        cartCount={cartCount}
        user={user}
        bump={bump}
        isAuthPage={isAuthPage}
        menuOpen={mobileOpen}
        setMenuOpen={setMobileOpen}
      />

      <main className={`flex-1 mt-[120px] sm:mt-[90px] min-h-[calc(100vh-120px)] sm:min-h-[calc(100vh-90px)]`}>
        {!isAuthPage && (
          <SideMenu isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        )}
        <div className="w-full mx-auto">
          <Suspense fallback={<PageFallback />}>
            <Routes>
            <Route path="/auth" element={<Login />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/collections" element={<ProductsPage />} />
            <Route path="/best-sellers" element={<BestSellersPage />} />
            <Route path="/product/:id" element={<ProductDetailsPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/order-summary" element={<OrderSummaryPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/contact" element={<ContactUsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/shipping" element={<ShippingPage />} />
            <Route path="/shipping-policy" element={<ShippingPolicyPage/>} />
            <Route path="/refund-policy" element={<RefundPolicyPage/>} />
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
            <Route
              path="/admin/product/:id"
              element={
                <AdminRoute>
                  <AdminEditProductPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <ManageUsersPage />
                </AdminRoute>
              }
            />
            <Route path="/orders" element={<MyOrdersPage />} />
            <Route
              path="/admin/orders/:orderId"
              element={
                <AdminRoute>
                  <OrderDetailPage />
                </AdminRoute>
              }
            />
          </Routes>
        </Suspense>
      </div>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
