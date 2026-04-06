import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import prisma from './db'
import { 
  checkLoginAttempts, 
  recordFailedLogin, 
  recordSuccessfulLogin,
  sendAccountLockoutNotification
} from './security'

// Session Timeout Ayarları - Kullanıcı çıkış yapana kadar oturum açık kalır
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 gün (saniye cinsinden)
const SESSION_UPDATE_AGE = 24 * 60 * 60 // Her 24 saatte bir yenile

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        
        // IP adresi al (spoofing korumalı)
        const realIp = req?.headers?.['x-real-ip']
        const forwarded = req?.headers?.['x-forwarded-for']
        // x-real-ip öncelikli, sonra x-forwarded-for'un SON elemanı (güvenilir)
        const ip = realIp 
          ? (Array.isArray(realIp) ? realIp[0] : realIp)
          : forwarded 
            ? (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',').pop()?.trim() || 'unknown'
            : 'unknown'
        const userAgent = req?.headers?.['user-agent'] || 'unknown'
        
        // Brute-force kontrolü
        const loginCheck = await checkLoginAttempts(ip, credentials.email)
        
        if (!loginCheck.allowed) {
          // Hesap kilitleme bildirimi gönder
          await sendAccountLockoutNotification(
            credentials.email,
            ip,
            5, // 5 deneme sonrası kilitleme
            undefined
          )
          throw new Error('ACCOUNT_LOCKED')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          await recordFailedLogin(ip, credentials.email, userAgent, 'User not found')
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          await recordFailedLogin(ip, credentials.email, userAgent, 'Invalid password')
          return null
        }
        
        // Başarılı giriş - logla
        await recordSuccessfulLogin(ip, user.id, user.email, userAgent)
        
        // Son giriş tarihini güncelle
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })
        
        // IP'den şehir tespiti
        try {
          if (ip && ip !== 'unknown' && ip !== '127.0.0.1' && ip !== '::1') {
            const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,status`, {
              signal: AbortSignal.timeout(3000)
            });
            if (geoRes.ok) {
              const geo = await geoRes.json();
              if (geo.status === 'success' && geo.city) {
                await prisma.user.update({
                  where: { email: user.email },
                  data: { location: `${geo.city}` }
                });
              }
            }
          }
        } catch (e) {
          console.log('[Auth] Geo lookup failed:', e);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE, // 30 gün oturum süresi
    updateAge: SESSION_UPDATE_AGE, // Her 24 saatte bir yenile
  },
  jwt: {
    maxAge: SESSION_MAX_AGE, // JWT token 30 gün geçerli
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.image = (user as any).image
      }
      // Session update'te veya ilk login'de DB'den güncel bilgileri çek
      if ((trigger === 'update' || !token.language) && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { image: true, language: true }
        })
        if (dbUser) {
          token.image = dbUser.image
          token.language = dbUser.language || 'tr'
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token?.id as string
        (session.user as any).role = token?.role as string
        (session.user as any).image = token?.image as string | null
        ;(session.user as any).language = (token?.language as string) || 'tr'
      }
      return session
    },
  },
  pages: {
    signIn: '/giris',
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      }
    }
  },
}
