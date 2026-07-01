import { createContext, useContext, useState } from 'react'
import axios from 'axios'
import { isProductionApiMissing, missingApiMessage } from '../apiConfig.js'

const AuthContext = createContext(null)

export const ROLE_ACCESS = {
	ld_team: ['/', '/catalog', '/ld-validation', '/manager-approval', '/participants', '/workflow'],
	reporting_manager: ['/', '/catalog', '/manager-approval', '/participants', '/workflow', '/nominate', '/rm-course-request', '/notifications'],
	functional_head: ['/', '/catalog', '/manager-approval', '/participants', '/workflow', '/notifications'],
}

export const canAccessRolePath = (role, path) => ROLE_ACCESS[role]?.includes(path) ?? false

export const getDefaultRouteForRole = (role) => '/'

export function AuthProvider({ children }) {
	const [user, setUser] = useState(() => {
		const saved = sessionStorage.getItem('lms_user')
		return saved ? JSON.parse(saved) : null
	})

	const login = async (email, password, name = '') => {
		if (isProductionApiMissing()) {
			return {
				success: false,
				message: missingApiMessage,
			}
		}

		try {
			const { data } = await axios.post('/api/auth/login', { email, password, name })
			sessionStorage.setItem('lms_user', JSON.stringify(data.user))
			setUser(data.user)
			return { success: true, user: data.user }
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.detail || 'Unable to sign in right now. Please try again.',
			}
		}
	}

	const requestPasswordReset = async (email) => {
		if (isProductionApiMissing()) {
			return {
				success: false,
				message: missingApiMessage,
			}
		}

		try {
			const { data } = await axios.post('/api/auth/forgot-password', { email })
			return { success: true, message: data.message }
		} catch (_) {
			return {
				success: false,
				message: 'Unable to submit a reset request right now. Please try again.',
			}
		}
	}

	const logout = () => {
		sessionStorage.removeItem('lms_user')
		setUser(null)
	}

	const can = (path) => {
		if (!user) return false
		return canAccessRolePath(user.role, path)
	}

	const getDefaultRoute = () => getDefaultRouteForRole(user?.role)

	return (
		<AuthContext.Provider value={{ user, login, logout, can, getDefaultRoute, requestPasswordReset }}>
			{children}
		</AuthContext.Provider>
	)
}

export const useAuth = () => useContext(AuthContext)
