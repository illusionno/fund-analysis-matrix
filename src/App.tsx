import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useEffect, useState, useRef } from "react";
import { AddInstrumentBar } from "./components/AddInstrumentBar";
import { AiReviewSection } from "./components/AiReviewSection";
import { Header } from "./components/Header";
import { QuoteBoard } from "./components/QuoteBoard";
import { fetchMarketIndices } from "./services/marketApi";
import { ThemeContext } from "./context/ThemeContext";
import AiChatModal from "./components/AiChatModal";
import type { MarketIndexSnapshot } from "./types/market";
import type { QuoteSnapshot } from "./types/quote";
import { getAntdTheme } from "./theme/themeConfig";

const THEME_KEY = "fund-matrix-theme";

function readInitialDark(): boolean {
  if (typeof window === "undefined") return true;
  const s = localStorage.getItem(THEME_KEY);
  if (s === "light") return false;
  if (s === "dark") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
// 粒子背景（亮色减弱对比，避免喧宾夺主）
function ParticleCanvas({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(
    null,
  ) as React.RefObject<HTMLCanvasElement>;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let animId: number;

    /**
     * 调整画布大小以匹配窗口尺寸
     */
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize(); // 初始调整大小
    window.addEventListener("resize", resize);

    const PARTICLE_COUNT = 96;
    /** 粒子大小与原先一致：约 0.6 ~ 2.6 px */
    const particles = Array.from({ length: PARTICLE_COUNT }, () => {
      const r = Math.random() * 2.0 + 0.5;
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r,
        glow: r * 5,
      };
    });

    // 与 index.css :root 主题色一致，canvas 无法用 CSS 变量，从 DOM 读取
    const primaryRgb = () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--fm-accent")
        .trim() ||
      getComputedStyle(document.documentElement)
        .getPropertyValue("--fm-blue")
        .trim() ||
      "201, 100, 66";

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rgb = primaryRgb();

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        ctx.shadowBlur = p.glow;
        ctx.shadowColor = `rgba(${rgb}, ${isDark ? 0.5 : 0.22})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${isDark ? 0.5 + p.r * 0.2 : 0.22 + p.r * 0.12})`;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${isDark ? 0.7 : 0.38})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          /** 仅当两粒子足够近才连线，线段更短（视觉上「连得更近」） */
          const LINK_DIST = 58;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${rgb}, ${(isDark ? 0.44 : 0.11) * (1 - dist / LINK_DIST)})`;
            ctx.lineWidth = 0.75;
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [isDark]);

  return <canvas ref={canvasRef} className="fm-particle-canvas" />;
}

export default function App() {
  const [quotes, setQuotes] = useState<QuoteSnapshot[]>([]);
  const [marketIndices, setMarketIndices] = useState<MarketIndexSnapshot[]>([]);
  const [isDark, setIsDark] = useState(readInitialDark);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
  }, [isDark]);

  useEffect(() => {
    let mounted = true;
    const loadMarket = async () => {
      try {
        const indices = await fetchMarketIndices();
        if (mounted) setMarketIndices(indices);
      } catch {
        if (mounted) setMarketIndices([]);
      }
    };
    void loadMarket();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ConfigProvider theme={getAntdTheme(isDark)} locale={zhCN}>
      <ThemeContext.Provider value={isDark}>
        <AntdApp>
          <div
            className={`fm-shell ${isDark ? "fm-shell--dark" : "fm-shell--light"}`}
          >
            <ParticleCanvas isDark={isDark} />
            <Header isDark={isDark} onThemeChange={setIsDark} />
            <main className="fm-main" style={{ zIndex: 1 }}>
              <AddInstrumentBar quotes={quotes} />
              <QuoteBoard quotes={quotes} onQuotesChange={setQuotes} />
              <AiReviewSection
                quotes={quotes}
                marketIndices={marketIndices}
              />
              <AiChatModal quotes={quotes} />
            </main>
            <footer className="fm-footer">
              FundMatrix · 基金股票黄金每日复盘 · by 白桃与猫
            </footer>
          </div>
        </AntdApp>
      </ThemeContext.Provider>
    </ConfigProvider>
  );
}
