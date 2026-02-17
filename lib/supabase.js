import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function getClientData() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  return data
}

export function getAuthHeader() {
  // Used to pass user token to protected edge functions
  return supabase.auth.getSession().then(({ data }) => ({
    'Authorization': `Bearer ${data.session?.access_token || ''}`
  }))
}
```

---

### Vercel Environment Variables

Go to vercel.com → Add New → Project → Import GitHub repo → add these before deploying:
```
NEXT_PUBLIC_SUPABASE_URL       = https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJ...anon key...
SUPABASE_SERVICE_ROLE_KEY      = eyJ...service role key...
NEXT_PUBLIC_APP_URL            = https://yourapp.vercel.app
