import React from 'react';

interface TabButtonProps {
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ onClick, isActive, children }) => {
  // Use conditional class rendering as taught in the transcript.
  const baseClasses = 'tab px-4 py-2 text-sm font-medium';
  const activeClasses = 'active bg-gray-700 text-white';
  const inactiveClasses = 'text-gray-400 hover:bg-gray-800 hover:text-gray-300';

  const finalClassName = `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;

  return (
    <button className={finalClassName} onClick={onClick}>
      {children}
    </button>
  );
};

export default TabButton;
