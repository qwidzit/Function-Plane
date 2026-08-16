// Function Plane — Account screen (Supabase-backed auth)

const { useState: useACS, useEffect: useACSEffect } = React;

function AccountScreen({ onBack, density = 'comfortable', account, progress, onAdmin }) {
  const [view, setView] = useACS('main'); // 'main' | 'signin' | 'register' | 'reset' | 'premium'
  const padX = density === 'compact' ? 22 : 26;

  useACSEffect(() => { /* clear sub-view errors on navigation */ }, [view]);

  const goMain = () => setView('main');

  if (view === 'signin')   return <SignInView   onBack={goMain} padX={padX} onSuccess={goMain} onReset={() => setView('reset')}/>;
  if (view === 'register') return <RegisterView onBack={goMain} padX={padX} onSuccess={goMain}/>;
  if (view === 'reset')    return <ResetView    onBack={goMain} padX={padX}/>;
  if (view === 'premium')  return <PremiumView  onBack={goMain} padX={padX}/>;

  return account
    ? <SignedInView account={account} progress={progress} onBack={onBack} padX={padX}
        onPremium={() => setView('premium')} onAdmin={onAdmin}/>
    : <GuestView onBack={onBack} padX={padX}
        onSignIn={() => setView('signin')} onRegister={() => setView('register')}
        onPremium={() => setView('premium')}/>;
}

// ─── Reusable pieces ───────────────────────────────────────────────────────

