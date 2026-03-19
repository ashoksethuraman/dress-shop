import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AboutPage from './pages/AboutPage';
import ShippingPage from './pages/ShippingPage';
import AuthLandingPage from './components/AuthLandingPage';
import HomePage from './pages/HomePage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CartPage from './pages/CartPage';
import OrderFormPage from './pages/OrderFormPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSummaryPage from './pages/OrderSummaryPage';
import ContactUsPage from './pages/ContactUsPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import AdminPage from './pages/AdminPage';
import AdminRoute from './components/AdminRoute';
import SideMenu from './components/SideMenu';
import ProtectedRoute from './components/ProtectedRoute';
import { useAppSelector } from './store/hooks';

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const cartCount = useAppSelector((s) => s.cart.items.reduce((acc, i) => acc + i.qty, 0));
  const user = useAppSelector((s) => s.user.user);
  const [bump, setBump] = useState(false);
  const prevCount = useRef(cartCount);

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

  // px offset for the sidebar: 240px expanded, 64px collapsed (desktop ≥992px only)
  const sideWidth = sideCollapsed ? 'min-[992px]:pl-16' : 'min-[992px]:pl-60';

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          cartCount={cartCount}
          user={user}
          bump={bump}
          sideCollapsed={sideCollapsed}
          toggleSide={toggleSide}
        />

        <main className={`flex-1 mt-16 transition-all duration-300 ${sideWidth}`}>
          <SideMenu mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} sideCollapsed={sideCollapsed} toggleSide={toggleSide} />

          <Routes>
            <Route path="/auth" element={<AuthLandingPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:id" element={<ProductDetailsPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/order-summary" element={<OrderSummaryPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route
              path="/order"
              element={
                <ProtectedRoute>
                  <OrderFormPage />
                </ProtectedRoute>
              }
            />
            <Route path="/contact" element={<ContactUsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/shipping" element={<ShippingPage />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>

  );
}

export default App;
