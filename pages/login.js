import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function login() {
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/dashboard')
  }

  const f = { width:'100%', background:'#1a1a1a', border:'1px solid #333', borderRadius:'8px', padding:'10px 12px', color:'#f0f0f0', fontSize:'14px', boxSizing:'border-box', outline:'none' }

  return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui'}}>
      <div style={{background:'#111',border:'1px solid #222',borderRadius:'16px',padding:'32px',width:'100%',maxWidth:'360px',color:'#f0f0f0'}}>
        <h1 style={{color:'#ff4d00',fontSize:'24px',margin:'0 0 4px'}}>PlumbAI</h1>
        <p style={{color:'#777',fontSize:'13px',margin:'0 0 24px'}}>Owner dashboard sign in</p>
        {error && <p style={{color:'#f44',fontSize:'13px',margin:'0 0 12px'}}>{error}</p>}
        <div style={{marginBottom:'10px'}}>
          <input style={f} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{marginBottom:'16px'}}>
          <input style={f} type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
        </div>
        <button onClick={login} disabled={loading || !email || !pass} style={{width:'100%',background:loading?'#555':'#ff4d00',color:'#000',border:'none',borderRadius:'10px',padding:'14px',fontSize:'15px',fontWeight:'800',cursor:'pointer'}}>
          {loading ? 'Signing in...' : 'Sign In →'}
        </button>
        <p style={{textAlign:'center',marginTop:'16px',fontSize:'13px',color:'#666'}}>
          New? <a href="/onboard" style={{color:'#ff4d00'}}>Set up your account</a>
        </p>
      </div>
    </div>
  )
}
