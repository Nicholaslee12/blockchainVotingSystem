import fs from 'fs'
import path from 'path'

export interface User {
  id: string // student / voter ID
  name: string
  email: string
  blockchainAddress: string
  createdAt: string
}

const getUsersFilePath = () => {
  return path.join(process.cwd(), 'data', 'users.json')
}

const ensureUsersFile = () => {
  const filePath = getUsersFilePath()
  const dir = path.dirname(filePath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([]), 'utf8')
  }

  return filePath
}

export const getAllUsers = (): User[] => {
  const filePath = ensureUsersFile()
  const raw = fs.readFileSync(filePath, 'utf8')

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return []
  } catch {
    return []
  }
}

export const saveAllUsers = (users: User[]) => {
  const filePath = ensureUsersFile()
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8')
}

export const findUserByIdentifier = (identifier: string): User | undefined => {
  const users = getAllUsers()
  const lower = identifier.toLowerCase()
  return users.find(
    (u) => u.id.toLowerCase() === lower || u.email.toLowerCase() === lower
  )
}

export const findUserByEmailOrIdOrAddress = (params: {
  id?: string
  email?: string
  blockchainAddress?: string
}): User | undefined => {
  const users = getAllUsers()
  const id = params.id?.toLowerCase()
  const email = params.email?.toLowerCase()
  const address = params.blockchainAddress?.toLowerCase()

  return users.find((u) => {
    const matchesId = id ? u.id.toLowerCase() === id : false
    const matchesEmail = email ? u.email.toLowerCase() === email : false
    const matchesAddress = address
      ? u.blockchainAddress.toLowerCase() === address
      : false
    return matchesId || matchesEmail || matchesAddress
  })
}

export const createUser = (payload: {
  id: string
  name: string
  email: string
  blockchainAddress: string
}): User => {
  const users = getAllUsers()

  const exists = findUserByEmailOrIdOrAddress({
    id: payload.id,
    email: payload.email,
    blockchainAddress: payload.blockchainAddress,
  })

  if (exists) {
    throw new Error('User with this ID, email or wallet already exists')
  }

  const user: User = {
    ...payload,
    blockchainAddress: payload.blockchainAddress.toLowerCase(),
    createdAt: new Date().toISOString(),
  }

  users.push(user)
  saveAllUsers(users)
  return user
}


