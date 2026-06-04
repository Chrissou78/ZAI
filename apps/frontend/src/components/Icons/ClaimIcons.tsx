// ── apps/frontend/src/components/Icons/ClaimIcons.tsx ──

/** Camera / Phone – for "Take a photo" action */
export const CameraIcon = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    <circle cx="12" cy="13" r="4" stroke={color} strokeWidth="1.8" fill="none" />
  </svg>
);

/** Smartphone – alternative for "Take a photo with your phone" */
export const SmartphoneIcon = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"
      stroke={color} strokeWidth="1.8" fill="none"
    />
    <line x1="12" y1="18" x2="12.01" y2="18"
      stroke={color} strokeWidth="2" strokeLinecap="round"
    />
  </svg>
);

/** Upload / Folder – for "Upload from files" action */
export const UploadIcon = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    <polyline points="17 8 12 3 7 8"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    <line x1="12" y1="3" x2="12" y2="15"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"
    />
  </svg>
);

/** Folder – alternative for "Browse files" */
export const FolderIcon = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
  </svg>
);

/** Image/Photo file – for proof of purchase / receipt  */
export const ImageFileIcon = ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"
      stroke={color} strokeWidth="1.8" fill="none"
    />
    <circle cx="8.5" cy="8.5" r="1.5" fill={color} />
    <polyline points="21 15 16 10 5 21"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
  </svg>
);