function ScreenFrame({ title, onBack, padX, children }) {
  return (
    <div className="fp-screen" style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', boxSizing:'border-box' }}>
      <div style={{
        padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 14px`,
        display:'flex', alignItems:'center', gap:12, flex:'0 0 auto',
        borderBottom: title ? '1px solid var(--fp-line)' : 'none',
      }}>
        <button onClick={onBack} style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fp-ink-2)' }}>
          <Icon.Chevron dir="left" size={18}/>
        </button>
        {title && (
          <div style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:'italic', fontSize:24, letterSpacing:'-0.02em', color:'var(--fp-ink)' }}>
            {title}
          </div>
        )}
      </div>
      <div className="fp-scroll" style={{ flex:1, overflowY:'auto', padding:`0 ${padX}px`, paddingBottom:'max(24px, env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </div>
    </div>
  );
}

function AuthField({ label, type, value, onChange, placeholder, autoFocus }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11.5, color:'var(--fp-ink-3)', marginBottom:6, letterSpacing:'0.03em', textTransform:'uppercase' }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        style={{ width:'100%', height:48, borderRadius:12, boxSizing:'border-box', padding:'0 14px', fontSize:15, background:'var(--fp-surface)', border:'1px solid var(--fp-line)', color:'var(--fp-ink)', outline:'none' }}/>
    </div>
  );
}

function StatusLine({ msg, ok }) {
  if (!msg) return null;
  const color = ok ? 'var(--fp-accent)' : '#e34';
  const bg    = ok ? 'color-mix(in srgb, var(--fp-accent) 12%, transparent)' : 'color-mix(in srgb, #e34 12%, transparent)';
  return <div style={{ padding:'10px 12px', borderRadius:10, marginBottom:12, background:bg, color, fontSize:12.5, lineHeight:1.5 }}>{msg}</div>;
}

function PremiumCard({ onPremium }) {
  return (
    <div style={{ borderRadius:18, background:'var(--fp-surface)', border:'1px solid var(--fp-line)', overflow:'hidden', marginBottom:24 }}>
      <div style={{ padding:'16px 18px 0', display:'flex', alignItems:'flex-start', gap:14 }}>
        <div style={{ width:42, height:42, borderRadius:12, flex:'0 0 42px', background:'var(--fp-surface-2)', border:'1px solid var(--fp-line)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--fp-ink)" stroke="var(--fp-ink)" strokeWidth={1} strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--fp-ink)', marginBottom:3, letterSpacing:'-0.01em' }}>Function Plane Premium</div>
          <div style={{ fontSize:12.5, color:'var(--fp-ink-3)', lineHeight:1.5 }}>Unlock all packs and support development.</div>
        </div>
      </div>
      <div style={{ padding:'12px 18px 16px', paddingLeft:74 }}>
        <button onClick={onPremium} style={{ width:'100%', height:46, borderRadius:12, background:'var(--fp-accent)', color:'var(--fp-accent-ink)', fontSize:14, fontWeight:500, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          View Premium plans<Icon.Chevron dir="right" size={13} c="currentColor"/>
        </button>
      </div>
    </div>
  );
}

// ─── Guest view ────────────────────────────────────────────────────────────

function GuestView({ onBack, padX, onSignIn, onRegister, onPremium }) {
  return (
    <div className="fp-screen" style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', boxSizing:'border-box' }}>
      <div style={{ padding:`calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 0`, display:'flex', alignItems:'center', flex:'0 0 auto' }}>
        <button onClick={onBack} style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fp-ink-2)' }}>
          <Icon.Chevron dir="left" size={18}/>
        </button>
      </div>

      <div className="fp-scroll" style={{ flex:1, overflowY:'auto', padding:`0 ${padX}px`, paddingBottom:'max(24px, env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', paddingTop:32, paddingBottom:28 }}>
          <div style={{ width:80, height:80, borderRadius:'50%', background:'var(--fp-surface-2)', border:'2px solid var(--fp-line)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
            <Icon.User size={34} c="var(--fp-ink-4)"/>
          </div>

          <div style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:'italic', fontSize:28, letterSpacing:'-0.02em', color:'var(--fp-ink)', marginBottom:8 }}>Guest</div>

          <div style={{ fontSize:13.5, color:'var(--fp-ink-3)', textAlign:'center', lineHeight:1.55, maxWidth:280, marginBottom:28 }}>
            Create an account to sync progress across devices and compete on the global leaderboard.
          </div>

          <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
            <button onClick={onRegister} style={{ height:52, borderRadius:15, background:'var(--fp-accent)', color:'var(--fp-accent-ink)', fontSize:15, fontWeight:500 }}>
              Create account
            </button>
            <button onClick={onSignIn} style={{ height:52, borderRadius:15, background:'var(--fp-surface)', border:'1px solid var(--fp-line)', color:'var(--fp-ink)', fontSize:15, fontWeight:500 }}>
              Sign in
            </button>
          </div>
        </div>

        <div style={{ height:1, background:'var(--fp-line)', marginBottom:20 }}/>
        <PremiumCard onPremium={onPremium}/>
      </div>

      <div style={{ textAlign:'center', fontSize:11, color:'var(--fp-ink-4)', padding:'8px 12px', paddingBottom:'max(16px, env(safe-area-inset-bottom, 0px))' }}>
        Progress is saved locally on this device.
      </div>
    </div>
  );
}

// ─── Signed-in view ────────────────────────────────────────────────────────

function SignedInView({ account, progress, onBack, padX, onPremium, onAdmin }) {
  const stars   = FP_AUTH.totalStarsFromProgress(progress);
  const isAdmin = FP_AUTH.isAdmin && FP_AUTH.isAdmin();
  const [signOutOpen, setSignOutOpen] = useACS(false);
  const [deleteOpen,  setDeleteOpen]  = useACS(false);
  const [busy, setBusy] = useACS(false);

  const doSignOut = async () => {
    setBusy(true);
    try { await FP_AUTH.signOut(); }
    finally { setBusy(false); setSignOutOpen(false); }
  };
  const doDelete = async () => {
    setBusy(true);
    try { await FP_AUTH.deleteAccount(); }
    catch (e) { window.fpToast?.(e.message, { kind: 'error' }); }
    finally { setBusy(false); setDeleteOpen(false); }
  };

  return (
    <div className="fp-screen" style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', boxSizing:'border-box', position:'relative' }}>
      {signOutOpen && (
        <ConfirmPopup
          title="Sign out?"
          body="Your progress is saved on the server, so you can sign back in any time on this or another device."
          confirmLabel="Sign out"
          danger={false}
          busy={busy}
          onCancel={() => setSignOutOpen(false)}
          onConfirm={doSignOut}/>
      )}
      {deleteOpen && (
        <ConfirmPopup
          title="Delete account permanently?"
          body="This removes your profile, all gameplay progress, and your leaderboard entries. This cannot be undone."
          confirmLabel="Delete account"
          danger={true}
          busy={busy}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={doDelete}/>
      )}

      <div style={{ padding:`calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 0`, display:'flex', alignItems:'center', flex:'0 0 auto' }}>
        <button onClick={onBack} style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fp-ink-2)' }}>
          <Icon.Chevron dir="left" size={18}/>
        </button>
      </div>

      <div className="fp-scroll" style={{ flex:1, overflowY:'auto', padding:`0 ${padX}px`, paddingBottom:'max(24px, env(safe-area-inset-bottom, 0px))' }}>
        {/* Profile */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', paddingTop:24, paddingBottom:24 }}>
          <div style={{ width:84, height:84, borderRadius:'50%', background:'var(--fp-surface-2)', border:'2px solid var(--fp-line)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, fontSize:40 }}>
            {account.avatar}
          </div>
          <div style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:'italic', fontSize:28, letterSpacing:'-0.02em', color:'var(--fp-ink)', marginBottom:4 }}>
            {account.name}
          </div>
          <div style={{ fontSize:12, color:'var(--fp-ink-3)', marginBottom:16 }}>{account.email}</div>

          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span className="fp-mono" style={{ fontSize:22, fontWeight:600, color:'var(--fp-ink)' }}>{stars}</span>
            <Icon.Star size={14} c="var(--lv-star)"/>
            <span style={{ fontSize:11.5, color:'var(--fp-ink-3)', marginLeft:2 }}>total stars</span>
          </div>
        </div>

        {/* Sync status */}
        <div style={{ background:'var(--fp-surface)', border:'1px solid var(--fp-line)', borderRadius:14, padding:'12px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--fp-accent)', flex:'0 0 8px' }}/>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--fp-ink)' }}>Progress synced</div>
            <div style={{ fontSize:11.5, color:'var(--fp-ink-3)', lineHeight:1.5 }}>
              Sign in on any device with this account to continue where you left off.
            </div>
          </div>
        </div>

        {/* Leaderboard note */}
        <div style={{ background:'var(--fp-surface)', border:'1px solid var(--fp-line)', borderRadius:14, padding:'12px 16px', marginBottom:22, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, flex:'0 0 36px', background:'var(--fp-surface-2)', border:'1px solid var(--fp-line)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon.Trophy size={16} c="var(--fp-ink-3)"/>
          </div>
          <div style={{ fontSize:12.5, color:'var(--fp-ink-2)', lineHeight:1.5 }}>
            Your scores appear on the global leaderboard as <strong style={{ color:'var(--fp-ink)' }}>{account.name}</strong>.
          </div>
        </div>

        <div style={{ height:1, background:'var(--fp-line)', marginBottom:18 }}/>

        {isAdmin && (
          <button onClick={onAdmin} style={{
            width:'100%', height:52, borderRadius:14, marginBottom:14,
            background:'var(--fp-ink)', color:'var(--fp-bg)',
            fontSize:14, fontWeight:500,
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 16px',
          }}>
            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:14 }}>⚙️</span>
              Admin panel
            </span>
            <Icon.Chevron dir="right" size={14} c="currentColor"/>
          </button>
        )}

        <PremiumCard onPremium={onPremium}/>

        <button onClick={() => setSignOutOpen(true)} style={{ width:'100%', height:48, borderRadius:14, background:'transparent', border:'1px solid var(--fp-line)', color:'var(--fp-ink-2)', fontSize:13.5, fontWeight:500, marginBottom:10 }}>
          Sign out
        </button>

        <button onClick={() => setDeleteOpen(true)} style={{
          width:'100%', height:42, borderRadius:12, background:'transparent', border:'1px solid color-mix(in srgb, #e34 35%, var(--fp-line))',
          color:'#e34', fontSize:12.5, fontWeight:500,
        }}>
          Delete account
        </button>
      </div>
    </div>
  );
}

// ─── Sign in ───────────────────────────────────────────────────────────────

function SignInView({ onBack, padX, onSuccess, onReset }) {
  const [email, setEmail] = useACS('');
  const [pass,  setPass]  = useACS('');
  const [msg,   setMsg]   = useACS({ text:'', ok:false });
  const [busy,  setBusy]  = useACS(false);

  const submit = async () => {
    setMsg({ text:'', ok:false }); setBusy(true);
    try   { await FP_AUTH.signIn({ email, password: pass }); onSuccess(); }
    catch (e) { setMsg({ text: e.message, ok: false }); }
    finally   { setBusy(false); }
  };

  return (
    <ScreenFrame title="Sign in" onBack={onBack} padX={padX}>
      <div style={{ padding:'24px 0' }}>
        <StatusLine msg={msg.text} ok={msg.ok}/>
        <AuthField label="Email"    type="email"    value={email} onChange={setEmail} placeholder="you@example.com" autoFocus/>
        <AuthField label="Password" type="password" value={pass}  onChange={setPass}  placeholder="••••••••"/>

        <button onClick={submit} disabled={busy} style={{ width:'100%', height:52, borderRadius:15, marginTop:4, background:'var(--fp-accent)', color:'var(--fp-accent-ink)', fontSize:15, fontWeight:500, opacity:busy?0.6:1 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ textAlign:'center', marginTop:18 }}>
          <button onClick={onReset} style={{ fontSize:12.5, color:'var(--fp-ink-3)' }}>Forgot password?</button>
        </div>
      </div>
    </ScreenFrame>
  );
}

// ─── Register ──────────────────────────────────────────────────────────────

function RegisterView({ onBack, padX, onSuccess }) {
  const [name,  setName]  = useACS('');
  const [email, setEmail] = useACS('');
  const [pass,  setPass]  = useACS('');
  const [msg,   setMsg]   = useACS({ text:'', ok:false });
  const [busy,  setBusy]  = useACS(false);

  // Name availability state: 'idle' | 'checking' | 'free' | 'taken' | 'invalid'
  const [nameStatus, setNameStatus] = useACS({ state:'idle', reason:'' });

  // Debounced availability check
  useACSEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) { setNameStatus({ state:'idle', reason:'' }); return; }
    setNameStatus({ state:'checking', reason:'' });
    const id = setTimeout(async () => {
      try {
        const r = await FP_AUTH.checkNameAvailable(trimmed);
        setNameStatus(r.available
          ? { state:'free', reason:'' }
          : { state: trimmed.length < 2 ? 'invalid' : 'taken', reason: r.reason || 'Taken' });
      } catch { setNameStatus({ state:'idle', reason:'' }); }
    }, 350);
    return () => clearTimeout(id);
  }, [name]);

  const canSubmit = !busy && nameStatus.state === 'free' && email.includes('@') && pass.length >= 6;

  const submit = async () => {
    if (!canSubmit) return;
    setMsg({ text:'', ok:false }); setBusy(true);
    try   { await FP_AUTH.register({ name, email, password: pass }); onSuccess(); }
    catch (e) { setMsg({ text: e.message, ok: false }); }
    finally   { setBusy(false); }
  };

  return (
    <ScreenFrame title="Create account" onBack={onBack} padX={padX}>
      <div style={{ padding:'24px 0' }}>
        <StatusLine msg={msg.text} ok={msg.ok}/>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11.5, color:'var(--fp-ink-3)', marginBottom:6, letterSpacing:'0.03em', textTransform:'uppercase' }}>
            Display name
          </div>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus
            style={{
              width:'100%', height:48, borderRadius:12, boxSizing:'border-box', padding:'0 14px', fontSize:15,
              background:'var(--fp-surface)',
              border: `1px solid ${nameStatus.state==='taken' || nameStatus.state==='invalid' ? '#e34'
                                  : nameStatus.state==='free' ? 'var(--fp-accent)'
                                  : 'var(--fp-line)'}`,
              color:'var(--fp-ink)', outline:'none',
            }}/>
          <div style={{ minHeight:16, marginTop:6, fontSize:11.5,
            color: nameStatus.state==='free'    ? 'var(--fp-accent)'
                 : nameStatus.state==='taken' || nameStatus.state==='invalid' ? '#e34'
                 : 'var(--fp-ink-3)',
          }}>
            {nameStatus.state==='checking' && 'Checking availability…'}
            {nameStatus.state==='free'     && '✓ Name is available'}
            {nameStatus.state==='taken'    && (nameStatus.reason || 'That name is taken')}
            {nameStatus.state==='invalid'  && (nameStatus.reason || 'Invalid name')}
          </div>
        </div>

        <AuthField label="Email"    type="email"    value={email} onChange={setEmail} placeholder="you@example.com"/>
        <AuthField label="Password" type="password" value={pass}  onChange={setPass}  placeholder="At least 6 characters"/>

        <button onClick={submit} disabled={!canSubmit} style={{
          width:'100%', height:52, borderRadius:15, marginTop:4,
          background:'var(--fp-accent)', color:'var(--fp-accent-ink)',
          fontSize:15, fontWeight:500, opacity: canSubmit ? 1 : 0.5,
        }}>
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <div style={{ textAlign:'center', marginTop:16, fontSize:11.5, color:'var(--fp-ink-4)', lineHeight:1.55 }}>
          Your progress will sync across all your devices.
        </div>
      </div>
    </ScreenFrame>
  );
}

// ─── Reset password ────────────────────────────────────────────────────────

function ResetView({ onBack, padX }) {
  const [email, setEmail] = useACS('');
  const [msg,   setMsg]   = useACS({ text:'', ok:false });
  const [busy,  setBusy]  = useACS(false);

  const submit = async () => {
    setMsg({ text:'', ok:false }); setBusy(true);
    try {
      await FP_AUTH.resetPassword(email);
      setMsg({ text:'Password reset link sent — check your inbox.', ok:true });
    } catch (e) { setMsg({ text: e.message, ok: false }); }
    finally    { setBusy(false); }
  };

  return (
    <ScreenFrame title="Reset password" onBack={onBack} padX={padX}>
      <div style={{ padding:'24px 0' }}>
        <StatusLine msg={msg.text} ok={msg.ok}/>
        <AuthField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus/>
        <button onClick={submit} disabled={busy} style={{ width:'100%', height:52, borderRadius:15, background:'var(--fp-accent)', color:'var(--fp-accent-ink)', fontSize:15, fontWeight:500, opacity:busy?0.6:1 }}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </div>
    </ScreenFrame>
  );
}

// ─── Premium ───────────────────────────────────────────────────────────────

function PremiumView({ onBack, padX }) {
  const [selected, setSelected] = useACS('yearly');
  const plans = [
    { id:'yearly',  label:'Annual',  price:'$9.99',  sub:'$0.83 / month',  badge:'Best value' },
    { id:'monthly', label:'Monthly', price:'$0.99',  sub:'Billed monthly' },
    { id:'lifetime',label:'Lifetime',price:'$14.99', sub:'One-time purchase' },
  ];

  // Stripe must never be reachable from inside the Play build — external
  // payment for digital goods is an anti-steering violation. Play Billing
  // isn't wired up yet, so on native the answer is "not yet", not a checkout.
  const onContinue = () => {
    if ((window.FP_PAY_CHANNEL || 'stripe') !== 'stripe') {
      window.fpConfirm?.({
        title: 'Not available yet',
        body: 'Purchases through Google Play aren\'t switched on in this build. Anything you have already unlocked stays unlocked, and premium will appear here once billing goes live.',
        confirmLabel: 'OK',
      });
      return;
    }
    const url = (window.PREMIUM_LINKS || {})[selected];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    window.fpConfirm?.({
      title: 'Premium not configured',
      body: 'In-app purchases aren\'t hooked up yet. The site owner needs to create three Stripe Payment Links and paste the URLs into src/premium-config.js. Once that\'s done, this button will open the checkout.',
      confirmLabel: 'OK',
    });
  };

  return (
    <ScreenFrame title="Premium" onBack={onBack} padX={padX}>
      <div style={{ padding:'24px 0' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:64, height:64, borderRadius:20, margin:'0 auto 14px', background:'var(--fp-surface-2)', border:'1px solid var(--fp-line)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--fp-ink)" stroke="var(--fp-ink)" strokeWidth={1} strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:'italic', fontSize:28, letterSpacing:'-0.02em', color:'var(--fp-ink)', marginBottom:6 }}>Unlock everything</div>
          <div style={{ fontSize:13.5, color:'var(--fp-ink-3)', lineHeight:1.55 }}>All packs, now and forever.</div>
        </div>

        <div style={{ background:'var(--fp-surface)', border:'1px solid var(--fp-line)', borderRadius:16, padding:'14px 18px', marginBottom:22 }}>
          {['All themed packs unlocked immediately','All future chapter packs included','No advertisements ever','Support indie development'].map((f, i, arr) => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom: i < arr.length-1 ? '1px solid var(--fp-line)' : 'none' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M5 13L9 17L19 7" stroke="var(--fp-accent)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize:13.5, color:'var(--fp-ink)' }}>{f}</span>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
          {plans.map(plan => (
            <button key={plan.id} onClick={() => setSelected(plan.id)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:14, textAlign:'left', background: selected===plan.id ? 'var(--fp-surface)' : 'transparent', border:`1.5px solid ${selected===plan.id ? 'var(--fp-ink)' : 'var(--fp-line)'}` }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--fp-ink)' }}>{plan.label}</span>
                  {plan.badge && <span style={{ fontSize:9.5, letterSpacing:'0.06em', textTransform:'uppercase', padding:'2px 7px', borderRadius:999, background:'var(--fp-ink)', color:'var(--fp-bg)' }}>{plan.badge}</span>}
                </div>
                <div style={{ fontSize:11.5, color:'var(--fp-ink-3)', marginTop:2 }}>{plan.sub}</div>
              </div>
              <div style={{ fontFamily:"'Geist Mono', monospace", fontSize:17, fontWeight:600, color:'var(--fp-ink)' }}>{plan.price}</div>
            </button>
          ))}
        </div>

        <button onClick={onContinue} style={{ width:'100%', height:54, borderRadius:16, background:'var(--fp-accent)', color:'var(--fp-accent-ink)', fontSize:16, fontWeight:600 }}>Continue</button>
        <div style={{ textAlign:'center', marginTop:14, fontSize:11, color:'var(--fp-ink-4)', lineHeight:1.6 }}>
          Payment processed securely. Cancel anytime.<br/>Restore purchases · Terms · Privacy
        </div>
      </div>
    </ScreenFrame>
  );
}

// ─── Confirm popup ──────────────────────────────────────────────────────────

function ConfirmPopup({ title, body, confirmLabel, danger, busy, onCancel, onConfirm }) {
  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--fp-bg)', border: '1px solid var(--fp-line)',
        borderRadius: 16, padding: '20px',
        maxWidth: 340, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic', fontSize: 24, color: 'var(--fp-ink)',
          letterSpacing: '-0.02em', marginBottom: 8,
        }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--fp-ink-3)', lineHeight: 1.55, marginBottom: 18 }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={busy} style={{
            flex: 1, height: 44, borderRadius: 12,
            background: 'transparent', border: '1px solid var(--fp-line)',
            color: 'var(--fp-ink)', fontSize: 13.5, fontWeight: 500,
            opacity: busy ? 0.6 : 1,
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={{
            flex: 1, height: 44, borderRadius: 12,
            background: danger ? '#e34' : 'var(--fp-ink)',
            color: danger ? '#fff' : 'var(--fp-bg)',
            fontSize: 13.5, fontWeight: 500,
            opacity: busy ? 0.6 : 1,
          }}>{busy ? '…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

window.AccountScreen = AccountScreen;
