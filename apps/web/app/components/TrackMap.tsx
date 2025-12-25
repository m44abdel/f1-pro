"use client";

import { useMemo, useCallback } from "react";

interface TrackMapProps {
  posX: number[];
  posY: number[];
  speed: number[];
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
  colorMode: "speed" | "throttle" | "brake";
  throttle?: number[];
  brake?: number[];
  width?: number;
  height?: number;
}

// Color interpolation for speed visualization
function getSpeedColor(speed: number, minSpeed: number, maxSpeed: number): string {
  const normalized = (speed - minSpeed) / (maxSpeed - minSpeed);
  // Blue (slow) -> Green -> Yellow -> Red (fast)
  if (normalized < 0.25) {
    const t = normalized / 0.25;
    return `rgb(${Math.round(0 + t * 0)}, ${Math.round(100 + t * 155)}, ${Math.round(255 - t * 55)})`;
  } else if (normalized < 0.5) {
    const t = (normalized - 0.25) / 0.25;
    return `rgb(${Math.round(0 + t * 255)}, ${Math.round(255)}, ${Math.round(200 - t * 200)})`;
  } else if (normalized < 0.75) {
    const t = (normalized - 0.5) / 0.25;
    return `rgb(${Math.round(255)}, ${Math.round(255 - t * 100)}, ${Math.round(0)})`;
  } else {
    const t = (normalized - 0.75) / 0.25;
    return `rgb(${Math.round(255)}, ${Math.round(155 - t * 155)}, ${Math.round(0)})`;
  }
}

function getThrottleColor(throttle: number): string {
  // Green intensity based on throttle
  // Handle both 0-1 and 0-100 scales
  let normalizedThrottle = throttle;
  if (throttle <= 1) {
    normalizedThrottle = throttle * 100;
  }
  const intensity = Math.round((normalizedThrottle / 100) * 200);
  return `rgb(0, ${intensity + 55}, 0)`;
}

function getBrakeColor(brake: number): string {
  // Red intensity based on brake pressure
  // Brake values might be 0-1 instead of 0-100, so let's check
  if (brake <= 0 || brake === undefined || brake === null) {
    // No brake - dark gray
    return `rgb(60, 60, 60)`;
  }
  
  // If brake values are between 0 and 1, scale them up
  let normalizedBrake = brake;
  if (brake <= 1) {
    normalizedBrake = brake * 100;
  }
  
  // Even 1% brake should show red
  // Scale from dark red to bright red based on brake pressure
  const normalized = Math.min(normalizedBrake / 100, 1); // Ensure it's between 0 and 1
  const intensity = Math.round(normalized * 195) + 60; // Range from 60 to 255
  return `rgb(${intensity}, 0, 0)`;
}

