function CircularProgress({ 
  value, 
  maxValue = 100, 
  size = 140, 
  strokeWidth = 12,
  color,
  isDark 
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / maxValue) * circumference;
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background Circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={isDark ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.5)'}
        strokeWidth={strokeWidth}
      />
      {/* Progress Circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

export default CircularProgress;

