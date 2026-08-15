// Function Plane — Settings screen

const {
  useState: useSS
} = React;

// Short explanations shown in the ⓘ popup next to gameplay & sound settings.
const SETTING_HELP = {
  sound: 'Plays short tones when the ball bounces, you collect a star, and on level success or failure.',
  volume: 'Master volume for sound effects.',
  gridLabels: 'Show numeric labels along the X and Y axes of the level plane.',
  autoZoom: 'When you press Play, automatically zoom and pan so the ball, target stars, and your function fit on screen.',
  notation: 'Display style for equations on the level plane. Standard uses x^2 / sqrt(); Pretty uses x² / √.'
};
function SettingsScreen({
  onBack,
  settings,
  updateSetting,
  density = 'comfortable',
  onLegal
}) {
  const padX = density === 'compact' ? 18 : 22;
  const [helpFor, setHelpFor] = useSS(null); // settingKey → show help popup
  const [supportOpen, setSupportOpen] = useSS(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "fp-screen",
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 6px`,
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    "aria-label": "Back",
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "left",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }, "Settings"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: `0 ${padX}px calc(24px + env(safe-area-inset-bottom, 0px))`
    }
  }, /*#__PURE__*/React.createElement(STitle, null, "Settings"), /*#__PURE__*/React.createElement(SSection, null, "Appearance"), /*#__PURE__*/React.createElement(SGroup, null, /*#__PURE__*/React.createElement(SegRow, {
    label: "Theme",
    value: settings.theme,
    options: [{
      value: 'light',
      label: 'Light'
    }, {
      value: 'dark',
      label: 'Dark'
    }],
    onChange: v => updateSetting('theme', v)
  }), /*#__PURE__*/React.createElement(SegRow, {
    label: "Density",
    value: settings.density,
    options: [{
      value: 'compact',
      label: 'Compact'
    }, {
      value: 'comfortable',
      label: 'Comfort'
    }],
    onChange: v => updateSetting('density', v)
  })), /*#__PURE__*/React.createElement(SSection, null, "Sound"), /*#__PURE__*/React.createElement(SGroup, null, /*#__PURE__*/React.createElement(TogRow, {
    label: "Sound effects",
    helpKey: "sound",
    onHelp: setHelpFor,
    value: settings.sound,
    onChange: v => updateSetting('sound', v)
  }), /*#__PURE__*/React.createElement(SliderRow, {
    label: "Volume",
    helpKey: "volume",
    onHelp: setHelpFor,
    value: settings.volume,
    onChange: v => updateSetting('volume', v)
  })), /*#__PURE__*/React.createElement(SSection, null, "Gameplay"), /*#__PURE__*/React.createElement(SGroup, null, /*#__PURE__*/React.createElement(TogRow, {
    label: "Show grid labels",
    helpKey: "gridLabels",
    onHelp: setHelpFor,
    value: settings.gridLabels,
    onChange: v => updateSetting('gridLabels', v)
  }), /*#__PURE__*/React.createElement(TogRow, {
    label: "Auto-zoom on play",
    helpKey: "autoZoom",
    onHelp: setHelpFor,
    value: settings.autoZoom,
    onChange: v => updateSetting('autoZoom', v)
  }), /*#__PURE__*/React.createElement(SegRow, {
    label: "Notation",
    helpKey: "notation",
    onHelp: setHelpFor,
    value: settings.notation,
    options: [{
      value: 'standard',
      label: 'Standard'
    }, {
      value: 'pretty',
      label: 'Pretty'
    }],
    onChange: v => updateSetting('notation', v)
  })), /*#__PURE__*/React.createElement(SSection, null, "About"), /*#__PURE__*/React.createElement(SGroup, null, /*#__PURE__*/React.createElement(SNavRow, {
    label: "Privacy policy",
    onPress: () => onLegal && onLegal('privacy')
  }), /*#__PURE__*/React.createElement(SNavRow, {
    label: "Terms of service",
    onPress: () => onLegal && onLegal('terms')
  }), /*#__PURE__*/React.createElement(SNavRow, {
    label: "Open source licenses",
    onPress: () => onLegal && onLegal('licenses')
  }), /*#__PURE__*/React.createElement(SNavRow, {
    label: "Contact support",
    onPress: () => setSupportOpen(true)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      paddingTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--fp-ink-4)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }, "v 1.0 \xB7 build 1"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--fp-ink-4)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      marginTop: 4
    }
  }, "Developed by Quant"))), helpFor && /*#__PURE__*/React.createElement(HelpPopup, {
    settingKey: helpFor,
    onClose: () => setHelpFor(null)
  }), supportOpen && /*#__PURE__*/React.createElement(SupportPopup, {
    onClose: () => setSupportOpen(false)
  }));
}

// ─── Popups ────────────────────────────────────────────────────

function HelpPopup({
  settingKey,
  onClose
}) {
  const text = SETTING_HELP[settingKey] || 'No description available yet.';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 90,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backdropFilter: 'blur(2px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: 'var(--fp-bg)',
      border: '1px solid var(--fp-line)',
      borderRadius: 16,
      padding: '18px 18px 14px',
      maxWidth: 320,
      width: '100%',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink)',
      fontSize: 14,
      fontWeight: 600
    }
  }, "?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 18,
      color: 'var(--fp-ink)',
      letterSpacing: '-0.01em'
    }
  }, "About this setting")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fp-ink-2)',
      lineHeight: 1.55
    }
  }, text), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      marginTop: 14,
      width: '100%',
      height: 40,
      borderRadius: 11,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)',
      fontSize: 13,
      fontWeight: 500
    }
  }, "Got it")));
}
function SupportPopup({
  onClose
}) {
  const email = 'functionplane.support@gmail.com';
  const [copied, setCopied] = useSS(false);
  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(email).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 90,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      backdropFilter: 'blur(2px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: 'var(--fp-bg)',
      border: '1px solid var(--fp-line)',
      borderRadius: 16,
      padding: '18px',
      maxWidth: 340,
      width: '100%',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 22,
      color: 'var(--fp-ink)',
      letterSpacing: '-0.02em',
      marginBottom: 8
    }
  }, "Contact support"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fp-ink-3)',
      lineHeight: 1.55,
      marginBottom: 14
    }
  }, "Found a bug, have a feature request, or want to say hi? Email us:"), /*#__PURE__*/React.createElement("a", {
    href: `mailto:${email}`,
    style: {
      display: 'block',
      padding: '12px 14px',
      borderRadius: 10,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      fontFamily: "'Geist Mono', monospace",
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--fp-ink)',
      textAlign: 'center',
      textDecoration: 'none',
      marginBottom: 10
    }
  }, email), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: copy,
    style: {
      flex: 1,
      height: 42,
      borderRadius: 11,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      fontSize: 13,
      fontWeight: 500
    }
  }, copied ? 'Copied!' : 'Copy email'), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      flex: 1,
      height: 42,
      borderRadius: 11,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)',
      fontSize: 13,
      fontWeight: 500
    }
  }, "Close"))));
}
function HelpButton({
  k,
  onHelp
}) {
  if (!k || !onHelp) return null;
  return /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onHelp(k);
    },
    "aria-label": "Help",
    style: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      border: '1px solid var(--fp-line)',
      background: 'var(--fp-surface-2)',
      color: 'var(--fp-ink-3)',
      fontSize: 12,
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6,
      cursor: 'pointer',
      flex: '0 0 22px'
    }
  }, "?");
}

// ─── Sub-components ───────────────────────────────────────────

function STitle({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 36,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      padding: '6px 0 8px'
    }
  }, children);
}
function SSection({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      fontWeight: 500,
      padding: '20px 2px 10px'
    }
  }, children);
}
function SGroup({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--fp-line)',
      borderRadius: 14,
      background: 'var(--fp-surface)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }
  }, children);
}
function sRowBase() {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderTop: '1px solid var(--fp-line)',
    background: 'transparent'
  };
}
function TogRow({
  label,
  value,
  onChange,
  helpKey,
  onHelp
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: sRowBase()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 13.5,
      color: 'var(--fp-ink)',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement(HelpButton, {
    k: helpKey,
    onHelp: onHelp
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(!value),
    "aria-label": label,
    style: {
      width: 42,
      height: 24,
      borderRadius: 999,
      background: value ? 'var(--fp-ink)' : 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      position: 'relative',
      transition: 'background .15s',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: value ? 20 : 2,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: value ? 'var(--fp-bg)' : 'var(--fp-ink)',
      transition: 'left .15s'
    }
  })));
}
function SegRow({
  label,
  value,
  options,
  onChange,
  helpKey,
  onHelp
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: sRowBase()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 13.5,
      color: 'var(--fp-ink)',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement(HelpButton, {
    k: helpKey,
    onHelp: onHelp
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      padding: 2,
      borderRadius: 8,
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    onClick: () => onChange(o.value),
    style: {
      padding: '5px 10px',
      borderRadius: 6,
      background: value === o.value ? 'var(--fp-bg)' : 'transparent',
      color: value === o.value ? 'var(--fp-ink)' : 'var(--fp-ink-3)',
      fontSize: 11.5,
      fontWeight: 500,
      cursor: 'pointer'
    }
  }, o.label))));
}
function SliderRow({
  label,
  value,
  onChange,
  helpKey,
  onHelp
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: sRowBase()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'var(--fp-ink)',
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement(HelpButton, {
    k: helpKey,
    onHelp: onHelp
  })), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    value: value,
    onChange: e => onChange(Number(e.target.value)),
    style: {
      flex: 1,
      accentColor: 'var(--fp-ink)',
      marginLeft: 8
    }
  }));
}
function SNavRow({
  label,
  onPress
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onPress,
    style: {
      ...sRowBase(),
      cursor: 'pointer',
      textAlign: 'left',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 13.5,
      color: 'var(--fp-ink)'
    }
  }, label), /*#__PURE__*/React.createElement(Icon.Chevron, {
    size: 14,
    c: "var(--fp-ink-4)"
  }));
}
window.SettingsScreen = SettingsScreen;