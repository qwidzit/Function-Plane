// Function Plane — Settings screen

const { useState: useSS } = React;

// Short explanations shown in the ⓘ popup next to gameplay & sound settings.
const SETTING_HELP = {
  sound:        'Plays short tones when the ball bounces, you collect a star, and on level success or failure.',
  volume:       'Master volume for sound effects.',
  gridLabels:   'Show numeric labels along the X and Y axes of the level plane.',
  autoZoom:     'When you press Play, automatically zoom and pan so the ball, target stars, and your function fit on screen.',
  notation:     'Display style for equations on the level plane. Standard uses x^2 / sqrt(); Pretty uses x² / √.',
};

function SettingsScreen({ onBack, settings, updateSetting, density = 'comfortable', onLegal }) {
  const padX = density === 'compact' ? 18 : 22;
  const [helpFor,  setHelpFor]  = useSS(null);   // settingKey → show help popup
  const [supportOpen, setSupportOpen] = useSS(false);

  return (
    <div className="fp-screen" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', position: 'relative',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 6px`,
        flex: '0 0 auto',
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          width: 38, height: 38, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fp-ink-2)',
        }}>
          <Icon.Chevron dir="left" size={20} />
        </button>
        <div style={{ fontSize: 11.5, color: 'var(--fp-ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Settings
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div className="fp-scroll" style={{
        flex: 1, overflowY: 'auto',
        padding: `0 ${padX}px calc(24px + env(safe-area-inset-bottom, 0px))`,
      }}>
        <STitle>Settings</STitle>

        <SSection>Appearance</SSection>
        <SGroup>
          <SegRow label="Theme"
            value={settings.theme}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            onChange={v => updateSetting('theme', v)} />
          <SegRow label="Density"
            value={settings.density}
            options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfort' }]}
            onChange={v => updateSetting('density', v)} />
        </SGroup>

        <SSection>Sound</SSection>
        <SGroup>
          <TogRow label="Sound effects" helpKey="sound"   onHelp={setHelpFor} value={settings.sound}   onChange={v => updateSetting('sound', v)} />
          <SliderRow label="Volume"     helpKey="volume"  onHelp={setHelpFor} value={settings.volume}  onChange={v => updateSetting('volume', v)} />
        </SGroup>

        <SSection>Gameplay</SSection>
        <SGroup>
          <TogRow label="Show grid labels"  helpKey="gridLabels"   onHelp={setHelpFor} value={settings.gridLabels}    onChange={v => updateSetting('gridLabels', v)} />
          <TogRow label="Auto-zoom on play" helpKey="autoZoom"     onHelp={setHelpFor} value={settings.autoZoom}      onChange={v => updateSetting('autoZoom', v)} />
          <SegRow label="Notation" helpKey="notation" onHelp={setHelpFor}
            value={settings.notation}
            options={[{ value: 'standard', label: 'Standard' }, { value: 'pretty', label: 'Pretty' }]}
            onChange={v => updateSetting('notation', v)} />
        </SGroup>

        <SSection>About</SSection>
        <SGroup>
          <SNavRow label="Privacy policy"        onPress={() => onLegal && onLegal('privacy')} />
          <SNavRow label="Terms of service"      onPress={() => onLegal && onLegal('terms')} />
          <SNavRow label="Open source licenses"  onPress={() => onLegal && onLegal('licenses')} />
          <SNavRow label="Contact support"       onPress={() => setSupportOpen(true)} />
        </SGroup>

        <div style={{
          textAlign: 'center', paddingTop: 18,
        }}>
          <div style={{
            fontSize: 10.5, color: 'var(--fp-ink-4)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>v 1.0 · build 1</div>
          <div style={{
            fontSize: 10.5, color: 'var(--fp-ink-4)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            marginTop: 4,
          }}>Developed by Quant</div>
        </div>
      </div>

      {helpFor && <HelpPopup settingKey={helpFor} onClose={() => setHelpFor(null)}/>}
      {supportOpen && <SupportPopup onClose={() => setSupportOpen(false)}/>}
    </div>
  );
}

// ─── Popups ────────────────────────────────────────────────────

function HelpPopup({ settingKey, onClose }) {
  const text = SETTING_HELP[settingKey] || 'No description available yet.';
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--fp-bg)', border: '1px solid var(--fp-line)',
        borderRadius: 16, padding: '18px 18px 14px',
        maxWidth: 320, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'var(--fp-surface-2)', border: '1px solid var(--fp-line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fp-ink)', fontSize: 14, fontWeight: 600,
          }}>?</div>
          <div style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic', fontSize: 18, color: 'var(--fp-ink)', letterSpacing: '-0.01em',
          }}>About this setting</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--fp-ink-2)', lineHeight: 1.55 }}>{text}</div>
        <button onClick={onClose} style={{
          marginTop: 14, width: '100%', height: 40, borderRadius: 11,
          background: 'var(--fp-ink)', color: 'var(--fp-bg)',
          fontSize: 13, fontWeight: 500,
        }}>Got it</button>
      </div>
    </div>
  );
}

