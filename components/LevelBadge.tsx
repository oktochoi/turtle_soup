'use client';

type LevelBadgeProps = {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showXP?: boolean;
  currentXP?: number;
  className?: string;
};

export default function LevelBadge({ 
  level, 
  size = 'md',
  showXP = false,
  currentXP = 0,
  className = '' 
}: LevelBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // 레벨에 따른 색상
  const getLevelColor = (lvl: number) => {
    if (lvl >= 50) return 'from-purple-500 to-pink-500';
    if (lvl >= 30) return 'from-blue-500 to-cyan-500';
    if (lvl >= 20) return 'from-green-500 to-emerald-500';
    if (lvl >= 10) return 'from-yellow-500 to-orange-500';
    return 'from-slate-500 to-slate-600';
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 ${sizeClasses[size]} rounded-md bg-gradient-to-r ${getLevelColor(level)} text-white font-bold`}
      >
        <span className={iconSizes[size]}>Lv</span>
        <span>{level}</span>
      </span>
      {showXP && currentXP > 0 && (
        <span className="text-xs text-slate-400">
          +{currentXP} XP
        </span>
      )}
    </div>
  );
}

