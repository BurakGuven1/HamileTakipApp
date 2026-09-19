import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from "react-native-svg";

import type { BellyStickerShape, StudioPalette } from "./types";

/**
 * Tüm süslemeler vektör olarak burada çizilir: dışarıdan indirilen telifli bir
 * görsel yok, ölçek büyüdükçe bozulma yok ve her biri konsept paletine göre
 * renkleniyor.
 */

type DecorProps = {
  palette: StudioPalette;
  size: number;
};

export function PineTree({ palette, size }: DecorProps) {
  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <Path d="M50 6 L74 40 H62 L80 68 H20 L38 40 H26 Z" fill={palette.nature} />
      <Rect fill={palette.ink} height={16} rx={2} width={9} x={45.5} y={66} />
    </Svg>
  );
}

export function MountainRange({ palette, size }: DecorProps) {
  return (
    <Svg height={size * 0.5} viewBox="0 0 100 50" width={size}>
      <Path
        d="M4 46 L30 10 L48 34 L62 18 L96 46"
        fill="none"
        stroke={palette.ink}
        strokeLinecap="round"
        strokeWidth={4}
      />
      <Path d="M22 24 L30 14 L38 24 Z" fill={palette.ink} />
    </Svg>
  );
}

export function SunBurst({ palette, size }: DecorProps) {
  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <Circle
        cx={50}
        cy={50}
        fill={palette.accentSoft}
        r={22}
        stroke={palette.accent}
        strokeWidth={4}
      />
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (index * Math.PI) / 4;
        const from = { x: 50 + Math.cos(angle) * 30, y: 50 + Math.sin(angle) * 30 };
        const to = { x: 50 + Math.cos(angle) * 44, y: 50 + Math.sin(angle) * 44 };
        return (
          <Path
            d={`M${from.x} ${from.y} L${to.x} ${to.y}`}
            key={index}
            stroke={palette.accent}
            strokeLinecap="round"
            strokeWidth={5}
          />
        );
      })}
    </Svg>
  );
}

export function Tent({ palette, size }: DecorProps) {
  return (
    <Svg height={size * 0.8} viewBox="0 0 100 80" width={size}>
      <Path d="M50 8 L92 72 H8 Z" fill={palette.paper} stroke={palette.ink} strokeWidth={4} />
      <Path d="M50 8 L50 72" stroke={palette.ink} strokeWidth={4} />
      <Path d="M50 30 L34 72 H66 Z" fill={palette.accent} />
    </Svg>
  );
}

export function CloudPuff({ palette, size }: DecorProps) {
  return (
    <Svg height={size * 0.62} viewBox="0 0 100 62" width={size}>
      <Path
        d="M26 52 C10 52 6 34 20 30 C20 14 44 8 52 22 C66 12 86 22 82 36 C94 40 92 52 78 52 Z"
        fill={palette.paper}
        stroke={palette.ink}
        strokeWidth={3}
      />
    </Svg>
  );
}

export function GardenFlower({ palette, size }: DecorProps) {
  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <Path d="M50 52 L50 92" stroke={palette.nature} strokeLinecap="round" strokeWidth={6} />
      <Path d="M50 74 C36 74 30 64 30 58 C42 58 50 66 50 74 Z" fill={palette.nature} />
      {Array.from({ length: 6 }).map((_, index) => {
        const angle = (index * Math.PI) / 3;
        return (
          <Circle
            cx={50 + Math.cos(angle) * 16}
            cy={40 + Math.sin(angle) * 16}
            fill={palette.accentSoft}
            key={index}
            r={11}
            stroke={palette.accent}
            strokeWidth={2.5}
          />
        );
      })}
      <Circle cx={50} cy={40} fill={palette.accent} r={9} />
    </Svg>
  );
}

export function Butterfly({ palette, size }: DecorProps) {
  return (
    <Svg height={size * 0.8} viewBox="0 0 100 80" width={size}>
      <Path
        d="M48 40 C28 8 6 20 18 40 C6 60 30 70 48 40 Z"
        fill={palette.accentSoft}
        stroke={palette.accent}
        strokeWidth={3}
      />
      <Path
        d="M52 40 C72 8 94 20 82 40 C94 60 70 70 52 40 Z"
        fill={palette.accentSoft}
        stroke={palette.accent}
        strokeWidth={3}
      />
      <Rect fill={palette.ink} height={34} rx={3} width={6} x={47} y={24} />
    </Svg>
  );
}

