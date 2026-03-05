/**
 * FlameSimulation — Original ASCII flame art with edge flicker
 *
 * Renders the flame portion of the original ASCII art (rows 1-30) statically,
 * then detects edge characters (cells adjacent to empty space) and randomly
 * flickers them each frame — toggling brightness, swapping chars, or briefly
 * blanking. The core body stays solid and fixed.
 */

import { useEffect, useRef, useMemo, useCallback } from "react";

// The original flame art (rows 1-30 from ascii-art.txt)
const FLAME_ART = [
  "                                                  ...                                               ",
  "                                                   .+..                                             ",
  "                                                 ..*@#.                                             ",
  "                                                 .*@@@=..                                           ",
  "                                               ..*@@@@%..                                           ",
  "                                              ..#@@@@@@*.       ....                                ",
  "                             ...            ...%@@@@@@@@:      ..+*..                               ",
  "                            ..::..         ..=@@@@@@@@@@+.    ..-@@=.                               ",
  "                             .=@:.       ..:%@@@@@@@@@@@*.    .=@@@@: .                             ",
  "                            ..@@%..   ...:%@@@@@@@@@@@@@%.....+@@@@@#..                             ",
  "                            .#@@@+. ....*@@@@@@@@@@@@@@@@...:%@@@@@@@-.                             ",
  "                          ..#@@@@@-...:%@@@@@@@@@@@@@@@#:.:#@@@@@@@@@=.                             ",
  "                        ..:%@@@@@@#..+@@@@@@@@@@@@@@@%:..*@@@@@@@@@@@*.    .....                    ",
  "                        ..%@@@@@@*..#@@@@@@@@@@@@@@%:..#@@@@@@@@@@@@@*.   ..:#..                    ",
  "                       .:@@@@@@@#..*@@@@@@@@@@@@@%-..*@@@@@@@@@@@@@@@+. ...=@%..                    ",
  "                     ...%@@@@@@@..+@@@@@@@@@@@@@+..=@@@@@@@@@@@@@@@@@-...-@@@#.                     ",
  "                     ..%@@@@@@@=.-@@@@@@@@@@@@@-.:%@@@@@@@@@@@@@@@@*...-@@@@@+.                     ",
  "                    ..+@@@@@@@%:.*@@@@@@@@@@@%:.-@@@@@@@@@@@@@@@*:..:*@@@@@@@-.                     ",
  "                   ...%@@@@@@@#.:%@@@@@@@@@@@-.-@@@@@@@@@@@@%+...-*@@@@@@@@@#..                     ",
  "                   ..-@@@@@@@@*.:%@@@@@@@@@@+..@@@@@@@@@@@=...-%@@@@@@@@@@@@:..                     ",
  "                   ..+@@@@@@@@#.:%@@@@@@@@@@:.+@@@@@@@@%:..=%@@@@@@@@@@@@@@*.                       ",
  "                   ..=@@@@@@@@%:.#@@@@@@@@@%..#@@@@@@%-..*@@@@@@@@@@@@@@@@%..                       ",
  "                   ..:@@@@@@@@@=.:@@@@@@@@@#..%@@@@@*..=@@@@@@@@@@@@@@@@@#.                         ",
  "                     .#@@@@@@@@@:.-@@@@@@@@%..#@@@@*..#@@@@@@@@@@@@@@@@@#..                         ",
  "                     .:%@@@@@@@@@-.:%@@@@@@@-.-@@@*..#@@@@@@@@@@@@@@@@@=..                          ",
  "                     ...*@@@@@@@@@+..+@@@@@@#..#@%:.*@@@@@@@@@@@@@@@@+...                           ",
  "                       ...*@@@@@@@@@-..+@@@@@=.-@=.-@@@@@@@@@@@@@@@-....                            ",
  "                         ...:+%@@@@@@%-..-#@@%:.-..#@@@@@@@@@@@#=...                                ",
  "                             ....-+#%%@%+...:*#....#%%%%%#*=:....                                   ",
  "                                   ........  ....  .. ....                                          ",
];

// Characters considered "solid" (part of the flame body)
const SOLID = new Set(["@", "#", "%", "*", "+", "=", "-", ":"]);
// Characters considered "wispy" (light edge material)
const WISPY = new Set([".", ":"]);

