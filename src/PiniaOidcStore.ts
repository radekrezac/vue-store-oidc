import { defineStore, StateTree, StoreDefinition, _ActionsTree, _GettersTree } from "pinia";
import type { User } from "oidc-client-ts";
import { RouteLocationNormalized } from 'vue-router';
// Static Classes
import { OidcHelpers, OidcBrowserEvents, OidcUtils, PayloadType, OidcSigninSilentOptions } from '.'
// Class StoreOidcClient used  as state member
import { StoreOidcClientSettings, StoreOidcSettings, StoreOidcListeners } from '.'
// Parent OidcStore Class
import { OidcStore, OidcStoreMembers, OidcStoreState, OidcStoreGetters, OidcStoreActions, OidcStoreMutations, OidcStoreActionsMutations } from '.'

export interface PiniaOidcStoreState extends StateTree, OidcStoreState {
  [key: string]: string | boolean | string[] | null | undefined | any
}

export interface PiniaOidcStoreGetters extends OidcStoreGetters, _GettersTree<PiniaOidcStoreState> {
  [key: string]: string | number | boolean | string[] | null | undefined | any
}

export interface PiniaOidcStoreActions extends OidcStoreActions, OidcStoreMutations, _ActionsTree { }

export interface PiniaOidcStoreType extends PiniaOidcStoreState, PiniaOidcStoreGetters, PiniaOidcStoreActions { }
export type PiniaOidcStoreDefinition = StoreDefinition<"auth", PiniaOidcStoreState, PiniaOidcStoreGetters, PiniaOidcStoreActions>

