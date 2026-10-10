import React from 'react';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  Settings, 
  LogOut, 
  ChevronRight,
  Users,
  BarChart3,
  Activity,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';
import { useProfile } from '../context/ProfileContext';
import { sounds } from '../utils/sounds';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const { profile, logout } = useProfile();

  const isAdmin = profile?.role === 'admin';

  const menuItems = [
    { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
    { id: 'registro', label: 'Panel de Registro', icon: Activity },
    { id: 'corte', label: 'Corte de Reporte', icon: ClipboardCheck },
    { id: 'backups', label: 'Respaldos', icon: Database },
    ...(isAdmin ? [
      { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
      { id: 'team', label: 'Panel de Equipo', icon: Users },
      { id: 'settings', label: 'Configuración', icon: Settings },
    ] : []),
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 h-full bg-white border-r border-slate-200 z-50
        transition-all duration-200 ease-out flex flex-col
        ${isOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full p-4">
          {/* Logo Section */}
          <div className={`flex items-center gap-3 mb-8 px-2 ${isOpen ? '' : 'justify-center'}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center text-white shrink-0 shadow-md shadow-cyan-500/20">
              <Activity size={22} className="text-white" />
            </div>
            {isOpen && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xl font-black tracking-tight text-slate-900 whitespace-nowrap"
              >
                Run<span className="text-cyan-600">Monitor</span>
              </motion.span>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    sounds.playClick();
                    setActiveTab(item.id);
                    if (window.innerWidth < 1024) setIsOpen(false);
                  }}
                  title={!isOpen ? item.label : undefined}
                  className={`
                    w-full flex items-center p-3 rounded-xl transition-all group
                    ${isOpen ? 'gap-3' : 'justify-center'}
                    ${isActive 
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}
                  `}
                >
                  <Icon size={22} className={`${isActive ? 'text-white' : 'group-hover:scale-110 transition-transform'} shrink-0`} />
                  {isOpen && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="font-bold text-sm whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {isActive && isOpen && (
                    <ChevronRight size={16} className="ml-auto opacity-50 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Section / Logout */}
          <div className="mt-auto pt-4 border-t border-slate-200">
            <button
              onClick={handleLogout}
              title={!isOpen ? 'Cerrar Sesión' : undefined}
              className={`w-full flex items-center p-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all group ${isOpen ? 'gap-3' : 'justify-center'}`}
            >
              <LogOut size={22} className="group-hover:rotate-12 transition-transform shrink-0" />
              {isOpen && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-bold text-sm whitespace-nowrap"
                >
                  Cerrar Sesión
                </motion.span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
