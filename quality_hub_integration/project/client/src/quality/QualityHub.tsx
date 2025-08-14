import React, { useEffect, useState } from 'react';

interface Tool {
  name: string;
  category: string;
}

interface RunResult {
  name: string;
  status: string;
  output: string;
}

/**
 * QualityHub panel.
 *
 * This component fetches a catalogue of available tools from the
 * backend and renders them grouped by category. Each tool has a
 * "Run" button which triggers an API call to execute the tool. The
 * run result is displayed below the list. The intent is to allow
 * developers to explore and invoke many different code quality and
 * DevOps utilities from a single place. Tools that are not
 * installed on the host will report that status.
 */
const QualityHub: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch the list of tools on mount
  useEffect(() => {
    fetch('/api/tools')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch tools');
        return res.json();
      })
      .then(data => {
        setTools(data as Tool[]);
      })
      .catch(err => {
        setError(err.message);
      });
  }, []);

  // Group tools by category
  const grouped = tools.reduce<Record<string, Tool[]>>((acc, tool) => {
    acc[tool.category] = acc[tool.category] || [];
    acc[tool.category].push(tool);
    return acc;
  }, {});

  const handleRun = (name: string) => {
    setLoading(true);
    setError(null);
    setRunResult(null);
    fetch('/api/tools/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then(res => {
        if (!res.ok) return res.json().then(err => Promise.reject(err));
        return res.json();
      })
      .then((data: RunResult) => {
        setRunResult(data);
      })
      .catch(err => {
        setError(typeof err.detail === 'string' ? err.detail : err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900">
      <h2 className="text-xl font-bold mb-2">Quality Hub</h2>
      {error && <div className="text-red-600 mb-2">Error: {error}</div>}
      {Object.keys(grouped).length === 0 && !error && (
        <div>Loading tools…</div>
      )}
      <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
        {Object.entries(grouped).map(([category, catTools]) => (
          <div key={category}>
            <h3 className="font-semibold mb-1">{category}</h3>
            <ul className="ml-4 space-y-1">
              {catTools.map(tool => (
                <li key={tool.name} className="flex items-center justify-between">
                  <span>{tool.name}</span>
                  <button
                    onClick={() => handleRun(tool.name)}
                    className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={loading}
                  >
                    Run
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {runResult && (
        <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <h4 className="font-medium">Result: {runResult.name}</h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status: {runResult.status}</p>
          <pre className="text-xs whitespace-pre-wrap overflow-x-auto" style={{ maxHeight: '150px' }}>
            {runResult.output}
          </pre>
        </div>
      )}
    </div>
  );
};

export default QualityHub;