import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Renders a document outside #root. While any portal is mounted, printing
// shows only the portal content (see the print rules in index.css).
let activePortals = 0;

export const PrintPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    activePortals += 1;
    document.body.classList.add('print-portal-active');
    return () => {
      activePortals -= 1;
      if (activePortals === 0) document.body.classList.remove('print-portal-active');
    };
  }, []);

  return createPortal(<div className="print-portal">{children}</div>, document.body);
};
