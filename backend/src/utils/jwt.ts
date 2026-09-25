import jwt from 'jsonwebtoken'

function readJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

const JWT_SECRET = readJwtSecret()

const JWT_EXPIRES_IN = '7d'

type TokenPayload = {
  sub: string
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies TokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}