export class PiniaOidcStore extends OidcStore {
  private _actions: OidcStoreActionsMutations = {
    oidcCheckAccess(this: OidcStoreMembers, route: RouteLocationNormalized) {
      return new Promise(resolve => {
        if (this.storeOidcClient?.RouteIsOidcCallback(route)) {
          resolve(true)
          return
        }
        let hasAccess = true
        const isAuthenticatedInStore = this.oid
        this.storeOidcClient?.UserManager.getUser().then(user => {
          if (!user || user.expired) {
            const authenticateSilently = this.storeOidcClient?.OidcClientSettings.silentRedirectUri && this.storeOidcClient?.OidcClientSettings.automaticSilentSignin
            if (this.storeOidcClient?.RouteIsPublic(route)) {
              if (isAuthenticatedInStore) {
                this.unsetOidcAuth()
              }
              if (authenticateSilently) {
                this.authenticateOidc()
                this.authenticateOidcSilent({ ignoreErrors: true } as OidcSigninSilentOptions)
              }
            }
            else {
              const authenticate = () => {
                if (isAuthenticatedInStore) {
                  this.unsetOidcAuth()
                }
                this.authenticateOidc(route.fullPath)
              }
              // If silent signin is set up, try to authenticate silently before denying access
              if (authenticateSilently) {
                this.authenticateOidcSilent({ ignoreErrors: true } as OidcSigninSilentOptions)
                  .then(() => {
                    this.storeOidcClient?.UserManager.getUser().then(user => {
                      if (!user || user.expired) {
                        authenticate()
                      }
                      resolve(!!user)
                    }).catch(() => {
                      authenticate()
                      resolve(false)
                    })
                  })
                  .catch(() => {
                    authenticate()
                    resolve(false)
                  })
                return
              }
              // If no silent signin is set up, perform explicit authentication and deny access
              authenticate()
              hasAccess = false
            }
          }
          else {
            this.oidcWasAuthenticated(user)
            if (!isAuthenticatedInStore) {
              if (this.storeOidcClient?.OidcEventListeners && typeof this.storeOidcClient?.OidcEventListeners.userLoaded === 'function') {
                this.storeOidcClient?.OidcEventListeners.userLoaded(user)
              }
              if (this.storeOidcClient?.OidcStoreSettings.dispatchEventsOnWindow) {
                OidcBrowserEvents.DispatchCustomBrowserEvent('userLoaded', user)
              }
            }
          }
          resolve(hasAccess)
        })
      })
    },
    authenticateOidcSilent(this: OidcStoreMembers, payload?: PayloadType) {
      // Take options for signinSilent from 1) payload or 2) this.storeOidcClient?.OidcStoreSettings if defined there
      const options = payload ? OidcUtils.PayloadItem(payload, 'option') : {} || this.storeOidcClient?.OidcStoreSettings.defaultSigninSilentOptions || {}
      return new Promise<User | null>((resolve, reject) => {
        this.storeOidcClient?.UserManager.signinSilent(options)
          .then(user => {
            this.oidcWasAuthenticated(user)
            resolve(user)
          })
          .catch(err => {
            this.setOidcAuthIsChecked()
            if (payload && OidcUtils.PayloadItem(payload, 'ignoreErrors')) {
              resolve(null)
            } else {
              this.setOidcError(OidcUtils.ErrorPayload('authenticateOidcSilent', err))
              reject(err)
            }
          })
      })
    },
    authenticateOidc(this: OidcStoreMembers, payload?) {
      const redirectPath = payload ? OidcUtils.PayloadItem(payload, 'redirectPath') : ''
      if (redirectPath) {
        sessionStorage.setItem('vue_oidc_active_route', redirectPath)
      } else {
        sessionStorage.removeItem('vue_oidc_active_route')
      }
      // Take options for signinRedirect from 1) payload or 2) storeSettings if defined there
      const options = payload ? OidcUtils.PayloadItem(payload, 'options') : {} || this.storeOidcClient?.OidcStoreSettings.defaultSigninRedirectOptions || {}
      return this.storeOidcClient?.UserManager.signinRedirect(options)
        .catch((err: any) => this.setOidcError(OidcUtils.ErrorPayload('authenticateOidc', err)))
    },
    oidcSignInCallback(this: OidcStoreMembers, url) {
      return new Promise((resolve, reject) => {
        this.storeOidcClient?.UserManager.signinRedirectCallback(url)
          .then(user => {
            this.oidcWasAuthenticated(user)
            resolve(sessionStorage.getItem('vue_oidc_active_route') || '/')
          })
          .catch(err => {
            this.setOidcError(OidcUtils.ErrorPayload('oidcSignInCallback', err))
            this.setOidcAuthIsChecked
            reject(err)
          })
      })
    },
    authenticateOidcPopup(this: OidcStoreMembers, payload?: PayloadType) {
      // Take options for signinPopup from 1) payload or 2) this.storeOidcClient?.OidcStoreSettings if defined there
      const options = payload ? OidcUtils.PayloadItem(payload, 'options') : {} || this.storeOidcClient?.OidcStoreSettings.defaultSigninPopupOptions || {}
      return this.storeOidcClient?.UserManager.signinPopup(options)
        .then(user => {
          this.oidcWasAuthenticated(user)
        })
        .catch(err => {
          this.setOidcError(OidcUtils.ErrorPayload('authenticateOidcPopup', err))
        })
    },
    oidcSignInPopupCallback(this: OidcStoreMembers, url) {
      return new Promise((resolve, reject) => {
        this.storeOidcClient?.UserManager.signinPopupCallback(url)
          .catch(err => {
            this.setOidcError(OidcUtils.ErrorPayload('oidcSignInPopupCallback', err))
            this.setOidcAuthIsChecked()
            reject(err)
          })
      })
    },
    oidcWasAuthenticated(this: OidcStoreMembers, user) {
      if (user) {
        this.setOidcAuth(user)
      }
      if (!this.events_are_bound) {
        this.storeOidcClient?.UserManager.events.addAccessTokenExpired(() => { this.unsetOidcAuth() })
        if (this.storeOidcClient?.OidcClientSettings.automaticSilentRenew) {
          this.storeOidcClient?.UserManager.events.addAccessTokenExpiring(() => {
            this.authenticateOidcSilent()
              .catch((err) => {
                this.storeOidcClient?.DispatchCustomErrorEvent('automaticSilentRenewError', OidcUtils.ErrorPayload('authenticateOidcSilent', err))
              })
          })
        }
        this.setOidcEventsAreBound()
      }
      this.setOidcAuthIsChecked()
    },
    storeUser(this: OidcStoreMembers, user) {
      return this.storeOidcClient?.UserManager.storeUser(user)
        .then(() => this.storeOidcClient?.UserManager.getUser())
        .then(user => this.oidcWasAuthenticated(user))
        .catch(err => {
          this.setOidcError(OidcUtils.ErrorPayload('OidcStoreUser', err))
          this.setOidcAuthIsChecked()
          throw err
        })
    },
    getUser(this: OidcStoreMembers) {
      return this.storeOidcClient?.UserManager.getUser().then(user => {
        if(user) this.setUser(user)
        return user
      })
    },
    addOidcEventListener(this: OidcStoreMembers, payload) {
      if (this.storeOidcClient) 
        OidcHelpers.AddUserManagerEventListener(this.storeOidcClient.UserManager, 
                  OidcUtils.PayloadItem(payload, 'eventName'), 
                  OidcUtils.PayloadItem(payload, 'eventListener'))
    },
    removeOidcEventListener(this: OidcStoreMembers, payload) {
      if (this.storeOidcClient) 
        OidcHelpers.RemoveUserManagerEventListener(this.storeOidcClient.UserManager, 
                  OidcUtils.PayloadItem(payload, 'eventName'), 
                  OidcUtils.PayloadItem(payload, 'eventListener'))
    },
    signOutOidc(this: OidcStoreMembers, payload) {
      return this.storeOidcClient?.UserManager.signoutRedirect(payload).then(() => {
        this.unsetOidcAuth()
      })
    },
    signOutOidcCallback(this: OidcStoreMembers) {
      return this.storeOidcClient?.UserManager.signoutRedirectCallback()
    },
    signOutPopupOidc(this: OidcStoreMembers, payload) {
      return this.storeOidcClient?.UserManager.signoutPopup(payload).then(() => {
        this.unsetOidcAuth()
      })
    },
    signOutPopupOidcCallback(this: OidcStoreMembers ) {
      return this.storeOidcClient?.UserManager.signoutPopupCallback()
    },
    signOutOidcSilent(this: OidcStoreMembers, payload) {
      return new Promise((resolve, reject) => {
        try {
          this.storeOidcClient?.UserManager.getUser()
            .then((user) => {
              const args = OidcUtils.ObjectAssign([
                payload || {},
                {
                  id_token_hint: user ? user.id_token : null
                }
              ])
              if (payload && OidcUtils.PayloadItem(payload, 'id_token_hint')) {
                args.id_token_hint = OidcUtils.PayloadItem(payload, 'id_token_hint')
              }
              const oidcClient = this.storeOidcClient?.OidcClient
              if (oidcClient) {
                oidcClient.createSignoutRequest(args)
                  .then((signoutRequest) => {
                    OidcBrowserEvents.OpenUrlWithIframe(signoutRequest.url)
                      .then(() => {
                        this.removeUser()
                        resolve()
                      })
                      .catch((err) => reject(err))
                  })
                  .catch((err: any) => reject(err))
              }
            })
            .catch((err) => reject(err))
        } catch (err) {
          reject(err)
        }
      })
    },
    removeUser(this: OidcStoreMembers) {
      return this.removeOidcUser()
    },
    removeOidcUser(this: OidcStoreMembers) {
      return this.storeOidcClient?.UserManager.removeUser().then(() => {
        this.unsetOidcAuth()
      })
    },
    clearStaleState(this: OidcStoreMembers) {
      return this.storeOidcClient?.UserManager.clearStaleState()
    },
    // Mutations
    setOidcAuth(this: OidcStoreMembers, user: User) {
      this.user = user || null
      this.error = null
    },
    setUser(this: OidcStoreMembers, user: User) {
      this.user = user 
    },
    unsetOidcAuth(this: OidcStoreMembers) {
      this.user = null
    },
    setOidcAuthIsChecked(this: OidcStoreMembers) {
      this.is_checked = true
    },
    setOidcEventsAreBound(this: OidcStoreMembers) {
      this.events_are_bound = true
    },
    setOidcError(this: OidcStoreMembers, payload: PayloadType) {
      if (payload) {
        this.error = OidcUtils.PayloadItem(payload, 'error')
        this.storeOidcClient?.DispatchCustomErrorEvent('oidcError', payload)
      }
    }
  }
  constructor(oidcClientSettings: StoreOidcClientSettings, oidcStoreSettings?: StoreOidcSettings, oidcEventListeners?: StoreOidcListeners) {
    super(oidcClientSettings, oidcStoreSettings, oidcEventListeners)
  }
  get Actions() {
    return this._actions
  }
  get Mutations(): OidcStoreMutations {
    throw new Error("Method not implemented.");
  }
  CreateStore() {
    return defineStore({
      id: 'post',
      state: (() => this._state as PiniaOidcStoreState),
      getters: this._getters as PiniaOidcStoreGetters,
      actions: this._actions as PiniaOidcStoreActions
    })
  }
}