function SupportPopup({ onClose }) {
  const email = 'functionplane.support@gmail.com';
  const [copied, setCopied] = useSS(false);
  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(email).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--fp-bg)', border: '1px solid var(--fp-line)',
        borderRadius: 16, padding: '18px',
        maxWidth: 340, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic', fontSize: 22, color: 'var(--fp-ink)',
          letterSpacing: '-0.02em', marginBottom: 8,
        }}>Contact support</div>
        <div style={{ fontSize: 13, color: 'var(--fp-ink-3)', lineHeight: 1.55, marginBottom: 14 }}>
          Found a bug, have a feature request, or want to say hi? Email us:
        </div>
        <a href={`mailto:${email}`} style={{
          display: 'block', padding: '12px 14px', borderRadius: 10,
          background: 'var(--fp-surface)', border: '1px solid var(--fp-line)',
          fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 500,
          color: 'var(--fp-ink)', textAlign: 'center', textDecoration: 'none',
          marginBottom: 10,
        }}>{email}</a>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copy} style={{
            flex: 1, height: 42, borderRadius: 11,
            background: 'var(--fp-surface)', border: '1px solid var(--fp-line)',
            color: 'var(--fp-ink)', fontSize: 13, fontWeight: 500,
          }}>{copied ? 'Copied!' : 'Copy email'}</button>
          <button onClick={onClose} style={{
            flex: 1, height: 42, borderRadius: 11,
            background: 'var(--fp-ink)', color: 'var(--fp-bg)',
            fontSize: 13, fontWeight: 500,
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function HelpButton({ k, onHelp }) {
  if (!k || !onHelp) return null;
  return (
    <button onClick={(e) => { e.stopPropagation(); onHelp(k); }} aria-label="Help"
      style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '1px solid var(--fp-line)', background: 'var(--fp-surface-2)',
        color: 'var(--fp-ink-3)', fontSize: 12, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginLeft: 6, cursor: 'pointer', flex: '0 0 22px',
      }}>?</button>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function STitle({ children }) {
  return (
    <div style={{
      fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic',
      fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em',
      padding: '6px 0 8px',
    }}>{children}</div>
  );
}

function SSection({ children }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--fp-ink-3)', fontWeight: 500,
      padding: '20px 2px 10px',
    }}>{children}</div>
  );
}

function SGroup({ children }) {
  return (
    <div style={{
      border: '1px solid var(--fp-line)', borderRadius: 14,
      background: 'var(--fp-surface)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>{children}</div>
  );
}

function sRowBase() {
  return {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px',
    borderTop: '1px solid var(--fp-line)',
    background: 'transparent',
  };
}

function TogRow({ label, value, onChange, helpKey, onHelp }) {
  return (
    <div style={sRowBase()}>
      <div style={{ flex: 1, fontSize: 13.5, color: 'var(--fp-ink)', display: 'flex', alignItems: 'center' }}>
        <span>{label}</span>
        <HelpButton k={helpKey} onHelp={onHelp}/>
      </div>
      <button onClick={() => onChange(!value)} aria-label={label} style={{
        width: 42, height: 24, borderRadius: 999,
        background: value ? 'var(--fp-ink)' : 'var(--fp-surface-2)',
        border: '1px solid var(--fp-line)',
        position: 'relative', transition: 'background .15s', cursor: 'pointer',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: value ? 20 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: value ? 'var(--fp-bg)' : 'var(--fp-ink)',
          transition: 'left .15s',
        }}/>
      </button>
    </div>
  );
}

function SegRow({ label, value, options, onChange, helpKey, onHelp }) {
  return (
    <div style={sRowBase()}>
      <div style={{ flex: 1, fontSize: 13.5, color: 'var(--fp-ink)', display: 'flex', alignItems: 'center' }}>
        <span>{label}</span>
        <HelpButton k={helpKey} onHelp={onHelp}/>
      </div>
      <div style={{
        display: 'flex', padding: 2, borderRadius: 8,
        background: 'var(--fp-surface-2)', border: '1px solid var(--fp-line)',
      }}>
        {options.map(o => (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            padding: '5px 10px', borderRadius: 6,
            background: value === o.value ? 'var(--fp-bg)' : 'transparent',
            color: value === o.value ? 'var(--fp-ink)' : 'var(--fp-ink-3)',
            fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange, helpKey, onHelp }) {
  return (
    <div style={sRowBase()}>
      <div style={{ fontSize: 13.5, color: 'var(--fp-ink)', flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
        <span>{label}</span>
        <HelpButton k={helpKey} onHelp={onHelp}/>
      </div>
      <input type="range" min="0" max="100" value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--fp-ink)', marginLeft: 8 }}/>
    </div>
  );
}

function SNavRow({ label, onPress }) {
  return (
    <button onClick={onPress} style={{ ...sRowBase(), cursor: 'pointer', textAlign: 'left', width: '100%' }}>
      <div style={{ flex: 1, fontSize: 13.5, color: 'var(--fp-ink)' }}>{label}</div>
      <Icon.Chevron size={14} c="var(--fp-ink-4)"/>
    </button>
  );
}

window.SettingsScreen = SettingsScreen;
