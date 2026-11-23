import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Logo from '../assets/Logo.jsx';

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); setOpen(false); }, [pathname]);

  return (
    <div className="app-shell">
      <div className="topbar">
        <button className="icon-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={22} /></button>
        <span className="brand"><Logo size={26} /><span>CricketPro</span></span>
      </div>
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="main"><Outlet /></main>
    </div>
  );
}
