import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { PlayerBar } from './PlayerBar';
import { ToastHost } from './ToastHost';

export function Layout() {
  const location = useLocation();
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.search]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="page-scroll" ref={scrollRef}>
        <div className="page-wrap">
          <Outlet />
        </div>
      </main>
      <PlayerBar />
      <MobileNav />
      <ToastHost />
    </div>
  );
}
