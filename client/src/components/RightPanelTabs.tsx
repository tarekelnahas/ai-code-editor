import React, {useState} from "react";
import QualityHub from "../quality/QualityHub";
import AIToolsChat from "./AIToolsChat";
import ExperimentDashboard from "./ExperimentDashboard";
import TabButton from "./TabButton"; // Import the new reusable component
const TemporalTimeline = () => <div className="opacity-70">Timeline coming soon…</div>;

export default function RightPanelTabs() {
  const [tab, setTab] = useState<"chat"|"quality"|"timeline"|"experiments">("chat");

  return (
    <div className="panel h-full flex flex-col min-h-0 bg-panel">
      <div className="flex border-b border-border bg-bg-secondary">
        <TabButton onClick={() => setTab('chat')} isActive={tab === 'chat'}>💬 AI Assistant</TabButton>
        <TabButton onClick={() => setTab('quality')} isActive={tab === 'quality'}>🔍 Quality</TabButton>
        <TabButton onClick={() => setTab('experiments')} isActive={tab === 'experiments'}>🔬 Experiments</TabButton>
        <TabButton onClick={() => setTab('timeline')} isActive={tab === 'timeline'}>📅 Timeline</TabButton>
      </div>
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {tab === "chat" && <AIToolsChat />}
        {tab === "quality" && <QualityHub />}
        {tab === "experiments" && <ExperimentDashboard />}
        {tab === "timeline" && <TemporalTimeline />}
      </div>
    </div>
  );
}