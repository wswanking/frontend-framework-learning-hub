import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import './styles.css';
const Dashboard = lazy(() => import('./Dashboard'));
const Geography = lazy(() => import('./Geography'));
const Products = lazy(() => import('./Products'));
const Devices = lazy(() => import('./Devices'));
const Rules = lazy(() => import('./Rules'));
const FirmwareOta = lazy(() => import('./FirmwareOta'));
const Tenants = lazy(() => import('./Tenants'));
const Delivery = lazy(() => import('./Delivery'));
const Labs = lazy(() => import('./Labs'));
createRoot(document.getElementById('app')!).render(
  <BrowserRouter><Suspense fallback={<p role="status">页面加载中…</p>}><Routes>
    <Route path="/" element={<App />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/geography" element={<Geography />} />
    <Route path="/products" element={<Products />} />
    <Route path="/devices" element={<Devices />} />
    <Route path="/rules" element={<Rules />} />
    <Route path="/firmware" element={<FirmwareOta />} />
    <Route path="/tenants" element={<Tenants />} />
    <Route path="/delivery" element={<Delivery />} />
    <Route path="/labs" element={<Labs />} />
  </Routes></Suspense></BrowserRouter>,
);
