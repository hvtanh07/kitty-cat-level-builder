import React, { useState } from 'react';
import { LevelConfig } from '../types';
import { Download, Upload, Copy, Check, X, AlertCircle } from 'lucide-react';

interface JsonModalProps {
  isOpen: boolean;
  mode: 'export' | 'import';
  currentLevel: LevelConfig;
  onClose: () => void;
  onImport: (level: LevelConfig) => void;
}

export const JsonModal: React.FC<JsonModalProps> = ({
  isOpen,
  mode,
  currentLevel,
  onClose,
  onImport
}) => {
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const exportString = JSON.stringify(currentLevel, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Failed to copy to clipboard.');
    }
  };

  const handleDownload = () => {
    const filename = `${currentLevel.name.toLowerCase().replace(/\s+/g, '_')}_level.json`;
    const blob = new Blob([exportString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setImportText(content);
      validateAndLoad(content);
    };
    reader.readAsText(file);
  };

  const validateAndLoad = (rawJson: string) => {
    setErrorMessage(null);
    try {
      const parsed = JSON.parse(rawJson) as LevelConfig;

      // Basic schema validations
      if (!parsed.name || typeof parsed.name !== 'string') {
        throw new Error('Level must have a valid "name" field.');
      }
      if (!parsed.grid || !parsed.grid.cells || !Array.isArray(parsed.grid.cells)) {
        throw new Error('Level must have a valid "grid.cells" 2D array.');
      }
      if (!Array.isArray(parsed.queues)) {
        throw new Error('Level must have a valid "queues" array.');
      }

      onImport(parsed);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Invalid level JSON format.'
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border-2 border-amber-900/20 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
          <div>
            <h3 className="font-extrabold text-lg text-slate-800">
              {mode === 'export' ? 'Export Level JSON' : 'Import Level Config'}
            </h3>
            <p className="text-xs text-slate-500">
              {mode === 'export'
                ? 'Save your designed level to a JSON file or copy to clipboard'
                : 'Load a level config from a JSON file or paste contents below'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'export' ? (
            <div className="flex flex-col gap-3">
              <textarea
                readOnly
                value={exportString}
                className="w-full h-80 p-3 font-mono text-xs rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 select-all resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs shadow-sm transition active:scale-95"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow transition active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .json File</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* File Upload Zone */}
              <label className="border-2 border-dashed border-amber-900/20 hover:border-amber-900/40 bg-amber-50/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition">
                <Upload className="w-8 h-8 text-amber-800 mb-2" />
                <span className="font-bold text-xs text-amber-950">
                  Click to browse or drop a .json file
                </span>
                <span className="text-[10px] text-slate-400 mt-1">Accepts UTF-8 JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Raw JSON Paste Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Or paste JSON config here:
                </label>
                <textarea
                  placeholder='{"name": "Custom Level", "grid": { ... } }'
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  className="w-full h-48 p-3 font-mono text-xs rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => validateAndLoad(importText)}
                  disabled={!importText.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs shadow transition active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Load Level</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
