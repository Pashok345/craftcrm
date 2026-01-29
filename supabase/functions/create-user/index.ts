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

    // Generate a secure random password (user will use password reset)
    const randomPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 8)

    // Create user via admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: randomPassword,
      email_confirm: true, // Auto-confirm email since admin is creating
      user_metadata: {
        name: name.trim(),
      },
    })

    if (createError) {
      console.error('Error creating user:', createError)
      let errorMessage = 'Failed to create user'
      if (createError.message?.includes('already registered') || createError.message?.includes('already exists')) {
        errorMessage = 'User with this email already exists'
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

      // Generate password reset link for the new user
      const origin = req.headers.get('origin') || 'https://craftcrm.lovable.app'
      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email.trim(),
        options: {
          redirectTo: `${origin}/auth`
        }
      })

      let resetLink = null
      if (resetError) {
        console.error('Error generating reset link:', resetError)
      } else if (resetData?.properties?.action_link) {
        resetLink = resetData.properties.action_link
      }

      console.log('User created successfully:', newUser.user.id)
      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: newUser.user.id,
          resetLink,
          message: 'User created successfully'
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
