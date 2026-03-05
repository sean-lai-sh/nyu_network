/**
 * AsciiFlame — Grayscale / no color
 *
 * 60 columns x 40 rows total:
 *  - FlameSimulation: 60 x 30
 *  - TorchStem: 60 x 10
 *
 * Pure white/gray ASCII on black. No bloom, no embers, no color.
 */

import FlameSimulation from "./FlameSimulation";
import TorchStem from "./TorchStem";

export default function AsciiFlame() {
  return (
    <div className="ascii-flame-root">
      <div className="flame-stack">
        <FlameSimulation />
        <TorchStem />
      </div>

      <style>{`
        .ascii-flame-root {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          user-select: none;
          z-index: 0;
          overflow: hidden;
        }
        .flame-stack {
          position: absolute;
          right: clamp(-12rem, -8vw, -2rem);
          top: 50%;
          transform: translateY(-50%);
          z-index: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0.8;
        }

        @media (max-width: 768px) {
          .flame-stack {
            left: 50%;
            right: auto;
            top: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
