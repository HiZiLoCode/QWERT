'use client'

import { useEffect, useRef } from 'react'
import i18next from 'i18next'
import { initReactI18next, useTranslation as useTranslationOrg } from 'react-i18next'
import { useCookies } from 'react-cookie'
import resourcesToBackend from 'i18next-resources-to-backend'
import { getOptions, cookieName, fallbackLng } from './setting'
import LanguageDetector from 'i18next-browser-languagedetector'
// 
i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(resourcesToBackend((language, namespace) => import(`./locales/${language}/${namespace}.json`)))
  .init({
    ...getOptions(),
    lng: undefined, // let detect the language on client side
  })

export function useTranslation(ns, options) {
    const [cookies, setCookie] = useCookies([cookieName])
    const ret = useTranslationOrg(ns, options)
    const { i18n } = ret
    const didSyncFromCookieRef = useRef(false)

    useEffect(() => {
        const resolved = i18n.resolvedLanguage
        if (!resolved) return
        if (cookies?.[cookieName] === resolved) return
        setCookie(cookieName, resolved, { path: '/' })
    }, [cookies, i18n.resolvedLanguage, setCookie])

    useEffect(() => {
        if (didSyncFromCookieRef.current) return
        didSyncFromCookieRef.current = true
        const cookieLng = cookies?.[cookieName]
        if (cookieLng && cookieLng !== i18n.resolvedLanguage) {
            i18n.changeLanguage(cookieLng)
            return
        }
        if (!cookieLng && i18n.resolvedLanguage !== fallbackLng) {
            i18n.changeLanguage(fallbackLng)
        }
    }, [cookies, i18n])

    return ret
}