// Flicker replacement chars for edges
const FLICKER_CHARS = [" ", ".", ":", "-", "=", "+", "*", "#"];

export default function FlameSimulation() {
  const preRef = useRef<HTMLPreElement>(null);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);

  // Parse the art into a 2D grid and detect edge cells
  const { grid, edgeCells, rows, cols } = useMemo(() => {
    const rows = FLAME_ART.length;
    const cols = Math.max(...FLAME_ART.map((l) => l.length));
    // Pad all lines to same width
    const grid = FLAME_ART.map((line) => line.padEnd(cols, " ").split(""));

    // Detect edges: a cell is an "edge" if it's solid/wispy AND
    // at least one of its 4-neighbors is a space
    const edgeCells: Array<{ r: number; c: number; original: string }> = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = grid[r][c];
        if (ch === " ") continue;
        if (!SOLID.has(ch) && !WISPY.has(ch)) continue;

        // Check if any neighbor is empty
        const hasEmptyNeighbor =
          (r > 0 && grid[r - 1][c] === " ") ||
          (r < rows - 1 && grid[r + 1][c] === " ") ||
          (c > 0 && grid[r][c - 1] === " ") ||
          (c < cols - 1 && grid[r][c + 1] === " ") ||
          // Diagonals too for a softer edge
          (r > 0 && c > 0 && grid[r - 1][c - 1] === " ") ||
          (r > 0 && c < cols - 1 && grid[r - 1][c + 1] === " ") ||
          (r < rows - 1 && c > 0 && grid[r + 1][c - 1] === " ") ||
          (r < rows - 1 && c < cols - 1 && grid[r + 1][c + 1] === " ");

        if (hasEmptyNeighbor) {
          edgeCells.push({ r, c, original: ch });
        }
      }
    }

    return { grid, edgeCells, rows, cols };
  }, []);

  const step = useCallback(() => {
    const pre = preRef.current;
    if (!pre) return;

    // Start with a copy of the original grid
    const frame = grid.map((row) => [...row]);

    // Flicker ~30-40% of edge cells each frame
    for (const edge of edgeCells) {
      if (Math.random() > 0.35) continue; // skip most edges — only flicker a few

      const roll = Math.random();
      if (roll < 0.3) {
        // Blank it briefly
        frame[edge.r][edge.c] = " ";
      } else if (roll < 0.6) {
        // Swap to a random lighter char
        const idx = Math.floor(Math.random() * 3); // pick from " ", ".", ":"
        frame[edge.r][edge.c] = FLICKER_CHARS[idx];
      } else {
        // Brighten it — swap to a denser char
        const idx = 4 + Math.floor(Math.random() * 4); // "+", "*", "#", or keep
        frame[edge.r][edge.c] = FLICKER_CHARS[idx];
      }
    }

    // Render with grayscale intensity
    const htmlRows: string[] = [];
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < cols; c++) {
        const ch = frame[r][c];
        if (ch === " ") {
          line += " ";
        } else {
          // Map char density to brightness
          const density = " .:-=+*#%@".indexOf(ch);
          const v = density >= 0 ? density / 9 : 0.3;
          const g = Math.round(80 + v * 175);
          line += `<span style="color:rgb(${g},${g},${g})">${ch}</span>`;
        }
      }
      htmlRows.push(`<div class="flame-row">${line}</div>`);
    }
    pre.innerHTML = htmlRows.join("");
  }, [grid, edgeCells, rows, cols]);

  useEffect(() => {
    const FPS = 14;
    const FRAME_MS = 1000 / FPS;
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (now - lastFrameRef.current < FRAME_MS) return;
      lastFrameRef.current = now;
      step();
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step]);

  return (
    <>
      <pre ref={preRef} className="flame-art" />
      <style>{`
        .flame-art {
          font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
          font-size: clamp(6px, 1.1vw, 12px);
          line-height: 1.15;
          letter-spacing: 0.02em;
          margin: 0;
          padding: 0;
          white-space: pre;
          user-select: none;
          pointer-events: none;
        }
        .flame-row {
          display: block;
          line-height: 1.15;
        }
      `}</style>
    </>
  );
}
