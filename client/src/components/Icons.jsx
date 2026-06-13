const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
};

export const IconPlus = ({ size = 13 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export const IconClose = ({ size = 13 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export const IconEdit = ({ size = 14 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.75">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  </svg>
);

export const IconTrash = ({ size = 14 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.75">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

export const IconSearch = ({ size = 13 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

export const IconArrowRight = ({ size = 14, style }) => (
  <svg {...base} width={size} height={size} strokeWidth="2" style={style}>
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

export const IconArrowLeft = ({ size = 14 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

export const IconChevronRight = ({ size = 14 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
