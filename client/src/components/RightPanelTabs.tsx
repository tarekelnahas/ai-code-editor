import React, {useState} from "react";
import QualityHub from "../quality/QualityHub";
import AIToolsChat from "./AIToolsChat";
import ExperimentDashboard from "./ExperimentDashboard";
import TabButton from "./TabButton"; // Import the new reusable component
const TemporalTimeline = () => <div className="opacity-70">Timeline coming soon…</div>;

export default function RightPanelTabs() {
  const [tab, setTab] = useState<"chat"|"quality"|"timeline"|"experiments">("chat");

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#252526',
      borderLeft: '1px solid #3c3c3c'
    }}>
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #3c3c3c',
        background: '#2d2d30'
      }}>
        <TabButton onClick={() => setTab('chat')} isActive={tab === 'chat'}>💬 AI Assistant</TabButton>
        <TabButton onClick={() => setTab('quality')} isActive={tab === 'quality'}>🔍 Quality</TabButton>
        <TabButton onClick={() => setTab('experiments')} isActive={tab === 'experiments'}>🔬 Experiments</TabButton>
        <TabButton onClick={() => setTab('timeline')} isActive={tab === 'timeline'}>📅 Timeline</TabButton>
      </div>
      <div style={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {tab === "chat" && <AIToolsChat />}
        {tab === "quality" && <QualityHub />}
        {tab === "experiments" && <ExperimentDashboard />}
        {tab === "timeline" && <TemporalTimeline />}
      </div>
    </div>
  );
}