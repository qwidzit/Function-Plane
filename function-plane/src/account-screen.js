// Function Plane — Account screen (Supabase-backed auth)

const {
  useState: useACS,
  useEffect: useACSEffect
} = React;
function AccountScreen({
  onBack,
  density = 'comfortable',
  account,
  progress,
  onAdmin
}) {
  const [view, setView] = useACS('main'); // 'main' | 'signin' | 'register' | 'reset' | 'premium'
  const padX = density === 'compact' ? 22 : 26;
  useACSEffect(() => {/* clear sub-view errors on navigation */}, [view]);
  const goMain = () => setView('main');
  if (view === 'signin') return /*#__PURE__*/React.createElement(SignInView, {
    onBack: goMain,
    padX: padX,
    onSuccess: goMain,
    onReset: () => setView('reset')
  });
  if (view === 'register') return /*#__PURE__*/React.createElement(RegisterView, {
    onBack: goMain,
    padX: padX,
    onSuccess: goMain
  });
  if (view === 'reset') return /*#__PURE__*/React.createElement(ResetView, {
    onBack: goMain,
    padX: padX
  });
  if (view === 'premium') return /*#__PURE__*/React.createElement(PremiumView, {
    onBack: goMain,
    padX: padX,
    account: account,
    onSignIn: () => setView('signin'),
    onRegister: () => setView('register')
  });
  return account ? /*#__PURE__*/React.createElement(SignedInView, {
    account: account,
    progress: progress,
    onBack: onBack,
    padX: padX,
    onPremium: () => setView('premium'),
    onAdmin: onAdmin
  }) : /*#__PURE__*/React.createElement(GuestView, {
    onBack: onBack,
    padX: padX,
    onSignIn: () => setView('signin'),
    onRegister: () => setView('register'),
    onPremium: () => setView('premium')
  });
}

// ─── Reusable pieces ───────────────────────────────────────────────────────

function ScreenFrame({
  title,
  onBack,
  padX,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fp-screen",
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 14px`,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flex: '0 0 auto',
      borderBottom: title ? '1px solid var(--fp-line)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "left",
    size: 18
  })), title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 24,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)'
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: `0 ${padX}px`,
      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))'
    }
  }, children));
}
function AuthField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoFocus
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      marginBottom: 6,
      letterSpacing: '0.03em',
      textTransform: 'uppercase'
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    autoFocus: autoFocus,
    style: {
      width: '100%',
      height: 48,
      borderRadius: 12,
      boxSizing: 'border-box',
      padding: '0 14px',
      fontSize: 15,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      outline: 'none'
    }
  }));
}
function StatusLine({
  msg,
  ok
}) {
  if (!msg) return null;
  const color = ok ? 'var(--fp-accent)' : '#e34';
  const bg = ok ? 'color-mix(in srgb, var(--fp-accent) 12%, transparent)' : 'color-mix(in srgb, #e34 12%, transparent)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      borderRadius: 10,
      marginBottom: 12,
      background: bg,
      color,
      fontSize: 12.5,
      lineHeight: 1.5
    }
  }, msg);
}
function PremiumCard({
  onPremium,
  isPremium
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 18,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      overflow: 'hidden',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px 0',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 12,
      flex: '0 0 42px',
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
    fill: "var(--fp-ink)",
    stroke: "var(--fp-ink)",
    strokeWidth: 1,
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--fp-ink)',
      marginBottom: 3,
      letterSpacing: '-0.01em'
    }
  }, "Function Plane Premium"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--fp-ink-3)',
      lineHeight: 1.5
    }
  }, isPremium ? 'Active — every pack is unlocked. Thank you for the support!' : 'Unlock all packs and support development.'))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 18px 16px',
      paddingLeft: 74
    }
  }, isPremium ? /*#__PURE__*/React.createElement("div", {
    style: {
      height: 46,
      borderRadius: 12,
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      fontSize: 14,
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 13L9 17L19 7",
    stroke: "var(--fp-accent)",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), "Premium active") : /*#__PURE__*/React.createElement("button", {
    onClick: onPremium,
    style: {
      width: '100%',
      height: 46,
      borderRadius: 12,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 14,
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, "View Premium", /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "right",
    size: 13,
    c: "currentColor"
  }))));
}

// ─── Guest view ────────────────────────────────────────────────────────────

function GuestView({
  onBack,
  padX,
  onSignIn,
  onRegister,
  onPremium
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fp-screen",
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 0`,
      display: 'flex',
      alignItems: 'center',
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "left",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: `0 ${padX}px`,
      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 32,
      paddingBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 80,
      borderRadius: '50%',
      background: 'var(--fp-surface-2)',
      border: '2px solid var(--fp-line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Icon.User, {
    size: 34,
    c: "var(--fp-ink-4)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 28,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)',
      marginBottom: 8
    }
  }, "Guest"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'var(--fp-ink-3)',
      textAlign: 'center',
      lineHeight: 1.55,
      maxWidth: 280,
      marginBottom: 28
    }
  }, "Create an account to sync progress across devices and compete on the global leaderboard."), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onRegister,
    style: {
      height: 52,
      borderRadius: 15,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 15,
      fontWeight: 500
    }
  }, "Create account"), /*#__PURE__*/React.createElement("button", {
    onClick: onSignIn,
    style: {
      height: 52,
      borderRadius: 15,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      fontSize: 15,
      fontWeight: 500
    }
  }, "Sign in"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--fp-line)',
      marginBottom: 20
    }
  }), /*#__PURE__*/React.createElement(PremiumCard, {
    onPremium: onPremium
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: 'var(--fp-ink-4)',
      padding: '8px 12px',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))'
    }
  }, "Progress is saved locally on this device."));
}

