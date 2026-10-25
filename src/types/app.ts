export type AppCategory = 'ecommerce' | 'booking' | 'dashboard' | 'delivery' | 'education' | 'fitness' | 'general';

export type ThemeColor = 'emerald' | 'indigo' | 'amber' | 'rose' | 'cyan' | 'purple';

export type ViewportMode = 'mobile' | 'tablet' | 'desktop';

export interface AppStat {
  id: string;
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

export interface AppItem {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  priceLabel: string;
  category: string;
  tag: string;
  rating: number;
  reviewsCount: number;
  image: string;
  stock?: number;
  features: string[];
  description?: string;
  duration?: string;
}

export interface CartItem {
  item: AppItem;
  quantity: number;
  selectedOption?: string;
}

export interface AppData {
  appName: string;
  tagline: string;
  category: AppCategory;
  themeColor: ThemeColor;
  currency: string;
  stats: AppStat[];
  categories: string[];
  items: AppItem[];
  announcement?: string;
  quickActions?: {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
  }[];
}
