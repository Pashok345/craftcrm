import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller's identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerId = claimsData.claims.sub
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if caller is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .maybeSingle()

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Только администраторы могут отправлять приглашения' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const origin = req.headers.get('origin') || 'https://craftcrm.lovable.app'

    // First, check if user exists and their confirmation status
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === email.trim().toLowerCase()
    )

    if (!existingUser) {
      return new Response(
        JSON.stringify({ error: 'Пользователь не найден' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If the user has already signed in at least once, they have completed onboarding.
    // Treat this as a non-fatal business case (200) so the UI can show a friendly message
    // without triggering a runtime error overlay.
    if (existingUser.last_sign_in_at) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'already_registered',
          message: 'Пользователь уже завершил регистрацию и входил в систему',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's profile data before deletion to preserve it
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, position, phone')
      .eq('email', email.trim())
      .maybeSingle()

    // Delete the old user and create new invitation
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
    
    if (deleteError) {
      console.error('Error deleting old user:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Не удалось обновить приглашение' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Now create a fresh invitation
    const { data: newInvite, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: {
          name: existingProfile?.name || '',
        },
        redirectTo: `${origin}/complete-profile`
      }
    )

    if (inviteError) {
      console.error('Error creating new invitation:', inviteError)
      return new Response(
        JSON.stringify({ error: 'Не удалось отправить приглашение' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the new user's profile with preserved data
    if (newInvite.user && existingProfile) {
      await supabaseAdmin
        .from('profiles')
        .update({
          name: existingProfile.name,
          position: existingProfile.position,
          phone: existingProfile.phone,
        })
        .eq('user_id', newInvite.user.id)
    }

    console.log('Invitation resent to:', email)
    return new Response(
      JSON.stringify({ success: true, message: 'Приглашение отправлено повторно' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in resend-invitation function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
