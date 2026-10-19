import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppShell from './AppShell';
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
const router = createBrowserRouter([{ element: <AppShell />, children: [
  { path: '/', element: <Suspense fallback={<p role="status">页面加载中…</p>}><App /></Suspense> },
  { path: '/dashboard', element: <Suspense fallback={<p role="status">页面加载中…</p>}><Dashboard /></Suspense> },
  { path: '/geography', element: <Suspense fallback={<p role="status">页面加载中…</p>}><Geography /></Suspense> },
  { path: '/products', element: <Suspense fallback={<p role="status">页面加载中…</p>}><Products /></Suspense> },
  { path: '/devices', element: <Suspense fallback={<p role="status">页面加载中…</p>}><Devices /></Suspense> },
  { path: '/rules', element: <Suspense fallback={<p role="status">页面加载中…</p>}><Rules /></Suspense> },
  { path: '/firmware', element: <Suspense fallback={<p role="status">页面加载中…</p>}><FirmwareOta /></Suspense> },
  { path: '/tenants', element: <Suspense fallback={<p role="status">页面加载中…</p>}><Tenants /></Suspense> },
  { path: '/labs', element: <Suspense fallback={<p role="status">页面加载中…</p>}><Labs /></Suspense> },
  { path: '/delivery', element: <Suspense fallback={<p role="status">页面加载中…</p>}><Delivery /></Suspense> },
  { path: '*', element: <section className="shell-not-found"><h1>页面不存在</h1><p>请从主导航选择页面。</p></section> },
].map(route => ({ ...route, errorElement: <section className="shell-not-found" role="alert"><h1>页面加载失败</h1><p>请从主导航选择其他页面，或刷新后重试。</p></section> })) }]);
createRoot(document.getElementById('app')!).render(<RouterProvider router={router} />);
