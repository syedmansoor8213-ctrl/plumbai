import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Onboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [f, setF] = useState({
    login_email: '', login_password: '',
    business_name: '', business_phone: '', business_address: '', owner_name: '',
    service_area_zipcodes: '',
    pricing_guide: '',
    vapi_api_key: '', vapi_assistant_id: '',
    twilio_account_sid: '', twilio_auth_token: '', twilio_phone_from: '',
    gemini_api_key: '',
    stripe_payment_link: '', google_review_link: '',
    telegram_bot_token: '', telegram_chat_id: '',
    notify_email: ''
  })

  const set = (k, v) => setF(p => ({...p, [k]: v}))

  async function submit() {
    if (!f.business_name || !f.login_email || !f.login_password) {
      setError('Business name, email and password are required'); return
    }
    setLoading(true); setError('')
    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: f.login_email, password: f.login_password
      })
      if (authErr) { setError(authErr.message); return }

      // 2. Immediately sign in to get a valid session
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: f.login_email, password: f.login_password
      })
      if (signInErr) { setError('Account created but sign-in failed. Try logging in manually.'); return }

      // 3. Insert client row
      const { data: client, error: clientErr } = await supabase.from('clients').insert({
        auth_user_id:          authData.user.id,
        login_email:           f.login_email,
        business_name:         f.business_name,
        business_phone:        f.business_phone,
        business_address:      f.business_address,
        owner_name:            f.owner_name,
        service_area_zipcodes: f.service_area_zipcodes.split(',').map(z => z.trim()).filter(Boolean),
        pricing_guide:         f.pricing_guide,
        vapi_api_key:          f.vapi_api_key    || null,
        vapi_assistant_id:     f.vapi_assistant_id || null,
        twilio_account_sid:    f.twilio_account_sid  || null,
        twilio_auth_token:     f.twilio_auth_token   || null,
        twilio_phone_from:     f.twilio_phone_from   || null,
        gemini_api_key:        f.gemini_api_key       || null,
        stripe_payment_link:   f.stripe_payment_link  || null,
        google_review_link:    f.google_review_link   || null,
        telegram_bot_token:    f.telegram_bot_token   || null,
        telegram_chat_id:      f.telegram_chat_id     || null,
        notify_email:          f.notify_email || f.login_email
      }).select().single()

      if (clientErr) { setError(clientErr.message); return }

      // 4. Create 14 days of slots
      await createSlots(client.id)

      router.push('/dashboard')
    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function createSlots(clientId) {
    const slots = []
    for (let d = 0; d < 14; d++) {
      const base = new Date(); base.setDate(base.getDate() + d)
      // Regular slots every 2 hours 8am-5pm
      for (let h = 8; h <= 17; h += 2) {
        const s = new Date(base); s.setHours(h, 0, 0, 0)
        slots.push({ client_id: clientId, slot_datetime: s.toISOString(), is_available: true, is_emergency_buffer: false })
      }
      // Emergency buffer at 7am
      const em = new Date(base); em.setHours(7, 0, 0, 0)
      slots.push({ client_id: clientId, slot_datetime: em.toISOString(), is_available: true, is_emergency_buffer: true })
    }
    const { error } = await supabase.from('slots').insert(slots)
    if (error) console.error('slot creation error:', error.message)
  }

  const s = {
    page: {background:'#0a0a0a',minHeight:'100vh',display:'flex',justifyContent:'center',padding:'40px 16px',fontFamily:'system-ui'},
    card: {background:'#111',border:'1px solid #222',borderRadius:'16px',padding:'32px',width:'100%',maxWidth:'520px',color:'#f0f0f0',height:'fit-content'},
    inp:  {width:'100%',background:'#1a1a1a',border:'1px solid #333',borderRadius:'8px',padding:'10px 12px',color:'#f0f0f0',fontSize:'14px',boxSizing:'border-box',outline:'none'},
    lbl:  {display:'block',fontSize:'11px',color:'#888',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.5px'},
    sec:  {color:'#ff4d00',fontSize:'11px',textTransform:'uppercase',letterSpacing:'1px',margin:'20px 0 12px',fontWeight:'700'},
    fld:  {marginBottom:'12px'},
  }

  function Field({ k, label, type='text', placeholder='' }) {
    return (
      <div style={s.fld}>
        <label style={s.lbl}>{label}</label>
        <input style={s.inp} type={type} value={f[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={{color:'#ff4d00',fontSize:'22px',margin:'0 0 4px'}}>Client Setup</h1>
        <p style={{color:'#777',fontSize:'13px',margin:'0 0 24px'}}>Screen-share with client — fill together</p>
        {error && <p style={{color:'#f44',fontSize:'13px',background:'#400',padding:'10px',borderRadius:'6px',margin:'0 0 16px'}}>{error}</p>}

        <p style={s.sec}>Login</p>
        <Field k="login_email"    label="Dashboard Email *"    type="email"    placeholder="owner@business.com" />
        <Field k="login_password" label="Dashboard Password *" type="password" placeholder="min 8 characters" />

        <p style={s.sec}>Business</p>
        <Field k="business_name"    label="Business Name *"  placeholder="Mike's Plumbing" />
        <Field k="owner_name"       label="Owner Name"       placeholder="Mike Johnson" />
        <Field k="business_phone"   label="Business Phone"   type="tel" placeholder="+1 555 000 0000" />
        <Field k="business_address" label="Business Address" placeholder="123 Shop St, City, ZIP" />

        <p style={s.sec}>Service Area & Pricing</p>
        <Field k="service_area_zipcodes" label="ZIP Codes (comma-separated)" placeholder="10001, 10002, 10003" />
        <div style={s.fld}>
          <label style={s.lbl}>Pricing Guide (one per line)</label>
          <textarea
            style={{...s.inp, height:'100px', fontFamily:'monospace', fontSize:'12px', resize:'vertical'}}
            value={f.pricing_guide}
            onChange={e => set('pricing_guide', e.target.value)}
            placeholder={"burst pipe $1200-2500\nleak $300-800\ndrain $150-400\nsewer $800-2000\nwater heater $600-1800"}
          />
        </div>

        <p style={s.sec}>API Keys (Client Pays — BYOK)</p>
        <Field k="vapi_api_key"       label="Vapi API Key"           type="password" placeholder="from vapi.ai" />
        <Field k="vapi_assistant_id"  label="Vapi Assistant ID"      placeholder="from Vapi after creating agent" />
        <Field k="twilio_account_sid" label="Twilio Account SID"     placeholder="ACxxxxxxxxxxxxxxxx" />
        <Field k="twilio_auth_token"  label="Twilio Auth Token"      type="password" />
        <Field k="twilio_phone_from"  label="Twilio Phone Number"    placeholder="+15550001234" />
        <Field k="gemini_api_key"     label="Gemini API Key"         type="password" placeholder="from aistudio.google.com" />

        <p style={s.sec}>Links (Just Paste URLs)</p>
        <Field k="stripe_payment_link" label="Stripe Payment Link"  type="url" placeholder="https://buy.stripe.com/..." />
        <Field k="google_review_link"  label="Google Review Link"   type="url" placeholder="https://g.page/r/..." />

        <p style={s.sec}>Owner Notifications</p>
        <Field k="notify_email"       label="Notification Email"    type="email" />
        <Field k="telegram_bot_token" label="Telegram Bot Token"    type="password" placeholder="from @BotFather" />
        <Field k="telegram_chat_id"   label="Telegram Chat ID"      placeholder="send /start to bot, then check getUpdates URL" />

        <button
          onClick={submit}
          disabled={loading || !f.business_name || !f.login_email || !f.login_password}
          style={{width:'100%',background:loading?'#555':'#ff4d00',color:'#000',border:'none',borderRadius:'10px',padding:'16px',fontSize:'16px',fontWeight:'800',cursor:'pointer',marginTop:'24px',opacity:(!f.business_name||!f.login_email||!f.login_password)?0.5:1}}
        >
          {loading ? 'Setting up...' : '🚀 Launch Client →'}
        </button>
      </div>
    </div>
  )
}
