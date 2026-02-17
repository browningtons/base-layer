import { Activity, Heart, LayoutDashboard, Target, Users, Flame } from 'lucide-react';
import type { ActiveTab } from '../types';

interface CategoryTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export default function CategoryTabs({ activeTab, onTabChange }: CategoryTabsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button onClick={() => onTabChange('overview')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-gray-800 text-white shadow-lg shadow-gray-400' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
        <LayoutDashboard className="w-4 h-4 inline-block mr-2" /> Overview
      </button>
      <div className="w-full sm:w-auto h-px sm:h-8 bg-gray-300 mx-2 hidden sm:block" />
      <button onClick={() => onTabChange('body')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'body' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
        <Activity className="w-4 h-4 inline-block mr-2" /> Body
      </button>
      <button onClick={() => onTabChange('mind')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'mind' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
        <Target className="w-4 h-4 inline-block mr-2" /> Mind
      </button>
      <button onClick={() => onTabChange('family')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'family' ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
        <Heart className="w-4 h-4 inline-block mr-2" /> Family
      </button>
      <button onClick={() => onTabChange('social')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'social' ? 'bg-pink-600 text-white shadow-lg shadow-pink-200' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
        <Users className="w-4 h-4 inline-block mr-2" /> Social
      </button>
      <button onClick={() => onTabChange('strava')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'strava' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
        <Flame className="w-4 h-4 inline-block mr-2" /> Strava
      </button>
    </div>
  );
}