// ─── Signed-in view ────────────────────────────────────────────────────────

function SignedInView({
  account,
  progress,
  onBack,
  padX,
  onPremium,
  onAdmin
}) {
  const stars = FP_AUTH.totalStarsFromProgress(progress);
  const isAdmin = FP_AUTH.isAdmin && FP_AUTH.isAdmin();
  const [signOutOpen, setSignOutOpen] = useACS(false);
  const [deleteOpen, setDeleteOpen] = useACS(false);
  const [busy, setBusy] = useACS(false);
  const doSignOut = async () => {
    setBusy(true);
    try {
      await FP_AUTH.signOut();
    } finally {
      setBusy(false);
      setSignOutOpen(false);
    }
  };
  const doDelete = async () => {
    setBusy(true);
    try {
      await FP_AUTH.deleteAccount();
    } catch (e) {
      window.fpToast?.(e.message, {
        kind: 'error'
      });
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  };
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
  }, signOutOpen && /*#__PURE__*/React.createElement(ConfirmPopup, {
    title: "Sign out?",
    body: "Your progress is saved on the server, so you can sign back in any time on this or another device.",
    confirmLabel: "Sign out",
    danger: false,
    busy: busy,
    onCancel: () => setSignOutOpen(false),
    onConfirm: doSignOut
  }), deleteOpen && /*#__PURE__*/React.createElement(ConfirmPopup, {
    title: "Delete account permanently?",
    body: "This removes your profile, all gameplay progress, and your leaderboard entries. This cannot be undone.",
    confirmLabel: "Delete account",
    danger: true,
    busy: busy,
    onCancel: () => setDeleteOpen(false),
    onConfirm: doDelete
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 0`,
      display: 'flex',
      alignItems: 'center',
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "left",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: `0 ${padX}px`,
      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 24,
      paddingBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 84,
      height: 84,
      borderRadius: '50%',
      background: 'var(--fp-surface-2)',
      border: '2px solid var(--fp-line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      fontSize: 40
    }
  }, account.avatar), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 28,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)',
      marginBottom: 4
    }
  }, account.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--fp-ink-3)',
      marginBottom: 16
    }
  }, account.email), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 22,
      fontWeight: 600,
      color: 'var(--fp-ink)'
    }
  }, stars), /*#__PURE__*/React.createElement(Icon.Star, {
    size: 14,
    c: "var(--lv-star)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      marginLeft: 2
    }
  }, "total stars"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      borderRadius: 14,
      padding: '12px 16px',
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--fp-accent)',
      flex: '0 0 8px'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--fp-ink)'
    }
  }, "Progress synced"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      lineHeight: 1.5
    }
  }, "Sign in on any device with this account to continue where you left off."))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      borderRadius: 14,
      padding: '12px 16px',
      marginBottom: 22,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      flex: '0 0 36px',
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon.Trophy, {
    size: 16,
    c: "var(--fp-ink-3)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--fp-ink-2)',
      lineHeight: 1.5
    }
  }, "Your scores appear on the global leaderboard as ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--fp-ink)'
    }
  }, account.name), ".")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--fp-line)',
      marginBottom: 18
    }
  }), isAdmin && /*#__PURE__*/React.createElement("button", {
    onClick: onAdmin,
    style: {
      width: '100%',
      height: 52,
      borderRadius: 14,
      marginBottom: 14,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)',
      fontSize: 14,
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, "\u2699\uFE0F"), "Admin panel"), /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "right",
    size: 14,
    c: "currentColor"
  })), /*#__PURE__*/React.createElement(PremiumCard, {
    onPremium: onPremium,
    isPremium: !!account.isPremium
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSignOutOpen(true),
    style: {
      width: '100%',
      height: 48,
      borderRadius: 14,
      background: 'transparent',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink-2)',
      fontSize: 13.5,
      fontWeight: 500,
      marginBottom: 10
    }
  }, "Sign out"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDeleteOpen(true),
    style: {
      width: '100%',
      height: 42,
      borderRadius: 12,
      background: 'transparent',
      border: '1px solid color-mix(in srgb, #e34 35%, var(--fp-line))',
      color: '#e34',
      fontSize: 12.5,
      fontWeight: 500
    }
  }, "Delete account")));
}

// ─── Sign in ───────────────────────────────────────────────────────────────

function SignInView({
  onBack,
  padX,
  onSuccess,
  onReset
}) {
  const [email, setEmail] = useACS('');
  const [pass, setPass] = useACS('');
  const [msg, setMsg] = useACS({
    text: '',
    ok: false
  });
  const [busy, setBusy] = useACS(false);
  const submit = async () => {
    setMsg({
      text: '',
      ok: false
    });
    setBusy(true);
    try {
      await FP_AUTH.signIn({
        email,
        password: pass
      });
      onSuccess();
    } catch (e) {
      setMsg({
        text: e.message,
        ok: false
      });
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(ScreenFrame, {
    title: "Sign in",
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 0'
    }
  }, /*#__PURE__*/React.createElement(StatusLine, {
    msg: msg.text,
    ok: msg.ok
  }), /*#__PURE__*/React.createElement(AuthField, {
    label: "Email",
    type: "email",
    value: email,
    onChange: setEmail,
    placeholder: "you@example.com",
    autoFocus: true
  }), /*#__PURE__*/React.createElement(AuthField, {
    label: "Password",
    type: "password",
    value: pass,
    onChange: setPass,
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: busy,
    style: {
      width: '100%',
      height: 52,
      borderRadius: 15,
      marginTop: 4,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 15,
      fontWeight: 500,
      opacity: busy ? 0.6 : 1
    }
  }, busy ? 'Signing in…' : 'Sign in'), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onReset,
    style: {
      fontSize: 12.5,
      color: 'var(--fp-ink-3)'
    }
  }, "Forgot password?"))));
}

// ─── Register ──────────────────────────────────────────────────────────────

function RegisterView({
  onBack,
  padX,
  onSuccess
}) {
  const [name, setName] = useACS('');
  const [email, setEmail] = useACS('');
  const [pass, setPass] = useACS('');
  const [msg, setMsg] = useACS({
    text: '',
    ok: false
  });
  const [busy, setBusy] = useACS(false);

  // Name availability state: 'idle' | 'checking' | 'free' | 'taken' | 'invalid'
  const [nameStatus, setNameStatus] = useACS({
    state: 'idle',
    reason: ''
  });

  // Debounced availability check
  useACSEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameStatus({
        state: 'idle',
        reason: ''
      });
      return;
    }
    setNameStatus({
      state: 'checking',
      reason: ''
    });
    const id = setTimeout(async () => {
      try {
        const r = await FP_AUTH.checkNameAvailable(trimmed);
        setNameStatus(r.available ? {
          state: 'free',
          reason: ''
        } : {
          state: trimmed.length < 2 ? 'invalid' : 'taken',
          reason: r.reason || 'Taken'
        });
      } catch {
        setNameStatus({
          state: 'idle',
          reason: ''
        });
      }
    }, 350);
    return () => clearTimeout(id);
  }, [name]);
  const canSubmit = !busy && nameStatus.state === 'free' && email.includes('@') && pass.length >= 6;
  const submit = async () => {
    if (!canSubmit) return;
    setMsg({
      text: '',
      ok: false
    });
    setBusy(true);
    try {
      await FP_AUTH.register({
        name,
        email,
        password: pass
      });
      onSuccess();
    } catch (e) {
      setMsg({
        text: e.message,
        ok: false
      });
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(ScreenFrame, {
    title: "Create account",
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 0'
    }
  }, /*#__PURE__*/React.createElement(StatusLine, {
    msg: msg.text,
    ok: msg.ok
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      marginBottom: 6,
      letterSpacing: '0.03em',
      textTransform: 'uppercase'
    }
  }, "Display name"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "Your name",
    autoFocus: true,
    style: {
      width: '100%',
      height: 48,
      borderRadius: 12,
      boxSizing: 'border-box',
      padding: '0 14px',
      fontSize: 15,
      background: 'var(--fp-surface)',
      border: `1px solid ${nameStatus.state === 'taken' || nameStatus.state === 'invalid' ? '#e34' : nameStatus.state === 'free' ? 'var(--fp-accent)' : 'var(--fp-line)'}`,
      color: 'var(--fp-ink)',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: 16,
      marginTop: 6,
      fontSize: 11.5,
      color: nameStatus.state === 'free' ? 'var(--fp-accent)' : nameStatus.state === 'taken' || nameStatus.state === 'invalid' ? '#e34' : 'var(--fp-ink-3)'
    }
  }, nameStatus.state === 'checking' && 'Checking availability…', nameStatus.state === 'free' && '✓ Name is available', nameStatus.state === 'taken' && (nameStatus.reason || 'That name is taken'), nameStatus.state === 'invalid' && (nameStatus.reason || 'Invalid name'))), /*#__PURE__*/React.createElement(AuthField, {
    label: "Email",
    type: "email",
    value: email,
    onChange: setEmail,
    placeholder: "you@example.com"
  }), /*#__PURE__*/React.createElement(AuthField, {
    label: "Password",
    type: "password",
    value: pass,
    onChange: setPass,
    placeholder: "At least 6 characters"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: !canSubmit,
    style: {
      width: '100%',
      height: 52,
      borderRadius: 15,
      marginTop: 4,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 15,
      fontWeight: 500,
      opacity: canSubmit ? 1 : 0.5
    }
  }, busy ? 'Creating…' : 'Create account'), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 16,
      fontSize: 11.5,
      color: 'var(--fp-ink-4)',
      lineHeight: 1.55
    }
  }, "Your progress will sync across all your devices.")));
}

// ─── Reset password ────────────────────────────────────────────────────────

function ResetView({
  onBack,
  padX
}) {
  const [email, setEmail] = useACS('');
  const [msg, setMsg] = useACS({
    text: '',
    ok: false
  });
  const [busy, setBusy] = useACS(false);
  const submit = async () => {
    setMsg({
      text: '',
      ok: false
    });
    setBusy(true);
    try {
      await FP_AUTH.resetPassword(email);
      setMsg({
        text: 'Password reset link sent — check your inbox.',
        ok: true
      });
    } catch (e) {
      setMsg({
        text: e.message,
        ok: false
      });
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(ScreenFrame, {
    title: "Reset password",
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 0'
    }
  }, /*#__PURE__*/React.createElement(StatusLine, {
    msg: msg.text,
    ok: msg.ok
  }), /*#__PURE__*/React.createElement(AuthField, {
    label: "Email",
    type: "email",
    value: email,
    onChange: setEmail,
    placeholder: "you@example.com",
    autoFocus: true
  }), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: busy,
    style: {
      width: '100%',
      height: 52,
      borderRadius: 15,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 15,
      fontWeight: 500,
      opacity: busy ? 0.6 : 1
    }
  }, busy ? 'Sending…' : 'Send reset link')));
}

// ─── Premium ───────────────────────────────────────────────────────────────

function PremiumView({
  onBack,
  padX,
  account,
  onSignIn,
  onRegister
}) {
  const env = window.FP_ENV || {
    channel: 'web',
    paymentProvider: 'stripe',
    isNative: false
  };
  const isPremium = !!(account && account.isPremium);
  const [busy, setBusy] = useACS(false);
  const [msg, setMsg] = useACS({
    text: '',
    ok: false
  });
  const [price, setPrice] = useACS('');

  // Real localized price (RevenueCat on native, config label on web).
  useACSEffect(() => {
    let live = true;
    window.FP_BILLING?.priceLabel?.().then(p => {
      if (live) setPrice(p || '');
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const applyResult = r => {
    if (!r) return;
    if (r.premium) setMsg({
      text: 'Premium unlocked — every pack is open. Thank you!',
      ok: true
    });else if (r.pending) setMsg({
      text: 'Payment received. Your unlock will appear in a moment — tap Restore purchases if it doesn\'t.',
      ok: true
    });else if (r.redirected) setMsg({
      text: 'Finish checkout in the tab that just opened, then come back and tap Restore purchases.',
      ok: true
    });else if (r.cancelled) {/* user backed out — say nothing */} else if (r.unavailable) setMsg({
      text: r.message || 'Purchases aren\'t available yet.',
      ok: false
    });
  };
  const doBuy = async () => {
    setBusy(true);
    setMsg({
      text: '',
      ok: false
    });
    try {
      applyResult(await FP_BILLING.buy());
    } catch (e) {
      setMsg({
        text: e.message || 'Purchase failed',
        ok: false
      });
    } finally {
      setBusy(false);
    }
  };
  const doRestore = async () => {
    setBusy(true);
    setMsg({
      text: '',
      ok: false
    });
    try {
      const r = await FP_BILLING.restore();
      setMsg(r?.premium ? {
        text: 'Premium restored. Enjoy!',
        ok: true
      } : {
        text: r?.message || 'No previous purchase found on this account.',
        ok: false
      });
    } catch (e) {
      setMsg({
        text: e.message || 'Restore failed',
        ok: false
      });
    } finally {
      setBusy(false);
    }
  };

  // Store-appropriate billing note. Never mention external payment inside a
  // native store build (anti-steering).
  const billingNote = env.channel === 'play' ? 'Billed once through Google Play. No subscription.' : env.channel === 'appstore' ? 'Billed once through the App Store. No subscription.' : 'Secure one-time checkout by Stripe. No subscription.';
  return /*#__PURE__*/React.createElement(ScreenFrame, {
    title: "Premium",
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 20,
      margin: '0 auto 14px',
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
    fill: "var(--fp-ink)",
    stroke: "var(--fp-ink)",
    strokeWidth: 1,
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 28,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)',
      marginBottom: 6
    }
  }, isPremium ? "You're Premium" : 'Unlock everything'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'var(--fp-ink-3)',
      lineHeight: 1.55
    }
  }, isPremium ? 'Every pack is open on this account.' : 'All packs, one payment, forever.')), /*#__PURE__*/React.createElement(StatusLine, {
    msg: msg.text,
    ok: msg.ok
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      borderRadius: 16,
      padding: '14px 18px',
      marginBottom: 22
    }
  }, ['All themed packs unlocked immediately', 'All future chapter packs included', 'No advertisements ever', 'Support indie development'].map((f, i, arr) => /*#__PURE__*/React.createElement("div", {
    key: f,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '9px 0',
      borderBottom: i < arr.length - 1 ? '1px solid var(--fp-line)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 13L9 17L19 7",
    stroke: "var(--fp-accent)",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: 'var(--fp-ink)'
    }
  }, f)))), isPremium ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: 16,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      fontSize: 15,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 13L9 17L19 7",
    stroke: "var(--fp-accent)",
    strokeWidth: 2.4,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), "Premium active"), /*#__PURE__*/React.createElement("button", {
    onClick: doRestore,
    disabled: busy,
    style: {
      width: '100%',
      height: 44,
      marginTop: 12,
      borderRadius: 12,
      background: 'transparent',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink-2)',
      fontSize: 13,
      fontWeight: 500,
      opacity: busy ? 0.6 : 1
    }
  }, busy ? '…' : 'Restore purchases')) : !account ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--fp-ink-3)',
      lineHeight: 1.55,
      textAlign: 'center',
      marginBottom: 16
    }
  }, "Premium is tied to your account, so it unlocks on every device you sign in on. Create an account or sign in to continue."), /*#__PURE__*/React.createElement("button", {
    onClick: onRegister,
    style: {
      width: '100%',
      height: 52,
      borderRadius: 15,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 15,
      fontWeight: 500,
      marginBottom: 10
    }
  }, "Create account"), /*#__PURE__*/React.createElement("button", {
    onClick: onSignIn,
    style: {
      width: '100%',
      height: 52,
      borderRadius: 15,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      fontSize: 15,
      fontWeight: 500
    }
  }, "Sign in")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px',
      borderRadius: 14,
      background: 'var(--fp-surface)',
      border: '1.5px solid var(--fp-ink)',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--fp-ink)'
    }
  }, "Lifetime unlock"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      marginTop: 2
    }
  }, "One-time purchase")), price && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Geist Mono', monospace",
      fontSize: 17,
      fontWeight: 600,
      color: 'var(--fp-ink)'
    }
  }, price)), /*#__PURE__*/React.createElement("button", {
    onClick: doBuy,
    disabled: busy,
    style: {
      width: '100%',
      height: 54,
      borderRadius: 16,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 16,
      fontWeight: 600,
      opacity: busy ? 0.6 : 1
    }
  }, busy ? 'Working…' : price ? `Unlock Premium · ${price}` : 'Unlock Premium'), /*#__PURE__*/React.createElement("button", {
    onClick: doRestore,
    disabled: busy,
    style: {
      width: '100%',
      height: 44,
      marginTop: 10,
      borderRadius: 12,
      background: 'transparent',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink-2)',
      fontSize: 13,
      fontWeight: 500,
      opacity: busy ? 0.6 : 1
    }
  }, "Restore purchases"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 14,
      fontSize: 11,
      color: 'var(--fp-ink-4)',
      lineHeight: 1.6
    }
  }, billingNote))));
}

// ─── Confirm popup ──────────────────────────────────────────────────────────

function ConfirmPopup({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onCancel,
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
      padding: '20px',
      maxWidth: 340,
      width: '100%',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 24,
      color: 'var(--fp-ink)',
      letterSpacing: '-0.02em',
      marginBottom: 8
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fp-ink-3)',
      lineHeight: 1.55,
      marginBottom: 18
    }
  }, body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    disabled: busy,
    style: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      background: 'transparent',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      fontSize: 13.5,
      fontWeight: 500,
      opacity: busy ? 0.6 : 1
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: onConfirm,
    disabled: busy,
    style: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      background: danger ? '#e34' : 'var(--fp-ink)',
      color: danger ? '#fff' : 'var(--fp-bg)',
      fontSize: 13.5,
      fontWeight: 500,
      opacity: busy ? 0.6 : 1
    }
  }, busy ? '…' : confirmLabel))));
}
window.AccountScreen = AccountScreen;