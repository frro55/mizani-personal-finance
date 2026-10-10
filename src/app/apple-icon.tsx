import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #e2fff0 0%, #a5f2d0 55%, #4bd0ae 100%)", borderRadius: 38 }}>
      <svg width="142" height="142" viewBox="0 0 512 512">
        <defs>
          <linearGradient id="wallet" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#087b63"/><stop offset="1" stopColor="#004b40"/></linearGradient>
          <linearGradient id="flap" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#19a985"/><stop offset="1" stopColor="#08735d"/></linearGradient>
        </defs>
        <path d="M116 190 342 122c26-8 49 8 55 32l8 31-277 78z" fill="#075847"/>
        <path d="M98 211c0-24 18-43 42-43h219c25 0 44 19 44 44v154c0 27-20 47-47 47H145c-27 0-47-20-47-47z" fill="url(#wallet)"/>
        <path d="M100 222c0-23 19-42 42-42h218c25 0 43 18 43 43v19H142c-23 0-42 18-42 41z" fill="#159b7b"/>
        <path d="M319 243h83c19 0 34 15 34 34v53c0 19-15 34-34 34h-83c-22 0-40-18-40-40v-41c0-22 18-40 40-40z" fill="url(#flap)"/>
        <circle cx="337" cy="304" r="15" fill="#e7fff4"/>
        <rect x="137" y="300" width="29" height="56" rx="14" fill="#d7ffeb"/>
        <rect x="181" y="273" width="29" height="83" rx="14" fill="#d7ffeb"/>
        <rect x="225" y="247" width="29" height="109" rx="14" fill="#d7ffeb"/>
      </svg>
    </div>,
    { ...size }
  );
}
