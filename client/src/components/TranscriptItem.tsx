import React from 'react';

// Define the structure of a transcript message
interface TranscriptMessage {
  role: string;
  content: string | any;
}

interface TranscriptItemProps {
  message: TranscriptMessage;
}

// Helper to format content which might be a JSON string
const formatContent = (content: string | any) => {
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return content; // It's not a JSON string, return as is
    }
  }
  return JSON.stringify(content, null, 2);
};

const TranscriptItem: React.FC<TranscriptItemProps> = ({ message }) => {
  const { role, content } = message;

  let icon = '📝';
  let title = role.toUpperCase();
  let bgColor = 'bg-gray-800/50';

  if (role === 'planner') {
    icon = '🗺️';
    title = 'PLANNER';
    bgColor = 'bg-blue-900/50';
  } else if (role.startsWith('tool_output:')) {
    icon = '🛠️';
    title = `TOOL OUTPUT: ${role.replace('tool_output:', '')}`;
    bgColor = 'bg-yellow-900/50';
  } else if (role === 'writer' || role === 'reviewer' || role === 'tester') {
    icon = '🤖';
    title = role.toUpperCase();
    bgColor = 'bg-indigo-900/50';
  }

  return (
    <div className={`mb-4 p-3 rounded-lg border border-gray-700 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-semibold text-gray-300">{title}</span>
      </div>
      <pre className="whitespace-pre-wrap text-xs m-0 font-mono bg-black/30 p-3 rounded-md text-gray-200">
        <code>{formatContent(content)}</code>
      </pre>
    </div>
  );
};

export default TranscriptItem;
