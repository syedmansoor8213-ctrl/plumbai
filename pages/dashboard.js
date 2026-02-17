import { useEffect, useState, useCallback } from 'react'
import { supabase, getClientData } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Dashboard() {
  const router = useRouter()
  const [client,       setClient]       = useState(null)
  const [bookings,     setBookings]     = useState([])
  const [pendingLeads, setPendingLeads] = useState([])
  const [stats,        setStats]        = useState({})
  const [loading,      setLoading]      = useState(true)
  const [actionMsg,    setActionMsg]    = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const clientData = await getClientData()
    if (!clientData) { router.push('/onboard'); return }
    setClient(clientData)
    await loadData(clientData.id)
    setLoading(false)
  }

  const loadData = useCallback(async (clientId) => {
    const today    = new Date(); today.setHours(0,0,0,0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

    const [bRes, pRes, lRes] = await Promise.all([
      supabase.from('bookings').select(`*, leads(*)`).eq('client_id', clientId)
        .in('booking_status', ['confirmed','pending','in_progress'])
        .gte('scheduled_datetime', today.toISOString())
        .lt('scheduled_datetime',  tomorrow.toISOString())
        .order('priority_score', { ascending: false }),

      supabase.from('leads').select('*').eq('client_id', clientId)
        .in('lead_status', ['qualified','price_shown','deposit_requested'])
        .order('priority_score', { ascending: false }),

      supabase.from('leads').select('intake_channel, lead_status').eq('client_id', clientId)
        .gte('created_at', today.toISOString())
    ])

    const tb = bRes.data || []
    const pl = pRes.data || []
    const al = lRes.data || []

    setBookings(tb)
    setPendingLeads(pl)

    const calls     = al.filter(l => l.intake_channel === 'call').length
    const forms     = al.filter(l => l.intake_channel === 'form').length
    const qualified = al.filter(l => !['new','rejected'].includes(l.lead_status)).length
    const revenue   = tb.reduce((s, b) => s + (b.estimated_revenue || 0), 0)

    setStats({ calls, forms, qualified, booked: tb.length, revenue, total: calls + forms })
  }, [])

  async function handleAction(type, bookingId) {
    if (!client) return
    setActionMsg('')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''

    if (type === 'done') {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/job-done`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ booking_id: bookingId, client_id: client.id })
        }
      )
      const data = await res.json()
      if (data.success) {
        setActionMsg('✅ Job marked complete. Review request sent.')
        await loadData(client.id)
      }
    }

    if (type === 'confirm' || type === 'cancel') {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ booking_id: bookingId, client_id: client.id, action: type })
        }
      )
      const data = await res.json()
      if (data.success) {
        setActionMsg(type === 'confirm' ? '✅ Booking confirmed. SMS sent.' : '❌ Booking cancelled.')
        await loadData(client.id)
      }
    }

    if (type === 'mark_paid') {
      await supabase.from('bookings').update({
        deposit_status: 'owner_confirmed',
        confirmed_by_owner: true,
        confirmed_at: new Date().toISOString()
      }).eq('id', bookingId)
      setActionMsg('✅ Deposit marked as verified.')
      await loadData(client.id)
    }
  }

  if (loading) return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#888',fontFamily:'system-ui'}}>
      Loading...
    </div>
  )

  return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',color:'#f0f0f0',fontFamily:'system-ui, sans-serif'}}>

      {/* ALWAYS-ON WARNING BANNER */}
      <div style={{background:'#cc0000',color:'#fff',padding:'10px 20px',fontSize:'13px',textAlign:'center',position:'sticky',top:0,zIndex:999,fontWeight:'700',lineHeight:1.4}}>
        ⚠️ ALWAYS verify payment received in Stripe before dispatching a tech — never trust the deposit status badge alone
      </div>

      {/* ACTION FEEDBACK */}
      {actionMsg && (
        <div style={{background:'#111',borderBottom:'1px solid #333',padding:'10px 24px',fontSize:'13px',color:'#4f4',textAlign:'center'}}>
          {actionMsg} <button onClick={() => setActionMsg('')} style={{background:'none',border:'none',color:'#666',cursor:'pointer',marginLeft:'8px'}}>×</button>
        </div>
      )}

      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #222',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'800',color:'#ff4d00',margin:0}}>{client?.business_name}</h1>
          <p style={{color:'#777',fontSize:'12px',margin:'3px 0 0'}}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <button onClick={() => loadData(client.id)} style={{background:'#1a1a1a',border:'1px solid #333',color:'#aaa',padding:'6px 12px',borderRadius:'6px',cursor:'pointer',fontSize:'12px'}}>↻ Refresh</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={{background:'transparent',border:'1px solid #333',color:'#666',padding:'6px 12px',borderRadius:'6px',cursor:'pointer',fontSize:'12px'}}>Sign Out</button>
        </div>
      </div>

      {/* STATS */}
      <div style={{display:'flex',gap:'10px',padding:'14px 24px',overflowX:'auto',borderBottom:'1px solid #222',flexWrap:'wrap'}}>
        {[
          ['Inquiries',  stats.total,     '#fff'],
          ['Calls',      stats.calls,     '#6af'],
          ['Forms',      stats.forms,     '#af6'],
          ['Qualified',  `${stats.qualified||0} (${stats.total ? Math.round((stats.qualified||0)/(stats.total)*100) : 0}%)`, '#ff6'],
          ['Booked',     stats.booked,    '#4f4'],
          ['Revenue',    `$${(stats.revenue||0).toLocaleString()}`, '#f84']
        ].map(([label, val, color]) => (
          <div key={label} style={{background:'#111',border:'1px solid #222',borderRadius:'8px',padding:'10px 14px',minWidth:'90px',textAlign:'center',flexShrink:0}}>
            <div style={{fontSize:'20px',fontWeight:'800',color: color as string}}>{val ?? 0}</div>
            <div style={{fontSize:'10px',color:'#666',marginTop:'3px',textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</div>
          </div>
        ))}
      </div>

      {/* TODAY'S JOBS */}
      <div style={{padding:'16px 24px'}}>
        <h2 style={{fontSize:'14px',fontWeight:'700',margin:'0 0 12px',color:'#ccc',textTransform:'uppercase',letterSpacing:'0.5px'}}>
          Today's Jobs ({bookings.length})
        </h2>

        {bookings.length === 0 && <p style={{color:'#444',fontSize:'14px',padding:'16px 0'}}>No jobs scheduled today.</p>}

        {bookings.map(b => {
          const lead      = b.leads
          const emergency = lead?.is_emergency
          const depositOk = b.deposit_status === 'owner_confirmed'
          const isCOD     = b.deposit_status === 'cod'
          const time      = new Date(b.scheduled_datetime).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})

          return (
            <div key={b.id} style={{background:'#111',border:'1px solid #222',borderLeft:`3px solid ${emergency ? '#f44' : '#f84'}`,borderRadius:'10px',padding:'14px',marginBottom:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'10px',flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:'200px'}}>
                  <div style={{fontSize:'15px',fontWeight:'700',marginBottom:'3px'}}>
                    {lead?.customer_name || 'Unknown'} {emergency && '🚨'}
                  </div>
                  <div style={{fontSize:'13px',color:'#ff4d00',textTransform:'capitalize',marginBottom:'3px'}}>
                    {(lead?.issue_type||'').replace(/_/g,' ')} — {time}
                  </div>
                  <div style={{fontSize:'11px',color:'#888',marginBottom:'2px'}}>
                    Est. {lead?.estimated_price_range} | Score: {b.priority_score}/100 | Tech: {b.tech_name || '—'}
                  </div>
                  <div style={{fontSize:'11px',color:'#666'}}>{lead?.customer_address}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px',flexShrink:0}}>
                  <div style={{padding:'3px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:'700',
                    background: depositOk ? '#003300' : isCOD ? '#002200' : '#330000',
                    color: depositOk ? '#4f4' : isCOD ? '#4d4' : '#f44', border: '1px solid currentColor'
                  }}>
                    {depositOk ? '✅ Deposit Verified' : isCOD ? '💵 COD' : '⚠️ Unverified'}
                  </div>
                  <div style={{display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'flex-end'}}>
                    <a href={`tel:${lead?.customer_phone}`} style={{background:'#0a2a0a',color:'#4f4',padding:'5px 10px',borderRadius:'5px',fontSize:'11px',fontWeight:'700',textDecoration:'none',border:'1px solid #4f422'}}>
                      📞 Call
                    </a>
                    {!depositOk && !isCOD && (
                      <button onClick={() => handleAction('mark_paid', b.id)} style={{background:'#1a2a1a',color:'#4f4',border:'1px solid #4f4',padding:'5px 10px',borderRadius:'5px',fontSize:'11px',cursor:'pointer',fontWeight:'700'}}>
                        Mark Paid ✓
                      </button>
                    )}
                    <button onClick={() => handleAction('done', b.id)} style={{background:'#1a1a1a',color:'#888',border:'1px solid #333',padding:'5px 10px',borderRadius:'5px',fontSize:'11px',cursor:'pointer',fontWeight:'700'}}>
                      ✅ Done
                    </button>
                    <button onClick={() => { if (confirm('Cancel this booking?')) handleAction('cancel', b.id) }} style={{background:'#2a1a1a',color:'#f44',border:'1px solid #f44',padding:'5px 10px',borderRadius:'5px',fontSize:'11px',cursor:'pointer',fontWeight:'700'}}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* PENDING LEADS */}
      {pendingLeads.length > 0 && (
        <div style={{padding:'0 24px 32px'}}>
          <h2 style={{fontSize:'14px',fontWeight:'700',margin:'0 0 12px',color:'#ccc',textTransform:'uppercase',letterSpacing:'0.5px'}}>
            🟡 Needs Attention ({pendingLeads.length})
          </h2>
          {pendingLeads.map(l => (
            <div key={l.id} style={{background:'#111',border:'1px solid #222',borderRadius:'10px',padding:'14px',marginBottom:'10px'}}>
              <div style={{fontSize:'14px',fontWeight:'700',marginBottom:'3px'}}>
                {l.customer_name || 'Unknown'} — {(l.issue_type||'').replace(/_/g,' ')}
              </div>
              <div style={{fontSize:'11px',color:'#888',marginBottom:'8px'}}>
                {l.estimated_price_range} | Via {l.intake_channel} | Status: {l.lead_status}
              </div>
              <a href={`tel:${l.customer_phone}`} style={{background:'#0a2a0a',color:'#4f4',padding:'5px 10px',borderRadius:'5px',fontSize:'11px',fontWeight:'700',textDecoration:'none'}}>
                📞 {l.customer_phone}
              </a>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
