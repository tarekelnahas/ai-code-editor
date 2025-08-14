import React, { useState, useEffect } from 'react';
import TranscriptItem from './TranscriptItem'; // Import the new component

// Define the structure of an experiment
interface Experiment {
  experiment_id: string;
  timestamp: string;
  model: string;
  transcript: Array<{ role: string; content: string | any; }>;
  evaluation_report?: any; // Add evaluation report field
}

const EvaluationReport: React.FC<{ report: any }> = ({ report }) => {
    return (
        <div className="mt-4 p-3 rounded-lg border border-green-700 bg-green-900/50">
            <h3 className="text-md font-semibold text-green-300 mb-2">📊 Evaluation Report</h3>
            <table className="w-full text-xs text-left">
                <thead>
                    <tr className="text-green-400">
                        <th className="p-1">Metric</th>
                        <th className="p-1">Precision</th>
                        <th className="p-1">Recall</th>
                        <th className="p-1">F1-Score</th>
                        <th className="p-1">Support</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(report).map(([key, value]: [string, any]) => {
                        if (typeof value === 'object' && value !== null) {
                            return (
                                <tr key={key} className="border-t border-green-800">
                                    <td className="p-1 font-medium">{key}</td>
                                    <td className="p-1">{value.precision?.toFixed(2)}</td>
                                    <td className="p-1">{value.recall?.toFixed(2)}</td>
                                    <td className="p-1">{value['f1-score']?.toFixed(2)}</td>
                                    <td className="p-1">{value.support}</td>
                                </tr>
                            );
                        }
                        return null;
                    })}
                </tbody>
            </table>
        </div>
    );
};

const ExperimentDashboard: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiments = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/experiments');
      if (!response.ok) {
        throw new Error('Failed to fetch experiments');
      }
      const data = await response.json();
      data.sort((a: Experiment, b: Experiment) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setExperiments(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  if (loading) return <div className="p-4">Loading experiments...</div>;
  if (error) return <div className="p-4">Error: {error} <button className="btn" onClick={fetchExperiments}>Retry</button></div>;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-200">Experiment Tracker</h1>
        <button className="btn" onClick={fetchExperiments}>Refresh</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {experiments.length === 0 && (
            <div className="text-center text-gray-500 mt-8">No experiments found.</div>
        )}
        {experiments.map(exp => (
          <div key={exp.experiment_id} className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
                <div className="text-xs text-gray-400">
                    <span className="font-semibold text-gray-300">ID:</span> {exp.experiment_id}
                </div>
                <div className="text-xs text-gray-400">
                    <span className="font-semibold text-gray-300">Time:</span> {new Date(exp.timestamp).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">
                    <span className="font-semibold text-gray-300">Model:</span> {exp.model}
                </div>
            </div>
            <div className="space-y-4">
              {exp.transcript.map((msg, idx) => (
                <TranscriptItem key={idx} message={msg} />
              ))}
              {exp.evaluation_report && <EvaluationReport report={exp.evaluation_report} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExperimentDashboard;
