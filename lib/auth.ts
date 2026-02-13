import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import prisma from './db'
import { 
  checkLoginAttempts, 
  recordFailedLogin, 
  recordSuccessfulLogin 
} from './security'

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
        
        // IP adresi al (headers'dan)
        const forwarded = req?.headers?.['x-forwarded-for']
        const ip = typeof forwarded === 'string' 
          ? forwarded.split(',')[0] 
          : (forwarded?.[0] || 'unknown')
        const userAgent = req?.headers?.['user-agent'] || 'unknown'
        
        // Brute-force kontrolü
        const loginCheck = await checkLoginAttempts(ip, credentials.email)
        
        if (!loginCheck.allowed) {
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
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string })?.role
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as { role?: string }).role = token?.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/giris',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