export function Mushroom({ palette, size }: DecorProps) {
  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <Path d="M14 52 C14 26 86 26 86 52 Z" fill={palette.accent} stroke={palette.ink} strokeWidth={4} />
      <Circle cx={36} cy={42} fill={palette.paper} r={7} />
      <Circle cx={62} cy={38} fill={palette.paper} r={5} />
      <Path
        d="M38 52 H62 V80 C62 90 38 90 38 80 Z"
        fill={palette.paper}
        stroke={palette.ink}
        strokeWidth={4}
      />
    </Svg>
  );
}

/**
 * Ahşap yön tabelası. Üzerindeki kısa söz ("SICAK GÜLÜŞLER" gibi) React
 * tarafında bu levhanın üstüne yazılır; burada sadece levhanın kendisi var.
 */
export function SignBoard({
  palette,
  pointing = "right",
  size
}: DecorProps & { pointing?: "left" | "right" }) {
  const points =
    pointing === "right"
      ? "4,6 78,6 96,26 78,46 4,46"
      : "96,6 22,6 4,26 22,46 96,46";

  return (
    <Svg height={size * 0.52} viewBox="0 0 100 52" width={size}>
      <Polygon fill={palette.paper} points={points} stroke={palette.ink} strokeWidth={4} />
    </Svg>
  );
}

export function SignPost({ palette, size }: DecorProps) {
  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <Rect
        fill={palette.accentSoft}
        height={96}
        rx={4}
        stroke={palette.ink}
        strokeWidth={3}
        width={14}
        x={43}
        y={4}
      />
      <Path d="M14 96 C26 88 74 88 86 96" stroke={palette.nature} strokeLinecap="round" strokeWidth={5} />
    </Svg>
  );
}

type BellyShapeProps = {
  color: string;
  shape: BellyStickerShape;
  size: number;
};

/**
 * Karına yapıştırılan taşlar. Gerçek bir taş gibi dursun diye her birinde üstte
 * beyaz bir kaçamak ışık, altta ince bir gölge var; düz renkli bir şekil
 * fotoğrafın üstüne basılmış gibi duruyordu.
 */
export function BellyStickerShapeView({ color, shape, size }: BellyShapeProps) {
  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <G>
        {shape === "gem" ? (
          <>
            <Polygon fill={color} points="50,6 92,38 74,92 26,92 8,38" />
            <Polygon fill="#FFFFFF" opacity={0.55} points="50,6 68,34 50,44 32,34" />
            <Polygon fill="#000000" opacity={0.12} points="74,92 26,92 50,60" />
          </>
        ) : null}

        {shape === "heart" ? (
          <>
            <Path
              d="M50 90 C14 62 8 38 24 24 C38 12 50 26 50 34 C50 26 62 12 76 24 C92 38 86 62 50 90 Z"
              fill={color}
            />
            <Ellipse cx={34} cy={36} fill="#FFFFFF" opacity={0.55} rx={9} ry={6} />
          </>
        ) : null}

        {shape === "star" ? (
          <>
            <Polygon fill={color} points="50,4 61,36 95,36 68,57 78,90 50,70 22,90 32,57 5,36 39,36" />
            <Polygon fill="#FFFFFF" opacity={0.5} points="50,4 56,34 44,34" />
          </>
        ) : null}

        {shape === "sparkle" ? (
          <Path
            d="M50 2 C54 34 66 46 98 50 C66 54 54 66 50 98 C46 66 34 54 2 50 C34 46 46 34 50 2 Z"
            fill={color}
          />
        ) : null}

        {shape === "flower" ? (
          <>
            {Array.from({ length: 5 }).map((_, index) => {
              const angle = (index * 2 * Math.PI) / 5 - Math.PI / 2;
              return (
                <Circle
                  cx={50 + Math.cos(angle) * 26}
                  cy={50 + Math.sin(angle) * 26}
                  fill={color}
                  key={index}
                  r={20}
                />
              );
            })}
            <Circle cx={50} cy={50} fill="#FFFFFF" opacity={0.85} r={16} />
          </>
        ) : null}

        {shape === "dot" ? (
          <>
            <Circle cx={50} cy={50} fill={color} r={44} />
            <Circle cx={38} cy={38} fill="#FFFFFF" opacity={0.6} r={12} />
          </>
        ) : null}
      </G>
    </Svg>
  );
}
