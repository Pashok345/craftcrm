import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create client with user's token to verify their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify the user's token
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      console.error('Token verification failed:', claimsError)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub

    // Create admin client to check role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the caller is an admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (roleError) {
      console.error('Error checking role:', roleError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (roleData?.role !== 'admin') {
      console.error('User is not an admin:', userId)
      return new Response(
        JSON.stringify({ error: 'Only administrators can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, name, position, phone } = await req.json()

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'Email and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const userExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.trim().toLowerCase())
    
    if (userExists) {
      return new Response(
        JSON.stringify({ error: 'Пользователь с таким email уже существует' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if phone already exists in profiles
    if (phone && phone.trim() !== '+38' && phone.trim() !== '') {
      const { data: existingPhone } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('phone', phone.trim())
        .maybeSingle()
      
      if (existingPhone) {
        return new Response(
          JSON.stringify({ error: 'Пользователь с таким телефоном уже существует' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get the origin for redirect URL
    const origin = req.headers.get('origin') || 'https://craftcrm.lovable.app'

    // Use inviteUserByEmail - this sends invitation via Supabase's built-in email system
    // (same system that sends verification emails - no Resend needed!)
    const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: {
          name: name.trim(),
        },
        redirectTo: `${origin}/auth`
      }
    )

    if (inviteError) {
      console.error('Error inviting user:', inviteError)
      console.error('Error message:', inviteError.message)
      
      let errorMessage = 'Не удалось создать пользователя'
      const errMsg = inviteError.message || ''
      
      if (errMsg.includes('already registered') || errMsg.includes('already exists')) {
        errorMessage = 'Пользователь с таким email уже существует'
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (newUser.user) {
      // Update the profile with additional info
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          name: name.trim(),
          position: position || 'other',
          phone: phone && phone.trim() !== '+38' ? phone.trim() : null,
        })
        .eq('user_id', newUser.user.id)

      if (profileError) {
        console.error('Profile update error:', profileError)
      }

      console.log('User invited successfully:', newUser.user.id)
      // Invitation email is sent automatically by Supabase Auth
      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: newUser.user.id,
          message: 'Приглашение отправлено на email пользователя'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown error creating user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in create-user function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
