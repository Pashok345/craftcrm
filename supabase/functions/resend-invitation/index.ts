import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const generateInvitationEmail = (name: string, email: string, resetLink: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 16px 24px; border-radius: 16px; margin-bottom: 16px;">
        <span style="color: white; font-size: 28px; font-weight: bold;">CRM Pro</span>
      </div>
    </div>
    
    <!-- Main Card -->
    <div style="background-color: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">🔄</span>
      </div>
      <h1 style="color: #111827; font-size: 24px; margin: 0 0 8px 0; text-align: center;">
        Повторне запрошення
      </h1>
      <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px 0; text-align: center;">
        Вітаємо, ${name || 'колего'}! Вас знову запрошено до CRM системи.
      </p>
      
      <!-- Info Box -->
      <div style="background-color: #f0f9ff; border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 20px; margin-right: 10px;">📧</span>
          <div>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">Ваша пошта</p>
            <p style="color: #111827; margin: 0; font-weight: 600;">${email}</p>
          </div>
        </div>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
          Увійти та встановити пароль
        </a>
      </div>
      
      <!-- Steps -->
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #374151; font-size: 14px; font-weight: 600; margin-bottom: 16px;">
          Після входу вам потрібно:
        </p>
        <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
          <span style="background-color: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">1</span>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">Встановити пароль для входу</p>
        </div>
        <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
          <span style="background-color: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">2</span>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">Вказати номер телефону</p>
        </div>
        <div style="display: flex; align-items: flex-start;">
          <span style="background-color: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px; flex-shrink: 0;">3</span>
          <p style="color: #6b7280; margin: 0; font-size: 14px;">Обрати вашу посаду</p>
        </div>
      </div>
      
      <!-- Notice -->
      <div style="background-color: #fef3c7; border-radius: 12px; padding: 16px; margin-top: 24px; display: flex; align-items: flex-start;">
        <span style="font-size: 20px; margin-right: 12px;">⚡</span>
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>Важливо:</strong> Ваш акаунт стане активним після верифікації адміністратором.
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Якщо у вас виникнуть питання, зверніться до адміністратора
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
        © 2024 CRM Pro. Усі права захищено.
      </p>
    </div>
  </div>
</body>
</html>
`

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
        JSON.stringify({ error: 'Тільки адміністратори можуть надсилати запрошення' }),
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
    const normalizedEmail = email.trim().toLowerCase()

    // First, check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === normalizedEmail
    )

    if (!existingUser) {
      return new Response(
        JSON.stringify({ error: 'Користувача не знайдено' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user profile is already verified
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, position, phone, is_verified')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile?.is_verified) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'already_verified',
          message: 'Користувач вже активований і має доступ до системи',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a new password reset link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: `${origin}/complete-profile`,
      },
    })

    if (resetError) {
      console.error('Error generating reset link:', resetError)
      return new Response(
        JSON.stringify({ error: 'Не вдалося створити посилання для входу' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resetLink = resetData?.properties?.action_link

    if (!resetLink) {
      return new Response(
        JSON.stringify({ error: 'Не вдалося створити посилання для входу' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send our custom styled invitation email
    const userName = existingProfile?.name || existingUser.user_metadata?.name || ''
    
    const { error: emailError } = await resend.emails.send({
      from: 'CRM <onboarding@resend.dev>',
      to: [normalizedEmail],
      subject: '🔄 Повторне запрошення до CRM системи',
      html: generateInvitationEmail(userName, normalizedEmail, resetLink),
    })

    if (emailError) {
      console.error('Error sending invitation email:', emailError)
      return new Response(
        JSON.stringify({ error: 'Не вдалося надіслати лист запрошення' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Invitation resent to:', normalizedEmail)
    
    return new Response(
      JSON.stringify({ success: true, message: 'Запрошення надіслано повторно' }),
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
