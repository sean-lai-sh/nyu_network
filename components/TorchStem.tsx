/**
 * TorchStem — static stem from the original ASCII art (rows 31-58).
 * Rendered with the same font/sizing as the flame so they align perfectly.
 */

const STEM_ART = [
  "                                   .++++++++++++++++++++-.                                          ",
  "                                  ..@@@@@@@@@@@@@@@@@@@@=.                                          ",
  "                                   .@@@@@@@@@@@@@@@@@@@@=.                                          ",
  "                                   .@@@@@@@@@@@@@@@@@@@@=.                                          ",
  "                                   .......................                                          ",
  "                                      .=@@@@@@@@@@@@#.                                              ",
  "                                      .-@@@@@@@@@@@@*                                               ",
  "                                      ..@@@@@@@@@@@@=                                               ",
  "                                      ..#@@@@@@@@@@@- .                                             ",

];

const DENSITY_SCALE = " .:-=+*#%@";

export default function TorchStem() {
  return (
    <pre className="torch-stem">
      {STEM_ART.map((line, i) => (
        <div key={i} className="stem-row">
          {line.split("").map((ch, idx) => {
            if (ch === " ") return <span key={idx}> </span>;
            const density = DENSITY_SCALE.indexOf(ch);
            const v = density >= 0 ? density / 9 : 0.3;
            const g = Math.round(80 + v * 175);
            return (
              <span key={idx} style={{ color: `rgb(${g},${g},${g})` }}>
                {ch}
              </span>
            );
          })}
        </div>
      ))}
      <style>{`
        .torch-stem {
          font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
          font-size: clamp(6px, 1.1vw, 12px);
          line-height: 1.15;
          letter-spacing: 0.02em;
          margin: 0;
          padding: 0;
          white-space: pre;
        }
        .stem-row {
          display: block;
          line-height: 1.15;
        }
      `}</style>
    </pre>
  );
}
