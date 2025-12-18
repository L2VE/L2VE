import React from 'react';

function ScanMessageBanner({ messageClass, scanMessage }) {
  if (!scanMessage) return null;
  return (
    <div className={`lg:col-span-2 p-5 rounded-2xl ${messageClass}`}>
      <p className="text-sm font-medium">{scanMessage}</p>
    </div>
  );
}

export default ScanMessageBanner;


