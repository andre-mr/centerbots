import React from "react";

const HelpPage: React.FC = () => {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="mb-3 flex items-start justify-between">
        <h2 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
          Ajuda
        </h2>
      </div>
      <div className="flex h-full flex-col items-center justify-center">
        <p className="mb-3 text-lg text-gray-600 dark:text-gray-300">🚧</p>
        <p className="text-xl text-gray-600 dark:text-gray-200">Em breve...</p>
      </div>
    </div>
  );
};

export default HelpPage;
