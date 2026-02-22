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

// Session Timeout Ayarları
const SESSION_MAX_AGE = 24 * 60 * 60 // 24 saat (saniye cinsinden) - kullanıcı deneyimi için
const SESSION_UPDATE_AGE = 5 * 60 // Her 5 dakikada bir yenile

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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE, // 30 dakika oturum süresi
    updateAge: SESSION_UPDATE_AGE, // Her 5 dakikada bir yenile
  },
  jwt: {
    maxAge: SESSION_MAX_AGE, // JWT token 30 dakika geçerli
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token?.id as string
        (session.user as any).role = token?.role as string
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
