import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/router'

export default function IntakeForm() {
  const router = useRouter()
  const { clientSlug } = router.query
  const [client,  setClient]  = useState(null)
  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [result,  setResult]  = useState(null)
  const [booking, setBooking] = useState(null)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '',
    issue: '', description: '', is_emergency: false
  })

  useEffect(() => {
    if (!clientSlug) return
    // Public read allowed via "clients_public_read" RLS policy
    supabase.from('clients')
      .select('id, business_name, business_phone')
      .eq('id', clientSlug)
      .eq('is_active', true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setError('Business not found or unavailable.')
        else setClient(data)
      })
  }, [clientSlug])

  async function submitIntake() {
    if (!form.issue || !form.name || !form.phone || !form.address) {
      setError('Please fill in all required fields.'); return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/intake`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({
            client_id:        client.id,
            channel:          'form',
            customer_name:    form.name,
            customer_phone:   form.phone,
            customer_email:   form.email,
            customer_address: form.address,
            raw_text:         `${form.issue}: ${form.description}`
          })
        }
      )
      const data = await res.json()
      if (!res.ok || data.error) { setError('Something went wrong. Please call us directly.'); return }
      if (data.status === 'rejected') { setError('Sorry, we are unable to service this request. An SMS has been sent with more info.'); return }
      setResult(data)
      setStep(3)
    } catch {
      setError('Connection error. Please call us directly.')
    } finally {
      setLoading(false)
    }
  }

  async function selectPayment(choice) {
    setLoading(true); setError('')
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/book-slot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ lead_id: result.lead_id, client_id: client.id, payment_choice: choice })
        }
      )
      const data = await res.json()
      if (!res.ok || data.error) {
        if (data.full) { setError('No available slots right now. Please call us directly: ' + client.business_phone); return }
        setError('Something went wrong. Please call us.'); return
      }
      if (choice === 'pay_now' && data.stripe_link) window.open(data.stripe_link, '_blank')
      setBooking(data)
      setStep(5)
    } catch {
      setError('Connection error. Please call us directly.')
    } finally {
      setLoading(false)
    }
  }

  const s = {
    page: {background:'#0a0a0a',minHeight:'100vh',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'32px 16px',fontFamily:'system-ui'},
    card: {background:'#111',border:'1px solid #222',borderRadius:'16px',padding:'24px',width:'100%',maxWidth:'460px',color:'#f0f0f0'},
    inp:  {width:'100%',background:'#1a1a1a',border:'1px solid #333',borderRadius:'8px',padding:'10px 12px',color:'#f0f0f0',fontSize:'14px',boxSizing:'border-box',outline:'none'},
    lbl:  {display:'block',fontSize:'11px',color:'#888',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'0.5px'},
    fld:  {marginBottom:'13px'},
    btn:  {width:'100%',background:'#ff4d00',color:'#000',border:'none',borderRadius:'10px',padding:'14px',fontSize:'15px',fontWeight:'800',cursor:'pointer'},
    ghost:{width:'100%',background:'transparent',color:'#666',border:'1px solid #333',borderRadius:'10px',padding:'12px',fontSize:'14px',cursor:'pointer'},
    err:  {background:'#400',border:'1px solid #f44',borderRadius:'8px',padding:'12px',marginBottom:'14px',fontSize:'13px',color:'#f88'},
  }

  if (error && !client) return (
    <div style={s.page}>
      <div style={s.card}>
        <p style={s.err}>{error}</p>
      </div>
    </div>
  )

  if (!client) return (
    <div style={{...s.page,alignItems:'center'}}>
      <div style={{color:'#888',fontFamily:'system-ui'}}>Loading...</div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={{color:'#ff4d00',fontSize:'20px',fontWeight:'800',margin:'0 0 3px'}}>{client.business_name}</h1>
        <p style={{color:'#777',fontSize:'13px',margin:'0 0 18px'}}>Emergency Plumbing — 24/7 Service</p>
        <hr style={{border:'none',borderTop:'1px solid #222',margin:'0 0 18px'}} />

        {error && <div style={s.err}>{error}</div>}

        {/* STEP 1+2 — Issue & Contact */}
        {step <= 2 && (
          <>
            <div style={s.fld}>
              <label style={s.lbl}>What's the problem? *</label>
              <select style={s.inp} value={form.issue} onChange={e => setForm({...form, issue: e.target.value})}>
                <option value="">Select issue...</option>
                <option value="burst_pipe">🚨 Burst Pipe</option>
                <option value="leak">💧 Water Leak</option>
                <option value="drain">🔩 Clogged Drain</option>
                <option value="sewer">🪣 Sewer Backup</option>
                <option value="water_heater">🔥 Water Heater</option>
              </select>
            </div>

            <div style={s.fld}>
              <label style={s.lbl}>Describe briefly</label>
              <textarea style={{...s.inp, height:'70px', resize:'none'}}
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="e.g. pipe burst under kitchen sink, water everywhere"
              />
            </div>

            <div style={s.fld}>
              <label style={s.lbl}>Is this an emergency right now?</label>
              <div style={{display:'flex',gap:'8px'}}>
                {['Yes — RIGHT NOW', 'No — Can wait'].map((opt, i) => (
                  <button key={i} type="button" style={{
                    flex:1, padding:'10px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'700',
                    border: '1px solid #333',
                    background: form.is_emergency === (i===0) ? '#ff4d00' : '#1a1a1a',
                    color:      form.is_emergency === (i===0) ? '#000' : '#888'
                  }} onClick={() => setForm({...form, is_emergency: i === 0})}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <hr style={{border:'none',borderTop:'1px solid #222',margin:'14px 0'}} />

            <div style={s.fld}>
              <label style={s.lbl}>Full Name *</label>
              <input style={s.inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your full name" />
            </div>
            <div style={s.fld}>
              <label style={s.lbl}>Phone Number *</label>
              <input style={s.inp} type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+1 555 000 0000" />
            </div>
            <div style={s.fld}>
              <label style={s.lbl}>Service Address *</label>
              <input style={s.inp} value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="123 Main St, City, ZIP" />
            </div>
            <div style={s.fld}>
              <label style={s.lbl}>Email (optional)</label>
              <input style={s.inp} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="you@email.com" />
            </div>

            <button
              style={{...s.btn, opacity: (!form.issue || !form.name || !form.phone || !form.address || loading) ? 0.4 : 1}}
              disabled={!form.issue || !form.name || !form.phone || !form.address || loading}
              onClick={submitIntake}
            >
              {loading ? 'Checking...' : 'Get Price & Book →'}
            </button>
          </>
        )}

        {/* STEP 3 — Show Price */}
        {step === 3 && result && (
          <>
            <div style={{background:'#1a0800',border:'1px solid #ff4d00',borderRadius:'10px',padding:'18px',marginBottom:'18px',textAlign:'center'}}>
              <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',marginBottom:'6px'}}>
                Typical price for {form.issue.replace(/_/g,' ')}
              </div>
              <div style={{fontSize:'30px',fontWeight:'800',color:'#ff4d00'}}>{result.price_range}</div>
              <div style={{fontSize:'11px',color:'#666',marginTop:'6px'}}>Final quote given on-site. No hidden fees.</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <button style={s.btn} onClick={() => setStep(4)}>Looks good, book me →</button>
              <button style={s.ghost} onClick={() => { setStep(1); setResult(null); setError('') }}>Price is too high</button>
            </div>
          </>
        )}

        {/* STEP 4 — Payment */}
        {step === 4 && (
          <>
            <div style={{background:'#1a0800',border:'1px solid #ff4d00',borderRadius:'10px',padding:'18px',marginBottom:'18px',textAlign:'center'}}>
              <div style={{fontSize:'15px',fontWeight:'700',marginBottom:'6px'}}>Secure your time slot</div>
              <p style={{color:'#aaa',fontSize:'13px',margin:0}}>Pay a small deposit now to lock in your slot, or choose cash on delivery.</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <button style={{...s.btn, opacity: loading ? 0.5 : 1}} disabled={loading} onClick={() => selectPayment('pay_now')}>
                {loading ? 'Booking...' : '💳 Pay Deposit Now (Lock Slot)'}
              </button>
              <button style={{...s.ghost, opacity: loading ? 0.5 : 1}} disabled={loading} onClick={() => selectPayment('cod')}>
                💵 Cash on Delivery
              </button>
            </div>
          </>
        )}

        {/* STEP 5 — Confirmation */}
        {step === 5 && booking && (
          <div style={{textAlign:'center',padding:'16px 0'}}>
            <div style={{fontSize:'48px',marginBottom:'12px'}}>✅</div>
            <h2 style={{color:'#4f4',margin:'0 0 8px',fontSize:'20px'}}>You're booked!</h2>
            <p style={{color:'#bbb',fontSize:'14px',margin:'0 0 4px'}}>{booking.slot_display}</p>
            <p style={{color:'#bbb',fontSize:'13px',margin:'0 0 16px'}}>Tech: {booking.tech_name}</p>
            <p style={{color:'#666',fontSize:'12px',margin:0}}>
              Confirmation SMS sent to {form.phone}.<br />
              We'll text you 30 minutes before arrival.
            </p>
            {booking.payment_choice === 'pay_now' && (
              <div style={{background:'#0a2a0a',border:'1px solid #4f4',borderRadius:'8px',padding:'12px',marginTop:'16px',color:'#4f4',fontSize:'13px'}}>
                💳 Stripe payment link opened in new tab. Complete your payment to fully confirm the slot.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## STEP 10 — Vapi Voice Agent Setup

vapi.ai → client signs up → Settings → Billing → Add card.

Vapi → Assistants → Create → paste System Prompt:
```
You are the AI receptionist for {{business_name}}, an emergency plumbing service.

ONLY goal: Collect 4 fields in under 60 seconds. Be natural, warm, fast.

FIELDS NEEDED:
1. Issue type (burst pipe / leak / drain clog / sewer backup / water heater)
2. Full address including ZIP code
3. Is it an emergency right now? (yes/no)
4. Name and callback phone number

RULES:
- 60 seconds max, 1-2 questions per turn
- If they say burst / flooding / no heat / gas — flag as emergency immediately
- Never quote prices yourself — say "let me check availability and pricing for you"
- Once you have all 4 fields: "Perfect, checking our next available slot now..." then call the webhook
- If after 3 exchanges you still lack address or phone: "I need your address and phone number to dispatch someone — can you share those?"

OPEN WITH: "Hi! You've reached {{business_name}} emergency plumbing, available 24/7. What's going on today?"
```

Vapi → Assistant → Functions → Add Tool → Server URL (webhook):
```
URL:     https://YOUR-PROJECT.supabase.co/functions/v1/intake
Method:  POST
Headers: { "Authorization": "Bearer YOUR-ANON-KEY" }

Body:
{
  "client_id": "PASTE-THIS-CLIENT-UUID",
  "channel": "call",
  "transcript": "{{transcript}}",
  "customer_phone": "{{call.customer.number}}",
  "vapi_call_id": "{{call.id}}"
}