export default function TrackMap({
  posX,
  posY,
  speed,
  hoveredIndex,
  onHover,
  colorMode,
  throttle,
  brake,
  width = 400,
  height = 400,
}: TrackMapProps) {
  
  // Stable hover handler to prevent flickering
  const handleHover = useCallback((index: number | null) => {
    onHover(index);
  }, [onHover]);
  // Calculate bounds and transform
  const { points, viewBox, minSpeed, maxSpeed, minBrake, maxBrake } = useMemo(() => {
    if (!posX || !posY || posX.length === 0) {
      return { points: [], viewBox: "0 0 400 400", minSpeed: 0, maxSpeed: 350, minBrake: 0, maxBrake: 100 };
    }

    const minX = Math.min(...posX);
    const maxX = Math.max(...posX);
    const minY = Math.min(...posY);
    const maxY = Math.max(...posY);
    
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    
    // Add padding
    const padding = 40;
    const scaleX = (width - padding * 2) / rangeX;
    const scaleY = (height - padding * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);
    
    // Center the track
    const offsetX = (width - rangeX * scale) / 2;
    const offsetY = (height - rangeY * scale) / 2;
    
    const pts = posX.map((x, i) => ({
      x: (x - minX) * scale + offsetX,
      y: height - ((posY[i] - minY) * scale + offsetY), // Flip Y axis
      speed: speed[i],
      throttle: throttle?.[i] ?? 0,
      brake: brake?.[i] ?? 0,
      index: i,
    }));

    const minSpd = Math.min(...speed);
    const maxSpd = Math.max(...speed);
    
    // Calculate brake value range
    const brakeValues = brake || [];
    const minBrk = brakeValues.length > 0 ? Math.min(...brakeValues) : 0;
    const maxBrk = brakeValues.length > 0 ? Math.max(...brakeValues) : 100;

    return {
      points: pts,
      viewBox: `0 0 ${width} ${height}`,
      minSpeed: minSpd,
      maxSpeed: maxSpd,
      minBrake: minBrk,
      maxBrake: maxBrk,
    };
  }, [posX, posY, speed, throttle, brake, width, height]);

  if (points.length === 0) {
    return (
      <div 
        className="bg-f1-dark/30 rounded-xl border border-f1-gray/20 flex items-center justify-center"
        style={{ width, height }}
      >
        <p className="text-f1-light text-sm">No track data available</p>
      </div>
    );
  }

  // Create path segments with colors
  const segments = points.slice(0, -1).map((pt, i) => {
    const next = points[i + 1];
    let color: string;
    
    if (colorMode === "speed") {
      color = getSpeedColor(pt.speed, minSpeed, maxSpeed);
    } else if (colorMode === "throttle") {
      color = getThrottleColor(pt.throttle);
    } else {
      // For brake, use the actual brake value at this point
      const brakeValue = pt.brake || 0;
      color = getBrakeColor(brakeValue);
    }

    return {
      x1: pt.x,
      y1: pt.y,
      x2: next.x,
      y2: next.y,
      color,
      index: i,
    };
  });

  return (
    <div className="relative overflow-hidden rounded-xl">
      <svg
        width={width}
        height={height}
        viewBox={viewBox}
        className="bg-f1-dark/30 border border-f1-gray/20"
      >
        {/* Track outline (shadow) */}
        <g opacity={0.3}>
          {segments.map((seg, i) => (
            <line
              key={`shadow-${i}`}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke="#000"
              strokeWidth={12}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Colored track segments */}
        {segments.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={seg.color}
            strokeWidth={6}
            strokeLinecap="round"
            className="transition-opacity"
            opacity={hoveredIndex !== null && Math.abs(hoveredIndex - seg.index) > 5 ? 0.4 : 1}
          />
        ))}
        
        {/* Invisible hover areas - wider for better interaction */}
        {segments.map((seg, i) => (
          <line
            key={`hover-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke="transparent"
            strokeWidth={20}
            strokeLinecap="round"
            className="cursor-pointer"
            onMouseEnter={() => handleHover(seg.index)}
            onMouseLeave={() => handleHover(null)}
          />
        ))}

        {/* Hover indicator */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <g style={{ pointerEvents: 'none' }}>
            {/* Large visible circle for testing */}
            <circle
              cx={points[hoveredIndex].x}
              cy={points[hoveredIndex].y}
              r={20}
              fill="#e10600"
              opacity={0.8}
            />
            {/* Outer glow */}
            <circle
              cx={points[hoveredIndex].x}
              cy={points[hoveredIndex].y}
              r={16}
              fill="none"
              stroke="#e10600"
              strokeWidth={2}
              opacity={0.3}
            />
            {/* Inner glow */}
            <circle
              cx={points[hoveredIndex].x}
              cy={points[hoveredIndex].y}
              r={10}
              fill="#e10600"
              opacity={0.5}
            />
            {/* Main dot */}
            <circle
              cx={points[hoveredIndex].x}
              cy={points[hoveredIndex].y}
              r={6}
              fill="#e10600"
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Start/Finish line indicator */}
        {points.length > 0 && (
          <g>
            <circle
              cx={points[0].x}
              cy={points[0].y}
              r={8}
              fill="#fff"
              stroke="#e10600"
              strokeWidth={2}
            />
            <text
              x={points[0].x + 12}
              y={points[0].y + 4}
              fill="#fff"
              fontSize={10}
              fontWeight="bold"
            >
              S/F
            </text>
          </g>
        )}
      </svg>

      {/* Speed legend */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-xs">
        <span className="text-f1-light">
          {colorMode === "speed" ? `${Math.round(minSpeed)}` : "0%"}
        </span>
        <div 
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{
            background: colorMode === "speed" 
              ? "linear-gradient(to right, rgb(0, 100, 255), rgb(0, 255, 200), rgb(255, 255, 0), rgb(255, 155, 0), rgb(255, 0, 0))"
              : colorMode === "throttle"
              ? "linear-gradient(to right, rgb(0, 55, 0), rgb(0, 255, 0))"
              : "linear-gradient(to right, rgb(55, 0, 0), rgb(255, 0, 0))"
          }}
        />
        <span className="text-f1-light">
          {colorMode === "speed" ? `${Math.round(maxSpeed)} km/h` : "100%"}
        </span>
      </div>

      {/* Hover info */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div 
          className="absolute top-2 left-2 bg-f1-dark/95 border border-f1-gray/30 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{ pointerEvents: 'none' }}
        >
          <div className="font-semibold text-f1-white mb-1">
            {Math.round(points[hoveredIndex].speed)} km/h
          </div>
          <div className="text-f1-light space-y-0.5">
            <div>Throttle: {
              // If throttle values are 0-1, convert to percentage
              points[hoveredIndex].throttle <= 1 
                ? Math.round(points[hoveredIndex].throttle * 100) 
                : Math.round(points[hoveredIndex].throttle)
            }%</div>
            <div>Brake: {
              // If brake values are 0-1, convert to percentage
              points[hoveredIndex].brake <= 1 
                ? Math.round(points[hoveredIndex].brake * 100) 
                : Math.round(points[hoveredIndex].brake)
            }%</div>
          </div>
        </div>
      )}
    </div>
  );
}

