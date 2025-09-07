// types/badges.ts
export enum BadgeType {
  RECENT_BUY = 'RECENT BUY',
  BUY_SIGNAL = 'BUY SIGNAL',
  SELL_SIGNAL = 'SELL SIGNAL',
  NO_SIGNAL = 'NO RECENT   SIGNAL',
  ERROR = 'ERROR'
}

export interface FilterState {
  selectedBadges: BadgeType[];
  searchTerm: string;
}

export interface BadgeInfo {
  priority: number;
  badge: BadgeType;
  daysAgo?: number;
}
