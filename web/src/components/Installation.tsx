import { useState } from "react";

export function Installation() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section
      id="installation"
      className="relative py-24 border-t border-zinc-800"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Get started in seconds
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Install the CLI globally and you're ready to go.
          </p>
        </div>

        <div className="relative">
          <div className="absolute -top-1 -left-1 w-3 h-3 border-l border-t border-emerald-500/50" />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-r border-t border-emerald-500/50" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l border-b border-emerald-500/50" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r border-b border-emerald-500/50" />

          <div className="border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <span className="text-sm text-zinc-500 font-mono">npm</span>
              <button
                onClick={() => handleCopy("npm install -g envii-cli", "npm")}
                className="text-xs text-zinc-500 cursor-pointer hover:text-white transition-colors px-2 py-1 border border-zinc-700 hover:border-zinc-500"
              >
                {copiedId === "npm" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="p-4 font-mono text-lg">
              <span className="text-zinc-500">$</span>{" "}
              <span className="text-emerald-400">npm</span>{" "}
              <span className="text-zinc-100">install -g envii-cli</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <span className="text-sm text-zinc-500 font-mono">pnpm</span>
              <button
                onClick={() => handleCopy("pnpm add -g envii-cli", "pnpm")}
                className="text-xs text-zinc-500 cursor-pointer hover:text-white transition-colors px-2 py-1 border border-zinc-700 hover:border-zinc-500"
              >
                {copiedId === "pnpm" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="p-4 font-mono text-sm">
              <span className="text-zinc-500">$</span>{" "}
              <span className="text-emerald-400">pnpm</span>{" "}
              <span className="text-zinc-100">add -g envii-cli</span>
            </div>
          </div>

          <div className="border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <span className="text-sm text-zinc-500 font-mono">yarn</span>
              <button
                onClick={() => handleCopy("yarn global add envii-cli", "yarn")}
                className="text-xs text-zinc-500 cursor-pointer hover:text-white transition-colors px-2 py-1 border border-zinc-700 hover:border-zinc-500"
              >
                {copiedId === "yarn" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="p-4 font-mono text-sm">
              <span className="text-zinc-500">$</span>{" "}
              <span className="text-emerald-400">yarn</span>{" "}
              <span className="text-zinc-100">global add envii-cli</span>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-xl font-semibold text-white">Quick Start</h3>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
          <div className="space-y-4 text-zinc-300">
            <div className="flex gap-4 items-start">
              <span className="flex-shrink-0 w-6 h-6 border border-zinc-700 text-emerald-400 text-xs flex items-center justify-center font-mono">
                1
              </span>
              <div>
                <code className="text-emerald-400 font-mono">envii init</code>
                <span className="text-zinc-500 ml-2">
                  — Generate your recovery phrase
                </span>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="flex-shrink-0 w-6 h-6 border border-zinc-700 text-emerald-400 text-xs flex items-center justify-center font-mono">
                2
              </span>
              <div>
                <code className="text-emerald-400 font-mono">
                  cd ~/projects && envii backup
                </code>
                <span className="text-zinc-500 ml-2">
                  — Backup all your .env files
                </span>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="flex-shrink-0 w-6 h-6 border border-zinc-700 text-emerald-400 text-xs flex items-center justify-center font-mono">
                3
              </span>
              <div>
                <code className="text-emerald-400 font-mono">
                  envii restore
                </code>
                <span className="text-zinc-500 ml-2">
                  — Restore on any machine
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-xl font-semibold text-white">Commands</h3>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
          <div className="border border-zinc-800">
            <table className="w-full text-left">
              <thead className="bg-zinc-900 border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-xs font-mono text-zinc-500 uppercase tracking-wider">
                    Command
                  </th>
                  <th className="px-4 py-3 text-xs font-mono text-zinc-500 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                <tr className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-mono text-emerald-400 text-sm">
                    envii init
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-sm">
                    Initialize with a new or existing recovery phrase
                  </td>
                </tr>
                <tr className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-mono text-emerald-400 text-sm">
                    envii backup
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-sm">
                    Backup all .env files in current directory tree
                  </td>
                </tr>
                <tr className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-mono text-emerald-400 text-sm">
                    envii restore
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-sm">
                    Restore .env files to matching projects
                  </td>
                </tr>
                <tr className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-mono text-emerald-400 text-sm">
                    envii list
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-sm">
                    List all backed up projects
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
